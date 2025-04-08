import { useEffect, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useRaffleContract } from './use-raffle-contract';
import { useToast } from './use-toast';
import { formatUnits } from 'viem';

export function useRaffleWinEvents() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { contractAddress } = useRaffleContract();
  const { toast } = useToast();
  
  const [winnerInfo, setWinnerInfo] = useState({
    winner: '',
    prize: '0',
    isJackpot: false,
    showModal: false
  });
  
  useEffect(() => {
    if (!contractAddress || !address || !publicClient) return;
    
    // WinnerPicked イベントのABIフラグメント
    const winnerPickedEvent = {
      type: 'event',
      name: 'WinnerPicked',
      inputs: [
        { type: 'address', name: 'winner', indexed: true },
        { type: 'uint256', name: 'amount', indexed: false },
        { type: 'bool', name: 'isJackpot', indexed: false }
      ]
    };
    
    // イベントのウォッチを設定
    const unwatch = publicClient.watchContractEvent({
      address: contractAddress,
      abi: [winnerPickedEvent],
      eventName: 'WinnerPicked',
      onLogs: (logs) => {
        if (logs.length > 0) {
          const log = logs[0];
          
          // イベントパラメータを取得
          const winner = log.args.winner;
          const amount = log.args.amount || BigInt(0);
          const jackpotWon = log.args.isJackpot || false;
          
          console.log("Winner picked event:", winner, amount.toString(), jackpotWon);
          
          // 自分が当選者かチェック
          const isWinner = winner && winner.toLowerCase() === address.toLowerCase();
          
          if (isWinner) {
            // 自分が当選した場合
            const prizeFormatted = formatUnits(amount, 6);
            
            setWinnerInfo({
              winner,
              prize: amount.toString(),
              isJackpot: jackpotWon,
              showModal: true
            });
            
            // トースト通知
            toast({
              title: jackpotWon ? '🎉 ジャックポット当選！！' : '🎊 当選おめでとうございます！',
              description: `${prizeFormatted} USDCが獲得されました！`,
              variant: 'success',
              duration: 10000
            });
          } else if (winner) {
            // 他の人が当選した場合
            toast({
              title: 'ラッフル結果発表',
              description: `${shortenAddress(winner)}さんが当選しました${jackpotWon ? '（ジャックポット）' : ''}`,
              variant: 'default'
            });
          }
        }
      }
    });
    
    return () => {
      // クリーンアップでイベントウォッチを解除
      unwatch();
    };
  }, [contractAddress, address, publicClient, toast]);
  
  // ヘルパー関数
  const shortenAddress = (addr) => {
    return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';
  };
  
  const closeModal = () => {
    setWinnerInfo(prev => ({ ...prev, showModal: false }));
  };
  
  return {
    ...winnerInfo,
    closeModal
  };
}