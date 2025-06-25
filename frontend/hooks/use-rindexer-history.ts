import { useState, useEffect, useCallback } from 'react';
import { useAccount, useChainId } from 'wagmi';

type RaffleHistoryEntry = {
  winner: string;
  prize: string;
  jackpotWon: boolean;
  txHash: string;
  blockNumber: number;
  network: string;
  txIndex: number;
  logIndex: string;
};

type RaffleEntry = {
  player: string;
  entranceFee: string;
  txHash: string;
  blockNumber: number;
  network: string;
  txIndex: number;
  logIndex: string;
};

type NetworkStats = {
  entries?: number;
  exits?: number;
  winners?: number;
  latestBlock?: number;
};

type RaffleStats = {
  networkStats: { [network: string]: NetworkStats };
  userStats?: any[];
  summary: {
    totalNetworks: number;
    totalEntries: number;
    totalWinners: number;
  };
};

const NETWORK_NAMES: { [key: number]: string } = {
  11155111: 'ethereum_sepolia',
  84532: 'base_sepolia',
  421614: 'arbitrum_sepolia',
};

export function useRindexerHistory() {
  const { address } = useAccount();
  const chainId = useChainId();
  
  const [winnerHistory, setWinnerHistory] = useState<RaffleHistoryEntry[]>([]);
  const [entries, setEntries] = useState<RaffleEntry[]>([]);
  const [stats, setStats] = useState<RaffleStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const networkName = NETWORK_NAMES[chainId];

  const fetchWinnerHistory = useCallback(async (limit = 10, offset = 0, userAddress?: string) => {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });
      
      if (networkName) params.append('network', networkName);
      if (userAddress) params.append('userAddress', userAddress);

      const response = await fetch(`/api/raffle/history?${params}`);
      const data = await response.json();

      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to fetch history');
      }
    } catch (err) {
      console.error('Error fetching winner history:', err);
      throw err;
    }
  }, [networkName]);

  const fetchEntries = useCallback(async (limit = 50, offset = 0, userAddress?: string) => {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });
      
      if (networkName) params.append('network', networkName);
      if (userAddress) params.append('userAddress', userAddress);

      const response = await fetch(`/api/raffle/entries?${params}`);
      const data = await response.json();

      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to fetch entries');
      }
    } catch (err) {
      console.error('Error fetching entries:', err);
      throw err;
    }
  }, [networkName]);

  const fetchStats = useCallback(async (userAddress?: string) => {
    try {
      const params = new URLSearchParams();
      
      if (networkName) params.append('network', networkName);
      if (userAddress) params.append('userAddress', userAddress);

      const response = await fetch(`/api/raffle/stats?${params}`);
      const data = await response.json();

      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to fetch stats');
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
      throw err;
    }
  }, [networkName]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [historyData, entriesData, statsData] = await Promise.all([
        fetchWinnerHistory(10, 0),
        fetchEntries(50, 0, address),
        fetchStats(address),
      ]);

      setWinnerHistory(historyData);
      setEntries(entriesData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [fetchWinnerHistory, fetchEntries, fetchStats, address]);

  const getUserWinHistory = useCallback(async () => {
    if (!address) return [];
    return fetchWinnerHistory(50, 0, address);
  }, [address, fetchWinnerHistory]);

  const getUserEntries = useCallback(async () => {
    if (!address) return [];
    return fetchEntries(100, 0, address);
  }, [address, fetchEntries]);

  // 初期データロード
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // チェーン変更時の再読み込み
  useEffect(() => {
    if (networkName) {
      loadAllData();
    }
  }, [chainId, networkName, loadAllData]);

  return {
    // データ
    winnerHistory,
    entries,
    stats,
    
    // 状態
    loading,
    error,
    
    // 関数
    refreshData: loadAllData,
    fetchWinnerHistory,
    fetchEntries,
    fetchStats,
    getUserWinHistory,
    getUserEntries,
    
    // ユーティリティ
    networkName,
    isConnected: !!address,
  };
}