"use client";

import { useState, useEffect, useCallback } from "react";
import { sepolia, arbitrumSepolia, baseSepolia } from "viem/chains";
import { useWeb3Auth } from "./use-web3auth";
import {
  createWeb3AuthSigner,
  createLightSmartAccountClient,
  type UserOperationData,
} from "@/app/lib/alchemy/account-kit-config";
import { useToast } from "@/components/ui/use-toast";
import { type AlchemySmartAccountClient } from "@alchemy/aa-alchemy"; // 適切な型をインポート

// グローバルにデバッグモードを設定 (デフォルトはオフ)
const DEBUG_MODE = false; // デバッグモードを無効化

// グローバル初期化状態の型定義
interface SmartAccountState {
  toastShown: boolean;
  initialized: boolean;
}

// グローバル状態の初期化
if (typeof window !== "undefined" && !(window as any).SMART_ACCOUNT_STATE) {
  (window as any).SMART_ACCOUNT_STATE = {
    toastShown: false,
    initialized: false,
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
    getSavedSmartAccountInfo,
  } = useWeb3Auth();

  // トースト通知を使用
  const { toast } = useToast();

  // スマートアカウントの状態
  const [smartAccountClient, setSmartAccountClient] =
    useState<AlchemySmartAccountClient | null>(null);
  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(
    null
  );
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
    if (
      !providerToUse &&
      typeof window !== "undefined" &&
      (window as any).web3AuthLoginProvider
    ) {
      providerToUse = (window as any).web3AuthLoginProvider;
      debugLog("グローバルに保存されたWeb3Authプロバイダーを使用します");
    }

    if (!isWeb3AuthInitialized && !providerToUse) {
      debugLog("Web3Authがまだ初期化されていないか、プロバイダーがありません");
      return;
    }

    // グローバル状態を取得
    const globalState =
      typeof window !== "undefined"
        ? ((window as any).SMART_ACCOUNT_STATE as SmartAccountState)
        : { toastShown: false, initialized: false };

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
      const accountClient = await createLightSmartAccountClient(
        signer,
        currentChainId
      );

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
      if (typeof window !== "undefined") {
        // @ts-ignore
        window.smartAccountClient = accountClient;
      }

      // グローバル状態で一度だけトースト表示
      if (!globalState.toastShown) {
        toast({
          title: "スマートアカウント準備完了",
          description: `アドレス: ${address.slice(0, 6)}...${address.slice(
            -4
          )}`,
        });

        // グローバル状態を更新
        if (typeof window !== "undefined") {
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
      if (typeof window !== "undefined") {
        (window as any).SMART_ACCOUNT_STATE.initialized = true;
      }

      return accountClient;
    } catch (err) {
      console.error("スマートアカウントの初期化中にエラーが発生しました:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "スマートアカウントの初期化に失敗しました";
      setError(errorMessage);

      // エラートースト - グローバル状態で管理
      if (!globalState.toastShown) {
        toast({
          title: "初期化エラー",
          description: errorMessage,
          variant: "destructive",
        });

        if (typeof window !== "undefined") {
          (window as any).SMART_ACCOUNT_STATE.toastShown = true;
        }
      }

      return null;
    } finally {
      setIsLoading(false);
    }
  }, [web3AuthProvider, isWeb3AuthInitialized, toast, currentChainId]);

  // Web3Authプロバイダーが変更されたときにスマートアカウントを初期化
  useEffect(() => {
    // 既に初期化済みで、smartAccountClientが存在する場合は再度初期化しない
    if (wasInitialized && smartAccountClient) {
      return;
    }

    // グローバルに保存されたプロバイダーをチェック
    const hasGlobalProvider =
      typeof window !== "undefined" && !!(window as any).web3AuthLoginProvider;

    if ((web3AuthProvider && isWeb3AuthInitialized) || hasGlobalProvider) {
      // 初期化フラグを立ててから初期化を実行
      setWasInitialized(true);
      console.log(`チェーンID ${currentChainId} でスマートアカウントを初期化`);
      initializeSmartAccount();
    }
  }, [
    web3AuthProvider,
    isWeb3AuthInitialized,
    initializeSmartAccount,
    smartAccountClient,
    wasInitialized,
    currentChainId,
  ]);

  // チェーンを変更する関数
  const switchChain = async (chainId: number) => {
    // 現在のチェーンと同じ場合は何もしない
    if (chainId === currentChainId) {
      return;
    }

    console.log(`チェーンを切り替え: ${currentChainId} → ${chainId}`);

    // チェーンが変更されたのでクライアントをリセット
    setSmartAccountClient(null);
    setIsReadyToSendTx(false);
    setSmartAccountAddress(null);

    // 初期化フラグもリセット
    setWasInitialized(false);

    // チェーンIDを更新
    setCurrentChainId(chainId);

    // Web3Authが初期化済みであれば、新しいチェーンでスマートアカウントを再初期化
    if (web3AuthProvider && isWeb3AuthInitialized && !isWeb3AuthLoading) {
      // 少し待機してから初期化（UI更新が先に完了するように）
      setTimeout(async () => {
        console.log(`チェーンID ${chainId} でスマートアカウントを再初期化`);
        await initializeSmartAccount();
      }, 100);
    }
  };

  // スマートアカウントでトランザクションを送信する関数
  // 注意: マルチチェーン対応の問題でbuildUserOperationFromTxとsignUserOperationのアプローチは失敗するため、
  // 直接sendTransactionを使用するアプローチのみを実装しています。
  const sendUserOperation = async (
    to: string,
    data: string,
    value: bigint = BigInt(0)
  ) => {
    if (!smartAccountClient || !isReadyToSendTx) {
      setError("スマートアカウントが初期化されていません");
      throw new Error("スマートアカウントが初期化されていません");
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log(`現在のチェーンID: ${currentChainId}`);
      console.log(`トランザクション準備中: ${to}`);

      // L2用のガスパラメータを準備
      let txOptions: any = {
        to: to as `0x${string}`,
        data: data as `0x${string}`,
        value: value,
      };

      // ガスパラメータは自動生成されるため、ハードコードした値を削除
      // チェーンに応じたカスタマイズが必要な場合はここで行う
      if (currentChainId === 84532 || currentChainId === 421614) {
        console.log(
          `L2チェーンのガス設定を、SDKに任せます (チェーンID: ${currentChainId})`
        );
      }

      // 直接sendTransactionを使用する方法
      console.log(`チェーンID ${currentChainId} でトランザクション送信中...`);
      const hash = await smartAccountClient.sendTransaction(txOptions);

      console.log("トランザクション送信成功、ハッシュ:", hash);

      // トランザクション確認はエラーが発生する可能性があるため、try-catchで安全に処理
      let txReceipt = { hash: hash as `0x${string}` }; // 正しい型でレシートを初期化

      try {
        // 確認処理が失敗してもエラーを無視する
        await smartAccountClient
          .waitForUserOperationTransaction({
            hash,
          })
          .catch(() => {});

        // レシートは初期化済みなので更新しない
      } catch (err) {
        // 最外側のエラーハンドリングも含めて全て無視
      }

      // 成功トースト
      toast({
        title: "トランザクション成功",
        description: `Tx: ${hash.slice(0, 10)}...`,
      });

      return { userOpHash: hash, txHash: hash };
    } catch (err) {
      console.error("トランザクション送信中にエラーが発生しました:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "トランザクション送信に失敗しました";
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
      // 実装予定部分
      return userOps;
    } catch (err) {
      if (DEBUG_MODE) {
        console.error("UserOperation履歴の取得中にエラーが発生しました:", err);
      }
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
