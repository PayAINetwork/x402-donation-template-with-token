"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletOverlay } from "@/components/wallet-overlay-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useX402Payment } from "@/hooks/use-x402-payment";

import { Loader2 } from "lucide-react";

import { useTheme } from "next-themes";
import { DonationItem } from "@/components/donation-item";
import { DonationSuccess } from "@/components/donation-success";
import { ScrollIndicator } from "@/components/ScrollIndicator";
import { ChristmasDivider } from "@/components/christmas-divider";
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

interface DonationResult {
  data: {
    usdEquivalent: number;
    tokensDonated: number;
    name?: string;
    message?: string;
    transactionSignature: string;
  };
}

export default function Home() {
  // theme comes from next-themes ThemeProvider (or system) — map to 'dark'|'light'
  const { resolvedTheme } = useTheme();
  const theme = (resolvedTheme as "dark" | "light" | undefined) || "light";

  const { connected, publicKey, disconnect } = useWallet();

  const walletOverlay = useWalletOverlay();
  const { initiatePayment, isProcessing } = useX402Payment();
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

  const [customAmount, setCustomAmount] = useState("0");
  const [donorName, setDonorName] = useState("");
  const [donorMessage, setDonorMessage] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "top">("recent");
  const [donationResult, setDonationResult] = useState<DonationResult | null>(
    null
  );

  // Removed activeTab state as we are combining views
  // const [mintAmount, setMintAmount] = useState("1"); // Removed mint logic
  // const [selectedQuickAmount, setSelectedQuickAmount] = useState<string | null>(null); // Removed mint logic
  const [donateWithToken] = useState<"TOKEN" | "USD">("USD");
  // const [solPrice, setSolPrice] = useState<number>(0);
  // const [usdcPrice, setUsdcPrice] = useState<number>(1);

  // Removed mintSuccessDialog state as it was for the separate mint tab

  // Token config from env
  const tokenName = process.env.NEXT_PUBLIC_TOKEN_NAME || "Token";
  const tokenSymbol = process.env.NEXT_PUBLIC_TOKEN_SYMBOL || "TOKEN";
  const tokenImage = process.env.NEXT_PUBLIC_TOKEN_IMAGE_URL;
  // const tokenDescription =
  //   process.env.NEXT_PUBLIC_PROJECT_DESCRIPTION || "Support our community!";
  const mintableSupply = parseInt(
    process.env.NEXT_PUBLIC_MINTABLE_SUPPLY || "1000000"
  );
  const donationTarget = parseInt(
    process.env.NEXT_PUBLIC_DONATION_TARGET || "1000"
  );
  const dollarToTokenRatio = Math.floor(mintableSupply / donationTarget);

  const isTokenDonation = donateWithToken === "TOKEN";

  const parsedDonationAmount = parseFloat(customAmount || "0") || 0;
  const minimumDonationAmount = isTokenDonation ? 1 : 1;
  const isDonateDisabled =
    isProcessing ||
    !customAmount ||
    parsedDonationAmount < minimumDonationAmount;

  const fetchMessages = useCallback(async () => {
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
  }, [sortBy]);

  useEffect(() => {
    setMounted(true);
    fetchMessages();
    // fetchPrices();
  }, [fetchMessages]);

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

  const handleDonate = async () => {
    if (!connected || !customAmount) return;

    const amount = parseFloat(customAmount);
    if (amount < 1) {
      toast.error("Minimum donation is $1");
      return;
    }

    try {
      const result = await initiatePayment("/api/write-message", {
        amount,
        name: donorName || undefined,
        message: donorMessage || undefined,
      });
      setDonationResult(result as DonationResult);
      setCustomAmount("0");

      setDonorName("");
      setDonorMessage("");
      fetchMessages(); // Refresh messages
    } catch (err) {
      console.error("Donation failed:", err);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  // const formatDate = (dateString: string) => {
  //   return new Date(dateString).toLocaleDateString("en-US", {
  //     month: "short",
  //     day: "numeric",
  //     hour: "2-digit",
  //     minute: "2-digit",
  //   });
  // };

  if (!mounted) {
    return null; // Avoid hydration mismatch
  }

  return (
    <>
      <ScrollIndicator />
      <main
        className="min-h-screen flex flex-col md:flex-row md:h-screen md:overflow-hidden relative"
        style={{
          background: theme === "dark" ? "#000000" : "#FAFAFA",
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
            background:
              theme === "dark"
                ? "linear-gradient(180deg, #000000 0%, #09090b 100%)"
                : "#FAFAFA",
          }}
        >
          {/* Header */}
          <header
            style={{
              background:
                theme === "dark"
                  ? "rgba(0, 0, 0, 0.95)"
                  : "rgba(255, 255, 255, 0.95)",
              borderBottom: "none",
              height: "88px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <div className="container mx-auto px-4 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                {tokenImage && (
                  <div
                    className="relative flex items-center justify-center"
                    style={{ width: "48px", height: "48px", flexShrink: 0 }}
                  >
                    <div
                      className="absolute inset-0 rounded-full overflow-hidden"
                      style={{
                        width: "40px",
                        height: "40px",
                        margin: "auto",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={tokenImage}
                        alt={tokenName}
                        className="w-full h-full"
                        style={{
                          aspectRatio: "1 / 1",
                          objectFit: "cover",
                          objectPosition: "center",
                        }}
                      />
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/ImageRing.png"
                      alt="Decorative Ring"
                      className="absolute pointer-events-none"
                      style={{
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: "100%",
                        height: "100%",
                      }}
                    />
                  </div>
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

          <div className="hidden md:block">
            <ChristmasDivider />
          </div>

          <div
            className="container mx-auto px-4 py-8 flex flex-col flex-1 min-h-0 relative z-10"
            style={{
              backgroundImage: "url(/websitebg.png)",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          >
            {/* Donation Statistic Heading */}
            <h2
              style={{
                fontFamily:
                  "var(--font-chelsea-market), Chelsea Market, cursive",
                fontWeight: 400,
                fontSize: "20px",
                lineHeight: "28px",
                letterSpacing: "-0.03em",
                color: "#FAFAFA",
                marginBottom: "16px",
              }}
            >
              Donation Statistic
            </h2>

            {/* Stats */}
            <div
              style={{
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "row",
                alignItems: "flex-start",
                padding: "16px 24px",
                gap: "24px",
                background:
                  theme === "dark"
                    ? "rgba(18, 18, 18, 0.4)"
                    : "rgba(255, 255, 255, 0.3)",
                backdropFilter: theme === "dark" ? "blur(32px)" : "blur(60px)",
                boxShadow:
                  theme === "dark" ? "0px 1.66px 0px 0px #000000" : "none",
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
              {/* Ice Left */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/Ice-left.png"
                alt="Ice decoration"
                style={{
                  position: "absolute",
                  top: 0,
                  left: "-2px",
                  width: "60px",
                  height: "auto",
                  pointerEvents: "none",
                  zIndex: 3,
                }}
              />
              {/* Ice Right */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/Ice-right.png"
                alt="Ice decoration"
                style={{
                  position: "absolute",
                  top: 0,
                  right: "-2px",
                  width: "60px",
                  height: "auto",
                  pointerEvents: "none",
                  zIndex: 3,
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
                        backgroundColor: "#D42426",
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
                        backgroundColor: "#F8B229",
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
                    fontFamily:
                      "var(--font-chelsea-market), Chelsea Market, cursive",
                    fontWeight: 400,
                    fontSize: "20px",
                    lineHeight: "28px",
                    letterSpacing: "-0.03em",
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
                    theme === "dark"
                      ? "rgba(18, 18, 18, 0.4)"
                      : "rgba(255, 255, 255, 0.3)",
                  backdropFilter:
                    theme === "dark" ? "blur(32px)" : "blur(60px)",
                  boxShadow:
                    theme === "dark" ? "0px 1.66px 0px 0px #000000" : "none",
                  border:
                    theme === "dark"
                      ? "1px solid rgba(255, 255, 255, 0.16)"
                      : "1px solid rgba(228, 228, 231, 1)",
                  position: "relative",
                  overflow: "visible",
                }}
              >
                {/* Ice Left */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/Ice-left.png"
                  alt="Ice decoration"
                  style={{
                    position: "absolute",
                    width: "90.5px",
                    height: "60.14px",
                    left: "-3px",
                    top: "-7px",
                    zIndex: 1,
                  }}
                />

                {/* Ice Right */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/Ice-right.png"
                  alt="Ice decoration"
                  style={{
                    position: "absolute",
                    width: "90.5px",
                    height: "60.14px",
                    right: "-3px",
                    top: "-7px",
                    transform: "rotate(360deg)",
                    zIndex: 2,
                  }}
                />
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
                        <div className="text-center space-y-2 flex flex-col items-center">
                          <div className="flex items-end justify-center -space-x-4 mb-4">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src="/tree.png"
                              alt="Christmas Tree"
                              className="w-24 h-auto object-contain z-0"
                            />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src="/santa.png"
                              alt="Santa Claus"
                              className="w-20 h-auto object-contain z-10"
                            />
                          </div>
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
            className="container mx-auto px-4"
            style={{
              background:
                theme === "dark"
                  ? "rgba(255, 255, 255, 0)"
                  : "rgba(255, 255, 255, 1)",
              borderBottom: "none",
              height: "88px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <div>
              <h1
                className="text-2xl font-bold text-nowrap"
                style={{
                  fontFamily:
                    "var(--font-chelsea-market), Chelsea Market, cursive",
                  fontWeight: 400,
                  fontSize: "20px",
                  lineHeight: "28px",
                  letterSpacing: "-0.03em",
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
          </header>

          <ChristmasDivider />

          {/* Gifts Decoration - Mobile/Desktop */}
          <div
            className="absolute bottom-0 right-0 w-full pointer-events-none md:block hidden"
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "flex-end",
              zIndex: 0,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/gifts.png"
              alt="Holiday Gifts"
              style={{
                maxHeight: "300px",
                objectFit: "contain",
                width: "auto",
              }}
            />
          </div>

          <div
            className="container mx-auto px-4 py-8 space-y-6 relative z-10"
            style={{
              background: "transparent",
            }}
          >
            {!connected ? (
              <div className="text-center space-y-4">
                <h1
                  className="text-xl font-bold mb-3"
                  style={{
                    fontFamily:
                      "var(--font-chelsea-market), Chelsea Market, cursive",
                    fontWeight: 400,
                    fontSize: "20px",
                    lineHeight: "28px",
                    letterSpacing: "-0.03em",
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
                    background: "#CB272A",
                    border: "1px solid #A21010",
                    borderRadius: "999px",
                    fontStyle: "normal",
                    fontWeight: 500,
                    fontSize: "14px",
                    lineHeight: "20px",
                    color: "#FFFFFF",
                    textShadow: "0px 3px 4px rgba(0, 0, 0, 0.2)",

                    cursor: "pointer",
                    margin: "0 auto",
                  }}
                >
                  Select Wallet
                </Button>
              </div>
            ) : (
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
                    borderRadius: "16px",
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
                      <p className="text-sm text-gray-400">Connected Wallet</p>
                      <p
                        className="text-sm font-bold"
                        style={{
                          color:
                            theme === "dark"
                              ? "rgba(255, 255, 255, 1)"
                              : "rgba(9, 9, 11, 1)",
                        }}
                      >
                        {publicKey ? formatAddress(publicKey.toString()) : ""}
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
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
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
                    <span
                      className="text-sm font-bold"
                      style={{
                        color:
                          theme === "dark"
                            ? "rgba(255, 255, 255, 1)"
                            : "rgba(9, 9, 11, 1)",
                      }}
                    >
                      Available USDC: ${usdcBalance.toFixed(2)}
                    </span>
                  </div>

                  {/* Quick Amounts */}
                  <div className="grid grid-cols-4 gap-3">
                    {[1, 5, 10, 50].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setCustomAmount(amount.toString())}
                        className="py-2.5 rounded-lg text-sm font-medium transition-colors"
                        style={{
                          background:
                            customAmount === amount.toString()
                              ? theme === "dark"
                                ? "rgba(255, 255, 255, 0.1)"
                                : "rgba(0, 0, 0, 0.1)"
                              : "transparent",
                          border:
                            theme === "dark"
                              ? "1px solid rgba(255, 255, 255, 0.16)"
                              : "1px solid rgba(0, 0, 0, 0.16)",
                          color:
                            theme === "dark"
                              ? "rgba(255, 255, 255, 1)"
                              : "rgba(9, 9, 11, 1)",
                        }}
                      >
                        ${amount}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Your Name Section */}
                <div className="space-y-2 mt-4">
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
                    placeholder="I love this community!"
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

                {/* To Receive Section */}
                <div className="space-y-2 mt-4">
                  <label
                    className="text-sm font-medium"
                    style={{ color: theme === "dark" ? "#fff" : "#000" }}
                  >
                    Reward
                  </label>

                  <div
                    className="p-4 rounded-xl flex items-center justify-between"
                    style={{
                      background:
                        theme === "dark"
                          ? "rgba(255,255,255,0.06)"
                          : "rgba(0,0,0,0.06)",
                      border:
                        theme === "dark"
                          ? "1px solid rgba(255,255,255,0.16)"
                          : "rgba(0,0,0,0.16)",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-blue-400 to-purple-500">
                        {tokenImage ? (
                          <img
                            src={tokenImage}
                            alt={tokenSymbol}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-white text-xs font-bold">
                            {tokenSymbol.slice(0, 2)}
                          </span>
                        )}
                      </div>
                      <span
                        className="font-bold text-lg"
                        style={{ color: theme === "dark" ? "#fff" : "#000" }}
                      >
                        {tokenSymbol}
                      </span>
                    </div>
                    <div className="text-right">
                      <div
                        className="font-bold text-xl"
                        style={{ color: theme === "dark" ? "#fff" : "#000" }}
                      >
                        {(
                          parseFloat(customAmount || "0") * dollarToTokenRatio
                        ).toLocaleString()}
                      </div>
                      <div
                        className="text-sm"
                        style={{ color: "rgba(156, 163, 175, 1)" }}
                      >
                        ≈ ${parseFloat(customAmount || "0").toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reward Rate */}
                <div
                  className="p-3 rounded-lg text-center text-sm font-medium flex items-center justify-center gap-2 mt-2"
                  style={{
                    background:
                      theme === "dark"
                        ? "rgba(255,255,255,0.03)"
                        : "rgba(0,0,0,0.03)",
                    border:
                      theme === "dark"
                        ? "1px solid rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.1)",
                    color: "rgba(156, 163, 175, 1)",
                  }}
                >
                  <span>Reward Rate</span>
                  <span style={{ color: theme === "dark" ? "#fff" : "#000" }}>
                    $1 = {dollarToTokenRatio.toLocaleString()} {tokenSymbol}
                  </span>
                </div>

                {/* Donate Button */}
                <Button
                  onClick={handleDonate}
                  disabled={isDonateDisabled}
                  className="w-full font-bold py-3 rounded-full"
                  style={{
                    color: "#FFFFFF",
                    background: "#CB272A",
                    border: "1px solid #A21010",
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
                  <span className="text-gray-400">✓</span>
                  <span>Secure payment powered by Solana</span>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

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
