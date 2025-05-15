"use client";

import { useState, useEffect } from 'react';
import { WALLET_ADAPTERS } from '@web3auth/base';
import { Web3AuthNoModal } from '@web3auth/no-modal';
import { getWeb3AuthProvider } from '@/app/lib/web3auth-config';
import { sepolia } from 'wagmi/chains';
import { createPublicClient, custom, fromHex } from 'viem';

export function useWeb3Auth() {
  const [web3auth, setWeb3auth] = useState<Web3AuthNoModal | null>(null);
  const [provider, setProvider] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // 初期化開始時にローディング開始
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false); // 初期化完了状態
  
  // Web3Authの初期化
  useEffect(() => {
    const init = async () => {
      try {
        // getWeb3AuthProvider は initializeWeb3Auth を呼び出し、内部で init() を実行する
        const web3authInstance = await getWeb3AuthProvider(sepolia.id);
        if (web3authInstance) {
          setWeb3auth(web3authInstance);
          setIsInitialized(true); // 初期化成功
          console.log("useWeb3Auth: Web3Auth initialized successfully.");
        } else {
          // getWeb3AuthProvider が null を返した場合 (initializeWeb3Auth でエラー)
          setError("Failed to initialize social login provider.");
          console.error("useWeb3Auth: getWeb3AuthProvider returned null.");
        }
      } catch (err) {
        // getWeb3AuthProvider 自体の予期せぬエラー
        console.error("useWeb3Auth: Unexpected error during initialization:", err);
        setError("Failed to initialize social login (unexpected error).");
      } finally {
        setIsLoading(false); // 初期化試行完了（成功・失敗問わず）
      }
    };

    init();
  }, []);

  // ソーシャルログイン
  const login = async (loginProvider: string, email?: string) => {
    
    // 初期化が完了していない、または web3auth インスタンスがない場合はエラー
    if (!isInitialized || !web3auth) {
      setError("Web3Auth is not initialized yet.");
      console.error("Login attempt before Web3Auth initialization is complete.");
      return null;
    }

    setIsLoading(true);
    setError(null);

    // actualProvider を try ブロックの外で宣言
    let actualProvider = loginProvider;

    try {
      // 先に完全にログアウトしてから新しいプロバイダーでログインする
      // これは違うverifierを使用する場合に必要
      if (web3auth.status === 'connected') {
        console.log("別のプロバイダーでログインするため、先にログアウトします");
        try {
          await web3auth.logout();
          setProvider(null);
          setUser(null);

          // ローカルストレージからアカウント情報を削除
          localStorage.removeItem('web3auth_account');
          console.log('新しいプロバイダーでログインするために状態をクリアしました');

          // 処理が確実に完了するよう少し待機
          await new Promise(resolve => setTimeout(resolve, 800));
        } catch (err) {
          console.error("ログアウト中にエラーが発生しました:", err);
          // エラーが発生しても続行、UI状態だけはクリア
          setProvider(null);
          setUser(null);
        }
      }

      console.log(`Attempting to login with provider: ${loginProvider}`);

      // ログインタイプをマッピング (actualProvider の更新)
      // プロバイダーIDのマッピング (configに合わせて email_passwordless を使う)
      if (loginProvider === 'email') {
        console.log('メールログインを検出しました - email_passwordlessを使用');
        actualProvider = 'email_passwordless'; // ここで更新
      }
      
      console.log(`ログインプロバイダー: ${actualProvider} で接続中...`);
      
      // loginProviderはgoogleまたはメール認証
      // ドキュメントに従って、email_passwordlessの場合は特別な処理が必要
      let options: any = { loginProvider: actualProvider };
      
      // email_passwordlessの場合はメールアドレスを渡す
      if (actualProvider === 'email_passwordless' && email) {
        options.extraLoginOptions = {
          login_hint: email.trim() // login_hint を使用
        };
        console.log('メールアドレスを設定しました:', email);
      }
      
      console.log('ログインオプション:', options);
      const provider = await web3auth.connectTo(WALLET_ADAPTERS.AUTH, options);

      console.log('Login successful');
      
      // ユーザー情報を取得
      const userInfo = await web3auth.getUserInfo();
      console.log('User info retrieved:', userInfo);
      setUser(userInfo);
      setProvider(provider);
      
      // スマートアカウントのアドレスを保存
      await saveSmartAccountAddress();
      
      setIsLoading(false);
      return provider;
    } catch (err: any) {
      console.error("Error during login:", err); // エラーオブジェクト全体を出力
      console.log('Error details:', JSON.stringify(err, null, 2)); // 詳細なエラー情報を出力

      // より詳細なエラーメッセージ
      // エラーメッセージの判定をより具体的に
      if (err.code === 5111 && err.message?.includes('Unsupported login type')) { // code も確認
        setError(`ログインタイプがサポートされていません。Web3Auth DashboardのVerifier設定を確認してください。`);
        console.error('詳細: ', err);
      } else if (err.code === 5113 && err.message?.includes('popup has been closed by the user')) { // code も確認
        // ユーザーがポップアップ/リダイレクトを閉じた場合 (redirectモードでも発生しうる)
        console.log('ユーザーがログインプロセスをキャンセルしました。');
        setError(null); // エラーメッセージは表示しない
      } else if (err.message?.includes('popup window blocker')) { // より具体的なメッセージ
        setError(`ログインポップアップがブロックされました。ブラウザの設定でポップアップを許可してください。`);
      } else if (actualProvider === 'email_passwordless' && err.message) { // スコープ修正により参照可能になった actualProvider を使用
        setError(`メールログインに失敗しました: ${err.message}`);
      } else if (err.message?.includes('Cross-Origin-Opener-Policy')) {
        // COOP/COEP関連の警告は一般的で、機能には影響しないため警告レベルで処理
        console.warn('Cross-Origin-Opener-Policy警告（Google OAuth認証の副作用）:', err.message);
        // この警告は無視して正常に処理を継続
        return null; // エラーとして扱わない
      } else {
        setError(err.message || "Failed to login");
      }
      
      setIsLoading(false);
      return null;
    }
  };

  // ログアウト
  const logout = async () => { 
    if (!web3auth) {
      return;
    }

    setIsLoading(true);
    try {
      await web3auth.logout();
      setProvider(null);
      setUser(null);
      
      // ローカルストレージからアカウント情報を削除
      localStorage.removeItem('web3auth_account');
      console.log('Web3Auth account info cleared from local storage');
    } catch (err) {
      console.error("Error during logout:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // アドレスの取得
  const getAddress = async () => {
    // provider ステートがなくても、web3auth が接続済みなら web3auth.provider を使う
    const currentProvider = provider || (web3auth?.status === 'connected' ? web3auth.provider : null);
    if (!currentProvider) return null;

    try {
      // カスタムクライアントの作成
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: custom(currentProvider),
      });
      // アカウントの取得
      const accounts = (await publicClient.request({
        method: "eth_accounts",
      } as any)) as string[];

      if (!accounts || accounts.length === 0) {
        return null;
      }
      // アドレスのデバッグログは開発モードのみ出力
      if (process.env.NODE_ENV === 'development' && localStorage.getItem('debug_logs') === 'true') {
        console.log("Web3Auth Smart Account Address:", accounts[0]);
      }
      return accounts[0] as `0x${string}`;
    } catch (err) {
      console.error("Error getting address:", err);
      return null;
    }
  };

  // 現在のスマートアカウントのアドレスをローカルストレージに保存
  const saveSmartAccountAddress = async () => {
    const address = await getAddress();
    if (address && user) {
      // ユーザー情報とアドレスを保存（プロバイダー情報も含める）
      const storageData = {
        address,
        email: user.email,
        name: user.name,
        provider: user.typeOfLogin,
        lastLogin: new Date().toISOString()
      };
      localStorage.setItem('web3auth_account', JSON.stringify(storageData));
      console.log('Smart account info saved:', storageData);
      return address;
    }
    return null;
  };

  // トランザクション送信
  const sendTransaction = async (params: any) => {
    if (!provider) return null;

    try {
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: custom(provider),
      });

      const hash = await publicClient.request({
        method: "eth_sendTransaction",
        params: [params],
      } as any) as string;

      return hash;
    } catch (err) {
      console.error("Error sending transaction:", err);
      return null;
    }
  };

  // 署名
  const signMessage = async (message: string) => {
    if (!provider) return null;

    try {
      const address = await getAddress();
      if (!address) return null;

      const publicClient = createPublicClient({
        chain: sepolia,
        transport: custom(provider),
      });

      const signature = await publicClient.request({
        method: "personal_sign",
        params: [address, message],
      } as any) as string;

      return signature;
    } catch (err) {
      console.error("Error signing message:", err);
      return null;
    }
  };

  // 保存されたスマートアカウント情報を取得
  const getSavedSmartAccountInfo = () => {
    try {
      const savedData = localStorage.getItem('web3auth_account');
      if (savedData) {
        return JSON.parse(savedData);
      }
      return null;
    } catch (err) {
      console.error('Error reading saved smart account info:', err);
      return null;
    }
  };

  return {
    web3auth,
    provider,
    user,
    isLoading,
    error,
    isInitialized, // 追加
    login,
    logout,
    getAddress,
    sendTransaction,
    signMessage,
    saveSmartAccountAddress,
    getSavedSmartAccountInfo,
  };
}
