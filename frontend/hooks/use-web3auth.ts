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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Web3Authの初期化
  useEffect(() => {
    const init = async () => {
      try {
        const web3authInstance = await getWeb3AuthProvider(sepolia.id);
        setWeb3auth(web3authInstance);
      } catch (err) {
        console.error("Failed to initialize Web3Auth:", err);
        setError("Failed to initialize social login");
      }
    };

    init();
  }, []);

  // ソーシャルログイン
  const login = async (loginProvider: string) => {
    if (!web3auth) {
      setError("Web3Auth not initialized");
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // loginProviderはgoogleまたはtwitter
      const provider = await web3auth.connectTo(WALLET_ADAPTERS.OPENLOGIN, {
        loginProvider,
      });

      // ユーザー情報を取得
      const userInfo = await web3auth.getUserInfo();
      setUser(userInfo);
      setProvider(provider);
      setIsLoading(false);
      return provider;
    } catch (err: any) {
      console.error("Error during login:", err);
      setError(err.message || "Failed to login");
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
    } catch (err) {
      console.error("Error during logout:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // アドレスの取得
  const getAddress = async () => {
    if (!provider) return null;

    try {
      // カスタムクライアントの作成
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: custom(provider),
      });

      // アカウントの取得
      const accounts = await publicClient.request({
        method: "eth_accounts",
      });

      return accounts[0] as `0x${string}` | null;
    } catch (err) {
      console.error("Error getting address:", err);
      return null;
    }
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
      });

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
        params: [message, address],
      });

      return signature;
    } catch (err) {
      console.error("Error signing message:", err);
      return null;
    }
  };

  return {
    web3auth,
    provider,
    user,
    isLoading,
    error,
    login,
    logout,
    getAddress,
    sendTransaction,
    signMessage,
  };
}
