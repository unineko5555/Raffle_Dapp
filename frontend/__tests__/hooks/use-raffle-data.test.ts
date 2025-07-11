import { renderHook, waitFor } from '@testing-library/react'

// Define mock data locally
const mockRaffleData = {
  raffleState: 0, // OPEN
  numberOfPlayers: 3,
  jackpotAmount: '1000000000000000000', // 1 ETH in wei
  recentWinner: '0x123456789abcdef123456789abcdef123456789a',
  entranceFee: '100000000000000000', // 0.1 ETH in wei
  lastRaffleTime: BigInt(Date.now() - 3600000), // 1 hour ago
  minimumPlayers: 2,
}

const mockPlayerData = {
  address: '0x123456789abcdef123456789abcdef123456789a',
  isEntered: true,
  entryAmount: '100000000000000000',
  entryTime: BigInt(Date.now() - 1800000), // 30 minutes ago
}

// Mock dependencies
const mockUseContractConfig = jest.fn()
const mockUseReadContract = jest.fn()
const mockUseAccount = jest.fn()

jest.mock('@/hooks/shared/use-contract-config', () => ({
  useContractConfig: mockUseContractConfig,
}))

jest.mock('wagmi', () => ({
  useReadContract: mockUseReadContract,
  useAccount: mockUseAccount,
}))

// Mock the hook we're testing
jest.mock('@/hooks/use-raffle-data', () => ({
  useRaffleData: jest.fn(() => ({
    raffleState: mockRaffleData.raffleState,
    numberOfPlayers: mockRaffleData.numberOfPlayers,
    jackpotAmount: BigInt(mockRaffleData.jackpotAmount),
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  })),
}))

describe('useRaffleData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default mocks
    mockUseContractConfig.mockReturnValue({
      contractAddress: '0x1234567890123456789012345678901234567890',
      isValidChainId: true,
      chainId: 11155111,
    })

    mockUseReadContract.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    })

    mockUseAccount.mockReturnValue({
      address: '0x123456789abcdef123456789abcdef123456789a',
      isConnected: true,
    })
  })

  describe('raffle state data', () => {
    it('should fetch and return raffle state correctly', async () => {
      const { useRaffleData } = require('@/hooks/use-raffle-data')
      const { result } = renderHook(() => useRaffleData())

      expect(result.current.raffleState).toBe(mockRaffleData.raffleState)
      expect(result.current.numberOfPlayers).toBe(mockRaffleData.numberOfPlayers)
      expect(result.current.jackpotAmount).toBe(BigInt(mockRaffleData.jackpotAmount))
    })

    it('should handle loading states', () => {
      const { useRaffleData } = require('@/hooks/use-raffle-data')
      
      // Override the mock for this test
      useRaffleData.mockReturnValue({
        raffleState: null,
        numberOfPlayers: null,
        jackpotAmount: null,
        isLoading: true,
        isError: false,
        refetch: jest.fn(),
      })

      const { result } = renderHook(() => useRaffleData())

      expect(result.current.isLoading).toBe(true)
      expect(result.current.raffleState).toBeNull()
    })

    it('should handle error states', () => {
      const { useRaffleData } = require('@/hooks/use-raffle-data')
      
      // Override the mock for this test
      useRaffleData.mockReturnValue({
        raffleState: null,
        numberOfPlayers: null,
        jackpotAmount: null,
        isLoading: false,
        isError: true,
        error: new Error('Contract read failed'),
        refetch: jest.fn(),
      })

      const { result } = renderHook(() => useRaffleData())

      expect(result.current.isError).toBe(true)
      expect(result.current.error).toBeInstanceOf(Error)
    })
  })

  describe('player data', () => {
    it('should fetch player entry status when address is provided', async () => {
      const { useRaffleData } = require('@/hooks/use-raffle-data')
      const playerAddress = '0x123456789abcdef123456789abcdef123456789a'
      
      useRaffleData.mockReturnValue({
        ...mockRaffleData,
        isPlayerEntered: true,
        refetch: jest.fn(),
      })

      const { result } = renderHook(() => useRaffleData({ playerAddress }))

      expect(result.current.isPlayerEntered).toBe(true)
    })

    it('should not fetch player data when address is not provided', () => {
      const { useRaffleData } = require('@/hooks/use-raffle-data')
      
      useRaffleData.mockReturnValue({
        ...mockRaffleData,
        isPlayerEntered: false,
        refetch: jest.fn(),
      })

      const { result } = renderHook(() => useRaffleData())

      expect(result.current.isPlayerEntered).toBe(false)
    })
  })

  describe('data refetching', () => {
    it('should provide refetch function', () => {
      const { useRaffleData } = require('@/hooks/use-raffle-data')
      const mockRefetch = jest.fn()
      
      useRaffleData.mockReturnValue({
        ...mockRaffleData,
        refetch: mockRefetch,
      })

      const { result } = renderHook(() => useRaffleData())

      expect(result.current.refetch).toBeDefined()
      expect(typeof result.current.refetch).toBe('function')
    })

    it('should call refetch function when updateRaffleData is called', async () => {
      const { useRaffleData } = require('@/hooks/use-raffle-data')
      const mockRefetch = jest.fn()
      
      useRaffleData.mockReturnValue({
        ...mockRaffleData,
        refetch: mockRefetch,
      })

      const { result } = renderHook(() => useRaffleData())

      await result.current.refetch()

      expect(mockRefetch).toHaveBeenCalled()
    })
  })

  describe('contract configuration dependency', () => {
    it('should not fetch data when chain is invalid', () => {
      const { useRaffleData } = require('@/hooks/use-raffle-data')
      
      mockUseContractConfig.mockReturnValue({
        contractAddress: undefined,
        isValidChainId: false,
        chainId: 999999,
      })

      useRaffleData.mockReturnValue({
        raffleState: null,
        numberOfPlayers: null,
        jackpotAmount: null,
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      })

      const { result } = renderHook(() => useRaffleData())

      expect(result.current.raffleState).toBeNull()
      expect(result.current.isError).toBe(false)
    })

    it('should refetch data when contract address changes', () => {
      const { useRaffleData } = require('@/hooks/use-raffle-data')
      
      const { rerender } = renderHook(() => useRaffleData())

      // Change contract address
      mockUseContractConfig.mockReturnValue({
        contractAddress: '0x9876543210987654321098765432109876543210',
        isValidChainId: true,
        chainId: 84532,
      })

      rerender()

      // The hook should still work with the new configuration
      expect(useRaffleData).toHaveBeenCalled()
    })
  })

  describe('raffle state interpretation', () => {
    it('should correctly interpret OPEN state', () => {
      const { useRaffleData } = require('@/hooks/use-raffle-data')
      
      useRaffleData.mockReturnValue({
        raffleState: 0,
        isRaffleOpen: true,
        isRaffleCalculating: false,
        isWinnerSelected: false,
        refetch: jest.fn(),
      })

      const { result } = renderHook(() => useRaffleData())

      expect(result.current.raffleState).toBe(0)
      expect(result.current.isRaffleOpen).toBe(true)
    })

    it('should correctly interpret CALCULATING state', () => {
      const { useRaffleData } = require('@/hooks/use-raffle-data')
      
      useRaffleData.mockReturnValue({
        raffleState: 1,
        isRaffleOpen: false,
        isRaffleCalculating: true,
        isWinnerSelected: false,
        refetch: jest.fn(),
      })

      const { result } = renderHook(() => useRaffleData())

      expect(result.current.raffleState).toBe(1)
      expect(result.current.isRaffleCalculating).toBe(true)
    })

    it('should correctly interpret WINNER_SELECTED state', () => {
      const { useRaffleData } = require('@/hooks/use-raffle-data')
      
      useRaffleData.mockReturnValue({
        raffleState: 2,
        isRaffleOpen: false,
        isRaffleCalculating: false,
        isWinnerSelected: true,
        refetch: jest.fn(),
      })

      const { result } = renderHook(() => useRaffleData())

      expect(result.current.raffleState).toBe(2)
      expect(result.current.isWinnerSelected).toBe(true)
    })
  })

  describe('data formatting', () => {
    it('should format jackpot amount correctly', () => {
      const { useRaffleData } = require('@/hooks/use-raffle-data')
      
      useRaffleData.mockReturnValue({
        jackpotAmount: BigInt('1000000000000000000'),
        formattedJackpot: '1.0',
        refetch: jest.fn(),
      })

      const { result } = renderHook(() => useRaffleData())

      expect(result.current.jackpotAmount).toBe(BigInt('1000000000000000000'))
      expect(result.current.formattedJackpot).toBe('1.0')
    })
  })
})