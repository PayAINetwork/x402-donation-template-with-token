# WITH TOKEN Template - Implementation Tasks

This is the **x402-donation-with-token-template** - for projects that want to mint and distribute tokens.

## Current Status
Base code copied from the no-token template. Needs modifications for token functionality.

## Key Features to Implement

### 1. Donation Flow (USDC → Token Minting)
- [x] Slider for USDC amount (10%, 25%, 75%, 100% of balance)
- [x] USDC balance detection
- [ ] Separate donation from write-on-wall
- [ ] Fixed preset amounts: $1, $5, $10, $50, $100
- [ ] Remove custom input field for donations

### 2. Write on Wall Flow (Token → Message)
- [ ] Separate "Write on Wall" section
- [ ] Auto-detect wallet's $TOKEN balance
- [ ] Custom amount input for tokens
- [ ] Pay with minted tokens to write message

### 3. Header Display
- [x] Show Token Name + Token Symbol (not Project Name)
- [x] Display token image

### 4. Stats Dashboard
- [x] Tokens Minted
- [x] Tokens Distributed
- [x] Tokens Remaining
- [x] Total Donors
- [x] Total Donated (USD)

### 5. Error Handling
- [ ] Detect missing ATA error
- [ ] Prompt for 2-step transaction:
  - First: Send 0.0001 USDC to create merchant's USDC ATA
  - Second: Complete the donation

### 6. API Routes
- [x] `/api/donate/1`, `/api/donate/5`, `/api/donate/10` (keep these)
- [ ] `/api/donate/50`, `/api/donate/100` (add these)
- [x] `/api/write-message` (modify for token payment)

### 7. Token Logic
- [x] `lib/token.ts` - Token transfer logic
- [x] Mint tokens on donation
- [ ] Check token balance before write-on-wall
- [ ] Support tokens bought from DEX (not just minted)

## Fixes Needed (from fixes.md)

### High Priority
1. **Separate Actions** - Donate USDC vs Write with Tokens
2. **Fixed Amounts** - Only $1, $5, $10, $50, $100 for donations
3. **ATA Error Handling** - Two-step transaction prompt

### Medium Priority
4. **Token Balance Detection** - Auto-detect for write-on-wall
5. **Custom Token Amount** - For write-on-wall feature
6. **Error Feedback** - Show error messages to users

## Architecture

```
User Flow 1: Mint Tokens
1. Connect wallet
2. Select amount ($1, $5, $10, $50, $100)
3. Pay USDC via x402
4. Receive minted tokens
5. See confirmation

User Flow 2: Write on Wall
1. Have tokens (minted or bought from DEX)
2. Enter custom token amount
3. Write message
4. Pay tokens via x402
5. Message appears on board
```

## Environment Variables
```bash
# Token Configuration (server-side)
TOKEN_MINT=<mint_address>
TOKEN_NAME=<name>
TOKEN_SYMBOL=<symbol>
TOTAL_SUPPLY=<supply>
MINTABLE_SUPPLY=<amount>
TOKEN_IMAGE_URL=<ipfs_url>
TOKEN_DESCRIPTION=<description>

# Frontend (NEXT_PUBLIC_)
NEXT_PUBLIC_TOKEN_NAME=<name>
NEXT_PUBLIC_TOKEN_SYMBOL=<symbol>
NEXT_PUBLIC_TOKEN_IMAGE_URL=<ipfs_url>
NEXT_PUBLIC_TOKEN_DESCRIPTION=<description>
NEXT_PUBLIC_MINTABLE_SUPPLY=<amount>
NEXT_PUBLIC_DONATION_TARGET=<target>

# Resource Server (holds tokens)
RESOURCE_SERVER_WALLET_ADDRESS=<address>
RESOURCE_SERVER_WALLET_PRIVATE_KEY=<private_key>
```

## Next Steps
1. Update README for WITH TOKEN version
2. Implement two separate flows (donate vs write)
3. Add fixed amount buttons
4. Add token balance detection
5. Test full flow with real token
