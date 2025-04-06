"use client";

import { useState, useEffect } from 'react';
import { useRaffleContract } from './use-raffle-contract';
import { formatEther } from 'viem';

export function useRaffleHistory(userAddress: string | undefined | null) {
  const [userStats, setUserStats] = useState({
    totalParticipations: 0,
    totalWins: 0,
    jackpotWins: 0
  });
  
  const [pastRaffles, setPastRaffles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // ラッフルコントラクトフックから必要な情報を取得
  const { 
    contractAddress, 
    raffleData, 
    publicClient,
    contract
  } = useRaffleContract();
  
  // ユーザー統計とラッフル結果を模擬データから取得（本来はコントラクトイベントから取得）
  useEffect(() => {
    const fetchRaffleHistory = async () => {
      if (!userAddress || !contractAddress || !publicClient) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      
      try {
        // 本番環境では、実際にイベントログから過去のラッフル情報を取得する
        // 簡易版として模擬データを生成する
        
        // 模擬データ生成（実際はスマートコントラクトのイベントから取得）
        const mockUserStats = generateMockUserStats(userAddress);
        const mockPastRaffles = generateMockPastRaffles(userAddress);
        
        setUserStats(mockUserStats);
        setPastRaffles(mockPastRaffles);
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

// 模擬データ生成関数（実際の実装では削除し、実データに置き換え）
function generateMockUserStats(userAddress: string | undefined | null) {
  // ユーザーアドレスの末尾の数値を使って、模擬的にランダムな値を生成
  const addressNum = userAddress ? parseInt(userAddress.slice(-2), 16) : 0;
  
  return {
    totalParticipations: (addressNum % 10) + 5, // 5〜14の間
    totalWins: (addressNum % 3) + 1,            // 1〜3の間
    jackpotWins: addressNum % 2                 // 0または1
  };
}

function generateMockPastRaffles(userAddress: string | undefined | null) {
  // ユーザーアドレスの末尾の数値を使って、模擬的にランダムな値を生成
  const addressNum = userAddress ? parseInt(userAddress.slice(-2), 16) : 0;
  const isWinner = (round: number) => round % (addressNum % 5 + 2) === 0;
  
  // 最新の4つのラッフル結果を模擬データとして生成
  return Array.from({ length: 4 }, (_, i) => {
    const round = 42 - i;
    const participants = 3 + (round % 8);
    const timestamp = Date.now() - i * (15 * 60 * 1000); // 15分ごとに過去にさかのぼる
    const hasJackpot = round % 3 === 0;
    const winner = isWinner(round) 
      ? userAddress 
      : `0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}`;
      
    return {
      round: `#${round}`,
      participants: participants.toString(),
      winner: winner?.slice(0, 6) + '...' + winner?.slice(-4),
      prize: `${participants * 9} USDC`,
      jackpot: hasJackpot ? `${(round % 4) * 30 + 25} USDC` : "なし",
      time: getTimeAgo(timestamp),
      isWinner: isWinner(round),
      tx: `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 4)}`,
    };
  });
}

// 時間表示の補助関数
function getTimeAgo(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return `${seconds}秒前`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}時間前`;
  return `${Math.floor(seconds / 86400)}日前`;
}
