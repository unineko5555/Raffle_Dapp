-include .env

.PHONY: all test clean deploy-sepolia deploy-base-sepolia deploy-arb-sepolia deploy-sepolia-with-update deploy-base-sepolia-with-update deploy-arb-sepolia-with-update deploy-all deploy-all-with-update update-frontend help check-env format anvil install

help:
	@echo "Usage:"
	@echo "  make install                      - Install dependencies"
	@echo "  make build                        - Build the project"
	@echo "  make test                         - Run all tests"
	@echo "  make test-unit                    - Run unit tests only"
	@echo "  make test-integration             - Run integration tests only"
	@echo "  make anvil                        - Run Anvil local chain"
	@echo "  make deploy-anvil                 - Deploy to Anvil local chain"
	@echo "  make deploy-sepolia               - Deploy to Ethereum Sepolia testnet"
	@echo "  make deploy-base-sepolia          - Deploy to Base Sepolia testnet"
	@echo "  make deploy-arb-sepolia           - Deploy to Arbitrum Sepolia testnet"
	@echo "  make deploy-sepolia-with-update   - Deploy to Sepolia and update frontend config"
	@echo "  make deploy-base-sepolia-with-update - Deploy to Base Sepolia and update frontend config"
	@echo "  make deploy-arb-sepolia-with-update  - Deploy to Arbitrum Sepolia and update frontend config"
	@echo "  make deploy-all                   - Deploy to all testnets"
	@echo "  make deploy-all-with-update       - Deploy to all testnets and update frontend config"
	@echo "  make update-frontend              - Update frontend contract configuration"
	@echo "  make verify-sepolia               - Verify contracts on Ethereum Sepolia"
	@echo "  make verify-base-sepolia          - Verify contracts on Base Sepolia"
	@echo "  make verify-arb-sepolia           - Verify contracts on Arbitrum Sepolia"
	@echo "  make format                       - Format code with forge fmt"
	@echo "  make clean                        - Clean build artifacts"

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
	forge script script/DeployRaffle.s.sol:DeployRaffle --rpc-url http://localhost:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# ==============================================================================
# Testnet Deployments
# ==============================================================================

check-env:
	@if [ -z "$(PRIVATE_KEY)" ]; then echo "PRIVATE_KEY is not set"; exit 1; fi

update-frontend:
	@echo "Updating frontend contract configuration..."
	cd .. && npm run update-contracts

deploy-sepolia: check-env
	@echo "Deploying to Ethereum Sepolia testnet..."
	forge script script/DeployRaffle.s.sol:DeployRaffle --rpc-url $(SEPOLIA_RPC_URL) --private-key $(PRIVATE_KEY) --broadcast --verify --etherscan-api-key $(ETHERSCAN_API_KEY)

deploy-sepolia-with-update: deploy-sepolia update-frontend

deploy-base-sepolia: check-env
	@echo "Deploying to Base Sepolia testnet..."
	forge script script/DeployRaffle.s.sol:DeployRaffle --rpc-url $(BASE_SEPOLIA_RPC_URL) --private-key $(PRIVATE_KEY) --broadcast --verify --etherscan-api-key $(BASE_API_KEY)

deploy-base-sepolia-with-update: deploy-base-sepolia update-frontend

deploy-arb-sepolia: check-env
	@echo "Deploying to Arbitrum Sepolia testnet..."
	forge script script/DeployRaffle.s.sol:DeployRaffle --rpc-url $(ARBITRUM_SEPOLIA_RPC_URL) --private-key $(PRIVATE_KEY) --broadcast --verify --etherscan-api-key $(ARBISCAN_API_KEY)

deploy-arb-sepolia-with-update: deploy-arb-sepolia update-frontend

deploy-all: deploy-sepolia deploy-base-sepolia deploy-arb-sepolia

deploy-all-with-update: deploy-all update-frontend

# ==============================================================================
# Contract Verification
# ==============================================================================

verify-sepolia:
	@echo "Verifying contracts on Ethereum Sepolia..."
	forge verify-contract $(RAFFLE_IMPLEMENTATION_ADDRESS) src/RaffleImplementation.sol:RaffleImplementation --chain sepolia --etherscan-api-key $(ETHERSCAN_API_KEY)
	forge verify-contract $(RAFFLE_PROXY_ADDRESS) src/RaffleProxy.sol:RaffleProxy --chain sepolia --etherscan-api-key $(ETHERSCAN_API_KEY)

verify-base-sepolia:
	@echo "Verifying contracts on Base Sepolia..."
	forge verify-contract $(RAFFLE_IMPLEMENTATION_ADDRESS_BASE) src/RaffleImplementation.sol:RaffleImplementation --chain base-sepolia --etherscan-api-key $(BASE_API_KEY)
	forge verify-contract $(RAFFLE_PROXY_ADDRESS_BASE) src/RaffleProxy.sol:RaffleProxy --chain base-sepolia --etherscan-api-key $(BASE_API_KEY)

verify-arb-sepolia:
	@echo "Verifying contracts on Arbitrum Sepolia..."
	forge verify-contract $(RAFFLE_IMPLEMENTATION_ADDRESS_ARB) src/RaffleImplementation.sol:RaffleImplementation --chain arbitrum-sepolia --etherscan-api-key $(ARBISCAN_API_KEY)
	forge verify-contract $(RAFFLE_PROXY_ADDRESS_ARB) src/RaffleProxy.sol:RaffleProxy --chain arbitrum-sepolia --etherscan-api-key $(ARBISCAN_API_KEY)
