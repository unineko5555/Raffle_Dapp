import { useEffect, useCallback, useRef } from "react";
import { usePublicClient, useAccount, useWriteContract } from "wagmi";
import { useToast } from "@/components/ui/use-toast";
import { type Log, type Abi } from "viem";
import { encodeFunctionData } from "viem";
import { RaffleABI } from "@/app/lib/contract-config";
import { useContractConfig } from "./shared/use-contract-config";
import { useSmartAccountContext } from "@/app/providers/smart-account-provider";

interface UseRaffleEventListenerOptions {
  updateRaffleData: (forceUpdate?: boolean) => void;
}

export function useRaffleEventListener({
  updateRaffleData,
}: UseRaffleEventListenerOptions) {
  const { toast } = useToast();
  const publicClient = usePublicClient();
  const { contractAddress, isValidChainId } = useContractConfig();

  // 接続状態を直接取得（古い状態参照の問題を回避）
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { smartAccountAddress, sendUserOperation, isReadyToSendTx } =
    useSmartAccountContext();

  const isProcessingRef = useRef(false);
  const unwatchRef = useRef<(() => void) | null>(null);

  // updateRaffleDataの安定した参照を保持
  const updateRaffleDataRef = useRef(updateRaffleData);
  updateRaffleDataRef.current = updateRaffleData;

  // 🎯 自動processWinner実行関数 - 直接状態取得で古い状態参照を回避
  const autoProcessWinner = useCallback(async () => {
    if (!contractAddress || isProcessingRef.current) return;

    console.log("🎯 イベント監視: 自動勝者処理開始");
    isProcessingRef.current = true;

    try {
      // 実行時の最新状態をログ出力
      console.log("🔍 実行時接続状態チェック:", {
        isReadyToSendTx,
        smartAccountAddress: !!smartAccountAddress,
        isConnected,
        address: !!address,
        contractAddress,
        hasValidConnection:
          (isReadyToSendTx && smartAccountAddress) || (isConnected && address),
      });

      // 接続チェック
      const hasValidConnection =
        (isReadyToSendTx && smartAccountAddress) || (isConnected && address);

      if (!hasValidConnection) {
        throw new Error("ウォレットが接続されていません");
      }

      const useSmartAccount =
        isReadyToSendTx && smartAccountAddress && sendUserOperation;
      let result: { success: boolean; txHash?: string; error?: string };

      if (useSmartAccount && sendUserOperation) {
        // スマートアカウント経由での実行
        console.log("🔧 スマートアカウント経由で実行");

        const callData = encodeFunctionData({
          abi: RaffleABI as Abi,
          functionName: "processWinner",
          args: [],
        });

        const txResult = await sendUserOperation(
          contractAddress as `0x${string}`,
          callData,
          BigInt(0)
        );

        if (txResult?.txHash && publicClient) {
          // トランザクション確認
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: txResult.txHash as `0x${string}`,
            timeout: 60000,
          });

          if (receipt.status === "reverted") {
            result = {
              success: false,
              error: "スマートアカウント取引がリバートしました",
            };
          } else {
            result = { success: true, txHash: txResult.txHash };
          }
        } else {
          result = {
            success: false,
            error: "スマートアカウント取引の送信に失敗しました",
          };
        }
      } else if (isConnected && address && publicClient && writeContractAsync) {
        // EOA経由での実行
        console.log("🔧 EOA経由で実行");

        let txParams: any = {
          address: contractAddress as `0x${string}`,
          abi: RaffleABI as Abi,
          functionName: "processWinner",
          args: [],
          account: address,
          value: BigInt(0),
        };

        // Base Sepolia等のL2ガス最適化
        if (publicClient.chain?.id === 84532) {
          try {
            const gasEstimate = await publicClient.estimateContractGas({
              address: contractAddress as `0x${string}`,
              abi: RaffleABI as Abi,
              functionName: "processWinner",
              args: [],
              account: address,
              value: BigInt(0),
            });

            txParams.gas =
              gasEstimate + (gasEstimate * BigInt(20)) / BigInt(100);
          } catch (gasError) {
            console.warn("ガス推定エラー - デフォルト値を使用:", gasError);
            txParams.gas = BigInt(2500000);
          }
        }

        const txHash = await writeContractAsync(txParams);

        if (!txHash) {
          result = { success: false, error: "EOA取引の送信に失敗しました" };
        } else {
          // トランザクション確認
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash,
            timeout: 60000,
          });

          if (receipt.status === "reverted") {
            result = { success: false, error: "EOA取引がリバートしました" };
          } else {
            result = { success: true, txHash };
          }
        }
      } else {
        result = { success: false, error: "ウォレット接続の状態が無効です" };
      }

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
    isValidChainId,
    publicClient,
    toast,
    isReadyToSendTx,
    smartAccountAddress,
    sendUserOperation,
    isConnected,
    address,
    writeContractAsync,
  ]);

  // 🔥 イベント監視の開始
  useEffect(() => {
    if (!contractAddress || !publicClient || !isValidChainId) return;

    // console.log("🔥 ラッフルイベント監視開始:", contractAddress);

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
            if (log.args && typeof log.args === "object") {
              const args = log.args as {
                requestId?: bigint;
                randomWord?: bigint;
              };
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
            if (log.args && typeof log.args === "object") {
              const args = log.args as { newState?: number };
              const newState = args.newState;

              if (typeof newState === "number") {
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
            if (log.args && typeof log.args === "object") {
              const args = log.args as {
                winner?: string;
                prize?: bigint;
                isJackpot?: boolean;
              };

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

      // console.log("✅ イベント監視リスナー設定完了");
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
  }, [contractAddress, publicClient, isValidChainId, autoProcessWinner]);

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
    case 0:
      return "OPEN";
    case 1:
      return "CALCULATING_WINNER";
    case 2:
      return "WINNER_SELECTED";
    case 3:
      return "CLOSED";
    default:
      return "UNKNOWN";
  }
}
