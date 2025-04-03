"use client";

import { useState, useEffect } from "react";
import { 
  useAccount, 
  useReadContract, 
  useWriteContract, 
  useChainId, 
  useWaitForTransactionReceipt, 
  usePublicClient, 
  useSimulateContract 
} from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { RaffleABI, ERC20ABI, contractConfig } from "@/app/lib/contract-config";
import { createHandleCancelEntry } from "./cancel-entry";

// checkUpkeepDebug用の型定義
type UpkeepDebugInfo = {
  isOpen: boolean;
  hasPlayers: boolean;
  hasTimePassed: boolean;
  timeSinceMinPlayers: bigint;
  requiredTime: bigint;
  playerCount: bigint;
};

export function useRaffleContract() {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [raffleData, setRaffleData] = useState<{
    entranceFee: string;
    numberOfPlayers: number;
    raffleState: number;
    jackpotAmount: string;
    recentWinner: string | null;
    players: string[];
    owner: string | null;
  }>({
    entranceFee: "0",
    numberOfPlayers: 0,
    raffleState: 0,
    jackpotAmount: "0",
    recentWinner: null,
    players: [],
    owner: null,
  });

  // UI表示用の読み込み状態管理
  const [uiLoading, setUiLoading] = useState(true);
  // プレイヤーの参加状態を管理
  const [isPlayerEntered, setIsPlayerEntered] = useState(false);
  // upkeepNeededの状態を管理
  const [isUpkeepNeeded, setIsUpkeepNeeded] = useState(false);

  // チェーンIDから正しいコントラクトアドレスを取得
  const currentChainId = chainId || 11155111; // デフォルトはSepolia
  const contractAddress = contractConfig[currentChainId]?.raffleProxy || "";
  const erc20Address = contractConfig[currentChainId]?.erc20Address || "";

  // プロバイダーチェック
  const publicClient = usePublicClient({chainId: currentChainId});
  
  // コントラクト書き込み関数
  const { writeContract, data: contractWriteData, isLoading: isContractWriteLoading, error: contractWriteError } = useWriteContract();
  
  // トランザクション待機
  const { isLoading: isTransactionLoading, isSuccess: isTransactionSuccess } = useWaitForTransactionReceipt({
    hash: contractWriteData,
  });

  // コントラクト読み取り
  const { data: entranceFeeData } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: RaffleABI,
    functionName: "getEntranceFee",
    enabled: Boolean(contractAddress),
    chainId: currentChainId,
  });
  
  const { data: numberOfPlayersData } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: RaffleABI,
    functionName: "getNumberOfPlayers",
    enabled: Boolean(contractAddress),
    chainId: currentChainId,
  });

  const { data: raffleStateData } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: RaffleABI,
    functionName: "getRaffleState",
    enabled: Boolean(contractAddress),
    chainId: currentChainId,
  });

  const { data: jackpotAmountData } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: RaffleABI,
    functionName: "getJackpotAmount",
    enabled: Boolean(contractAddress),
    chainId: currentChainId,
  });

  const { data: recentWinnerData } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: RaffleABI,
    functionName: "getRecentWinner",
    enabled: Boolean(contractAddress),
    chainId: currentChainId,
  });

  const { data: ownerData } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: RaffleABI,
    functionName: "getOwner",
    enabled: Boolean(contractAddress),
    chainId: currentChainId,
  });

  // プレイヤーリストを取得
  const getPlayers = async () => {
    if (!contractAddress || !numberOfPlayersData || !publicClient) return [];
    
    const players = [];
    const count = Number(numberOfPlayersData);
    
    for (let i = 0; i < count; i++) {
      try {
        const player = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "getPlayer",
          args: [BigInt(i)],
        });
        
        if (player) players.push(player as string);
      } catch (error) {
        console.error(`Error fetching player at index ${i}:`, error);
      }
    }
    
    return players;
  };

  // プレイヤーの参加状態を確認
  const checkPlayerEntered = async () => {
    if (!isConnected || !address || !contractAddress || !publicClient || !numberOfPlayersData) {
      setIsPlayerEntered(false);
      return false;
    }
    
    try {
      const players = await getPlayers();
      const isEntered = players.some(player => player.toLowerCase() === address.toLowerCase());
      setIsPlayerEntered(isEntered);
      return isEntered;
    } catch (error) {
      console.error('プレイヤー参加状態確認エラー:', error);
      return false;
    }
  };

  // データを更新
  const updateRaffleData = async (forceUpdate = false) => {
    if (contractAddress) {
      const players = await getPlayers();
      
      // プレイヤー参加状態を確認
      if (isConnected && address) {
        await checkPlayerEntered();
      }
      
      // BigInt型のデータを安全に処理
      let formattedEntranceFee = "0";
      let formattedJackpotAmount = "0";
      
      try {
        if (entranceFeeData) {
          formattedEntranceFee = formatUnits(entranceFeeData, 6);
        }
        
        if (jackpotAmountData) {
          formattedJackpotAmount = formatUnits(jackpotAmountData, 6);
        }
      } catch (error) {
        console.error('Error formatting data:', error);
      }
      
      setRaffleData({
        entranceFee: formattedEntranceFee,
        numberOfPlayers: numberOfPlayersData ? Number(numberOfPlayersData) : 0,
        raffleState: raffleStateData ? Number(raffleStateData) : 0,
        jackpotAmount: formattedJackpotAmount,
        recentWinner: recentWinnerData && (recentWinnerData as string) !== "0x0000000000000000000000000000000000000000" 
          ? recentWinnerData as string 
          : null,
        players,
        owner: ownerData as string || null,
      });
    }
  };

  // Automation状態をデバッグするための最小限の関数
  const checkAutomationStatus = async () => {
    if (!contractAddress || !publicClient) return;
    
    try {
      const { result } = await publicClient.simulateContract({
        address: contractAddress as `0x${string}`,
        abi: RaffleABI,
        functionName: "checkUpkeep",
        args: ["0x"]
      });
      
      return { upkeepNeeded: result[0] };
    } catch (error) {
      console.error('Automation状態確認エラー:', error);
      return null;
    }
  };

  // 手動でUpkeepを実行するための関数
  const performManualUpkeep = async () => {
    if (!isConnected || !address || !contractAddress || !publicClient || !writeContract) {
      return;
    }
    
    try {
      const automationStatus = await checkAutomationStatus();
      
      if (!automationStatus || !automationStatus.upkeepNeeded) {
        return;
      }
      
      const { request } = await publicClient.simulateContract({
        address: contractAddress as `0x${string}`,
        abi: RaffleABI,
        functionName: "performUpkeep",
        args: ["0x"],
        account: address
      });
      
      if (!request) {
        throw new Error("リクエストの準備に失敗しました");
      }
      
      const customRequest = {
        ...request,
        gas: BigInt(1000000)
      };
      
      const hash = await writeContract(customRequest);
      
      if (hash) {
        await publicClient.waitForTransactionReceipt({ hash });
        return hash;
      }
      return null;
    } catch (error) {
      console.error('手動Upkeep実行エラー:', error);
      throw error;
    }
  };

  // トークン残高チェック用関数
  const checkTokenBalance = async () => {
    if (!isConnected || !address || !erc20Address || !publicClient) return false;
    
    try {
      const balance = await publicClient.readContract({
        address: erc20Address as `0x${string}`,
        abi: ERC20ABI,
        functionName: "balanceOf",
        args: [address]
      });
      
      const minRequired = entranceFeeData || BigInt(10000000);
      
      if (balance < minRequired) {
        setError(`トークン残高が不足しています (${formatUnits(balance, 6)} / 必要額: ${formatUnits(minRequired, 6)} USDC)`);
        return false;
      }
      return true;
    } catch (error) {
      console.error("トークン残高チェックエラー:", error);
      return false;
    }
  };
  
  // 承認状態チェック用関数
  const checkAllowance = async () => {
    if (!isConnected || !address || !erc20Address || !contractAddress || !publicClient) return false;
    
    try {
      const allowance = await publicClient.readContract({
        address: erc20Address as `0x${string}`,
        abi: ERC20ABI,
        functionName: "allowance",
        args: [address, contractAddress as `0x${string}`]
      });
      
      const minRequired = entranceFeeData || BigInt(10000000);
      return allowance >= minRequired;
    } catch (error) {
      console.error("承認状態チェックエラー:", error);
      return false;
    }
  };

  // 管理者用ラッフル開始関数
  const manualPerformUpkeepAsOwner = async () => {
    if (!isConnected || !address || !contractAddress || !publicClient || !writeContract) {
      return;
    }
    
    try {
      const ownerAddress = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: RaffleABI,
        functionName: "getOwner"
      });
      
      if (ownerAddress && ownerAddress.toString().toLowerCase() !== address.toLowerCase()) {
        alert('このコマンドはコントラクトの所有者のみが実行できます。');
        return null;
      }
      
      const { request } = await publicClient.simulateContract({
        address: contractAddress as `0x${string}`,
        abi: [...RaffleABI, {
          type: "function",
          name: "manualPerformUpkeep",
          inputs: [],
          outputs: [],
          stateMutability: "nonpayable"
        }],
        functionName: "manualPerformUpkeep",
        account: address
      });
      
      if (!request) {
        throw new Error("リクエストの準備に失敗しました");
      }
      
      const hash = await writeContract({
        ...request,
        gas: BigInt(1000000)
      });
      
      if (hash) {
        await publicClient.waitForTransactionReceipt({ hash });
        return hash;
      }
      
      return null;
    } catch (error) {
      console.error('管理者コマンド実行エラー:', error);
      throw error;
    }
  };

  // ラッフルに参加する関数
  const handleEnterRaffle = async () => {
    if (!isConnected || !address) {
      setError("ウォレットが接続されていません");
      return { success: false, error: "ウォレットが接続されていません" };
    }

    if (!contractAddress || !erc20Address) {
      setError("コントラクトアドレスが設定されていません");
      return { success: false, error: "コントラクトアドレスが設定されていません" };
    }
    
    // プレイヤーがすでに参加しているかチェック
    const playerEntered = await checkPlayerEntered();
    if (playerEntered) {
      setError("あなたはすでにこのラッフルに参加しています");
      return { success: false, error: "あなたはすでにこのラッフルに参加しています" };
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // トークン残高チェック
      const hasEnoughBalance = await checkTokenBalance();
      if (!hasEnoughBalance) {
        throw new Error(error || "トークン残高が不足しています。テストネットUSDCを取得してください。");
      }

      // ERC20承認用のヘルパー関数
      const approveErc20Transaction = async () => {
        // 既存の承認状態をチェック
        const hasAllowance = await checkAllowance();
        if (hasAllowance) {
          return "Allowance already sufficient";
        }
        
        if (!writeContract) {
          throw new Error("コントラクト書き込み機能が利用できません");
        }
        
        // ApproveをSimulateする
        const { request } = await publicClient.simulateContract({
          address: erc20Address as `0x${string}`,
          abi: ERC20ABI,
          functionName: "approve",
          args: [contractAddress as `0x${string}`, BigInt("100000000000000")], // 大きめの値で承認
          account: address
        });
        
        if (!request) {
          throw new Error("承認リクエストの準備に失敗しました");
        }
        
        // 承認処理を直接実行
        const approveTx = await writeContract(request);
        
        // トランザクション完了を待機する
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
        
        return approveTx;
      };

      // エントランス料金を使用してトークン承認
      try {
        await approveErc20Transaction();
        
        // 承認後、承認状態を再確認
        const allowanceAfterApprove = await checkAllowance();
        if (!allowanceAfterApprove) {
          throw new Error("承認処理は完了しましたが、承認状態が反映されていません。少し時間をおいてから再試行してください。");
        }
      } catch (error) {
        console.error('トークン承認エラー:', error);
        throw error;
      }
      
      try {
        // enterRaffleのシミュレーション
        const { request } = await publicClient.simulateContract({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "enterRaffle",
          account: address
        });

        if (!request) {
          throw new Error("ラッフル参加リクエストの準備に失敗しました");
        }
        
        // ラッフル参加トランザクション
        const enterRaffleTxHash = await writeContract(request);

        // トランザクション完了を待機
        if (enterRaffleTxHash) {
          await publicClient.waitForTransactionReceipt({ hash: enterRaffleTxHash });
          
          // データを再取得して状態を更新
          await updateRaffleData(true);
          await checkPlayerEntered();
        }
        
        return {
          success: true,
          txHash: enterRaffleTxHash || "",
        };
      } catch (error) {
        console.error('ラッフル参加エラー:', error);
        throw new Error(`ラッフル参加に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
      }
    } catch (err) {
      console.error("Error entering raffle:", err);
      setError(err instanceof Error ? err.message : "ラッフル参加中にエラーが発生しました");
      return { success: false, error: err instanceof Error ? err.message : "ラッフル参加中にエラーが発生しました" };
    } finally {
      setIsLoading(false);
    }
  };

  // データの自動更新
  useEffect(() => {
    updateRaffleData();
  }, [contractAddress, entranceFeeData, numberOfPlayersData, raffleStateData, jackpotAmountData, recentWinnerData, address, isConnected]);

  // 初期データ読み込み後、ローディングを停止
  useEffect(() => {
    if (entranceFeeData) {
      setUiLoading(false);
    }
  }, [entranceFeeData]);

  // タイムアウトハンドラー
  useEffect(() => {
    // 5秒後にデータが取得できなければ、前進を許可
    const timeoutId = setTimeout(() => {
      if (uiLoading) {
        setUiLoading(false);
      }
    }, 5000);
    
    return () => clearTimeout(timeoutId);
  }, [uiLoading]);

  // ページロード時に参加状態をリセット
  useEffect(() => {
    return () => {
      setIsPlayerEntered(false);
    };
  }, []);

  // ラッフル参加取り消し関数を初期化
  const handleCancelEntry = createHandleCancelEntry(
    isConnected,
    address,
    contractAddress,
    checkPlayerEntered,
    publicClient,
    writeContract,
    setIsLoading,
    setError,
    updateRaffleData,
    RaffleABI
  );

  return {
    raffleData,
    isLoading: isLoading || isContractWriteLoading || isTransactionLoading || uiLoading,
    error,
    handleEnterRaffle,
    handleCancelEntry,
    contractAddress,
    erc20Address,
    isPlayerEntered,
    isUpkeepNeeded,
    checkAutomationStatus,
    performManualUpkeep,
    checkPlayerEntered,
    manualPerformUpkeepAsOwner
  };
}