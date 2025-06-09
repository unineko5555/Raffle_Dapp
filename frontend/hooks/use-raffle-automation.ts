"use client";

import { useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWriteContract,
} from "wagmi";

import { encodeFunctionData } from "viem";
import { RaffleABI, contractConfig } from "@/app/lib/contract-config";
import { useSmartAccountContext } from "@/app/providers/smart-account-provider";

// contractConfigのキーの型を定義
type SupportedChainId = keyof typeof contractConfig;

// checkUpkeepDebug用の型定義
type UpkeepDebugInfo = {
  isOpen: boolean;
  hasPlayers: boolean;
  hasTimePassed: boolean;
  timeSinceMinPlayers: bigint;
  requiredTime: bigint;
  playerCount: bigint;
};

export function useRaffleAutomation(
  updateRaffleData?: (forceUpdate: boolean) => Promise<void>
) {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // スマートアカウント機能を使用
  const { smartAccountAddress, isReadyToSendTx, sendUserOperation } =
    useSmartAccountContext();

  // upkeepNeededの状態を管理
  const [isUpkeepNeeded, setIsUpkeepNeeded] = useState(false);

  // チェーンIDから正しいコントラクトアドレスを取得
  const currentChainId = chainId || 11155111; // デフォルトはSepolia
  const contractAddress =
    contractConfig[currentChainId as SupportedChainId]?.raffleProxy || null;

  // プロバイダーチェック
  const publicClient = usePublicClient({ chainId: currentChainId });

  // コントラクト書き込み関数
  const {
    writeContract,
    writeContractAsync,
    data: contractWriteData,
  } = useWriteContract();

  // Automation状態確認
  const checkAutomationStatus = async () => {
    if (!contractAddress || !publicClient) return;

    try {
      const { result } = await publicClient.simulateContract({
        address: contractAddress as `0x${string}`,
        abi: RaffleABI,
        functionName: "checkUpkeep",
        args: ["0x"],
      });

      const upkeepNeeded = result[0] as boolean;
      setIsUpkeepNeeded(upkeepNeeded);
      return { upkeepNeeded };
    } catch (error) {
      console.error("Automation状態確認エラー:", error);
      return null;
    }
  };

  // より詳細なUpkeep条件チェック (デバッグ用)
  const checkUpkeepDebug = async (): Promise<UpkeepDebugInfo | null> => {
    setError(null); // エラー状態をリセット
    if (!contractAddress || !publicClient) return null;

    try {
      const result = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: RaffleABI,
        functionName: "checkUpkeepDebug",
      });

      if (!result || !Array.isArray(result) || result.length < 6) {
        throw new Error("不正なcheckUpkeepDebug結果");
      }

      // 結果をUpkeepDebugInfo型にマッピング
      return {
        isOpen: result[0] as boolean,
        hasPlayers: result[1] as boolean,
        hasTimePassed: result[2] as boolean,
        timeSinceMinPlayers: BigInt(result[3].toString()),
        requiredTime: BigInt(result[4].toString()),
        playerCount: BigInt(result[5].toString()),
      };
    } catch (error) {
      console.error("詳細Automation状態確認エラー:", error);
      return null;
    }
  };

  // VRFネイティブ支払い設定関数
  const setNativePayment = async (nativePayment: boolean) => {
    if (!contractAddress || (!isConnected && !isReadyToSendTx)) {
      throw new Error("ウォレットが接続されていません");
    }

    const useSmartAccount =
      isReadyToSendTx && smartAccountAddress && sendUserOperation;

    console.log(`VRFネイティブ支払い設定中: ${nativePayment}`);

    try {
      if (useSmartAccount && sendUserOperation) {
        const setNativePaymentCallData = encodeFunctionData({
          abi: RaffleABI,
          functionName: "setNativePayment",
          args: [nativePayment],
        });

        const result = await sendUserOperation(
          contractAddress as `0x${string}`,
          setNativePaymentCallData,
          BigInt(0)
        );
        console.log(`VRFネイティブ支払い設定完了: ${nativePayment}`);

        // 設定反映を待つ
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else if (isConnected && address && publicClient && writeContractAsync) {
        const txHash = await writeContractAsync({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "setNativePayment",
          args: [nativePayment],
          account: address,
        });

        if (!txHash) {
          throw new Error("setNativePaymentトランザクションの送信に失敗しました");
        }

        // トランザクションの確定を待つ
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });

        if (receipt.status === "reverted") {
          throw new Error(`setNativePaymentトランザクションが失敗しました`);
        }

        console.log(`VRFネイティブ支払い設定完了: ${nativePayment}`);

        // 設定反映を待つ
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error("VRFネイティブ支払い設定エラー:", error);
      throw error;
    }
  };

  // VRF設定を変更する関数
  const setVRFMode = async (useMockVRF: boolean) => {
    if (!contractAddress || (!isConnected && !isReadyToSendTx)) {
      throw new Error("ウォレットが接続されていません");
    }

    // 現在のVRF設定を確認
    let currentVRFStatus: any = null;
    try {
      if (publicClient) {
        currentVRFStatus = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "getMockVRFStatus",
        });

        // 既に正しい設定になっているかチェック
        const isCurrentlyMockVRF = Array.isArray(currentVRFStatus)
          ? currentVRFStatus[0] === true
          : false;

        if (isCurrentlyMockVRF === useMockVRF) {
          console.log(`VRF設定は既に正しい状態です (MockVRF: ${useMockVRF})`);
          return; // 早期リターンでトランザクションを回避
        }
      }
    } catch (error) {
      console.warn("VRF設定確認エラー:", error);
    }

    const useSmartAccount =
      isReadyToSendTx && smartAccountAddress && sendUserOperation;
    const mockVRFProvider = useSmartAccount ? smartAccountAddress : address;

    console.log(`VRFモード変更中: MockVRF=${useMockVRF}`);

    try {
      if (useSmartAccount && sendUserOperation) {
        const setMockVRFCallData = encodeFunctionData({
          abi: RaffleABI,
          functionName: "setMockVRF",
          args: [mockVRFProvider, useMockVRF],
        });

        const result = await sendUserOperation(
          contractAddress as `0x${string}`,
          setMockVRFCallData,
          BigInt(0)
        );
        console.log(`VRFモード変更完了 (MockVRF: ${useMockVRF})`);

        // 設定反映を待つ
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else if (isConnected && address && publicClient && writeContractAsync) {
        const txHash = await writeContractAsync({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "setMockVRF",
          args: [mockVRFProvider, useMockVRF],
          account: address,
        });

        if (!txHash) {
          throw new Error("setMockVRFトランザクションの送信に失敗しました");
        }

        // トランザクションの確定を待つ
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });

        if (receipt.status === "reverted") {
          throw new Error(`setMockVRFトランザクションが失敗しました`);
        }

        console.log(`VRFモード変更完了 (MockVRF: ${useMockVRF})`);

        // 設定反映を待つ
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error("VRFモード変更エラー:", error);
      throw error;
    }
  };

  // VRF付きUpkeep実行
  const performManualUpkeepWithVRF = async () => {
    console.log("VRFラッフルを開始します（ネイティブ支払い）...");
    
    // 1. まずMockVRFを無効化する
    try {
      console.log("MockVRFを無効化中...");
      await setVRFMode(false); // MockVRFを無効にする
      await new Promise((resolve) => setTimeout(resolve, 2000)); // 設定反映待ち
      console.log("MockVRF無効化完了");
    } catch (mockVRFError) {
      console.warn("MockVRF無効化エラー:", mockVRFError);
      console.log("MockVRF無効化に失敗しましたが、続行します...");
    }
    
    // 2. VRFネイティブ支払い（ETH）を設定する
    try {
      console.log("VRFネイティブ支払い（ETH）設定中...");
      await setNativePayment(true); // ETH支払いに設定
      await new Promise((resolve) => setTimeout(resolve, 2000)); // 設定反映待ち
      console.log("VRFネイティブ支払い（ETH）設定完了");
    } catch (setNativeError) {
      console.warn("VRFネイティブ支払い設定エラー:", setNativeError);
      console.log("ネイティブ支払い設定に失敗しましたが、続行します...");
    }
    
    return await performUpkeep();
  };

  // Mock付きUpkeep実行
  const performManualUpkeepWithMock = async () => {
    console.log("MockVRFラッフルを開始します...");

    // 1. まずMockVRFを有効化する
    try {
      console.log("MockVRFを有効化中...");
      await setVRFMode(true); // MockVRFを有効にする
      await new Promise((resolve) => setTimeout(resolve, 2000)); // 設定反映待ち
      console.log("MockVRF有効化完了");
    } catch (mockVRFError) {
      console.warn("MockVRF有効化エラー:", mockVRFError);
      console.log("MockVRF有効化に失敗しましたが、続行します...");
    }

    // 2. 条件を確認
    const automationStatus = await checkAutomationStatus();
    if (!automationStatus?.upkeepNeeded) {
      console.log("ラッフル実行条件チェック失敗 - 詳細確認を行います");
      
      // より詳細な条件確認
      const debugInfo = await checkUpkeepDebug();
      if (debugInfo) {
        console.log("詳細なUpkeep状態:", debugInfo);
        
        // 条件が満たされていない理由を特定
        if (!debugInfo.isOpen) {
          throw new Error("ラッフルが開始されていません");
        }
        if (!debugInfo.hasPlayers) {
          throw new Error(`最小プレイヤー数(${debugInfo.playerCount}/${debugInfo.requiredTime})に達していません`);
        }
        if (!debugInfo.hasTimePassed) {
          const remaining = Number(debugInfo.requiredTime) - Number(debugInfo.timeSinceMinPlayers);
          throw new Error(`必要な時間が経過していません (残り${remaining}秒)`);
        }
      }
      
      throw new Error("ラッフル実行条件が満たされていません");
    }

    // performUpkeepを条件チェックをスキップして実行
    return await performUpkeep({ skipUpkeepCheck: true });
  };

  // 統合されたperformUpkeep実行関数
  const performUpkeep = async (options?: {
    skipUpkeepCheck?: boolean;
  }) => {
    if (
      (!isConnected && !isReadyToSendTx) ||
      (!address && !smartAccountAddress) ||
      !contractAddress
    ) {
      return null;
    }

    const useSmartAccount =
      isReadyToSendTx && smartAccountAddress && sendUserOperation;
    const { skipUpkeepCheck = false } = options || {};

    try {
      setIsLoading(true);

      // upkeepNeeded条件チェック（スキップ可能）
      if (!skipUpkeepCheck) {
        const automationStatus = await checkAutomationStatus();
        if (!automationStatus?.upkeepNeeded) {
          alert(
            "現在のラッフル状態ではUpkeepを実行できません。\n参加者数または時間経過などの条件を確認してください。"
          );
          setIsLoading(false);
          return null;
        }
      }

      // 常にperformUpkeep関数を使用（詰み制限なし）
      const functionName = "performUpkeep";
      const args = ["0x"];

      if (useSmartAccount && sendUserOperation) {
        const performUpkeepCallData = encodeFunctionData({
          abi: RaffleABI,
          functionName,
          args,
        });

        const upkeepResult = await sendUserOperation(
          contractAddress as `0x${string}`,
          performUpkeepCallData,
          BigInt(0)
        );
        
        if (upkeepResult?.txHash && publicClient) {
          console.log("スマートアカウントでラッフルを実行:", upkeepResult.txHash);
          
          try {
            // トランザクションの確認を待つ（EOAと同様の処理）
            console.log("スマートアカウント: トランザクション確認を待機中...");
            const receipt = await publicClient.waitForTransactionReceipt({ 
              hash: upkeepResult.txHash as `0x${string}`,
              timeout: 60000 // 60秒のタイムアウト
            });
            
            console.log("スマートアカウント: トランザクション確認済み、ステータス:", receipt.status);
            console.log("スマートアカウント: ガス使用量:", receipt.gasUsed?.toString());
            
            if (receipt.status === 'reverted') {
              throw new Error(`スマートアカウント: performUpkeepがリバートしました: ${upkeepResult.txHash}`);
            }
            
            console.log("スマートアカウント: ラッフルが正常に完了しました");
            
            // 結果の反映を待つ（EOAより少し長めに設定）
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            if (updateRaffleData) {
              await updateRaffleData(true);
            }
          } catch (receiptError: any) {
            console.error("スマートアカウント: トランザクション確認エラー:", receiptError);
            // エラーでも基本的な待機とデータ更新は行う
            await new Promise(resolve => setTimeout(resolve, 5000));
            if (updateRaffleData) {
              await updateRaffleData(true);
            }
          }
        }
        
        return upkeepResult?.txHash || null;
      } else if (isConnected && address && publicClient && writeContractAsync) {
        // performUpkeep関数を使用
        let txParams: any = {
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "performUpkeep",
          args: ["0x"],
          account: address,
        };
        
        // Arbitrum Sepoliaの場合のガス設定最適化
        if (chainId === 421614) {
          console.log("Arbitrum Sepolia: ガス設定を最適化");
          
          try {
            const gasEstimate = await publicClient.estimateContractGas({
              address: contractAddress as `0x${string}`,
              abi: RaffleABI,
              functionName: "performUpkeep",
              args: ["0x"],
              account: address,
            });
            
            console.log("ガス估算結果:", gasEstimate.toString());
            
            // ガスリミットに20%のバッファを追加
            txParams.gas = gasEstimate + (gasEstimate * BigInt(20)) / BigInt(100);
            
          } catch (gasError) {
            console.warn("ガス估算エラー - デフォルト値を使用:", gasError);
            txParams.gas = BigInt(2000000); // フォールバック値
          }
        }
        
        console.log("performUpkeepパラメータ:", {
          ...txParams,
          gas: txParams.gas?.toString()
        });
        
        const txHash = await writeContractAsync(txParams);

        if (txHash) {
          console.log("performUpkeep送信完了、トランザクションハッシュ:", txHash);
          
          try {
            const receipt = await publicClient.waitForTransactionReceipt({ 
              hash: txHash,
              timeout: 60000 // 60秒のタイムアウト
            });
            
            console.log("トランザクション確認済み、ステータス:", receipt.status);
            console.log("ガス使用量:", receipt.gasUsed?.toString());
            
            if (receipt.status === 'reverted') {
              // リバートの詳細を取得
              try {
                const tx = await publicClient.getTransaction({ hash: txHash });
                console.log("リバートされたトランザクション詳細:", tx);
                
                // トランザクションを再実行してリバート理由を取得
                await publicClient.call({
                  to: tx.to,
                  data: tx.input,
                  value: tx.value,
                  blockNumber: receipt.blockNumber
                });
              } catch (callError: any) {
                console.log("リバート理由:", callError.message || callError);
                throw new Error(`performUpkeepが失敗しました: ${callError.message || 'Unknown revert reason'}`);
              }
              
              throw new Error(`performUpkeepがリバートしました: ${txHash}`);
            }
            
            console.log("ラッフルが正常に完了しました");
            
            // 結果の反映を待つ
            await new Promise(resolve => setTimeout(resolve, 3000));
            if (updateRaffleData) {
              await updateRaffleData(true);
            }
          } catch (receiptError: any) {
            console.error("トランザクション確認エラー:", receiptError);
            throw new Error(`トランザクション確認に失敗しました: ${receiptError.message}`);
          }
        }
        
        return txHash;
      }
      
      return null;
    } catch (error) {
      console.error("performUpkeep実行エラー:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    error,
    isUpkeepNeeded,
    contractAddress,
    checkAutomationStatus,
    checkUpkeepDebug,
    performUpkeep,
    performManualUpkeepWithVRF,
    performManualUpkeepWithMock,
  };
}
