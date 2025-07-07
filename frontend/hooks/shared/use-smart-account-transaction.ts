"use client";

import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { encodeFunctionData, type Abi } from "viem";
import { useSmartAccountContext } from "@/app/providers/smart-account-provider";

export interface TransactionConfig {
  contractAddress: string;
  abi: Abi;
  functionName: string;
  args?: any[];
  value?: bigint;
  gasOptimization?: {
    chainId: number;
    baseGasLimit?: bigint;
    gasBufferPercent?: number;
  };
}

export interface TransactionResult {
  txHash?: string;
  success: boolean;
  error?: string;
}

/**
 * スマートアカウントとEOAの取引を統一的に処理するフック
 * 複数のフックで重複していたAA/EOA分岐ロジックとガス最適化を統合
 */
export function useSmartAccountTransaction() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  
  const {
    smartAccountAddress,
    sendUserOperation,
    isReadyToSendTx,
  } = useSmartAccountContext();

  /**
   * トランザクションを実行（スマートアカウント or EOA）
   */
  const executeTransaction = async (config: TransactionConfig): Promise<TransactionResult> => {
    const { contractAddress, abi, functionName, args = [], value = BigInt(0), gasOptimization } = config;
    
    if (!contractAddress) {
      return { success: false, error: "コントラクトアドレスが指定されていません" };
    }
    
    // スマートアカウントまたはEOAのいずれかが使用可能かチェック
    const hasValidConnection = (isReadyToSendTx && smartAccountAddress) || (isConnected && address);
    if (!hasValidConnection) {
      return { success: false, error: "ウォレットが接続されていません" };
    }

    const useSmartAccount = isReadyToSendTx && smartAccountAddress && sendUserOperation;

    try {
      if (useSmartAccount && sendUserOperation) {
        // スマートアカウント経由での実行
        const callData = encodeFunctionData({
          abi,
          functionName,
          args,
        });

        const result = await sendUserOperation(
          contractAddress as `0x${string}`,
          callData,
          value
        );

        if (result?.txHash && publicClient) {
          // トランザクション確認
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: result.txHash as `0x${string}`,
            timeout: 60000,
          });

          if (receipt.status === "reverted") {
            return { success: false, error: "スマートアカウント取引がリバートしました" };
          }

          return { success: true, txHash: result.txHash };
        }

        return { success: false, error: "スマートアカウント取引の送信に失敗しました" };
      } else if (isConnected && address && publicClient && writeContractAsync) {
        // EOA経由での実行（ガス最適化対応）
        let txParams: any = {
          address: contractAddress as `0x${string}`,
          abi,
          functionName,
          args,
          account: address,
          value,
        };

        // Base Sepolia等のL2ガス最適化
        if (gasOptimization && gasOptimization.chainId === 84532) {
          try {
            const gasEstimate = await publicClient.estimateContractGas({
              address: contractAddress as `0x${string}`,
              abi,
              functionName,
              args,
              account: address,
              value,
            });
            
            const bufferPercent = gasOptimization.gasBufferPercent || 30;
            txParams.gas = gasEstimate + (gasEstimate * BigInt(bufferPercent)) / BigInt(100);
          } catch (gasError) {
            console.warn("ガス推定エラー - デフォルト値を使用:", gasError);
            txParams.gas = gasOptimization.baseGasLimit || BigInt(2500000);
          }
        }

        const txHash = await writeContractAsync(txParams);

        if (!txHash) {
          return { success: false, error: "EOA取引の送信に失敗しました" };
        }

        // トランザクション確認
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
          timeout: 60000,
        });

        if (receipt.status === "reverted") {
          return { success: false, error: "EOA取引がリバートしました" };
        }

        return { success: true, txHash };
      }

      return { success: false, error: "ウォレット接続の状態が無効です" };
    } catch (error: any) {
      console.error("取引実行エラー:", error);
      return { 
        success: false, 
        error: error?.message || "取引の実行に失敗しました" 
      };
    }
  };

  /**
   * 現在の実行モードを取得
   */
  const getExecutionMode = () => {
    const useSmartAccount = isReadyToSendTx && smartAccountAddress && sendUserOperation;
    
    if (useSmartAccount) {
      return {
        mode: "smart-account" as const,
        address: smartAccountAddress,
        isReady: true,
      };
    } else if (isConnected && address) {
      return {
        mode: "eoa" as const,
        address,
        isReady: true,
      };
    }
    
    return {
      mode: "none" as const,
      address: null,
      isReady: false,
    };
  };

  /**
   * アクティブなアドレスを取得
   */
  const getActiveAddress = () => {
    const executionMode = getExecutionMode();
    return executionMode.address;
  };

  return {
    executeTransaction,
    getExecutionMode,
    getActiveAddress,
    isSmartAccountReady: isReadyToSendTx && !!smartAccountAddress && !!sendUserOperation,
    isEOAReady: isConnected && !!address,
  };
}