import { useEffect, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useRaffleContract } from './use-raffle-contract';
import { useToast } from '@/components/ui/use-toast';
import { formatUnits } from 'viem';
import { useSmartAccountContext } from '@/app/providers/smart-account-provider';

export function useRaffleWinEvents() {
  const { address } = useAccount();
  const { smartAccountAddress } = useSmartAccountContext();
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
    //スマートアカウントがない場合も考慮
    const currentAddress = smartAccountAddress || address;
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
          const isWinner = winner && currentAddress && winner.toLowerCase() === currentAddress.toLowerCase();
          
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
              variant: 'default',
              // 通知を長く表示
              duration: 15000,
            });
            
            // コンソールでも確認
            console.log('🎉 当選！', winner, amount.toString(), jackpotWon);
          } else if (winner) {
            // 他の人が当選した場合
            console.log('👉 他の人が当選:', winner, amount.toString(), jackpotWon);
            
            // 少し遅延してトーストを表示（他のトーストと重ならないように）
            setTimeout(() => {
              toast({
                title: 'ラッフル結果発表',
                description: `${shortenAddress(winner)}さんが当選しました${jackpotWon ? '（ジャックポット）' : ''}`,
                variant: 'default',
                // 通知を長く表示
                duration: 10000,
              });
            }, 500);
          }
        }
      }
    });
    
    return () => {
      // クリーンアップでイベントウォッチを解除
      unwatch();
    };
  }, [contractAddress, address, smartAccountAddress, publicClient, toast]);
  
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