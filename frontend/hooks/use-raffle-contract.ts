"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useChainId,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";

import { formatUnits, encodeFunctionData } from "viem";
import { RaffleABI, ERC20ABI, contractConfig } from "@/app/lib/contract-config";
import { createHandleCancelEntry } from "./cancel-entry";
import { useSmartAccountContext } from "@/app/providers/smart-account-provider";

// checkUpkeepDebug用の型定義
type UpkeepDebugInfo = {
  isOpen: boolean;
  hasPlayers: boolean;
  hasTimePassed: boolean;
  timeSinceMinPlayers: bigint;
  requiredTime: bigint;
  playerCount: bigint;
};

// ラッフル履歴エントリーの型定義
type RaffleHistoryEntry = {
  winner: string;
  prize: bigint;
  jackpotWon: boolean;
  timestamp: bigint;
  playerCount: bigint;
};

// ユーザー統計情報の型定義
type UserStats = {
  entryCount: bigint;
  winCount: bigint;
  jackpotCount: bigint;
};
// contractConfigのキーの型を定義
type SupportedChainId = keyof typeof contractConfig;

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

  // スマートアカウント機能を使用
  const { smartAccountAddress, isReadyToSendTx, sendUserOperation } =
    useSmartAccountContext();

  // トークン残高情報
  const [tokenBalanceInfo, setTokenBalanceInfo] = useState<{
    hasEnoughBalance: boolean;
    balance: string;
    requiredAmount: string;
  }>({
    hasEnoughBalance: false,
    balance: "0",
    requiredAmount: "0",
  });

  // UI表示用の読み込み状態管理
  const [uiLoading, setUiLoading] = useState(true);
  // プレイヤーの参加状態を管理
  const [isPlayerEntered, setIsPlayerEntered] = useState(false);
  // upkeepNeededの状態を管理
  const [isUpkeepNeeded, setIsUpkeepNeeded] = useState(false);
  // デバッグ表示防止用
  const [lastStateChange, setLastStateChange] = useState(Date.now());

  // チェーンIDから正しいコントラクトアドレスを取得
  const currentChainId = chainId || 11155111; // デフォルトはSepolia

  const contractAddress =
    contractConfig[currentChainId as SupportedChainId]?.raffleProxy || null;
  const erc20Address =
    contractConfig[currentChainId as SupportedChainId]?.erc20Address || null;
  // プロバイダーチェック
  const publicClient = usePublicClient({ chainId: currentChainId });

  // コントラクト書き込み関数
  const {
    writeContract,
    writeContractAsync,
    data: contractWriteData,
    error: contractWriteError,
  } = useWriteContract(); // writeContractAsync を追加

  // トランザクション待機
  const { isLoading: isTransactionLoading, isSuccess: isTransactionSuccess } =
    useWaitForTransactionReceipt({
      hash: contractWriteData,
    });

  // コントラクト読み取り
  const { data: entranceFeeData } = useReadContract(
    contractAddress
      ? {
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "getEntranceFee",
          chainId: currentChainId,
        }
      : {}
  );

  const { data: numberOfPlayersData } = useReadContract(
    contractAddress
      ? {
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "getNumberOfPlayers",
          chainId: currentChainId,
        }
      : {}
  );

  const { data: raffleStateData } = useReadContract(
    contractAddress
      ? {
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "getRaffleState",
          chainId: currentChainId,
        }
      : {}
  );

  const { data: jackpotAmountData } = useReadContract(
    contractAddress
      ? {
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "getJackpotAmount",
          chainId: currentChainId,
        }
      : {}
  );

  const { data: recentWinnerData } = useReadContract(
    contractAddress
      ? {
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "getRecentWinner",
          chainId: currentChainId,
        }
      : {}
  );

  const { data: ownerData } = useReadContract(
    contractAddress
      ? {
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "getOwner",
          chainId: currentChainId,
        }
      : {}
  );

  // プレイヤーリストのキャッシュ用変数
  let cachedPlayers: string[] = [];
  let cachedPlayerCount = 0;
  let lastPlayersUpdateTime = 0;
  const PLAYERS_CACHE_DURATION = 30000; // 30秒に延長

  // ログ制御用変数
  let lastLogTime = 0;
  let lastLoggedPlayerCount = -1;
  const LOG_INTERVAL = 30000; // 30秒に延長

  // プレイヤーリストを取得
  const getPlayers = async (knownPlayerCount?: number) => {
    if (!contractAddress || !publicClient) return [];

    try {
      // キャッシュが有効なら再利用
      const now = Date.now();
      if (
        cachedPlayers.length > 0 &&
        now - lastPlayersUpdateTime < PLAYERS_CACHE_DURATION
      ) {
        return cachedPlayers;
      }

      // プレイヤー数の取得（既知の場合は取得をスキップ）
      let currentPlayerCount = knownPlayerCount;
      if (currentPlayerCount === undefined) {
        try {
          const playerCountResult = await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: RaffleABI,
            functionName: "getNumberOfPlayers",
          });
          currentPlayerCount = Number(playerCountResult || 0);

          // ログ出力の制御
          const currentNow = Date.now();
          if (
            currentNow - lastLogTime > LOG_INTERVAL &&
            currentPlayerCount !== lastLoggedPlayerCount
          ) {
            console.log("プレイヤー数取得:", currentPlayerCount);
            lastLogTime = currentNow;
            lastLoggedPlayerCount = currentPlayerCount;
          }
        } catch (error) {
          console.error("プレイヤー数取得エラー:", error);
          return cachedPlayers.length > 0 ? cachedPlayers : [];
        }
      }

      // プレイヤー数が前回と同じ場合はキャッシュを再利用
      const count = Number(currentPlayerCount || 0);
      if (count === cachedPlayerCount && cachedPlayers.length > 0) {
        lastPlayersUpdateTime = now; // キャッシュ時間を更新
        return cachedPlayers;
      }

      // プレイヤー数が0の場合は早期リターン
      if (count <= 0) {
        cachedPlayers = [];
        cachedPlayerCount = 0;
        lastPlayersUpdateTime = now;
        return [];
      }

      const players = [];

      // 安全にプレイヤーを取得するため、一度に1人ずつ処理（3-4人程度の小規模想定）
      for (let i = 0; i < count; i++) {
        try {
          const player = await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: RaffleABI,
            functionName: "getPlayer",
            args: [BigInt(i)],
          });

          if (player) players.push(player as string);

          // 3-4人程度なので、2人目以降はレート制限回避のために少し待機
          if (i > 0 && i < count - 1) {
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        } catch (error) {
          console.error(`プレイヤー${i}取得エラー:`, error);
          // エラーが発生した場合は、以降の取得を中止
          break;
        }
      }

      // 取得結果をキャッシュ
      cachedPlayers = players;
      cachedPlayerCount = count;
      lastPlayersUpdateTime = now;

      return players;
    } catch (error) {
      console.error("プレイヤーリスト取得全体エラー:", error);
      // エラー時はキャッシュがあれば再利用
      return cachedPlayers.length > 0 ? cachedPlayers : [];
    }
  };

  // プレイヤー参加状態のキャッシュ用変数
  let lastPlayerCheckTime = 0;
  const PLAYER_CHECK_INTERVAL = 15000; // 15秒に延長

  // プレイヤーの参加状態を確認 - スマートアカウントアドレスのサポートを追加
  const checkPlayerEntered = async (checkAddress = "") => {
    // チェック対象のアドレスを決定 - 引数で指定されたアドレスか通常の接続アドレス
    const targetAddress = checkAddress || address;

    if (
      (!isConnected && !checkAddress) ||
      !targetAddress ||
      !contractAddress ||
      !publicClient
    ) {
      setIsPlayerEntered(false);
      return false;
    }

    // 状態更新を適切な間隔で行う
    const now = Date.now();
    if (now - lastPlayerCheckTime < PLAYER_CHECK_INTERVAL) {
      // キャッシュ有効期間内は現在の状態をそのまま返す
      return isPlayerEntered;
    }

    try {
      // 前回のチェックと比較するために現在の状態を記録
      const prevIsPlayerEntered = isPlayerEntered;

      // 直接コントラクトから最新のプレイヤーリストを取得
      const players = await getPlayers();

      // プレイヤー配列内にアドレスがあるかをチェック
      const isEntered = players.some(
        (player) => player.toLowerCase() === targetAddress.toLowerCase()
      );

      // 状態が変わった場合のみデバッグ情報を出力
      if (prevIsPlayerEntered !== isEntered) {
        // 状態変更時間を更新
        setLastStateChange(Date.now());

        // 最近のログ出力から3秒以上経過していればログを出力
        const now = Date.now();
        if (now - lastStateChange > 3000) {
          console.log("参加状態変更:", {
            targetAddress,
            prevState: prevIsPlayerEntered,
            newState: isEntered,
            playerCount: players.length,
          });
        }
      }

      // 状態を更新
      setIsPlayerEntered(isEntered);
      lastPlayerCheckTime = now; // チェック時間を更新

      // 結果を返す
      return isEntered;
    } catch (error) {
      console.error("プレイヤー参加状態確認エラー:", error);
      // エラーの場合は参加していないと判断
      setIsPlayerEntered(false);
      return false;
    }
  };

  // 前回取得したデータを保存する変数
  let lastRaffleState = 0;
  let lastPlayerCount = 0;
  let lastUpdateTime = 0;
  const UPDATE_INTERVAL = 20000; // 20秒に延長

  // データを更新
  const updateRaffleData = async (forceUpdate = false) => {
    try {
      // 強制更新フラグが有効な場合はローディング状態を一時的に有効にする
      if (forceUpdate) {
        console.log("ラッフルデータの強制更新を実行します");
        setUiLoading(true);
        // 強制更新時は間隔チェックをスキップ
      } else {
        // 前回の更新から十分な時間が経過していない場合はスキップ（強制更新時は除く）
        const now = Date.now();
        if (now - lastUpdateTime < UPDATE_INTERVAL) {
          return;
        }
      }

      if (contractAddress && publicClient) {
        // 強制更新時は間隔チェックをスキップ
        if (!forceUpdate) {
          // 状態確認: 更新の必要があるかどうかを最初にチェック
          try {
            // 最小限のRPC呼び出しで状態を確認
            const currentStateRequest = {
              address: contractAddress as `0x${string}`,
              abi: RaffleABI,
              functionName: "getRaffleState",
            };

            const directPlayerCountRequest = {
              address: contractAddress as `0x${string}`,
              abi: RaffleABI,
              functionName: "getNumberOfPlayers",
            };

            // 状態とプレイヤー数をチェック
            const currentState = Number(
              await publicClient.readContract(currentStateRequest)
            );
            const currentPlayerCount = await publicClient.readContract(
              directPlayerCountRequest
            );

            // 状態に変化がなく強制更新でもない場合はスキップ
            if (
              !forceUpdate &&
              currentState === lastRaffleState &&
              Number(currentPlayerCount) === lastPlayerCount
            ) {
              // 状態に変化なし - 更新をスキップ
              lastUpdateTime = Date.now(); // 最終確認時間を更新
              return;
            }

            // 状態が変化した場合は更新を実行
            lastRaffleState = currentState;
            lastPlayerCount = Number(currentPlayerCount);
            lastUpdateTime = Date.now();

            // ログ出力の制御
            const logNow = Date.now();
            if (
              forceUpdate ||
              (logNow - lastLogTime > LOG_INTERVAL &&
                Number(currentPlayerCount) !== lastLoggedPlayerCount)
            ) {
              console.log(
                "コントラクトからの最新プレイヤー数:",
                Number(currentPlayerCount)
              );
              lastLogTime = logNow;
              lastLoggedPlayerCount = Number(currentPlayerCount);
            }

            // プレイヤーリストを取得（既知のプレイヤー数を渡す）
            const players = await getPlayers(Number(currentPlayerCount));

            // プレイヤー数をBigIntからNumberに安全に変換
            const playerCount = Number(currentPlayerCount);

            // プレイヤー参加状態を確認
            if (isConnected && address) {
              await checkPlayerEntered();
            }

            // データ更新前にデバッグログ出力
            const now = Date.now();
            // 前回の更新から10秒以上経過している場合のみログを出力
            if (now - lastStateChange > 10000) {
              console.log("ラッフル状態更新:", {
                currentPlayers: players.length,
                isPlayerEntered: isPlayerEntered,
              });
            }

            // 共通フォーマット関数を使用してラッフルデータを更新
            setRaffleData(formatRaffleData(players, playerCount));

            // データ更新後の参加状態確認は必要な場合のみ実行
            if (isConnected && address && forceUpdate) {
              setTimeout(async () => {
                await checkPlayerEntered();
              }, 500);
            }
          } catch (directError) {
            console.error("直接データ取得エラー:", directError);

            // フォールバック: 元のロジックを使用
            await fallbackUpdateRaffleData();
          }
        }
      }
    } catch (error) {
      console.error("ラッフルデータ更新エラー:", error);
      try {
        // フォールバックを再度試行
        await fallbackUpdateRaffleData();
      } catch (fallbackError) {
        console.error("フォールバックデータ更新エラー:", fallbackError);
      }
    } finally {
      // UI表示用のローディング状態を停止
      setTimeout(() => {
        setUiLoading(false);
      }, 500); // 少し遅らせて表示を正しく切り替える
    }
  };

  // 共通のデータフォーマット関数
  const formatRaffleData = (players: string[], playerCount?: number) => {
    let formattedEntranceFee = "0";
    let formattedJackpotAmount = "0";

    try {
      if (entranceFeeData && typeof entranceFeeData === "bigint") {
        formattedEntranceFee = formatUnits(entranceFeeData, 6);
      }
      if (jackpotAmountData && typeof jackpotAmountData === "bigint") {
        formattedJackpotAmount = formatUnits(jackpotAmountData, 6);
      }
    } catch (error) {
      console.error("Error formatting data:", error);
    }

    return {
      entranceFee: formattedEntranceFee,
      numberOfPlayers: playerCount || players.length,
      raffleState: raffleStateData ? Number(raffleStateData) : 0,
      jackpotAmount: formattedJackpotAmount,
      recentWinner:
        recentWinnerData &&
        (recentWinnerData as string) !==
          "0x0000000000000000000000000000000000000000"
          ? (recentWinnerData as string)
          : null,
      players,
      owner: (ownerData as string) || null,
    };
  };

  // フォールバック用のデータ更新関数
  const fallbackUpdateRaffleData = async () => {
    if (!contractAddress) return;

    try {
      // 参加者リストの取得を試みる
      const players = await getPlayers();

      // プレイヤー参加状態を確認
      if (isConnected && address) {
        await checkPlayerEntered();
      }

      // 共通フォーマット関数を使用
      setRaffleData(formatRaffleData(players));
      console.log("フォールバック更新完了");
    } catch (error) {
      console.warn("フォールバックも失敗、既存データを維持:", error);
      // エラーを投げずに既存データを維持
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
        args: ["0x"],
      });

      return { upkeepNeeded: result[0] };
    } catch (error) {
      console.error("Automation状態確認エラー:", error);
      return null;
    }
  };

  // より詳細なUpkeep条件チェック (デバッグ用)
  const checkUpkeepDebug = async (): Promise<UpkeepDebugInfo | null> => {
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
          const upkeepResult = await sendUserOperation(
            contractAddress as `0x${string}`,
            performUpkeepCallData,
            BigInt(0)
          );

          txHash = upkeepResult.txHash;
          console.log(
            "スマートアカウント手動Upkeepトランザクションハッシュ:",
            txHash
          );
          console.log(
            "エクスプローラーで確認: https://sepolia.etherscan.io/tx/" + txHash
          );

          // ここで確実にトランザクションが確定するまで待つ
          const maxRetries = 20; // 最大再試行回数
          let retries = 0;
          let raffleFinished = false;

          // データ更新と状態確認を行う関数
          const checkRaffleStatus = async () => {
            console.log(
              `ラッフル状態確認中... (試行 ${retries + 1}/${maxRetries})`
            );

            // データ強制更新
            await updateRaffleData(true);

            // 現在のラッフル状態を確認
            const currentState = raffleData.raffleState;
            const currentWinner = raffleData.recentWinner;

            // ラッフルが開始状態に戻っていて、勝者が指定されていれば成功
            if (currentState === 0 && currentWinner) {
              console.log("ラッフル成功: 勝者は", currentWinner);
              raffleFinished = true;
              return true;
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
            "スマートアカウント手動Upkeepエラー:",
            smartAccountError
          );

          // エラーメッセージを構成
          const errorMsg =
            smartAccountError instanceof Error
              ? smartAccountError.message
              : "不明なエラー";

          // トランザクションハッシュがエラーメッセージに含まれているか確認
          const txHashMatch = errorMsg.match(/0x[a-fA-F0-9]{64}/);
          if (txHashMatch) {
            // トランザクションハッシュを取得できた場合は成功とみなす
            txHash = txHashMatch[0];
            console.log("エラー内でトランザクションハッシュを発見:", txHash);

            // データを再取得して状態を更新 (引き続き非同期で)
            setTimeout(async () => {
              await updateRaffleData(true);
            }, 5000);

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
              // トランザクションの確認を待つ
              const receipt = await publicClient.waitForTransactionReceipt({
                hash: contractWriteData,
              });

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

                // データ強制更新
                await updateRaffleData(true);

                // 現在のラッフル状態を確認
                const currentState = raffleData.raffleState;
                const currentWinner = raffleData.recentWinner;

                // ラッフルが開始状態に戻っているか確認
                if (currentState === 0 && currentWinner) {
                  console.log("ラッフル成功 (EOA): 勝者は", currentWinner);
                  raffleFinished = true;
                  return true;
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

  // トークン残高チェック用関数
  const checkTokenBalance = async (checkAddress = "") => {
    const accountAddress = checkAddress || address;

    if (
      (!isConnected && !checkAddress) ||
      !accountAddress ||
      !erc20Address ||
      !publicClient
    )
      return false;

    try {
      const balance = await publicClient.readContract({
        address: erc20Address as `0x${string}`,
        abi: ERC20ABI,
        functionName: "balanceOf",
        args: [accountAddress],
      });

      const minRequired = entranceFeeData || BigInt(10000000);

      if (
        typeof balance === "bigint" &&
        typeof minRequired === "bigint" &&
        balance < minRequired
      ) {
        setError(
          `トークン残高が不足しています (${formatUnits(
            balance as bigint,
            6
          )} / 必要額: ${formatUnits(minRequired, 6)} USDC)`
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error("トークン残高チェックエラー:", error);
      return false;
    }
  };

  // トークン残高チェック用関数 - 情報も返すバージョン
  const checkTokenBalanceWithInfo = async (checkAddress = "") => {
    const accountAddress = checkAddress || address;

    if (
      (!isConnected && !checkAddress) ||
      !accountAddress ||
      !erc20Address ||
      !publicClient
    ) {
      return { hasEnoughBalance: false, balance: "0", requiredAmount: "0" };
    }

    try {
      const balance = await publicClient.readContract({
        address: erc20Address as `0x${string}`,
        abi: ERC20ABI,
        functionName: "balanceOf",
        args: [accountAddress],
      });

      const minRequired = entranceFeeData || BigInt(10000000);

      const formattedBalance =
        typeof balance === "bigint" ? formatUnits(balance, 6) : "0";
      const formattedRequired =
        typeof minRequired === "bigint" ? formatUnits(minRequired, 6) : "0";

      const hasEnough =
        typeof balance === "bigint" &&
        typeof minRequired === "bigint" &&
        balance >= minRequired;

      if (!hasEnough) {
        setError(
          `トークン残高が不足しています (${formattedBalance} / 必要額: ${formattedRequired} USDC)`
        );
      }

      // 残高情報を状態に保存
      const balanceInfo = {
        hasEnoughBalance: hasEnough,
        balance: formattedBalance,
        requiredAmount: formattedRequired,
      };
      setTokenBalanceInfo(balanceInfo);

      return balanceInfo;
    } catch (error) {
      console.error("トークン残高チェックエラー:", error);
      return { hasEnoughBalance: false, balance: "0", requiredAmount: "0" };
    }
  };

  // 承認状態チェック用関数
  const checkAllowance = async (checkAddress = "") => {
    const accountAddress = checkAddress || address;

    if (
      (!isConnected && !checkAddress) ||
      !accountAddress ||
      !erc20Address ||
      !contractAddress ||
      !publicClient
    )
      return false;

    try {
      const allowance = await publicClient.readContract({
        address: erc20Address as `0x${string}`,
        abi: ERC20ABI,
        functionName: "allowance",
        args: [accountAddress, contractAddress as `0x${string}`],
      });

      const minRequired = entranceFeeData || BigInt(10000000);
      return (
        typeof allowance === "bigint" &&
        typeof minRequired === "bigint" &&
        allowance >= minRequired
      );
    } catch (error) {
      console.error("承認状態チェックエラー:", error);
      return false;
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
        abi: [
          ...RaffleABI,
          {
            type: "function",
            name: "manualPerformUpkeep",
            inputs: [],
            outputs: [],
            stateMutability: "nonpayable",
          },
        ],
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

  // 残高キャッシュ機能
  let balanceCache: {
    ethBalance?: string;
    usdcBalance?: string;
    lastUpdated: number;
  } = { lastUpdated: 0 };
  const CACHE_TTL = 120000; // 2分に延長（レート制限対策）

  // コントラクトのETH残高を取得する関数
  const getContractEthBalance = async () => {
    const now = Date.now();

    // キャッシュが有効な場合は返す
    if (balanceCache.ethBalance && now - balanceCache.lastUpdated < CACHE_TTL) {
      return balanceCache.ethBalance;
    }

    if (!contractAddress || !publicClient) return "0";

    try {
      // publicClientを使用（CORS問題を回避）
      const balance = await publicClient.getBalance({
        address: contractAddress as `0x${string}`,
      });

      const result = formatUnits(balance, 18);
      balanceCache.ethBalance = result;
      balanceCache.lastUpdated = now;
      return result;
    } catch (error) {
      console.error("コントラクトETH残高取得エラー:", error);
      return balanceCache.ethBalance || "0";
    }
  };

  // コントラクトのUSDC残高を取得する関数
  const getContractUsdcBalance = async () => {
    const now = Date.now();

    // キャッシュが有効な場合は返す
    if (
      balanceCache.usdcBalance &&
      now - balanceCache.lastUpdated < CACHE_TTL
    ) {
      return balanceCache.usdcBalance;
    }

    if (!contractAddress || !erc20Address || !publicClient) return "0";

    try {
      // publicClientを使用してERC20残高を取得
      const balance = await publicClient.readContract({
        address: erc20Address as `0x${string}`,
        abi: ERC20ABI,
        functionName: "balanceOf",
        args: [contractAddress],
      });

      const result = typeof balance === "bigint" ? balance.toString() : "0";
      balanceCache.usdcBalance = result;
      balanceCache.lastUpdated = now;
      return result;
    } catch (error) {
      console.error("コントラクトUSDC残高取得エラー:", error);
      return balanceCache.usdcBalance || "0";
    }
  };

  // ラッフルに参加する関数
  const handleEnterRaffle = async (smartAccountAddress = "") => {
    // スマートアカウントが渡された場合はそれを使用し、そうでなければ通常のEOAを使用
    const userAddress = smartAccountAddress || address;

    if (!isConnected && !smartAccountAddress) {
      setError("ウォレットが接続されていません");
      return { success: false, error: "ウォレットが接続されていません" };
    }

    if (!contractAddress || !erc20Address) {
      setError("コントラクトアドレスが設定されていません");
      return {
        success: false,
        error: "コントラクトアドレスが設定されていません",
      };
    }

    // デバッグ出力を追加
    console.log("handleEnterRaffle - 使用するアドレス:", userAddress);
    console.log("handleEnterRaffle - コントラクトアドレス:", contractAddress);
    console.log("handleEnterRaffle - ERC20アドレス:", erc20Address);

    // プレイヤーがすでに参加しているかチェック - スマートアカウントアドレスが渡された場合はそのアドレスを使用してチェック
    const playerEntered = await checkPlayerEntered(smartAccountAddress);
    if (playerEntered) {
      setError("あなたはすでにこのラッフルに参加しています");
      return {
        success: false,
        error: "あなたはすでにこのラッフルに参加しています",
      };
    }

    try {
      setIsLoading(true);
      setError(null);

      // トークン残高チェック
      const hasEnoughBalance = await checkTokenBalance(userAddress);
      if (!hasEnoughBalance) {
        throw new Error(
          error ||
            "トークン残高が不足しています。テストネットUSDCを取得してください。"
        );
      }

      // ERC20承認用のヘルパー関数
      const approveErc20Transaction = async (): Promise<
        `0x${string}` | null
      > => {
        // Return hash or null
        // 既存の承認状態をチェック
        const hasAllowance = await checkAllowance(userAddress);
        if (hasAllowance) {
          return null; // Indicate no approval needed or already done
        }

        if (!writeContractAsync) {
          // writeContractAsync を使用
          throw new Error("コントラクト書き込み機能(async)が利用できません");
        }
        if (!publicClient) throw new Error("Public client is not available");

        // ApproveをSimulateする
        let approveRequest;
        try {
          const simulationResult = await publicClient.simulateContract({
            address: erc20Address as `0x${string}`,
            abi: ERC20ABI,
            functionName: "approve",
            args: [contractAddress as `0x${string}`, BigInt("100000000000000")], // 大きめの値で承認
            account: userAddress as `0x${string}`,
          });
          approveRequest = simulationResult.request;
        } catch (simError) {
          throw new Error(
            `承認トランザクションのシミュレーションに失敗しました: ${
              simError instanceof Error ? simError.message : simError
            }`
          );
        }

        if (!approveRequest) {
          throw new Error("承認リクエストの準備に失敗しました");
        }
        // console.log("Approve simulation successful."); // Moved up

        try {
          // 承認処理を実行し、ハッシュを取得
          let approveHash: `0x${string}` | undefined;
          try {
            approveHash = await writeContractAsync(approveRequest); // writeContractAsync を使用
          } catch (writeError) {
            // Check for user rejection specifically
            if (
              writeError instanceof Error &&
              (writeError.message.includes("rejected") ||
                writeError.message.includes("denied") ||
                writeError.message.includes("User rejected"))
            ) {
              throw new Error("ユーザーが承認トランザクションを拒否しました。");
            }
            throw new Error(
              `承認トランザクションの送信に失敗しました: ${
                writeError instanceof Error ? writeError.message : writeError
              }`
            );
          }

          // トランザクション完了を待機する
          if (!approveHash) {
            // This case should ideally not happen if writeContractAsync succeeds without error,
            // but adding a safeguard.
            throw new Error(
              "承認トランザクションハッシュが取得できませんでした。"
            );
          }
          try {
            const approveReceipt = await publicClient.waitForTransactionReceipt(
              { hash: approveHash }
            );
            if (approveReceipt.status !== "success") {
              throw new Error(
                `Approve transaction failed with status: ${approveReceipt.status}`
              );
            }
            return approveHash; // トランザクションハッシュを返す
          } catch (receiptError) {
            throw new Error(
              `承認トランザクションの完了待機中にエラーが発生しました: ${
                receiptError instanceof Error
                  ? receiptError.message
                  : receiptError
              }`
            );
          }
        } catch (err) {
          // Catch block for the outer try starting before simulateContract
          // Check if the error is due to user rejection (already handled inside, but keep for safety)
          if (
            err instanceof Error &&
            (err.message.includes("rejected") ||
              err.message.includes("denied") ||
              err.message.includes("User rejected"))
          ) {
            throw new Error("ユーザーが承認トランザクションを拒否しました。");
          }
          // Rethrow other errors or already specific errors
          throw err;
        }
      };

      // エントランス料金を使用してトークン承認
      try {
        const approveTxHash = await approveErc20Transaction(); // Get the hash if approval was needed

        if (approveTxHash) {
          console.log(`Approval transaction successful: ${approveTxHash}`);
        } else {
          console.log("Approval not needed or already sufficient.");
        }

        // 承認後、承認状態を再確認 (念のため)
        const allowanceAfterApprove = await checkAllowance(userAddress);
        if (!allowanceAfterApprove) {
          // This might happen due to chain reorg or delay, give a helpful message
          throw new Error(
            "承認処理は完了しましたが、承認状態がまだ反映されていません。ネットワークの混雑状況を確認し、少し時間をおいてから再試行してください。"
          );
        }
      } catch (error: any) {
        console.error("トークン承認プロセスエラー:", error);
        // Provide more specific error message if possible
        setError(`トークン承認エラー: ${error.message || "不明なエラー"}`);
        setIsLoading(false);
        return {
          success: false,
          error: `トークン承認エラー: ${error.message || "不明なエラー"}`,
        };
      }

      // enterRaffleの処理 (承認が成功した場合のみ実行)
      try {
        console.log("Attempting to enter raffle...");
        // enterRaffleのシミュレーション
        if (!publicClient) throw new Error("Public client is not available");
        if (!writeContractAsync)
          throw new Error("コントラクト書き込み機能(async)が利用できません"); // writeContractAsync を使用

        let enterRaffleRequest;
        try {
          const simulationResult = await publicClient.simulateContract({
            address: contractAddress as `0x${string}`,
            abi: RaffleABI,
            functionName: "enterRaffle",
            account: userAddress as `0x${string}`,
          });
          enterRaffleRequest = simulationResult.request;
        } catch (simError) {
          throw new Error(
            `ラッフル参加トランザクションのシミュレーションに失敗しました: ${
              simError instanceof Error ? simError.message : simError
            }`
          );
        }

        if (!enterRaffleRequest) {
          throw new Error("ラッフル参加リクエストの準備に失敗しました");
        }
        // console.log("enterRaffle simulation successful."); // Moved up

        // ラッフル参加トランザクション
        let enterRaffleTxHash: `0x${string}` | undefined;
        try {
          enterRaffleTxHash = await writeContractAsync(enterRaffleRequest); // writeContractAsync を使用
        } catch (writeError) {
          // Check for user rejection specifically
          if (
            writeError instanceof Error &&
            (writeError.message.includes("rejected") ||
              writeError.message.includes("denied") ||
              writeError.message.includes("User rejected"))
          ) {
            throw new Error(
              "ユーザーがラッフル参加トランザクションを拒否しました。"
            );
          }
          throw new Error(
            `ラッフル参加トランザクションの送信に失敗しました: ${
              writeError instanceof Error ? writeError.message : writeError
            }`
          );
        }

        // トランザクション完了を待機
        if (!enterRaffleTxHash) {
          throw new Error(
            "ラッフル参加トランザクションハッシュが取得できませんでした。"
          );
        }
        try {
          const enterRaffleReceipt =
            await publicClient.waitForTransactionReceipt({
              hash: enterRaffleTxHash,
            });
          if (enterRaffleReceipt.status !== "success") {
            throw new Error(
              `Enter raffle transaction failed with status: ${enterRaffleReceipt.status}`
            );
          }
        } catch (receiptError) {
          throw new Error(
            `ラッフル参加トランザクションの完了待機中にエラーが発生しました: ${
              receiptError instanceof Error
                ? receiptError.message
                : receiptError
            }`
          );
        }
        // トランザクション成功！データを再取得して状態を更新
        console.log("Enter raffle transaction successful. Updating data...");
        await updateRaffleData(true); // Force update after successful entry
        await checkPlayerEntered(userAddress); // Re-check player status

        return { success: true, hash: enterRaffleTxHash };
      } catch (error: any) {
        console.error("ラッフル参加エラー:", error);
        // Provide more specific error message if possible
        let errorMessage = `ラッフル参加エラー: ${
          error.message || "不明なエラー"
        }`;
        if (
          error.message.includes("rejected") ||
          error.message.includes("denied")
        ) {
          errorMessage =
            "ユーザーがラッフル参加トランザクションを拒否しました。";
        }
        setError(errorMessage); // Set error state
        // Do not call updateRaffleData or checkPlayerEntered here on error
        throw error; // Re-throw to be caught by the outer catch
        // return { success: false, error: errorMessage }; // Don't return here, let outer catch handle it
      }
    } catch (error: any) {
      // Outer try-catch for the whole handleEnterRaffle
      console.error("Overall error in handleEnterRaffle:", error);
      // Use the error message from the inner catch if it was re-thrown, otherwise use the general message
      const finalErrorMessage =
        error.message.startsWith("ラッフル参加エラー:") ||
        error.message.startsWith("ユーザーが")
          ? error.message // Use specific error message if available
          : `ラッフル参加中に予期せぬエラーが発生しました: ${
              error.message || "不明なエラー詳細"
            }`;
      setError(finalErrorMessage); // Set final error message
      // Do not call updateRaffleData or checkPlayerEntered here on error
      // setIsLoading(false); // Move to finally block
      return { success: false, error: finalErrorMessage };
    } finally {
      // Ensure isLoading is always set to false
      setIsLoading(false);
    }
  };

  // データの自動更新 - 依存配列を最適化
  useEffect(() => {
    updateRaffleData();
  }, [contractAddress, raffleStateData, address, isConnected]);

  // 当初データ読み込み後、ローディングを停止
  useEffect(() => {
    if (entranceFeeData !== undefined) {
      setUiLoading(false);
    }
  }, [entranceFeeData]);

  // タイムアウトハンドラー - 読み込みが長い場合に強制的にローディングを停止
  useEffect(() => {
    // 3秒後にデータが取得できなければ、前進を許可
    const timeoutId = setTimeout(() => {
      if (uiLoading) {
        console.log("データ取得タイムアウト: UI表示を進行します");
        setUiLoading(false);
        setIsLoading(false);
      }
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [uiLoading]);

  // ページロード時に参加状態をリセット
  useEffect(() => {
    return () => {
      setIsPlayerEntered(false);
    };
  }, []);

  // 参加取り消し関数を初期化 - スマートアカウント対応を追加
  const cancelEntryHandler = createHandleCancelEntry(
    isConnected,
    address,
    contractAddress || "", // null の場合に空文字列を渡す
    checkPlayerEntered,
    publicClient,
    writeContract,
    setIsLoading,
    setError,
    updateRaffleData,
    RaffleABI,
    // スマートアカウント対応パラメータを追加
    {
      smartAccountAddress,
      isReadyToSendTx,
      sendUserOperation,
    }
  );

  // ラッフル参加取り消し処理を拡張してデータ更新を確実にする
  const handleCancelEntry = async () => {
    try {
      const result = await cancelEntryHandler();

      if (result && result.success) {
        // 成功時は強制的にデータを再取得
        console.log("ラッフル参加取り消し成功、データを更新します");

        // 少し遅延させてデータ反映を待つ
        setTimeout(async () => {
          // 強制的に参加状態を更新
          setIsPlayerEntered(false);

          // 全データを再取得
          try {
            await updateRaffleData(true);
          } catch (updateError) {
            console.warn("データ更新エラーは無視します:", updateError);
          }

          // 参加状態を再確認
          try {
            await checkPlayerEntered();
          } catch (checkError) {
            console.warn("参加状態チェックエラーは無視します:", checkError);
          }
        }, 2000);
      }

      return result;
    } catch (error) {
      console.error("拡張取り消し処理エラー:", error);
      throw error;
    }
  };

  // ラッフル履歴を取得する関数
  const getRaffleHistory = async (count = 5): Promise<RaffleHistoryEntry[]> => {
    if (!contractAddress || !publicClient) return [];

    try {
      // まず履歴の総数を取得
      const historyCount = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: RaffleABI,
        functionName: "getRaffleHistoryCount",
      });

      // 取得する履歴数を決定（最大count件）
      const totalCount = Number(historyCount || 0);
      const fetchCount = Math.min(totalCount, count);

      if (fetchCount <= 0) return [];

      const history: RaffleHistoryEntry[] = [];

      // 最新のエントリーから順に取得
      for (let i = 0; i < fetchCount; i++) {
        try {
          const entry = (await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: RaffleABI,
            functionName: "getRaffleHistoryAtIndex",
            args: [BigInt(i)],
          })) as any[];

          if (entry && entry.length >= 5) {
            history.push({
              winner: entry[0] as string,
              prize: BigInt(entry[1].toString()),
              jackpotWon: entry[2] as boolean,
              timestamp: BigInt(entry[3].toString()),
              playerCount: BigInt(entry[4].toString()),
            });
          }
        } catch (error) {
          console.error(`履歴エントリー取得エラー (${i}):`, error);
        }
      }

      return history;
    } catch (error) {
      console.error("ラッフル履歴取得エラー:", error);
      return [];
    }
  };

  // 最新のラッフル履歴エントリーを取得
  const getLatestRaffleHistory =
    async (): Promise<RaffleHistoryEntry | null> => {
      if (!contractAddress || !publicClient) return null;

      try {
        const result = (await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "getLatestRaffleHistory",
        })) as any[];

        if (!result || !Array.isArray(result) || result.length < 5) {
          return null;
        }

        return {
          winner: result[0] as string,
          prize: BigInt(result[1].toString()),
          jackpotWon: result[2] as boolean,
          timestamp: BigInt(result[3].toString()),
          playerCount: BigInt(result[4].toString()),
        };
      } catch (error) {
        console.error("最新ラッフル履歴取得エラー:", error);
        return null;
      }
    };

  // ユーザーの統計情報を取得
  const getUserStats = async (userAddress = ""): Promise<UserStats | null> => {
    const targetAddress = userAddress || address || smartAccountAddress;

    if (!targetAddress || !contractAddress || !publicClient) return null;

    try {
      const result = (await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: RaffleABI,
        functionName: "getUserStats",
        args: [targetAddress],
      })) as any[];

      if (!result || !Array.isArray(result) || result.length < 3) {
        return null;
      }

      return {
        entryCount: BigInt(result[0].toString()),
        winCount: BigInt(result[1].toString()),
        jackpotCount: BigInt(result[2].toString()),
      };
    } catch (error) {
      console.error("ユーザー統計取得エラー:", error);
      return null;
    }
  };

  // ラッフルの最小プレイヤー数を取得
  const getMinimumPlayers = async (): Promise<number> => {
    if (!contractAddress || !publicClient) return 0;

    try {
      const result = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: RaffleABI,
        functionName: "getMinimumPlayers",
      });

      return Number(result || 0);
    } catch (error) {
      console.error("最小プレイヤー数取得エラー:", error);
      return 0;
    }
  };

  // ラッフルがミニマムプレイヤー数に達した時刻を取得
  const getMinPlayersReachedTime = async (): Promise<bigint> => {
    if (!contractAddress || !publicClient) return BigInt(0);

    try {
      const result = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: RaffleABI,
        functionName: "getMinPlayersReachedTime",
      });

      return BigInt(result?.toString() || "0");
    } catch (error) {
      console.error("最小プレイヤー達成時間取得エラー:", error);
      return BigInt(0);
    }
  };

  return {
    raffleData,
    isLoading: isLoading || isTransactionLoading || uiLoading,
    error,
    handleEnterRaffle,
    handleCancelEntry,
    contractAddress,
    erc20Address,
    isPlayerEntered,
    isUpkeepNeeded,
    checkAutomationStatus,
    checkUpkeepDebug,
    performManualUpkeep,
    checkPlayerEntered,
    manualPerformUpkeepAsOwner,
    tokenBalanceInfo,
    checkTokenBalanceWithInfo,
    getContractEthBalance,
    getContractUsdcBalance,
    getRaffleHistory,
    getLatestRaffleHistory,
    getUserStats,
    getMinimumPlayers,
    getMinPlayersReachedTime,
  };
}
