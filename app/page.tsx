"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletOverlay } from "@/components/wallet-overlay-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useX402Payment } from "@/hooks/use-x402-payment";
import {
  getSolPrice,
  getUsdcPrice,
  calculateUsdValue,
  formatPrice,
} from "@/lib/price";
import { Loader2, Send, TrendingUp, Users, Coins } from "lucide-react";
import { PublicKey } from "@solana/web3.js";
import type { ParsedAccountData } from "@solana/web3.js";
import { useTheme } from "next-themes";
import { DonationItem } from "@/components/donation-item";
import { DonationSuccess } from "@/components/donation-success";
import { ScrollIndicator } from "@/components/ScrollIndicator";
import { toast } from "sonner";

interface DonationMessage {
  id: number;
  donor_address: string;
  donor_name: string | null;
  amount_usd: number;
  tokens_amount: number;
  message: string | null;
  transaction_signature: string | null;
  created_at: string;
}

interface MessagesResponse {
  success: boolean;
  data: {
    donations: DonationMessage[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    stats: {
      totalDonations: number;
      totalAmount: number;
      totalTokens: number;
    };
  };
}

export default function Home() {
  // theme comes from next-themes ThemeProvider (or system) — map to 'dark'|'light'
  const { resolvedTheme } = useTheme();
  const theme = (resolvedTheme as "dark" | "light" | undefined) || "light";

  const { connected, publicKey, disconnect } = useWallet();
  const { connection } = useConnection();
  const walletOverlay = useWalletOverlay();
  const { initiatePayment, isProcessing, error } = useX402Payment();
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<DonationMessage[]>([]);
  const [stats, setStats] = useState({
    totalDonations: 0,
    totalAmount: 0,
    totalTokens: 0,
  });
  const [biggestDonor, setBiggestDonor] = useState<DonationMessage | null>(
    null
  );
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [sliderPercentage, setSliderPercentage] = useState<number>(10);
  const [customAmount, setCustomAmount] = useState("0");
  const [donorName, setDonorName] = useState("");
  const [donorMessage, setDonorMessage] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "top">("recent");
  const [donationResult, setDonationResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"post" | "donate">("post");
  const [mintAmount, setMintAmount] = useState("1");
  const [selectedQuickAmount, setSelectedQuickAmount] = useState<string | null>(
    null
  );
  const [donateWithToken, setDonateWithToken] = useState<"TOKEN">("TOKEN");
  const [solPrice, setSolPrice] = useState<number>(0);
  const [usdcPrice, setUsdcPrice] = useState<number>(1);
  const [mintSuccessDialog, setMintSuccessDialog] = useState<{
    open: boolean;
    tokensMinted: number;
  }>({ open: false, tokensMinted: 0 });

  // Token config from env
  const tokenName = process.env.NEXT_PUBLIC_TOKEN_NAME || "Token";
  const tokenSymbol = process.env.NEXT_PUBLIC_TOKEN_SYMBOL || "TOKEN";
  const tokenImage = process.env.NEXT_PUBLIC_TOKEN_IMAGE_URL;
  const tokenDescription =
    process.env.NEXT_PUBLIC_PROJECT_DESCRIPTION || "Support our community!";
  const mintableSupply = parseInt(
    process.env.NEXT_PUBLIC_MINTABLE_SUPPLY || "1000000"
  );
  const donationTarget = parseInt(
    process.env.NEXT_PUBLIC_DONATION_TARGET || "1000"
  );
  const dollarToTokenRatio = Math.floor(mintableSupply / donationTarget);

  const isTokenDonation = donateWithToken === "TOKEN";
  const donationBalance = isTokenDonation ? tokenBalance : usdcBalance;
  const formattedDonationBalance = isTokenDonation
    ? `${donationBalance.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })} ${tokenSymbol}`
    : `$${donationBalance.toFixed(2)}`;
  const donationAmountLabel = isTokenDonation
    ? `${customAmount || "0"} ${tokenSymbol}`
    : `$${customAmount || "0"}`;
  const sliderBalanceLabel = isTokenDonation
    ? `${tokenSymbol} balance`
    : "USDC balance";
  const parsedDonationAmount = parseFloat(customAmount || "0") || 0;
  const minimumDonationAmount = isTokenDonation ? 1 : 1;
  const isDonateDisabled =
    isProcessing ||
    !customAmount ||
    parsedDonationAmount < minimumDonationAmount;

  useEffect(() => {
    setMounted(true);
    fetchMessages();
    fetchPrices();
  }, [sortBy]);

  // Fetch token prices
  const fetchPrices = async () => {
    const [sol, usdc] = await Promise.all([getSolPrice(), getUsdcPrice()]);
    setSolPrice(sol);
    setUsdcPrice(usdc);
  };

  // Fetch USDC balance when wallet connects
  useEffect(() => {
    const fetchUsdcBalance = async () => {
      if (!connected || !publicKey) {
        setUsdcBalance(0);
        return;
      }

      try {
        const { Connection, PublicKey } = await import("@solana/web3.js");
        const { getAssociatedTokenAddress, getAccount } = await import(
          "@solana/spl-token"
        );

        const connection = new Connection(
          process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
            "https://api.devnet.solana.com"
        );

        // USDC mint address (devnet)
        const usdcMint = new PublicKey(
          "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
        );

        const userUsdcAccount = await getAssociatedTokenAddress(
          usdcMint,
          publicKey
        );

        const accountInfo = await getAccount(connection, userUsdcAccount);
        const balance = Number(accountInfo.amount) / 1_000_000; // USDC has 6 decimals
        setUsdcBalance(balance);
      } catch (error) {
        console.error("Failed to fetch USDC balance:", error);
        setUsdcBalance(0);
      }
    };

    fetchUsdcBalance();
  }, [connected, publicKey]);

  // Fetch token balance when wallet connects
  const fetchTokenBalance = useCallback(async () => {
    if (!connected || !publicKey) {
      setTokenBalance(0);
      return;
    }

    const tokenMintAddress =
      process.env.NEXT_PUBLIC_TOKEN_MINT_ADDRESS ||
      process.env.NEXT_PUBLIC_TOKEN_MINT;

    if (!tokenMintAddress) {
      setTokenBalance(0);
      return;
    }

    try {
      const tokenMint = new PublicKey(tokenMintAddress);
      const parsedTokenAccounts =
        await connection.getParsedTokenAccountsByOwner(publicKey, {
          mint: tokenMint,
        });

      if (!parsedTokenAccounts.value.length) {
        setTokenBalance(0);
        return;
      }

      const accountData = parsedTokenAccounts.value[0].account
        .data as ParsedAccountData;
      const tokenAmountInfo = (accountData?.parsed as any)?.info?.tokenAmount;

      if (!tokenAmountInfo) {
        setTokenBalance(0);
        return;
      }

      const balance =
        tokenAmountInfo.uiAmount ??
        Number(tokenAmountInfo.amount) / Math.pow(10, tokenAmountInfo.decimals);

      setTokenBalance(balance || 0);
    } catch (error) {
      console.error("Failed to fetch token balance:", error);
      setTokenBalance(0);
    }
  }, [connected, publicKey, connection]);

  useEffect(() => {
    fetchTokenBalance();
  }, [fetchTokenBalance]);

  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/messages?sort=${sortBy}&limit=20`);
      if (response.ok) {
        const data: MessagesResponse = await response.json();
        setMessages(data.data.donations);
        setStats(data.data.stats);
        // Find biggest donor
        if (data.data.donations.length > 0) {
          const biggest = data.data.donations.reduce((prev, current) =>
            prev.amount_usd > current.amount_usd ? prev : current
          );
          setBiggestDonor(biggest);
        } else {
          setBiggestDonor(null);
        }
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  };

  // Calculate amount based on slider percentage
  useEffect(() => {
    const balance = tokenBalance;
    const calculatedAmount = (balance * sliderPercentage) / 100;

    setCustomAmount(Math.max(0, Math.floor(calculatedAmount)).toString());
  }, [sliderPercentage, tokenBalance]);

  const handleSliderChange = (percentage: number) => {
    setSliderPercentage(percentage);
  };

  const handleDonate = async () => {
    if (!connected || !customAmount) return;

    const amount = parseFloat(customAmount);
    if (amount < 1) {
      toast.error("Minimum donation is 1 TOKEN");
      return;
    }

    try {
      const result = await initiatePayment("/api/write-message", {
        amount,
        name: donorName || undefined,
        message: donorMessage || undefined,
      });
      setDonationResult(result);
      setCustomAmount("0");
      setSliderPercentage(10);
      setDonorName("");
      setDonorMessage("");
      fetchMessages(); // Refresh messages
      fetchTokenBalance(); // Refresh token balance
    } catch (err) {
      console.error("Donation failed:", err);
    }
  };

  const handleMint = async () => {
    if (!connected || !mintAmount) return;

    const amount = parseFloat(mintAmount);
    if (amount < 1) {
      toast.error("Minimum mint is $1");
      return;
    }

    try {
      const result = await initiatePayment("/api/mint", {
        amount,
      });
      if (result) {
        const mintData = result as any;
        setMintSuccessDialog({
          open: true,
          tokensMinted: mintData.data?.tokensMinted || 0,
        });
        setMintAmount("1");
        setSelectedQuickAmount(null);
      }
    } catch (err) {
      console.error("Mint failed:", err);
      toast.error("Mint failed. Please try again.");
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!mounted) {
    return null; // Avoid hydration mismatch
  }

  return (
    <>
      <ScrollIndicator />
      <main
        className="min-h-screen flex flex-col md:flex-row md:h-screen md:overflow-hidden"
        style={{
          background: theme === "dark" ? "#000000" : "#FFFFFF",
        }}
      >
        {/* Desktop Layout */}
        <div
          className="flex flex-col order-2 md:order-1 md:overflow-hidden"
          style={{
            flex: 3,
            borderRight:
              theme === "dark"
                ? "1px solid rgba(255, 255, 255, 0.16)"
                : "1px solid rgba(228, 228, 231, 1)",
          }}
        >
          {/* Header */}
          <header
            className="border-b"
            style={{
              background:
                theme === "dark"
                  ? "rgba(9, 9, 11, 1)"
                  : "rgba(255, 255, 255, 1)",
              borderBottom:
                theme === "dark"
                  ? "1px solid rgba(255, 255, 255, 0.16)"
                  : "1px solid rgba(228, 228, 231, 1)",
            }}
          >
            <div className="container mx-auto px-4 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                {tokenImage && (
                  <img
                    src={tokenImage}
                    alt={tokenName}
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div>
                  <h1
                    className="text-2xl font-bold"
                    style={{
                      color:
                        theme === "dark"
                          ? "rgba(255, 255, 255, 1)"
                          : "rgba(9, 9, 11, 1)",
                    }}
                  >
                    {tokenName}
                  </h1>
                  <p className="text-sm text-x402-muted">${tokenSymbol}</p>
                </div>
              </div>
            </div>
          </header>

          <div className="container mx-auto px-4 py-8 flex flex-col flex-1 min-h-0">
            {/* Stats */}
            <div
              style={{
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "row",
                alignItems: "flex-start",
                padding: "16px 24px",
                gap: "24px",
                background: theme === "dark" ? "#000000" : "#FFFFFF",
                borderRadius: "12px",
                alignSelf: "stretch",
                marginBottom: "32px",
                position: "relative",
              }}
            >
              {/* Gradient Border */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "12px",
                  padding: "2px",
                  background:
                    "linear-gradient(73.69deg, rgba(150, 71, 253, 0.8) 0%, rgba(34, 235, 173, 0.8) 100.02%)",
                  WebkitMask:
                    "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  WebkitMaskComposite: "xor",
                  maskComposite: "exclude",
                  pointerEvents: "none",
                  zIndex: 1,
                }}
              />
              {/* Stats Container */}
              <div
                className="flex flex-col md:flex-row"
                style={{
                  alignItems: "center",
                  padding: "0px",
                  gap: "24px",
                  flex: "1",
                  position: "relative",
                  zIndex: 2,
                }}
              >
                {/* Donors Count */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "0px",
                    gap: "6px",
                    flex: "1",
                  }}
                >
                  <div
                    style={{
                      color: theme === "dark" ? "#FFFFFF" : "#09090B",
                    }}
                  >
                    {stats.totalDonations}
                  </div>
                  <div
                    style={{
                      color:
                        theme === "dark"
                          ? "rgba(255, 255, 255, 0.7)"
                          : "#71717A",
                    }}
                  >
                    Total Donors
                  </div>
                </div>

                {/* Divider */}
                <div
                  className="hidden md:block"
                  style={{
                    width: "1px",
                    height: "56px",
                    background:
                      theme === "dark"
                        ? "rgba(255, 255, 255, 0.16)"
                        : "#E4E4E7",
                  }}
                />

                {/* Donation Progress */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "0px",
                    gap: "6px",
                    flex: "1",
                  }}
                >
                  <div
                    style={{
                      color: theme === "dark" ? "#FFFFFF" : "#09090B",
                    }}
                  >
                    ${stats.totalAmount.toFixed(2)} / ${donationTarget}
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: "6px",
                      backgroundColor:
                        theme === "dark"
                          ? "rgba(255, 255, 255, 0.16)"
                          : "#E4E4E7",
                      borderRadius: "3px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(
                          (stats.totalAmount / donationTarget) * 100,
                          100
                        )}%`,
                        height: "100%",
                        backgroundColor: "#10B981",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      color:
                        theme === "dark"
                          ? "rgba(255, 255, 255, 0.7)"
                          : "#71717A",
                    }}
                  >
                    Donation Progress
                  </div>
                </div>

                {/* Divider */}
                <div
                  className="hidden md:block"
                  style={{
                    width: "1px",
                    height: "56px",
                    background:
                      theme === "dark"
                        ? "rgba(255, 255, 255, 0.16)"
                        : "#E4E4E7",
                  }}
                />

                {/* Tokens Distributed */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "0px",
                    gap: "6px",
                    flex: "1",
                  }}
                >
                  <div
                    style={{
                      color: theme === "dark" ? "#FFFFFF" : "#09090B",
                    }}
                  >
                    {stats.totalTokens.toLocaleString()} /{" "}
                    {mintableSupply.toLocaleString()}
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: "6px",
                      backgroundColor:
                        theme === "dark"
                          ? "rgba(255, 255, 255, 0.16)"
                          : "#E4E4E7",
                      borderRadius: "3px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(
                          (stats.totalTokens / mintableSupply) * 100,
                          100
                        )}%`,
                        height: "100%",
                        backgroundColor: "#3B82F6",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      color:
                        theme === "dark"
                          ? "rgba(255, 255, 255, 0.7)"
                          : "#71717A",
                    }}
                  >
                    Tokens Distributed
                  </div>
                  <div
                    style={{
                      fontSize: "10px",
                      color:
                        theme === "dark"
                          ? "rgba(255, 255, 255, 0.5)"
                          : "#A1A1AA",
                    }}
                  >
                    Remaining:{" "}
                    {(mintableSupply - stats.totalTokens).toLocaleString()}
                  </div>
                </div>

                {/* Divider */}
                <div
                  className="hidden md:block"
                  style={{
                    width: "1px",
                    height: "56px",
                    background:
                      theme === "dark"
                        ? "rgba(255, 255, 255, 0.16)"
                        : "#E4E4E7",
                  }}
                />

                {/* Biggest Donor */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "0px",
                    gap: "6px",
                    flex: "1",
                  }}
                >
                  <div
                    style={{
                      color: theme === "dark" ? "#FFFFFF" : "#09090B",
                    }}
                  >
                    {biggestDonor
                      ? biggestDonor.donor_name ||
                        `${biggestDonor.donor_address.slice(
                          0,
                          4
                        )}...${biggestDonor.donor_address.slice(-4)}`
                      : "None"}
                  </div>
                  <div
                    style={{
                      color:
                        theme === "dark"
                          ? "rgba(255, 255, 255, 0.7)"
                          : "#71717A",
                    }}
                  >
                    Biggest Donor
                  </div>
                </div>
              </div>
            </div>
            {/* Desktop Community Board (Visible on Mobile too now) */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex justify-between items-center mb-4 mt-8">
                <h1
                  className="font-normal"
                  style={{
                    color:
                      theme === "dark"
                        ? "rgba(255, 255, 255, 1)"
                        : "rgba(9, 9, 11, 1)",
                  }}
                >
                  Community Board
                </h1>
                <div
                  className="flex gap-2 rounded-full"
                  style={{
                    border:
                      theme === "dark"
                        ? "1px solid rgba(255, 255, 255, 0.16)"
                        : "1px solid rgba(228, 228, 231, 1)",
                    background:
                      theme === "light"
                        ? "rgba(235, 235, 235, 1)"
                        : "transparent",
                  }}
                >
                  {sortBy === "recent" ? (
                    <button
                      onClick={() => setSortBy("recent")}
                      className="px-3 py-1 text-sm rounded-full flex-1"
                      style={{
                        background:
                          theme === "dark"
                            ? "rgba(255, 255, 255, 0.1)"
                            : "rgba(9, 9, 11, 1)",
                        color:
                          theme === "dark"
                            ? "rgba(156, 163, 175, 1)"
                            : "rgba(255, 255, 255, 1)",
                      }}
                    >
                      Recent
                    </button>
                  ) : (
                    <button
                      onClick={() => setSortBy("recent")}
                      className="px-3 py-1 text-sm rounded-full flex-1"
                      style={{
                        background: "transparent",
                        color:
                          theme === "dark"
                            ? "rgba(156, 163, 175, 1)"
                            : "rgba(113, 113, 122, 1)",
                      }}
                    >
                      Recent
                    </button>
                  )}
                  {sortBy === "top" ? (
                    <button
                      onClick={() => setSortBy("top")}
                      className="px-3 py-1 text-sm rounded-full flex-1"
                      style={{
                        background:
                          theme === "dark"
                            ? "rgba(255, 255, 255, 0.1)"
                            : "rgba(9, 9, 11, 1)",
                        color:
                          theme === "dark"
                            ? "rgba(156, 163, 175, 1)"
                            : "rgba(255, 255, 255, 1)",
                      }}
                    >
                      Top
                    </button>
                  ) : (
                    <button
                      onClick={() => setSortBy("top")}
                      className="px-3 py-1 text-sm rounded-full flex-1"
                      style={{
                        background: "transparent",
                        color:
                          theme === "dark"
                            ? "rgba(156, 163, 175, 1)"
                            : "rgba(113, 113, 122, 1)",
                      }}
                    >
                      Top
                    </button>
                  )}
                </div>
              </div>
              {/* Message Board */}
              <Card
                className="overflow-hidden flex flex-col flex-1 min-h-0"
                style={{
                  background:
                    theme === "light"
                      ? "rgba(255, 255, 255, 1)"
                      : "transparent",
                  border:
                    theme === "dark"
                      ? "1px solid rgba(255, 255, 255, 0.16)"
                      : "1px solid rgba(228, 228, 231, 1)",
                }}
              >
                <CardContent
                  className="flex-1 overflow-y-auto min-h-[400px] flex flex-col hide-scrollbar"
                  style={{
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                  }}
                >
                  <div className="w-full">
                    {messages.map((msg) => (
                      <DonationItem
                        key={msg.id}
                        id={msg.id}
                        donor_address={msg.donor_address}
                        donor_name={msg.donor_name}
                        amount_usd={msg.amount_usd}
                        tokens_amount={msg.tokens_amount}
                        message={msg.message}
                        transaction_signature={msg.transaction_signature}
                        created_at={msg.created_at}
                        tokenSymbol={tokenSymbol}
                        theme={theme}
                      />
                    ))}
                    {messages.length === 0 && (
                      <div className="flex items-center justify-center h-full min-h-[400px]">
                        {/* Text Messages */}
                        <div className="text-center space-y-2">
                          <h3 className="text-lg font-bold">
                            No supporters yet
                          </h3>
                          <p
                            className="text-sm max-w-md mx-auto"
                            style={{
                              color:
                                theme === "dark"
                                  ? "rgba(156, 163, 175, 1)"
                                  : "rgba(113, 113, 122, 1)",
                            }}
                          >
                            You can be the first supporter! Every contribution
                            helps this project move forward.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        <div
          style={{ flex: 1 }}
          className="flex flex-col min-h-0 flex-1 order-1 md:order-2 md:overflow-y-auto"
        >
          <header
            className="container mx-auto px-4 py-4"
            style={{
              background:
                theme === "dark"
                  ? "rgba(9, 9, 11, 1)"
                  : "rgba(255, 255, 255, 1)",
              borderBottom:
                theme === "dark"
                  ? "1px solid rgba(255, 255, 255, 0.16)"
                  : "1px solid rgba(228, 228, 231, 1)",
            }}
          >
            <div>
              <h1
                className="text-2xl font-bold text-nowrap"
                style={{
                  color:
                    theme === "dark"
                      ? "rgba(255, 255, 255, 1)"
                      : "rgba(9, 9, 11, 1)",
                }}
              >
                Support Our Community
              </h1>
              <p className="text-sm text-x402-muted">
                Get {dollarToTokenRatio.toLocaleString()} {tokenSymbol} per $1
                donated
              </p>
            </div>
            <div className="flex gap-2"></div>
          </header>

          {/* Tabs */}
          <div
            className="border-b"
            style={{
              borderColor:
                theme === "dark"
                  ? "rgba(255, 255, 255, 0.16)"
                  : "rgba(0, 0, 0, 0.16)",
            }}
          >
            <div className="container mx-auto px-4 flex w-full">
              <button
                onClick={() => setActiveTab("post")}
                className="flex-1 py-3 text-sm font-medium transition-colors relative"
                style={{
                  color:
                    activeTab === "post"
                      ? theme === "dark"
                        ? "rgba(255, 255, 255, 1)"
                        : "rgba(9, 9, 11, 1)"
                      : theme === "dark"
                      ? "rgba(156, 163, 175, 1)"
                      : "rgba(113, 113, 122, 1)",
                }}
              >
                Post
                {activeTab === "post" && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{
                      background: "linear-gradient(to right, #744AC9, #22EBAD)",
                    }}
                  />
                )}
              </button>
              <button
                onClick={() => setActiveTab("donate")}
                className="flex-1 py-3 text-sm font-medium transition-colors relative"
                style={{
                  color:
                    activeTab === "donate"
                      ? theme === "dark"
                        ? "rgba(255, 255, 255, 1)"
                        : "rgba(9, 9, 11, 1)"
                      : theme === "dark"
                      ? "rgba(156, 163, 175, 1)"
                      : "rgba(113, 113, 122, 1)",
                }}
              >
                Donate
                {activeTab === "donate" && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{
                      background: "linear-gradient(to right, #744AC9, #22EBAD)",
                    }}
                  />
                )}
              </button>
            </div>
          </div>

          <div
            className="container mx-auto px-4 py-8 space-y-6"
            style={{
              background:
                theme === "dark" ? "transparent" : "rgba(255, 255, 255, 1)",
            }}
          >
            {!connected ? (
              <div className="text-center space-y-4">
                <h1
                  className="text-xl font-bold mb-3"
                  style={{
                    color:
                      theme === "dark"
                        ? "rgba(255, 255, 255, 1)"
                        : "rgba(9, 9, 11, 1)",
                  }}
                >
                  Connect Wallet
                </h1>
                <p className="text-sm text-gray-400">
                  Please connect your Solana wallet to proceed with your
                  donation.
                </p>
                <Button
                  onClick={() => walletOverlay.open()}
                  style={{
                    boxSizing: "border-box",
                    display: "block",
                    flexDirection: "row",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: "10px 24px",
                    gap: "8px",
                    width: "150px",
                    height: "40px",
                    background:
                      "linear-gradient(88.41deg, #744AC9 -3.85%, #22EBAD 111.06%), #09090B",
                    borderRadius: "999px",
                    fontStyle: "normal",
                    fontWeight: 500,
                    fontSize: "14px",
                    lineHeight: "20px",
                    color: "#FFFFFF",
                    textShadow: "0px 3px 4px rgba(0, 0, 0, 0.2)",
                    border: "none",
                    cursor: "pointer",
                    margin: "0 auto",
                  }}
                >
                  Select Wallet
                </Button>
              </div>
            ) : (
              <>
                {activeTab === "post" ? (
                  <>
                    {/* Connected Wallet Section */}
                    <div
                      className="flex items-center justify-between p-4 rounded-lg"
                      style={{
                        background:
                          theme === "dark"
                            ? "rgba(255, 255, 255, 0.06)"
                            : "rgba(0, 0, 0, 0.06)",
                        border:
                          theme === "dark"
                            ? "1px solid rgba(255, 255, 255, 0.16)"
                            : "1px solid rgba(0, 0, 0, 0.16)",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded flex items-center justify-center"
                          style={{ background: "#744AC9" }}
                        >
                          <span
                            className="text-xl"
                            style={{
                              color:
                                theme === "dark"
                                  ? "rgba(255, 255, 255, 1)"
                                  : "rgba(9, 9, 11, 1)",
                            }}
                          >
                            👤
                          </span>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">
                            Connected Wallet
                          </p>
                          <p
                            className="text-sm font-bold"
                            style={{
                              color:
                                theme === "dark"
                                  ? "rgba(255, 255, 255, 1)"
                                  : "rgba(9, 9, 11, 1)",
                            }}
                          >
                            {publicKey
                              ? formatAddress(publicKey.toString())
                              : ""}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => disconnect()}
                        className="text-sm"
                        style={{
                          color: "#EF4444",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "#DC2626";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "#EF4444";
                        }}
                      >
                        Disconnect
                      </button>
                    </div>

                    {/* Amount Section */}
                    <div className="space-y-3">
                      <label
                        className="text-sm font-bold block"
                        style={{
                          color:
                            theme === "dark"
                              ? "rgba(255, 255, 255, 1)"
                              : "rgba(9, 9, 11, 1)",
                        }}
                      >
                        Amount
                      </label>

                      {/* Donate With Token Selector - REMOVED as per request */}
                      {/* <div className="flex gap-2 mb-3">
                      {[{ value: "TOKEN", label: tokenSymbol }].map((token) => (
                        <button
                          key={token.value}
                          onClick={() =>
                            setDonateWithToken(token.value as "TOKEN")
                          }
                          className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
                          style={{
                            background:
                              donateWithToken === token.value
                                ? "linear-gradient(to right, #744AC9, #22EBAD)"
                                : theme === "dark"
                                ? "rgba(255, 255, 255, 0.06)"
                                : "rgba(0, 0, 0, 0.06)",
                            border:
                              donateWithToken === token.value
                                ? "none"
                                : theme === "dark"
                                ? "1px solid rgba(255, 255, 255, 0.16)"
                                : "1px solid rgba(0, 0, 0, 0.16)",
                            color:
                              donateWithToken === token.value
                                ? "#FFFFFF"
                                : theme === "dark"
                                ? "rgba(255, 255, 255, 1)"
                                : "rgba(9, 9, 11, 1)",
                          }}
                        >
                          {token.label}
                        </button>
                      ))}
                    </div> */}

                      {/* Balance Display */}
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="text-sm"
                          style={{
                            color:
                              theme === "dark"
                                ? "rgba(156, 163, 175, 1)"
                                : "rgba(113, 113, 122, 1)",
                          }}
                        >
                          Available {isTokenDonation ? tokenSymbol : "USDC"}:
                        </span>
                        <span
                          className="text-sm font-bold"
                          style={{
                            color:
                              theme === "dark"
                                ? "rgba(255, 255, 255, 1)"
                                : "rgba(9, 9, 11, 1)",
                          }}
                        >
                          {formattedDonationBalance}
                        </span>
                      </div>

                      {/* Slider */}
                      <div className="space-y-4">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={sliderPercentage}
                          onChange={(e) =>
                            handleSliderChange(Number(e.target.value))
                          }
                          className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, #744AC9 0%, #22EBAD ${sliderPercentage}%, ${
                              theme === "dark"
                                ? "rgba(255,255,255,0.16)"
                                : "#E4E4E7"
                            } ${sliderPercentage}%, ${
                              theme === "dark"
                                ? "rgba(255,255,255,0.16)"
                                : "#E4E4E7"
                            } 100%)`,
                          }}
                        />

                        {/* Percentage markers */}
                        <div className="flex justify-between text-xs">
                          {[0, 25, 50, 75, 100].map((percent) => {
                            const hasMarker = [25, 75, 100].includes(percent);
                            return (
                              <button
                                key={percent}
                                onClick={() => handleSliderChange(percent)}
                                className="transition-all flex flex-col items-center gap-1"
                                style={{
                                  color:
                                    sliderPercentage === percent
                                      ? theme === "dark"
                                        ? "#FFFFFF"
                                        : "#09090B"
                                      : theme === "dark"
                                      ? "rgba(156, 163, 175, 1)"
                                      : "rgba(113, 113, 122, 1)",
                                  fontWeight:
                                    sliderPercentage === percent ? 600 : 400,
                                }}
                              >
                                {hasMarker && (
                                  <div
                                    style={{
                                      width: "8px",
                                      height: "8px",
                                      borderRadius: "50%",
                                      background:
                                        sliderPercentage === percent
                                          ? "linear-gradient(to right, #744AC9, #22EBAD)"
                                          : theme === "dark"
                                          ? "rgba(255, 255, 255, 0.3)"
                                          : "rgba(0, 0, 0, 0.3)",
                                      marginBottom: "4px",
                                    }}
                                  />
                                )}
                                {percent}%
                              </button>
                            );
                          })}
                        </div>

                        {/* Amount display */}
                        <div
                          className="text-center p-4 rounded-lg"
                          style={{
                            background:
                              theme === "dark"
                                ? "rgba(255, 255, 255, 0.06)"
                                : "rgba(0, 0, 0, 0.06)",
                            border:
                              theme === "dark"
                                ? "1px solid rgba(255, 255, 255, 0.16)"
                                : "1px solid rgba(0, 0, 0, 0.16)",
                          }}
                        >
                          <div
                            className="text-3xl font-bold"
                            style={{
                              color:
                                theme === "dark"
                                  ? "rgba(255, 255, 255, 1)"
                                  : "rgba(9, 9, 11, 1)",
                            }}
                          >
                            {donationAmountLabel}
                          </div>
                          <div
                            className="text-sm mt-1"
                            style={{
                              color:
                                theme === "dark"
                                  ? "rgba(156, 163, 175, 1)"
                                  : "rgba(113, 113, 122, 1)",
                            }}
                          >
                            {sliderPercentage}% of your {sliderBalanceLabel}
                          </div>
                        </div>

                        {/* Custom Amount Input */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          <label
                            style={{
                              fontSize: "14px",
                              fontWeight: 500,
                              color: theme === "dark" ? "#FFFFFF" : "#09090B",
                            }}
                          >
                            Or enter custom amount:
                          </label>
                          <Input
                            type="number"
                            value={customAmount}
                            onChange={(e) => setCustomAmount(e.target.value)}
                            placeholder="Enter token amount"
                            min="0"
                            style={{
                              color: theme === "dark" ? "#FFFFFF" : "#09090B",
                              background:
                                theme === "dark"
                                  ? "rgba(255, 255, 255, 0.06)"
                                  : "rgba(0, 0, 0, 0.06)",
                              border:
                                theme === "dark"
                                  ? "1px solid rgba(255, 255, 255, 0.16)"
                                  : "1px solid rgba(0, 0, 0, 0.16)",
                            }}
                          />
                        </div>
                      </div>

                      <p
                        className="text-xs"
                        style={{
                          color:
                            theme === "dark"
                              ? "rgba(156, 163, 175, 1)"
                              : "rgba(113, 113, 122, 1)",
                        }}
                      >
                        {isTokenDonation ? (
                          <>
                            You are donating {customAmount || "0"} {tokenSymbol}
                          </>
                        ) : (
                          <>
                            You will get{" "}
                            {(
                              parseFloat(customAmount || "0") *
                              dollarToTokenRatio
                            ).toLocaleString()}{" "}
                            {tokenSymbol}
                          </>
                        )}
                      </p>
                    </div>

                    {/* Your Name Section */}
                    <div className="space-y-2">
                      <label
                        className="text-sm font-bold block"
                        style={{
                          color:
                            theme === "dark"
                              ? "rgba(255, 255, 255, 1)"
                              : "rgba(9, 9, 11, 1)",
                        }}
                      >
                        Your Name (Optional)
                      </label>
                      <Input
                        value={donorName}
                        onChange={(e) => setDonorName(e.target.value)}
                        placeholder="e.g. Bob"
                        className="bg-transparent border-gray-600"
                        style={{
                          color:
                            theme === "dark"
                              ? "rgba(255, 255, 255, 1)"
                              : "rgba(9, 9, 11, 1)",
                          background:
                            theme === "dark"
                              ? "rgba(255, 255, 255, 0.06)"
                              : "rgba(0, 0, 0, 0.06)",
                          border:
                            theme === "dark"
                              ? "1px solid rgba(255, 255, 255, 0.16)"
                              : "1px solid rgba(0, 0, 0, 0.16)",
                        }}
                      />
                    </div>

                    {/* Message Section */}
                    <div className="space-y-2">
                      <label
                        className="text-sm font-bold block"
                        style={{
                          color:
                            theme === "dark"
                              ? "rgba(255, 255, 255, 1)"
                              : "rgba(9, 9, 11, 1)",
                        }}
                      >
                        Message (Optional)
                      </label>
                      <Textarea
                        value={donorMessage}
                        onChange={(e) => setDonorMessage(e.target.value)}
                        placeholder="Ex: I love your project!"
                        rows={3}
                        className="bg-transparent border-gray-600"
                        style={{
                          color:
                            theme === "dark"
                              ? "rgba(255, 255, 255, 1)"
                              : "rgba(9, 9, 11, 1)",
                          background:
                            theme === "dark"
                              ? "rgba(255, 255, 255, 0.06)"
                              : "rgba(0, 0, 0, 0.06)",
                          border:
                            theme === "dark"
                              ? "1px solid rgba(255, 255, 255, 0.16)"
                              : "1px solid rgba(0, 0, 0, 0.16)",
                        }}
                      />
                    </div>

                    {/* Donate Button */}
                    <Button
                      onClick={handleDonate}
                      disabled={isDonateDisabled}
                      className="w-full font-bold py-3 rounded-full"
                      style={{
                        color:
                          theme === "dark"
                            ? "rgba(255, 255, 255, 1)"
                            : "rgba(9, 9, 11, 1)",
                        background:
                          "linear-gradient(to right, #744AC9, #22EBAD)",
                        border: "none",
                      }}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : isTokenDonation ? (
                        `Donate ${customAmount || "0"} ${tokenSymbol}`
                      ) : (
                        `Donate $${customAmount || "0"}`
                      )}
                    </Button>

                    {/* Secure Payment Footer */}
                    <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                      <span className="text-green-500">✓</span>
                      <span>Secure payment powered by Solana</span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Mint Tab Content */}
                    <div className="space-y-4">
                      {/* Connected Wallet Section */}
                      <div
                        className="flex items-center justify-between p-4 rounded-lg"
                        style={{
                          background:
                            theme === "dark"
                              ? "rgba(255, 255, 255, 0.06)"
                              : "rgba(0, 0, 0, 0.06)",
                          border:
                            theme === "dark"
                              ? "1px solid rgba(255, 255, 255, 0.16)"
                              : "1px solid rgba(0, 0, 0, 0.16)",
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded flex items-center justify-center"
                            style={{ background: "#744AC9" }}
                          >
                            <span
                              className="text-xl"
                              style={{
                                color:
                                  theme === "dark"
                                    ? "rgba(255, 255, 255, 1)"
                                    : "rgba(9, 9, 11, 1)",
                              }}
                            >
                              👤
                            </span>
                          </div>
                          <div>
                            <p className="text-sm text-gray-400">
                              Connected Wallet
                            </p>
                            <p
                              className="text-sm font-bold"
                              style={{
                                color:
                                  theme === "dark"
                                    ? "rgba(255, 255, 255, 1)"
                                    : "rgba(9, 9, 11, 1)",
                              }}
                            >
                              {publicKey
                                ? formatAddress(publicKey.toString())
                                : ""}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => disconnect()}
                          className="text-sm"
                          style={{
                            color: "#EF4444",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = "#DC2626";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = "#EF4444";
                          }}
                        >
                          Disconnect
                        </button>
                      </div>

                      {/* You're paying Section */}
                      <div className="flex flex-col gap-3">
                        <label
                          className="text-sm font-medium"
                          style={{
                            color:
                              theme === "dark"
                                ? "rgba(255, 255, 255, 1)"
                                : "rgba(9, 9, 11, 1)",
                          }}
                        >
                          You&apos;re donating (USDC)
                        </label>

                        {/* Balance Display */}
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className="text-sm"
                            style={{
                              color:
                                theme === "dark"
                                  ? "rgba(156, 163, 175, 1)"
                                  : "rgba(113, 113, 122, 1)",
                            }}
                          >
                            Available USDC:
                          </span>
                          <span
                            className="text-sm font-bold"
                            style={{
                              color:
                                theme === "dark"
                                  ? "rgba(255, 255, 255, 1)"
                                  : "rgba(9, 9, 11, 1)",
                            }}
                          >
                            ${usdcBalance.toFixed(2)}
                          </span>
                        </div>

                        {/* Quick Amount Buttons */}
                        <div className="flex flex-row gap-2">
                          {["$1", "$5", "$10", "$50"].map((amount) => (
                            <button
                              key={amount}
                              onClick={() => {
                                const value = amount.replace("$", "");
                                setMintAmount(value);
                                setSelectedQuickAmount(amount);
                              }}
                              className="flex flex-col justify-center items-center py-1.5 px-4 rounded-lg text-sm font-medium transition-colors flex-1"
                              style={{
                                background:
                                  theme === "dark" ? "transparent" : "#FFFFFF",
                                border:
                                  selectedQuickAmount === amount
                                    ? "1px solid transparent"
                                    : theme === "dark"
                                    ? "1px solid rgba(255, 255, 255, 0.16)"
                                    : "1px solid #E4E4E7",
                                backgroundImage:
                                  selectedQuickAmount === amount
                                    ? `linear-gradient(${
                                        theme === "dark"
                                          ? "transparent"
                                          : "#FFFFFF"
                                      }, ${
                                        theme === "dark"
                                          ? "transparent"
                                          : "#FFFFFF"
                                      }), linear-gradient(to right, #744AC9, #22EBAD)`
                                    : "none",
                                backgroundOrigin: "border-box",
                                backgroundClip:
                                  selectedQuickAmount === amount
                                    ? "padding-box, border-box"
                                    : "padding-box",
                                color:
                                  theme === "dark"
                                    ? "rgba(255, 255, 255, 1)"
                                    : "rgba(9, 9, 11, 1)",
                                height: "32px",
                              }}
                            >
                              {amount}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Swap Direction Indicator */}
                      <div className="flex flex-row justify-center items-center gap-2 h-11">
                        <div
                          style={{
                            width: "141.5px",
                            height: "0px",
                            border:
                              theme === "dark"
                                ? "1px solid rgba(255, 255, 255, 0.16)"
                                : "1px solid #E4E4E7",
                          }}
                        />
                        <div
                          className="flex justify-center items-center rounded-full"
                          style={{
                            width: "44px",
                            height: "44px",
                            border:
                              theme === "dark"
                                ? "1px solid rgba(255, 255, 255, 0.16)"
                                : "1px solid #E4E4E7",
                          }}
                        >
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <path
                              d="M7 10L12 15L17 10"
                              stroke={theme === "dark" ? "#FFFFFF" : "#09090B"}
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                        <div
                          style={{
                            width: "141.5px",
                            height: "0px",
                            border:
                              theme === "dark"
                                ? "1px solid rgba(255, 255, 255, 0.16)"
                                : "1px solid #E4E4E7",
                          }}
                        />
                      </div>

                      {/* To receive Section */}
                      <div className="flex flex-col gap-3">
                        <label
                          className="text-sm font-medium"
                          style={{
                            color:
                              theme === "dark"
                                ? "rgba(255, 255, 255, 1)"
                                : "rgba(9, 9, 11, 1)",
                          }}
                        >
                          To receive
                        </label>

                        <div
                          className="flex flex-row items-center p-4 gap-2 rounded-lg"
                          style={{
                            background:
                              theme === "dark"
                                ? "rgba(255, 255, 255, 0.06)"
                                : "rgba(250, 250, 250, 1)",
                            border:
                              theme === "dark"
                                ? "1px solid rgba(255, 255, 255, 0.16)"
                                : "1px solid #E4E4E7",
                            height: "68px",
                          }}
                        >
                          {/* Token display card */}
                          <div
                            className="flex flex-row items-center p-2 gap-1 rounded-lg"
                            style={{
                              background:
                                theme === "dark"
                                  ? "rgba(255, 255, 255, 0.1)"
                                  : "#FFFFFF",
                              border:
                                theme === "dark"
                                  ? "1px solid rgba(255, 255, 255, 0.16)"
                                  : "1px solid #E4E4E7",
                              height: "40px",
                              minWidth: "84px",
                            }}
                          >
                            <div
                              style={{
                                width: "24px",
                                height: "24px",
                                borderRadius: "50%",
                                background:
                                  "linear-gradient(to right, #744AC9, #22EBAD)",
                              }}
                            />
                            <span
                              className="text-sm font-medium"
                              style={{
                                color:
                                  theme === "dark"
                                    ? "rgba(255, 255, 255, 1)"
                                    : "rgba(9, 9, 11, 1)",
                              }}
                            >
                              {tokenSymbol}
                            </span>
                          </div>

                          {/* Amount display */}
                          <div className="flex flex-col justify-center items-end gap-0.5 flex-grow">
                            <span
                              className="text-sm font-medium text-right"
                              style={{
                                color:
                                  theme === "dark"
                                    ? "rgba(255, 255, 255, 1)"
                                    : "rgba(9, 9, 11, 1)",
                              }}
                            >
                              {(
                                parseFloat(mintAmount || "0") *
                                dollarToTokenRatio
                              ).toLocaleString()}
                            </span>
                            <span
                              className="text-xs"
                              style={{
                                color:
                                  theme === "dark"
                                    ? "rgba(156, 163, 175, 1)"
                                    : "rgba(113, 113, 122, 1)",
                              }}
                            >
                              ≈ ${parseFloat(mintAmount || "0").toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Rate Info */}
                      <div
                        className="p-4 rounded-lg space-y-2"
                        style={{
                          background:
                            theme === "dark"
                              ? "rgba(255, 255, 255, 0.06)"
                              : "rgba(0, 0, 0, 0.06)",
                          border:
                            theme === "dark"
                              ? "1px solid rgba(255, 255, 255, 0.16)"
                              : "1px solid rgba(0, 0, 0, 0.16)",
                        }}
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span
                            style={{
                              color:
                                theme === "dark"
                                  ? "rgba(156, 163, 175, 1)"
                                  : "rgba(113, 113, 122, 1)",
                            }}
                          >
                            Reward Rate
                          </span>
                          <span
                            className="font-medium"
                            style={{
                              color:
                                theme === "dark"
                                  ? "rgba(255, 255, 255, 1)"
                                  : "rgba(9, 9, 11, 1)",
                            }}
                          >
                            $1 = {dollarToTokenRatio.toLocaleString()}{" "}
                            {tokenSymbol}
                          </span>
                        </div>
                      </div>

                      {/* Mint Button */}
                      <Button
                        onClick={handleMint}
                        disabled={
                          isProcessing ||
                          !mintAmount ||
                          parseFloat(mintAmount) <= 0
                        }
                        className="w-full font-bold py-3 rounded-full"
                        style={{
                          color:
                            theme === "dark"
                              ? "rgba(255, 255, 255, 1)"
                              : "rgba(9, 9, 11, 1)",
                          background:
                            "linear-gradient(to right, #744AC9, #22EBAD)",
                          border: "none",
                        }}
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Minting...
                          </>
                        ) : (
                          `Donate ${mintAmount} USDC`
                        )}
                      </Button>

                      {error && (
                        <div className="text-sm text-red-500 text-center">
                          {error}
                        </div>
                      )}

                      {/* Secure Payment Footer */}
                      <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                        <span className="text-green-500">✓</span>
                        <span>Secure payment powered by Solana</span>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Mint Success Dialog */}
      <Dialog
        open={mintSuccessDialog.open}
        onOpenChange={(open) =>
          setMintSuccessDialog({ ...mintSuccessDialog, open })
        }
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold text-green-600">
              🎉 Mint Successful!
            </DialogTitle>
            <DialogDescription className="text-center text-lg">
              You received{" "}
              <span className="font-bold text-primary">
                {mintSuccessDialog.tokensMinted.toLocaleString()}
              </span>{" "}
              {tokenSymbol}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center mt-4">
            <Button
              onClick={() =>
                setMintSuccessDialog({ open: false, tokensMinted: 0 })
              }
              className="bg-gradient-to-r from-purple-500 to-teal-500 hover:from-purple-600 hover:to-teal-600 text-white"
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Donation Success Dialog */}
      <Dialog
        open={!!donationResult}
        onOpenChange={(open) => !open && setDonationResult(null)}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogTitle className="sr-only">Donation Successful</DialogTitle>
          <DialogDescription className="sr-only">
            Details of your successful donation
          </DialogDescription>
          {donationResult && (
            <DonationSuccess
              amountUsd={donationResult.data.usdEquivalent}
              tokensMinted={donationResult.data.tokensDonated}
              tokenSymbol={tokenSymbol}
              name={donationResult.data.name}
              message={donationResult.data.message}
              transactionSignature={donationResult.data.transactionSignature}
              theme={theme as "dark" | "light"}
              onConfirm={() => setDonationResult(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
