"use client"

// グローバルにデバッグモードを設定 (本番環境ではオフにするべき)
const DEBUG_MODE = false;

// デバッグログ関数
const debugLog = (message: string, ...args: any[]) => {
  if (DEBUG_MODE) {
    console.log(message, ...args);
  }
};

import { useState, useEffect, useRef } from "react";
import { Wallet, ChevronDown, Loader2, Mail, ShieldAlert, Shield, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { socialLoginProviders } from "@/app/lib/web3-config";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected, metaMask, walletConnect } from "wagmi/connectors";
import Image from "next/image";
import { useWeb3Auth } from "@/hooks/use-web3auth";
import { useSmartAccountContext } from "@/app/providers/smart-account-provider";
import { useToast } from "@/hooks/use-toast";

export function SmartWalletButton() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("wallet");
  const [open, setOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [displayAddress, setDisplayAddress] = useState("");
  const [socialConnecting, setSocialConnecting] = useState(false);
  const [smartAccountInfo, setSmartAccountInfo] = useState<{address: string, provider: string} | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  
  // Web3Authフックを使用
  const {
    web3auth,
    provider,
    user,
    isLoading: isWeb3AuthLoading,
    error: web3AuthError,
    isInitialized,
    login: web3AuthLogin,
    logout: web3AuthLogout,
    getAddress: getWeb3AuthAddress,
    getSavedSmartAccountInfo
  } = useWeb3Auth();
  
  // SmartAccountコンテキストを使用
  const {
    smartAccountClient,
    smartAccountAddress,
    isLoading: isSmartAccountLoading,
    isReadyToSendTx,
    error: smartAccountError,
    initializeSmartAccount
  } = useSmartAccountContext();

  // 接続状態と表示アドレスを更新するuseEffect
  useEffect(() => {
    let mounted = true;
    
    const checkLoginStatus = async () => {
      if (!mounted) return;
      
      // 保存されたスマートアカウント情報があるか確認
      const savedInfo = getSavedSmartAccountInfo ? getSavedSmartAccountInfo() : null;
      
      // 接続状態を確認
      const wagmiConnected = isConnected && address;
      const web3authConnected = web3auth?.status === 'connected' && (!!provider || !!user);
      const smartAccountConnected = smartAccountAddress && isReadyToSendTx;

      if (!mounted) return;

      if (smartAccountConnected) {
        // スマートアカウントが接続されている場合
        setIsLoggedIn(true);
        setDisplayAddress(smartAccountAddress.slice(0, 6) + '...' + smartAccountAddress.slice(-4));
        setSmartAccountInfo({
          address: smartAccountAddress,
          provider: user?.typeOfLogin || 'smart-account'
        });
      } else if (wagmiConnected) {
        // Wagmiで接続している場合
        setIsLoggedIn(true);
        setDisplayAddress(address.slice(0, 6) + '...' + address.slice(-4));
        setSmartAccountInfo(null);
      } else if (web3authConnected) {
        // Web3Authで接続している場合
        setIsLoggedIn(true);
        
        if (!displayAddress || displayAddress === "アドレス取得失敗") {
          setDisplayAddress("読み込み中...");
        }
        
        try {
          if (!mounted) return;

          const socialAddress = await getWeb3AuthAddress();
          
          if (!mounted) return;
          
          if (socialAddress) {
            const formattedAddress = socialAddress.slice(0, 6) + '...' + socialAddress.slice(-4);
            setDisplayAddress(formattedAddress);
            setSmartAccountInfo({
              address: socialAddress,
              provider: user?.typeOfLogin || 'web3auth'
            });
          } else if (savedInfo?.address) {
            const formattedAddress = savedInfo.address.slice(0, 6) + '...' + savedInfo.address.slice(-4);
            setDisplayAddress(formattedAddress);
            setSmartAccountInfo({
              address: savedInfo.address,
              provider: savedInfo.provider || 'unknown'
            });
          } else {
            setDisplayAddress("アドレス取得失敗");
            setSmartAccountInfo(null);
            console.error("Web3Auth: Failed to get smart account address");
          }
        } catch (e) {
          console.error("Error fetching Web3Auth address:", e);
          if (mounted) {
            setDisplayAddress("アドレス取得エラー");
          }
        }
      } else if (savedInfo?.address) {
        console.log("Using saved smart account info", savedInfo);
        
        setIsLoggedIn(true);
        const formattedAddress = savedInfo.address.slice(0, 6) + '...' + savedInfo.address.slice(-4);
        setDisplayAddress(formattedAddress);
        setSmartAccountInfo({
          address: savedInfo.address,
          provider: savedInfo.provider || 'unknown'
        });
      } else {
        setIsLoggedIn(false);
        setDisplayAddress("");
        setSmartAccountInfo(null);
      }
    };

    checkLoginStatus();
    
    return () => {
      mounted = false;
    };
  }, [isConnected, address, web3auth?.status, provider !== null, user !== null, smartAccountAddress, isReadyToSendTx]);
  
  // Web3Authエラーメッセージをトーストで通知
  const prevErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (web3AuthError && web3AuthError !== prevErrorRef.current) {
      prevErrorRef.current = web3AuthError;
      toast({
        title: "ログインエラー",
        description: web3AuthError,
        variant: "destructive",
      });
    }
  }, [web3AuthError, toast]);
  
  // SmartAccountエラーメッセージをトーストで通知
  const prevSmartAccountErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (smartAccountError && smartAccountError !== prevSmartAccountErrorRef.current) {
      prevSmartAccountErrorRef.current = smartAccountError;
      toast({
        title: "スマートアカウントエラー",
        description: smartAccountError,
        variant: "destructive",
      });
    }
  }, [smartAccountError, toast]);
  
  // アドレスをコピーする関数
  const copyAddressToClipboard = () => {
    const fullAddress = smartAccountInfo?.address || address;
    if (fullAddress) {
      navigator.clipboard.writeText(fullAddress)
        .then(() => {
          setIsCopied(true);
          toast({
            title: "コピー完了",
            description: "アドレスがクリップボードにコピーされました",
            variant: "default",
          });
          // 2秒後にコピー状態をリセット
          setTimeout(() => setIsCopied(false), 2000);
        })
        .catch((err) => {
          console.error("アドレスのコピーに失敗しました:", err);
          toast({
            title: "コピーエラー",
            description: "アドレスのコピーに失敗しました",
            variant: "destructive",
          });
        });
    }
  };

  // 切断処理
  const handleDisconnect = async () => {
    setIsLoggedIn(false);
    setDisplayAddress("");
    setSmartAccountInfo(null);

    let web3AuthErrorOccurred = false;
    
    if (web3auth && web3auth.status === 'connected') {
      try {
        await web3AuthLogout();
      } catch (error) {
        web3AuthErrorOccurred = true;
        console.error("Web3Auth logout error:", error);
        toast({ title: "ログアウトエラー", description: "Web3Authからのログアウトに失敗しました。", variant: "destructive" });
      }
    }

    if (isConnected) {
      disconnect();
    }
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('web3auth_account');
    }
    
    if (!web3AuthErrorOccurred && (web3auth?.status === 'connected' || isConnected)) {
         toast({ title: "切断完了", description: "正常に切断されました。", variant: "default" });
    }
    
    // スマートアカウントの状態をクリア（グローバル変数）
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.smartAccountClient = null;
      // @ts-ignore
      window.smartAccountInfo = null;
    }
  };

  // Web3Auth経由でソーシャルログインする処理
  const handleSocialLogin = async (providerId: string, email?: string) => {
    try {
      setSocialConnecting(true);
      setOpen(false);
      setEmailModalOpen(false);

      if (!web3auth) {
        toast({
          title: "エラー",
          description: "Web3Authの初期化が完了していません。後ほど再度お試しください。",
          variant: "destructive",
        });
        setSocialConnecting(false);
        return;
      }

      if (web3auth.status === 'connected') {
        try {
          console.log('セッションをクリアして新しいログインを試みます');
          await web3AuthLogout();
          setDisplayAddress("");
          setSmartAccountInfo(null);
          await new Promise(resolve => setTimeout(resolve, 800));
        } catch (error) {
          console.error('ログアウト中にエラーが発生しました:', error);
        }
      }

      const actualProviderId = providerId === 'email' ? 'email_passwordless' : providerId;

      console.log(`${actualProviderId} でログインを試行します...`);
      if (actualProviderId === 'email_passwordless') {
        console.log(`Email: ${email}`);
        if (!email || !email.includes('@')) {
           toast({
             title: "エラー",
             description: "有効なメールアドレスを入力してください。",
             variant: "destructive",
           });
           setSocialConnecting(false);
           return;
        }
      }

      const loginResultProvider = await web3AuthLogin(actualProviderId, email);
      
      if (!loginResultProvider) {
         console.error(`${actualProviderId} プロバイダーでのログインに失敗しました (provider is null)`);
         setSocialConnecting(false);
         return;
      }
      
      // ログイン済みプロバイダーの状態を確認
      debugLog("Web3Auth ログイン状態:", web3auth.status);
      debugLog("Web3Auth ユーザー情報:", user);
      debugLog("Web3Auth プロバイダー情報:", loginResultProvider);
      
      // いったん少し待機してWeb3Authの情報が反映されるようにする
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // グローバルにプロバイダーを保存
      if (typeof window !== 'undefined') {
        // @ts-ignore
        window.web3AuthLoginProvider = loginResultProvider;
      }
      
      // スマートアカウントを初期化
      console.log("Web3Auth ログイン成功、スマートアカウントを初期化します...");
      
      try {
        // スマートアカウントの初期化を複数回試行
        let smartAccount = null;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (!smartAccount && retryCount < maxRetries) {
          try {
            console.log(`スマートアカウント初期化試行 ${retryCount + 1}/${maxRetries}`);
            smartAccount = await initializeSmartAccount();
            if (smartAccount) break;
          } catch (retryError) {
            console.error(`初期化試行 ${retryCount + 1} 失敗:`, retryError);
            // 次の試行の前に少し待機
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          retryCount++;
        }
        
        if (smartAccount) {
          // @ts-ignore getAddressの引数に関する型定義の不一致を無視
          const smartAddress = await smartAccount.getAddress();
          console.log("スマートアカウント初期化成功:", smartAddress);
          
          setOpen(false);
          
          const event = new CustomEvent('wallet-status-change', {
            detail: { 
              isLoggedIn: true, 
              address: smartAddress,
              displayAddress: smartAddress.slice(0, 6) + '...' + smartAddress.slice(-4),
              smartAccountInfo: {
                address: smartAddress,
                provider: actualProviderId
              }
            }
          });
          window.dispatchEvent(event);
          
          toast({
            title: "スマートアカウント作成成功",
            description: `${actualProviderId === 'email_passwordless' ? 'メール' : actualProviderId} でスマートアカウントが作成されました`,
            variant: "default",
          });
        } else {
          console.error("スマートアカウントの初期化に失敗しました (最大試行回数を超過)");
          toast({
            title: "スマートアカウント初期化エラー",
            description: "ログインは成功しましたが、スマートアカウントの初期化に失敗しました。再度お試しください。",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("スマートアカウントの初期化中にエラーが発生しました:", error);
        toast({
          title: "スマートアカウント初期化エラー",
          description: "ログインは成功しましたが、スマートアカウントの初期化中にエラーが発生しました。",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("ソーシャルログインエラー:", error);
      console.error("Error object:", error);
      
      if (error instanceof Error && error.message.includes("popup has been closed by the user")) {
        console.log("ユーザーがログインポップアップを閉じました。");
      } else {
        const errorMessage = error instanceof Error
          ? error.message
          : "ログインに失敗しました。";

        toast({
          title: "ログインエラー",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setSocialConnecting(false);
    }
  };

  // 従来のウォレット接続処理
  const handleConnect = async (method: string, id?: string) => {
    try {
      if (method === "metamask") {
        connect({ connector: metaMask() });
      } else if (method === "walletconnect") {
        const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo";
        connect({ connector: walletConnect({ projectId: walletConnectProjectId }) });
      } else if (method === "injected") {
        connect({ connector: injected() });
      } else if (method === "social" && id) {
        if (id === 'email' || id === 'email_passwordless') {
          setEmailInput("");
          setEmailModalOpen(true);
          setOpen(false);
        } else {
          setOpen(false);
          handleSocialLogin(id).catch(error => {
              console.log("ソーシャルログイン呼び出しでエラーが発生しました。", error);
          });
        }
        return;
      }
      setOpen(false);
    } catch (error) {
      console.error("Connection error:", error);
      toast({
        title: "接続エラー",
        description: "接続中にエラーが発生しました。別の方法をお試しいただくか、後ほど再度お試しください。",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      {!isLoggedIn ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium py-2.5 px-5 rounded-full transition-all duration-300 hover:shadow-lg transform hover:-translate-y-0.5">
              <Shield className="w-5 h-5" />
              アカウント接続
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center text-2xl font-bold">アカウント接続</DialogTitle>
              <DialogDescription className="text-center text-sm text-slate-500">
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="social" className="w-full" onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="social">ソーシャルログイン</TabsTrigger>
                <TabsTrigger value="wallet">ウォレット</TabsTrigger>
              </TabsList>
              <TabsContent value="social" className="space-y-4">
                {isWeb3AuthLoading || !isInitialized ? (
                  <div className="flex flex-col items-center justify-center p-6">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
                    <p className="text-sm text-slate-500">
                      {isWeb3AuthLoading ? "Web3Auth を初期化中..." : "初期化待機中..."}
                    </p>
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
                          disabled={!isInitialized || socialConnecting}
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
                                ? "メールでアカウント作成"
                                : `${provider.name}でアカウント作成`}
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
              <TabsContent value="wallet" className="space-y-4">
                <div className="grid gap-4">
                  <Button
                    variant="outline"
                    className="flex justify-between items-center h-14 px-4 border-2 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                    onClick={() => handleConnect("metamask")}
                  >
                    <div className="flex items-center gap-3">
                      <Image src="/icons/metamask.svg" alt="MetaMask" width={32} height={32} style={{ width: '32px', height: '32px' }} className="rounded-full" />
                      <span className="font-medium">MetaMaskで接続</span>
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
                      <span className="font-medium">WalletConnectで接続</span>
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
                      <span className="font-medium">Coinbase Walletで接続</span>
                    </div>
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
            <div className="flex items-center space-x-2 mt-4">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
              <p className="text-xs text-slate-500">AlchemyAccountKit採用(ERC4337 Account Abstraction)</p>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <div className="relative group">
           <Button className="flex items-center gap-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium py-2.5 px-5 rounded-full transition-all duration-300">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600"></div>
            <span className="font-mono text-sm">{displayAddress || "Loading..."}</span>
            {smartAccountInfo && (
              <span className="ml-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                {smartAccountClient ? "Smart" : smartAccountInfo.provider === 'google' ? 'Google' : smartAccountInfo.provider === 'email_passwordless' ? 'メール' : 'ソーシャル'}
              </span>
            )}
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
              <button
                className="w-full text-left px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                onClick={copyAddressToClipboard}
              >
                {isCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                {isCopied ? "コピー済み" : "アドレスをコピー"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* メールアドレス入力用モーダル */}
      <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>メールアドレスでログイン</DialogTitle>
            <DialogDescription>
              ログインに使用するメールアドレスを入力してください。
              確認メールが送信されます。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email-input" className="text-right">
                メール
              </Label>
              <Input
                id="email-input"
                type="email"
                placeholder="your.email@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="col-span-3"
                autoComplete="email"
                aria-label="メールアドレス入力"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                if (emailInput && emailInput.includes('@')) {
                  handleSocialLogin('email', emailInput);
                } else {
                  toast({
                    title: "入力エラー",
                    description: "有効なメールアドレスを入力してください。",
                    variant: "destructive",
                  });
                }
              }}
              disabled={!isInitialized || socialConnecting || !emailInput || !emailInput.includes('@')}
            >
              {socialConnecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              メールでアカウント作成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
