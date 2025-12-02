import { NextRequest, NextResponse } from "next/server";
import { getTokenConfig } from "@/lib/token";
import { storeDonation } from "@/lib/db";

export interface WriteMessageRequest {
  amount: number; // TOKEN amount (minimum 1)
  name?: string; // Optional donor name
  message?: string; // Optional message
}

/**
 * POST /api/write-message
 *
 * Donate tokens with optional name and message
 * Protected by x402 middleware - requires TOKEN payment
 * This route accepts TOKEN as payment and writes to community board
 *
 * Body:
 * {
 *   "amount": 100,          // TOKEN amount
 *   "name": "John Doe",     // optional
 *   "message": "To the moon!" // optional
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Get payment details from middleware
    const paymentResponse = request.headers.get("X-PAYMENT-RESPONSE");
    if (!paymentResponse) {
      return NextResponse.json(
        { success: false, error: "Payment verification failed" },
        { status: 402 }
      );
    }

    let payerAddress: string;
    let transactionSignature: string | undefined;
    try {
      const decoded = JSON.parse(
        Buffer.from(paymentResponse, "base64").toString()
      );
      payerAddress = decoded.payer;
      transactionSignature = decoded.transaction;
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid payment response" },
        { status: 500 }
      );
    }

    // Parse request body
    const body = (await request.json()) as WriteMessageRequest;
    const { amount, name, message } = body;

    // Validate amount
    if (!amount || amount < 1) {
      return NextResponse.json(
        { success: false, error: "Amount must be at least 1 TOKEN" },
        { status: 400 }
      );
    }

    // Get token configuration
    const tokenConfig = getTokenConfig();

    // Calculate USD equivalent for display purposes
    const usdEquivalent = amount / tokenConfig.dollarToTokenRatio;

    // Store donation record with message in database
    // Note: We don't mint tokens here - user is paying WITH tokens
    await storeDonation(
      payerAddress,
      usdEquivalent,
      amount,
      name,
      message,
      transactionSignature // Pass the transaction signature from payment response
    );

    return NextResponse.json({
      success: true,
      message: `Thank you${
        name ? `, ${name},` : ""
      } for your ${amount.toLocaleString()} ${tokenConfig.symbol} donation!`,
      data: {
        donator: payerAddress,
        tokensDonated: amount,
        usdEquivalent: usdEquivalent,
        tokenSymbol: tokenConfig.symbol,
        name: name || null,
        message: message || null,
        transactionSignature: transactionSignature || null,
      },
    });
  } catch (error) {
    console.error("Write message error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to process donation",
      },
      { status: 500 }
    );
  }
}
