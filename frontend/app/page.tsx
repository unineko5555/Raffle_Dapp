"use client"

import { useState, useEffect } from "react"
import { Trophy, Users, CheckCircle2, X, Zap, Sparkles, Shield, Wallet, CreditCard, Copy } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { ToastIcon } from "@/components/ui/toast-icon"

import { AppHeader } from "./components/header/app-header"
import OwnerAdminPanel from "./components/admin/owner-admin-panel"
import RaffleEntryStatus from "./components/raffle/raffle-entry-status"
import { EnterRaffleButton } from "./components/raffle/enter-raffle-button"
import { WinnerModal } from "./components/raffle/winner-modal" // 当選モーダルをインポート
import { supportedChains, getContractConfig } from "./lib/web3-config"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useAccount, useChainId, useSwitchChain } from "wagmi"
import { useRaffleContract } from "@/hooks/use-raffle-contract"
import { useRaffleWinEvents } from "@/hooks/use-raffle-win-events" // 当選イベントフックをインポート
import { formatAddress } from "./utils/format-address"
import { useWeb3Auth } from "@/hooks/use-web3auth";
import { useSmartAccountContext } from "./providers/smart-account-provider"
import { useRaffleHistory } from "@/hooks/use-raffle-history"

// 新しいコンポーネントのインポート
import { ContractBalanceDisplay } from "./components/contract/contract-balance-display"
import { RafflePrizeInfo } from "./components/raffle/raffle-prize-info"
import { RaffleCountdown } from "./components/raffle/raffle-countdown"
import { PlayersList } from "./components/raffle/players-list"
import { StartRaffleButton } from "./components/raffle/start-raffle-button"
import { RaffleHistory } from "./components/raffle/raffle-history"
import { UserProfile } from "./components/user/user-profile"
import { RaffleHeader } from "./components/raffle/raffle-header"
import JackpotInfo from "./components/raffle/jackpot-info"

export default function RaffleDapp() {
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { address, isConnected } = useAccount()
  const { user, provider, getAddress, getSavedSmartAccountInfo, web3auth } = useWeb3Auth();
  const { toast } = useToast(); // トースト通知用フック
  
  // スマートアカウントの状態を取得
  const { 
    smartAccountClient, 
    smartAccountAddress, 
    isReadyToSendTx,
    isLoading: isSmartAccountLoading
  } = useSmartAccountContext();
  
  // ユーザーのラッフル履歴を取得
  const { userStats, pastRaffles, isLoading: isHistoryLoading } = useRaffleHistory(
    smartAccountAddress || address
  );
  
  // 当選イベント監視フックを使用
  const { winner, prize, isJackpot, showModal, closeModal } = useRaffleWinEvents();
  
  const [minutes, setMinutes] = useState(0)
  const [seconds, setSeconds] = useState(42)
  const [progress, setProgress] = useState(75)
  const [activeChain, setActiveChain] = useState(supportedChains[0])
  const [txHash, setTxHash] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  // useRaffleContractフックから実際のコントラクトデータを取得
  const raffleContract = useRaffleContract()
  const { 
    raffleData, 
    isLoading, 
    error, 
    handleEnterRaffle, 
    manualPerformUpkeepAsOwner,
    contractAddress,
    isPlayerEntered,
    checkPlayerEntered,
    performManualUpkeep,
    checkAutomationStatus
  } = raffleContract
  
  // コントラクト残高データ
  const [contractBalances, setContractBalances] = useState({
    ethBalance: "0.015", // デフォルト値
    usdcBalance: "0" 
  });

  // コントラクト残高を取得する関数 - ウォレット未接続時も動作するように修正
  const updateContractBalances = async () => {
    if (!raffleContract.getContractEthBalance || !raffleContract.getContractUsdcBalance) {
      console.log('コントラクト関数が利用できません');
      return;
    }
    
    try {
      const ethBalance = await raffleContract.getContractEthBalance();
      const usdcBalance = await raffleContract.getContractUsdcBalance();
      
      // 初回または残高が変わった場合のみログを出力
      if (ethBalance !== contractBalances.ethBalance || 
          usdcBalance !== contractBalances.usdcBalance) {
        console.log("取得したコントラクト残高:", { ethBalance, usdcBalance });
      }
      
      // 文字列化された値をそのまま保存 (USDCはすでに最小単位の文字列)
      setContractBalances({
        ethBalance: ethBalance,
        usdcBalance: usdcBalance
      });
    } catch (error) {
      console.error('コントラクト残高取得エラー:', error);
    }
  };
  
  // コンポーネントマウント時と一定間隔でコントラクト残高を更新
  useEffect(() => {
    // 初回読み込み
    updateContractBalances();
    
    // 30秒ごとに更新
    const intervalId = setInterval(updateContractBalances, 30000);
    
    return () => clearInterval(intervalId);
  }, [raffleContract.getContractEthBalance, raffleContract.getContractUsdcBalance]);

  // 手動でラッフルを開始する
  const startRaffle = async () => {
    try {
      // ローディング表示
      setIsProcessing(true);
      
      // 確認メッセージ
      if (!confirm('ラッフルを開始しますか？この操作は元に戻せません。\n\n参加者の中からランダムに当選者が選ばれます。')) {
        setIsProcessing(false);
        return;
      }

      // プレイヤー数の確認
      if (raffleData.numberOfPlayers < 3) {
        alert('ラッフルを開始するには少なくとも3人の参加者が必要です。\n現在の参加者数: ' + raffleData.numberOfPlayers);
        setIsProcessing(false);
        return;
      }
      
      console.log('ラッフル開始実行: 手動Upkeepを開始します');
      
      // Upkeep可能かチェック
      const automationStatus = await checkAutomationStatus();
      if (!automationStatus || !automationStatus.upkeepNeeded) {
        alert('現在ラッフルを開始できません\n\n全ての条件が揃っているか確認してください。\n・最少参加者数を満たしている\n・ラッフルがオープン状態\n・参加から1分以上経過している');
        setIsProcessing(false);
        return;
      }
      
      // 手動Upkeepを実行
      try {
        const upkeepResult = await performManualUpkeep();
        
        console.log('Upkeep結果:', upkeepResult);
        
        if (upkeepResult) {
          setTxHash(upkeepResult);
          
          // トースト通知を使用
          toast({
            title: "ラッフル開始",
            description: "ラッフルが開始されました！結果をお待ちください。",
            variant: "default",
            icon: <ToastIcon variant="default" icon={<Zap className="w-5 h-5" />} />
          });
          
          // 成功メッセージ
          alert('ラッフルが開始されました！トランザクション: ' + upkeepResult);
          
          // トランザクション完了後、2秒後にデータを強制更新
          setTimeout(() => {
            // コントラクトデータを再取得
            updateContractBalances();
          }, 3000);
        } else {
          alert('ラッフル開始トランザクションが生成されましたが、結果が不明です。\n後ほど確認してください。');
        }
      } catch (upkeepError) {
        // エラーメッセージを改善
        console.error('Upkeepエラー詳細:', upkeepError);
        const errorMessage = upkeepError instanceof Error ? upkeepError.message : '不明なエラー';
        
        // スマートアカウント特有のエラーかどうか確認
        let displayMessage = errorMessage;
        if (errorMessage.includes('スマートアカウントでの手動Upkeep実行に失敗しました')) {
          displayMessage = 'スマートアカウントからのラッフル開始に失敗しました。\n\n詳細: ' + errorMessage;
        }
        
        alert(`ラッフル開始中にエラーが発生しました: ${displayMessage}\n\nブロックチェーンが混雑しているか、ガス代が不足している可能性があります。`);
      }
    } catch (error) {
      console.error('ラッフル開始エラー:', error);
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      alert(`エラーが発生しました: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // デバッグ用：グローバルにデバッグ関数を公開
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // @ts-ignore - デバッグ用のグローバル変数
      window.debugRaffle = {
        checkAutomation: checkAutomationStatus,
        manualUpkeep: performManualUpkeep
      };
      
      // 初回のみデバッグ情報を表示
      if (!(window as any).debugRaffleInitialized) {
        console.log('===== ラッフルデバッグ機能 =====');
        console.log('Automation状態を確認: window.debugRaffle.checkAutomation()');
        console.log('手動でUpkeepを実行: window.debugRaffle.manualUpkeep()');
        console.log('============================');
        // @ts-ignore
        (window as any).debugRaffleInitialized = true;
      }
    }
  }, [checkAutomationStatus, performManualUpkeep])
  
  // Wagmiの接続状態監視
  useEffect(() => {
    if (isConnected && address) {
      checkPlayerEntered();
    }
  }, [isConnected, address, checkPlayerEntered])
  
  // チェーンが変更されたときにアクティブチェーンを更新
  useEffect(() => {
    if (chainId) {
      const newActiveChain = supportedChains.find(c => c.id === chainId)
      if (newActiveChain) {
        setActiveChain(newActiveChain)
      }
    }
  }, [chainId])

  // カウントダウンタイマー
  useEffect(() => {
    const timer = setInterval(() => {
      if (seconds > 0) {
        setSeconds(seconds - 1)
        setProgress(((minutes * 60 + seconds - 1) / 42) * 100)
      } else if (minutes > 0) {
        setMinutes(minutes - 1)
        setSeconds(59)
        setProgress(((minutes * 60 + 59) / 42) * 100)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [minutes, seconds])

  // ラッフル参加成功時のコールバック
  const handleRaffleEntrySuccess = () => {
    setTimeout(() => {
      checkPlayerEntered();
      updateContractBalances();
      
      // ラッフルデータも強制更新
      // @ts-ignore - メソッドが存在しない可能性があるのでignore
      if (typeof raffleContract.updateRaffleData === 'function') {
        // @ts-ignore
        raffleContract.updateRaffleData(true);
      }
    }, 2000); // トランザクションの反映を待つために少し遅延
  };

  // チェーン切り替え処理
  const handleChainChange = async (newChain: (typeof supportedChains)[0]) => {
    setActiveChain(newChain)
    try {
      await switchChain({ chainId: newChain.id })
    } catch (error) {
      console.error('チェーン切り替えエラー:', error);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 text-slate-900 dark:text-slate-100">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-4 md:py-6">
        {/* コントラクト残高の表示 - 常時表示に変更 */}
        <div className="mb-2 md:mb-4 flex flex-wrap gap-2 justify-center md:justify-end">
          <div className="flex items-center gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-100 dark:bg-slate-700 rounded-full text-xs sm:text-sm whitespace-nowrap">
            <Wallet className="w-3 h-3 sm:w-4 sm:h-4 text-slate-500" />
            <span className="font-medium">{contractBalances.ethBalance} ETH</span>
          </div>
          <div className="flex items-center gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-100 dark:bg-slate-700 rounded-full text-xs sm:text-sm whitespace-nowrap">
            <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 text-slate-500" />
            <span className="font-medium">{(Number(contractBalances.usdcBalance) / 1000000).toFixed(2)} USDC</span>
          </div>
        </div>
        
        <AppHeader />

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl md:rounded-2xl shadow-lg p-3 sm:p-4 md:p-6 transition-all duration-300 hover:shadow-xl backdrop-blur-sm bg-white/80 dark:bg-slate-800/80">
            <RaffleHeader />

            <RafflePrizeInfo 
              numberOfPlayers={raffleData.numberOfPlayers} 
              isLoading={isLoading} 
            />

            <JackpotInfo 
              jackpotAmount={BigInt(raffleData.jackpotAmount || "0")}
              entranceFee={10}
              jackpotProbability={35} // バックエンドのRaffleLib.solの通り35%
              contributionRate={10} // 参加料の10%がジャックポットに蓄積
            />

            <RaffleCountdown initialMinutes={0} initialSeconds={42} />

            <PlayersList 
              players={raffleData.players || []}
              numberOfPlayers={raffleData.numberOfPlayers}
              isLoading={isLoading}
              minPlayers={3}
            />

            <div className="relative">
              <RaffleEntryStatus />
              {/* カスタムEnterRaffleButtonを使用 */}
              <EnterRaffleButton 
                raffleAddress={contractAddress || ""}
                entryFee={typeof raffleData.entranceFee === 'string' ? BigInt(raffleData.entranceFee) : (raffleData.entranceFee || BigInt(10))}
                isRaffleOpen={!isLoading}
                onSuccess={handleRaffleEntrySuccess}
              />
              <div className="absolute -top-2 right-2">
                <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0">ガス代無料</Badge>
              </div>
            </div>
            
            <StartRaffleButton 
              isConnected={isConnected}
              isReadyToSendTx={isReadyToSendTx}
              numberOfPlayers={raffleData.numberOfPlayers}
              minPlayers={3}
              isLoading={isLoading}
              isSmartAccountLoading={isSmartAccountLoading}
              onStartRaffle={startRaffle}
            />

            <RaffleHistory 
              pastRaffles={pastRaffles || []}
              currentAddress={smartAccountAddress || address}
              isLoading={isHistoryLoading}
            />
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl md:rounded-2xl shadow-lg p-3 sm:p-4 md:p-6 transition-all duration-300 hover:shadow-xl backdrop-blur-sm bg-white/80 dark:bg-slate-800/80">
            <UserProfile 
              address={address}
              smartAccountAddress={smartAccountAddress}
              user={user}
              userStats={userStats}
              isLoading={isHistoryLoading}
              isConnected={isConnected}
            />

            {/* 管理パネル (オーナーまたはテストモードの場合のみ表示) */}
            {(isConnected || smartAccountAddress || user) && (
              <div className="mt-6">
                <OwnerAdminPanel
                  isOwner={true} // テストモードでは常にtrue
                  contractAddress={contractAddress || ""}
                  balance={contractBalances.ethBalance || "0"}
                  usdcBalance={contractBalances.usdcBalance || "0"}
                  jackpotAmount={raffleData.jackpotAmount || "0"}
                  ownerAddress={raffleData.owner || ""}
                  supportedChains={supportedChains}
                  onChangeOwner={(newOwner) => console.log("Change owner", newOwner)}
                  onUpgradeContract={(newImplementation, initData) => 
                    console.log("Upgrade contract", newImplementation, initData)
                  }
                  onManualPerformUpkeep={performManualUpkeep}
                  isLoading={isLoading}
                />
              </div>
            )}
          </div>
        </main>

        {/* 当選モーダル */}
        {winner && (
          <WinnerModal
            isOpen={showModal}
            onClose={closeModal}
            winner={winner}
            prize={prize}
            isJackpot={isJackpot}
          />
        )}
      </div>
    </div>
  )
}
