import { useCallback, useRef, useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { encodeFunctionData } from "viem";
import { RaffleABI } from "@/app/lib/contract-config";
import { useWriteContract, useAccount, usePublicClient } from "wagmi";

interface UseAutoWinnerProcessorOptions {
  contractAddress?: string;
  isConnected: boolean;
  isReadyToSendTx: boolean;
  smartAccountAddress?: string;
  sendUserOperation?: (
    to: `0x${string}`,
    data: `0x${string}`,
    value: bigint
  ) => Promise<any>;
  updateRaffleData: (forceUpdate?: boolean) => void;
}

interface UseAutoWinnerProcessorReturn {
  autoProcessWinner: () => Promise<void>;
}

export function useAutoWinnerProcessor({
  contractAddress,
  isConnected,
  isReadyToSendTx,
  smartAccountAddress,
  sendUserOperation,
  updateRaffleData,
}: UseAutoWinnerProcessorOptions): UseAutoWinnerProcessorReturn {
  const { toast } = useToast();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  // コントラクト状態監視とポーリング制御
  const [isPolling, setIsPolling] = useState(true);
  const [hasProcessedWinner, setHasProcessedWinner] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 🎯 自動processWinner実行関数（最適化版）
  const autoProcessWinner = useCallback(async () => {
    if (!contractAddress || (!isConnected && !isReadyToSendTx)) return;
    if (hasProcessedWinner) return; // 既に処理済みの場合は実行しない
    
    console.log("🎯 コントラクト状態からWINNER_SELECTED検知 - 自動で勝者処理を実行");
    
    // 処理中フラグを設定して重複実行を防止
    setHasProcessedWinner(true);
    setIsPolling(false); // ポーリングを停止
    
    try {
      const useSmartAccount = isReadyToSendTx && smartAccountAddress && sendUserOperation;
      
      if (useSmartAccount && sendUserOperation) {
        console.log("🤖 スマートアカウントで自動勝者処理を実行中...");
        
        const processWinnerCallData = encodeFunctionData({
          abi: RaffleABI,
          functionName: "processWinner",
          args: [],
        });

        const result = await sendUserOperation(
          contractAddress as `0x${string}`,
          processWinnerCallData,
          BigInt(0)
        );
        
        console.log("✅ スマートアカウント: 自動勝者処理完了", result?.txHash);
      } else if (isConnected && address && publicClient && writeContractAsync) {
        console.log("🔑 EOAで自動勝者処理を実行中...");
        
        const txHash = await writeContractAsync({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "processWinner",
          args: [],
          account: address,
        });

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
          timeout: 45000 // タイムアウトを短縮
        });

        if (receipt.status === "reverted") {
          throw new Error("自動勝者処理トランザクションが失敗しました");
        }

        console.log("✅ EOA: 自動勝者処理完了");
      }
      
      // 成功後にデータを更新（タイムアウトを長めに設定）
      setTimeout(() => {
        console.log('🔄 自動勝者処理後のデータ更新...');
        updateRaffleData(true);
      }, 5000);
      
      // 成功通知
      toast({
        title: "🏆 勝者決定完了",
        description: "勝者が自動的に決定され、賞金が払い出されました！",
        variant: "default",
      });
      
    } catch (error: any) {
      console.error("❌ 自動勝者処理エラー:", error);
      
      // エラー時は処理済みフラグをリセットして再試行可能にする
      setHasProcessedWinner(false);
      setIsPolling(true); // ポーリングを再開
      
      // より詳細なエラーハンドリング
      const isTimeout = error.message?.includes('timeout') || error.message?.includes('Time');
      const isRevert = error.message?.includes('revert');
      
      let errorDescription = "管理パネルから手動で勝者処理を実行してください";
      if (isTimeout) {
        errorDescription = "処理に時間がかかっています。ブロックエクスプローラーで確認してください";
      } else if (isRevert) {
        errorDescription = "トランザクションが失敗しました。条件を確認してください";
      }
      
      // エラー通知（ユーザーフレンドリー）
      toast({
        title: "⚠️ 自動処理エラー",
        description: errorDescription,
        variant: "destructive",
      });
    }
  }, [
    contractAddress,
    isConnected,
    isReadyToSendTx,
    hasProcessedWinner,
    smartAccountAddress,
    sendUserOperation,
    address,
    publicClient,
    writeContractAsync,
    updateRaffleData,
    toast
  ]);

  // 🎯 コントラクト状態の直接ポーリング監視（バックグラウンド実行）
  useEffect(() => {
    if (!contractAddress || !publicClient || !isPolling) return;
    
    const pollContractState = async () => {
      try {
        // フロントエンド状態を無視して、直接コントラクトから読み取り
        const currentState = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "getRaffleState"
        });
        
        const stateNumber = Number(currentState);
        console.log("🔍 コントラクト状態ポーリング結果:", stateNumber);
        
        // コントラクト状態が2(WINNER_SELECTED)なら即座に実行
        if (stateNumber === 2 && !hasProcessedWinner) {
          console.log("🚨 コントラクトでWINNER_SELECTED状態検知 - 自動処理開始");
          await autoProcessWinner();
        }
        
        // 状態が0(OPEN)にリセットされた場合、処理済みフラグをリセット
        if (stateNumber === 0 && hasProcessedWinner) {
          console.log("🔄 ラッフル状態がOPENにリセット - フラグをリセット");
          setHasProcessedWinner(false);
          setIsPolling(true);
        }
        
      } catch (error) {
        console.error("❌ コントラクト状態ポーリングエラー:", error);
      }
    };
    
    // 初回即座に実行
    pollContractState();
    
    // 3秒間隔でポーリング（タブが非アクティブでも継続）
    pollingIntervalRef.current = setInterval(pollContractState, 3000);
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [contractAddress, publicClient, isPolling, hasProcessedWinner, autoProcessWinner]);
  
  // クリーンアップ
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  return {
    autoProcessWinner,
  };
}