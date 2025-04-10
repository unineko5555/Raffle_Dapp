"use client"

import { useState, useEffect, useRef } from "react";
import { Wallet, ChevronDown, Loader2, Mail } from "lucide-react"; // Mail アイコンを追加
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter, // DialogFooter を追加
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input"; // Input を追加
import { Label } from "@/components/ui/label"; // Label を追加
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { socialLoginProviders } from "@/app/lib/web3-config";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected, metaMask, walletConnect } from "wagmi/connectors";
import Image from "next/image";
import { useWeb3Auth } from "@/hooks/use-web3auth";
import { useToast } from "@/components/ui/use-toast";
export function ConnectWalletButton() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("wallet")
  const [open, setOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [displayAddress, setDisplayAddress] = useState("");
  const [socialConnecting, setSocialConnecting] = useState(false); // 個別のログイン試行中のローディング
  const [smartAccountInfo, setSmartAccountInfo] = useState<{address: string, provider: string} | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  // Web3Authフックを使用
  const {
    web3auth,
    provider,
    user,
    isLoading: isWeb3AuthLoading, // これは初期化全体のローディング
    error: web3AuthError,
    isInitialized, // 初期化完了状態を追加
    login: web3AuthLogin,
    logout: web3AuthLogout,
    getAddress: getWeb3AuthAddress,
    getSavedSmartAccountInfo
  } = useWeb3Auth()

  // 接続状態と表示アドレスを更新するuseEffect
  useEffect(() => {
    let mounted = true; // マウント状態を追跡
    
    const checkLoginStatus = async () => {
      // マウントされていない場合はキャンセル
      if (!mounted) return;
      
      // 1. まず保存されたスマートアカウント情報があるか確認
      const savedInfo = getSavedSmartAccountInfo ? getSavedSmartAccountInfo() : null;
      
      // 2. 現在の接続状態を確認
      const wagmiConnected = isConnected && address;
      // web3auth.statusも確認する方がより確実
      const web3authConnected = web3auth?.status === 'connected' && (!!provider || !!user);

      // マウント状態を再確認
      if (!mounted) return;

      if (wagmiConnected) {
        // Wagmiで接続している場合
        setIsLoggedIn(true);
        setDisplayAddress(address.slice(0, 6) + '...' + address.slice(-4));
        setSmartAccountInfo(null); // Web3Auth情報をクリア
      } else if (web3authConnected) {
        // Web3Authで接続している場合
        setIsLoggedIn(true);
        
        // 初期表示は条件付きで設定（既に値がある場合はスキップ）
        if (!displayAddress || displayAddress === "アドレス取得失敗") {
          setDisplayAddress("読み込み中...");
        }
        
        try {
          // マウント状態を再確認
          if (!mounted) return;

          // アドレス取得を試行
          const socialAddress = await getWeb3AuthAddress();
          
          // 非同期処理後のマウント確認
          if (!mounted) return;
          
          if (socialAddress) {
            // アドレスを取得できた場合
            const formattedAddress = socialAddress.slice(0, 6) + '...' + socialAddress.slice(-4);
            setDisplayAddress(formattedAddress);
            setSmartAccountInfo({
              address: socialAddress,
              provider: user?.typeOfLogin || 'web3auth'
            });
            
            // グローバル変数に状態を保存（デバッグ用）
            if (typeof window !== 'undefined') {
              // @ts-ignore
              window.smartAccountInfo = {
                address: socialAddress,
                userInfo: user,
                provider: provider
              };
            }
          } else if (savedInfo?.address) {
            // 保存されたアドレス情報がある場合はそちらを使用
            const formattedAddress = savedInfo.address.slice(0, 6) + '...' + savedInfo.address.slice(-4);
            setDisplayAddress(formattedAddress);
            setSmartAccountInfo({
              address: savedInfo.address,
              provider: savedInfo.provider || 'unknown'
            });
          } else {
            // アドレス取得失敗時の表示
            setDisplayAddress("アドレス取得失敗");
            setSmartAccountInfo(null);
            console.error("Web3Auth: Failed to get smart account address");
          }
        } catch (e) {
          console.error("Error fetching Web3Auth address:", e);
          // マウント確認
          if (mounted) {
            setDisplayAddress("アドレス取得エラー");
          }
        }
      } else if (savedInfo?.address) {
        // Web3Authの状態は切断されているが、保存された情報がある場合
        console.log("Using saved smart account info", savedInfo);
        
        // 再接続を試みる（オプション）
        // 今回は自動再接続はせず、保存情報の表示のみ
        setIsLoggedIn(true);
        const formattedAddress = savedInfo.address.slice(0, 6) + '...' + savedInfo.address.slice(-4);
        setDisplayAddress(formattedAddress);
        setSmartAccountInfo({
          address: savedInfo.address,
          provider: savedInfo.provider || 'unknown'
        });
      } else {
        // どの状態でもない場合、ログアウト状態とする
        setIsLoggedIn(false);
        setDisplayAddress("");
        setSmartAccountInfo(null);
      }
    };

    checkLoginStatus();
    
    // クリーンアップ関数
    return () => {
      mounted = false; // マウント解除されたことを示す
    };
    // 依存配列から関数を除外し、必要なプリミティブ値のみに制限
  }, [isConnected, address, web3auth?.status, provider !== null, user !== null]);
  
  // Web3Authエラーメッセージをトーストで通知（前回のエラーを追跡して重複通知を防止）
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
  }, [web3AuthError, toast])
  
  // サイドバーのログインボタンとの連携（カスタムイベントを使用）
  useEffect(() => {
    // カスタムイベントリスナーを設定
    const handleLoginEvent = (event: CustomEvent) => {
      if (event.detail?.action === 'login' && event.detail?.provider) {
        // ソーシャルログイン処理を実行
        handleSocialLogin(event.detail.provider);
      } else if (event.detail?.action === 'logout') {
        // ログアウト処理
        handleDisconnect();
      }
    };

    // イベントリスナーを追加
    window.addEventListener('wallet-action' as any, handleLoginEvent as EventListener);

    // クリーンアップ
    return () => {
      window.removeEventListener('wallet-action' as any, handleLoginEvent as EventListener);
    };
  }, []); // 空の依存配列でコンポーネント初期化時のみ実行
  
  // 状態変更時にイベント発行
  useEffect(() => {
    // ログイン状態のみイベント発行
    if (isLoggedIn) {
      const event = new CustomEvent('wallet-status-change', {
        detail: { 
          isLoggedIn, 
          address: smartAccountInfo?.address || address, 
          displayAddress,
          smartAccountInfo
        }
      });
      window.dispatchEvent(event);
    }
  }, [isLoggedIn, displayAddress, smartAccountInfo, address]);  // handleDisconnectを依存配列から削除

  // 切断処理 (asyncに変更し、両方の切断を試みる)
  const handleDisconnect = async () => {
    setIsLoggedIn(false); // UIを即時更新
    setDisplayAddress("");
    setSmartAccountInfo(null); // スマートアカウント情報をクリア

    let web3AuthErrorOccurred = false;
    // Web3Authの切断
    if (web3auth && web3auth.status === 'connected') {
      try {
        await web3AuthLogout(); // ここでローカルストレージもクリアされる
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
    
    // ローカルストレージから手動でクリア（念のため）
    if (typeof window !== 'undefined') {
      localStorage.removeItem('web3auth_account');
    }
    
    // Web3Authのログアウトが成功した場合のみ成功トーストを表示（任意）
    if (!web3AuthErrorOccurred && (web3auth?.status === 'connected' || isConnected)) {
         toast({ title: "切断完了", description: "正常に切断されました。", variant: "default" });
    }
  }

  // Web3Auth経由でソーシャルログインする処理 (メールアドレスを引数で受け取るように変更)
  const handleSocialLogin = async (providerId: string, email?: string) => {
    // email_passwordless 以外の場合は email 引数は無視される
    try {
      setSocialConnecting(true);
      setOpen(false); // メインの接続ダイアログを閉じる
      setEmailModalOpen(false); // メール入力ダイアログも閉じる

      if (!web3auth) {
        toast({
          title: "エラー",
          description: "Web3Authの初期化が完了していません。後ほど再度お試しください。",
          variant: "destructive",
        });
        setSocialConnecting(false); // ローディング解除
        return;
      }

      // 既存のセッションと切り替えようとしているか確認
      if (web3auth.status === 'connected') {
        try {
          // 常に一度完全にログアウトしてからログインし直す
          console.log('セッションをクリアして新しいログインを試みます');
          await web3AuthLogout();
          setDisplayAddress("");
          setSmartAccountInfo(null);
          await new Promise(resolve => setTimeout(resolve, 800));
        } catch (error) {
          console.error('ログアウト中にエラーが発生しました:', error);
          // エラーが発生しても続行を試みる
        }
      }

      // プロバイダーのIDを正規化 (email は email_passwordless として扱う)
      const actualProviderId = providerId === 'email' ? 'email_passwordless' : providerId;

      console.log(`${actualProviderId} でログインを試行します...`);
      if (actualProviderId === 'email_passwordless') {
        console.log(`Email: ${email}`);
        if (!email || !email.includes('@')) { // 簡単なメール形式チェックを追加
           toast({
             title: "エラー",
             description: "有効なメールアドレスを入力してください。",
             variant: "destructive",
           });
           setSocialConnecting(false); // ローディング解除
           return; // メールがない、または形式が不正な場合は中断
        }
      }

      // Web3Authでログイン (email は email_passwordless の場合のみ渡される)
      const loginResultProvider = await web3AuthLogin(actualProviderId, email); // 変数名を変更
      
      // loginResultProvider のチェックを修正
      if (!loginResultProvider) {
         // web3AuthLogin内でエラーハンドリングとトースト表示が行われているはずなので、ここでは追加のエラーは投げない
         // 必要であれば、web3AuthError state を確認する
         console.error(`${actualProviderId} プロバイダーでのログインに失敗しました (provider is null)`);
         // エラー発生時はローディング解除
         setSocialConnecting(false);
         return; // ログイン失敗時はここで処理を中断
      }
      
      // アドレスを取得
      const socialAddress = await getWeb3AuthAddress();
      
      // アドレス取得と表示はuseEffectに任せるため、ここでは成功通知とダイアログを閉じる処理のみ
      if (socialAddress) {
        setOpen(false); // ダイアログを閉じる
        
        // サイドバーとのログイン状態共有のためにイベントを発行
        const event = new CustomEvent('wallet-status-change', {
          detail: { 
            isLoggedIn: true, 
            address: socialAddress,
            displayAddress: socialAddress.slice(0, 6) + '...' + socialAddress.slice(-4),
            smartAccountInfo: {
              address: socialAddress,
              provider: actualProviderId
            }
          }
        });
        window.dispatchEvent(event);
        
        toast({
          title: "ログイン成功",
          description: `${actualProviderId === 'email_passwordless' ? 'メール' : actualProviderId} で正常にログインしました。`,
          variant: "default",
        });
      } else if (loginResultProvider) { // providerはあるがアドレス取得に失敗した場合
        // アドレス取得失敗のトーストは useEffect 側で web3AuthError を監視して出す方が一貫性があるかもしれない
        setOpen(false); // とりあえずダイアログは閉じる
        // ログイン自体は成功したがアドレス取得に失敗した旨を伝える（任意）
        // toast({
        //   title: "ログイン成功（アドレス取得エラー）",
        //   description: "ログインには成功しましたが、アカウントアドレスの取得に失敗しました。",
        //   variant: "warning",
        // });
      } else {
        throw new Error("アドレスの取得に失敗しました");
      }
    } catch (error: any) {
      console.error("ソーシャルログインエラー:", error);
      // エラーオブジェクトの詳細をコンソールに出力
      console.error("Error object:", error);
      // ユーザーがポップアップを閉じた場合は通知せず静かに失敗
      if (error instanceof Error && error.message.includes("popup has been closed by the user")) {
        console.log("ユーザーがログインポップアップを閉じました。");
      } else {
        // その他のエラーはトースト通知
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
        connect({ connector: metaMask() })
      } else if (method === "walletconnect") {
        const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo";
        connect({ connector: walletConnect({ projectId: walletConnectProjectId }) })
      } else if (method === "injected") {
        connect({ connector: injected() })
      } else if (method === "social" && id) { // id が存在することも確認
        // ソーシャルログイン処理
        if (id === 'email' || id === 'email_passwordless') { // email_passwordless も考慮
          // メールログインの場合は、メール入力モーダルを開く
          setEmailInput(""); // 入力フィールドをクリア
          setEmailModalOpen(true);
          setOpen(false); // メインダイアログは閉じる
          // ここでは handleSocialLogin は呼ばない。モーダル側で呼ぶ。
        } else {
          // Googleなど他のソーシャルログイン
          setOpen(false); // メインダイアログを閉じる
          // 非同期処理だが、ここでは待たずにUIを閉じる
          handleSocialLogin(id).catch(error => {
              // エラーハンドリングは handleSocialLogin 内で行う
              console.log("ソーシャルログイン呼び出しでエラーが発生しました。", error);
          });
        }
        // social login の場合はここで return しないと setOpen(false) が再度呼ばれる
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
                {/* isWeb3AuthLoading または !isInitialized の場合に初期化中表示 */}
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
                          // 初期化未完了 or 個別ログイン試行中は無効化
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
                              {/* configに合わせて email_password を表示 */}
                              {provider.id === "email_password"
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
        // ログイン後の表示 (既存のコードを維持)
        <div className="relative group">
           <Button className="flex items-center gap-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium py-2.5 px-5 rounded-full transition-all duration-300">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600"></div>
            <span className="font-mono text-sm">{displayAddress}</span>
            {smartAccountInfo && (
              <span className="ml-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                {smartAccountInfo.provider === 'google' ? 'Google' : smartAccountInfo.provider === 'email_passwordless' ? 'メール' : 'ソーシャル'}
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
                // メール形式の簡易チェック
                if (emailInput && emailInput.includes('@')) {
                  handleSocialLogin('email', emailInput); // ここで email を渡す
                } else {
                  toast({
                    title: "入力エラー",
                    description: "有効なメールアドレスを入力してください。",
                    variant: "destructive",
                  });
                }
              }}
              // 初期化未完了 or 個別ログイン試行中 or メール入力不正時は無効化
              disabled={!isInitialized || socialConnecting || !emailInput || !emailInput.includes('@')}
            >
              {socialConnecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              メールでログイン
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}