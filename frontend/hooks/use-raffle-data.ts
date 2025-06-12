"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useChainId,
  usePublicClient,
} from "wagmi";

import { formatUnits } from "viem";
import { RaffleABI, contractConfig } from "@/app/lib/contract-config";

// contractConfigのキーの型を定義
type SupportedChainId = keyof typeof contractConfig;

export function useRaffleData() {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
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

  // チェーンIDから正しいコントラクトアドレスを取得
  // サポートされているチェーンIDのみを受け入れ、不正な場合はnullを返す
  const supportedChainIds = [11155111, 84532, 421614] as const;
  const isValidChainId = chainId && supportedChainIds.includes(chainId as any);
  const currentChainId = isValidChainId ? chainId : null;
  const contractAddress = currentChainId ? 
    contractConfig[currentChainId as SupportedChainId]?.raffleProxy || null : null;
  
  // プロバイダーチェック
  const publicClient = usePublicClient({ chainId: currentChainId || undefined });

  // コントラクト読み取り
  const { data: entranceFeeData } = useReadContract(
    contractAddress
      ? {
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "getEntranceFee",
          chainId: currentChainId || undefined,
        }
      : undefined
  );

  const { data: numberOfPlayersData } = useReadContract(
    contractAddress
      ? {
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "getNumberOfPlayers",
          chainId: currentChainId || undefined,
        }
      : undefined
  );

  const { data: raffleStateData } = useReadContract(
    contractAddress
      ? {
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "getRaffleState",
          chainId: currentChainId || undefined,
        }
      : undefined
  );

  const { data: jackpotAmountData } = useReadContract(
    contractAddress
      ? {
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "getJackpotAmount",
          chainId: currentChainId || undefined,
        }
      : undefined
  );

  const { data: recentWinnerData } = useReadContract(
    contractAddress
      ? {
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "getRecentWinner",
          chainId: currentChainId || undefined,
        }
      : undefined
  );

  const { data: ownerData } = useReadContract(
    contractAddress
      ? {
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "getOwner",
          chainId: currentChainId || undefined,
        }
      : undefined
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

  // 前回取得したデータを保存する変数
  let lastRaffleState = 0;
  let lastPlayerCount = 0;
  let lastUpdateTime = 0;
  const UPDATE_INTERVAL = 20000; // 20秒に延長

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

      // 共通フォーマット関数を使用
      setRaffleData(formatRaffleData(players));
      console.log("フォールバック更新完了");
    } catch (error) {
      console.warn("フォールバックも失敗、既存データを維持:", error);
      // エラーを投げずに既存データを維持
    }
  };

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

            // 共通フォーマット関数を使用してラッフルデータを更新
            setRaffleData(formatRaffleData(players, playerCount));
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

  // 残高キャッシュ機能
  let balanceCache: {
    ethBalance?: string;
    usdcBalance?: string;
    lastUpdated: number;
  } = { lastUpdated: 0 };
  const CACHE_TTL = 120000; // 2分に延長（レート制限対策）

  // コントラクトのETH残高を取得する関数 - 強制更新オプション対応
  const getContractEthBalance = async (options = { forceUpdate: false }) => {
    const now = Date.now();

    // 強制更新フラグがある場合はキャッシュをスキップ
    const forceRefresh = options.forceUpdate || 
      (typeof window !== 'undefined' && Boolean((window as any).FORCE_CONTRACT_BALANCE_REFRESH));

    // 強制更新でない場合、キャッシュが有効なら返す
    if (!forceRefresh && balanceCache.ethBalance && now - balanceCache.lastUpdated < CACHE_TTL) {
      return balanceCache.ethBalance;
    }

    if (!contractAddress || !publicClient) return "0";

    try {
      // publicClientを使用（CORS問題を回避）
      const balance = await publicClient.getBalance({
        address: contractAddress as `0x${string}`,
      });

      const result = formatUnits(balance, 18);
      console.log(`チェーンID ${currentChainId} のETH残高取得成功: ${result}`);
      balanceCache.ethBalance = result;
      balanceCache.lastUpdated = now;
      return result;
    } catch (error) {
      console.error(`チェーンID ${currentChainId} のETH残高取得エラー:`, error);
      return balanceCache.ethBalance || "0";
    }
  };

  // コントラクトのUSDC残高を取得する関数 - 強制更新オプション対応
  const getContractUsdcBalance = async (options = { forceUpdate: false }) => {
    const now = Date.now();

    // 強制更新フラグがある場合やチェーン切り替え後はキャッシュをスキップ
    const forceRefresh = options.forceUpdate || 
      (typeof window !== 'undefined' && Boolean((window as any).FORCE_CONTRACT_BALANCE_REFRESH));

    // デバッグログ
    if (forceRefresh) {
      console.log(`USDC残高の強制更新を実行します (チェーンID: ${currentChainId})`);
      // 強制更新フラグをリセット
      if (typeof window !== 'undefined') {
        (window as any).FORCE_CONTRACT_BALANCE_REFRESH = false;
      }
    }

    // 強制更新でない場合、キャッシュが有効なら返す
    if (
      !forceRefresh &&
      balanceCache.usdcBalance &&
      now - balanceCache.lastUpdated < CACHE_TTL
    ) {
      return balanceCache.usdcBalance;
    }

    const erc20Address =
      contractConfig[currentChainId as SupportedChainId]?.erc20Address || null;

    if (!contractAddress || !erc20Address || !publicClient) return "0";

    try {
      // publicClientを使用してERC20残高を取得 - チェーンIDを明示指定しない
      const balance = await publicClient.readContract({
        address: erc20Address as `0x${string}`,
        abi: [
          {
            constant: true,
            inputs: [{ name: "_owner", type: "address" }],
            name: "balanceOf",
            outputs: [{ name: "balance", type: "uint256" }],
            type: "function",
          },
        ],
        functionName: "balanceOf",
        args: [contractAddress]
        // chainId: currentChainId  <- この行を削除
      });

      const result = typeof balance === "bigint" ? balance.toString() : "0";
      console.log(`チェーンID ${currentChainId} のUSDC残高取得成功: ${result}`);
      balanceCache.usdcBalance = result;
      balanceCache.lastUpdated = now;
      return result;
    } catch (error) {
      console.error(`チェーンID ${currentChainId} のUSDC残高取得エラー:`, error);
      return balanceCache.usdcBalance || "0";
    }
  };

  // 最小プレイヤー数を取得する関数
  const getMinimumPlayers = async () => {
    if (!contractAddress || !publicClient) return 0;

    try {
      const minimumPlayers = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: RaffleABI,
        functionName: "getMinimumPlayers",
      });

      return typeof minimumPlayers === "bigint" ? Number(minimumPlayers) : 0;
    } catch (error) {
      console.error("最小プレイヤー数取得エラー:", error);
      return 0;
    }
  };

  // 最小プレイヤー数到達時間を取得する関数
  const getMinPlayersReachedTime = async () => {
    if (!contractAddress || !publicClient) return 0;

    try {
      const reachedTime = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: RaffleABI,
        functionName: "getMinPlayersReachedTime",
      });

      return typeof reachedTime === "bigint" ? Number(reachedTime) : 0;
    } catch (error) {
      console.error("最小プレイヤー数到達時間取得エラー:", error);
      return 0;
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
      }
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [uiLoading]);

  return {
    raffleData,
    isLoading: uiLoading,
    error,
    contractAddress,
    erc20Address: contractConfig[currentChainId as SupportedChainId]?.erc20Address || null,
    updateRaffleData,
    getPlayers,
    getContractEthBalance,
    getContractUsdcBalance,
    getMinimumPlayers,
    getMinPlayersReachedTime,
  };
}
