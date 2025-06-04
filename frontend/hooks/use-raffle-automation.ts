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

export function useRaffleAutomation(updateRaffleData?: (forceUpdate: boolean) => Promise<void>) {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // スマートアカウント機能を使用
  const { smartAccountAddress, isReadyToSendTx, sendUserOperation } = useSmartAccountContext();
  
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
        const isCurrentlyMockVRF = Array.isArray(currentVRFStatus) ? 
          currentVRFStatus[0] === true : false;
        
        if (isCurrentlyMockVRF === useMockVRF) {
          console.log(`VRF設定は既に正しい状態です (MockVRF: ${useMockVRF})`);
          return; // 早期リターンでトランザクションを回避
        }
      }
    } catch (error) {
      console.warn("VRF設定確認エラー:", error);
    }

    const useSmartAccount = isReadyToSendTx && smartAccountAddress && sendUserOperation;
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
        await new Promise(resolve => setTimeout(resolve, 2000));
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
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        
        if (receipt.status === 'reverted') {
          throw new Error(`setMockVRFトランザクションが失敗しました`);
        }
        
        console.log(`VRFモード変更完了 (MockVRF: ${useMockVRF})`);
        
        // 設定反映を待つ
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error("VRFモード変更エラー:", error);
      throw error;
    }
  };

  // VRF付きUpkeep実行
  const performManualUpkeepWithVRF = async () => {
    await setVRFMode(false); // 正式VRFを有効化
    await new Promise(resolve => setTimeout(resolve, 2000)); // 設定反映待ち
    return await performManualUpkeep();
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
    const isCurrentlyMockVRF = Array.isArray(currentVRFStatus) ? 
      currentVRFStatus[0] === true : false;
    
    if (!isCurrentlyMockVRF) {
      console.log("MockVRFを設定します...");
      try {
        await setVRFMode(true);
        await new Promise(resolve => setTimeout(resolve, 2000));
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
    return await executePerformUpkeepForMock();
  };

  // MockVRF用のperformUpkeep実行関数
  const executePerformUpkeepForMock = async () => {
    if (
      (!isConnected && !isReadyToSendTx) ||
      (!address && !smartAccountAddress) ||
      !contractAddress
    ) {
      return null;
    }

    const useSmartAccount = isReadyToSendTx && smartAccountAddress && sendUserOperation;

    try {
      setIsLoading(true);

      if (useSmartAccount && sendUserOperation) {
        const performUpkeepCallData = encodeFunctionData({
          abi: RaffleABI,
          functionName: "performUpkeep",
          args: ["0x"],
        });

        const upkeepResult = await sendUserOperation(
          contractAddress as `0x${string}`,
          performUpkeepCallData,
          BigInt(0)
        );
        
        if (upkeepResult?.txHash) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          if (updateRaffleData) {
            await updateRaffleData(true);
          }
        }
        
        return upkeepResult?.txHash || null;
      } else if (isConnected && address && publicClient && writeContractAsync) {
        const txHash = await writeContractAsync({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "performUpkeep",
          args: ["0x"],
          account: address,
        });

        if (txHash) {
          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
          
          if (receipt.status === 'reverted') {
            throw new Error(`MockVRF performUpkeepが失敗しました`);
          }
          
          console.log("MockVRF: ラッフルが完了しました");
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          if (updateRaffleData) {
            await updateRaffleData(true);
          }
        }
        
        return txHash;
      }
      
      return null;
    } catch (error) {
      console.error("MockVRF performUpkeepエラー:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // 手動でUpkeepを実行するための関数
  const performManualUpkeep = async () => {
    if (
      (!isConnected && !isReadyToSendTx) ||
      (!address && !smartAccountAddress) ||
      !contractAddress
    ) {
      return null;
    }

    const useSmartAccount = isReadyToSendTx && smartAccountAddress && sendUserOperation;

    try {
      setIsLoading(true);

      const automationStatus = await checkAutomationStatus();

      if (!automationStatus || !automationStatus.upkeepNeeded) {
        alert(
          "現在のラッフル状態ではUpkeepを実行できません。\n参加者数または時間経過などの条件を確認してください。"
        );
        setIsLoading(false);
        return null;
      }

      if (useSmartAccount && sendUserOperation) {
        const performUpkeepCallData = encodeFunctionData({
          abi: RaffleABI,
          functionName: "performUpkeep",
          args: ["0x"],
        });

        const upkeepResult = await sendUserOperation(
          contractAddress as `0x${string}`,
          performUpkeepCallData,
          BigInt(0)
        );

        if (upkeepResult?.txHash) {
          console.log("スマートアカウントでラッフルを実行:", upkeepResult.txHash);
          
          // データ更新
          setTimeout(async () => {
            if (updateRaffleData) {
              await updateRaffleData(true);
            }
          }, 5000);
        }

        return upkeepResult?.txHash || null;
      } else if (isConnected && address && publicClient && writeContract) {
        const { request } = await publicClient.simulateContract({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "performUpkeep",
          args: ["0x"],
          account: address,
        });

        if (!request) {
          throw new Error("リクエストの準備に失敗しました");
        }

        await writeContract({
          ...request,
          gas: BigInt(1000000),
        });

        if (contractWriteData) {
          console.log("EOAでラッフルを実行:", contractWriteData);
          
          // データ更新
          setTimeout(async () => {
            if (updateRaffleData) {
              await updateRaffleData(true);
            }
          }, 3000);
        }

        return contractWriteData;
      }
      
      return null;
    } catch (error) {
      console.error("手動Upkeep実行エラー:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // 管理者用ラッフル開始関数
  const manualPerformUpkeepAsOwner = async () => {
    if (
      !isConnected ||
      !address ||
      !contractAddress ||
      !publicClient ||
      !writeContract
    ) {
      return;
    }

    try {
      const ownerAddress = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: RaffleABI,
        functionName: "getOwner",
      });

      if (
        ownerAddress &&
        ownerAddress.toString().toLowerCase() !== address.toLowerCase()
      ) {
        alert("このコマンドはコントラクトの所有者のみが実行できます。");
        return null;
      }

      const { request } = await publicClient.simulateContract({
        address: contractAddress as `0x${string}`,
        abi: RaffleABI,
        functionName: "manualPerformUpkeep",
        account: address,
      });

      if (!request) {
        throw new Error("リクエストの準備に失敗しました");
      }

      await writeContract({
        ...request,
        gas: BigInt(1000000),
      });

      if (contractWriteData) {
        if (!publicClient) throw new Error("Public client is not available");
        await publicClient.waitForTransactionReceipt({
          hash: contractWriteData,
        });
        return contractWriteData;
      }

      return null;
    } catch (error) {
      console.error("管理者コマンド実行エラー:", error);
      throw error;
    }
  };

  return {
    isLoading,
    error,
    isUpkeepNeeded,
    contractAddress,
    checkAutomationStatus,
    checkUpkeepDebug,
    performManualUpkeep,
    performManualUpkeepWithVRF,
    performManualUpkeepWithMock,
    manualPerformUpkeepAsOwner,
  };
}