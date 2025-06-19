# Raffle DApp - Claude Development Guide

**Last Updated**: 2025-06-18

## Project Overview

This is a **multi-chain Raffle DApp** built with **Chainlink VRF**, **Automation**, and **CCIP** for cross-chain functionality. The application allows users to participate in USDC-based raffles across multiple L2 testnets with transparent, verifiable random winner selection.

### Key Features
- **Decentralized Raffle System**: Fully on-chain with Chainlink VRF for provable randomness
- **Multi-chain Support**: Ethereum Sepolia, Base Sepolia, Arbitrum Sepolia
- **Automated Operations**: Chainlink Automation for periodic draws
- **Cross-chain Bridge**: CCIP integration for cross-chain token transfers
- **Upgradeable Contracts**: UUPS proxy pattern for safe upgrades
- **Smart Wallet Integration**: Account Kit and Web3Auth support
- **Gas Optimization**: L2-specific gas handling (critical for Base Sepolia)

## Architecture

### Tech Stack
**Backend (Smart Contracts)**
- **Framework**: Foundry (Forge, Anvil, Cast)
- **Language**: Solidity ^0.8.19
- **Libraries**: OpenZeppelin v5.0.2, Chainlink CCIP v1.6.0
- **Testing**: Forge test suite with unit/integration tests
- **Deployment**: Makefile-based multi-chain deployment

**Frontend (Web Application)**
- **Framework**: Next.js 15 (React 18)
- **Styling**: Tailwind CSS v4.1.5, Radix UI components
- **Web3**: wagmi v2.14.16, viem v2.8.6, ethers.js v5.7.2
- **State Management**: React Hooks + Context API
- **Authentication**: Account Kit (Alchemy), Web3Auth, WalletConnect

**Infrastructure**
- **Containerization**: Docker + Docker Compose
- **Frontend Deployment**: Vercel
- **Contract Verification**: Etherscan, Basescan, Arbiscan
- **RPC Providers**: Alchemy API

### Project Structure
```
Raffle_Dapp/
├── backend/                    # Foundry smart contracts
│   ├── src/                   # Contract source code
│   │   ├── RaffleImplementation.sol      # Main raffle logic
│   │   ├── RaffleProxy.sol              # UUPS proxy
│   │   ├── RaffleBridgeImplementation.sol # CCIP bridge
│   │   └── interfaces/                   # Contract interfaces
│   ├── script/                # Deployment scripts
│   │   ├── RaffleProxyDeployer.s.sol    # Main deployment script
│   │   ├── RaffleUpgrader.s.sol         # Upgrade script
│   │   └── HelperConfig.s.sol           # Network configurations
│   ├── test/                  # Test suite
│   ├── broadcast/             # Deployment logs & addresses
│   ├── Makefile              # Build, test, deploy commands
│   └── foundry.toml          # Foundry configuration
├── frontend/                   # Next.js application
│   ├── app/                   # App router structure
│   │   ├── components/        # React components
│   │   │   ├── raffle/        # Raffle-specific components
│   │   │   ├── admin/         # Admin panel
│   │   │   ├── bridge/        # Cross-chain bridge UI
│   │   │   └── auth/          # Wallet connection
│   │   ├── lib/              # Configuration & utilities
│   │   │   ├── contract-config.ts    # Contract addresses & ABIs
│   │   │   ├── web3-config.ts        # Web3 provider config
│   │   │   └── alchemy/              # Account Kit setup
│   │   └── providers/        # React context providers
│   ├── hooks/                # Custom React hooks
│   │   ├── use-raffle-automation.ts  # VRF automation (gas optimization)
│   │   ├── use-raffle-data.ts       # Contract data fetching
│   │   └── use-smart-account.ts     # Smart wallet integration
│   └── package.json          # Dependencies & scripts
├── scripts/                    # Deployment & maintenance scripts
│   ├── update-contracts.js    # Auto-update contract config
│   └── update-bridge-config.js # Bridge configuration
├── docker-compose.yml         # Development environment
├── package.json              # Root package configuration
└── CLAUDE.md                 # This file
```

## Development Setup

### Prerequisites
- **Docker & Docker Compose** (recommended for local development)
- **Node.js** v18+ (if running without Docker)
- **Foundry** (if running backend locally)

### Quick Start with Docker
```bash
# Clone and navigate to project
cd /path/to/Raffle_Dapp

# Start development environment
docker-compose up

# Access services
# Frontend: http://localhost:3000
# Backend (Anvil): http://localhost:8545
```

### Environment Variables
Create `.env` files as needed:
```bash
# Backend (.env in backend/ directory)
PRIVATE_KEY=your_private_key
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-key
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/your-key
ARBITRUM_SEPOLIA_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/your-key
ETHERSCAN_API_KEY=your_etherscan_key
BASE_API_KEY=your_basescan_key
ARBISCAN_API_KEY=your_arbiscan_key

# Frontend (.env.local in frontend/ directory)
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_id
```

## Common Development Commands

### Backend (Foundry)
```bash
# Enter backend container
docker-compose exec backend sh

# Or use Makefile commands from project root
cd backend/

# Install dependencies
make install

# Build contracts
make build

# Run all tests
make test

# Run unit tests only
make test-unit

# Run with verbose output
forge test -vvv

# Deploy to all testnets
make deploy-raffle-proxy

# Deploy to specific network
make deploy-raffle-proxy-sepolia
make deploy-raffle-proxy-base
make deploy-raffle-proxy-arb

# Upgrade contracts on all networks
make upgrade-raffle

# Update frontend config after deployment
make update-frontend

# Format code
make format

# Local development with Anvil
make anvil                    # Start local chain
make deploy-anvil            # Deploy to local chain
```

### Frontend (Next.js)
```bash
# Enter frontend container
docker-compose exec frontend sh

# Or run locally
cd frontend/

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Update contract configuration (from project root)
npm run update-contracts
```

### Deployment Workflow
```bash
# 1. Deploy contracts to all testnets
cd backend && make deploy-raffle-proxy

# 2. Update frontend configuration
cd .. && npm run update-contracts

# 3. Verify contracts (optional)
cd backend && make verify-sepolia verify-base-sepolia verify-arb-sepolia
```

## Contract Configuration

### Network Details
```typescript
// Contract addresses are auto-managed in frontend/app/lib/contract-config.ts
export const contractConfig = {
  11155111: {  // Ethereum Sepolia
    name: "Ethereum Sepolia",
    raffleProxy: "0x...",
    erc20Address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC
    blockExplorer: "https://sepolia.etherscan.io"
  },
  84532: {     // Base Sepolia
    name: "Base Sepolia", 
    raffleProxy: "0x...",
    erc20Address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC
    blockExplorer: "https://sepolia.basescan.org"
  },
  421614: {    // Arbitrum Sepolia
    name: "Arbitrum Sepolia",
    raffleProxy: "0x...",
    erc20Address: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", // USDC
    blockExplorer: "https://sepolia-explorer.arbitrum.io"
  }
};
```

### Key Contract Functions
- `enterRaffle(uint256 amount)` - Enter raffle with USDC
- `performUpkeep(bytes calldata)` - Chainlink automation trigger
- `fulfillRandomWords(uint256, uint256[])` - VRF callback
- `processWinner()` - Finalize winner selection
- `addMockPlayer(address)` - Admin function for testing
- `resetPlayers()` - Admin function to reset state

## Critical Implementation Details

### Gas Optimization for L2 Networks

**IMPORTANT**: Base Sepolia requires special gas handling due to dual fee structure (L2 execution + L1 data availability).

Located in `frontend/hooks/use-raffle-automation.ts`:
```typescript
// Base Sepolia gas optimization (chainId 84532)
if (chainId === 84532) {
  console.log("Base Sepolia: ガス設定を最適化");
  try {
    const gasEstimate = await publicClient.estimateContractGas({
      address: contractAddress as `0x${string}`,
      abi: RaffleABI,
      functionName: "performUpkeep",
      args: ["0x"],
      account: address,
    });
    // 30% gas buffer for L1 data availability fee volatility
    txParams.gas = gasEstimate + (gasEstimate * BigInt(30)) / BigInt(100);
  } catch (gasError) {
    console.warn("ガス估算エラー - デフォルト値を使用:", gasError);
    txParams.gas = BigInt(2500000); // Base Sepolia VRF max gas limit
  }
}
```

**Why this is critical**: Without proper gas optimization, `performUpkeep` calls revert on Base Sepolia due to insufficient gas for L1 data posting costs.

### Smart Contract Proxy Pattern

Uses **UUPS (Universal Upgradeable Proxy Standard)** pattern:
- `RaffleProxy.sol` - Proxy contract (never changes address)
- `RaffleImplementation.sol` - Logic contract (upgradeable)
- Upgrades via `upgradeTo(address newImplementation)`

### Chainlink Integration

**VRF (Verifiable Random Function)**:
- Subscription-based VRF 2.5
- Configured per network in `HelperConfig.s.sol`
- Random words fulfill winner selection

**Automation (Keepers)**:
- Upkeep conditions check raffle state
- Automatically triggers `performUpkeep` when conditions met
- Gas-optimized for each L2 network

## Key Frontend Hooks

### Core Raffle Functionality
- `use-raffle-data.ts` - Contract state reading (players, status, jackpot)
- `use-raffle-participation.ts` - Enter/exit raffle operations
- `use-raffle-automation.ts` - **Critical**: VRF automation with L2 gas optimization
- `use-auto-winner-processor.ts` - Automatic winner processing on state change

### Wallet & Account Management
- `use-smart-account.ts` - Account Kit integration for smart wallets
- `use-web3auth.ts` - Web3Auth social login integration
- `use-wallet-balances.ts` - USDC and ETH balance tracking

### Cross-chain Features
- `use-token-bridge.ts` - CCIP cross-chain token transfers
- `use-contract-balance.ts` - Multi-chain contract balance monitoring

## Testing

### Backend Tests
```bash
# Unit tests
forge test --match-path "test/unit/**" -vvv

# Integration tests  
forge test --match-path "test/integration/**" -vvv

# Test coverage
forge coverage

# Gas reporting
forge test --gas-report
```

### Frontend Testing
Currently no formal test suite. Manual testing workflow:
1. Connect wallet on each supported network
2. Enter raffle with various USDC amounts
3. Trigger automation (admin panel)
4. Verify winner selection and prize distribution
5. Test cross-chain bridge functionality

## Deployment & Upgrades

### Initial Deployment
```bash
# Deploy proxies to all testnets and update frontend
make deploy-raffle-proxy-with-update

# Or deploy to specific network
make deploy-raffle-proxy-sepolia
make update-frontend
```

### Contract Upgrades
```bash
# Upgrade implementations on all networks
make upgrade-raffle

# Upgrade with initialization data
make upgrade-raffle-with-data

# Update frontend ABI only (for upgrades)
make update-frontend-upgrade
```

### Verification
```bash
# Verify on all networks
make verify-sepolia verify-base-sepolia verify-arb-sepolia
```

## Troubleshooting

### Common Issues

1. **Base Sepolia `performUpkeep` Reverts**
   - **Solution**: Ensure gas optimization is implemented in `use-raffle-automation.ts`
   - **Root Cause**: L2 networks have dual fee structure requiring gas buffers

2. **Contract Address Mismatch**
   - **Solution**: Run `npm run update-contracts` after deployment
   - **Location**: Check `frontend/app/lib/contract-config.ts`

3. **VRF Subscription Issues**
   - **Solution**: Verify subscription has sufficient LINK balance
   - **Check**: Chainlink VRF subscription manager

4. **Smart Wallet Connection Fails**
   - **Solution**: Verify Account Kit configuration in `frontend/app/lib/alchemy/`
   - **Common**: API key or network mismatch

### Debug Commands
```bash
# Check contract deployment status
cd backend && ls broadcast/RaffleProxyDeployer.s.sol/*/

# View deployment logs
cat backend/broadcast/RaffleProxyDeployer.s.sol/84532/run-latest.json

# Check frontend config
cat frontend/app/lib/contract-config.ts

# Docker container logs
docker-compose logs frontend
docker-compose logs backend
```

## Important Files to Monitor

### Configuration Files
- `frontend/app/lib/contract-config.ts` - **Auto-generated**: Contract addresses & ABIs
- `backend/script/HelperConfig.s.sol` - Network-specific configurations
- `backend/foundry.toml` - Foundry build settings
- `docker-compose.yml` - Development environment config

### Key Deployment Files
- `backend/script/RaffleProxyDeployer.s.sol` - Main deployment script
- `scripts/update-contracts.js` - Auto-updates frontend config from deployments
- `backend/broadcast/` - Deployment logs with contract addresses

### Critical Frontend Components
- `hooks/use-raffle-automation.ts` - **Contains gas optimization fixes**
- `components/admin/owner-admin-panel.tsx` - Contract management interface
- `app/lib/web3-config.ts` - Wagmi/Web3 provider configuration

## Development Notes

### Code Conventions
- **Solidity**: Follow OpenZeppelin patterns, extensive NatSpec comments
- **TypeScript**: Strict typing, descriptive function/variable names
- **React**: Custom hooks for contract interactions, component composition
- **Styling**: Tailwind utility classes, Radix UI for complex components

### Security Considerations
- All contracts use OpenZeppelin's security patterns
- UUPS proxy pattern with proper access controls
- VRF provides cryptographic randomness
- Multi-sig recommended for production owner roles

### Performance Optimizations
- Gas optimization for L2 networks (implemented)
- Contract state reading batched where possible
- Frontend React.memo for expensive components
- Image optimization via Next.js

---

## Quick Reference

**Start Development**: `docker-compose up`
**Deploy All Networks**: `cd backend && make deploy-raffle-proxy-with-update`
**Update Config**: `npm run update-contracts`
**Run Tests**: `cd backend && make test`
**View Logs**: `docker-compose logs [frontend|backend]`

**Critical Issue Solved**: Base Sepolia gas optimization in `use-raffle-automation.ts:133-145`

This guide should provide comprehensive context for future development work on the Raffle DApp. The project successfully implements a sophisticated multi-chain raffle system with proper L2 optimizations and modern Web3 UX patterns.