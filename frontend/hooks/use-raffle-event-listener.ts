import { useEffect, useCallback, useRef } from "react";
import { usePublicClient } from "wagmi";
import { useToast } from "@/components/ui/use-toast";
import { type Log, type Abi } from "viem";
import { RaffleABI } from "@/app/lib/contract-config";
import { useContractConfig } from "./shared/use-contract-config";
import { useSmartAccountTransaction } from "./shared/use-smart-account-transaction";

interface UseRaffleEventListenerOptions {
  updateRaffleData: (forceUpdate?: boolean) => void;
}

export function useRaffleEventListener({
  updateRaffleData,
}: UseRaffleEventListenerOptions) {
  const { toast } = useToast();
  const publicClient = usePublicClient();
  const { contractAddress, isValidChainId } = useContractConfig();
  const { executeTransaction } = useSmartAccountTransaction();
  
  const isProcessingRef = useRef(false);
  const unwatchRef = useRef<(() => void) | null>(null);

  // updateRaffleDataの安定した参照を保持
  const updateRaffleDataRef = useRef(updateRaffleData);
  updateRaffleDataRef.current = updateRaffleData;

  // 🎯 自動processWinner実行関数
  const autoProcessWinner = useCallback(async () => {
    if (!contractAddress || isProcessingRef.current) return;
    
    console.log("🎯 イベント監視: 自動勝者処理開始");
    isProcessingRef.current = true;
    
    try {
      const result = await executeTransaction({
        contractAddress,
        abi: RaffleABI as Abi,
        functionName: "processWinner",
        args: [],
        value: BigInt(0),
        gasOptimization: {
          chainId: publicClient?.chain?.id || 0,
          gasBufferPercent: 20,
        },
      });

      if (result.success) {
        console.log("✅ イベント監視: 自動勝者処理完了", result.txHash);
        
        // 成功後にデータを更新
        setTimeout(() => {
          updateRaffleDataRef.current(true);
        }, 3000);
        
        toast({
          title: "🏆 勝者決定完了",
          description: "勝者が自動的に決定され、賞金が払い出されました！",
          variant: "default",
        });
      } else {
        throw new Error(result.error || "トランザクション失敗");
      }
    } catch (error: any) {
      console.error("❌ イベント監視: 自動勝者処理エラー:", error);
      
      toast({
        title: "⚠️ 自動処理エラー",
        description: "管理パネルから手動で勝者処理を実行してください",
        variant: "destructive",
      });
    } finally {
      isProcessingRef.current = false;
    }
  }, [
    contractAddress,
    executeTransaction,
    publicClient,
  ]);

  // 🔥 イベント監視の開始
  useEffect(() => {
    if (!contractAddress || !publicClient || !isValidChainId) return;

    console.log("🔥 ラッフルイベント監視開始:", contractAddress);

    // 既存のリスナーをクリーンアップ
    if (unwatchRef.current) {
      unwatchRef.current();
    }

    try {
      // RandomWordsReceived イベント監視
      const unwatchRandomWords = publicClient.watchContractEvent({
        address: contractAddress as `0x${string}`,
        abi: RaffleABI as Abi,
        eventName: "RandomWordsReceived",
        onLogs: (logs) => {
          console.log("🎲 RandomWordsReceived イベント検知:", logs);
          
          logs.forEach((log: Log & { args?: any }) => {
            if (log.args && typeof log.args === 'object') {
              const args = log.args as { requestId?: bigint; randomWord?: bigint };
              console.log("📡 VRF結果受信:", {
                requestId: args.requestId?.toString(),
                randomWord: args.randomWord?.toString(),
              });
            }
          });
        },
      });

      // RaffleStateChanged イベント監視 - WINNER_SELECTED状態で自動実行
      const unwatchStateChange = publicClient.watchContractEvent({
        address: contractAddress as `0x${string}`,
        abi: RaffleABI as Abi,
        eventName: "RaffleStateChanged",
        onLogs: (logs) => {
          console.log("🔄 RaffleStateChanged イベント検知:", logs);
          
          logs.forEach((log: Log & { args?: any }) => {
            if (log.args && typeof log.args === 'object') {
              const args = log.args as { newState?: number };
              const newState = args.newState;
              
              if (typeof newState === 'number') {
                console.log("📊 ラッフル状態変更:", {
                  newState,
                  stateName: getStateName(newState),
                });
                
                // 状態2（WINNER_SELECTED）で自動実行
                if (newState === 2) {
                  console.log("🚨 WINNER_SELECTED状態検知 - 自動勝者処理開始");
                  setTimeout(() => {
                    autoProcessWinner();
                  }, 1000); // 1秒後に実行（ブロック確定待ち）
                }
              }
            }
          });
        },
      });

      // WinnerPicked イベント監視
      const unwatchWinnerPicked = publicClient.watchContractEvent({
        address: contractAddress as `0x${string}`,
        abi: RaffleABI as Abi,
        eventName: "WinnerPicked",
        onLogs: (logs) => {
          console.log("🏆 WinnerPicked イベント検知:", logs);
          
          logs.forEach((log: Log & { args?: any }) => {
            if (log.args && typeof log.args === 'object') {
              const args = log.args as { winner?: string; prize?: bigint; isJackpot?: boolean };
              
              console.log("🎉 勝者決定:", {
                winner: args.winner,
                prize: args.prize?.toString(),
                isJackpot: args.isJackpot,
              });
              
              // データを更新
              updateRaffleDataRef.current(true);
            }
          });
        },
      });

      // 複数のリスナーを統合
      unwatchRef.current = () => {
        unwatchRandomWords();
        unwatchStateChange();
        unwatchWinnerPicked();
      };

      console.log("✅ イベント監視リスナー設定完了");
    } catch (error) {
      console.error("❌ イベント監視設定エラー:", error);
    }

    // クリーンアップ
    return () => {
      if (unwatchRef.current) {
        unwatchRef.current();
        unwatchRef.current = null;
      }
    };
  }, [contractAddress, publicClient, isValidChainId]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (unwatchRef.current) {
        unwatchRef.current();
      }
    };
  }, []);

  return {
    autoProcessWinner,
  };
}

// ヘルパー関数
function getStateName(state: number): string {
  switch (state) {
    case 0: return "OPEN";
    case 1: return "CALCULATING_WINNER";
    case 2: return "WINNER_SELECTED";
    case 3: return "CLOSED";
    default: return "UNKNOWN";
  }
}