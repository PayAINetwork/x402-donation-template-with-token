import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SolanaWalletProvider } from "@/components/wallet-provider";
import { Providers } from "@/components/providers";
import { ThemeToggle } from "@/components/theme-toggle";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const tokenName =
  process.env.NEXT_PUBLIC_TOKEN_NAME || process.env.TOKEN_NAME || "Token";
const tokenSymbol = process.env.NEXT_PUBLIC_TOKEN_SYMBOL || "TOKEN";
const projectDescription =
  process.env.NEXT_PUBLIC_PROJECT_DESCRIPTION ||
  `Support our community and receive ${tokenSymbol} tokens`;
const tokenImage = process.env.NEXT_PUBLIC_TOKEN_IMAGE_URL;

export const metadata: Metadata = {
  title: `(${tokenSymbol}) ${tokenName} - x402 Donations!`,
  description: projectDescription,
  keywords: [
    tokenName,
    tokenSymbol,
    "donation",
    "crypto",
    "solana",
    "tokens",
    "community",
  ],
  authors: [{ name: tokenName }],
  icons: tokenImage
    ? {
        icon: tokenImage,
        apple: tokenImage,
        shortcut: tokenImage,
      }
    : undefined,
  openGraph: {
    title: `(${tokenSymbol}) ${tokenName} - x402 Donations!`,
    description: projectDescription,
    images: tokenImage ? [{ url: tokenImage, alt: `${tokenName} Logo` }] : [],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `(${tokenSymbol}) ${tokenName} - x402 Donations!`,
    description: projectDescription,
    images: tokenImage ? [tokenImage] : [],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <Providers>
          <div className="fixed right-4 top-4 z-50">
            <ThemeToggle />
          </div>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
