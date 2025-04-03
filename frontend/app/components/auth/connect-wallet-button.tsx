"use client"

import { useState, useEffect } from "react"
import { Wallet, ChevronDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { socialLoginProviders } from "@/app/lib/web3-config"
import { useAccount, useConnect, useDisconnect } from "wagmi"
import { injected, metaMask, walletConnect } from "wagmi/connectors"
import Image from "next/image"
import { useWeb3Auth } from "@/hooks/use-web3auth"
import { useToast } from "@/hooks/use-toast"

export function ConnectWalletButton() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("wallet")
  const [open, setOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false); // ログイン状態を管理する新しいstate
  const [displayAddress, setDisplayAddress] = useState("")
  const [socialConnecting, setSocialConnecting] = useState(false)
  
  // Web3Authフックを使用
  const { 
    web3auth, 
    provider, 
    user, 
    isLoading: isWeb3AuthLoading, 
    error: web3AuthError, 
    login: web3AuthLogin, 
    logout: web3AuthLogout,
    getAddress: getWeb3AuthAddress
  } = useWeb3Auth()

  // 接続状態と表示アドレスを更新するuseEffect
  useEffect(() => {
    const checkLoginStatus = async () => {
      const wagmiConnected = isConnected && address;
      // web3auth.statusも確認する方がより確実
      const web3authConnected = web3auth?.status === 'connected' && (!!provider || !!user);

      if (wagmiConnected) {
        setIsLoggedIn(true);
        setDisplayAddress(address.slice(0, 6) + '...' + address.slice(-4));
      } else if (web3authConnected) {
        setIsLoggedIn(true);
        // Web3Auth接続済みの場合、アドレスを取得して表示
        // ローディング中に表示するアドレスを設定することも可能
        setDisplayAddress("読み込み中...");
        const socialAddress = await getWeb3AuthAddress();
        if (socialAddress) {
          setDisplayAddress(socialAddress.slice(0, 6) + '...' + socialAddress.slice(-4));
        } else {
          // アドレス取得失敗時の表示
          setDisplayAddress("アドレス取得失敗");
          // 必要であればログアウト処理やエラー表示を行う
          // setIsLoggedIn(false); // ログイン失敗とみなす場合
        }
      } else {
        setIsLoggedIn(false);
        setDisplayAddress("");
      }
    };

    checkLoginStatus();
    // 依存配列に web3auth, provider, user, getWeb3AuthAddress を追加
  }, [isConnected, address, web3auth, provider, user, getWeb3AuthAddress]);
  
  // Web3Authエラーメッセージをトーストで通知
  useEffect(() => {
    if (web3AuthError) {
      toast({
        title: "ログインエラー",
        description: web3AuthError,
        variant: "destructive",
      });
    }
  }, [web3AuthError, toast])

  // Web3Auth経由でソーシャルログインする処理
  const handleSocialLogin = async (providerId: string) => {
    try {
      setSocialConnecting(true);
      
      if (!web3auth) {
        toast({
          title: "エラー",
          description: "Web3Authの初期化が完了していません。後ほど再度お試しください。",
          variant: "destructive",
        });
        return;
      }
      
      // Web3Authでログイン
      const provider = await web3AuthLogin(providerId);
      
      if (!provider) {
        throw new Error("ログインに失敗しました");
      }
      
      // アドレスを取得
      const socialAddress = await getWeb3AuthAddress();
      
      // アドレス取得と表示はuseEffectに任せるため、ここでは成功通知とダイアログを閉じる処理のみ
      if (socialAddress) {
        setOpen(false); // ダイアログを閉じる
        toast({
          title: "ログイン成功",
          description: `${providerId} で正常にログインしました。アドレス情報を更新中です...`, // 少しメッセージ変更
          variant: "default",
        });
      } else if (provider) { // providerはあるがアドレス取得に失敗した場合
        // アドレス取得失敗のトーストを出すか、useEffect側で処理するか検討
        setOpen(false); // とりあえずダイアログは閉じる
        toast({
          title: "ログイン成功（アドレス取得失敗）",
          description: "ログインには成功しましたが、アドレスの取得に失敗しました。",
        });
      } else {
        throw new Error("アドレスの取得に失敗しました");
      }
    } catch (error: any) {
      console.error("ソーシャルログインエラー:", error);
      // エラーオブジェクトの詳細をコンソールに出力
      console.error("Error object:", error);
      // ユーザーがポップアップを閉じた場合のエラーメッセージを改善
      const errorMessage = error instanceof Error && error.message === "login popup has been closed by the user"
        ? "ログインポップアップが閉じられました。もう一度お試しください。"
        : error instanceof Error
          ? error.message
          : "ログインに失敗しました。";

      toast({
        title: "ログインエラー",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSocialConnecting(false);
    }
  };

  // 従来のウォレット接続処理
  const handleConnect = async (method: string, id?: string) => {
    try {
      if (method === "metamask") {
        connect({ connector: metaMask() })
      } else if (method === "walletconnect") {
        const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo";
        connect({ connector: walletConnect({ projectId: walletConnectProjectId }) })
      } else if (method === "injected") {
        connect({ connector: injected() })
      } else if (method === "social") {
        // ソーシャルログイン処理を実行
        await handleSocialLogin(id || "google");
        return;
      }
      setOpen(false)
    } catch (error) {
      console.error("Connection error:", error)
      toast({
        title: "接続エラー",
        description: "接続中にエラーが発生しました。別の方法をお試しいただくか、後ほど再度お試しください。",
        variant: "destructive",
      });
    }
  }

  // 切断処理 (asyncに変更し、両方の切断を試みる)
  const handleDisconnect = async () => {
    setIsLoggedIn(false); // UIを即時更新
    setDisplayAddress("");

    let web3AuthErrorOccurred = false;
    // Web3Authの切断
    if (web3auth && web3auth.status === 'connected') {
      try {
        await web3AuthLogout();
      } catch (error) {
        web3AuthErrorOccurred = true;
        console.error("Web3Auth logout error:", error);
        toast({ title: "ログアウトエラー", description: "Web3Authからのログアウトに失敗しました。", variant: "destructive" });
      }
    }

    // Wagmiの切断 (Web3Authのエラーに関わらず実行)
    if (isConnected) {
      disconnect();
    }
    
    // Web3Authのログアウトが成功した場合のみ成功トーストを表示（任意）
    if (!web3AuthErrorOccurred && (web3auth?.status === 'connected' || isConnected)) {
         toast({ title: "切断完了", description: "正常に切断されました。", variant: "default" });
    }
  }

  return (
    <>
      {!isLoggedIn ? ( // isConnected の代わりに isLoggedIn を使用
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
              <DialogDescription className="text-center text-sm text-slate-500">
                以下の方法でウォレットを接続してください
              </DialogDescription>
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
                      <Image src="/icons/metamask.svg" alt="MetaMask" width={32} height={32} style={{ width: '32px', height: '32px' }} className="rounded-full" />
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
                        src="/icons/walletconnect.svg"
                        alt="WalletConnect"
                        width={32}
                        height={32}
                        style={{ width: '32px', height: '32px' }}
                        className="rounded-full"
                      />
                      <span className="font-medium">WalletConnect</span>
                    </div>
                    <span className="text-xs text-slate-500">QRコード</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex justify-between items-center h-14 px-4 border-2 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                    onClick={() => handleConnect("injected")}
                  >
                    <div className="flex items-center gap-3">
                      <Image src="/icons/coinbase.svg" alt="Coinbase" width={32} height={32} style={{ width: '32px', height: '32px' }} className="rounded-full" />
                      <span className="font-medium">Coinbase Wallet</span>
                    </div>
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="social" className="space-y-4">
                {isWeb3AuthLoading ? (
                  <div className="flex flex-col items-center justify-center p-6">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
                    <p className="text-sm text-slate-500">Web3Auth を初期化中...</p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4">
                      {socialLoginProviders.map((provider) => (
                        <Button
                          key={provider.id}
                          variant="outline"
                          className="flex justify-between items-center h-14 px-4 border-2 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                          onClick={() => handleConnect("social", provider.id)}
                          disabled={socialConnecting}
                        >
                          <div className="flex items-center gap-3">
                            <Image
                              src={provider.icon || "/placeholder.svg"}
                              alt={provider.name}
                              width={24}
                              height={24}
                              className="rounded-full"
                            />
                            <span className="font-medium">
                              {provider.id === "email_passwordless" 
                                ? "メールでログイン" 
                                : `${provider.name}でログイン`}
                            </span>
                          </div>
                          {socialConnecting && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-4">
                      ソーシャルログインではスマートアカウントが自動的に作成されます
                    </p>
                  </>
                )}
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
            <span className="font-mono text-sm">{displayAddress}</span>
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