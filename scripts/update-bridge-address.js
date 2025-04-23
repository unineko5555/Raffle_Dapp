#!/usr/bin/env node
const { ethers } = require('../frontend/node_modules/ethers');
const fs = require('fs');
const path = require('path');

// ConfigファイルからBRIDGE_CONFIGSを読み込む
const readBridgeConfigs = () => {
  try {
    const configFilePath = path.join(__dirname, '../frontend/app/lib/bridge-contract-config.ts');
    const configContent = fs.readFileSync(configFilePath, 'utf8');
    
    // BRIDGE_CONFIGSの部分を抽出
    const configMatch = configContent.match(/export const BRIDGE_CONFIGS: BridgeContractConfig\[\] = (\[[\s\S]*?\]);/);
    
    if (!configMatch || !configMatch[1]) {
      throw new Error('BRIDGE_CONFIGS not found in configuration file');
    }
    
    // スクリプト実行環境でBRIDGE_CONFIGSを評価
    const evalConfig = new Function(`return ${configMatch[1]}`);
    return evalConfig();
  } catch (error) {
    console.error('Error reading bridge configs:', error);
    process.exit(1);
  }
};

// ABIの一部（updateDestinationBridgeContract関数のみ）
const abi = [
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "chainSelector",
        "type": "uint64"
      },
      {
        "internalType": "address",
        "name": "bridgeContract",
        "type": "address"
      }
    ],
    "name": "updateDestinationBridgeContract",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// チェーンセレクタの対応
const CHAIN_SELECTOR_MAP = {
  "sepolia": "16015286601757825753",
  "base-sepolia": "5790810961207155433",
  "arbitrum-sepolia": "3478487238524512106"
};



// 設定
async function main() {
  // 環境変数から秘密鍵を取得、なければ引数から取得
  const privateKey = process.env.PRIVATE_KEY || process.argv[2];
  if (!privateKey) {
    console.error('秘密鍵が指定されていません。PRIVATE_KEY環境変数または引数として渡してください。');
    process.exit(1);
  }

  // RPC URLを環境変数から取得
  const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL;
  const baseRpcUrl = process.env.BASE_SEPOLIA_RPC_URL;
  const arbitrumRpcUrl = process.env.ARBITRUM_SEPOLIA_RPC_URL;
  
  if (!sepoliaRpcUrl || !baseRpcUrl || !arbitrumRpcUrl) {
    console.error('必要なRPC URLが環境変数に設定されていません。');
    console.error('backend/.envファイルに以下を設定してください:');
    console.error('SEPOLIA_RPC_URL=...');
    console.error('BASE_SEPOLIA_RPC_URL=...');
    console.error('ARBITRUM_SEPOLIA_RPC_URL=...');
    process.exit(1);
  }
  
  console.log(`使用するRPC URL:`);
  console.log(`- Sepolia: ${sepoliaRpcUrl}`);
  console.log(`- Base Sepolia: ${baseRpcUrl}`);
  console.log(`- Arbitrum Sepolia: ${arbitrumRpcUrl}`);

  // bridge-contract-config.tsからブリッジアドレスを読み込む
  const bridgeConfigs = readBridgeConfigs();
  console.log('Bridge configurations loaded successfully:');
  
  // 必要な情報を抽出
  const configMap = {};
  const chainIdToNameMap = {};
  
  bridgeConfigs.forEach(config => {
    console.log(`- ${config.chainName}: ${config.bridgeAddress} (Chain ID: ${config.networkId})`);
    configMap[config.chainName] = {
      address: config.bridgeAddress,
      chainId: config.networkId,
      ccipSelector: config.ccipSelector || CHAIN_SELECTOR_MAP[config.chainName]
    };
    chainIdToNameMap[config.networkId] = config.chainName;
  });

  // 各チェーンについて処理
  for (const sourceChain of bridgeConfigs) {
    const sourceChainName = sourceChain.chainName;
    const sourceBridgeAddress = sourceChain.bridgeAddress;
    const sourceChainId = sourceChain.networkId;
    
    console.log(`\n処理中のソースチェーン: ${sourceChainName} (${sourceBridgeAddress})`);
    

    
    // 宛先チェーンのリストを作成（ソースチェーン以外のすべて）
    const destinationChains = bridgeConfigs.filter(c => c.chainName !== sourceChainName);
    
    try {
      // プロバイダーとウォレットの設定
      let provider;
      
      // チェーンに応じて適切なRPC URLを使用
      if (sourceChainName === 'sepolia') {
        console.log(`  Sepolia RPC URLを使用: ${sepoliaRpcUrl}`);
        provider = new ethers.providers.JsonRpcProvider(sepoliaRpcUrl);
      } else if (sourceChainName === 'base-sepolia') {
        console.log(`  Base Sepolia RPC URLを使用: ${baseRpcUrl}`);
        provider = new ethers.providers.JsonRpcProvider(baseRpcUrl);
      } else if (sourceChainName === 'arbitrum-sepolia') {
        console.log(`  Arbitrum Sepolia RPC URLを使用: ${arbitrumRpcUrl}`);
        provider = new ethers.providers.JsonRpcProvider(arbitrumRpcUrl);
      } else {
        console.error(`  不明なチェーン名: ${sourceChainName}`);
        continue;
      }
      
      const wallet = new ethers.Wallet(privateKey, provider);
      
      // コントラクトインスタンスの作成
      const contract = new ethers.Contract(sourceBridgeAddress, abi, wallet);
      
      // 各宛先チェーンに対して更新処理を実行
      for (const destChain of destinationChains) {
        const destChainName = destChain.chainName;
        const destBridgeAddress = destChain.bridgeAddress;
        const destChainSelector = destChain.ccipSelector || CHAIN_SELECTOR_MAP[destChainName];
        
        console.log(`  宛先チェーン ${destChainName} のブリッジアドレス ${destBridgeAddress} をセットします... (チェーンセレクタ: ${destChainSelector})`);


        
        try {
          // ガス見積もり
          const gasEstimate = await contract.estimateGas.updateDestinationBridgeContract(
            destChainSelector,
            destBridgeAddress
          );
          
          // トランザクションの送信
          const tx = await contract.updateDestinationBridgeContract(
            destChainSelector,
            destBridgeAddress,
            {
              gasLimit: gasEstimate.mul(120).div(100) // 20%増し
            }
          );
          
          console.log(`  トランザクション送信: ${tx.hash}`);
          
          // トランザクションの完了を待機
          const receipt = await tx.wait();
          console.log(`  トランザクション完了: ガス使用量 ${receipt.gasUsed.toString()}`);
        } catch (error) {
          console.error(`  トランザクション実行中にエラーが発生しました: ${error.message}`);
        }
      }
    } catch (error) {
      console.error(`ネットワーク接続中にエラーが発生しました: ${error.message}`);
    }
  }
}

// スクリプトの実行
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
