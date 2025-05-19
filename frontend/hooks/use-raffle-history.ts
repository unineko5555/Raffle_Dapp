"use client";

import { useState, useEffect } from 'react';
import { useRaffleContract } from './use-raffle-contract';
import { usePublicClient } from 'wagmi';
import { RaffleABI } from '@/app/lib/contract-config';
import { formatUnits } from 'viem';


// ラッフル履歴エントリーの型定義
type RaffleHistoryEntry = {
  winner: string;
  prize: string;
  jackpotWon: boolean;
  timestamp: number;
  playerCount: number;
};

// ユーザー統計情報の型定義
type UserStats = {
  totalParticipations: number;
  totalWins: number;
  jackpotWins: number;
};

export function useRaffleHistory(userAddress: string | undefined | null) {
  const [userStats, setUserStats] = useState<UserStats>({
    totalParticipations: 0,
    totalWins: 0,
    jackpotWins: 0
  });
  
  const [pastRaffles, setPastRaffles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // useRaffleContractからコントラクトアドレスのみを利用する
  const { contractAddress } = useRaffleContract();
  const publicClient = usePublicClient();
  
  // ユーザー統計情報を取得する関数
  const getUserStatsFromContract = async (targetAddress: string | undefined | null = null): Promise<{
    entryCount: bigint;
    winCount: bigint;
    jackpotCount: bigint;
  } | null> => {
    const addressToCheck = targetAddress || userAddress;
    if (!addressToCheck || !contractAddress || !publicClient) {
      return null;
    }

    try {
      const result = (await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: RaffleABI,
        functionName: "getUserStats",
        args: [addressToCheck],
      })) as any[];

      if (result && Array.isArray(result) && result.length >= 3) {
        return {
          entryCount: BigInt(result[0].toString()),
          winCount: BigInt(result[1].toString()),
          jackpotCount: BigInt(result[2].toString()),
        };
      }
      return null;
    } catch (error) {
      console.error("ユーザー統計取得エラー:", error);
      return null;
    }
  };

  // ラッフル履歴を取得する関数
  const getRaffleHistory = async (count = 5): Promise<RaffleHistoryEntry[]> => {
    if (!contractAddress || !publicClient) {
      return [];
    }

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
              prize: entry[1].toString(),
              jackpotWon: entry[2] as boolean,
              timestamp: Number(entry[3]),
              playerCount: Number(entry[4]),
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
  const getLatestRaffleHistory = async (): Promise<RaffleHistoryEntry | null> => {
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
        prize: result[1].toString(),
        jackpotWon: result[2] as boolean,
        timestamp: Number(result[3]),
        playerCount: Number(result[4]),
      };
    } catch (error) {
      console.error("最新ラッフル履歴取得エラー:", error);
      return null;
    }
  };
  
  // ユーザー統計とラッフル結果をコントラクトから取得
  useEffect(() => {
    const fetchRaffleHistory = async () => {
      // ウォレットが接続されていない場合は統計をリセット
      if (!userAddress) {
        setUserStats({
          totalParticipations: 0,
          totalWins: 0,
          jackpotWins: 0
        });
        setPastRaffles([]);
        setIsLoading(false);
        return;
      }
      
      if (!contractAddress || !publicClient) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      
      try {
        // コントラクトからユーザー統計を取得
        const stats = await getUserStatsFromContract(userAddress);
        if (stats) {
          // BigIntをNumberに変換して設定
          setUserStats({
            totalParticipations: Number(stats.entryCount),
            totalWins: Number(stats.winCount),
            jackpotWins: Number(stats.jackpotCount)
          });
        }
        
        // 最新ブロックを取得し、安全に500ブロック範囲内で取得
        const latestBlock = await publicClient.getBlockNumber();
        // 更に安全な範囲で取得（400ブロックに制限）
        const blockRange = 400n;
        const fromBlock = latestBlock > blockRange ? latestBlock - blockRange : 0n;
        
        console.log(`イベント取得範囲: ${fromBlock} - ${latestBlock} (${latestBlock - fromBlock}ブロック)`);
        
        // WinnerPickedイベントをフェッチ
        const winnerEvents = await publicClient.getContractEvents({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          eventName: 'WinnerPicked',
          fromBlock,
          toBlock: latestBlock
        });
        
        // イベント取得数を制限してRPCコールを減らす
        // RaffleEnterイベントはコントラクトから直接統計を取得するのでスキップ
        // const enterEvents = await publicClient.getContractEvents({
        //   address: contractAddress as `0x${string}`,
        //   abi: RaffleABI,
        //   eventName: 'RaffleEnter',
        //   fromBlock,
        //   toBlock: latestBlock
        // });
        
        // ユーザー関連のイベントをフィルタリング（RaffleEnterはスキップして、コントラクトから直接取得）
        // const userEnterEvents = enterEvents.filter(event => {
        //   const eventData = event as any;
        //   const player = eventData.args?.player || eventData.player;
        //   return player?.toLowerCase() === userAddress?.toLowerCase();
        // });
        
        const userWinEvents = winnerEvents.filter(event => {
          // 型エラーを回避するために、any型としてアクセス
          const eventData = event as any;
          const winner = eventData.args?.winner || eventData.winner;
          return winner?.toLowerCase() === userAddress?.toLowerCase();
        });
        
        const jackpotWins = userWinEvents.filter(event => {
          // 型エラーを回避するために、any型としてアクセス
          const eventData = event as any;
          return eventData.args?.isJackpot || eventData.isJackpot;
        });
        
        // ユーザー統計はコントラクトから取得済みなので、ここでの更新はスキップ
        // setUserStats({
        //   totalParticipations: userEnterEvents.length,
        //   totalWins: userWinEvents.length,
        //   jackpotWins: jackpotWins.length
        // });
        
        // ラッフル履歴を作成
        const raffleHistory = await Promise.all(winnerEvents.map(async (event) => {
          // 型エラーを回避するために、any型としてアクセス
          const eventData = event as any;
          const winner = eventData.args?.winner || eventData.winner;
          const prize = eventData.args?.prize || eventData.prize || BigInt(0);
          const isJackpot = eventData.args?.isJackpot || eventData.isJackpot || false;
          const blockNumber = eventData.blockNumber || eventData.blockHash;
          const txHash = eventData.transactionHash || eventData.hash || '';
          
          // ブロック情報を取得してタイムスタンプを得る
          let timestamp = Date.now();
          try {
            if (blockNumber) {
              const block = await publicClient.getBlock({
                blockNumber: typeof blockNumber === 'string' ? BigInt(blockNumber) : blockNumber
              });
              timestamp = Number(block.timestamp) * 1000;
            }
          } catch (error) {
            console.error('ブロック情報の取得失敗:', error);
          }
          
          // 該当ラウンドの参加者数を推定
          // 注: より正確な情報を得るには、ラウンド番号などをイベントに含める必要がある
          const participantCount = eventData.transactionIndex ? Number(eventData.transactionIndex) + 3 : 3; // 簡易的な推定
          
          return {
            round: `#${blockNumber || '???'}`,
            participants: participantCount.toString(),
            winner: winner ? `${winner.slice(0, 6)}...${winner.slice(-4)}` : '不明',
            prize: `${formatUnits(prize, 6)} USDC`,
            jackpot: isJackpot ? `獲得！` : "なし",
            time: new Date(timestamp).toLocaleString('ja-JP'),
            isWinner: winner?.toLowerCase() === userAddress?.toLowerCase(),
            tx: txHash,
          };
        }));
        
        // 最新のラウンドが先頭に来るように並べ替え
        setPastRaffles(raffleHistory.sort((a, b) => {
          // ブロック番号を数値として抽出して比較
          const aBlock = parseInt(a.round.substring(1).replace('???', '0'));
          const bBlock = parseInt(b.round.substring(1).replace('???', '0'));
          return bBlock - aBlock; // 降順
        }));
      } catch (error) {
        console.error("ラッフル履歴データの取得に失敗しました:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRaffleHistory();
  }, [userAddress, contractAddress]);

  return {
    userStats,
    pastRaffles,
    isLoading,
    // 外部から使用できるように関数を公開
    getUserStats: getUserStatsFromContract,
    getRaffleHistory,
    getLatestRaffleHistory
  };
}
