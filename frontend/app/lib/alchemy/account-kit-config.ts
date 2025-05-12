"use client";

// デバッグフラグ - ログが多すぎる場合はfalseに設定
const DEBUG_MODE = true;

const debugLog = (message: string, ...args: any[]) => {
  if (DEBUG_MODE) {
    console.log(message, ...args);
  }
};

import { type Chain, sepolia, arbitrumSepolia, baseSepolia } from "viem/chains";
import { createPublicClient, custom, type SignableMessage } from "viem";
import { type SmartAccountSigner } from "@alchemy/aa-core";
import { createLightAccountAlchemyClient } from "@alchemy/aa-alchemy";

// 環境変数からAPI Keyを取得
const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "demo";

// チェーンごとのガスマネージャーポリシーIDを設定
const getGasManagerPolicyId = (chainId: number): string | undefined => {
  console.log(`チェーンID ${chainId} のポリシーIDを取得中...`);

  let policyId;
  switch (chainId) {
    case sepolia.id:
      policyId = process.env.NEXT_PUBLIC_ALCHEMY_GAS_MANAGER_POLICY_ID;
      break;
    case baseSepolia.id:
      policyId = process.env.NEXT_PUBLIC_ALCHEMY_GAS_MANAGER_POLICY_ID_BASE;
      break;
    case arbitrumSepolia.id:
      policyId = process.env.NEXT_PUBLIC_ALCHEMY_GAS_MANAGER_POLICY_ID_ARBITRUM;
      break;
    default:
      policyId = process.env.NEXT_PUBLIC_ALCHEMY_GAS_MANAGER_POLICY_ID;
  }

  console.log(`チェーンID ${chainId} のポリシーID: ${policyId}`);
  return policyId;
};

// サポートされるチェーン
export const supportedChains: { [chainId: number]: Chain } = {
  [sepolia.id]: sepolia,
  [arbitrumSepolia.id]: arbitrumSepolia,
  [baseSepolia.id]: baseSepolia,
};

// チェーンIDからRPC URLを取得する関数
export function getAlchemyRpcUrl(chainId: number): string {
  switch (chainId) {
    case sepolia.id:
      return `https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`;
    case arbitrumSepolia.id:
      return `https://arb-sepolia.g.alchemy.com/v2/${alchemyApiKey}`;
    case baseSepolia.id:
      return `https://base-sepolia.g.alchemy.com/v2/${alchemyApiKey}`;
    default:
      console.warn(
        `チェーンID ${chainId} はサポートされていません。Sepoliaを使用します。`
      );
      return `https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`;
  }
}

// Web3Authプロバイダーからスマートアカウントの署名者を作成する関数
export async function createWeb3AuthSigner(
  provider: any
): Promise<SmartAccountSigner> {
  try {
    debugLog("Web3Authプロバイダーからスマートアカウントの署名者を作成中...");

    // プロバイダーのチェック
    if (!provider) {
      throw new Error("プロバイダーが提供されていません");
    }

    // プロバイダーが正しいメソッドを持っているか確認
    if (typeof provider.request !== "function") {
      if (provider._request && typeof provider._request === "function") {
        debugLog("プロバイダーに_requestメソッドがあります。それを使用します");
        const originalProvider = provider;
        provider = {
          request: async (params: any) => {
            return originalProvider._request(params);
          },
        };
      } else {
        throw new Error(
          "互換性のないプロバイダーです。requestメソッドが必要です"
        );
      }
    }

    try {
      // Viemの公開クライアントを作成
      // プロバイダーからチェーンIDを取得し、適切なチェーン設定を使用
      let currentChain = sepolia; // デフォルト値
      try {
        // チェーンIDを取得
        const chainIdHex = (await provider.request({
          method: "eth_chainId",
        })) as string;
        const chainId = parseInt(chainIdHex, 16);
        debugLog("プロバイダーから取得したチェーンID:", chainId);

        // チェーンIDに対応するチェーン設定を使用
        if (chainId === baseSepolia.id) {
          currentChain = baseSepolia as unknown as typeof sepolia;
        } else if (chainId === arbitrumSepolia.id) {
          currentChain = arbitrumSepolia as unknown as typeof sepolia;
        } else if (chainId === sepolia.id) {
          currentChain = sepolia;
        }

        debugLog(`チェーンID ${chainId} (${currentChain.name}) を使用`);
      } catch (chainError) {
        console.warn(
          "チェーンID取得中にエラーが発生しました。Sepoliaを使用します:",
          chainError
        );
      }

      const publicClient = createPublicClient({
        chain: currentChain,
        transport: custom(provider),
      });

      // アカウントアドレスを取得
      const accounts = (await publicClient.request({
        method: "eth_accounts",
      } as any)) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error(
          "Web3Authプロバイダーからアカウントを取得できませんでした"
        );
      }

      const address = accounts[0];
      debugLog("Web3Auth アカウントアドレス:", address);

      // カスタム署名関数を作成
      const signMessage = async (
        message: SignableMessage
      ): Promise<`0x${string}`> => {
        try {
          // 署名可能なメッセージを適切な形式に変換
          let messageToSign;

          if (typeof message === "string") {
            messageToSign = message;
          } else if (message instanceof Uint8Array) {
            messageToSign = Buffer.from(message)
              .toString("hex")
              .startsWith("0x")
              ? Buffer.from(message).toString("hex")
              : "0x" + Buffer.from(message).toString("hex");
          } else if (message.raw instanceof Uint8Array) {
            messageToSign = Buffer.from(message.raw)
              .toString("hex")
              .startsWith("0x")
              ? Buffer.from(message.raw).toString("hex")
              : "0x" + Buffer.from(message.raw).toString("hex");
          } else {
            messageToSign = message.raw; // 0x形式の文字列と仕定
          }

          // personal_sign メソッドを使用
          const signature = (await publicClient.request({
            method: "personal_sign",
            params: [messageToSign, address],
          } as any)) as `0x${string}`;

          return signature;
        } catch (error) {
          console.error("メッセージ署名中にエラーが発生しました:", error);
          throw error;
        }
      };

      // カスタム署名者オブジェクトを作成
      const signer: SmartAccountSigner = {
        signerType: "web3auth" as any,
        inner: provider, // 内部クライアントとしてプロバイダーを設定
        getAddress: async () => address as `0x${string}`,
        signMessage,
        // TypedDataの署名メソッドを実装
        signTypedData: async (params) => {
          try {
            const signature = (await publicClient.request({
              method: "eth_signTypedData_v4",
              params: [address, JSON.stringify(params)],
            } as any)) as `0x${string}`;

            return signature;
          } catch (error) {
            console.error("TypedData署名中にエラーが発生しました:", error);
            throw error;
          }
        },
      };

      return signer;
    } catch (signError) {
      console.error("Viemでのアドレス取得中にエラーが発生しました:", signError);

      // 直接プロバイダーからアドレスを取得する別の方法を試す
      try {
        debugLog("直接プロバイダーからアドレス取得を試みます");
        const accounts = await provider.request({ method: "eth_accounts" });

        if (!accounts || accounts.length === 0) {
          throw new Error("プロバイダーからアカウントを取得できませんでした");
        }

        const address = accounts[0];
        debugLog("直接メソッドで取得したアドレス:", address);

        // 直接プロバイダーを使用した署名関数
        const signMessage = async (
          message: SignableMessage
        ): Promise<`0x${string}`> => {
          try {
            // 署名可能なメッセージを適切な形式に変換
            let messageToSign;

            if (typeof message === "string") {
              messageToSign = message;
            } else if (message instanceof Uint8Array) {
              messageToSign = Buffer.from(message)
                .toString("hex")
                .startsWith("0x")
                ? Buffer.from(message).toString("hex")
                : "0x" + Buffer.from(message).toString("hex");
            } else if (message.raw instanceof Uint8Array) {
              messageToSign = Buffer.from(message.raw)
                .toString("hex")
                .startsWith("0x")
                ? Buffer.from(message.raw).toString("hex")
                : "0x" + Buffer.from(message.raw).toString("hex");
            } else {
              messageToSign = message.raw; // 0x形式の文字列と仕定
            }

            const signature = await provider.request({
              method: "personal_sign",
              params: [messageToSign, address],
            });

            return signature as `0x${string}`;
          } catch (error) {
            console.error(
              "メッセージ署名中にエラーが発生しました(直接メソッド):",
              error
            );
            throw error;
          }
        };

        // 直接メソッドを使用した署名者
        const signer: SmartAccountSigner = {
          signerType: "web3auth" as any,
          inner: provider, // 内部クライアントとしてプロバイダーを設定
          getAddress: async () => address as `0x${string}`,
          signMessage,
          // TypedDataの署名メソッドを実装
          signTypedData: async (params) => {
            try {
              const signature = (await provider.request({
                method: "eth_signTypedData_v4",
                params: [address, JSON.stringify(params)],
              })) as `0x${string}`;

              return signature;
            } catch (error) {
              console.error(
                "TypedData署名中にエラーが発生しました(直接メソッド):",
                error
              );
              throw error;
            }
          },
        };

        return signer;
      } catch (directError) {
        console.error(
          "直接メソッドでのアドレス取得にも失敗しました:",
          directError
        );
        throw directError;
      }
    }
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
  try {
    console.log(`チェーンID: ${chainId} のAlchemyクライアントを作成中...`);

    // チェーンの設定
    let chain;
    if (chainId === sepolia.id) {
      chain = sepolia;
      console.log("Ethereum Sepolia チェーンを使用します");
    } else if (chainId === baseSepolia.id) {
      chain = baseSepolia as unknown as typeof sepolia;
      console.log("Base Sepolia チェーンを使用します");
    } else if (chainId === arbitrumSepolia.id) {
      chain = arbitrumSepolia as unknown as typeof sepolia;
      console.log("Arbitrum Sepolia チェーンを使用します");
    } else {
      console.warn(
        `チェーンID ${chainId} はサポートされていません。Sepoliaを使用します。`
      );
      chain = sepolia;
      chainId = sepolia.id; // 強制的にSepoliaに設定
    }

    // API Keyを取得
    const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
    if (!apiKey) {
      throw new Error("Alchemy API Keyが設定されていません");
    }

    console.log(
      "Alchemyクライアント作成開始 - API Key確認:",
      apiKey ? "設定済み" : "未設定"
    );

    // チェーンに応じたRPC URLとポリシーIDを設定
    let rpcUrl = "";
    let policyId = "";

    if (chainId === sepolia.id) {
      rpcUrl = `https://eth-sepolia.g.alchemy.com/v2/${apiKey}`;
      policyId = process.env.NEXT_PUBLIC_ALCHEMY_GAS_MANAGER_POLICY_ID || "";
      console.log("✅ Ethereum Sepoliaの設定を使用します");
    } else if (chainId === baseSepolia.id) {
      rpcUrl = `https://base-sepolia.g.alchemy.com/v2/${apiKey}`;
      policyId =
        process.env.NEXT_PUBLIC_ALCHEMY_GAS_MANAGER_POLICY_ID_BASE || "";
      console.log("✅ Base Sepoliaの設定を使用します");
    } else if (chainId === arbitrumSepolia.id) {
      rpcUrl = `https://arb-sepolia.g.alchemy.com/v2/${apiKey}`;
      policyId =
        process.env.NEXT_PUBLIC_ALCHEMY_GAS_MANAGER_POLICY_ID_ARBITRUM || "";
      console.log("✅ Arbitrum Sepoliaの設定を使用します");
    }

    // 確認のためにURLのドメイン部分を書き出す
    const domainPart = rpcUrl.split("/")[2] || "unknown";
    console.log(`使用するRPCドメイン: ${domainPart}`);

    console.log(`${chain.name} 用RPC URL: ${rpcUrl.replace(apiKey, "***")}`);
    console.log(`${chain.name} 用ポリシーID: ${policyId}`);

    // --- Gas Manager 設定 ---
    let clientOptions: any = {
      // 型はSDKのバージョンに合わせて調整
      rpcUrl,
      chain,
      signer,
    };

    console.log(
      `クライアントオプション: チェーン=${chain.name}, ID=${chainId}`
    );

    if (policyId) {
      console.log(`Alchemy Gas Manager を使用します。Policy ID: ${policyId}`);
      clientOptions.gasManagerConfig = {
        policyId: policyId,
      };
    } else {
      console.warn(
        "Alchemy Gas Manager Policy IDが設定されていません。ガスレス機能は無効になります。"
      );
    }

    const client = await createLightAccountAlchemyClient(clientOptions);

    console.log(
      `✅ Alchemyクライアント作成成功 (チェーン: ${chain.name}, ID: ${chainId})`
    );

    // アドレスの取得
    const address = await client.getAddress();
    console.log(
      `スマートアカウントアドレス: ${address} (チェーンID: ${chainId})`
    );

    return client;
  } catch (error) {
    console.error("Alchemyクライアントの作成に失敗しました:", error);
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
    sender: userOp.sender || "",
    nonce: userOp.nonce?.toString() || "0",
    initCode: userOp.initCode || "0x",
    callData: userOp.callData || "0x",
    callGasLimit: userOp.callGasLimit?.toString() || "0",
    verificationGasLimit: userOp.verificationGasLimit?.toString() || "0",
    preVerificationGas: userOp.preVerificationGas?.toString() || "0",
    maxFeePerGas: userOp.maxFeePerGas?.toString() || "0",
    maxPriorityFeePerGas: userOp.maxPriorityFeePerGas?.toString() || "0",
    paymasterAndData: userOp.paymasterAndData || "0x",
    signature: userOp.signature || "0x",
  };
}
