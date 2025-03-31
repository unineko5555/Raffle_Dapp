#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// ネットワークIDとチェーン名のマッピング
const NETWORK_MAP = {
  '11155111': 'sepolia',
  '421614': 'arbitrumSepolia',
  '84532': 'baseSepolia'
};

// パス設定
const PROJECT_ROOT = path.resolve(__dirname, '..');
const BACKEND_PATH = path.resolve(PROJECT_ROOT, 'backend');
const BROADCAST_PATH = path.resolve(BACKEND_PATH, 'broadcast');
const ABI_PATH = path.resolve(BACKEND_PATH, 'out/RaffleImplementation.sol/RaffleImplementation.json');
const CONFIG_PATH = path.resolve(PROJECT_ROOT, 'frontend/src/contract-config.ts');

console.log('スクリプト実行開始: デプロイ情報を更新します...');
console.log(`ABIパス: ${ABI_PATH}`);
console.log(`設定ファイルパス: ${CONFIG_PATH}`);

// ABIを読み込む
const loadAbi = () => {
  try {
    console.log('ABIファイルを読み込んでいます...');
    const abiJson = JSON.parse(fs.readFileSync(ABI_PATH, 'utf8'));
    console.log('ABIファイルの読み込みに成功しました');
    return abiJson.abi;
  } catch (error) {
    console.error('ABIファイルの読み込みに失敗しました:', error);
    process.exit(1);
  }
};

// 各ネットワークのデプロイアドレスを取得
const getDeployedAddresses = () => {
  const addresses = {};
  
  console.log('デプロイされたアドレスを取得しています...');
  
  for (const [networkId, networkName] of Object.entries(NETWORK_MAP)) {
    try {
      const networkPath = path.resolve(BROADCAST_PATH, networkId);
      const files = fs.readdirSync(networkPath);
      const latestRun = files.find(file => file.startsWith('run-latest'));
      
      if (!latestRun) {
        console.log(`${networkName}(${networkId})の最新デプロイが見つかりませんでした`);
        continue;
      }
      
      const latestRunPath = path.resolve(networkPath, latestRun);
      console.log(`${networkName}のデプロイ情報を読み込み中: ${latestRunPath}`);
      
      const deployData = JSON.parse(fs.readFileSync(latestRunPath, 'utf8'));
      
      // RaffleProxyのデプロイメントを探す
      const proxyDeployment = deployData.transactions.find(tx => 
        tx.contractName === 'RaffleProxy' && tx.transactionType === 'CREATE'
      );
      
      if (proxyDeployment && proxyDeployment.contractAddress) {
        addresses[networkName] = proxyDeployment.contractAddress;
        console.log(`${networkName}のコントラクトアドレス: ${proxyDeployment.contractAddress}`);
      } else {
        console.log(`${networkName}のRaffleProxyデプロイメントが見つかりませんでした`);
      }
    } catch (error) {
      console.warn(`${networkName}のアドレス取得に失敗しました:`, error.message);
    }
  }
  
  return addresses;
};

// 既存の設定ファイルの読み込み
const loadExistingConfig = () => {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      console.log('既存の設定ファイルを読み込んでいます...');
      // ファイルを読み込むだけで評価はしない
      const content = fs.readFileSync(CONFIG_PATH, 'utf8');
      
      // アドレスの部分だけ正規表現で抽出
      const addressRegex = /export\s+const\s+contractAddresses\s*=\s*{([^}]+)}/s;
      const match = content.match(addressRegex);
      
      if (match && match[1]) {
        const addressesStr = match[1];
        const existingAddresses = {};
        
        // 各行を処理
        addressesStr.split('\n').forEach(line => {
          // "network: "address"" の形式を探す
          const lineMatch = line.match(/\s*(\w+)\s*:\s*"(0x[a-fA-F0-9]+)"/);
          if (lineMatch) {
            const [, network, address] = lineMatch;
            existingAddresses[network] = address;
          }
        });
        
        console.log('既存の設定から以下のアドレスを読み込みました:');
        Object.entries(existingAddresses).forEach(([network, address]) => {
          console.log(`- ${network}: ${address}`);
        });
        
        return existingAddresses;
      }
    }
  } catch (error) {
    console.warn('既存の設定ファイルの読み込みに失敗しました:', error.message);
  }
  
  console.log('既存の設定ファイルが見つからないか、解析できませんでした。新規作成します。');
  return {};
};

// contract-config.tsを更新
const updateContractConfig = (newAddresses, abi) => {
  // 既存の設定をマージ
  const existingAddresses = loadExistingConfig();
  const mergedAddresses = { ...existingAddresses, ...newAddresses };
  
  // テンプレート
  const configContent = `
// このファイルは自動生成されています - 手動で編集しないでください
// 最終更新: ${new Date().toISOString()}

export const contractAddresses = {
  ${Object.entries(mergedAddresses).map(([network, address]) => `  ${network}: "${address}"`).join(',\n')}
};

export const raffleAbi = ${JSON.stringify(abi, null, 2)};
`;

  // ディレクトリが存在するか確認
  const configDir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(configDir)) {
    console.log(`ディレクトリが存在しないため作成します: ${configDir}`);
    fs.mkdirSync(configDir, { recursive: true });
  }

  // ファイルに書き込み
  fs.writeFileSync(CONFIG_PATH, configContent);
  console.log('contract-config.tsを更新しました!');
  
  // 更新内容を表示
  console.log('設定されたコントラクトアドレス:');
  Object.entries(mergedAddresses).forEach(([network, address]) => {
    const isNew = newAddresses[network] === address;
    console.log(`- ${network}: ${address}${isNew ? ' (新規追加/更新)' : ''}`);
  });
};

// メイン処理
const main = () => {
  const abi = loadAbi();
  const addresses = getDeployedAddresses();
  
  if (Object.keys(addresses).length === 0) {
    console.warn('新しくデプロイされたアドレスが見つかりませんでした。既存の設定を保持します。');
  }
  
  updateContractConfig(addresses, abi);
  console.log('処理が完了しました。');
};

main();
