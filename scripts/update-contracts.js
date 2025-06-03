#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// コマンドライン引数から実行モードを判断
const args = process.argv.slice(2);
const isUpgradeMode = args.includes('--upgrade');

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
const CONFIG_PATH = path.resolve(PROJECT_ROOT, 'frontend/app/lib/contract-config.ts');

console.log(`スクリプト実行開始: ${isUpgradeMode ? 'ABIのみを更新します...' : 'デプロイ情報を更新します...'}`);
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
  let foundDeployments = false;
  
  console.log('デプロイされたアドレスを取得しています...');
  console.log(`ブロードキャストパス: ${BROADCAST_PATH}`);
  
  // 各チェーンID毎に処理
  Object.entries(NETWORK_MAP).forEach(([chainId, networkName]) => {
    try {
      // RaffleProxyDeployer.s.sol/[chainId] のフォルダパス
      const deployPath = path.join(BROADCAST_PATH, 'RaffleProxyDeployer.s.sol', chainId);
      console.log(`${networkName}のデプロイパスをチェック: ${deployPath}`);
      
      if (fs.existsSync(deployPath)) {
        // run-latest.json または最新のrun-*.jsonを探す
        const files = fs.readdirSync(deployPath);
        const runFiles = files.filter(file => file.startsWith('run-') && file.endsWith('.json'));
        
        if (runFiles.length > 0) {
          // run-latest.jsonを優先、なければ最新のファイルを使用
          const latestFile = runFiles.includes('run-latest.json') 
            ? 'run-latest.json' 
            : runFiles.sort().pop();
          
          const runPath = path.join(deployPath, latestFile);
          console.log(`${networkName}のデプロイ情報を読み込み中: ${runPath}`);
          
          const deployData = JSON.parse(fs.readFileSync(runPath, 'utf8'));
          const proxyTx = findRaffleProxyTransaction(deployData);
          
          if (proxyTx && proxyTx.contractAddress) {
            addresses[networkName] = proxyTx.contractAddress;
            console.log(`${networkName}のアドレスを取得しました: ${proxyTx.contractAddress}`);
            foundDeployments = true;
          } else {
            console.warn(`${networkName}のRaffleProxyアドレスが見つかりませんでした`);
          }
        } else {
          console.warn(`${networkName}のデプロイログファイルが見つかりませんでした`);
        }
      } else {
        console.warn(`${networkName}のデプロイディレクトリが見つかりませんでした: ${deployPath}`);
      }
    } catch (error) {
      console.error(`${networkName}のアドレス取得中にエラーが発生しました:`, error);
    }
  });
  
  // デプロイ情報が見つからない場合
  if (!foundDeployments) {
    console.log('デプロイ情報が見つかりませんでした');
    return {};
  }
  
  return addresses;
};

// RaffleProxyトランザクションを探す関数
const findRaffleProxyTransaction = (deployData) => {
  if (!deployData.transactions) {
    return null;
  }
  
  return deployData.transactions.find(tx => 
    tx.contractName === 'RaffleProxy' && 
    tx.transactionType === 'CREATE');
};

// 既存の設定ファイルの読み込み
const loadExistingConfig = () => {
  try {
    console.log('既存の設定ファイルを読み込んでいます...');
    
    // 既存のcontract-config.tsを読み込む
    const existingConfig = fs.readFileSync(CONFIG_PATH, 'utf8');
    const configContent = existingConfig.toString();
    
    // 設定ファイルの形式を確認
    if (configContent.includes('export const contractConfig = {')) {
      // 旧形式の場合、実際の値を解析
      console.log('既存の設定ファイル（旧形式）を読み込みました');
      
      const addresses = {};
      
      // SepoliaのraffleProxyを探す
      const sepoliaMatch = configContent.match(/11155111:\s*{[^}]+raffleProxy:\s*"([0-9a-fA-Fx]+)"/s);
      if (sepoliaMatch) {
        addresses.sepolia = sepoliaMatch[1];
      }
      
      // Base SepoliaのraffleProxyを探す
      const baseMatch = configContent.match(/84532:\s*{[^}]+raffleProxy:\s*"([0-9a-fA-Fx]+)"/s);
      if (baseMatch) {
        addresses.baseSepolia = baseMatch[1];
      }
      
      // Arbitrum SepoliaのraffleProxyを探す
      const arbMatch = configContent.match(/421614:\s*{[^}]+raffleProxy:\s*"([0-9a-fA-Fx]+)"/s);
      if (arbMatch) {
        addresses.arbitrumSepolia = arbMatch[1];
      }
      
      console.log('既存の設定から以下のアドレスを読み込みました:');
      Object.entries(addresses).forEach(([network, address]) => {
        console.log(`- ${network}: ${address}`);
      });
      
      return addresses;
    }
    
    // 新形式（contractAddresses）を探す
    const addressRegex = /export\s+const\s+contractAddresses\s*=\s*{([^}]+)}/s;
    const match = configContent.match(addressRegex);
    
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
  } catch (error) {
    console.warn('既存の設定ファイルの読み込みに失敗しました:', error.message);
  }
  
  console.log('既存の設定ファイルが見つからないか、解析できませんでした。新規作成します。');
  return {};
};

// contract-config.tsを更新する関数
const updateContractConfig = (newAddresses, abi, isUpgrade = false) => {
  try {
    // 既存の設定を読み込む
    const existingAddresses = loadExistingConfig();
    console.log('既存の設定を読み込みました');
    
    // 既存の設定ファイルの内容を取得
    let existingContent = '';
    try {
      existingContent = fs.readFileSync(CONFIG_PATH, 'utf8');
    } catch (error) {
      console.log('既存の設定ファイルがないか読み込めません。新規作成します。');
    }
    
    // ERC20ABI部分を抽出して保持する
    let erc20Abi = '';
    const erc20AbiMatch = existingContent.match(/export\s+const\s+ERC20ABI\s*=\s*(\[\s*[\s\S]*?\n\]\s*);/);
    if (erc20AbiMatch) {
      erc20Abi = erc20AbiMatch[0];
      console.log('既存のERC20ABIを保持します');
    }
    
    // 新形式の場合は単純なマージ
    const mergedAddresses = isUpgrade ? existingAddresses : { ...existingAddresses, ...newAddresses };
    
    // 形式を確認して適切な設定ファイルを作成
    let configContent;
    
    if (existingContent.includes('export const contractConfig = {')) {
      // 古い形式（contractConfig）をそのまま維持
      console.log('契約設定を古い形式（contractConfig）で更新します');
      
      configContent = `// 各ネットワークのコントラクトアドレスと関連設定
export const contractConfig = {
  // Ethereum Sepolia
  11155111: {
    name: "Ethereum Sepolia",
    raffleProxy: "${isUpgrade ? existingAddresses.sepolia : (newAddresses.sepolia || existingAddresses.sepolia || '0x659F54928a0Ac9EA822C356D05Ec53925A0228E8')}", // Sepoliaにデプロイしたプロキシアドレス
    erc20Address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // SepoliaのUSDC (またはモックトークン) アドレス
    blockExplorer: "https://sepolia.etherscan.io",
    rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
  },
  // Base Sepolia
  84532: {
    name: "Base Sepolia",
    raffleProxy: "${isUpgrade ? existingAddresses.baseSepolia : (newAddresses.baseSepolia || existingAddresses.baseSepolia || '0xEEd88f19b0951a7BeE1B52F83Afd333eCdBB6e96')}", // Base Sepoliaにデプロイしたプロキシアドレス
    erc20Address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base SepoliaのUSDC (またはモックトークン) アドレス
    blockExplorer: "https://sepolia.basescan.org",
    rpcUrl: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
  },
  // Arbitrum Sepolia
  421614: {
    name: "Arbitrum Sepolia",
    raffleProxy: "${isUpgrade ? existingAddresses.arbitrumSepolia : (newAddresses.arbitrumSepolia || existingAddresses.arbitrumSepolia || '0x0573F6fE1cf8F169181eEc83Ae65BEa5502b3162')}", // Arbitrum Sepoliaにデプロイしたプロキシアドレス
    erc20Address: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", // Arbitrum SepoliaのUSDC (またはモックトークン) アドレス
    blockExplorer: "https://sepolia-explorer.arbitrum.io",
    rpcUrl: process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL,
  },
};

// スマートコントラクトのABI（out/RaffleImplementation.solから）
export const RaffleABI = ${JSON.stringify(abi, null, 2)};

${erc20Abi || `// ERC20トークン用の簡易ABI
export const ERC20ABI = [
{
"type": "function",
"name": "approve",
"inputs": [
{
"name": "spender",
"type": "address"
},
{
"name": "amount",
"type": "uint256"
}
],
"outputs": [
{
"name": "",
"type": "bool"
}
],
"stateMutability": "nonpayable"
},
{
"type": "function",
"name": "balanceOf",
"inputs": [
{
"name": "account",
"type": "address"
}
],
"outputs": [
{
"name": "",
"type": "uint256"
}
],
"stateMutability": "view"
},
{
"type": "function",
"name": "allowance",
"inputs": [
{
"name": "owner",
"type": "address" 
},
{
"name": "spender",
"type": "address"
}
],
"outputs": [
{
"name": "",
"type": "uint256"
}
],
"stateMutability": "view"
},
  {
      "inputs": [],
      "name": "decimals",
      "outputs": [
        {
          "internalType": "uint8",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
  {
    "type": "function",
    "name": "transfer",
    "inputs": [
      {
        "name": "recipient",
        "type": "address"
      },
      {
        "name": "amount",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferFrom",
    "inputs": [
      {
        "name": "sender",
        "type": "address"
      },
      {
        "name": "recipient",
        "type": "address"
      },
      {
        "name": "amount",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable"
  }
  ];`}`;
    } else {
      // 新形式の場合はcontractAddressesとraffleAbiの形式
      console.log('契約設定を新形式で更新します');
      
      configContent = `// このファイルは自動生成されています - 手動で編集しないでください
// 最終更新: ${new Date().toISOString()}

export const contractAddresses = {
  ${Object.entries(mergedAddresses).map(([network, address]) => `  ${network}: "${address}"`).join(',\n')}
};

export const raffleAbi = ${JSON.stringify(abi, null, 2)};

${erc20Abi || `// ERC20トークン用の簡易ABI
export const ERC20ABI = [
{
"type": "function",
"name": "approve",
"inputs": [
{
"name": "spender",
"type": "address"
},
{
"name": "amount",
"type": "uint256"
}
],
"outputs": [
{
"name": "",
"type": "bool"
}
],
"stateMutability": "nonpayable"
},
{
"type": "function",
"name": "balanceOf",
"inputs": [
{
"name": "account",
"type": "address"
}
],
"outputs": [
{
"name": "",
"type": "uint256"
}
],
"stateMutability": "view"
},
{
"type": "function",
"name": "allowance",
"inputs": [
{
"name": "owner",
"type": "address" 
},
{
"name": "spender",
"type": "address"
}
],
"outputs": [
{
"name": "",
"type": "uint256"
}
],
"stateMutability": "view"
},
  {
      "inputs": [],
      "name": "decimals",
      "outputs": [
        {
          "internalType": "uint8",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
  {
    "type": "function",
    "name": "transfer",
    "inputs": [
      {
        "name": "recipient",
        "type": "address"
      },
      {
        "name": "amount",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferFrom",
    "inputs": [
      {
        "name": "sender",
        "type": "address"
      },
      {
        "name": "recipient",
        "type": "address"
      },
      {
        "name": "amount",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable"
  }
  ];`}`;
    }
    
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
    const oldAddressFormat = existingContent.includes('export const contractConfig = {');
    
    if (oldAddressFormat) {
      console.log('- sepolia: ' + (isUpgrade ? existingAddresses.sepolia : (newAddresses.sepolia || existingAddresses.sepolia || '0x659F54928a0Ac9EA822C356D05Ec53925A0228E8')) + 
        (isUpgrade ? '' : (newAddresses.sepolia ? ' (新規追加/更新)' : '')));
      console.log('- arbitrumSepolia: ' + (isUpgrade ? existingAddresses.arbitrumSepolia : (newAddresses.arbitrumSepolia || existingAddresses.arbitrumSepolia || '0x0573F6fE1cf8F169181eEc83Ae65BEa5502b3162')) + 
        (isUpgrade ? '' : (newAddresses.arbitrumSepolia ? ' (新規追加/更新)' : '')));
      console.log('- baseSepolia: ' + (isUpgrade ? existingAddresses.baseSepolia : (newAddresses.baseSepolia || existingAddresses.baseSepolia || '0xEEd88f19b0951a7BeE1B52F83Afd333eCdBB6e96')) + 
        (isUpgrade ? '' : (newAddresses.baseSepolia ? ' (新規追加/更新)' : '')));
    } else {
      if (isUpgrade) {
        console.log('アップグレードモード: ABIのみを更新しました。アドレスは維持されています。');
        Object.entries(mergedAddresses).forEach(([network, address]) => {
          console.log(`- ${network}: ${address}`);
        });
      } else {
        Object.entries(mergedAddresses).forEach(([network, address]) => {
          const isNew = newAddresses[network] === address;
          console.log(`- ${network}: ${address}${isNew ? ' (新規追加/更新)' : ''}`);
        });
      }
    }
  } catch (error) {
    console.error('設定ファイルの更新中にエラーが発生しました:', error);
  }
};

// メイン処理
const main = () => {
  const abi = loadAbi();
  let addresses = {};
  
  if (!isUpgradeMode) {
    addresses = getDeployedAddresses();
  } else {
    console.log('アップグレードモード: プロキシアドレスは更新しません');
  }
  
  if (!isUpgradeMode && Object.keys(addresses).length === 0) {
    console.warn('新しくデプロイされたアドレスが見つかりませんでした。既存の設定を保持します。');
  }
  
  updateContractConfig(addresses, abi, isUpgradeMode);
  console.log('処理が完了しました。');
};

main();
