# Raffle DApp Backend

Cross-chain raffle DApp backend built with Foundry and Chainlink CCIP.

## Quick Start

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed
- Node.js 18+ (for frontend integration)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd Raffle_Dapp/backend

# Install all dependencies
make install

# Build contracts
make build

# Run tests
make test
```

## Dependencies

This project uses the following dependencies (automatically installed with `make install`):

- **Forge Standard Library** (`forge-std@v1.8.2`): Testing utilities
- **OpenZeppelin Contracts** (`@openzeppelin/contracts@v5.0.2`): Secure contract standards
- **Chainlink CCIP** (`@chainlink/contracts-ccip@v1.6.0`): Cross-chain interoperability

### Manual Dependency Installation

If you prefer to install dependencies manually:

```bash
# Install each dependency
forge install foundry-rs/forge-std@v1.8.2 --no-commit
forge install OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-commit
forge install smartcontractkit/chainlink-ccip@contracts-ccip-v1.6.0 --no-commit
```

## Project Structure

```
backend/
├── src/                          # Smart contracts
│   ├── RaffleImplementation.sol  # Main raffle contract
│   ├── RaffleBridgeImplementation.sol  # CCIP bridge contract
│   ├── RaffleProxy.sol           # UUPS proxy
│   └── interfaces/               # Contract interfaces
├── test/                         # Test files
├── script/                       # Deployment scripts
├── foundry.toml                  # Foundry configuration
├── Makefile                      # Build automation
└── README.md                     # This file
```

## Configuration

### foundry.toml

The project configuration includes:

- **Remappings**: Automatic path resolution for dependencies
- **Optimization**: Enabled with 200 runs
- **Dependencies**: Declared for automatic installation

### Environment Variables

Create a `.env` file in the backend directory:

```bash
# Required for deployments
PRIVATE_KEY=your_private_key_here
SEPOLIA_RPC_URL=your_sepolia_rpc_url
BASE_SEPOLIA_RPC_URL=your_base_sepolia_rpc_url
ARBITRUM_SEPOLIA_RPC_URL=your_arbitrum_sepolia_rpc_url

# API Keys for verification
ETHERSCAN_API_KEY=your_etherscan_api_key
BASE_API_KEY=your_base_api_key
ARBISCAN_API_KEY=your_arbiscan_api_key
```

## Available Commands

### Development

```bash
make install          # Install all dependencies
make build            # Compile contracts
make test             # Run all tests
make test-unit        # Run unit tests only
make format           # Format code
make clean            # Clean build artifacts
```

### Deployment

```bash
# Deploy to all testnets
make deploy-raffle-proxy
make deploy-bridge-proxy

# Deploy to specific networks
make deploy-raffle-proxy-sepolia
make deploy-bridge-proxy-base
```

### Upgrades

```bash
# Upgrade implementations
make upgrade-raffle
make upgrade-bridge-proxy
```

## Troubleshooting

### Common Issues

1. **Build Errors**: Run `make clean && make install && make build`
2. **Dependency Issues**: Check that all dependencies are correctly installed
3. **Remapping Errors**: Verify `foundry.toml` remappings are correct

### Dependency Verification

To verify dependencies are correctly installed:

```bash
# Check if libraries exist
ls lib/
# Should show: forge-std, openzeppelin-contracts, chainlink-ccip

# Test compilation
make build
```

## Architecture

This project implements a cross-chain raffle system using:

- **UUPS Proxy Pattern**: Upgradeable contracts
- **Chainlink CCIP**: Cross-chain communication
- **Pool-based Bridge**: Efficient token transfers
- **Multi-chain Deployment**: Support for Ethereum, Base, and Arbitrum

For more details, see the contract documentation in `/src`.
