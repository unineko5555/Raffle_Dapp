import '@testing-library/jest-dom'

// Polyfill for TextEncoder/TextDecoder (required for viem)
const { TextEncoder, TextDecoder } = require('util')
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Mock crypto for Node.js environment
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: (arr) => require('crypto').randomBytes(arr.length),
    subtle: {
      digest: async (algorithm, data) => {
        const hash = require('crypto').createHash(algorithm.toLowerCase().replace('-', ''))
        hash.update(data)
        return hash.digest()
      }
    }
  }
})

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      replace: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    }
  },
}))

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      refresh: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      prefetch: jest.fn(),
    }
  },
  usePathname: () => '/',
  useSearchParams: () => ({
    get: jest.fn(),
    has: jest.fn(),
    getAll: jest.fn(),
    keys: jest.fn(),
    values: jest.fn(),
    entries: jest.fn(),
    toString: jest.fn(),
  }),
}))

// Mock wagmi hooks
jest.mock('wagmi', () => ({
  useAccount: () => ({
    address: '0x123',
    isConnected: true,
    isConnecting: false,
    isDisconnected: false,
    status: 'connected',
  }),
  useChainId: () => 11155111,
  useReadContract: () => ({
    data: null,
    isError: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
  useWriteContract: () => ({
    writeContract: jest.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
  }),
  useWaitForTransactionReceipt: () => ({
    data: null,
    isLoading: false,
    isSuccess: false,
    isError: false,
  }),
  usePublicClient: () => ({
    readContract: jest.fn(),
    waitForTransactionReceipt: jest.fn(),
  }),
  useWalletClient: () => ({
    data: null,
    isLoading: false,
  }),
}))

// Mock viem
jest.mock('viem', () => ({
  formatEther: jest.fn((value) => '1.0'),
  parseEther: jest.fn((value) => BigInt(value)),
  formatUnits: jest.fn((value, decimals) => '1.0'),
  parseUnits: jest.fn((value, decimals) => BigInt(value)),
  getContract: jest.fn(),
  createPublicClient: jest.fn(),
  http: jest.fn(),
}))

// Mock Alchemy AA SDK
jest.mock('@alchemy/aa-alchemy', () => ({
  createAlchemySmartAccountClient: jest.fn(),
  AlchemyProvider: jest.fn(),
}))

jest.mock('@alchemy/aa-accounts', () => ({
  LightSmartContractAccount: jest.fn(),
}))

// Mock Web3Auth and related dependencies
jest.mock('@web3auth/modal', () => ({
  Web3Auth: jest.fn().mockImplementation(() => ({
    init: jest.fn(),
    connect: jest.fn(),
    logout: jest.fn(),
    getUserInfo: jest.fn(),
    status: 'ready',
    connected: false,
  })),
}))

// Mock Web3Auth related crypto modules
jest.mock('@web3auth/auth', () => ({}))
jest.mock('@toruslabs/metadata-helpers', () => ({}))
jest.mock('@toruslabs/base-controllers', () => ({}))
jest.mock('@web3auth/base', () => ({
  CHAIN_NAMESPACES: {
    EIP155: 'eip155',
  },
  WEB3AUTH_NETWORK: {
    SAPPHIRE_DEVNET: 'sapphire_devnet',
  },
}))

// Mock ethereum-cryptography
jest.mock('ethereum-cryptography/keccak', () => ({
  keccak256: jest.fn(() => new Uint8Array(32)),
}))

jest.mock('ethereum-cryptography/utils', () => ({
  keccak256: jest.fn(() => new Uint8Array(32)),
}))

// Mock environment variables
process.env.NEXT_PUBLIC_ALCHEMY_API_KEY = 'test-alchemy-key'
process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID = 'test-wc-project-id'

// Mock window object
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock Radix UI components
jest.mock('@radix-ui/react-dialog', () => ({
  Root: ({ children }) => children,
  Trigger: ({ children, ...props }) => <button {...props}>{children}</button>,
  Portal: ({ children }) => children,
  Overlay: ({ children, ...props }) => <div {...props}>{children}</div>,
  Content: ({ children, ...props }) => <div {...props}>{children}</div>,
  Title: ({ children, ...props }) => <h2 {...props}>{children}</h2>,
  Description: ({ children, ...props }) => <p {...props}>{children}</p>,
  Close: ({ children, ...props }) => <button {...props}>{children}</button>,
}))

jest.mock('@radix-ui/react-toast', () => ({
  Provider: ({ children }) => children,
  Root: ({ children, ...props }) => <div {...props}>{children}</div>,
  Title: ({ children, ...props }) => <div {...props}>{children}</div>,
  Description: ({ children, ...props }) => <div {...props}>{children}</div>,
  Action: ({ children, ...props }) => <button {...props}>{children}</button>,
  Close: ({ children, ...props }) => <button {...props}>{children}</button>,
  Viewport: ({ children, ...props }) => <div {...props}>{children}</div>,
}))

// Suppress console warnings in tests
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})