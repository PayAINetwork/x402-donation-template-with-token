// Learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

// Mock environment variables for tests
process.env.NEXT_PUBLIC_TOKEN_MINT = "TestTokenMintAddress";
process.env.NEXT_PUBLIC_TOKEN_NAME = "Test Token";
process.env.NEXT_PUBLIC_TOKEN_SYMBOL = "TEST";
process.env.TOTAL_SUPPLY = "1000000";
process.env.NEXT_PUBLIC_MINTABLE_SUPPLY = "500000";
process.env.NEXT_PUBLIC_TOKEN_IMAGE_URL = "https://example.com/token.png";
process.env.NEXT_PUBLIC_PROJECT_DESCRIPTION = "Test project description";
process.env.NEXT_PUBLIC_DONATION_TARGET = "10000";
process.env.RESOURCE_SERVER_WALLET_ADDRESS = "TestResourceWalletAddress";
process.env.RESOURCE_SERVER_WALLET_PRIVATE_KEY = "TestPrivateKey";
process.env.SOLANA_RPC_URL = "https://api.devnet.solana.com";

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Keep console.error for debugging test failures
  error: jest.fn(),
  // Uncomment to see logs during tests:
  // log: console.log,
  // warn: console.warn,
};
