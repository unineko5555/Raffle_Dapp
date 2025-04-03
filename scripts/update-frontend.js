/**
 * このスクリプトは、バックエンドのコンパイル済みコントラクトからABIを取得し、
 * デプロイログからコントラクトアドレスを抽出して、
 * フロントエンドの設定ファイルを更新します。
 */
const fs = require('fs');
const path = require('path');

// パス設定
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ABI_FILE = path.join(PROJECT_ROOT, 'backend/out/RaffleImplementation.sol/RaffleImplementation.json');
const CONFIG_FILE = path.join(PROJECT_ROOT, 'frontend/app/lib/contract-config.ts');

// デプロイログの場所（ネットワークごと）
const DEPLOY_LOGS = {
  // チェーンID: ログファイルパス
  11155111: path.join(PROJECT_ROOT, 'backend/broadcast/DeployRaffle.s.sol/11155111/run-latest.json'), // Ethereum Sepolia
  84532: path.join(PROJECT_ROOT, 'backend/broadcast/DeployRaffle.s.sol/84532/run-latest.json'),     // Base Sepolia
  421614: path.join(PROJECT_ROOT, 'backend/broadcast/DeployRaffle.s.sol/421614/run-latest.json'),    // Arbitrum Sepolia
};

console.log('Updating frontend configuration...');
console.log('- ABI source:', ABI_FILE);
console.log('- Target config:', CONFIG_FILE);

// ABIファイルが存在するか確認
if (!fs.existsSync(ABI_FILE)) {
  console.error(`❌ Error: ABI file not found at ${ABI_FILE}`);
  process.exit(1);
}

// 設定ファイルが存在するか確認
if (!fs.existsSync(CONFIG_FILE)) {
  console.error(`❌ Error: Config file not found at ${CONFIG_FILE}`);
  process.exit(1);
}

try {
  // ABIファイルを読み込む
  const abiData = JSON.parse(fs.readFileSync(ABI_FILE, 'utf8'));
  const abi = abiData.abi;
  
  if (!abi || !Array.isArray(abi)) {
    console.error('❌ Error: Invalid ABI format in source file');
    process.exit(1);
  }
  
  // ABIを整形する（きれいに表示するため）
  const formattedAbi = JSON.stringify(abi, null, 2);
  
  // 設定ファイルの内容を読み込む
  let configContent = fs.readFileSync(CONFIG_FILE, 'utf8');
  
  // ABI部分を正規表現で検索して置換
  const abiRegex = /(export const RaffleABI =)[\s\S]*?(;)/;
  const updatedConfig = configContent.replace(abiRegex, `$1 ${formattedAbi}$2`);
  
  // デプロイログからコントラクトアドレスを取得して更新する
  let finalConfig = updatedConfig;
  let addressesUpdated = false;
  
  // 各ネットワークのデプロイログをチェック
  for (const [chainId, logPath] of Object.entries(DEPLOY_LOGS)) {
    if (fs.existsSync(logPath)) {
      try {
        const deployLog = JSON.parse(fs.readFileSync(logPath, 'utf8'));
        
        // プロキシアドレスを探す
        // Note: 実際のログ構造に合わせて調整が必要かもしれません
        let proxyAddress = null;
        
        // トランザクションを探索
        if (deployLog.transactions) {
          for (const tx of deployLog.transactions) {
            // RaffleProxyのデプロイトランザクションを探す
            if (tx.contractName === 'RaffleProxy') {
              proxyAddress = tx.contractAddress;
              break;
            }
          }
        }
        
        if (proxyAddress) {
          console.log(`Found RaffleProxy address for chain ${chainId}: ${proxyAddress}`);
          
          // コントラクトアドレスを更新
          const addressRegex = new RegExp(`(${chainId}:\s*{[\s\S]*?raffleProxy:\s*")[^"]*(")`, 'g');
          if (addressRegex.test(finalConfig)) {
            finalConfig = finalConfig.replace(addressRegex, `$1${proxyAddress}$2`);
            addressesUpdated = true;
          } else {
            console.warn(`⚠️ Warning: Could not find address pattern for chain ${chainId} in config`);
          }
        } else {
          console.warn(`⚠️ Warning: RaffleProxy address not found in deploy log for chain ${chainId}`);
        }
      } catch (logError) {
        console.warn(`⚠️ Warning: Error parsing deploy log for chain ${chainId}:`, logError.message);
      }
    } else {
      console.warn(`⚠️ Warning: Deploy log not found for chain ${chainId}: ${logPath}`);
    }
  }
  
  // 新しい内容を書き込む
  fs.writeFileSync(CONFIG_FILE, finalConfig);
  
  if (addressesUpdated) {
    console.log('✅ Frontend contract addresses successfully updated!');
  } else {
    console.log('ℹ️ No contract addresses were updated. Only ABI was updated.');
  }
  
  console.log('✅ Frontend ABI successfully updated!');
} catch (error) {
  console.error('❌ Error updating frontend configuration:', error);
  process.exit(1);
}
