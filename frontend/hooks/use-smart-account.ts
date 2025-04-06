"use client";

import { useState, useEffect, useCallback } from 'react';
import { sepolia } from 'viem/chains';
import { useWeb3Auth } from './use-web3auth';
import { 
  createWeb3AuthSigner, 
  createLightSmartAccountClient,
  formatUserOperation,
  type UserOperationData
} from '@/app/lib/alchemy/account-kit-config';
import { useToast } from './use-toast';

// グローバルにデバッグモードを設定 (デフォルトはオフ)
const DEBUG_MODE = false;

// 開発者が必要な場合にデバッグモードを有効化する方法:
// localStorage.setItem('debug_logs', 'true') をコンソールから実行

// デバッグログ関数
const debugLog = (message: string, ...args: any[]) => {
  if (DEBUG_MODE) {
    console.log(message, ...args);
  }
};

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
  const [smartAccountClient, setSmartAccountClient] = useState<any>(null);
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
    // 使用可能な場合はグローバルに保存されたプロバイダーも使用
    let providerToUse = web3AuthProvider;
    if (!providerToUse && typeof window !== 'undefined' && (window as any).web3AuthLoginProvider) {
      providerToUse = (window as any).web3AuthLoginProvider;
      debugLog("グローバルに保存されたWeb3Authプロバイダーを使用します");
    }
    
    if (!isWeb3AuthInitialized && !providerToUse) {
      debugLog("Web3Authがまだ初期化されていないか、プロバイダーがありません");
      return;
    }

    debugLog("スマートアカウントを初期化中...");
    debugLog("使用するプロバイダー:", providerToUse ? "利用可能" : "利用不可");
    setIsLoading(true);
    setError(null);

    try {
      // Web3Authプロバイダーから署名者を作成
      const signer = await createWeb3AuthSigner(providerToUse);
      
      if (!signer) {
        throw new Error("署名者の作成に失敗しました");
      }
      
      debugLog("署名者が作成されました");
      
      // LightAccountクライアントを作成
      const accountClient = await createLightSmartAccountClient(signer, currentChainId);
      
      if (!accountClient) {
        throw new Error("スマートアカウントクライアントの作成に失敗しました");
      }
      
      // デバッグモードが有効な場合のみログを出力
      if (DEBUG_MODE) {
        console.log("LightSmartAccountクライアントが作成されました");
      }
      
      // アドレスを取得して設定
      const address = await accountClient.getAddress();
      
      // デバッグモードが有効な場合のみログを出力
      if (DEBUG_MODE) {
        console.log("スマートアカウントアドレス:", address);
      }
      
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

  // スマートアカウントの初期化状態を追跡
  const [wasInitialized, setWasInitialized] = useState<boolean>(false);

  // Web3Authプロバイダーが変更されたときにスマートアカウントを初期化
  useEffect(() => {
    // 既に初期化済みで、smartAccountClientが存在する場合は再度初期化しない
    if (wasInitialized && smartAccountClient) {
      return;
    }

    // グローバルに保存されたプロバイダーをチェック
    const hasGlobalProvider = typeof window !== 'undefined' && !!(window as any).web3AuthLoginProvider;
    
    if ((web3AuthProvider && isWeb3AuthInitialized) || hasGlobalProvider) {
      // 初期化フラグを立ててから初期化を実行
      setWasInitialized(true);
      initializeSmartAccount();
    }
  }, [web3AuthProvider, isWeb3AuthInitialized, initializeSmartAccount, smartAccountClient, wasInitialized]);

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
