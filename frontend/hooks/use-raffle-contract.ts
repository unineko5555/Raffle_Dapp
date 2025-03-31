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
  }>({
    entranceFee: "0",
    numberOfPlayers: 0,
    raffleState: 0,
    jackpotAmount: "0",
    recentWinner: null,
    players: [],
  });

  // チェーンIDから正しいコントラクトアドレスを取得
  const currentChainId = chainId || 11155111; // デフォルトはSepolia
  const contractAddress = contractConfig[currentChainId]?.raffleProxy || "";
  const erc20Address = contractConfig[currentChainId]?.erc20Address || "";

  // コントラクトの設定を確認する関数
  const checkContractSettings = async () => {
    if (!isConnected || !contractAddress || !publicClient) return;
    
    try {
      console.log('プロキシ設定確認開始:');
      
      // コントラクトコードの確認
      const code = await publicClient.getBytecode({ address: contractAddress as `0x${string}` });
      console.log('- コントラクトコード長:', code ? code.length : 0);
      
      // エントランス料金の取得
      try {
        const entranceFee = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "getEntranceFee",
        });
        console.log('- エントランス料金:', entranceFee);
      } catch (error) {
        console.error('エントランス料金取得エラー:', error);
      }

      // enterRaffle関数のデバッグ実行
      try {
        console.log('enterRaffle関数のデバッグ実行:');
        await publicClient.simulateContract({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "enterRaffle",
          account: address
        }).catch(error => {
          console.log('シミュレーションエラー詳細:', error);
          // 残高不足エラーから情報を抽出
          const errorMessage = error.message || '';
          if (errorMessage.includes('transfer amount exceeds balance')) {
            // エラー内容を詳細に分析
            console.log('エラーデータ詳細分析:');
            console.log('- メッセージ:', errorMessage);
            console.log('- エラーオブジェクト:', error);
            
            // コントラクトの実行データを探索
            if (error.cause) {
              console.log('- 原因情報:', error.cause);
            }
          }
          throw error;
        });
      } catch (error) {
        // ここでエラーを飲み込み
        console.log('シミュレーションエラーを飲み込みました');
      }
      
      // その他のデバッグ情報表示
      console.log('プロキシ設定確認完了');
    } catch (error) {
      console.error('コントラクト設定確認エラー:', error);
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
      console.log('トークン残高チェック:', {
        balance,
        minRequired,
        hasEnough: balance >= minRequired
      });
      
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
      console.log('承認状態チェック:', {
        allowance,
        minRequired,
        hasEnough: allowance >= minRequired
      });
      
      return allowance >= minRequired;
    } catch (error) {
      console.error("承認状態チェックエラー:", error);
      return false;
    }
  };

  // エントランス料金を取得
  const { data: entranceFeeData, isLoading: isEntranceFeeLoading, isError: isEntranceFeeError, error: entranceFeeError } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: RaffleABI,
    functionName: "getEntranceFee",
    enabled: Boolean(contractAddress),
    chainId: currentChainId,
  });
  
  // デバッグ用
  useEffect(() => {
    console.log('Contract Address:', contractAddress);
    console.log('Entrance Fee Data:', entranceFeeData);
    console.log('Entrance Fee Loading:', isEntranceFeeLoading);
    if (isEntranceFeeError) {
      console.error('Entrance Fee Error:', entranceFeeError);
    }
  }, [contractAddress, entranceFeeData, isEntranceFeeLoading, isEntranceFeeError, entranceFeeError]);

  // 参加者数を取得
  const { data: numberOfPlayersData } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: RaffleABI,
    functionName: "getNumberOfPlayers",
    enabled: Boolean(contractAddress),
    chainId: currentChainId,
  });

  // ラッフル状態を取得
  const { data: raffleStateData } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: RaffleABI,
    functionName: "getRaffleState",
    enabled: Boolean(contractAddress),
    chainId: currentChainId,
  });

  // ジャックポット額を取得
  const { data: jackpotAmountData } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: RaffleABI,
    functionName: "getJackpotAmount",
    enabled: Boolean(contractAddress),
    chainId: currentChainId,
  });

  // 最近の当選者を取得
  const { data: recentWinnerData } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: RaffleABI,
    functionName: "getRecentWinner",
    enabled: Boolean(contractAddress),
    chainId: currentChainId,
  });

  // プロバイダーチェック
  const publicClient = usePublicClient({chainId: currentChainId});
  
  // 接続チェック
  useEffect(() => {
    const checkConnection = async () => {
      if (publicClient) {
        try {
          console.log('PublicClientは有効です:', publicClient);
          const chainId = await publicClient.getChainId();
          console.log('接続しているチェーンID:', chainId);
          
          // コントラクト読み込みテスト
          if (contractAddress) {
            try {
              console.log('コントラクトの利用可能性をチェック中:', contractAddress);
              const code = await publicClient.getBytecode({ address: contractAddress as `0x${string}` });
              if (code && code.length > 2) {  // 0x以上の値があれば有効
                console.log('コントラクトは有効です');
                
                // デバッグ用のコントラクト設定確認関数を呼び出す
                if (isConnected && address) {
                  await checkContractSettings();
                }
              } else {
                console.error('コントラクトが見つかりませんでした。アドレスを確認してください:', contractAddress);
              }
            } catch (error) {
              console.error('コントラクトチェックエラー:', error);
            }
          }
        } catch (error) {
          console.error('PublicClient接続エラー:', error);
        }
      } else {
        console.error('PublicClientが利用できません');
      }
    };
    
    checkConnection();
  }, [publicClient, contractAddress]);

  // プレイヤーリストを取得
  const getPlayers = async () => {
    if (!contractAddress || !numberOfPlayersData || !publicClient) return [];
    
    const players = [];
    const count = Number(numberOfPlayersData);
    
    for (let i = 0; i < count; i++) {
      try {
        // wagmi v2ではuseContractReadをループ内で使用できないため、viemを直接使用
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

  // ERC20トークンの承認をシミュレート
  const { data: approveSimulationData, error: approveSimulationError } = useSimulateContract({
    address: erc20Address as `0x${string}`,
    abi: ERC20ABI,
    functionName: "approve",
    args: [contractAddress as `0x${string}`, BigInt("100000000000000")], // 大きめの値で承認
    enabled: Boolean(erc20Address) && Boolean(contractAddress) && Boolean(isConnected),
    chainId: currentChainId,
  });
  
  // ラッフルに参加する処理をシミュレート
  const { data: enterRaffleSimulationData, error: enterRaffleSimulationError } = useSimulateContract({
    address: contractAddress as `0x${string}`,
    abi: RaffleABI,
    functionName: "enterRaffle",
    enabled: Boolean(contractAddress) && Boolean(isConnected),
    chainId: currentChainId,
  });
  
  // シミュレーションエラーをログ
  useEffect(() => {
    if (approveSimulationError) {
      console.error('Approve simulation error:', approveSimulationError);
    }
    if (enterRaffleSimulationError) {
      console.error('Enter raffle simulation error:', enterRaffleSimulationError);
    }
  }, [approveSimulationError, enterRaffleSimulationError]);
  
  // コントラクト書き込み関数
  const { writeContract, data: contractWriteData, isLoading: isContractWriteLoading, error: contractWriteError } = useWriteContract();
  
  // トランザクション待機
  const { isLoading: isTransactionLoading, isSuccess: isTransactionSuccess } = useWaitForTransactionReceipt({
    hash: contractWriteData,
  });

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

    try {
      setIsLoading(true);
      setError(null);

      // 状態をログに出力
      console.log('コントラクト状態確認:');
      console.log('- Contract Address:', contractAddress);
      console.log('- ERC20 Address:', erc20Address);
      console.log('- approveErc20:', approveSimulationData ? '利用可能' : '利用不可');
      console.log('- enterRaffle:', enterRaffleSimulationData ? '利用可能' : '利用不可');
      console.log('- approveStatus:', approveSimulationData?.status || 'idle');
      console.log('- enterRaffleStatus:', enterRaffleSimulationData?.status || 'idle');
      console.log('- writeContract:', typeof writeContract);
      console.log('- ウォレット接続状態:', isConnected ? '接続済み' : '未接続');
      console.log('- アドレス:', address);
      
      // トークン残高チェック
      const hasEnoughBalance = await checkTokenBalance();
      if (!hasEnoughBalance) {
        throw new Error(error || "トークン残高が不足しています。テストネットUSDCを取得してください。");
      }
      
      // トークン残高のバックアップチェック
      try {
        const balance = await publicClient.readContract({
          address: erc20Address as `0x${string}`,
          abi: ERC20ABI,
          functionName: "balanceOf",
          args: [address]
        });
        console.log('トークン残高:', balance);
        
        // 残高が不足している場合のエラー処理
        if (entranceFeeData && balance < entranceFeeData) {
          throw new Error(`トークン残高が不足しています。必要金額: ${formatUnits(entranceFeeData, 6)} USDC / 現在残高: ${formatUnits(balance, 6)} USDC`);
        }
      } catch (error) {
        console.error('残高確認エラー:', error);
        // エラーがあっても処理を継続
      }

      // エントランス料金を取得
      let fee;
      try {
        if (!publicClient || !contractAddress) {
          throw new Error("コントラクトとの通信が設定されていません");
        }
        
        // 直接コントラクトを読み取る
        console.log("エントランス料金を直接取得します");
        fee = entranceFeeData || await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "getEntranceFee",
        });
        
        console.log("取得したエントランス料金:", fee);
      } catch (error) {
        console.error("エントランス料金取得エラー:", error);
        throw new Error("エントランス料金が取得できませんでした");
      }
      
      if (!fee) {
        console.error("エントランス料金データがnullです");
        throw new Error("エントランス料金が取得できませんでした");
      }
      
      // approve処理
      if (!writeContract) {
        console.error("writeContract関数が利用可能ではありません");
        throw new Error("コントラクト書き込み機能が利用できません。ウォレット接続を確認してください");
      }
      
      if (!approveSimulationData) {
        console.error("approveErc20関数が利用可能ではありません");
        // 接続状態を確認
        console.log('ウォレット接続状態:', isConnected ? '接続済み' : '未接続');
        console.log('アドレス:', address);
        throw new Error("ウォレットが接続されていないか、MetaMaskの状態を確認してください");
      }
      
      console.log("approveを実行します:", contractAddress, fee);
      
  // ERC20承認用のヘルパー関数
  const approveErc20Transaction = async () => {
    if (!isConnected || !address) {
      throw new Error("ウォレットが接続されていません");
    }

    if (!contractAddress || !erc20Address) {
      throw new Error("コントラクトアドレスが設定されていません");
    }

    try {
      // エントランス料金を取得
      let fee;
      try {
        if (!publicClient || !contractAddress) {
          throw new Error("コントラクトとの通信が設定されていません");
        }
        
        // 直接コントラクトを読み取る
        console.log("エントランス料金を直接取得します");
        fee = entranceFeeData || await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "getEntranceFee",
        });
        
        console.log("取得したエントランス料金:", fee);
      } catch (error) {
        console.error("エントランス料金取得エラー:", error);
        throw new Error("エントランス料金が取得できませんでした");
      }
      
      if (!fee) {
        console.error("エントランス料金データがnullです");
        throw new Error("エントランス料金が取得できませんでした");
      }

      // 既存の承認状態をチェック
      const hasAllowance = await checkAllowance();
      if (hasAllowance) {
        console.log('すでに十分な承認があります。スキップします。');
        return "Allowance already sufficient";
      }
      
      // writeContract関数が利用可能か確認
      if (!writeContract) {
        console.error("writeContract関数が利用可能ではありません");
        throw new Error("コントラクト書き込み機能が利用できません。ウォレット接続を確認してください");
      }
      
      // ApproveをSimulateする
      const { request } = await publicClient.simulateContract({
        address: erc20Address as `0x${string}`,
        abi: ERC20ABI,
        functionName: "approve",
        args: [contractAddress as `0x${string}`, BigInt("100000000000000")], // 大きめの値で承認
        account: address
      }).catch(error => {
        console.error('承認シミュレーション失敗:', error);
        throw new Error(`承認シミュレーションに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
      });
      
      if (!request) {
        throw new Error("承認リクエストの準備に失敗しました");
      }
      
      // 承認処理を直接実行
      console.log('新しい承認トランザクションを開始します...');
      const approveTx = await writeContract(request);
      
      if (!approveTx) {
        throw new Error("承認トランザクションの送信に失敗しました");
      }
      
      console.log('承認トランザクションハッシュ:', approveTx);
      
      // トランザクション完了を待機する
      try {
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
        console.log('承認トランザクションが完了しました');
      } catch (error) {
        console.error('承認トランザクション確認エラー:', error);
        // エラーが発生しても処理を続行
      }
      
      return approveTx;
    } catch (error) {
      console.error('承認処理エラー:', error);
      throw new Error(`承認処理に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  };

      // エントランス料金を使用してトークン承認
      console.log("承認処理を開始します");
      try {
        const approveResult = await approveErc20Transaction();
        
        // 承認が完了したら継続する
        console.log("承認結果:", approveResult);
        console.log("承認後、ラッフル参加処理を開始します");
        
        // 承認後、承認状態を再確認
        const allowanceAfterApprove = await checkAllowance();
        if (!allowanceAfterApprove) {
          throw new Error("承認処理は正常に完了しましたが、承認状態が正しく反映されていません。少し時間をおいてから再試行してください。");
        }
        
        console.log("承認状態の確認が完了しました。ラッフル参加処理を続行します。");
      } catch (error) {
        console.error('トークン承認エラー:', error);
        throw error;
      }
      
      console.log("ラッフルに参加します");
      
      try {
        // 再度残高チェック
        const hasEnoughBalance = await checkTokenBalance();
        if (!hasEnoughBalance) {
          throw new Error("残高が不足しています。残高を確認してください。");
        }
        
        // 再度承認状態チェック
        const hasAllowance = await checkAllowance();
        if (!hasAllowance) {
          throw new Error("承認が不足しています。承認処理を再度行ってください。");
        }
        
        // enterRaffleのシミュレーションを再実行
        const { request } = await publicClient.simulateContract({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "enterRaffle",
          account: address
        }).catch(error => {
          console.error('ラッフル参加シミュレーション失敗:', error);
          throw new Error(`ラッフル参加シミュレーションに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
        });

        if (!request) {
          throw new Error("ラッフル参加リクエストの準備に失敗しました");
        }
        
        // ラッフル参加トランザクション
        console.log('リクエストの準備完了、送信開始...');
        const enterRaffleTxHash = await writeContract(request);
        
        console.log('ラッフル参加トランザクションハッシュ:', enterRaffleTxHash);
        
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

  // データを更新
  useEffect(() => {
    const updateRaffleData = async () => {
      try {
        if (contractAddress) {
          console.log('Updating raffle data for contract:', contractAddress);
          console.log('Raw data:', { 
            entranceFeeData, 
            numberOfPlayersData, 
            raffleStateData, 
            jackpotAmountData, 
            recentWinnerData 
          });
          
          const players = await getPlayers();
          console.log('Players:', players);
          
          // BigInt型のデータを安全に処理
          let formattedEntranceFee = "0";
          let formattedJackpotAmount = "0";
          
          try {
            if (entranceFeeData) {
              formattedEntranceFee = formatUnits(BigInt(entranceFeeData.toString()), 6);
            }
          } catch (error) {
            console.error('Error formatting entrance fee:', error);
          }
          
          try {
            if (jackpotAmountData) {
              formattedJackpotAmount = formatUnits(BigInt(jackpotAmountData.toString()), 6);
            }
          } catch (error) {
            console.error('Error formatting jackpot amount:', error);
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
          });
          
          console.log('Updated raffle data:', {
            entranceFee: formattedEntranceFee,
            jackpotAmount: formattedJackpotAmount,
            players: players.length
          });
        }
      } catch (error) {
        console.error('Error updating raffle data:', error);
      }
    };

    updateRaffleData();
  }, [contractAddress, entranceFeeData, numberOfPlayersData, raffleStateData, jackpotAmountData, recentWinnerData]);

  // UI表示用の読み込み状態管理
  const [uiLoading, setUiLoading] = useState(true);
  
  // 初期データ読み込み後、ローディングを停止
  useEffect(() => {
    if (entranceFeeData) {
      console.log('データが読み込まれました。読み込み状態を解除します。');
      setUiLoading(false);
    }
  }, [entranceFeeData]);

  // タイムアウトハンドラー
  useEffect(() => {
    // 5秒後にデータが取得できなければ、前進を許可
    const timeoutId = setTimeout(() => {
      if (uiLoading) {
        console.log('データ取得にタイムアウトが発生しました。状態を解除します。');
        setUiLoading(false);
      }
    }, 5000);
    
    return () => clearTimeout(timeoutId);
  }, [uiLoading]);

  return {
    raffleData,
    isLoading: isLoading || isContractWriteLoading || isTransactionLoading || uiLoading,
    error,
    handleEnterRaffle,
    contractAddress,
    erc20Address,
  };
}