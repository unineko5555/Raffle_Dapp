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
import { useToast } from '@/components/ui/use-toast';

// グローバルにデバッグモードを設定 (デフォルトはオフ)
const DEBUG_MODE = true; // 今回はデバッグモードを有効にする

// グローバル初期化状態の型定義
interface SmartAccountState {
  toastShown: boolean;
  initialized: boolean;
}

// グローバル状態の初期化
if (typeof window !== 'undefined' && !(window as any).SMART_ACCOUNT_STATE) {
  (window as any).SMART_ACCOUNT_STATE = {
    toastShown: false,
    initialized: false
  };
}

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

  // スマートアカウントの初期化状態を追跡
  const [wasInitialized, setWasInitialized] = useState<boolean>(false);
  // トーストが表示済みかどうかを追跡
  const [toastShown, setToastShown] = useState<boolean>(false);

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

    // グローバル状態を取得
    const globalState = typeof window !== 'undefined' ? 
      (window as any).SMART_ACCOUNT_STATE as SmartAccountState : 
      { toastShown: false, initialized: false };

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
      
      // グローバル状態で一度だけトースト表示
      if (!globalState.toastShown) {
        toast({
          title: "スマートアカウント準備完了",
          description: `アドレス: ${address.slice(0, 6)}...${address.slice(-4)}`,
        });
        
        // グローバル状態を更新
        if (typeof window !== 'undefined') {
          (window as any).SMART_ACCOUNT_STATE.toastShown = true;
        }
        
        // ローカル状態も更新
        setToastShown(true);
      }

      // Web3Auth連携: スマートアカウントアドレスをローカルストレージに保存
      if (saveSmartAccountAddress) {
        await saveSmartAccountAddress();
      }
      
      // グローバル初期化状態を更新
      if (typeof window !== 'undefined') {
        (window as any).SMART_ACCOUNT_STATE.initialized = true;
      }
      
      return accountClient;
    } catch (err) {
      console.error("スマートアカウントの初期化中にエラーが発生しました:", err);
      const errorMessage = err instanceof Error ? err.message : "スマートアカウントの初期化に失敗しました";
      setError(errorMessage);
      
      // エラートースト - グローバル状態で管理
      if (!globalState.toastShown) {
        toast({
          title: "初期化エラー",
          description: errorMessage,
          variant: "destructive",
        });
        
        if (typeof window !== 'undefined') {
          (window as any).SMART_ACCOUNT_STATE.toastShown = true;
        }
      }
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [web3AuthProvider, isWeb3AuthInitialized, isWeb3AuthLoading, toast, currentChainId, saveSmartAccountAddress]);

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

      // 新アプローチ: buildUserOperationFromTxとsendRawUserOperationを使用
      console.log("シンプルなトランザクションを構築してみます");
      
      // トランザクションデータを作成
      const txData = {
        to: to as `0x${string}`,
        data: data as `0x${string}`,
        value: value
      };

      console.log("トランザクションデータ:", txData);
      
      try {
        console.log("buildUserOperationFromTxを使用してUserOperationを構築中...");
        
        // まずUserOperationを構築
        const userOp = await smartAccountClient.buildUserOperationFromTx({
          to: to as `0x${string}`,
          data: data as `0x${string}`,
          value: value
        });
        
        console.log("構築されたUserOperation:", userOp);
        
        // 署名付きUserOperationを作成
        console.log("署名前のUserOperationの詳細を確認:", JSON.stringify(userOp, null, 2));
        
        // もしuserOpにundefinedやnull値がある場合は安全に処理
        // userOp自体とsignUserOperationの互換性を確保
        const cleanedUserOp = {};
        Object.entries(userOp).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            // bigint値を文字列に変換
            if (typeof value === 'bigint') {
              cleanedUserOp[key] = value.toString();
            } else {
              cleanedUserOp[key] = value;
            }
          }
        });
        
        console.log("クリーニング後のUserOperation:", cleanedUserOp);
        
        // 署名にはクリーニングしたオブジェクトを使用
        const signedUserOp = await smartAccountClient.signUserOperation(cleanedUserOp);
        console.log("署名付きUserOperation:", signedUserOp);
        
        // 署名付きUserOperationを送信
        const hash = await smartAccountClient.sendRawUserOperation(signedUserOp);
        console.log("UserOperation送信成功、ハッシュ:", hash);
        
        // UserOperationが確認されるのを待つ
        try {
          const receipt = await smartAccountClient.waitForUserOperationTransaction({
            hash,
          });
          
          console.log("UserOperation確認:", receipt);
        } catch (waitError) {
          console.warn("トランザクション確認中にエラーが発生しましたが、処理は進行中かもしれません:", waitError);
          // トランザクションを探すための情報を追加
          console.log("トランザクションハッシュをエクスプローラーで確認してください:", hash);
          
          // 後でトランザクションの確認が必要な場合は、ここでポーリング機構や別の確認方法を実装することも可能
        }
        
        // 成功トースト
        toast({
          title: "トランザクション成功",
          description: `Tx: ${hash.slice(0, 10)}...`,
        });
        
        return { userOpHash: hash, txHash: hash };
      } catch (error) {
        console.error("UserOperation送信エラー:", error);
        
        // 代替アプローチ: sendTransactionを試す
        try {
          console.log("代替アプローチ: sendTransactionを試みます...");
          const hash = await smartAccountClient.sendTransaction({
            to: to as `0x${string}`,
            data: data as `0x${string}`,
            value: value
          });
          
          console.log("トランザクション送信成功、ハッシュ:", hash);
          
          // トランザクションが確認されるのを待つ
          try {
            const receipt = await smartAccountClient.waitForUserOperationTransaction({
              hash,
            });
            
            console.log("トランザクション確認:", receipt);
          } catch (waitError) {
            console.warn("トランザクション確認中にエラーが発生しましたが、処理は進行中かもしれません:", waitError);
            console.log("トランザクションハッシュをエクスプローラーで確認してください:", hash);
          }
          
          // 成功トースト
          toast({
            title: "トランザクション成功",
            description: `Tx: ${hash.slice(0, 10)}...`,
          });
          
          return { userOpHash: hash, txHash: hash };
        } catch (txError) {
          console.error("sendTransaction エラー:", txError);
          // エラーログを詳細化
          if (error instanceof Error && error.message.includes("Cannot convert undefined or null to object")) {
            console.warn("オブジェクトのキー取得エラー。Alchemy SDKは間違った形式のオブジェクトを受け取った可能性があります。");
          }
          
          // 実際のトランザクションハッシュをエクスプローラーで確認できるようお知らせ
          console.log("トランザクションは送信されましたが、確認に失敗しました。直接エクスプローラーで確認してください。");
          
          // エラーを投げる
          throw new Error(`トランザクション準備エラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
        }
      }
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
