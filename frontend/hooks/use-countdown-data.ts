import { useState, useCallback, useEffect } from "react";
import { usePublicClient } from "wagmi";

interface UseCountdownDataOptions {
  getMinPlayersReachedTime?: () => Promise<number>;
  getMinimumPlayers?: () => Promise<number>;
  contractAddress?: string;
  numberOfPlayers: number;
}

interface UseCountdownDataReturn {
  minPlayersReachedTime: number;
  minimumPlayers: number;
  updateCountdownData: () => Promise<void>;
  watchRaffleEvents: () => (() => void);
  watchRaffleExitEvents: () => (() => void);
}

export function useCountdownData({
  getMinPlayersReachedTime,
  getMinimumPlayers,
  contractAddress,
  numberOfPlayers,
}: UseCountdownDataOptions): UseCountdownDataReturn {
  const publicClient = usePublicClient();

  // カウントダウン用の状態変数
  const [minPlayersReachedTime, setMinPlayersReachedTime] = useState(0);
  const [minimumPlayers, setMinimumPlayers] = useState(3);

  // カウントダウンデータを更新する関数
  const updateCountdownData = useCallback(async () => {
    if (!getMinPlayersReachedTime || !getMinimumPlayers) return;

    try {
      const [reachedTime, minPlayers] = await Promise.all([
        getMinPlayersReachedTime(),
        getMinimumPlayers(),
      ]);
      
      setMinPlayersReachedTime(reachedTime);
      setMinimumPlayers(minPlayers);
    } catch (error) {
      console.error("カウントダウンデータ取得エラー:", error);
    }
  }, [getMinPlayersReachedTime, getMinimumPlayers]);

  // ラッフル参加イベントの監視
  const watchRaffleEvents = useCallback(() => {
    if (!contractAddress || !publicClient) {
      return () => {};
    }

    try {
      const unwatch = publicClient.watchContractEvent({
        address: contractAddress as `0x${string}`,
        abi: [
          {
            anonymous: false,
            inputs: [
              { indexed: true, name: "player", type: "address" },
              { indexed: false, name: "entranceFee", type: "uint256" }
            ],
            name: "RaffleEnter",
            type: "event"
          },
          {
            anonymous: false,
            inputs: [
              { indexed: true, name: "player", type: "address" },
              { indexed: false, name: "refundAmount", type: "uint256" }
            ],
            name: "RaffleExit",
            type: "event"
          }
        ],
        eventName: "RaffleEnter",
        onLogs: (logs) => {
          console.log("ラッフル参加イベントを検出:", logs);
          // カウントダウンデータを更新（最小プレイヤー数に達した可能性）
          setTimeout(() => {
            updateCountdownData();
          }, 2000);
        }
      });

      return unwatch;
    } catch (error) {
      console.error("ラッフルイベント監視の設定エラー:", error);
      return () => {};
    }
  }, [contractAddress, publicClient, updateCountdownData]);

  // ラッフル退出イベントの監視
  const watchRaffleExitEvents = useCallback(() => {
    if (!contractAddress || !publicClient) {
      return () => {};
    }

    try {
      const unwatch = publicClient.watchContractEvent({
        address: contractAddress as `0x${string}`,
        abi: [
          {
            anonymous: false,
            inputs: [
              { indexed: true, name: "player", type: "address" },
              { indexed: false, name: "refundAmount", type: "uint256" }
            ],
            name: "RaffleExit",
            type: "event"
          }
        ],
        eventName: "RaffleExit",
        onLogs: (logs) => {
          console.log("ラッフル退出イベントを検出:", logs);
          // カウントダウンデータを更新（最小プレイヤー数を下回った可能性）
          setTimeout(() => {
            updateCountdownData();
          }, 2000);
        }
      });

      return unwatch;
    } catch (error) {
      console.error("ラッフル退出イベント監視の設定エラー:", error);
      return () => {};
    }
  }, [contractAddress, publicClient, updateCountdownData]);

  // 初回読み込み時のカウントダウンデータ更新（遅延実行）
  useEffect(() => {
    // 初回読み込みを少し遅らせてレート制限を回避
    const timer = setTimeout(() => {
      updateCountdownData();
    }, 5000); // 5秒に延長してAPI負荷を軽減
    return () => clearTimeout(timer);
  }, [updateCountdownData]);

  // プレイヤー数が変化したときにカウントダウンデータを更新
  useEffect(() => {
    if (numberOfPlayers >= 0) {
      updateCountdownData();
    }
  }, [numberOfPlayers, updateCountdownData]);

  // ラッフルイベントリスナーの初期化
  useEffect(() => {
    if (!contractAddress || !publicClient) return;

    // ラッフル参加・退出イベントの監視を開始
    const raffleEnterCleanup = watchRaffleEvents();
    const raffleExitCleanup = watchRaffleExitEvents();

    return () => {
      raffleEnterCleanup();
      raffleExitCleanup();
    };
  }, [contractAddress, publicClient, watchRaffleEvents, watchRaffleExitEvents]);

  return {
    minPlayersReachedTime,
    minimumPlayers,
    updateCountdownData,
    watchRaffleEvents,
    watchRaffleExitEvents,
  };
}