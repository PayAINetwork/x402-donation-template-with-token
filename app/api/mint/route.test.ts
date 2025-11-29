import { POST } from "./route";
import { NextRequest } from "next/server";
import * as tokenLib from "@/lib/token";

// Mock the token library
jest.mock("@/lib/token");

describe("POST /api/mint", () => {
  const mockGetTokenConfig = tokenLib.getTokenConfig as jest.MockedFunction<
    typeof tokenLib.getTokenConfig
  >;
  const mockCalculateTokensForDonation =
    tokenLib.calculateTokensForDonation as jest.MockedFunction<
      typeof tokenLib.calculateTokensForDonation
    >;
  const mockTransferTokens = tokenLib.transferTokens as jest.MockedFunction<
    typeof tokenLib.transferTokens
  >;

  const mockTokenConfig = {
    mint: "TokenMintAddress123",
    name: "Test Token",
    symbol: "TEST",
    totalSupply: 1000000,
    mintableSupply: 500000,
    imageUrl: "https://example.com/token.png",
    description: "Test token description",
    donationTarget: 10000,
    dollarToTokenRatio: 50,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTokenConfig.mockReturnValue(mockTokenConfig);
  });

  describe("Success Cases", () => {
    it("should successfully mint tokens with valid payment", async () => {
      const paymentResponse = {
        payer: "UserWalletAddress123",
        amount: 10,
      };
      const encodedPayment = Buffer.from(
        JSON.stringify(paymentResponse)
      ).toString("base64");

      mockCalculateTokensForDonation.mockReturnValue(500);
      mockTransferTokens.mockResolvedValue(
        "TransactionSignature123456789"
      );

      const request = new NextRequest("http://localhost:3000/api/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-RESPONSE": encodedPayment,
        },
        body: JSON.stringify({ amount: 10 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain("500");
      expect(data.message).toContain("TEST");
      expect(data.data).toEqual({
        buyer: "UserWalletAddress123",
        amountUsd: 10,
        tokensMinted: 500,
        tokenSymbol: "TEST",
        transactionSignature: "TransactionSignature123456789",
      });

      expect(mockCalculateTokensForDonation).toHaveBeenCalledWith(10, 50);
      expect(mockTransferTokens).toHaveBeenCalledWith(
        "UserWalletAddress123",
        500
      );
    });

    it("should handle minimum valid amount ($1)", async () => {
      const paymentResponse = {
        payer: "UserWalletAddress123",
        amount: 1,
      };
      const encodedPayment = Buffer.from(
        JSON.stringify(paymentResponse)
      ).toString("base64");

      mockCalculateTokensForDonation.mockReturnValue(50);
      mockTransferTokens.mockResolvedValue("TxSignature");

      const request = new NextRequest("http://localhost:3000/api/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-RESPONSE": encodedPayment,
        },
        body: JSON.stringify({ amount: 1 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.tokensMinted).toBe(50);
    });

    it("should handle large donation amounts", async () => {
      const paymentResponse = {
        payer: "UserWalletAddress123",
        amount: 1000,
      };
      const encodedPayment = Buffer.from(
        JSON.stringify(paymentResponse)
      ).toString("base64");

      mockCalculateTokensForDonation.mockReturnValue(50000);
      mockTransferTokens.mockResolvedValue("TxSignatureLarge");

      const request = new NextRequest("http://localhost:3000/api/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-RESPONSE": encodedPayment,
        },
        body: JSON.stringify({ amount: 1000 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.amountUsd).toBe(1000);
      expect(data.data.tokensMinted).toBe(50000);
    });
  });

  describe("Payment Verification Failures", () => {
    it("should return 402 when payment response header is missing", async () => {
      const request = new NextRequest("http://localhost:3000/api/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: 10 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(402);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Payment verification failed");
    });

    it("should return 500 when payment response is malformed base64", async () => {
      const request = new NextRequest("http://localhost:3000/api/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-RESPONSE": "invalid-base64!!!",
        },
        body: JSON.stringify({ amount: 10 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Invalid payment response");
    });

    it("should return 500 when payment response is not valid JSON", async () => {
      const encodedPayment = Buffer.from("not a json object").toString(
        "base64"
      );

      const request = new NextRequest("http://localhost:3000/api/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-RESPONSE": encodedPayment,
        },
        body: JSON.stringify({ amount: 10 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Invalid payment response");
    });
  });

  describe("Validation Errors", () => {
    const validPaymentResponse = {
      payer: "UserWalletAddress123",
      amount: 10,
    };

    it("should reject amount less than $1", async () => {
      const encodedPayment = Buffer.from(
        JSON.stringify(validPaymentResponse)
      ).toString("base64");

      const request = new NextRequest("http://localhost:3000/api/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-RESPONSE": encodedPayment,
        },
        body: JSON.stringify({ amount: 0.5 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Amount must be at least $1");
    });

    it("should reject zero amount", async () => {
      const encodedPayment = Buffer.from(
        JSON.stringify(validPaymentResponse)
      ).toString("base64");

      const request = new NextRequest("http://localhost:3000/api/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-RESPONSE": encodedPayment,
        },
        body: JSON.stringify({ amount: 0 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Amount must be at least $1");
    });

    it("should reject negative amount", async () => {
      const encodedPayment = Buffer.from(
        JSON.stringify(validPaymentResponse)
      ).toString("base64");

      const request = new NextRequest("http://localhost:3000/api/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-RESPONSE": encodedPayment,
        },
        body: JSON.stringify({ amount: -10 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Amount must be at least $1");
    });

    it("should reject missing amount", async () => {
      const encodedPayment = Buffer.from(
        JSON.stringify(validPaymentResponse)
      ).toString("base64");

      const request = new NextRequest("http://localhost:3000/api/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-RESPONSE": encodedPayment,
        },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Amount must be at least $1");
    });

    it("should reject when calculated tokens is zero or negative", async () => {
      const encodedPayment = Buffer.from(
        JSON.stringify(validPaymentResponse)
      ).toString("base64");

      mockCalculateTokensForDonation.mockReturnValue(0);

      const request = new NextRequest("http://localhost:3000/api/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-RESPONSE": encodedPayment,
        },
        body: JSON.stringify({ amount: 5 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Invalid mint amount");
    });
  });

  describe("Transfer Errors", () => {
    it("should handle token transfer failure", async () => {
      const paymentResponse = {
        payer: "UserWalletAddress123",
        amount: 10,
      };
      const encodedPayment = Buffer.from(
        JSON.stringify(paymentResponse)
      ).toString("base64");

      mockCalculateTokensForDonation.mockReturnValue(500);
      mockTransferTokens.mockRejectedValue(
        new Error("Insufficient token balance")
      );

      const request = new NextRequest("http://localhost:3000/api/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-RESPONSE": encodedPayment,
        },
        body: JSON.stringify({ amount: 10 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Insufficient token balance");
    });

    it("should handle network errors during transfer", async () => {
      const paymentResponse = {
        payer: "UserWalletAddress123",
        amount: 10,
      };
      const encodedPayment = Buffer.from(
        JSON.stringify(paymentResponse)
      ).toString("base64");

      mockCalculateTokensForDonation.mockReturnValue(500);
      mockTransferTokens.mockRejectedValue(
        new Error("Network connection failed")
      );

      const request = new NextRequest("http://localhost:3000/api/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-RESPONSE": encodedPayment,
        },
        body: JSON.stringify({ amount: 10 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Network connection failed");
    });

    it("should handle non-Error exceptions", async () => {
      const paymentResponse = {
        payer: "UserWalletAddress123",
        amount: 10,
      };
      const encodedPayment = Buffer.from(
        JSON.stringify(paymentResponse)
      ).toString("base64");

      mockCalculateTokensForDonation.mockReturnValue(500);
      mockTransferTokens.mockRejectedValue("String error");

      const request = new NextRequest("http://localhost:3000/api/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-RESPONSE": encodedPayment,
        },
        body: JSON.stringify({ amount: 10 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Failed to process mint");
    });
  });

  describe("Token Configuration", () => {
    it("should use token config for calculations", async () => {
      const customTokenConfig = {
        ...mockTokenConfig,
        dollarToTokenRatio: 100,
        symbol: "CUSTOM",
      };
      mockGetTokenConfig.mockReturnValue(customTokenConfig);

      const paymentResponse = {
        payer: "UserWalletAddress123",
        amount: 10,
      };
      const encodedPayment = Buffer.from(
        JSON.stringify(paymentResponse)
      ).toString("base64");

      mockCalculateTokensForDonation.mockReturnValue(1000);
      mockTransferTokens.mockResolvedValue("TxSig");

      const request = new NextRequest("http://localhost:3000/api/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-RESPONSE": encodedPayment,
        },
        body: JSON.stringify({ amount: 10 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.tokenSymbol).toBe("CUSTOM");
      expect(mockCalculateTokensForDonation).toHaveBeenCalledWith(10, 100);
    });

    it("should handle token config errors gracefully", async () => {
      mockGetTokenConfig.mockImplementation(() => {
        throw new Error("Token configuration incomplete");
      });

      const paymentResponse = {
        payer: "UserWalletAddress123",
        amount: 10,
      };
      const encodedPayment = Buffer.from(
        JSON.stringify(paymentResponse)
      ).toString("base64");

      const request = new NextRequest("http://localhost:3000/api/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-RESPONSE": encodedPayment,
        },
        body: JSON.stringify({ amount: 10 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Token configuration incomplete");
    });
  });

  describe("Edge Cases", () => {
    it("should handle decimal amounts correctly", async () => {
      const paymentResponse = {
        payer: "UserWalletAddress123",
        amount: 10.5,
      };
      const encodedPayment = Buffer.from(
        JSON.stringify(paymentResponse)
      ).toString("base64");

      mockCalculateTokensForDonation.mockReturnValue(525);
      mockTransferTokens.mockResolvedValue("TxSig");

      const request = new NextRequest("http://localhost:3000/api/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-RESPONSE": encodedPayment,
        },
        body: JSON.stringify({ amount: 10.5 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.amountUsd).toBe(10.5);
    });

    it("should handle very small amounts above $1", async () => {
      const paymentResponse = {
        payer: "UserWalletAddress123",
        amount: 1.01,
      };
      const encodedPayment = Buffer.from(
        JSON.stringify(paymentResponse)
      ).toString("base64");

      mockCalculateTokensForDonation.mockReturnValue(50);
      mockTransferTokens.mockResolvedValue("TxSig");

      const request = new NextRequest("http://localhost:3000/api/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-RESPONSE": encodedPayment,
        },
        body: JSON.stringify({ amount: 1.01 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should handle payer address with special characters", async () => {
      const paymentResponse = {
        payer: "SolanaAddress_With-Special.Chars123",
        amount: 10,
      };
      const encodedPayment = Buffer.from(
        JSON.stringify(paymentResponse)
      ).toString("base64");

      mockCalculateTokensForDonation.mockReturnValue(500);
      mockTransferTokens.mockResolvedValue("TxSig");

      const request = new NextRequest("http://localhost:3000/api/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-RESPONSE": encodedPayment,
        },
        body: JSON.stringify({ amount: 10 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.buyer).toBe("SolanaAddress_With-Special.Chars123");
    });
  });
});
