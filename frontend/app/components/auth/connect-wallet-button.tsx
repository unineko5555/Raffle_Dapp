"use client"

import { useState } from "react"
import { Wallet, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { socialLoginProviders } from "@/app/lib/web3-config"
import Image from "next/image"

export function ConnectWalletButton() {
  const [isConnected, setIsConnected] = useState(false)
  const [activeTab, setActiveTab] = useState("wallet")
  const [open, setOpen] = useState(false)
  const [userAddress, setUserAddress] = useState("")

  // 実際のアプリケーションではwagmiのuseAccountやuseConnectなどを使用します
  const handleConnect = (method: string, id?: string) => {
    // ここでは簡易的な実装
    setIsConnected(true)
    setUserAddress("0x7a2345...9f21")
    setOpen(false)
  }

  const handleDisconnect = () => {
    setIsConnected(false)
    setUserAddress("")
  }

  return (
    <>
      {!isConnected ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium py-2.5 px-5 rounded-full transition-all duration-300 hover:shadow-lg transform hover:-translate-y-0.5">
              <Wallet className="w-5 h-5" />
              ウォレット接続
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center text-2xl font-bold">アカウント接続</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="wallet" className="w-full" onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="wallet">ウォレット</TabsTrigger>
                <TabsTrigger value="social">ソーシャルログイン</TabsTrigger>
              </TabsList>
              <TabsContent value="wallet" className="space-y-4">
                <div className="grid gap-4">
                  <Button
                    variant="outline"
                    className="flex justify-between items-center h-14 px-4 border-2 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                    onClick={() => handleConnect("metamask")}
                  >
                    <div className="flex items-center gap-3">
                      <Image src="/icons/metamask.png" alt="MetaMask" width={32} height={32} className="rounded-full" />
                      <span className="font-medium">MetaMask</span>
                    </div>
                    <span className="text-xs text-slate-500">人気</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex justify-between items-center h-14 px-4 border-2 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                    onClick={() => handleConnect("walletconnect")}
                  >
                    <div className="flex items-center gap-3">
                      <Image
                        src="/icons/walletconnect.png"
                        alt="WalletConnect"
                        width={32}
                        height={32}
                        className="rounded-full"
                      />
                      <span className="font-medium">WalletConnect</span>
                    </div>
                    <span className="text-xs text-slate-500">QRコード</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex justify-between items-center h-14 px-4 border-2 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                    onClick={() => handleConnect("coinbase")}
                  >
                    <div className="flex items-center gap-3">
                      <Image src="/icons/coinbase.png" alt="Coinbase" width={32} height={32} className="rounded-full" />
                      <span className="font-medium">Coinbase Wallet</span>
                    </div>
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="social" className="space-y-4">
                <div className="grid gap-4">
                  {socialLoginProviders.map((provider) => (
                    <Button
                      key={provider.id}
                      variant="outline"
                      className="flex justify-between items-center h-14 px-4 border-2 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                      onClick={() => handleConnect("social", provider.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Image
                          src={provider.icon || "/placeholder.svg"}
                          alt={provider.name}
                          width={24}
                          height={24}
                          className="rounded-full"
                        />
                        <span className="font-medium">{provider.name}でログイン</span>
                      </div>
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-center text-slate-500 mt-4">
                  ソーシャルログインではスマートアカウントが自動的に作成されます
                </p>
              </TabsContent>
            </Tabs>
            <div className="flex items-center space-x-2 mt-4">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
              <p className="text-xs text-slate-500">アカウントアブストラクション対応</p>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <div className="relative group">
          <Button className="flex items-center gap-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium py-2.5 px-5 rounded-full transition-all duration-300">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600"></div>
            <span className="font-mono text-sm">{userAddress}</span>
            <ChevronDown className="w-4 h-4 ml-1" />
          </Button>
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
            <div className="py-2">
              <button
                className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={handleDisconnect}
              >
                切断する
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

