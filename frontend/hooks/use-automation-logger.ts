import { useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { useRaffleContract } from './use-raffle-contract';
import { useToast } from './use-toast';
import { formatUnits } from 'viem';

/**
 * Chainlink Automationの発火を検出し、ログに記録するカスタムフック
 */
export function useAutomationLogger() {
  const publicClient = usePublicClient();
  const { contractAddress } = useRaffleContract();
  const { toast } = useToast();
  
  const [automationLogs, setAutomationLogs] = useState<{
    timestamp: string;
    txHash: string;
    blockNumber: bigint;
    gasUsed: bigint;
  }[]>([]);
  
  // 最後に検出したトランザクションをローカルストレージから取得
  const getLastSeenBlock = (): number => {
    try {
      const saved = localStorage.getItem('lastAutomationBlock');
      return saved ? parseInt(saved, 10) : 0;
    } catch (e) {
      return 0;
    }
  };
  
  // 最後に検出したブロックをローカルストレージに保存
  const saveLastSeenBlock = (blockNumber: bigint) => {
    try {
      localStorage.setItem('lastAutomationBlock', blockNumber.toString());
    } catch (e) {
      console.warn('ローカルストレージへの保存に失敗しました', e);
    }
  };

  useEffect(() => {
    if (!contractAddress || !publicClient) return;
    
    const lastSeenBlock = getLastSeenBlock();
    let initialized = false;
    
    // PerformUpkeep関数呼び出しの検出
    const detectAutomation = async () => {
      try {
        // performUpkeep関数のセレクター (keccak256("performUpkeep(bytes)"))
        const functionSelector = '0x4585e33b';
        
        // 過去のブロックから現在までの呼び出しを検索
        const blockNumber = await publicClient.getBlockNumber();
        
        // 初期化時は現在のブロック番号を保存して終了（履歴検索を避ける）
        if (!initialized) {
          initialized = true;
          saveLastSeenBlock(blockNumber);
          return;
        }
        
        // 最後に見たブロックから現在までの範囲で検索
        const fromBlock = BigInt(Math.max(lastSeenBlock, Number(blockNumber) - 1000)); // 最大1000ブロック前まで
        
        const transactions = await publicClient.getContractEvents({
          address: contractAddress,
          fromBlock,
          toBlock: blockNumber,
          strict: true
        });
        
        // トランザクションが存在する場合は詳細を取得
        for (const event of transactions) {
          if (!event.transactionHash) continue;
          
          try {
            // トランザクション詳細を取得
            const txReceipt = await publicClient.getTransactionReceipt({
              hash: event.transactionHash
            });
            
            // トランザクションの入力データを取得
            const tx = await publicClient.getTransaction({
              hash: event.transactionHash
            });
            
            // performUpkeep関数が呼び出されたか確認
            if (tx.input.startsWith(functionSelector)) {
              console.log('🤖 Chainlink Automation検出:', {
                blockNumber: txReceipt.blockNumber,
                timestamp: new Date().toLocaleString(),
                hash: txReceipt.transactionHash,
                gasUsed: txReceipt.gasUsed
              });
              
              // トースト通知を表示
              toast({
                title: '🤖 Chainlink Automation発火',
                description: `ブロック ${txReceipt.blockNumber} でUpkeepが実行されました`,
                variant: 'default'
              });
              
              // ログに追加
              setAutomationLogs(prev => [
                {
                  timestamp: new Date().toLocaleString(),
                  txHash: txReceipt.transactionHash,
                  blockNumber: txReceipt.blockNumber,
                  gasUsed: txReceipt.gasUsed
                },
                ...prev
              ]);
            }
          } catch (error) {
            console.error('トランザクション詳細取得エラー:', error);
          }
        }
        
        // 最後に見たブロックを更新
        saveLastSeenBlock(blockNumber);
      } catch (error) {
        console.error('Automation検出エラー:', error);
      }
    };
    
    // 初回実行
    detectAutomation();
    
    // 定期的に実行 (30秒ごと)
    const intervalId = setInterval(detectAutomation, 30000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [contractAddress, publicClient, toast]);
  
  // WinnerPickedイベントを監視
  useEffect(() => {
    if (!contractAddress || !publicClient) return;
    
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
      onLogs: async (logs) => {
        if (logs.length > 0) {
          const log = logs[0];
          
          // イベントパラメータを取得
          const winner = log.args.winner;
          const amount = log.args.amount || BigInt(0);
          
          // トランザクション詳細を取得
          if (log.transactionHash) {
            try {
              const txReceipt = await publicClient.getTransactionReceipt({
                hash: log.transactionHash
              });
              
              console.log('🏆 当選者決定イベント検出:', {
                blockNumber: txReceipt.blockNumber,
                timestamp: new Date().toLocaleString(),
                hash: txReceipt.transactionHash,
                winner,
                amount: formatUnits(amount, 6) + ' USDC',
                gasUsed: txReceipt.gasUsed
              });
              
              // Automationログに追加
              setAutomationLogs(prev => [
                {
                  timestamp: new Date().toLocaleString(),
                  txHash: txReceipt.transactionHash,
                  blockNumber: txReceipt.blockNumber,
                  gasUsed: txReceipt.gasUsed
                },
                ...prev
              ]);
            } catch (error) {
              console.error('当選イベントのトランザクション詳細取得エラー:', error);
            }
          }
        }
      }
    });
    
    return () => {
      // クリーンアップでイベントウォッチを解除
      unwatch();
    };
  }, [contractAddress, publicClient]);

  return {
    automationLogs,
    clearLogs: () => setAutomationLogs([])
  };
}