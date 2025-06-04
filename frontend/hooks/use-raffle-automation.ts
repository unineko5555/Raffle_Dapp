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
    await setVRFMode(false); // 正式VRFを有効化
    await new Promise((resolve) => setTimeout(resolve, 2000)); // 設定反映待ち
    return await performUpkeep();
  };

  // Mock付きUpkeep実行
  const performManualUpkeepWithMock = async () => {
    console.log("MockVRFラッフルを開始します...");

    // 現在のVRF設定を確認
    let currentVRFStatus: any = null;
    if (publicClient) {
      try {
        currentVRFStatus = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "getMockVRFStatus",
        });
      } catch (error) {
        console.warn("VRF設定確認エラー:", error);
      }
    }

    // MockVRFが既に設定されているかチェック
    const isCurrentlyMockVRF = Array.isArray(currentVRFStatus)
      ? currentVRFStatus[0] === true
      : false;

    if (!isCurrentlyMockVRF) {
      console.log("MockVRFを設定します...");
      try {
        await setVRFMode(true);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (setVRFError) {
        console.error("MockVRF設定エラー:", setVRFError);
        console.log("設定に失敗しましたが、続行します...");
      }
    } else {
      console.log("MockVRFは既に設定済みです。");
    }

    // 条件を確認
    const automationStatus = await checkAutomationStatus();
    if (!automationStatus?.upkeepNeeded) {
      throw new Error("ラッフル実行条件が満たされていません");
    }

    // MockVRFでperformUpkeepを実行
    return await performUpkeep();
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
        
        if (upkeepResult?.txHash) {
          console.log("スマートアカウントでラッフルを実行:", upkeepResult.txHash);
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          if (updateRaffleData) {
            await updateRaffleData(true);
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
          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
          
          if (receipt.status === 'reverted') {
            throw new Error(`performUpkeepが失敗しました: ${txHash}`);
          }
          
          console.log("ラッフルが完了しました");
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          if (updateRaffleData) {
            await updateRaffleData(true);
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
