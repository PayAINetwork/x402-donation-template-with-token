import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { decodePayment } from "x402/schemes";
import {
  computeRoutePatterns,
  findMatchingPaymentRequirements,
  findMatchingRoute,
  processPriceToAtomicAmount,
  toJsonSafe,
  safeBase64Encode,
} from "x402/shared";
import {
  FacilitatorConfig,
  PaymentPayload,
  PaymentRequirements,
  Resource,
  RoutesConfig,
  SupportedSVMNetworks,
} from "x402/types";
import { useFacilitator as createFacilitator } from "x402/verify";
import { getActualPayerFromSerializedTransaction } from "./lib/solana";

/**
 * Creates a payment middleware factory for Next.js (Solana/SVM only)
 *
 * @param payTo - The Solana address to receive payments
 * @param routes - Configuration for protected routes and their payment requirements
 * @param facilitator - Optional configuration for the payment facilitator service
 * @returns A Next.js middleware handler
 */
export function paymentMiddleware(
  payTo: string,
  routes: RoutesConfig,
  facilitator?: FacilitatorConfig
) {
  const { settle, supported } = createFacilitator(facilitator);
  const x402Version = 1;

  // Pre-compile route patterns to regex and extract verbs
  const routePatterns = computeRoutePatterns(routes);

  return async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const method = request.method.toUpperCase();

    // Find matching route configuration
    const matchingRoute = findMatchingRoute(routePatterns, pathname, method);

    if (!matchingRoute) {
      return NextResponse.next();
    }

    const { price, network, config = {} } = matchingRoute.config;
    const {
      description,
      mimeType,
      maxTimeoutSeconds,
      inputSchema,
      outputSchema,
      resource,
      errorMessages,
    } = config;

    let atomicAmountForAsset;

    // Check for dynamic amount in query params
    const queryAmount = request.nextUrl.searchParams.get("amount");
    const dynamicAmount = queryAmount ? parseFloat(queryAmount) : null;

    // Check if this is a custom token payment (contains tokenMint)
    // Use global tokenMint variable defined at bottom of file
    if (tokenMint && typeof price === "string" && price.includes(tokenMint)) {
      // Parse amount from "1 TOKEN_MINT" string OR use dynamic amount
      const amount = dynamicAmount || parseFloat(price.split(" ")[0]);

      // Get decimals from env or default to 9
      const decimals = parseInt(process.env.NEXT_PUBLIC_TOKEN_DECIMALS || "9");

      const atomicAmount = BigInt(
        Math.floor(amount * Math.pow(10, decimals))
      ).toString();

      atomicAmountForAsset = {
        maxAmountRequired: atomicAmount,
        asset: {
          address: tokenMint,
          decimals: decimals,
        },
      };
    } else {
      // Default behavior for USDC/SOL
      // If dynamic amount is present, construct a new price string
      const effectivePrice = dynamicAmount ? `${dynamicAmount}` : price;
      atomicAmountForAsset = processPriceToAtomicAmount(
        effectivePrice,
        network
      );
    }

    console.log("[x402] Middleware Config:", {
      tokenMint,
      priceString: price,
      network,
    });
    console.log("[x402] Price calculation:", {
      route: pathname,
      priceConfig: price,
      network,
      result: atomicAmountForAsset,
    });

    if ("error" in atomicAmountForAsset) {
      console.error(
        "[x402] Price calculation error:",
        atomicAmountForAsset.error
      );
      return new NextResponse(atomicAmountForAsset.error, { status: 500 });
    }
    const { maxAmountRequired, asset } = atomicAmountForAsset;

    const resourceUrl =
      resource ||
      (`${request.nextUrl.protocol}//${request.nextUrl.host}${pathname}` as Resource);

    const paymentRequirements: PaymentRequirements[] = [];

    // Solana/SVM networks only
    if (SupportedSVMNetworks.includes(network)) {
      // network call to get the supported payments from the facilitator
      const paymentKinds = await supported();

      // find the payment kind that matches the network and scheme
      let feePayer: string | undefined;
      for (const kind of paymentKinds.kinds) {
        if (kind.network === network && kind.scheme === "exact") {
          feePayer = kind?.extra?.feePayer;
          break;
        }
      }

      // svm networks require a fee payer
      if (!feePayer) {
        throw new Error(
          `The facilitator did not provide a fee payer for network: ${network}.`
        );
      }

      // build the payment requirements for svm
      paymentRequirements.push({
        scheme: "exact",
        network,
        maxAmountRequired,
        resource: resourceUrl,
        description: description ?? "",
        mimeType: mimeType ?? "",
        payTo: payTo,
        maxTimeoutSeconds: maxTimeoutSeconds ?? 60,
        asset: asset.address,
        outputSchema: {
          input: {
            type: "http",
            method,
            discoverable: true,
            ...inputSchema,
          },
          output: outputSchema,
        },
        extra: {
          feePayer,
        },
      });
    } else {
      throw new Error(`Unsupported network: ${network}`);
    }

    // Check for payment header
    const paymentHeader = request.headers.get("X-PAYMENT");
    if (!paymentHeader) {
      return new NextResponse(
        JSON.stringify({
          x402Version,
          error:
            errorMessages?.paymentRequired || "X-PAYMENT header is required",
          accepts: paymentRequirements,
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify payment
    let decodedPayment: PaymentPayload;
    try {
      decodedPayment = decodePayment(paymentHeader);
      decodedPayment.x402Version = x402Version;
    } catch (error) {
      return new NextResponse(
        JSON.stringify({
          x402Version,
          error:
            errorMessages?.invalidPayment ||
            (error instanceof Error ? error : "Invalid payment"),
          accepts: paymentRequirements,
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    const selectedPaymentRequirements = findMatchingPaymentRequirements(
      paymentRequirements,
      decodedPayment
    );
    if (!selectedPaymentRequirements) {
      return new NextResponse(
        JSON.stringify({
          x402Version,
          error:
            errorMessages?.noMatchingRequirements ||
            "Unable to find matching payment requirements",
          accepts: toJsonSafe(paymentRequirements),
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    // Settle payment first
    try {
      console.log("[x402] Settling payment:", {
        decodedPayment,
        requirements: selectedPaymentRequirements,
      });

      const settlement = await settle(
        decodedPayment,
        selectedPaymentRequirements
      );

      if (!settlement.success) {
        console.error("[x402] Settlement failed:", settlement);
        return new NextResponse(
          JSON.stringify({
            x402Version,
            error:
              errorMessages?.settlementFailed || "Payment settlement failed",
            accepts: paymentRequirements,
          }),
          { status: 402, headers: { "Content-Type": "application/json" } }
        );
      }

      // Extract actual payer from the signed transaction in the payment payload
      // settlement.payer is the facilitator's fee payer, not the actual donor
      // The decodedPayment.payload.transaction contains the serialized signed transaction
      let actualPayer = settlement.payer; // fallback

      try {
        const payload = decodedPayment.payload;
        if (payload && typeof payload === "object") {
          const possibleTx = (payload as { transaction?: unknown }).transaction;
          if (typeof possibleTx === "string" && possibleTx.length > 0) {
            const payerFromTx =
              getActualPayerFromSerializedTransaction(possibleTx);
            if (payerFromTx) {
              actualPayer = payerFromTx;
            }
          }
        }
      } catch (error) {
        console.error("[x402] Error extracting payer from payload:", error);
      }

      // Proceed with request only after successful settlement
      const response = await NextResponse.next();

      // Add payment response header
      response.headers.set(
        "X-PAYMENT-RESPONSE",
        safeBase64Encode(
          JSON.stringify({
            success: true,
            transaction: settlement.transaction,
            network: settlement.network,
            payer: actualPayer, // Use actual payer, not facilitator's fee payer
          })
        )
      );

      return response;
    } catch (error) {
      return new NextResponse(
        JSON.stringify({
          x402Version,
          error:
            errorMessages?.settlementFailed ||
            (error instanceof Error ? error.message : "Settlement failed"),
          accepts: paymentRequirements,
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }
  };
}

export type {
  Money,
  Network,
  PaymentMiddlewareConfig,
  Resource,
  RouteConfig,
  RoutesConfig,
} from "x402/types";

// Get network from environment
const network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "solana-devnet") as
  | "solana"
  | "solana-devnet";
const resourceWallet = process.env.RESOURCE_SERVER_WALLET_ADDRESS;
const tokenMint = process.env.NEXT_PUBLIC_TOKEN_MINT;

// Validate required environment variables
if (!resourceWallet) {
  throw new Error(
    "RESOURCE_SERVER_WALLET_ADDRESS environment variable is required but not set"
  );
}

if (!tokenMint) {
  throw new Error("TOKEN_MINT environment variable is required but not set");
}

// Configure x402 middleware for protected routes
export const middleware = paymentMiddleware(
  resourceWallet,
  {
    // Mint route: Pay with USDC, receive TOKEN (dynamic amount, $1 minimum)
    "/api/mint": {
      price: "$1", // Minimum $1 payment in USDC, actual amount from request
      network,
      config: {
        description: "Mint tokens by paying with USDC",
        mimeType: "application/json",
      },
    },
    // Donate route: Pay with TOKEN, write to community board (dynamic amount, 1 TOKEN minimum)
    "/api/write-message": {
      price: `1 ${tokenMint}`, // Minimum 1 TOKEN payment, actual amount from request
      network,
      config: {
        description: "Donate tokens and write to community board",
        mimeType: "application/json",
      },
    },
    // Legacy routes for backwards compatibility (USDC payment, receive TOKEN)
    "/api/donate/1": {
      price: "$1",
      network,
      config: {
        description: "Donate $1 and receive tokens",
      },
    },
    "/api/donate/5": {
      price: "$5",
      network,
      config: {
        description: "Donate $5 and receive tokens",
      },
    },
    "/api/donate/10": {
      price: "$10",
      network,
      config: {
        description: "Donate $10 and receive tokens",
      },
    },
  },
  {
    url: (process.env.FACILITATOR_URL ||
      "https://facilitator.payai.network") as `${string}://${string}`,
  }
);

// Configure which routes the middleware should run on
export const config = {
  matcher: ["/api/donate/:path*", "/api/write-message", "/api/mint"],
};
