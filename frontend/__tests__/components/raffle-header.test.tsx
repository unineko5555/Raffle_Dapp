import React from 'react'
import { render, screen } from '../utils/test-utils'
import { RaffleHeader } from '@/app/components/raffle/raffle-header'

// Mock the dependencies
jest.mock('@/hooks/use-raffle-data')
jest.mock('@/hooks/shared/use-contract-config')

describe('RaffleHeader', () => {
  const mockUseRaffleData = require('@/hooks/use-raffle-data').useRaffleData
  const mockUseContractConfig = require('@/hooks/shared/use-contract-config').useContractConfig

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default mock setup
    mockUseContractConfig.mockReturnValue({
      isValidChainId: true,
      chainName: 'Ethereum Sepolia',
      chainId: 11155111,
      networkConfig: {
        name: 'Ethereum Sepolia',
        erc20Address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        blockExplorer: 'https://sepolia.etherscan.io',
      },
    })

    mockUseRaffleData.mockReturnValue({
      raffleState: 0, // OPEN
      numberOfPlayers: 3,
      jackpotAmount: BigInt('1000000000000000000'), // 1 ETH
      formattedJackpot: '1.0',
      isLoading: false,
      isError: false,
    })
  })

  describe('rendering', () => {
    it('should render raffle title', () => {
      render(<RaffleHeader />)
      
      expect(screen.getByText(/進行中のラッフル/i)).toBeInTheDocument()
    })

    it('should display active status', () => {
      render(<RaffleHeader />)
      
      expect(screen.getByText(/アクティブ/i)).toBeInTheDocument()
    })

    it('should show contract verification status', () => {
      render(<RaffleHeader />)
      
      expect(screen.getByText(/スマートコントラクト検証済み/i)).toBeInTheDocument()
    })
  })

  describe('component structure', () => {
    it('should render without crashing', () => {
      const { container } = render(<RaffleHeader />)
      
      expect(container.firstChild).toBeInTheDocument()
    })

    it('should have proper class structure', () => {
      const { container } = render(<RaffleHeader />)
      
      expect(container.querySelector('.flex')).toBeInTheDocument()
    })
  })

  describe('different states', () => {
    it('should render correctly with different raffle data', () => {
      mockUseRaffleData.mockReturnValue({
        raffleState: 1, // CALCULATING
        numberOfPlayers: 5,
        jackpotAmount: BigInt('2000000000000000000'),
        formattedJackpot: '2.0',
        isLoading: false,
        isError: false,
      })

      render(<RaffleHeader />)
      
      // Should still show basic elements
      expect(screen.getByText(/進行中のラッフル/i)).toBeInTheDocument()
      expect(screen.getByText(/アクティブ/i)).toBeInTheDocument()
    })

    it('should handle loading state', () => {
      mockUseRaffleData.mockReturnValue({
        raffleState: null,
        numberOfPlayers: null,
        jackpotAmount: null,
        formattedJackpot: null,
        isLoading: true,
        isError: false,
      })

      render(<RaffleHeader />)
      
      // Should still render basic structure
      expect(screen.getByText(/進行中のラッフル/i)).toBeInTheDocument()
    })

    it('should handle error state', () => {
      mockUseRaffleData.mockReturnValue({
        raffleState: null,
        numberOfPlayers: null,
        jackpotAmount: null,
        formattedJackpot: null,
        isLoading: false,
        isError: true,
      })

      render(<RaffleHeader />)
      
      // Should still render basic structure
      expect(screen.getByText(/進行中のラッフル/i)).toBeInTheDocument()
    })
  })

  describe('network handling', () => {
    it('should handle invalid chain', () => {
      mockUseContractConfig.mockReturnValue({
        isValidChainId: false,
        chainName: null,
        chainId: null,
        networkConfig: null,
      })

      render(<RaffleHeader />)
      
      // Should still render basic structure
      expect(screen.getByText(/進行中のラッフル/i)).toBeInTheDocument()
    })

    it('should handle different networks', () => {
      mockUseContractConfig.mockReturnValue({
        isValidChainId: true,
        chainName: 'Base Sepolia',
        chainId: 84532,
        networkConfig: {
          name: 'Base Sepolia',
          erc20Address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
          blockExplorer: 'https://sepolia.basescan.org',
        },
      })

      render(<RaffleHeader />)
      
      // Should render basic elements regardless of network
      expect(screen.getByText(/進行中のラッフル/i)).toBeInTheDocument()
      expect(screen.getByText(/アクティブ/i)).toBeInTheDocument()
    })
  })
})