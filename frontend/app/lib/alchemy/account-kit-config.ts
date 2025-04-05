"use client";

import { Chain, sepolia, arbitrumSepolia, baseSepolia } from "viem/chains";
import { 
  LightAccountFactoryAddress, 
  createAlchemySmartAccountClient, 
  createLightAccount, 
  createMultiOwnerModularAccount, 
  type AlchemySmartAccountClient,
  type AlchemyProvider
} from "@alchemy/aa-alchemy";
import { 
  createSmartAccountClient, 
  type SmartAccountSigner,
  localSmartAccountSigner,
  LocalAccountSigner
} from "@alchemy/aa-core";
import { 
  toSmartAccountSigner,
  convertWalletClientToAccountSigner
} from "@alchemy/aa-accounts";
import { type Web3Provider } from "@ethersproject/providers";
import { createPublicClient, custom } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// 環境変数からAPI Keyを取得
const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "demo";

// サポートされるチェーンの設定
export const supportedChains: { [chainId: number]: Chain } = {
  [sepolia.id]: sepolia,
  [baseSepolia.id]: baseSepolia,
  [arbitrumSepolia.id]: arbitrumSepolia,
};

// チェーンIDからRPC URLを取得する関数
export function getAlchemyRpcUrl(chainId: number): string {
  switch (chainId) {
    case sepolia.id:
      return `https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`;
    case baseSepolia.id:
      return `https://base-sepolia.g.alchemy.com/v2/${alchemyApiKey}`;
    case arbitrumSepolia.id:
      return `https://arb-sepolia.g.alchemy.com/v2/${alchemyApiKey}`;
    default:
      return `https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`;
  }
}

// Web3AuthプロバイダーからSmartAccountSignerを作成する関数
export async function createWeb3AuthSigner(provider: any): Promise<SmartAccountSigner> {
  try {
    console.log("Web3Authプロバイダーからスマートアカウントの署名者を作成中...");
    
    // プロバイダーのチェック
    if (!provider) {
      throw new Error("プロバイダーが提供されていません");
    }
    
    // Viemの公開クライアントを作成
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: custom(provider),
    });

    // アカウントアドレスを取得
    const accounts = (await publicClient.request({
      method: "eth_accounts",
    } as any)) as string[];

    if (!accounts || accounts.length === 0) {
      throw new Error("Web3Authプロバイダーからアカウントを取得できませんでした");
    }

    const address = accounts[0];
    console.log("Web3Auth アカウントアドレス:", address);

    // カスタム署名関数を作成
    const signMessage = async (message: string | Uint8Array): Promise<`0x${string}`> => {
      try {
        // message が Uint8Array の場合は 16進数文字列に変換
        const messageToSign = typeof message === 'string' 
          ? message 
          : Buffer.from(message).toString('hex').startsWith('0x') 
            ? Buffer.from(message).toString('hex') 
            : '0x' + Buffer.from(message).toString('hex');
        
        // personal_sign メソッドを使用
        const signature = await publicClient.request({
          method: "personal_sign",
          params: [messageToSign, address],
        } as any) as `0x${string}`;
        
        return signature;
      } catch (error) {
        console.error("メッセージ署名中にエラーが発生しました:", error);
        throw error;
      }
    };

    // カスタム署名者オブジェクトを作成
    const signer: SmartAccountSigner = {
      signerType: "web3auth" as any,
      getAddress: async () => address as `0x${string}`,
      signMessage,
    };

    return signer;
  } catch (error) {
    console.error("Web3Auth署名者の作成中にエラーが発生しました:", error);
    throw error;
  }
}

// LightAccountを作成する関数
export async function createLightSmartAccountClient(
  signer: SmartAccountSigner,
  chainId: number = sepolia.id
): Promise<AlchemySmartAccountClient> {
  try {
    console.log(`チェーンID ${chainId} のLightSmartAccountを作成中...`);
    
    // チェーン設定を取得
    const chain = supportedChains[chainId] || sepolia;
    
    // RPC URLを取得
    const rpcUrl = getAlchemyRpcUrl(chainId);
    
    // LightAccountファクトリーを使用してアカウントを作成
    const smartAccountClient = await createAlchemySmartAccountClient({
      apiKey: alchemyApiKey,
      chain,
      signer,
      account: await createLightAccount({
        chain,
        signer,
        factoryAddress: LightAccountFactoryAddress,
      }),
      gasManagerConfig: {
        policyId: process.env.NEXT_PUBLIC_ALCHEMY_GAS_POLICY_ID,
      },
    });
    
    console.log(`LightSmartAccount作成完了：${await smartAccountClient.getAddress()}`);
    return smartAccountClient;
  } catch (error) {
    console.error("LightSmartAccountの作成中にエラーが発生しました:", error);
    throw error;
  }
}

// UserOperationデータの型定義
export interface UserOperationData {
  sender: string;
  nonce: string;
  initCode: string;
  callData: string;
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  paymasterAndData: string;
  signature: string;
}

// UserOperationをフォーマットする関数
export function formatUserOperation(userOp: any): UserOperationData {
  return {
    sender: userOp.sender,
    nonce: userOp.nonce.toString(),
    initCode: userOp.initCode,
    callData: userOp.callData,
    callGasLimit: userOp.callGasLimit.toString(),
    verificationGasLimit: userOp.verificationGasLimit.toString(),
    preVerificationGas: userOp.preVerificationGas.toString(),
    maxFeePerGas: userOp.maxFeePerGas.toString(),
    maxPriorityFeePerGas: userOp.maxPriorityFeePerGas.toString(),
    paymasterAndData: userOp.paymasterAndData,
    signature: userOp.signature,
  };
}
