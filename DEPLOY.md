# Deploy to Vercel

This template can be deployed to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FMbdulrohim%2Fx402-donation-with-token-template&env=DATABASE_URL,RESOURCE_SERVER_WALLET_ADDRESS,RESOURCE_SERVER_KEYPAIR,TOTAL_SUPPLY,NEXT_PUBLIC_SOLANA_NETWORK,NEXT_PUBLIC_SOLANA_RPC_URL,NEXT_PUBLIC_TOKEN_MINT,NEXT_PUBLIC_TOKEN_NAME,NEXT_PUBLIC_TOKEN_SYMBOL,NEXT_PUBLIC_TOKEN_IMAGE_URL,NEXT_PUBLIC_PROJECT_DESCRIPTION,NEXT_PUBLIC_MINTABLE_SUPPLY,NEXT_PUBLIC_DONATION_TARGET&envDescription=Required%20environment%20variables%20for%20the%20token%20donation%20platform&envLink=https%3A%2F%2Fgithub.com%2FMbdulrohim%2Fx402-donation-with-token-template%2Fblob%2Fmain%2F.env.example&project-name=token-donation-platform&repository-name=token-donation-platform)

## Prerequisites

Before deploying, you need:

1. **Neon Postgres Database** (Free tier available)

   - Sign up at [neon.tech](https://neon.tech)
   - Create a new database
   - Copy the connection string

2. **Solana Token**

   - Create or have an existing SPL token on Solana
   - Have the token mint address

3. **Resource Server Wallet**
   - A Solana wallet that will:
     - Receive USDC payments for minting
     - Receive TOKEN donations
     - Hold and distribute your TOKEN
   - You need both the wallet address and private key (Base58 encoded)

## Environment Variables

During deployment, you'll be asked to provide these environment variables:

### Required

- `DATABASE_URL`: Your Neon Postgres connection string
- `RESOURCE_SERVER_WALLET_ADDRESS`: Public key of your resource server wallet
- `RESOURCE_SERVER_KEYPAIR`: Base58 encoded private key
- `TOTAL_SUPPLY`: Total token supply (e.g., 1000000000)
- `NEXT_PUBLIC_SOLANA_NETWORK`: `solana-devnet` or `solana`
- `NEXT_PUBLIC_SOLANA_RPC_URL`: Solana RPC endpoint
- `NEXT_PUBLIC_TOKEN_MINT`: Your SPL token mint address
- `NEXT_PUBLIC_TOKEN_NAME`: Name of your token (e.g., "My Token")
- `NEXT_PUBLIC_TOKEN_SYMBOL`: Token symbol (e.g., "MTK")
- `NEXT_PUBLIC_TOKEN_IMAGE_URL`: URL to token logo image
- `NEXT_PUBLIC_PROJECT_DESCRIPTION`: Description of your project
- `NEXT_PUBLIC_MINTABLE_SUPPLY`: Amount available for distribution (e.g., 1000000)
- `NEXT_PUBLIC_DONATION_TARGET`: Target USD amount to raise (e.g., 1000)

### Optional

- `FACILITATOR_URL`: X402 payment facilitator URL (default: https://facilitator.payai.network)

## Post-Deployment Steps

1. **Run Database Migrations**

   ```bash
   pnpm drizzle-kit push
   ```

2. **Fund Your Resource Server Wallet**

   - Send your TOKEN to the resource server wallet
   - Ensure it has enough SOL for transaction fees

3. **Test the Platform**
   - Visit your deployed URL
   - Connect a wallet
   - Try the Mint tab (pay USDC, receive TOKEN)
   - Try the Donate tab (pay TOKEN, write to community board)

## Manual Deployment

If you prefer to deploy manually:

```bash
# 1. Clone the repository
git clone https://github.com/Mbdulrohim/x402-donation-with-token-template.git
cd x402-donation-with-token-template

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your values

# 4. Deploy to Vercel:
#    - Import the project into Vercel.
#    - Set the environment variables as defined in `.env.example`.
#    - Note: Database migrations will run automatically during the build process (`pnpm db:migrate`). Ensure your `DATABASE_URL` is correct.
#    - Deploy.
vercel
```

## Troubleshooting

### Database Connection Issues

- Ensure your DATABASE_URL is correctly formatted
- Check that your Neon database is active
- Verify the connection string has the correct password

### Token Transfer Failures

- Ensure the resource server wallet has enough tokens
- Check that the wallet has enough SOL for transaction fees
- Verify the RESOURCE_SERVER_KEYPAIR is correctly encoded

### Payment Issues

- Verify wallets have sufficient USDC for minting
- Verify wallets have sufficient TOKEN for donations
- Check that the FACILITATOR_URL is accessible

## Support

For issues or questions:

- Open an issue on [GitHub](https://github.com/Mbdulrohim/x402-donation-with-token-template/issues)
- Check the [README](./README.md) for more information
