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

  // Automation状態をデバッグするための最小限の関数
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
    try {
      if (publicClient) {
        const currentVRFStatus = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "getMockVRFStatus",
        });
        console.log("現在のVRF設定:", currentVRFStatus);
      }
    } catch (error) {
      console.warn("VRF設定確認エラー:", error);
    }

    const useSmartAccount = isReadyToSendTx && smartAccountAddress && sendUserOperation;
    const mockVRFProvider = useSmartAccount ? smartAccountAddress : address;

    console.log(`VRFモード変更中: useMockVRF=${useMockVRF}, provider=${mockVRFProvider}`);

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
        console.log(`VRFモード変更完了 (Mock: ${useMockVRF}):`, result?.txHash);
        
        // 設定反映を待って確認
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (publicClient) {
          const newVRFStatus = await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: RaffleABI,
            functionName: "getMockVRFStatus",
          });
          console.log("変更後VRF設定:", newVRFStatus);
        }
      } else if (isConnected && address && publicClient && writeContractAsync) {
        console.log("EOAでsetMockVRFを実行中...");
        
        try {
          // writeContractAsyncを使用して直接ハッシュを取得
          const txHash = await writeContractAsync({
            address: contractAddress as `0x${string}`,
            abi: RaffleABI,
            functionName: "setMockVRF",
            args: [mockVRFProvider, useMockVRF],
            account: address,
          });
          
          console.log(`VRFモード変更トランザクション: ${txHash}`);
          
          if (!txHash) {
            throw new Error("setMockVRFトランザクションの送信に失敗しました");
          }
          
          // トランザクションの確定を待つ
          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
          console.log(`VRF設定トランザクションステータス: ${receipt.status}`);
          
          if (receipt.status === 'reverted') {
            throw new Error(`setMockVRFトランザクションが失敗しました: ${txHash}`);
          }
          
          console.log(`VRFモード変更完了 (Mock: ${useMockVRF})`);
          
          // 設定反映を待って確認
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const newVRFStatus = await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: RaffleABI,
            functionName: "getMockVRFStatus",
          });
          console.log("変更後VRF設定:", newVRFStatus);
          
          // 設定が実際に変更されたか確認
          const actualUseMockVRF = Array.isArray(newVRFStatus) ? newVRFStatus[0] : newVRFStatus;
          if (actualUseMockVRF !== useMockVRF) {
            throw new Error(`VRF設定の変更に失敗しました。期待値: ${useMockVRF}, 実際の値: ${actualUseMockVRF}`);
          }
        } catch (writeError) {
          console.error("writeContractAsyncエラー:", writeError);
          throw new Error(`setMockVRFトランザクション実行エラー: ${writeError}`);
        }
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

  // Mock付きUpkeep実行 (フォールバックなし)
  const performManualUpkeepWithMock = async () => {
    console.log("MockVRFラッフルを開始します...");
    
    // MockVRF設定を確認
    await setVRFMode(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log("MockVRF設定でperformUpkeepを実行します...");
    console.log("※ MockVRFの場合、performUpkeep内でMock乱数が生成され、即座にラッフルが完了します。");
    
    // 条件を確認
    const automationStatus = await checkAutomationStatus();
    if (!automationStatus?.upkeepNeeded) {
      throw new Error("ラッフル実行条件が満たされていません");
    }
    
    // MockVRFでperformUpkeepを実行 (フォールバックなし)
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
      console.log("MockVRF: performUpkeepを実行中...");
      console.log("※ Mock乱数はperformUpkeep内で生成され、即座にラッフルが完了します。");

      if (useSmartAccount && sendUserOperation) {
        console.log("スマートアカウントでMockVRF performUpkeepを実行...");
        
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

        console.log("MockVRF performUpkeep結果:", upkeepResult?.txHash);
        
        // MockVRFの場合、performUpkeepで即座にラッフルが完了する
        if (upkeepResult?.txHash) {
          // トランザクション確定を待つ
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // 状態更新
          if (updateRaffleData) {
            await updateRaffleData(true);
          }
        }
        
        return upkeepResult?.txHash || null;
      } else if (isConnected && address && publicClient && writeContractAsync) {
        console.log("EOAでMockVRF performUpkeepを実行...");
        
        const txHash = await writeContractAsync({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "performUpkeep",
          args: ["0x"],
          account: address,
        });

        console.log("MockVRF performUpkeepトランザクション:", txHash);
        
        if (txHash) {
          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
          console.log("MockVRF performUpkeepステータス:", receipt.status);
          
          if (receipt.status === 'reverted') {
            throw new Error(`MockVRF performUpkeepが失敗しました: ${txHash}`);
          }
          
          // MockVRFの場合、performUpkeepで即座にラッフルが完了する
          console.log("MockVRF: ラッフルが完了しました");
          
          // 状態更新
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

  // MockVRF専用のUpkeep実行関数
  const performManualUpkeepForMock = async () => {
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
      console.log("MockVRF用ラッフル処理を開始...");

      // MockVRFの場合、手動でrawFulfillRandomWordsを呼び出す
      const mockRandomNumber = Math.floor(Math.random() * 1000000) + 1;
      console.log("生成したMock乱数:", mockRandomNumber);

      if (useSmartAccount && sendUserOperation) {
        console.log("スマートアカウントでMockVRF rawFulfillRandomWordsを実行...");
        
        const rawFulfillCallData = encodeFunctionData({
          abi: RaffleABI,
          functionName: "rawFulfillRandomWords",
          args: [BigInt(1), [BigInt(mockRandomNumber)]], // requestId=1, randomWords=[mockNumber]
        });

        const fulfillResult = await sendUserOperation(
          contractAddress as `0x${string}`,
          rawFulfillCallData,
          BigInt(0)
        );

        console.log("MockVRF rawFulfillRandomWords結果:", fulfillResult?.txHash);
        return fulfillResult?.txHash || null;
      } else if (isConnected && address && publicClient && writeContractAsync) {
        console.log("EOAでMockVRF rawFulfillRandomWordsを実行...");
        
        const txHash = await writeContractAsync({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "rawFulfillRandomWords",
          args: [BigInt(1), [BigInt(mockRandomNumber)]], // requestId=1, randomWords=[mockNumber]
          account: address,
        });

        console.log("MockVRF rawFulfillRandomWordsトランザクション:", txHash);
        
        if (txHash) {
          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
          console.log("MockVRF rawFulfillRandomWordsステータス:", receipt.status);
          
          if (receipt.status === 'reverted') {
            throw new Error(`MockVRF rawFulfillRandomWordsが失敗しました: ${txHash}`);
          }
        }
        
        return txHash;
      }
      
      return null;
    } catch (error) {
      console.error("MockVRF rawFulfillRandomWordsエラー:", error);
      
      // rawFulfillRandomWordsが失敗した場合、通常のperformUpkeepを試す
      console.log("フォールバック: 通常のperformUpkeepを試します...");
      try {
        return await performManualUpkeep();
      } catch (fallbackError) {
        console.error("フォールバックも失敗:", fallbackError);
        throw new Error(`MockVRF処理が完全に失敗: ${error}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 手動でUpkeepを実行するための関数 - スマートアカウント対応版
  const performManualUpkeep = async () => {
    if (
      (!isConnected && !isReadyToSendTx) ||
      (!address && !smartAccountAddress) ||
      !contractAddress
    ) {
      return null;
    }

    // スマートアカウントを使用するか判定
    const useSmartAccount =
      isReadyToSendTx && smartAccountAddress && sendUserOperation;

    try {
      setIsLoading(true); // 処理中状態を設定

      const automationStatus = await checkAutomationStatus();

      if (!automationStatus || !automationStatus.upkeepNeeded) {
        alert(
          "現在のラッフル状態ではUpkeepを実行できません。\n参加者数または時間経過などの条件を確認してください。"
        );
        setIsLoading(false);
        return null;
      }

      let txHash = "";

      // スマートアカウントを使用する場合
      if (useSmartAccount && sendUserOperation) {
        try {
          console.log("スマートアカウントで手動Upkeepを実行します...");

          // performUpkeep関数のエンコード
          const performUpkeepCallData = encodeFunctionData({
            abi: RaffleABI,
            functionName: "performUpkeep",
            args: ["0x"],
          });

          // UserOperationを送信
          let upkeepResult;
          try {
            upkeepResult = await sendUserOperation(
              contractAddress as `0x${string}`,
              performUpkeepCallData,
              BigInt(0)
            );

            if (!upkeepResult || !upkeepResult.txHash) {
              throw new Error("UserOperationのtxHashが取得できませんでした");
            }

            txHash = upkeepResult.txHash;
            console.log(
              "スマートアカウント手動Upkeepトランザクションハッシュ:",
              txHash
            );
            console.log(
              "エクスプローラーで確認: https://sepolia.etherscan.io/tx/" + txHash
            );
          } catch (sendError) {
            console.error("スマートアカウント送信エラー:", sendError);

            // ERC20: transfer amount exceeds balanceエラーを確認
            const errorString = String(sendError);
            if (errorString.includes("ERC20: transfer amount exceeds balance")) {
              const errorMessage = "スマートアカウントのガス代トークン残高が不足しています。通常のEOAウォレットを使用してください。";
              console.error(errorMessage);
              alert(errorMessage);
              setIsLoading(false);
              setError(errorMessage);
              return null;
            }
            
            // その他の一般的なスマートアカウントエラーをハンドリング
            if (errorString.includes("user rejected") || errorString.includes("user cancelled")) {
              const errorMessage = "ユーザーによってトランザクションがキャンセルされました。";
              console.error(errorMessage);
              setIsLoading(false);
              setError(errorMessage);
              return null;
            }
            
            throw sendError; // その他のエラーは上位のcatchに渡す
          }

          // ここで確実にトランザクションが確定するまで待つ
          const maxRetries = 20; // 最大再試行回数
          let retries = 0;
          let raffleFinished = false;

          // データ更新と状態確認を行う関数
          const checkRaffleStatus = async () => {
            console.log(
              `ラッフル状態確認中... (試行 ${retries + 1}/${maxRetries})`
            );

            // データ強制更新（updateRaffleDataが渡されている場合）
            if (updateRaffleData) {
              await updateRaffleData(true);
            }

            try {
              if (!publicClient) {
                console.error("Public client is not available");
                return false;
              }
              // 現在のラッフル状態を確認 (キャッシュ回避用のパラメータを追加)
              const currentState = await publicClient.readContract({
                address: contractAddress as `0x${string}`,
                abi: RaffleABI,
                functionName: "getRaffleState",
                blockTag: 'latest'
              });

              // 勝者を確認 (キャッシュ回避用のパラメータを追加)
              const currentWinner = await publicClient.readContract({
                address: contractAddress as `0x${string}`,
                abi: RaffleABI,
                functionName: "getRecentWinner",
                blockTag: 'latest'
              });

              // 当選者の正確な確認
              // データの整合性チェックを追加
              let isValidWinner = false;
              let winnerAddress: string | null = null;
              
              try {
              // 先にトランザクションのステータスを確認（txHashがある場合）
              let txSucceeded = false;
              let winnerFromEvent = null;
              
              if (txHash && txHash.startsWith('0x') && txHash.length === 66) {
              try {
              const txReceipt = await publicClient.getTransactionReceipt({ 
                hash: txHash as `0x${string}` 
              });
              
              if (txReceipt) {
              txSucceeded = txReceipt.status === 'success';
              console.log(`トランザクション ${txHash} のステータス:`, txSucceeded ? '成功' : '失敗');
              
              // 失敗したトランザクションの場合、勝者表示をスキップ
              if (!txSucceeded) {
              console.log("トランザクションが失敗したため、勝者は確定していません");
                return false;
                }
                  
                // トランザクションが成功した場合、リシートから直接WinnerPickedイベントを検索
                if (txReceipt.logs) {
                    for (const log of txReceipt.logs) {
                        try {
                              // WinnerPickedイベントのシグネチャ（最初の32バイト）
                              const winnerPickedSignature = '0x5c4c43b881ebe137c10d30116622a1bf5192ae1fa82e94c686c5ffd7b4a741b6';
                              
                              if (log.topics && log.topics[0] === winnerPickedSignature) {
                                // イベントから勝者アドレスを抽出 - インデックス付きAddressトピック
                                const winnerTopic = log.topics[1];
                                if (winnerTopic) {
                                  // アドレス形式に変換 (0x を追加し、正しい長さを確保)
                                  const winnerAddress = `0x${winnerTopic.slice(-40)}`;
                                  if (winnerAddress && winnerAddress.length === 42) {
                                    console.log('トランザクションリシートから勝者を抜き出しました:', winnerAddress);
                                    winnerFromEvent = winnerAddress;
                                    break;
                                  }
                                }
                              }
                            } catch (logError) {
                              console.warn('ログ解析エラー:', logError);
                            }
                          }
                        }
                      }
                    } catch (receiptError) {
                      console.warn("トランザクションレシート取得エラー:", receiptError);
                      // レシート取得に失敗しても続行
                    }
                  }
                
                // キャッシュを回避するためのtimestampを追加
                const timestamp = Date.now();
                // 最新ブロックから情報を強制取得
                const raffleState = await publicClient.readContract({
                  address: contractAddress as `0x${string}`,
                  abi: RaffleABI,
                  functionName: "getRaffleState",
                  blockTag: 'latest'
                });
                
                const winner = await publicClient.readContract({
                  address: contractAddress as `0x${string}`,
                  abi: RaffleABI,
                  functionName: "getRecentWinner",
                  blockTag: 'latest'
                });
                
                // トランザクションリシートから勝者が解析できた場合はそれを優先
                if (winnerFromEvent) {
                  winnerAddress = winnerFromEvent;
                  console.log('イベントから抽出した勝者アドレスを使用:', winnerAddress);
                } else {
                  // そうでなければコントラクトから取得した勝者を使用
                  winnerAddress = winner as string;
                }
                
                // 基本検証: ラッフル状態とアドレス形式の検証
                if (Number(raffleState) === 0 && 
                    winnerAddress && 
                    typeof winnerAddress === 'string' &&
                    winnerAddress.startsWith('0x') && 
                    winnerAddress.length === 42 &&
                    winnerAddress !== '0x0000000000000000000000000000000000000000') {
                    
                  // イベントからの確認
                  try {
                    // 最新のWinnerPickedイベントを取得
                    const currentBlock = await publicClient.getBlockNumber();
                    // 最新の100ブロックのみ検索（パフォーマンス対策）
                    const fromBlock = currentBlock > 100n ? currentBlock - 100n : 0n;
                    
                    const winnerEvents = await publicClient.getContractEvents({
                      address: contractAddress as `0x${string}`,
                      abi: RaffleABI,
                      eventName: 'WinnerPicked',
                      fromBlock,
                      toBlock: currentBlock
                    });
                    
                    if (winnerEvents.length > 0) {
                      // 最新のイベントから勝者を取得
                      const latestEvent = winnerEvents[winnerEvents.length - 1];
                      const eventWinner = (latestEvent as any).args?.winner;
                      
                      // イベントの勝者とコントラクトの勝者が一致するか確認
                      if (eventWinner && typeof eventWinner === 'string') {
                        if (eventWinner.toLowerCase() === winnerAddress.toLowerCase()) {
                          console.log("イベントとコントラクトの勝者が一致しました:", winnerAddress);
                          isValidWinner = true;
                        } else {
                          console.log("警告: イベントの勝者とコントラクトの勝者が異なります", {
                            event: eventWinner,
                            contract: winnerAddress
                          });
                          // イベントからの勝者を優先（より信頼性が高い）
                          winnerAddress = eventWinner;
                          isValidWinner = true;
                        }
                      }
                    } else if (txSucceeded) {
                      // イベントが見つからないがトランザクションは成功
                      // この場合はコントラクトの情報を信頼
                      console.log("WinnerPickedイベントは見つかりませんでしたが、トランザクションは成功していました。コントラクトの勝者情報を使用します。");
                      isValidWinner = true;
                    }
                  } catch (eventError) {
                    console.warn("勝者イベントの確認中にエラーが発生しました:", eventError);
                    
                    // トランザクションが成功していればコントラクトの情報を信頼
                    if (txSucceeded) {
                      console.log("イベント取得エラーですが、トランザクションは成功しています。コントラクトの勝者情報を使用します。");
                      isValidWinner = true;
                    }
                  }
                }
              } catch (validationError) {
                console.error("勝者検証エラー:", validationError);
                isValidWinner = false;
              }
              
              // 勝者が有効な場合のみ成功として処理
              if (isValidWinner && winnerAddress) {
                console.log("ラッフル成功: 勝者は", winnerAddress);
                raffleFinished = true;
                // 明示的にUpkeep状態を更新
                setIsUpkeepNeeded(false);
                
                // 1回だけイベントを発行するためのグローバルフラグ
                // これにより同じ勝者に対して複数回イベントが発行されることを防止
                if (!(window as any).hasDispatchedWinner) {
                  // コンポーネントの状態更新用に成功イベントを発行
                  dispatchEvent(new CustomEvent('raffle-completed', { 
                    detail: { winner: winnerAddress, txHash, timestamp: Date.now() } 
                  }));
                  // フラグをセット
                  (window as any).hasDispatchedWinner = winnerAddress;
                  // 10秒後にフラグをリセット
                  setTimeout(() => {
                    (window as any).hasDispatchedWinner = null;
                  }, 10000);
                } else if ((window as any).hasDispatchedWinner === winnerAddress) {
                  console.log('同じ勝者に対するイベントは既に発行済み:', winnerAddress);
                }
                // 追加の強制更新を入れる - 少し遅らせて非同期操作が確実に完了するようにする
                if (updateRaffleData) {
                  setTimeout(async () => {
                    await updateRaffleData(true);
                    // さらに1秒後にもう一度更新して確実に最新状態を反映
                    setTimeout(() => updateRaffleData(true), 1000);
                  }, 2000);
                }
                return true;
              } else {
                console.log("有効な勝者が確定できませんでした。ラッフルは完了していない可能性があります。");
                return false;
              }
            } catch (error) {
              console.error("ラッフル状態確認エラー:", error);
            }

            // 再試行回数を上限に達した場合は試行を打ち切る
            if (retries >= maxRetries) {
              console.log(
                "最大試行回数に達しましたが、ラッフルはまだ完了していません"
              );
              return false;
            }

            // ラッフルがまだ完了していない場合は再試行
            retries++;
            // 1秒待機して再度確認
            setTimeout(checkRaffleStatus, 1000);
            return false;
          };

          // 状態確認開始 (初回は少し遅らせてトランザクション確定を待つ)
          setTimeout(checkRaffleStatus, 5000);

          // 結果が確定するまで待つ
          const waitForCompletion = () => {
            return new Promise<string>((resolve) => {
              const checkInterval = setInterval(() => {
                if (raffleFinished) {
                  clearInterval(checkInterval);
                  resolve(txHash);
                }
                // 最大待機時間を超えた場合も終了
                if (retries >= maxRetries) {
                  clearInterval(checkInterval);
                  resolve(txHash); // 最大再試行回数を超えてもハッシュを返す
                }
              }, 1000);
            });
          };

          // 完了を待つ
          return await waitForCompletion();
        } catch (smartAccountError) {
          // sendUserOperationのエラーをキャッチしても、トランザクション自体が送信完了している可能性がある
          console.error(
            "スマートアカウント手動Upkeepエラー(トランザクション自体は送信完了している可能性がある):",
            smartAccountError
          );

          // エラーメッセージを構成
          const errorMsg =
            smartAccountError instanceof Error
              ? smartAccountError.message
              : "不明なエラー";

          // トランザクションハッシュがエラーメッセージに含まれているか確認
          // 正確なトランザクションハッシュパターンのみをマッチさせる
          // 完全なトランザクションハッシュは0xで始まる64文字の16進数
          const txHashRegex = /0x([a-fA-F0-9]{64})\b/;
          const txHashMatch = errorMsg.match(txHashRegex);
          
          // メソッドシグネチャやcalldata部分と区別するため、正確な形式のみを抽出
          if (txHashMatch && txHashMatch[0].length === 66 && 
              !errorMsg.includes(txHashMatch[0] + "000000") && // callDataの一部でないか確認
              !errorMsg.includes("function selector") && // 関数セレクタでないか確認
              !errorMsg.includes("calldata")) { // calldataの一部でないか確認
              
            // トランザクションハッシュを取得できた場合は成功とみなす
            txHash = txHashMatch[0];
            console.log("エラー内で有効なトランザクションハッシュを発見:", txHash);
            
            // 検証: 実際にこれがトランザクションハッシュであることを確認
            try {
              if (publicClient) {
                const txReceipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
                if (txReceipt) {
                  console.log("トランザクションレシートを取得しました:", txReceipt);
                } else {
                  console.warn("トランザクションレシートが見つかりません - これは実際のハッシュではないかもしれません");
                  txHash = ""; // 無効なハッシュをクリア
                }
              }
            } catch (receiptError) {
              console.warn("トランザクションハッシュ検証エラー - これは実際のハッシュではないかもしれません:", receiptError);
              txHash = ""; // エラーが発生した場合、これは実際のハッシュではない可能性が高い
            }

            // データを再取得して状態を更新 (引き続き非同期で)
            if (updateRaffleData) {
              setTimeout(async () => {
                await updateRaffleData(true);
              }, 5000);
            }

            return txHash;
          }

          throw new Error(
            `スマートアカウントでの手動Upkeep実行に失敗しました: ${errorMsg}`
          );
        }
      }
      // 通常のEOAを使用する場合
      else if (isConnected && address && publicClient && writeContract) {
        try {
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

          const customRequest = {
            ...request,
            gas: BigInt(1000000),
          };

          await writeContract(customRequest);

          // トランザクションハッシュが返されるのを待つ
          if (contractWriteData) {
            if (!publicClient)
              throw new Error("Public client is not available");

            try {
              console.log("トランザクション確認中:", contractWriteData);

              // ここでラッフル状態を確認する再試行ループを追加
              const maxRetries = 15;
              let retries = 0;
              let raffleFinished = false;

              // ラッフル状態確認関数
              const checkRaffleStatus = async () => {
                console.log(
                  `ラッフル状態確認中 (EOAモード)... (試行 ${
                    retries + 1
                  }/${maxRetries})`
                );

                // データ強制更新（updateRaffleDataが渡されている場合）
                if (updateRaffleData) {
                  await updateRaffleData(true);
                }

                try {
                  if (!publicClient) {
                    console.error("Public client is not available");
                    return false;
                  }
                  // 現在のラッフル状態を確認 (キャッシュ回避用のパラメータを追加)
                  const currentState = await publicClient.readContract({
                    address: contractAddress as `0x${string}`,
                    abi: RaffleABI,
                    functionName: "getRaffleState",
                    blockTag: 'latest'
                  });

                  // 勝者を確認 (キャッシュ回避用のパラメータを追加)
                  const currentWinner = await publicClient.readContract({
                    address: contractAddress as `0x${string}`,
                    abi: RaffleABI,
                    functionName: "getRecentWinner",
                    blockTag: 'latest'
                  });

                  // 追加の検証: ラッフル状態が0（開始状態）かつ勝者が有効なアドレスか確認
                  let isValidWinner = false;
                  let winnerAddress = currentWinner as string;
                  
                  // 勝者アドレスの基本的な検証
                  if (Number(currentState) === 0 && 
                      winnerAddress && 
                      typeof winnerAddress === 'string' &&
                      winnerAddress.startsWith('0x') && 
                      winnerAddress.length === 42 &&
                      winnerAddress !== '0x0000000000000000000000000000000000000000') {
                      
                    // イベントからも確認（より確実に）
                    try {
                      // 最新100ブロック内のWinnerPickedイベントを検索
                      const currentBlock = await publicClient.getBlockNumber();
                      const fromBlock = currentBlock > 100n ? currentBlock - 100n : 0n;
                      
                      const winnerEvents = await publicClient.getContractEvents({
                        address: contractAddress as `0x${string}`,
                        abi: RaffleABI,
                        eventName: 'WinnerPicked',
                        fromBlock,
                        toBlock: currentBlock
                      });
                      
                      if (winnerEvents.length > 0) {
                        const latestEvent = winnerEvents[winnerEvents.length - 1];
                        const eventWinner = (latestEvent as any).args?.winner;
                        
                        if (eventWinner && typeof eventWinner === 'string') {
                          if (eventWinner.toLowerCase() === winnerAddress.toLowerCase()) {
                            console.log("イベントとコントラクトの勝者が一致しました (EOA):", winnerAddress);
                            isValidWinner = true;
                          } else {
                            console.log("警告: イベントの勝者とコントラクトの勝者が異なります (EOA)", {
                              event: eventWinner,
                              contract: winnerAddress
                            });
                            // イベントの情報を優先
                            winnerAddress = eventWinner;
                            isValidWinner = true;
                          }
                        }
                      } else {
                        // イベントがなくても、コントラクト状態が正しければOK
                        console.log("イベントは検出されませんでしたが、コントラクト状態は正常です (EOA)");
                        isValidWinner = true;
                      }
                    } catch (eventError) {
                      console.warn("勝者イベント確認エラー (EOA):", eventError);
                      // イベント取得に失敗しても、基本検証が通っていれば成功とみなす
                      isValidWinner = true;
                    }
                  }
                  
                  if (isValidWinner) {
                    console.log("ラッフル成功 (EOA): 勝者は", winnerAddress);
                    raffleFinished = true;
                    // 明示的にUpkeep状態を更新
                    setIsUpkeepNeeded(false);
                    
                    // 1回だけイベントを発行するためのグローバルフラグ
                    // これにより同じ勝者に対して複数回イベントが発行されることを防止
                    if (!(window as any).hasDispatchedWinner) {
                      // コンポーネントの状態更新用に成功イベントを発行
                      dispatchEvent(new CustomEvent('raffle-completed', { 
                        detail: { winner: winnerAddress, txHash: contractWriteData, timestamp: Date.now() } 
                      }));
                      // フラグをセット
                      (window as any).hasDispatchedWinner = winnerAddress;
                      // 10秒後にフラグをリセット
                      setTimeout(() => {
                        (window as any).hasDispatchedWinner = null;
                      }, 10000);
                    } else if ((window as any).hasDispatchedWinner === winnerAddress) {
                      console.log('同じ勝者に対するイベントは既に発行済み (EOA):', winnerAddress);
                    }
                    // 追加の強制更新を入れる - 確実に最新状態を反映するため複数回実行
                    if (updateRaffleData) {
                      setTimeout(async () => {
                        await updateRaffleData(true);
                        // さらに1秒後にもう一度更新
                        setTimeout(() => updateRaffleData(true), 1000);
                      }, 2000);
                    }
                    return true;
                  } else {
                    console.log("有効な勝者が確定できませんでした (EOA)。ラッフルは完了していない可能性があります。");
                    return false;
                  }
                } catch (error) {
                  console.error("ラッフル状態確認エラー:", error);
                }

                // 再試行回数を上限に達した場合は試行を打ち切る
                if (retries >= maxRetries) {
                  console.log(
                    "最大試行回数に達しましたが、結果を取得できませんでした"
                  );
                  return false;
                }

                // 再試行
                retries++;
                setTimeout(checkRaffleStatus, 1000);
                return false;
              };

              // 状態確認開始 (初回は少し遅らせてトランザクション確定を待つ)
              setTimeout(checkRaffleStatus, 2000);

              // 結果が確定するまで待つ
              const waitForCompletion = () => {
                return new Promise<`0x${string}`>((resolve) => {
                  const checkInterval = setInterval(() => {
                    if (raffleFinished) {
                      clearInterval(checkInterval);
                      resolve(contractWriteData);
                    }
                    // 最大待機時間を超えた場合も終了
                    if (retries >= maxRetries) {
                      clearInterval(checkInterval);
                      resolve(contractWriteData);
                    }
                  }, 1000);
                });
              };

              // 完了を待つ
              return await waitForCompletion();
            } catch (error) {
              console.error("トランザクション確認エラー:", error);
              // エラーが発生しても、トランザクション自体は送信されている可能性があるのでハッシュを返す
              return contractWriteData;
            }
          }
          return null;
        } catch (error) {
          console.error("手動Upkeep実行エラー:", error);
          throw error;
        }
      } else {
        // どちらの条件も満たさない場合
        console.error(
          "ウォレットが接続されていないか、スマートアカウントが準備できていません"
        );
        return null;
      }
    } catch (error) {
      console.error("手動Upkeep実行エラー:", error);
      throw error;
    } finally {
      setIsLoading(false); // 処理完了状態を設定
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

      // contractWriteData にトランザクションハッシュが含まれるのを待つ必要があるかもしれない
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
