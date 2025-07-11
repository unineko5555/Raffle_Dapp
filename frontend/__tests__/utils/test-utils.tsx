import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock wagmi config for testing
const mockConfig = {
  chains: [
    {
      id: 11155111,
      name: 'Ethereum Sepolia',
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: ['https://eth-sepolia.g.alchemy.com/v2/test'] } },
      blockExplorers: { default: { name: 'Etherscan', url: 'https://sepolia.etherscan.io' } },
    },
  ],
  connectors: [],
  transports: {},
}

// Custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options })

// Mock data generators
export const mockRaffleData = {
  raffleState: 0, // OPEN
  numberOfPlayers: 3,
  jackpotAmount: '1000000000000000000', // 1 ETH in wei
  recentWinner: '0x123456789abcdef123456789abcdef123456789a',
  entranceFee: '100000000000000000', // 0.1 ETH in wei
  lastRaffleTime: BigInt(Date.now() - 3600000), // 1 hour ago
  minimumPlayers: 2,
}

export const mockPlayerData = {
  address: '0x123456789abcdef123456789abcdef123456789a',
  isEntered: true,
  entryAmount: '100000000000000000',
  entryTime: BigInt(Date.now() - 1800000), // 30 minutes ago
}

export const mockContractAddresses = {
  11155111: {
    name: 'Ethereum Sepolia',
    raffleProxy: '0x1234567890123456789012345678901234567890',
    erc20Address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    blockExplorer: 'https://sepolia.etherscan.io',
  },
  84532: {
    name: 'Base Sepolia',
    raffleProxy: '0x2345678901234567890123456789012345678901',
    erc20Address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    blockExplorer: 'https://sepolia.basescan.org',
  },
}

// Mock transaction receipt
export const mockTransactionReceipt = {
  blockHash: '0x123',
  blockNumber: 12345,
  contractAddress: null,
  cumulativeGasUsed: 21000,
  effectiveGasPrice: 20000000000,
  from: '0x123456789abcdef123456789abcdef123456789a',
  gasUsed: 21000,
  logs: [],
  logsBloom: '0x00',
  status: 'success' as const,
  to: '0x1234567890123456789012345678901234567890',
  transactionHash: '0xabcdef123456789abcdef123456789abcdef123456789abcdef123456789abcdef',
  transactionIndex: 0,
  type: 'legacy' as const,
}

// Mock balance data
export const mockBalanceData = {
  usdc: {
    balance: '1000000000', // 1000 USDC (6 decimals)
    formatted: '1000',
    symbol: 'USDC',
    decimals: 6,
  },
  eth: {
    balance: '1000000000000000000', // 1 ETH
    formatted: '1.0',
    symbol: 'ETH',
    decimals: 18,
  },
}

// Mock event data
export const mockRaffleEvents = {
  raffleEnter: {
    player: '0x123456789abcdef123456789abcdef123456789a',
    amount: '100000000000000000',
    timestamp: BigInt(Date.now() - 1800000),
  },
  winnerPicked: {
    winner: '0x123456789abcdef123456789abcdef123456789a',
    amount: '1000000000000000000',
    timestamp: BigInt(Date.now() - 600000),
  },
  raffleStateChanged: {
    newState: 2, // WINNER_SELECTED
    timestamp: BigInt(Date.now() - 300000),
  },
}

// Utility functions for testing
export const waitForNextTick = () => new Promise(resolve => setTimeout(resolve, 0))

export const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

// Export everything from react-testing-library
export * from '@testing-library/react'
export { customRender as render }

// Add a simple test to satisfy Jest's requirement
describe('Test Utils', () => {
  it('should export render function', () => {
    expect(customRender).toBeDefined()
  })
})