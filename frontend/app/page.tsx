"use client"

import { useState, useEffect } from "react"
import { Trophy, Users, CheckCircle2, X, Zap, Sparkles, Shield, Wallet, CreditCard, Copy } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

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
    isReadyToSendTx 
  } = useSmartAccountContext();
  
  // ユーザーのラッフル履歴を取得
  const { userStats, pastRaffles, isLoading: isHistoryLoading } = useRaffleHistory(
    smartAccountAddress || address
  );
  
  // 当選イベント監視フックを使用
  const { winner, prize, isJackpot, showModal, closeModal } = useRaffleWinEvents();
  
  const [showNotification, setShowNotification] = useState(false)
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
        alert('現在ラッフルを開始できません\n\n全ての条件が揃っているか確認してください。\n・最少参加者数を満たしている\n・ラッフルがオープン状態');
        setIsProcessing(false);
        return;
      }
      
      // 手動Upkeepを実行
      try {
        const upkeepResult = await performManualUpkeep();
        
        console.log('Upkeep結果:', upkeepResult);
        
        if (upkeepResult) {
          setTxHash(upkeepResult);
          setShowNotification(true);
          
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
        console.error('手動Upkeep実行エラー:', upkeepError);
        const errorMessage = upkeepError instanceof Error ? upkeepError.message : '不明なエラー';
        alert(`ラッフル開始中にエラーが発生しました: ${errorMessage}\n\nブロックチェーンが混雑しているか、ガス代が不足している可能性があります。`);
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
    setShowNotification(true);
    
    // データを強制的に更新
    setTimeout(() => {
      checkPlayerEntered();
      updateContractBalances();
      
      // ラッフルデータも強制更新
      if (typeof raffleContract.updateRaffleData === 'function') {
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* コントラクト残高の表示 - 常時表示に変更 */}
        <div className="mb-4 flex flex-wrap gap-2 justify-end">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-full text-sm">
            <Wallet className="w-4 h-4 text-slate-500" />
            <span className="font-medium">{contractBalances.ethBalance} ETH</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-full text-sm">
            <CreditCard className="w-4 h-4 text-slate-500" />
            <span className="font-medium">{(Number(contractBalances.usdcBalance) / 1000000).toFixed(2)} USDC</span>
          </div>
        </div>
        
        <AppHeader />

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 transition-all duration-300 hover:shadow-xl backdrop-blur-sm bg-white/80 dark:bg-slate-800/80">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">進行中のラッフル</h2>
                <Badge
                  variant="outline"
                  className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                >
                  アクティブ
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-500" />
                <span className="text-xs text-slate-500">スマートコントラクト検証済み</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white text-center transform transition-transform hover:scale-[1.02] relative overflow-hidden group">
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <Sparkles className="w-6 h-6 mx-auto mb-2 text-white/80" />
                <h3 className="text-lg font-medium opacity-90 mb-2">当選賞金</h3>
                <div className="text-3xl font-bold">
                  {isLoading ? "読み込み中..." : `${(Number(raffleData.numberOfPlayers) * 9).toFixed(2)} USDC`}
                </div>
                <div className="mt-2 text-xs text-white/70">
                  ≈ {isLoading ? "..." : `${(Number(raffleData.numberOfPlayers) * 9 * 150).toFixed(0)}円`}
                </div>
              </div>
              <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl p-6 text-white text-center transform transition-transform hover:scale-[1.02] relative overflow-hidden group">
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <Trophy className="w-6 h-6 mx-auto mb-2 text-white/80" />
                <h3 className="text-lg font-medium opacity-90 mb-2">ジャックポット</h3>
                <div className="text-3xl font-bold">
                  {isLoading ? "読み込み中..." : `${(Number(raffleData.numberOfPlayers) * 1).toFixed(2)} USDC`}
                </div>
                <div className="mt-2 text-xs text-white/70">
                  ≈ {isLoading ? "..." : `${(Number(raffleData.numberOfPlayers) * 1 * 150).toFixed(0)}円`}
                </div>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">次回抽選まで</h3>
                <span className="text-sm text-slate-500">
                  {minutes}:{seconds.toString().padStart(2, "0")}
                </span>
              </div>
              <Progress value={progress} className="h-2 mb-6" />

              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">参加者 (3/3必要)</h3>
                </div>
                <span className="text-sm text-slate-500">
                  現在の参加者: {isLoading ? "読み込み中..." : raffleData.numberOfPlayers}人
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mb-6">
                {isLoading ? (
                  <div className="text-sm text-slate-500">プレイヤー情報を読み込み中...</div>
                ) : (
                  raffleData.players?.map((player, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-full"
                    >
                      <div className="w-6 h-6 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600"></div>
                      <span className="text-sm font-medium">{formatAddress(player)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

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
            
            {isConnected && raffleData.numberOfPlayers >= 3 && (
              <div className="mt-4">
                <button
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  onClick={startRaffle}
                  disabled={isProcessing || isLoading}
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                      処理中...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      ラッフルを開始する (手動Upkeep)
                    </>
                  )}
                </button>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 text-center">
                  (テスト用: プレイヤーが3人以上の場合にラッフルを開始できます)
                </div>
              </div>
            )}

            {/* 過去のラッフル履歴セクション - 改善バージョン */}
            {!isHistoryLoading && pastRaffles && pastRaffles.length > 0 && (
              <div className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  過去のラッフル当選履歴
                </h3>
                
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3 border-b border-slate-200 dark:border-slate-700 grid grid-cols-12 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <div className="col-span-3">日時</div>
                    <div className="col-span-5">当選アドレス</div>
                    <div className="col-span-2 text-center">賞金</div>
                    <div className="col-span-2 text-center">ステータス</div>
                  </div>
                  
                  <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {pastRaffles.slice(0, 5).map((raffle, index) => {
                      // 現在のウォレットアドレスと当選アドレスが一致するか確認
                      const currentAddress = smartAccountAddress || address || "";
                      const isCurrentWalletWinner = raffle.winnerAddress && 
                        currentAddress.toLowerCase() === raffle.winnerAddress.toLowerCase();
                      
                      return (
                        <div key={index} className="grid grid-cols-12 p-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                          <div className="col-span-3 text-slate-600 dark:text-slate-300 font-mono text-xs">
                            {raffle.time || "不明"}
                          </div>
                          <div className="col-span-5 font-mono text-xs">
                            {raffle.winnerAddress ? (
                              <div className="flex items-center gap-1">
                                <span className={`${isCurrentWalletWinner ? "text-green-600 dark:text-green-400 font-medium" : "text-slate-600 dark:text-slate-300"}`}>
                                  {formatAddress(raffle.winnerAddress)}
                                </span>
                                <button 
                                  onClick={() => {
                                    if (raffle.winnerAddress) {
                                      navigator.clipboard.writeText(raffle.winnerAddress);
                                      toast({
                                        title: "コピー完了",
                                        description: "アドレスがクリップボードにコピーされました",
                                        variant: "default",
                                      });
                                    }
                                  }}
                                  className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                                >
                                  <Copy className="w-3 h-3 text-slate-400" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-400">不明</span>
                            )}
                          </div>
                          <div className="col-span-2 text-center font-medium">
                            {raffle.prize || "0 USDC"}
                          </div>
                          <div className="col-span-2 flex justify-center items-center gap-1">
                            {raffle.isWinner && (
                              <Badge className="bg-green-500 text-white text-xs">当選</Badge>
                            )}
                            {raffle.jackpot && raffle.jackpot !== "なし" && (
                              <Badge className="bg-amber-500 text-white text-xs">JP</Badge>
                            )}
                            {!raffle.isWinner && (!raffle.jackpot || raffle.jackpot === "なし") && (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {pastRaffles.length > 5 && (
                  <div className="mt-2 text-center">
                    <button className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                      もっと見る ({pastRaffles.length - 5}件)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 transition-all duration-300 hover:shadow-xl backdrop-blur-sm bg-white/80 dark:bg-slate-800/80">
            <h3 className="text-xl font-bold mb-4">ユーザー情報</h3>
            <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded-xl font-mono text-sm mb-6 break-all flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isConnected || smartAccountAddress ? (
                  <span>{formatAddress(smartAccountAddress || address || user?.email || "N/A")}</span> // スマートアカウントアドレスを優先表示
                ) : (
                  <span className="text-slate-400">未接続</span>
                )}
                {(isConnected || smartAccountAddress) && (
                  <button 
                    onClick={() => {
                      const addrToCopy = smartAccountAddress || address;
                      if (addrToCopy) {
                        navigator.clipboard.writeText(addrToCopy);
                        toast({
                          title: "コピー完了",
                          description: "アドレスがクリップボードにコピーされました",
                          variant: "default",
                        });
                      }
                    }}
                    className="ml-1 p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                )}
              </div>
              {smartAccountAddress ? (
                <Badge
                  variant="outline"
                  className="ml-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 cursor-pointer"
                  onClick={() => window.open(`https://sepolia.etherscan.io/address/${smartAccountAddress}`, '_blank')}
                >
                  スマートアカウント
                </Badge>
              ) : isConnected ? (
                <Badge
                  variant="outline"
                  className="ml-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800"
                >
                  EOA
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="ml-2 bg-slate-100 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                >
                  未接続
                </Badge>
              )}
            </div>

            <div className="space-y-4 mb-8">
              {isHistoryLoading ? (
                <div className="py-8 text-center text-slate-500">ユーザー統計情報を読み込み中...</div>
              ) : (
                [
                  { label: "総参加数", value: userStats.totalParticipations.toString(), icon: <Users className="w-4 h-4 text-slate-400" /> },
                  { label: "勝利回数", value: userStats.totalWins.toString(), icon: <Trophy className="w-4 h-4 text-slate-400" /> },
                  { label: "ジャックポット獲得", value: userStats.jackpotWins.toString(), icon: <Sparkles className="w-4 h-4 text-slate-400" /> }
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                    <div className="flex items-center gap-2">
                      {item.icon}
                      <span className="text-sm">{item.label}</span>
                    </div>
                    <span className="font-bold">{item.value}</span>
                  </div>
                ))
              )}
            </div>

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
                  onWithdraw={(token) => console.log("Withdraw", token)}
                  onChangeOwner={(newOwner) => console.log("Change owner", newOwner)}
                  onSendCrossChain={(chainId, winner, prize, isJackpot) => 
                    console.log("Send cross chain", chainId, winner, prize, isJackpot)
                  }
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

        {showNotification && (
          <div className="fixed bottom-6 right-6 flex items-center gap-4 bg-white dark:bg-slate-800 border-l-4 border-indigo-500 rounded-lg shadow-xl p-4 max-w-md animate-slide-in-right z-50">
            <div className="flex-shrink-0 w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="font-bold">参加完了</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                ラッフルへの参加が確認されました。抽選をお待ちください。
              </div>
            </div>
            <button
              onClick={() => setShowNotification(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

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
