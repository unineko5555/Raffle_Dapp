"use client"

import { useState, useEffect } from "react"
import { Trophy, Users, CheckCircle2, X, Zap, Sparkles, ArrowRight, Shield, Wallet } from "lucide-react"
import Image from "next/image"

import { SmartWalletButton } from "./components/auth/smart-wallet-button"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import OwnerAdminPanel from "./components/admin/owner-admin-panel"
import RaffleEntryStatus from "./components/raffle/raffle-entry-status"
import { EnterRaffleButton } from "./components/raffle/enter-raffle-button"
import { supportedChains, getContractConfig } from "./lib/web3-config"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useAccount, useChainId, useSwitchChain } from "wagmi"
import { useRaffleContract } from "@/hooks/use-raffle-contract"
import { formatAddress } from "./utils/format-address"
import { useWeb3Auth } from "@/hooks/use-web3auth";
import { useSmartAccountContext } from "./providers/smart-account-provider"
import { useRaffleHistory } from "@/hooks/use-raffle-history"

export default function RaffleDapp() {
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { address, isConnected } = useAccount()
  const { user, provider, getAddress, getSavedSmartAccountInfo, web3auth } = useWeb3Auth();
  
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
      
      // 手動Upkeepを実行
      try {
        const upkeepResult = await performManualUpkeep();
        
        console.log('Upkeep結果:', upkeepResult);
        
        if (upkeepResult) {
          setTxHash(upkeepResult);
          setShowNotification(true);
          alert('ラッフルが開始されました！トランザクション: ' + upkeepResult);
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
    checkPlayerEntered();
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
        <header className="flex justify-between items-center mb-8 p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-lg backdrop-blur-sm bg-white/80 dark:bg-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Raffle Dapp
            </div>
            <Badge
              variant="outline"
              className="ml-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
            >
              Beta
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-sm font-medium">
                    <div className={`w-2 h-2 rounded-full ${activeChain.color} animate-pulse`}></div>
                    <span>{activeChain.name}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>現在接続中のネットワーク</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <ThemeToggle />
            {/* ConnectWalletButtonをSmartWalletButtonに変更 */}
            <SmartWalletButton />
          </div>
        </header>

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
                  {isLoading ? "読み込み中..." : `${Number(raffleData.numberOfPlayers || 0) * 9} USDC`}
                </div>
                <div className="mt-2 text-xs text-white/70">
                  ≈ {isLoading ? "..." : `${Number(raffleData.numberOfPlayers || 0) * 9 * 150}円`}
                </div>
              </div>
              <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl p-6 text-white text-center transform transition-transform hover:scale-[1.02] relative overflow-hidden group">
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <Trophy className="w-6 h-6 mx-auto mb-2 text-white/80" />
                <h3 className="text-lg font-medium opacity-90 mb-2">ジャックポット</h3>
                <div className="text-3xl font-bold">
                  {isLoading ? "読み込み中..." : `${raffleData.jackpotAmount || 0} USDC`}
                </div>
                <div className="mt-2 text-xs text-white/70">
                  ≈ {isLoading ? "..." : `${Number(raffleData.jackpotAmount || 0) * 150}円`}
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
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 transition-all duration-300 hover:shadow-xl backdrop-blur-sm bg-white/80 dark:bg-slate-800/80">
            <h3 className="text-xl font-bold mb-4">ユーザー情報</h3>
            <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded-xl font-mono text-sm mb-6 break-all flex items-center justify-between">
              {isConnected || smartAccountAddress ? (
                <span>{formatAddress(smartAccountAddress || address || user?.email || "N/A")}</span> // スマートアカウントアドレスを優先表示
              ) : (
                <span className="text-slate-400">未接続</span>
              )}
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
                  { label: "ジャックポット獲得", value: userStats.jackpotWins.toString(), icon: <Sparkles className="w-4 h-4 text-slate-400" /> },
                ].map((stat, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center py-3 border-b border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      {stat.icon}
                      <span>{stat.label}</span>
                    </div>
                    <div className="font-bold">{stat.value}</div>
                  </div>
                ))
              )}
            </div>

            <div>
              <h3 className="text-lg font-medium mb-3 text-slate-700 dark:text-slate-300">チェーン選択</h3>
              <div className="grid grid-cols-2 gap-2">
                {supportedChains.map((chain) => (
                  <div
                    key={chain.id}
                    className={`flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                      chain.id === activeChain.id
                        ? "border-2 border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                        : "border-2 border-transparent bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
                    }`}
                    onClick={() => handleChainChange(chain)}
                  >
                    <Image
                      src={chain.icon || "/placeholder.svg"}
                      alt={chain.name}
                      width={24}
                      height={24}
                      className="rounded-full"
                    />
                    <span className="text-sm font-medium">{chain.name}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">ガス残高:</span>
                  <span className="font-medium">0.015 ETH</span>
                </div>
              </div>
            </div>
            
            {/* 管理者パネルを追加 - テスト用にすべてのユーザーに表示 */}
            {(isConnected || smartAccountAddress) && raffleData.owner && (
              <div className="mt-8">
                <div className="p-3 mb-3 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm">
                  テスト用: この管理パネルは本来オーナーのみが操作できます
                </div>
                <OwnerAdminPanel
                  isOwner={true} /* テスト用に常にtrueに設定 */
                  contractAddress={contractAddress || ""}
                  balance={0.015}
                  usdcBalance={Number(raffleData.numberOfPlayers || 0) * 10}
                  jackpotAmount={Number(raffleData.jackpotAmount || 0)}
                  ownerAddress={smartAccountAddress || raffleData.owner}
                  supportedChains={supportedChains}
                  onWithdraw={() => {}}
                  onChangeOwner={() => {}}
                  onSendCrossChain={() => {}}
                  onUpgradeContract={() => {}}
                  onManualPerformUpkeep={manualPerformUpkeepAsOwner}
                  isLoading={isLoading || isProcessing}
                />
              </div>
            )}
          </div>

          <div className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 transition-all duration-300 hover:shadow-xl backdrop-blur-sm bg-white/80 dark:bg-slate-800/80">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">過去のラッフル結果</h3>
              <button className="text-indigo-600 dark:text-indigo-400 text-sm font-medium flex items-center gap-1 hover:underline">
                すべて表示 <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-slate-200 dark:border-slate-700">
                    <th className="pb-3 pr-4 font-medium text-slate-500 dark:text-slate-400">ラウンド</th>
                    <th className="pb-3 px-4 font-medium text-slate-500 dark:text-slate-400">参加者数</th>
                    <th className="pb-3 px-4 font-medium text-slate-500 dark:text-slate-400">当選者</th>
                    <th className="pb-3 px-4 font-medium text-slate-500 dark:text-slate-400">賞金額</th>
                    <th className="pb-3 px-4 font-medium text-slate-500 dark:text-slate-400">ジャックポット</th>
                    <th className="pb-3 pl-4 font-medium text-slate-500 dark:text-slate-400">抽選時間</th>
                    <th className="pb-3 pl-4 font-medium text-slate-500 dark:text-slate-400">トランザクション</th>
                  </tr>
                </thead>
                <tbody>
                  {isHistoryLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">過去のラッフル結果を読み込み中...</td>
                    </tr>
                  ) : pastRaffles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">過去のラッフル結果がありません</td>
                    </tr>
                  ) : (
                    pastRaffles.map((row, index) => (
                      <tr
                        key={index}
                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                      >
                        <td className="py-4 pr-4 font-medium">{row.round}</td>
                        <td className="py-4 px-4">{row.participants}</td>
                        <td className={`py-4 px-4 ${row.isWinner ? "text-emerald-500 font-bold" : ""}`}>{row.winner}</td>
                        <td className="py-4 px-4">{row.prize}</td>
                        <td className="py-4 px-4">{row.jackpot}</td>
                        <td className="py-4 px-4 text-slate-500">{row.time}</td>
                        <td className="py-4 pl-4">
                          <a
                            href={`https://sepolia-explorer.arbitrum.io/tx/${row.tx}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 underline text-sm"
                          >
                            表示
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

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
    </div>
  )
}
