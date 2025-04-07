"use client";

import { useState, useEffect } from 'react';
import { useRaffleContract } from './use-raffle-contract';
import { usePublicClient } from 'wagmi';
import { RaffleABI } from '@/app/lib/contract-config';
import { formatUnits } from 'viem';

export function useRaffleHistory(userAddress: string | undefined | null) {
  const [userStats, setUserStats] = useState({
    totalParticipations: 0,
    totalWins: 0,
    jackpotWins: 0
  });
  
  const [pastRaffles, setPastRaffles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const { contractAddress, raffleData } = useRaffleContract();
  const publicClient = usePublicClient();
  
  // ユーザー統計とラッフル結果をコントラクトから取得
  useEffect(() => {
    const fetchRaffleHistory = async () => {
      if (!userAddress || !contractAddress || !publicClient) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      
      try {
        // WinnerPickedイベントをフェッチ
        const winnerEvents = await publicClient.getContractEvents({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          eventName: 'WinnerPicked',
          fromBlock: BigInt(0),
          toBlock: 'latest'
        });
        
        // RaffleEnterイベントをフェッチ
        const enterEvents = await publicClient.getContractEvents({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          eventName: 'RaffleEnter',
          fromBlock: BigInt(0),
          toBlock: 'latest'
        });
        
        // ユーザー関連のイベントをフィルタリング
        const userEnterEvents = enterEvents.filter(event => {
          // 型エラーを回避するために、any型としてアクセス
          const eventData = event as any;
          const player = eventData.args?.player || eventData.player;
          return player?.toLowerCase() === userAddress?.toLowerCase();
        });
        
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
        
        // ユーザー統計を更新
        setUserStats({
          totalParticipations: userEnterEvents.length,
          totalWins: userWinEvents.length,
          jackpotWins: jackpotWins.length
        });
        
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
  }, [userAddress, contractAddress, publicClient]);

  return {
    userStats,
    pastRaffles,
    isLoading
  };
}
