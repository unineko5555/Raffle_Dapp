"use client";

import { createContext, useContext, ReactNode } from "react";
import { useSmartAccount } from "@/hooks/use-smart-account";
import { sepolia } from "viem/chains";
import { type AlchemySmartAccountClient } from "@alchemy/aa-alchemy";
import { type UserOperationData } from "@/app/lib/alchemy/account-kit-config";

// コンテキストの型定義
interface SmartAccountContextType {
  smartAccountClient: AlchemySmartAccountClient | null;
  smartAccountAddress: string | null;
  isLoading: boolean;
  isReadyToSendTx: boolean;
  error: string | null;
  userOps: UserOperationData[];
  currentChainId: number;
  initializeSmartAccount: () => Promise<AlchemySmartAccountClient | null>;
  sendUserOperation: (
    to: string,
    data: string,
    value?: bigint
  ) => Promise<{ userOpHash: string; txHash: string }>;
  getUserOperationHistory: () => Promise<UserOperationData[]>;
  switchChain: (chainId: number) => Promise<void>;
}

// デフォルト値を持つコンテキストを作成
const SmartAccountContext = createContext<SmartAccountContextType>({
  smartAccountClient: null,
  smartAccountAddress: null,
  isLoading: false,
  isReadyToSendTx: false,
  error: null,
  userOps: [],
  currentChainId: sepolia.id,
  initializeSmartAccount: async () => null,
  sendUserOperation: async () => ({ userOpHash: "", txHash: "" }),
  getUserOperationHistory: async () => [],
  switchChain: async () => {},
});

// プロバイダーコンポーネント
export function SmartAccountProvider({ children }: { children: ReactNode }) {
  // スマートアカウントフックを使用
  const smartAccount = useSmartAccount();

  return (
    <SmartAccountContext.Provider value={smartAccount}>
      {children}
    </SmartAccountContext.Provider>
  );
}

// コンテキストを使用するためのカスタムフック
export function useSmartAccountContext() {
  return useContext(SmartAccountContext);
}
