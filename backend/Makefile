-include .env

.PHONY: all test clean deploy-sepolia deploy-mumbai deploy-arbitrum deploy-optimism deploy-base help check-env format anvil install

help:
	@echo "Usage:"
	@echo "  make install             - Install dependencies"
	@echo "  make build               - Build the project"
	@echo "  make test                - Run all tests"
	@echo "  make test-unit           - Run unit tests only"
	@echo "  make test-integration    - Run integration tests only"
	@echo "  make anvil               - Run Anvil local chain"
	@echo "  make deploy-anvil        - Deploy to Anvil local chain"
	@echo "  make deploy-sepolia      - Deploy to Ethereum Sepolia testnet"
	@echo "  make deploy-mumbai       - Deploy to Polygon Mumbai testnet"
	@echo "  make deploy-arbitrum     - Deploy to Arbitrum Sepolia testnet"
	@echo "  make deploy-optimism     - Deploy to Optimism Goerli testnet"
	@echo "  make deploy-base         - Deploy to Base Sepolia testnet"
	@echo "  make verify-sepolia      - Verify contracts on Ethereum Sepolia"
	@echo "  make format              - Format code with forge fmt"
	@echo "  make clean               - Clean build artifacts"

all: clean install build test

# ==============================================================================
# Dependencies & Setup
# ==============================================================================

install:
	@echo "Installing dependencies..."
	forge install

build:
	@echo "Building contracts..."
	forge build

clean:
	@echo "Cleaning build artifacts..."
	forge clean

format:
	@echo "Formatting code..."
	forge fmt

# ==============================================================================
# Test Tasks
# ==============================================================================

test:
	@echo "Running all tests..."
	forge test -vvv

test-unit:
	@echo "Running unit tests..."
	forge test --match-path "test/unit/**" -vvv

test-integration:
	@echo "Running integration tests..."
	forge test --match-path "test/integration/**" -vvv

test-coverage:
	@echo "Running test coverage..."
	forge coverage

# ==============================================================================
# Local Development
# ==============================================================================

anvil:
	@echo "Starting Anvil local chain..."
	anvil

deploy-anvil:
	@echo "Deploying to Anvil local chain..."
	forge script script/DeployRaffle.s.sol:DeployRaffle --rpc-url http://localhost:8545 --broadcast

# ==============================================================================
# Testnet Deployments
# ==============================================================================

check-env:
	@if [ -z "$(PRIVATE_KEY)" ]; then echo "PRIVATE_KEY is not set"; exit 1; fi

deploy-sepolia: check-env
	@echo "Deploying to Ethereum Sepolia testnet..."
	forge script script/DeployRaffle.s.sol:DeployRaffle --rpc-url $(SEPOLIA_RPC_URL) --broadcast --verify --etherscan-api-key $(ETHERSCAN_API_KEY)

deploy-mumbai: check-env
	@echo "Deploying to Polygon Mumbai testnet..."
	forge script script/DeployRaffle.s.sol:DeployRaffle --rpc-url $(MUMBAI_RPC_URL) --broadcast --verify --etherscan-api-key $(POLYGONSCAN_API_KEY)

deploy-arbitrum: check-env
	@echo "Deploying to Arbitrum Sepolia testnet..."
	forge script script/DeployRaffle.s.sol:DeployRaffle --rpc-url $(ARBITRUM_SEPOLIA_RPC_URL) --broadcast --verify --etherscan-api-key $(ARBISCAN_API_KEY)

deploy-optimism: check-env
	@echo "Deploying to Optimism Goerli testnet..."
	forge script script/DeployRaffle.s.sol:DeployRaffle --rpc-url $(OPTIMISM_GOERLI_RPC_URL) --broadcast --verify --etherscan-api-key $(OPTIMISM_API_KEY)

deploy-base: check-env
	@echo "Deploying to Base Sepolia testnet..."
	forge script script/DeployRaffle.s.sol:DeployRaffle --rpc-url $(BASE_SEPOLIA_RPC_URL) --broadcast --verify --etherscan-api-key $(BASE_API_KEY)

# ==============================================================================
# Contract Verification
# ==============================================================================

verify-sepolia:
	@echo "Verifying contracts on Ethereum Sepolia..."
	forge verify-contract $(RAFFLE_IMPLEMENTATION_ADDRESS) src/RaffleImplementation.sol:RaffleImplementation --chain sepolia --etherscan-api-key $(ETHERSCAN_API_KEY)
	forge verify-contract $(RAFFLE_PROXY_ADDRESS) src/RaffleProxy.sol:RaffleProxy --chain sepolia --etherscan-api-key $(ETHERSCAN_API_KEY)
