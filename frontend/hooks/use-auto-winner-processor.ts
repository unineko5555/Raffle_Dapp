import { useCallback, useRef, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { encodeFunctionData } from "viem";
import { RaffleABI } from "@/app/lib/contract-config";
import { useWriteContract, useAccount, usePublicClient } from "wagmi";

interface UseAutoWinnerProcessorOptions {
  contractAddress?: string;
  raffleState: number;
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
  raffleState,
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

  // 🎯 自動processWinner実行関数（最適化版）
  const autoProcessWinner = useCallback(async () => {
    if (!contractAddress || (!isConnected && !isReadyToSendTx)) return;
    if (raffleState !== 2) return; // WINNER_SELECTED状態でない場合は何もしない
    
    console.log("🎯 WINNER_SELECTED状態を検出 - 自動で勝者処理を実行");
    
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
    raffleState,
    smartAccountAddress,
    sendUserOperation,
    address,
    publicClient,
    writeContractAsync,
    updateRaffleData,
    toast
  ]);

  // 🎯 WINNER_SELECTED状態の自動監視と処理（最適化版）
  const autoProcessWinnerRef = useRef(false);
  
  useEffect(() => {
    if (raffleState === 2 && !autoProcessWinnerRef.current) { // WINNER_SELECTED状態を検出
      console.log("🔍 WINNER_SELECTED状態を検出 - 2秒後に自動処理を開始");
      autoProcessWinnerRef.current = true;
      
      // 少し遅延させて状態が安定してから実行（タイムアウトを短縮）
      const timer = setTimeout(() => {
        autoProcessWinner();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
    
    // 状態がリセットされた場合はフラグもリセット
    if (raffleState !== 2) {
      autoProcessWinnerRef.current = false;
    }
  }, [raffleState, autoProcessWinner]); // raffleStateが変更されたときのみ実行

  return {
    autoProcessWinner,
  };
}