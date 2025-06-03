"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWriteContract,
} from "wagmi";
import { RaffleABI, contractConfig } from "@/app/lib/contract-config";
import { createHandleCancelEntry } from "./use-raffle-cancelentry";
import { useSmartAccountContext } from "@/app/providers/smart-account-provider";

// 分割したフックをインポート
import { useRaffleData } from "./use-raffle-data";
import { useRaffleParticipation } from "./use-raffle-participation";
import { useRaffleAutomation } from "./use-raffle-automation";

// contractConfigのキーの型を定義
type SupportedChainId = keyof typeof contractConfig;

export function useRaffleContract() {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const publicClient = usePublicClient({ chainId });
  const { writeContract } = useWriteContract();

  // スマートアカウント機能を使用
  const { smartAccountAddress, isReadyToSendTx, sendUserOperation } =
    useSmartAccountContext();

  // チェーンIDから正しいコントラクトアドレスを取得
  const currentChainId = chainId || 11155111; // デフォルトはSepolia
  const contractAddress =
    contractConfig[currentChainId as SupportedChainId]?.raffleProxy || null;
  const erc20Address =
    contractConfig[currentChainId as SupportedChainId]?.erc20Address || null;

  // 個別のフックを使用
  const {
    raffleData,
    isLoading: isDataLoading,
    error: dataError,
    updateRaffleData,
    getPlayers,
    getContractEthBalance,
    getContractUsdcBalance,
    getMinimumPlayers,
    getMinPlayersReachedTime,
  } = useRaffleData();

  const {
    isLoading: isParticipationLoading,
    error: participationError,
    isPlayerEntered,
    handleEnterRaffle,
    checkPlayerEntered,
    tokenBalanceInfo,
    checkTokenBalanceWithInfo,
  } = useRaffleParticipation();

  const {
    isLoading: isAutomationLoading,
    error: automationError,
    isUpkeepNeeded,
    checkAutomationStatus,
    checkUpkeepDebug,
    performManualUpkeep,
    performManualUpkeepWithVRF,
    performManualUpkeepWithMock,
    manualPerformUpkeepAsOwner,
  } = useRaffleAutomation(updateRaffleData);

  // エラー状態の統合
  useEffect(() => {
    if (dataError) {
      setError(dataError);
    } else if (participationError) {
      setError(participationError);
    } else if (automationError) {
      setError(automationError);
    } else {
      setError(null);
    }
  }, [dataError, participationError, automationError]);

  // ラッフル参加取り消し処理を拡張してデータ更新を確実にする
  const handleCancelEntry = async () => {
    if (!publicClient || !writeContract)
      return { success: false, error: "Provider not ready" };

    const cancelEntryHandler = createHandleCancelEntry(
      isConnected,
      address,
      contractAddress || "", // null の場合に空文字列を渡す
      checkPlayerEntered,
      publicClient,
      writeContract,
      (loading) => setIsLoading(loading),
      setError,
      updateRaffleData,
      RaffleABI,
      // スマートアカウント対応パラメータを追加
      {
        smartAccountAddress,
        isReadyToSendTx,
        sendUserOperation,
      }
    );

    try {
      const result = await cancelEntryHandler();

      if (result && result.success) {
        // 成功時は強制的にデータを再取得
        console.log("ラッフル参加取り消し成功、データを更新します");

        // 少し遅延させてデータ反映を待つ
        setTimeout(async () => {
          // 全データを再取得
          try {
            await updateRaffleData(true);
          } catch (updateError) {
            console.warn("データ更新エラーは無視します:", updateError);
          }

          // 参加状態を再確認
          try {
            await checkPlayerEntered();
          } catch (checkError) {
            console.warn("参加状態チェックエラーは無視します:", checkError);
          }
        }, 2000);
      }

      return result;
    } catch (error) {
      console.error("拡張取り消し処理エラー:", error);
      throw error;
    }
  };

  // 複数のフックからのローディング状態を統合
  const isLoadingCombined =
    isDataLoading || isParticipationLoading || isAutomationLoading || isLoading;

  // すべてのフックからのデータと関数を統合して返す
  return {
    // データ関連
    raffleData,
    contractAddress,
    erc20Address,
    isLoading: isLoadingCombined,
    error,

    // 参加関連
    isPlayerEntered,
    handleEnterRaffle,
    handleCancelEntry,
    checkPlayerEntered,
    tokenBalanceInfo,
    checkTokenBalanceWithInfo,

    // 自動化関連
    isUpkeepNeeded,
    checkAutomationStatus,
    checkUpkeepDebug,
    performManualUpkeep,
    performManualUpkeepWithVRF,
    performManualUpkeepWithMock,
    manualPerformUpkeepAsOwner,

    // ユーティリティ関数
    updateRaffleData,
    getPlayers,
    getContractEthBalance,
    getContractUsdcBalance,
    getMinimumPlayers,
    getMinPlayersReachedTime,
  };
}
