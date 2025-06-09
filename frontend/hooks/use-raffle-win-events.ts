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
  
  // 処理済みイベントを追跡するセット
  // リロードやホットリロードに耐えるようにグローバルセットも使用
  const [processedEvents, setProcessedEvents] = useState<Set<string>>(new Set());
  
  // グローバルな処理済みイベントの記録も保持
  if (typeof window !== 'undefined' && !(window as any).processedRaffleEvents) {
    (window as any).processedRaffleEvents = new Set<string>();
  }
  
  // 最後に表示した勝者を追跡して重複表示を避ける
  const [lastDisplayedWinner, setLastDisplayedWinner] = useState<string>('');
  
  // セッション全体で保持する対策としてwindowオブジェクトに保存
  // useStateがリロードやデバッグ時に初期化される問題に対処
  if (typeof window !== 'undefined' && !(window as any).winnerDisplayTracker) {
    (window as any).winnerDisplayTracker = new Set<string>();
  }
  
  const [winnerInfo, setWinnerInfo] = useState({
    winner: '',
    prize: '0',
    isJackpot: false,
    showModal: false
  });
  
  // 初期化とクリーンアップ用の効果
  useEffect(() => {
    // 初期化時にトラッキングセットを確認・作成
    if (typeof window !== 'undefined') {
      if (!(window as any).winnerDisplayTracker) {
        (window as any).winnerDisplayTracker = new Set<string>();
      }
      
      if (!(window as any).processedRaffleEvents) {
        (window as any).processedRaffleEvents = new Set<string>();
      }
      
      // コンソールに状態を表示
      console.log("現在の勝者追跡セットのサイズ:", (window as any).winnerDisplayTracker.size);
      console.log("現在の処理済みイベントセットのサイズ:", (window as any).processedRaffleEvents.size);
      
      // デバッグ用：セットが大きくなりすぎた場合にクリーンアップ
      if ((window as any).processedRaffleEvents.size > 1000) {
        console.log("イベントキャッシュをクリーンアップ中です - サイズが大きくなりすぎています");
        (window as any).processedRaffleEvents = new Set<string>();
      }
    }
    
    return () => {
      // クリーンアップ時にはセットをクリアしない
      // セッション全体で重複表示を防止するため
    };
  }, []);
  
  // ラッフル完了イベントを手動でチェックする関数
  const checkWinnerEvents = async () => {
    if (!contractAddress || !publicClient) return;
    
    try {
      // 現在のブロック番号を取得
      const currentBlock = await publicClient.getBlockNumber();
      // 過去100ブロックのイベントを取得
      const fromBlock = currentBlock > 100n ? currentBlock - 100n : 0n;
      
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
      
      // 最近のイベントを取得
      const events = await publicClient.getContractEvents({
        address: contractAddress as `0x${string}`,
        abi: [winnerPickedEvent],
        eventName: 'WinnerPicked',
        fromBlock,
        toBlock: currentBlock
      });
      
      // イベントがあれば処理
      if (events.length > 0) {
        // 最新のイベントのみ処理
        const latestEvent = events[events.length - 1];
        
        // イベントの一意の識別子を作成
        const eventId = `${latestEvent.blockNumber || ''}-${latestEvent.transactionIndex || ''}-${latestEvent.logIndex || ''}`;
        
        // 既に処理済みのイベントはスキップ
        if (processedEvents.has(eventId) || ((window as any).processedRaffleEvents && (window as any).processedRaffleEvents.has(eventId))) {
          console.log("既に処理済みのイベントをスキップ:", eventId);
          return;
        }
        
        // イベントを処理済みとして追加 - ローカルとグローバルの両方に記録
        setProcessedEvents(prev => new Set([...prev, eventId]));
        if ((window as any).processedRaffleEvents) {
          (window as any).processedRaffleEvents.add(eventId);
        }
        
        console.log("直接取得したWinnerPickedイベント:", events.length, "件");
        const winner = (latestEvent as any).args?.winner;
        const amount = (latestEvent as any).args?.amount || BigInt(0);
        const jackpotWon = (latestEvent as any).args?.isJackpot || false;
        
        // 既に同じ勝者を表示済みかチェック - 複数のチェック機構を使用
        // 1. グローバルな追跡セットで確認
        if ((window as any).winnerDisplayTracker && (window as any).winnerDisplayTracker.has(winner)) {
          console.log('同じ勝者は追跡セットにあります。スキップ:', winner);
          return;
        }
        
        // 2. ステート変数で確認
        if (winner === lastDisplayedWinner) {
          console.log('同じ勝者を既に表示済みなのでスキップ:', winner);
          return;
        }
        
        // 新しい勝者を記録 - 両方のメカニズムで追跡
        setLastDisplayedWinner(winner);
        if ((window as any).winnerDisplayTracker) {
          (window as any).winnerDisplayTracker.add(winner);
          console.log('勝者を追跡セットに追加:', winner);
        }
        
        // 自分が当選者かチェック
        const currentAddress = smartAccountAddress || address;
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
    } catch (error) {
      console.error('イベントチェックエラー:', error);
    }
  };
  
  useEffect(() => {
    //スマートアカウントがない場合も考慮
    const currentAddress = smartAccountAddress || address;
    if (!contractAddress || (!address && !smartAccountAddress) || !publicClient) return;
    
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
      address: contractAddress as `0x${string}`,
      abi: [winnerPickedEvent],
      eventName: 'WinnerPicked',
      onLogs: (logs) => {
        if (logs.length > 0) {
          const log = logs[0];
          // イベントパラメータを取得
          // 型アサーションを使用してargsにアクセス
          const winner = (log as any).args?.winner;
          const amount = (log as any).args?.amount || BigInt(0);
          const jackpotWon = (log as any).args?.isJackpot || false;
          
          console.log("Winner picked event:", winner, amount.toString(), jackpotWon);
          
          // イベントの一意性を確認（ブロック番号 + トランザクションインデックス + ログインデックス）
          const eventId = `${log.blockNumber}-${log.transactionIndex}-${log.logIndex}`;
          
          // 既に処理済みのイベントかチェック
          if ((window as any).processedRaffleEvents && (window as any).processedRaffleEvents.has(eventId)) {
            console.log('既に処理済みのイベントをスキップ(ウォッチ):', eventId);
            return;
          }
          
          // イベントを処理済みとしてマーク
          if (!(window as any).processedRaffleEvents) {
            (window as any).processedRaffleEvents = new Set();
          }
          (window as any).processedRaffleEvents.add(eventId);
          
          // 既に同じ勝者を表示済みかチェック - 複数のチェック機構を使用
          // 1. グローバルな追跡セットで確認
          if ((window as any).winnerDisplayTracker && (window as any).winnerDisplayTracker.has(winner)) {
            console.log('同じ勝者は追跡セットにあります。スキップ(ウォッチ):', winner);
            return;
          }
          
          // 2. ステート変数で確認
          if (winner === lastDisplayedWinner) {
            console.log('同じ勝者を既に表示済みなのでスキップ(ウォッチ):', winner);
            return;
          }
          
          // 新しい勝者を記録 - 両方のメカニズムで追跡
          setLastDisplayedWinner(winner);
          if ((window as any).winnerDisplayTracker) {
            (window as any).winnerDisplayTracker.add(winner);
            console.log('勝者を追跡セットに追加(ウォッチ):', winner);
          }
          
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
    
    // 初回はイベントを手動でも確認
    checkWinnerEvents();
    
    // ポーリング間隔を延長して負荷を軽減 - 10秒から30秒に変更
    const intervalId = setInterval(() => {
      checkWinnerEvents();
    }, 30000);
    
    return () => {
      // クリーンアップでイベントウォッチを解除
      unwatch();
      clearInterval(intervalId);
    };
  }, [contractAddress, address, smartAccountAddress, publicClient, toast]);
  
  // ヘルパー関数
  const shortenAddress = (addr: string) => {
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