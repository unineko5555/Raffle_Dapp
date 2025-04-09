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
  
  // イベント検出のログ記録用
  const [eventLogs, setEventLogs] = useState<{
    event: string;
    timestamp: string;
    txHash: string;
    blockNumber: bigint;
    details: string;
  }[]>([]);
  
  useEffect(() => {
    if (!contractAddress || !publicClient) return;
    
    console.log(`🎮 WinnerPickedイベントのリッスン開始: ${contractAddress}`);
    
    // WinnerPickedイベントのABIフラグメント
    const winnerPickedEvent = {
      type: 'event',
      name: 'WinnerPicked',
      inputs: [
        { type: 'address', name: 'winner', indexed: true },
        { type: 'uint256', name: 'amount', indexed: false },
        { type: 'bool', name: 'isJackpot', indexed: false }
      ]
    };
    
    // RaffleStateChangedイベントのABIフラグメント
    const stateChangedEvent = {
      type: 'event',
      name: 'RaffleStateChanged',
      inputs: [
        { type: 'uint8', name: 'newState', indexed: false }
      ]
    };
    
    // RaffleEnterイベントのABIフラグメント
    const enterEvent = {
      type: 'event',
      name: 'RaffleEnter',
      inputs: [
        { type: 'address', name: 'player', indexed: true },
        { type: 'uint256', name: 'entranceFee', indexed: false }
      ]
    };
    
    // イベントを監視する関数
    const setupWatchers = () => {
      // WinnerPickedイベントのウォッチ
      const unwatchWinner = publicClient.watchContractEvent({
        address: contractAddress,
        abi: [winnerPickedEvent],
        eventName: 'WinnerPicked',
        onLogs: async (logs) => {
          if (logs.length > 0) {
            const log = logs[0];
            
            // イベントパラメータを取得
            const winner = log.args.winner;
            const amount = log.args.amount || BigInt(0);
            const jackpotWon = log.args.isJackpot || false;
            
            console.log(`🎉 WinnerPickedイベント検出: ${winner}, ${formatUnits(amount, 6)} USDC, ジャックポット: ${jackpotWon}`);
            
            // イベントログ記録
            if (log.transactionHash) {
              try {
                const txReceipt = await publicClient.getTransactionReceipt({
                  hash: log.transactionHash
                });
                
                // ログの追加
                setEventLogs(prev => [{
                  event: 'WinnerPicked',
                  timestamp: new Date().toLocaleString(),
                  txHash: log.transactionHash,
                  blockNumber: txReceipt.blockNumber,
                  details: `当選者: ${winner}, 賞金: ${formatUnits(amount, 6)} USDC, ジャックポット: ${jackpotWon}`
                }, ...prev]);
                
                // トランザクション情報をログに出力
                console.log('📋 WinnerPicked詳細:', {
                  blockNumber: txReceipt.blockNumber,
                  timestamp: new Date().toLocaleString(),
                  hash: txReceipt.transactionHash,
                  gasUsed: txReceipt.gasUsed
                });
              } catch (error) {
                console.error('トランザクション詳細取得エラー:', error);
              }
            }
            
            // 自分が当選者かチェック
            const isWinner = address && winner && winner.toLowerCase() === address.toLowerCase();
            
            if (isWinner) {
              // 自分が当選した場合
              const prizeFormatted = formatUnits(amount, 6);
              
              // ウィナー情報を設定（モーダル表示用）
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
      
      // RaffleStateChangedイベントのウォッチ
      const unwatchState = publicClient.watchContractEvent({
        address: contractAddress,
        abi: [stateChangedEvent],
        eventName: 'RaffleStateChanged',
        onLogs: async (logs) => {
          if (logs.length > 0) {
            const log = logs[0];
            const newState = log.args.newState;
            const stateLabel = newState === 0 ? 'オープン' : newState === 1 ? 'クローズド' : newState === 2 ? '計算中' : `不明(${newState})`;
            
            console.log(`🔄 RaffleStateChangedイベント検出: ${stateLabel} (${newState})`);
            
            // イベントログ記録
            if (log.transactionHash) {
              try {
                const txReceipt = await publicClient.getTransactionReceipt({
                  hash: log.transactionHash
                });
                
                // ログの追加
                setEventLogs(prev => [{
                  event: 'StateChanged',
                  timestamp: new Date().toLocaleString(),
                  txHash: log.transactionHash,
                  blockNumber: txReceipt.blockNumber,
                  details: `新しい状態: ${stateLabel} (${newState})`
                }, ...prev]);
                
                // トランザクション情報をログに出力
                console.log('📋 StateChanged詳細:', {
                  blockNumber: txReceipt.blockNumber,
                  timestamp: new Date().toLocaleString(),
                  hash: txReceipt.transactionHash,
                  gasUsed: txReceipt.gasUsed
                });
                
                // もし状態が「計算中(2)」に変わった場合、これはperformUpkeepが実行された証拠
                if (newState === 2) {
                  console.log('🤖 Chainlink Automation発火検出: performUpkeepがRaffleStateを「計算中」に変更');
                  
                  // トースト通知
                  toast({
                    title: '🤖 Chainlink Automation発火',
                    description: 'ラッフルが自動的に開始されました',
                    variant: 'default'
                  });
                }
              } catch (error) {
                console.error('トランザクション詳細取得エラー:', error);
              }
            }
          }
        }
      });
      
      // RaffleEnterイベントのウォッチ
      const unwatchEnter = publicClient.watchContractEvent({
        address: contractAddress,
        abi: [enterEvent],
        eventName: 'RaffleEnter',
        onLogs: async (logs) => {
          if (logs.length > 0) {
            const log = logs[0];
            const player = log.args.player;
            const fee = log.args.entranceFee || BigInt(0);
            
            // イベントログ記録
            if (log.transactionHash) {
              try {
                const txReceipt = await publicClient.getTransactionReceipt({
                  hash: log.transactionHash
                });
                
                // RaffleEnterイベントは頻繁に発生するのでコンソールログは最小限に
                console.log(`👤 RaffleEnterイベント検出: ${shortenAddress(player)}, ${formatUnits(fee, 6)} USDC`);
                
                // ログに追加するが、UIには表示しない場合もある
                setEventLogs(prev => [{
                  event: 'RaffleEnter',
                  timestamp: new Date().toLocaleString(),
                  txHash: log.transactionHash,
                  blockNumber: txReceipt.blockNumber,
                  details: `参加者: ${player}, 参加料: ${formatUnits(fee, 6)} USDC`
                }, ...prev]);
              } catch (error) {
                console.error('トランザクション詳細取得エラー:', error);
              }
            }
          }
        }
      });
      
      // すべてのクリーンアップ関数を返す
      return () => {
        unwatchWinner();
        unwatchState();
        unwatchEnter();
      };
    };
    
    // イベント監視を設定
    const cleanup = setupWatchers();
    
    return () => {
      // クリーンアップでイベントウォッチを解除
      cleanup();
    };
  }, [contractAddress, address, publicClient, toast]);
  
  // ヘルパー関数
  const shortenAddress = (addr: string) => {
    return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';
  };
  
  const closeModal = () => {
    setWinnerInfo(prev => ({ ...prev, showModal: false }));
  };
  
  return {
    ...winnerInfo,
    closeModal,
    eventLogs,
    clearLogs: () => setEventLogs([])
  };
}