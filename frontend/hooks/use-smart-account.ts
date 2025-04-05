"use client";

import { useState, useEffect, useCallback } from 'react';
import { sepolia } from 'viem/chains';
import { type AlchemySmartAccountClient } from '@alchemy/aa-alchemy';
import { useWeb3Auth } from './use-web3auth';
import { 
  createWeb3AuthSigner, 
  createLightSmartAccountClient,
  formatUserOperation,
  type UserOperationData
} from '@/app/lib/alchemy/account-kit-config';
import { useToast } from './use-toast';

export function useSmartAccount() {
  // Web3Authフックを使用
  const { 
    provider: web3AuthProvider, 
    user, 
    isInitialized: isWeb3AuthInitialized,
    isLoading: isWeb3AuthLoading,
    getAddress: getWeb3AuthAddress,
    saveSmartAccountAddress,
    getSavedSmartAccountInfo
  } = useWeb3Auth();

  // トースト通知を使用
  const { toast } = useToast();

  // スマートアカウントの状態
  const [smartAccountClient, setSmartAccountClient] = useState<AlchemySmartAccountClient | null>(null);
  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [userOps, setUserOps] = useState<UserOperationData[]>([]);
  const [isReadyToSendTx, setIsReadyToSendTx] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // デバッグログ用のチェーンID状態を追加
  const [currentChainId, setCurrentChainId] = useState<number>(sepolia.id);

  // スマートアカウントクライアントの初期化
  const initializeSmartAccount = useCallback(async () => {
    // Web3Auth初期化チェック
    if (!isWeb3AuthInitialized || !web3AuthProvider || isWeb3AuthLoading) {
      console.log("Web3Authがまだ初期化されていないか、プロバイダーがありません");
      return;
    }

    console.log("スマートアカウントを初期化中...");
    setIsLoading(true);
    setError(null);

    try {
      // Web3Authプロバイダーから署名者を作成
      const signer = await createWeb3AuthSigner(web3AuthProvider);
      
      if (!signer) {
        throw new Error("署名者の作成に失敗しました");
      }
      
      console.log("署名者が作成されました");
      
      // LightAccountクライアントを作成
      const accountClient = await createLightSmartAccountClient(signer, currentChainId);
      
      if (!accountClient) {
        throw new Error("スマートアカウントクライアントの作成に失敗しました");
      }
      
      console.log("LightSmartAccountクライアントが作成されました");
      
      // アドレスを取得して設定
      const address = await accountClient.getAddress();
      
      console.log("スマートアカウントアドレス:", address);
      
      // 状態を更新
      setSmartAccountClient(accountClient);
      setSmartAccountAddress(address);
      setIsReadyToSendTx(true);
      
      // デバッグ: スマートアカウント情報をグローバル変数に保存（開発用）
      if (typeof window !== 'undefined') {
        // @ts-ignore
        window.smartAccountClient = accountClient;
      }
      
      // 成功トースト
      toast({
        title: "スマートアカウント準備完了",
        description: `アドレス: ${address.slice(0, 6)}...${address.slice(-4)}`,
      });

      // Web3Auth連携: スマートアカウントアドレスをローカルストレージに保存
      if (saveSmartAccountAddress) {
        await saveSmartAccountAddress();
      }
      
      return accountClient;
    } catch (err) {
      console.error("スマートアカウントの初期化中にエラーが発生しました:", err);
      const errorMessage = err instanceof Error ? err.message : "スマートアカウントの初期化に失敗しました";
      setError(errorMessage);
      
      // エラートースト
      toast({
        title: "初期化エラー",
        description: errorMessage,
        variant: "destructive",
      });
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [web3AuthProvider, isWeb3AuthInitialized, isWeb3AuthLoading, toast, currentChainId, saveSmartAccountAddress]);

  // Web3Authプロバイダーが変更されたときにスマートアカウントを初期化
  useEffect(() => {
    if (web3AuthProvider && isWeb3AuthInitialized && !isWeb3AuthLoading) {
      initializeSmartAccount();
    }
  }, [web3AuthProvider, isWeb3AuthInitialized, isWeb3AuthLoading, initializeSmartAccount]);

  // チェーンを変更する関数
  const switchChain = async (chainId: number) => {
    // 現在のチェーンと同じ場合は何もしない
    if (chainId === currentChainId) {
      return;
    }

    setCurrentChainId(chainId);
    
    // Web3Authが初期化済みであれば、新しいチェーンでスマートアカウントを再初期化
    if (web3AuthProvider && isWeb3AuthInitialized && !isWeb3AuthLoading) {
      await initializeSmartAccount();
    }
  };

  // スマートアカウントでトランザクションを送信する関数
  const sendUserOperation = async (to: string, data: string, value: bigint = BigInt(0)) => {
    if (!smartAccountClient || !isReadyToSendTx) {
      setError("スマートアカウントが初期化されていません");
      throw new Error("スマートアカウントが初期化されていません");
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log(`トランザクション準備中: ${to}`);
      console.log(`データ: ${data}`);
      console.log(`値: ${value.toString()}`);

      // UserOperationオブジェクトを作成
      const userOpHash = await smartAccountClient.sendUserOperation({
        target: to as `0x${string}`,
        data: data as `0x${string}`,
        value,
      });

      console.log("UserOperation ハッシュ:", userOpHash);

      // トランザクションのレシートを待つ
      const txHash = await smartAccountClient.waitForUserOperationTransaction({
        hash: userOpHash,
      });

      console.log("トランザクションハッシュ:", txHash);

      // UserOperationを記録
      const userOpDetails = await smartAccountClient.getUserOperationByHash(userOpHash);
      
      if (userOpDetails) {
        const formattedUserOp = formatUserOperation(userOpDetails.userOperation);
        setUserOps(prev => [formattedUserOp, ...prev]);
      }

      // 成功トースト
      toast({
        title: "トランザクション成功",
        description: `Tx: ${txHash.slice(0, 10)}...`,
      });

      return { userOpHash, txHash };
    } catch (err) {
      console.error("トランザクション送信中にエラーが発生しました:", err);
      const errorMessage = err instanceof Error ? err.message : "トランザクション送信に失敗しました";
      setError(errorMessage);
      
      // エラートースト
      toast({
        title: "トランザクションエラー",
        description: errorMessage,
        variant: "destructive",
      });
      
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // UserOperationの履歴を取得する関数
  const getUserOperationHistory = async () => {
    if (!smartAccountClient || !smartAccountAddress) {
      return [];
    }

    try {
      // ここでAPIを使用してUserOperationの履歴を取得する実装を追加できます
      // 現在は、ローカルで記録したUserOpsを返します
      return userOps;
    } catch (err) {
      console.error("UserOperation履歴の取得中にエラーが発生しました:", err);
      return [];
    }
  };

  return {
    smartAccountClient,
    smartAccountAddress,
    isLoading,
    isReadyToSendTx,
    error,
    userOps,
    currentChainId,
    initializeSmartAccount,
    sendUserOperation,
    getUserOperationHistory,
    switchChain,
  };
}
