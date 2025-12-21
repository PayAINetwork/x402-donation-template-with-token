import { NextResponse } from "next/server";
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { processPriceToAtomicAmount } from "x402/shared";
import { SupportedSVMNetworks } from "x402/types";

import { getConnection, getResourceWallet } from "@/lib/solana";

// Ensure the merchant (payTo) has a USDC ATA so the first donation doesn't fail
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "solana-devnet") as (typeof SupportedSVMNetworks)[number];

    if (!SupportedSVMNetworks.includes(network)) {
      return NextResponse.json(
        { success: false, error: `Unsupported network: ${network}` },
        { status: 400 }
      );
    }

    const atomicAmountForAsset = processPriceToAtomicAmount("$1", network);
    if ("error" in atomicAmountForAsset) {
      return NextResponse.json(
        { success: false, error: atomicAmountForAsset.error },
        { status: 500 }
      );
    }

    const { asset } = atomicAmountForAsset;
    const mint = new PublicKey(asset.address);

    const connection = getConnection();
    const merchant = getResourceWallet();

    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      merchant,
      mint,
      merchant.publicKey
    );

    return NextResponse.json({
      success: true,
      network,
      mint: mint.toBase58(),
      ata: ata.address.toBase58(),
    });
  } catch (error) {
    console.error("[merchant][ensure-ata]", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to ensure merchant ATA",
      },
      { status: 500 }
    );
  }
}
