#!/usr/bin/env node

// Define colors for command line output
const COLORS = {
    reset: "\x1b[0m",
    fg: {
        red: "\x1b[31m",
        green: "\x1b[32m",
        yellow: "\x1b[33m",
        blue: "\x1b[34m",
        magenta: "\x1b[35m",
        cyan: "\x1b[36m",
    }
};

// Path configuration
const path = require('path');
const fs = require('fs');

// Configurable paths
const BACKEND_PATH = path.join(__dirname, '../backend');
const BROADCAST_PATH = path.join(BACKEND_PATH, 'broadcast');
const BRIDGE_HOOK_PATH = path.join(__dirname, '../frontend/app/lib/bridge-contract-config.ts');
const BRIDGE_TOKEN_HOOK_PATH = path.join(__dirname, '../frontend/hooks/use-token-bridge.ts');

// Network ID to Chain Name mapping
const NETWORK_MAPPING = {
    11155111: {
        name: 'sepolia',
        ccipSelector: '16015286601757825753',
    },
    421614: {
        name: 'arbitrum-sepolia',
        ccipSelector: '3478487238524512106',
    },
    84532: {
        name: 'base-sepolia',
        ccipSelector: '10344971235874465080',
    }
};

/**
 * Loads the ABI for a given contract
 * @param {string} contractName - The name of the contract
 * @returns {Object} The ABI of the contract
 */
function loadABI(contractName) {
    const abiPath = path.join(BACKEND_PATH, 'out', `${contractName}.sol`, `${contractName}.json`);
    
    try {
        const abiJson = fs.readFileSync(abiPath, 'utf8');
        const abiData = JSON.parse(abiJson);
        return abiData.abi;
    } catch (error) {
        console.error(`${COLORS.fg.red}Error loading ABI for ${contractName}:${COLORS.reset}`, error);
        process.exit(1);
    }
}

/**
 * Retrieves bridge contract addresses from broadcast files
 * @returns {Object} An object with bridge addresses by network
 */
function getBridgeAddresses() {
    const bridgeAddresses = {};
    
    // Search through broadcast directories for deployed bridge contracts
    const runDirs = fs.readdirSync(BROADCAST_PATH);
    
    for (const runDir of runDirs) {
        // Skip non-directory entries
        if (!fs.statSync(path.join(BROADCAST_PATH, runDir)).isDirectory()) {
            continue;
        }
        
        // Read network directories within run directories
        const networkDirs = fs.readdirSync(path.join(BROADCAST_PATH, runDir));
        
        for (const networkDir of networkDirs) {
            // Skip non-directory entries
            if (!fs.statSync(path.join(BROADCAST_PATH, runDir, networkDir)).isDirectory()) {
                continue;
            }
            
            // Extract network ID from directory name
            const networkId = parseInt(networkDir);
            
            if (isNaN(networkId) || !NETWORK_MAPPING[networkId]) {
                continue; // Skip invalid or unmapped networks
            }
            
            // Find the latest bridge transaction for this network
            const bridgeTx = findBridgeTransaction(runDir, networkId);
            
            if (bridgeTx) {
                if (!bridgeAddresses[networkId]) {
                    bridgeAddresses[networkId] = {};
                }
                bridgeAddresses[networkId] = bridgeTx.contractAddress;
                console.log(`${COLORS.fg.green}Found Bridge contract on ${NETWORK_MAPPING[networkId].name}: ${COLORS.fg.cyan}${bridgeTx.contractAddress}${COLORS.reset}`);
            }
        }
    }
    
    return bridgeAddresses;
}

/**
 * Find the most recent bridge transaction in the broadcast files
 * @param {string} runDir - The run directory to search in
 * @param {number} networkId - The network ID
 * @returns {Object|null} The bridge transaction or null if not found
 */
function findBridgeTransaction(runDir, networkId) {
    const networkName = NETWORK_MAPPING[networkId].name;
    const runsDir = path.join(BROADCAST_PATH, runDir, networkId.toString());
    
    let latestTimestamp = 0;
    let latestBridgeTx = null;
    
    // Get all JSON files in the runs directory
    const runFiles = fs.readdirSync(runsDir).filter(file => file.endsWith('.json'));
    
    for (const runFile of runFiles) {
        const runPath = path.join(runsDir, runFile);
        
        try {
            const runData = JSON.parse(fs.readFileSync(runPath, 'utf8'));
            
            // Check if this is a transaction with the Bridge contract
            const txs = runData.transactions || [];
            
            for (const tx of txs) {
                // Check for both RaffleBridgeProxy and RaffleBridge for backward compatibility
                if (tx.contractName === 'RaffleBridgeProxy' || tx.contractName === 'RaffleBridge') {
                    const timestamp = new Date(runData.timestamp || 0).getTime();
                    
                    if (timestamp > latestTimestamp) {
                        latestTimestamp = timestamp;
                        latestBridgeTx = tx;
                    }
                }
            }
        } catch (err) {
            console.warn(`${COLORS.fg.yellow}Warning: Could not parse run file ${runFile}${COLORS.reset}`);
        }
    }
    
    return latestBridgeTx;
}

/**
 * Updates the bridge hook file with new contract configurations
 * @param {Object} bridgeAbi - The Bridge contract ABI
 * @param {Object} bridgeAddresses - Bridge contract addresses by network
 */
function updateBridgeHook(bridgeAbi, bridgeAddresses) {
    // Create configuration objects for each network
    const networks = Object.keys(bridgeAddresses).map(networkId => {
        const network = NETWORK_MAPPING[networkId];
        return {
            networkId: parseInt(networkId),
            chainName: network.name,
            ccipSelector: network.ccipSelector,
            bridgeAddress: bridgeAddresses[networkId]
        };
    });
    
    if (networks.length === 0) {
        console.error(`${COLORS.fg.red}Error: No bridge contracts found in broadcast files${COLORS.reset}`);
        process.exit(1);
    }
    
    // Generate the hook content
    const hookContent = `// This file is auto-generated by scripts/update-bridge-config.js
// Do not edit this file manually

import { type Address } from 'wagmi';

export interface BridgeContractConfig {
  networkId: number;
  chainName: string;
  ccipSelector: string | null;
  bridgeAddress: Address;
}

export const BRIDGE_ABI = ${JSON.stringify(bridgeAbi, null, 2)} as const;

export const BRIDGE_CONFIGS: BridgeContractConfig[] = ${JSON.stringify(networks, null, 2)};

export default function useBridgeContractConfig() {
  return {
    abi: BRIDGE_ABI,
    configs: BRIDGE_CONFIGS,
  };
}
`;

    try {
        // Ensure the directory exists
        const hookDir = path.dirname(BRIDGE_HOOK_PATH);
        if (!fs.existsSync(hookDir)) {
            fs.mkdirSync(hookDir, { recursive: true });
        }
        
        // Write the file
        fs.writeFileSync(BRIDGE_HOOK_PATH, hookContent);
        console.log(`${COLORS.fg.green}Successfully updated bridge hook at:${COLORS.reset} ${BRIDGE_HOOK_PATH}`);
    } catch (error) {
        console.error(`${COLORS.fg.red}Error updating bridge hook:${COLORS.reset}`, error);
        process.exit(1);
    }
}

/**
 * Updates the token bridge hook file with bridge addresses and ABI
 * @param {Object} bridgeAbi - The Bridge contract ABI
 * @param {Object} bridgeAddresses - Bridge contract addresses by network
 */
function updateTokenBridgeHook(bridgeAbi, bridgeAddresses) {
    try {
        // Check if the token bridge hook file exists
        if (!fs.existsSync(BRIDGE_TOKEN_HOOK_PATH)) {
            console.warn(`${COLORS.fg.yellow}Warning: Token bridge hook file not found at ${BRIDGE_TOKEN_HOOK_PATH}${COLORS.reset}`);
            return;
        }
        
        // Token bridge hook uses imports from bridge-contract-config.ts, no need to modify
        console.log(`${COLORS.fg.green}Token bridge hook is configured to import from bridge-contract-config.ts. No changes needed.${COLORS.reset}`);
        
    } catch (error) {
        console.error(`${COLORS.fg.red}Error updating token bridge hook:${COLORS.reset}`, error);
    }
}

/**
 * Main function
 */
async function main() {
    console.log(`${COLORS.fg.blue}Updating bridge contract configurations...${COLORS.reset}`);
    
    // Load Bridge ABI (using implementation contract for ABI)
    console.log(`${COLORS.fg.blue}Loading Bridge ABI...${COLORS.reset}`);
    
    // Try to load RaffleBridgeImplementation ABI first, fallback to RaffleBridge if not found
    let bridgeAbi;
    try {
        bridgeAbi = loadABI('RaffleBridgeImplementation');
        console.log(`${COLORS.fg.green}Loaded RaffleBridgeImplementation ABI${COLORS.reset}`);
    } catch (error) {
        console.log(`${COLORS.fg.yellow}RaffleBridgeImplementation ABI not found, falling back to RaffleBridge ABI${COLORS.reset}`);
        bridgeAbi = loadABI('RaffleBridge');
    }
    
    // Get Bridge contract addresses
    console.log(`${COLORS.fg.blue}Retrieving Bridge contract addresses...${COLORS.reset}`);
    const bridgeAddresses = getBridgeAddresses();
    
    // Update the bridge hook
    console.log(`${COLORS.fg.blue}Updating Bridge hook...${COLORS.reset}`);
    updateBridgeHook(bridgeAbi, bridgeAddresses);
    
    // Update the token bridge hook
    console.log(`${COLORS.fg.blue}Updating Token Bridge hook...${COLORS.reset}`);
    updateTokenBridgeHook(bridgeAbi, bridgeAddresses);
    
    console.log(`${COLORS.fg.green}Bridge contract configurations updated successfully!${COLORS.reset}`);
}

// Run the main function
main().catch(error => {
    console.error(`${COLORS.fg.red}Error:${COLORS.reset}`, error);
    process.exit(1);
}); 