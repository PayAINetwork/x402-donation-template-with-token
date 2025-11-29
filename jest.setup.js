// Learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

// Mock environment variables for tests
process.env.TOKEN_MINT = "TestTokenMintAddress";
process.env.TOKEN_NAME = "Test Token";
process.env.TOKEN_SYMBOL = "TEST";
process.env.TOTAL_SUPPLY = "1000000";
process.env.MINTABLE_SUPPLY = "500000";
process.env.TOKEN_IMAGE_URL = "https://example.com/token.png";
process.env.TOKEN_DESCRIPTION = "Test token description";
process.env.DONATION_TARGET = "10000";
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
