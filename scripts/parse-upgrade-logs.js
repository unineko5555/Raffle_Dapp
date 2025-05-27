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

const fs = require('fs');
const path = require('path');

/**
 * Parse upgrade logs from forge script output to extract implementation addresses
 * @param {string} logOutput - The raw log output from forge script
 * @returns {Object} Parsed upgrade information
 */
function parseUpgradeLogs(logOutput) {
    const upgradeResults = {};
    
    // Split logs into lines
    const lines = logOutput.split('\n');
    
    let isInUpgradeResult = false;
    let currentResult = {};
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Check for upgrade result markers
        if (trimmedLine.includes('=== UPGRADE_RESULT ===')) {
            isInUpgradeResult = true;
            currentResult = {};
            continue;
        }
        
        if (trimmedLine.includes('=== END_UPGRADE_RESULT ===')) {
            isInUpgradeResult = false;
            
            // Store the result if we have valid data
            if (currentResult.PROXY_ADDRESS && currentResult.NEW_IMPLEMENTATION_ADDRESS) {
                upgradeResults[currentResult.PROXY_ADDRESS] = {
                    proxyAddress: currentResult.PROXY_ADDRESS,
                    newImplementationAddress: currentResult.NEW_IMPLEMENTATION_ADDRESS,
                    oldImplementationAddress: currentResult.OLD_IMPLEMENTATION_ADDRESS
                };
                
                console.log(`${COLORS.fg.green}Parsed upgrade result:${COLORS.reset}`);
                console.log(`  Proxy: ${COLORS.fg.cyan}${currentResult.PROXY_ADDRESS}${COLORS.reset}`);
                console.log(`  New Implementation: ${COLORS.fg.cyan}${currentResult.NEW_IMPLEMENTATION_ADDRESS}${COLORS.reset}`);
                console.log(`  Old Implementation: ${COLORS.fg.yellow}${currentResult.OLD_IMPLEMENTATION_ADDRESS}${COLORS.reset}`);
            }
            continue;
        }
        
        // Parse key-value pairs within upgrade result section
        if (isInUpgradeResult && trimmedLine.includes(':')) {
            const [key, value] = trimmedLine.split(':', 2);
            if (key && value) {
                const cleanKey = key.trim();
                const cleanValue = value.trim();
                currentResult[cleanKey] = cleanValue;
            }
        }
    }
    
    return upgradeResults;
}

/**
 * Read upgrade logs from stdin or file
 * @param {string} filePath - Optional file path to read logs from
 * @returns {Promise<string>} The log content
 */
async function readUpgradeLogs(filePath) {
    if (filePath && fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
    }
    
    // Read from stdin if no file provided
    return new Promise((resolve) => {
        let data = '';
        process.stdin.setEncoding('utf8');
        
        process.stdin.on('readable', () => {
            let chunk;
            while (null !== (chunk = process.stdin.read())) {
                data += chunk;
            }
        });
        
        process.stdin.on('end', () => {
            resolve(data);
        });
    });
}

/**
 * Update the broadcast files with implementation addresses
 * @param {Object} upgradeResults - Parsed upgrade results
 */
function updateBroadcastFiles(upgradeResults) {
    const BACKEND_PATH = path.join(__dirname, '../backend');
    const BROADCAST_PATH = path.join(BACKEND_PATH, 'broadcast');
    
    if (!fs.existsSync(BROADCAST_PATH)) {
        console.error(`${COLORS.fg.red}Broadcast directory not found: ${BROADCAST_PATH}${COLORS.reset}`);
        return;
    }
    
    // Process each upgrade result
    for (const [proxyAddress, result] of Object.entries(upgradeResults)) {
        console.log(`${COLORS.fg.blue}Processing proxy ${proxyAddress}...${COLORS.reset}`);
        
        // Find and update the corresponding broadcast files
        updateBroadcastFilesForProxy(BROADCAST_PATH, result);
    }
}

/**
 * Update broadcast files for a specific proxy
 * @param {string} broadcastPath - Path to broadcast directory
 * @param {Object} upgradeResult - Upgrade result for a specific proxy
 */
function updateBroadcastFilesForProxy(broadcastPath, upgradeResult) {
    // This function would search through broadcast files and add implementation address info
    // For now, we'll just log the information since the main update-bridge-config.js will handle it
    console.log(`${COLORS.fg.green}Implementation address available for config update:${COLORS.reset}`);
    console.log(`  ${upgradeResult.newImplementationAddress}`);
}

/**
 * Main function
 */
async function main() {
    const args = process.argv.slice(2);
    const filePath = args[0]; // Optional file path
    
    console.log(`${COLORS.fg.blue}Parsing upgrade logs...${COLORS.reset}`);
    
    try {
        // Read upgrade logs
        const logContent = await readUpgradeLogs(filePath);
        
        if (!logContent || logContent.trim().length === 0) {
            console.error(`${COLORS.fg.red}Error: No log content provided${COLORS.reset}`);
            console.log(`${COLORS.fg.yellow}Usage: node parse-upgrade-logs.js [log-file-path]${COLORS.reset}`);
            console.log(`${COLORS.fg.yellow}Or pipe forge output: forge script ... | node parse-upgrade-logs.js${COLORS.reset}`);
            process.exit(1);
        }
        
        // Parse the logs
        const upgradeResults = parseUpgradeLogs(logContent);
        
        if (Object.keys(upgradeResults).length === 0) {
            console.warn(`${COLORS.fg.yellow}Warning: No upgrade results found in logs${COLORS.reset}`);
            console.log(`${COLORS.fg.yellow}Make sure the upgrade script includes proper logging markers${COLORS.reset}`);
            process.exit(0);
        }
        
        // Update broadcast files if needed
        updateBroadcastFiles(upgradeResults);
        
        console.log(`${COLORS.fg.green}Successfully parsed ${Object.keys(upgradeResults).length} upgrade result(s)${COLORS.reset}`);
        
        // Output results as JSON for potential programmatic use
        if (args.includes('--json')) {
            console.log('\n=== JSON OUTPUT ===');
            console.log(JSON.stringify(upgradeResults, null, 2));
            console.log('=== END JSON OUTPUT ===\n');
        }
        
    } catch (error) {
        console.error(`${COLORS.fg.red}Error parsing upgrade logs:${COLORS.reset}`, error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(`\n${COLORS.fg.yellow}Interrupted${COLORS.reset}`);
    process.exit(0);
});

// Run the script
if (require.main === module) {
    main().catch(error => {
        console.error(`${COLORS.fg.red}Fatal error:${COLORS.reset}`, error);
        process.exit(1);
    });
}

module.exports = {
    parseUpgradeLogs,
    readUpgradeLogs,
    updateBroadcastFiles
};
