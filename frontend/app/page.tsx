"use client"

import { useState, useEffect } from "react"
import { Trophy, Users, CheckCircle2, X, Zap, Sparkles, ArrowRight, Shield } from "lucide-react"
import Image from "next/image"
import { ConnectWalletButton } from "./components/auth/connect-wallet-button"
import { supportedChains } from "./lib/web3-config"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { enterRaffle } from "./actions/enter-raffle"

export default function RaffleDapp() {
  const [showNotification, setShowNotification] = useState(true)
  const [minutes, setMinutes] = useState(0)
  const [seconds, setSeconds] = useState(42)
  const [progress, setProgress] = useState(75)
  const [activeChain, setActiveChain] = useState(supportedChains[0])
  const [isEntering, setIsEntering] = useState(false)
  const [txHash, setTxHash] = useState("")

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

  const handleEnterRaffle = async () => {
    try {
      setIsEntering(true)
      const result = await enterRaffle(activeChain.id, "0xRaffleContractAddress")
      if (result.success) {
        setTxHash(result.txHash)
        setShowNotification(true)
      }
    } catch (error) {
      console.error("Error entering raffle:", error)
    } finally {
      setIsEntering(false)
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
            <ConnectWalletButton />
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
                <div className="text-3xl font-bold">27 USDC</div>
                <div className="mt-2 text-xs text-white/70">≈ 4,050円</div>
              </div>
              <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl p-6 text-white text-center transform transition-transform hover:scale-[1.02] relative overflow-hidden group">
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <Trophy className="w-6 h-6 mx-auto mb-2 text-white/80" />
                <h3 className="text-lg font-medium opacity-90 mb-2">ジャックポット</h3>
                <div className="text-3xl font-bold">120 USDC</div>
                <div className="mt-2 text-xs text-white/70">≈ 18,000円</div>
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
                <span className="text-sm text-slate-500">現在の参加者: 3人</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-6">
                {["0x7a23...9f21", "0x3b45...c72e", "0x9d12...4e5f"].map((address, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-full"
                  >
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600"></div>
                    <span className="text-sm font-medium">{address}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <button
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                onClick={handleEnterRaffle}
                disabled={isEntering}
              >
                {isEntering ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                    処理中...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    ラッフルに参加する (10 USDC)
                  </>
                )}
              </button>
              <div className="absolute -top-2 right-2">
                <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0">ガス代無料</Badge>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 transition-all duration-300 hover:shadow-xl backdrop-blur-sm bg-white/80 dark:bg-slate-800/80">
            <h3 className="text-xl font-bold mb-4">ユーザー情報</h3>
            <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded-xl font-mono text-sm mb-6 break-all flex items-center justify-between">
              <span>0x7a2345...9f21</span>
              <Badge
                variant="outline"
                className="ml-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
              >
                スマートアカウント
              </Badge>
            </div>

            <div className="space-y-4 mb-8">
              {[
                { label: "総参加数", value: "12", icon: <Users className="w-4 h-4 text-slate-400" /> },
                { label: "勝利回数", value: "2", icon: <Trophy className="w-4 h-4 text-slate-400" /> },
                { label: "ジャックポット獲得", value: "0", icon: <Sparkles className="w-4 h-4 text-slate-400" /> },
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
              ))}
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
                    onClick={() => setActiveChain(chain)}
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
                  {[
                    {
                      round: "#42",
                      participants: "5",
                      winner: "0x3b45...c72e",
                      prize: "45 USDC",
                      jackpot: "なし",
                      time: "2分前",
                      isWinner: true,
                      tx: "0x8a72...3f21",
                    },
                    {
                      round: "#41",
                      participants: "8",
                      winner: "0x9d12...4e5f",
                      prize: "72 USDC",
                      jackpot: "なし",
                      time: "15分前",
                      isWinner: false,
                      tx: "0x7b34...9c12",
                    },
                    {
                      round: "#40",
                      participants: "4",
                      winner: "0x5f78...2a3b",
                      prize: "36 USDC",
                      jackpot: "なし",
                      time: "32分前",
                      isWinner: false,
                      tx: "0x3e56...1d78",
                    },
                    {
                      round: "#39",
                      participants: "10",
                      winner: "0x7a23...9f21",
                      prize: "90 USDC",
                      jackpot: "115 USDC",
                      time: "1時間前",
                      isWinner: true,
                      tx: "0x2c45...8e34",
                    },
                  ].map((row, index) => (
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
                          href={`https://etherscan.io/tx/${row.tx}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 underline text-sm"
                        >
                          表示
                        </a>
                      </td>
                    </tr>
                  ))}
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

