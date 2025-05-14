"use client";

import { type Chain, sepolia, arbitrumSepolia, baseSepolia } from "viem/chains";
import { createPublicClient, custom, type SignableMessage } from "viem";
import { type SmartAccountSigner } from "@alchemy/aa-core";
import { createLightAccountAlchemyClient } from "@alchemy/aa-alchemy";

// 環境変数からAPI Keyを取得
const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "demo";

// チェーン設定のマッピング
const CHAIN_CONFIG = {
  [sepolia.id]: {
    chain: sepolia,
    rpcUrl: `https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`,
    policyId: process.env.NEXT_PUBLIC_ALCHEMY_GAS_MANAGER_POLICY_ID,
    name: "Ethereum Sepolia"
  },
  [baseSepolia.id]: {
    chain: baseSepolia,
    rpcUrl: `https://base-sepolia.g.alchemy.com/v2/${alchemyApiKey}`,
    policyId: process.env.NEXT_PUBLIC_ALCHEMY_GAS_MANAGER_POLICY_ID_BASE,
    name: "Base Sepolia"
  },
  [arbitrumSepolia.id]: {
    chain: arbitrumSepolia,
    rpcUrl: `https://arb-sepolia.g.alchemy.com/v2/${alchemyApiKey}`,
    policyId: process.env.NEXT_PUBLIC_ALCHEMY_GAS_MANAGER_POLICY_ID_ARBITRUM,
    name: "Arbitrum Sepolia"
  }
};

// Web3Authプロバイダーからスマートアカウントの署名者を作成する関数
export async function createWeb3AuthSigner(provider: any): Promise<SmartAccountSigner> {
  if (!provider) {
    throw new Error("プロバイダーが提供されていません");
  }

  // プロバイダーが正しいメソッドを持っているか確認
  if (typeof provider.request !== "function") {
    if (provider._request && typeof provider._request === "function") {
      const originalProvider = provider;
      provider = {
        request: async (params: any) => originalProvider._request(params)
      };
    } else {
      throw new Error("互換性のないプロバイダーです。requestメソッドが必要です");
    }
  }

  try {
    // チェーンIDを取得
    let currentChain = sepolia;
    try {
      const chainIdHex = await provider.request({ method: "eth_chainId" }) as string;
      const chainId = parseInt(chainIdHex, 16);
      
      // チェーンIDに対応するチェーン設定を使用
      if (chainId === baseSepolia.id) {
        currentChain = baseSepolia as any;
      } else if (chainId === arbitrumSepolia.id) {
        currentChain = arbitrumSepolia as any;
      }
    } catch (chainError) {
      console.warn("チェーンID取得中にエラーが発生しました。Sepoliaを使用します:", chainError);
    }

    const publicClient = createPublicClient({
      chain: currentChain,
      transport: custom(provider),
    });

    // アカウントアドレスを取得
    const accounts = await publicClient.request({
      method: "eth_accounts",
    } as any) as string[];

    if (!accounts || accounts.length === 0) {
      throw new Error("Web3Authプロバイダーからアカウントを取得できませんでした");
    }

    const address = accounts[0];

    // 署名関数
    const signMessage = async (message: SignableMessage): Promise<`0x${string}`> => {
      let messageToSign;
      
      if (typeof message === "string") {
        messageToSign = message;
      } else if (message instanceof Uint8Array) {
        messageToSign = Buffer.from(message).toString("hex").startsWith("0x")
          ? Buffer.from(message).toString("hex")
          : "0x" + Buffer.from(message).toString("hex");
      } else if (message.raw instanceof Uint8Array) {
        messageToSign = Buffer.from(message.raw).toString("hex").startsWith("0x")
          ? Buffer.from(message.raw).toString("hex")
          : "0x" + Buffer.from(message.raw).toString("hex");
      } else {
        messageToSign = message.raw;
      }

      return await publicClient.request({
        method: "personal_sign",
        params: [messageToSign, address],
      } as any) as `0x${string}`;
    };

    // 署名者オブジェクトを作成
    const signer: SmartAccountSigner = {
      signerType: "web3auth" as any,
      inner: provider,
      getAddress: async () => address as `0x${string}`,
      signMessage,
      signTypedData: async (params) => {
        return await publicClient.request({
          method: "eth_signTypedData_v4",
          params: [address, JSON.stringify(params)],
        } as any) as `0x${string}`;
      },
    };

    return signer;
  } catch (error) {
    console.error("Web3Auth署名者の作成中にエラーが発生しました:", error);
    throw error;
  }
}

// LightSmartAccountClientを作成する関数
export async function createLightSmartAccountClient(
  signer: SmartAccountSigner,
  chainId: number = sepolia.id
): Promise<any> {
  const chainConfig = CHAIN_CONFIG[chainId as keyof typeof CHAIN_CONFIG];
  
  if (!chainConfig) {
    console.warn(`チェーンID ${chainId} はサポートされていません。Sepoliaを使用します。`);
    chainId = sepolia.id;
  }

  const config = CHAIN_CONFIG[chainId as keyof typeof CHAIN_CONFIG];
  
  if (!process.env.NEXT_PUBLIC_ALCHEMY_API_KEY) {
    throw new Error("Alchemy API Keyが設定されていません");
  }

  const clientOptions: any = {
    rpcUrl: config.rpcUrl,
    chain: config.chain,
    signer,
  };

  if (config.policyId) {
    clientOptions.gasManagerConfig = {
      policyId: config.policyId,
    };
  }

  const client = await createLightAccountAlchemyClient(clientOptions);
  return client;
}

// UserOperationデータの型定義（必要な場合のみ）
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
