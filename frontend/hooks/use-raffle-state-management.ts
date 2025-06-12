"use client";

import { useState } from "react";
import { useWriteContract, useChainId, useAccount, useWaitForTransactionReceipt } from "wagmi";
import { RaffleABI, contractConfig } from "@/app/lib/contract-config";
import { useSmartAccountContext } from "@/app/providers/smart-account-provider";

// contractConfigのキーの型を定義
type SupportedChainId = keyof typeof contractConfig;

// ラッフル状態の型定義
export enum RaffleState {
  OPEN = 0,
  CALCULATING_WINNER = 1,
  WINNER_SELECTED = 2,
  CLOSED = 3,
}

export function useRaffleStateManagement() {
  const chainId = useChainId();
  const { address } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const { writeContract, writeContractAsync, data: writeData, isPending: isWritePending } = useWriteContract();

  // トランザクションの完了を待つ
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: writeData,
  });

  // スマートアカウント機能を使用
  const { smartAccountAddress, isReadyToSendTx, sendUserOperation } =
    useSmartAccountContext();

  // チェーンIDから正しいコントラクトアドレスを取得
  // サポートされているチェーンIDのみを受け入れ、不正な場合はnullを返す
  const supportedChainIds = [11155111, 84532, 421614] as const;
  const isValidChainId = chainId && supportedChainIds.includes(chainId as any);
  const currentChainId = isValidChainId ? chainId : null;
  const contractAddress = currentChainId ? 
    contractConfig[currentChainId as SupportedChainId]?.raffleProxy || null : null;

  // 状態名を取得するヘルパー関数
  const getStateName = (state: RaffleState): string => {
    switch (state) {
      case RaffleState.OPEN:
        return "OPEN";
      case RaffleState.CALCULATING_WINNER:
        return "CALCULATING_WINNER";
      case RaffleState.WINNER_SELECTED:
        return "WINNER_SELECTED";
      case RaffleState.CLOSED:
        return "CLOSED";
      default:
        return "UNKNOWN";
    }
  };

  // ラッフル状態をenumで設定
  const setRaffleState = async (newState: RaffleState) => {
    if (!contractAddress) {
      const errorMsg = "Contract address not found";
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    if (!address && !smartAccountAddress) {
      const errorMsg = "No wallet connected";
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    setIsLoading(true);
    setError(null);
    setTxHash(null);

    try {
      console.log(`状態変更開始: ${getStateName(newState)} (${newState})`);
      
      // writeContractAsyncを使用して非同期処理を正しく待つ
      const hash = await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: RaffleABI,
        functionName: "setRaffleState",
        args: [newState],
      });

      console.log("トランザクションハッシュ:", hash);
      setTxHash(hash);
      
      return { success: true, txHash: hash };
    } catch (error) {
      console.error(`状態変更エラー:`, error);
      let errorMessage = "未知のエラー";
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (errorMessage.includes("User rejected")) {
          errorMessage = "ユーザーがトランザクションを拒否しました";
        } else if (errorMessage.includes("insufficient funds")) {
          errorMessage = "残高が不足しています";
        } else if (errorMessage.includes("Only owner")) {
          errorMessage = "オーナーのみが実行できる操作です";
        } else if (errorMessage.includes("execution reverted")) {
          errorMessage = "コントラクトの実行が失敗しました";
        }
      }
      
      setError(`状態変更に失敗しました: ${errorMessage}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };


  return {
    // 状態
    isLoading: isLoading || isWritePending || isConfirming,
    error,
    contractAddress,
    txHash,
    isConfirmed,

    // 関数
    setRaffleState,

    // ヘルパー
    getStateName,
    RaffleState,
  };
}
