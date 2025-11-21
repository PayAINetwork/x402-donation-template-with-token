# Setup Guide - With Token Template

## What's Here

This is the **WITH TOKEN** version of the x402 donation template. It's been copied from the no-token template and needs modifications to support:

1. **USDC Donations** → Mint tokens
2. **Token Payments** → Write on wall
3. **Separate Flows** for the two actions above

## Current State

✅ **What's Working:**
- Base Next.js structure
- Wallet connection
- USDC balance detection
- Slider UI (needs to be changed to fixed buttons)
- Token configuration in env vars
- Token transfer logic (`lib/token.ts`)
- Database schema

❌ **What Needs Work:**
- Separate donation flow from write-on-wall flow
- Replace slider with fixed buttons ($1, $5, $10, $50, $100)
- Add token balance detection for write-on-wall
- Implement two-step ATA error handling
- Update README to reflect WITH TOKEN features

## Files Overview

### Key Files to Modify

1. **`app/page.tsx`** (1537 lines)
   - Main UI - needs split into two sections
   - Current: Has USDC slider (should be buttons)
   - Need: Separate "Donate" and "Write on Wall" sections

2. **`app/api/write-message/route.ts`**
   - Currently: Handles USDC donations + token minting
   - Should: Only handle token payments for messages
   - Need: Create separate `/api/donate/*` routes

3. **`lib/token.ts`** (136 lines)
   - Token transfer logic
   - Already working, just needs to be called from right places

4. **`middleware.ts`**
   - x402 payment verification
   - Need to add routes for $50 and $100 donations

### Structure

```
app/
├── page.tsx                    # Main UI (needs modification)
├── api/
│   ├── donate/
│   │   ├── 1/route.ts         # $1 donation (keep)
│   │   ├── 5/route.ts         # $5 donation (keep)
│   │   ├── 10/route.ts        # $10 donation (keep)
│   │   ├── 50/route.ts        # $50 donation (add this)
│   │   └── 100/route.ts       # $100 donation (add this)
│   └── write-message/route.ts # Token payment (modify)

lib/
├── token.ts                    # Token logic (working)
├── donation-handler.ts         # Donation logic (working)
└── solana.ts                   # Solana connection (working)
```

## Next Steps

1. **Read `TODO.md`** - Full task list
2. **Read `fixes.md`** - Requirements from stakeholder
3. **Start with separating the two flows** - Most important change

## Quick Start

```bash
cd /Users/MAC/Projects/x402-donation-with-token-template
pnpm install
pnpm dev
```

## Questions to Answer

1. Should donations show on the community board? (Currently yes)
2. Should write-on-wall messages be separate from donations? (Yes per fixes.md)
3. Can users write multiple messages? (Probably yes)
4. What's the minimum token amount to write on wall? (TBD)

---

Good luck! The foundation is here, now it needs the WITH TOKEN specific features.
