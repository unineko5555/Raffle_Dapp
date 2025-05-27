-include .env

.PHONY: all test clean deploy-raffle-proxy-sepolia deploy-raffle-proxy-base deploy-raffle-proxy-arb deploy-raffle-proxy deploy-raffle-proxy-with-update update-frontend deploy-bridge-proxy update-bridge update-bridge-addresses deploy-proxy-and-update-bridge-full help check-env format anvil install

help:
	@echo "Usage:"
	@echo "  make install                      - Install dependencies"
	@echo "  make build                        - Build the project"
	@echo "  make test                         - Run all tests"
	@echo "  make test-unit                    - Run unit tests only"
	@echo "  make test-integration             - Run integration tests only"
	@echo "  make anvil                        - Run Anvil local chain"
	@echo "  make deploy-anvil                 - Deploy to Anvil local chain"
	@echo "  make deploy-raffle-proxy-sepolia  - Deploy Raffle Proxy to Ethereum Sepolia"
	@echo "  make deploy-raffle-proxy-base     - Deploy Raffle Proxy to Base Sepolia"
	@echo "  make deploy-raffle-proxy-arb      - Deploy Raffle Proxy to Arbitrum Sepolia"
	@echo "  make deploy-raffle-proxy          - Deploy Raffle Proxy to all testnets"
	@echo "  make deploy-raffle-proxy-with-update - Deploy Raffle Proxy and update frontend"
	@echo "  make update-frontend              - Update frontend contract configuration"
	@echo "  make deploy-bridge-proxy          - Deploy bridge proxy contracts to all testnets"
	@echo "  make deploy-bridge-proxy-sepolia  - Deploy bridge proxy to Ethereum Sepolia"
	@echo "  make deploy-bridge-proxy-base     - Deploy bridge proxy to Base Sepolia"
	@echo "  make deploy-bridge-proxy-arb      - Deploy bridge proxy to Arbitrum Sepolia"
	@echo "  make update-bridge                - Update bridge contract configuration"
	@echo "  make update-bridge-addresses      - Update bridge destination addresses across networks"
	@echo "  make deploy-proxy-and-update-bridge-full - Deploy bridge proxy, update addresses and configuration"
	@echo "  make upgrade-bridge-proxy         - Upgrade bridge proxy implementation on all networks"
	@echo "  make upgrade-bridge-proxy-sepolia - Upgrade bridge proxy on Ethereum Sepolia"
	@echo "  make upgrade-bridge-proxy-base    - Upgrade bridge proxy on Base Sepolia"
	@echo "  make upgrade-bridge-proxy-arb     - Upgrade bridge proxy on Arbitrum Sepolia"
	@echo "  make upgrade-bridge-proxy-with-data - Upgrade bridge proxy with data on all networks"
	@echo "  make upgrade-raffle               - Upgrade Raffle implementation on all networks"
	@echo "  make upgrade-raffle-sepolia       - Upgrade Raffle on Ethereum Sepolia"
	@echo "  make upgrade-raffle-base          - Upgrade Raffle on Base Sepolia"
	@echo "  make upgrade-raffle-arb           - Upgrade Raffle on Arbitrum Sepolia"
	@echo "  make upgrade-raffle-with-data     - Upgrade Raffle with data on all networks"
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
	forge script script/RaffleProxyDeployer.s.sol:DeployRaffle --rpc-url http://localhost:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# ==============================================================================
# Raffle Proxy Deployments
# ==============================================================================

check-env:
	@if [ -z "$(PRIVATE_KEY)" ]; then echo "PRIVATE_KEY is not set"; exit 1; fi

update-frontend:
	@echo "Updating frontend contract configuration..."
	cd .. && npm run update-contracts

update-frontend-upgrade:
	@echo "Updating frontend contract configuration (ABI only)..."
	cd .. && npm run update-contracts-upgrade

deploy-raffle-proxy-sepolia: check-env
	@echo "Deploying Raffle Proxy to Ethereum Sepolia testnet..."
	forge script script/RaffleProxyDeployer.s.sol:DeployRaffle --rpc-url $(SEPOLIA_RPC_URL) --private-key $(PRIVATE_KEY) --broadcast --verify --etherscan-api-key $(ETHERSCAN_API_KEY)

deploy-raffle-proxy-base: check-env
	@echo "Deploying Raffle Proxy to Base Sepolia testnet..."
	forge script script/RaffleProxyDeployer.s.sol:DeployRaffle --rpc-url $(BASE_SEPOLIA_RPC_URL) --private-key $(PRIVATE_KEY) --broadcast --verify --etherscan-api-key $(BASE_API_KEY)

deploy-raffle-proxy-arb: check-env
	@echo "Deploying Raffle Proxy to Arbitrum Sepolia testnet..."
	forge script script/RaffleProxyDeployer.s.sol:DeployRaffle --rpc-url $(ARBITRUM_SEPOLIA_RPC_URL) --private-key $(PRIVATE_KEY) --broadcast --verify --etherscan-api-key $(ARBISCAN_API_KEY)

deploy-raffle-proxy: deploy-raffle-proxy-sepolia deploy-raffle-proxy-base deploy-raffle-proxy-arb

deploy-raffle-proxy-with-update: deploy-raffle-proxy update-frontend

# ==============================================================================
# Bridge Proxy Deployment
# ==============================================================================

deploy-bridge-proxy-sepolia: check-env
	@echo "Deploying Bridge Proxy to Ethereum Sepolia testnet..."
	ETH_GAS_PRICE=50000000000 forge script script/RaffleBridgeProxyDeployer.s.sol:RaffleBridgeProxyDeployer --rpc-url $(SEPOLIA_RPC_URL) --private-key 0x$(PRIVATE_KEY) --broadcast -vvvv

deploy-bridge-proxy-base: check-env
	@echo "Deploying Bridge Proxy to Base Sepolia testnet..."
	forge script script/RaffleBridgeProxyDeployer.s.sol:RaffleBridgeProxyDeployer --rpc-url $(BASE_SEPOLIA_RPC_URL) --private-key 0x$(PRIVATE_KEY) --broadcast -vvvv

deploy-bridge-proxy-arb: check-env
	@echo "Deploying Bridge Proxy to Arbitrum Sepolia testnet..."
	forge script script/RaffleBridgeProxyDeployer.s.sol:RaffleBridgeProxyDeployer --rpc-url $(ARBITRUM_SEPOLIA_RPC_URL) --private-key 0x$(PRIVATE_KEY) --broadcast -vvvv

deploy-bridge-proxy: deploy-bridge-proxy-sepolia deploy-bridge-proxy-base deploy-bridge-proxy-arb

update-bridge:
	@echo "Updating bridge contract configuration..."
	cd .. && node scripts/update-bridge-config.js

update-bridge-addresses: check-env
	@echo "Updating bridge destination addresses across all networks..."
	cd .. && PRIVATE_KEY=$(PRIVATE_KEY) SEPOLIA_RPC_URL=$(SEPOLIA_RPC_URL) BASE_SEPOLIA_RPC_URL=$(BASE_SEPOLIA_RPC_URL) ARBITRUM_SEPOLIA_RPC_URL=$(ARBITRUM_SEPOLIA_RPC_URL) node scripts/update-bridge-address.js

deploy-proxy-and-update-bridge-full: deploy-bridge-proxy update-bridge-addresses update-bridge

# ==============================================================================
# Bridge Upgrade
# ==============================================================================

upgrade-bridge-proxy-sepolia: check-env
	@echo "Upgrading Bridge Proxy on Ethereum Sepolia testnet..."
	BRIDGE_PROXY_ADDRESS=$(BRIDGE_PROXY_ADDRESS) forge script script/RaffleBridgeUpgrader.s.sol:RaffleBridgeUpgrader --rpc-url $(SEPOLIA_RPC_URL) --private-key 0x$(PRIVATE_KEY) --broadcast -vvvv

upgrade-bridge-proxy-base: check-env
	@echo "Upgrading Bridge Proxy on Base Sepolia testnet..."
	BRIDGE_PROXY_ADDRESS=$(BRIDGE_PROXY_ADDRESS_BASE) forge script script/RaffleBridgeUpgrader.s.sol:RaffleBridgeUpgrader --rpc-url $(BASE_SEPOLIA_RPC_URL) --private-key 0x$(PRIVATE_KEY) --broadcast -vvvv

upgrade-bridge-proxy-arb: check-env
	@echo "Upgrading Bridge Proxy on Arbitrum Sepolia testnet..."
	BRIDGE_PROXY_ADDRESS=$(BRIDGE_PROXY_ADDRESS_ARB) forge script script/RaffleBridgeUpgrader.s.sol:RaffleBridgeUpgrader --rpc-url $(ARBITRUM_SEPOLIA_RPC_URL) --private-key 0x$(PRIVATE_KEY) --broadcast -vvvv

upgrade-bridge-proxy: upgrade-bridge-proxy-sepolia upgrade-bridge-proxy-base upgrade-bridge-proxy-arb update-bridge-implementation-config

upgrade-bridge-proxy-with-data-sepolia: check-env
	@echo "Upgrading Bridge Proxy with data on Ethereum Sepolia testnet..."
	BRIDGE_PROXY_ADDRESS=$(BRIDGE_PROXY_ADDRESS) forge script script/RaffleBridgeUpgrader.s.sol:RaffleBridgeUpgrader --sig "upgradeWithData()" --rpc-url $(SEPOLIA_RPC_URL) --private-key 0x$(PRIVATE_KEY) --broadcast -vvvv

upgrade-bridge-proxy-with-data-base: check-env
	@echo "Upgrading Bridge Proxy with data on Base Sepolia testnet..."
	BRIDGE_PROXY_ADDRESS=$(BRIDGE_PROXY_ADDRESS_BASE) forge script script/RaffleBridgeUpgrader.s.sol:RaffleBridgeUpgrader --sig "upgradeWithData()" --rpc-url $(BASE_SEPOLIA_RPC_URL) --private-key 0x$(PRIVATE_KEY) --broadcast -vvvv

upgrade-bridge-proxy-with-data-arb: check-env
	@echo "Upgrading Bridge Proxy with data on Arbitrum Sepolia testnet..."
	BRIDGE_PROXY_ADDRESS=$(BRIDGE_PROXY_ADDRESS_ARB) forge script script/RaffleBridgeUpgrader.s.sol:RaffleBridgeUpgrader --sig "upgradeWithData()" --rpc-url $(ARBITRUM_SEPOLIA_RPC_URL) --private-key 0x$(PRIVATE_KEY) --broadcast -vvvv

upgrade-bridge-proxy-with-data: upgrade-bridge-proxy-with-data-sepolia upgrade-bridge-proxy-with-data-base upgrade-bridge-proxy-with-data-arb update-bridge-implementation-config

# Bridge implementation update after upgrade
update-bridge-implementation-config:
	@echo "Updating bridge implementation configuration..."
	cd .. && node scripts/update-bridge-config.js

# ==============================================================================
# Raffle Upgrade
# ==============================================================================

upgrade-raffle-sepolia: check-env
	@echo "Upgrading Raffle on Ethereum Sepolia testnet..."
	RAFFLE_PROXY_ADDRESS=$(RAFFLE_PROXY_ADDRESS) forge script script/RaffleUpgrader.s.sol:RaffleUpgrader --rpc-url $(SEPOLIA_RPC_URL) --private-key 0x$(PRIVATE_KEY) --broadcast -vvvv

upgrade-raffle-base: check-env
	@echo "Upgrading Raffle on Base Sepolia testnet..."
	RAFFLE_PROXY_ADDRESS=$(RAFFLE_PROXY_ADDRESS_BASE) forge script script/RaffleUpgrader.s.sol:RaffleUpgrader --rpc-url $(BASE_SEPOLIA_RPC_URL) --private-key 0x$(PRIVATE_KEY) --broadcast -vvvv

upgrade-raffle-arb: check-env
	@echo "Upgrading Raffle on Arbitrum Sepolia testnet..."
	RAFFLE_PROXY_ADDRESS=$(RAFFLE_PROXY_ADDRESS_ARB) forge script script/RaffleUpgrader.s.sol:RaffleUpgrader --rpc-url $(ARBITRUM_SEPOLIA_RPC_URL) --private-key 0x$(PRIVATE_KEY) --broadcast -vvvv

upgrade-raffle: upgrade-raffle-sepolia upgrade-raffle-base upgrade-raffle-arb update-frontend-upgrade

upgrade-raffle-with-data-sepolia: check-env
	@echo "Upgrading Raffle with data on Ethereum Sepolia testnet..."
	RAFFLE_PROXY_ADDRESS=$(RAFFLE_PROXY_ADDRESS) forge script script/RaffleUpgrader.s.sol:RaffleUpgrader --sig "upgradeWithData()" --rpc-url $(SEPOLIA_RPC_URL) --private-key 0x$(PRIVATE_KEY) --broadcast -vvvv

upgrade-raffle-with-data-base: check-env
	@echo "Upgrading Raffle with data on Base Sepolia testnet..."
	RAFFLE_PROXY_ADDRESS=$(RAFFLE_PROXY_ADDRESS_BASE) forge script script/RaffleUpgrader.s.sol:RaffleUpgrader --sig "upgradeWithData()" --rpc-url $(BASE_SEPOLIA_RPC_URL) --private-key 0x$(PRIVATE_KEY) --broadcast -vvvv

upgrade-raffle-with-data-arb: check-env
	@echo "Upgrading Raffle with data on Arbitrum Sepolia testnet..."
	RAFFLE_PROXY_ADDRESS=$(RAFFLE_PROXY_ADDRESS_ARB) forge script script/RaffleUpgrader.s.sol:RaffleUpgrader --sig "upgradeWithData()" --rpc-url $(ARBITRUM_SEPOLIA_RPC_URL) --private-key 0x$(PRIVATE_KEY) --broadcast -vvvv

upgrade-raffle-with-data: upgrade-raffle-with-data-sepolia upgrade-raffle-with-data-base upgrade-raffle-with-data-arb update-frontend

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

verify-raffle: verify-sepolia verify-base-sepolia verify-arb-sepolia
	@echo "Verifying Raffle on all networks..."

# Bridge Proxy Verification
verify-bridge-proxy-sepolia:
	@echo "Verifying Bridge Proxy on Ethereum Sepolia..."
	forge verify-contract $(BRIDGE_IMPLEMENTATION_ADDRESS) src/RaffleBridgeImplementation.sol:RaffleBridgeImplementation --chain sepolia --etherscan-api-key $(ETHERSCAN_API_KEY)
	forge verify-contract $(BRIDGE_PROXY_ADDRESS) src/RaffleBridgeProxy.sol:RaffleBridgeProxy --chain sepolia --etherscan-api-key $(ETHERSCAN_API_KEY)

verify-bridge-proxy-base:
	@echo "Verifying Bridge Proxy on Base Sepolia..."
	forge verify-contract $(BRIDGE_IMPLEMENTATION_ADDRESS_BASE) src/RaffleBridgeImplementation.sol:RaffleBridgeImplementation --chain base-sepolia --etherscan-api-key $(BASE_API_KEY)
	forge verify-contract $(BRIDGE_PROXY_ADDRESS_BASE) src/RaffleBridgeProxy.sol:RaffleBridgeProxy --chain base-sepolia --etherscan-api-key $(BASE_API_KEY)

verify-bridge-proxy-arb:
	@echo "Verifying Bridge Proxy on Arbitrum Sepolia..."
	forge verify-contract $(BRIDGE_IMPLEMENTATION_ADDRESS_ARB) src/RaffleBridgeImplementation.sol:RaffleBridgeImplementation --chain arbitrum-sepolia --etherscan-api-key $(ARBISCAN_API_KEY)
	forge verify-contract $(BRIDGE_PROXY_ADDRESS_ARB) src/RaffleBridgeProxy.sol:RaffleBridgeProxy --chain arbitrum-sepolia --etherscan-api-key $(ARBISCAN_API_KEY)

verify-bridge: verify-bridge-proxy-sepolia verify-bridge-proxy-base verify-bridge-proxy-arb
	@echo "Verifying Bridge Proxy on all networks..."
