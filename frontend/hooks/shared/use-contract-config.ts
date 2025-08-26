"use client";

import { useChainId, usePublicClient } from "wagmi";
import { contractConfig } from "@/app/lib/contract-config";

// contractConfigのキーの型を定義
export type SupportedChainId = keyof typeof contractConfig;

// サポートされているチェーンID
export const SUPPORTED_CHAIN_IDS = [11155111, 84532, 421614] as const;

export interface ContractConfigResult {
  chainId: number | null;
  contractAddress: string | null;
  erc20Address: string | null;
  publicClient: any;
  isValidChainId: boolean;
  networkConfig: typeof contractConfig[SupportedChainId] | null;
}

/**
 * コントラクト設定とチェーン情報を統一的に管理するフック
 * 複数のフックで重複していたチェーンID検証とアドレス解決を統合
 */
export function useContractConfig(): ContractConfigResult {
  const chainId = useChainId();
  
  // チェーンIDの検証
  const isValidChainId = chainId && SUPPORTED_CHAIN_IDS.includes(chainId as any);
  const currentChainId = isValidChainId ? chainId : null;
  
  // ネットワーク設定取得
  const networkConfig = currentChainId ? 
    contractConfig[currentChainId as SupportedChainId] || null : null;
  
  // コントラクトアドレス取得
  const contractAddress = networkConfig?.raffleProxy || null;
  const erc20Address = networkConfig?.erc20Address || null;
  
  // パブリッククライアント取得
  const publicClient = usePublicClient({ chainId: currentChainId || undefined });

  return {
    chainId: currentChainId,
    contractAddress,
    erc20Address,
    publicClient,
    isValidChainId: !!isValidChainId,
    networkConfig,
  };
}

/**
 * 特定のネットワーク情報を取得するヘルパー関数
 */
export function getNetworkInfo(chainId: number) {
  if (!SUPPORTED_CHAIN_IDS.includes(chainId as any)) {
    return null;
  }
  return contractConfig[chainId as SupportedChainId] || null;
}

/**
 * チェーンIDが有効かどうかを確認するヘルパー関数
 */
export function isValidChainId(chainId: number | undefined): chainId is SupportedChainId {
  return chainId !== undefined && SUPPORTED_CHAIN_IDS.includes(chainId as any);
}