"use client";

import { useState, useMemo } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { createX402Client } from "x402-solana/client";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

type PaymentRequestBody = Record<string, unknown>;

export function useX402Payment() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { publicKey, signTransaction, sendTransaction } = useWallet();
  const { connection } = useConnection();

  // Create x402 client with wallet adapter
  const client = useMemo(() => {
    if (!publicKey || !signTransaction) {
      return null;
    }

    const network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ||
      "solana-devnet") as "solana" | "solana-devnet";

    return createX402Client({
      wallet: {
        publicKey,
        signTransaction,
      },
      network,
      rpcUrl: connection.rpcEndpoint,
    });
  }, [publicKey, signTransaction, connection.rpcEndpoint]);

  const createMerchantATA = async () => {
    if (!publicKey || !sendTransaction || !connection) {
      throw new Error("Wallet not connected");
    }

    const merchantWalletAddress = process.env.NEXT_PUBLIC_MERCHANT_ADDRESS;
    const tokenMintAddress = process.env.NEXT_PUBLIC_TOKEN_MINT;
    if (!merchantWalletAddress || !tokenMintAddress) {
      throw new Error(
        "Missing merchant wallet or token mint configuration for ATA creation."
      );
    }

    try {
      const merchantPubkey = new PublicKey(merchantWalletAddress);
      const mintPubkey = new PublicKey(tokenMintAddress);

      const associatedTokenAddress = await getAssociatedTokenAddress(
        mintPubkey,
        merchantPubkey
      );

      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          publicKey, // payer
          associatedTokenAddress,
          merchantPubkey, // owner
          mintPubkey
        )
      );

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, "confirmed");
      return true;
    } catch (err) {
      console.error("Failed to create merchant ATA:", err);
      throw new Error(
        "Failed to create merchant token account. Please try again."
      );
    }
  };

  const initiatePayment = async <TResponse = unknown>(
    endpoint: string,
    body?: PaymentRequestBody
  ): Promise<TResponse> => {
    if (!client) {
      throw new Error("Wallet not connected");
    }

    setIsProcessing(true);
    setError(null);

    const makeRequest = async () => {
      // Append amount to URL query params if present in body
      // This allows middleware to read the amount without parsing the body
      let url = endpoint;
      if (body && typeof body.amount === "number") {
        const separator = url.includes("?") ? "&" : "?";
        url = `${url}${separator}amount=${body.amount}`;
      }

      // Call x402-protected endpoint with automatic payment handling
      const response = await client.fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        // Try to get more error details
        let errorMessage = `Request failed: ${response.statusText}`;
        try {
          const errorData = await response.json();
          console.error("X402 Error Response:", errorData);
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Response wasn't JSON, use statusText
        }
        throw new Error(errorMessage);
      }

      return (await response.json()) as TResponse;
    };

    try {
      return await makeRequest();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Payment failed";

      // Check for specific ATA error
      // "Destination does not have an Associated Token Account"
      if (
        errorMessage.includes(
          "Destination does not have an Associated Token Account"
        )
      ) {
        try {
          console.log(
            "Detected missing ATA error. Attempting to create merchant ATA..."
          );
          await createMerchantATA();
          console.log("Merchant ATA created. Retrying payment...");
          const result = await makeRequest();
          setIsProcessing(false);
          return result;
        } catch (retryErr) {
          const retryErrorMessage =
            retryErr instanceof Error ? retryErr.message : "Retry failed";
          setError(retryErrorMessage);
          setIsProcessing(false);
          throw retryErr;
        }
      }

      setError(errorMessage);
      setIsProcessing(false);
      throw err;
    }
  };

  return {
    initiatePayment,
    isProcessing,
    error,
  };
}
