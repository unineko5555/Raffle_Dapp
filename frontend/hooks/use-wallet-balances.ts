"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useBalance, useChainId, useReadContract, useBlockNumber } from "wagmi";
import { formatUnits } from "viem";
import { contractConfig, ERC20ABI } from "@/app/lib/contract-config";
import { useSmartAccountContext } from "@/app/providers/smart-account-provider";

export function useWalletBalances() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { smartAccountAddress, isReadyToSendTx, currentChainId } = useSmartAccountContext();
  
  // 状態変数
  const [balances, setBalances] = useState({
    eth: "0",
    usdc: "0",
    loading: false,
    error: null as string | null
  });
  
  // アドレスの判定（EOAかスマートウォレットか）
  const activeAddress = isReadyToSendTx ? smartAccountAddress : address;
  const activeChainId = isReadyToSendTx ? currentChainId : chainId;
  
  // USDC契約アドレスの取得
  const usdcAddress = contractConfig[activeChainId as keyof typeof contractConfig]?.erc20Address || null;
  
  // Wagmiを使ったETH残高取得
  const { data: ethBalanceData, isLoading: isEthLoading } = useBalance(
    activeAddress ? {
      address: activeAddress as `0x${string}`,
      chainId: activeChainId
    } : undefined
  );
  
  // USDC残高の取得
  const { data: usdcBalanceData, isLoading: isUsdcLoading } = useReadContract(
    usdcAddress && activeAddress ? {
      address: usdcAddress as `0x${string}`,
      abi: ERC20ABI,
      functionName: "balanceOf",
      args: [activeAddress as `0x${string}`],
      chainId: activeChainId,
    } : { abi: ERC20ABI, functionName: "balanceOf" }
  );
  
  // ブロック更新時に残高を取得（オプション）
  const { data: blockNumber } = useBlockNumber({ 
    watch: true,
    chainId: activeChainId
  });
  
  // 手動で残高を更新する関数
  const refreshBalances = useCallback(async () => {
    if (!activeAddress) return;
    
    setBalances(prev => ({
      ...prev,
      loading: true,
      error: null
    }));
    
    // Wagmiは自動的に更新されるため、ここでは特に何もする必要はありません
    // 状態が更新されるのを待つために少し遅延を入れます
    setTimeout(() => {
      setBalances(prev => ({
        ...prev,
        loading: false
      }));
    }, 1000);
  }, [activeAddress]); // activeAddressのみを依存性に含める
  
  // 状態を更新
  useEffect(() => {
    if (!isConnected && !isReadyToSendTx) {
      setBalances({
        eth: "0",
        usdc: "0",
        loading: false,
        error: null
      });
      return;
    }
    
    setBalances(prev => ({
      ...prev,
      loading: isEthLoading || isUsdcLoading
    }));
    
    // ETH残高の更新
    if (ethBalanceData) {
      const formattedEth = ethBalanceData.formatted;
      setBalances(prev => ({
        ...prev,
        eth: formattedEth
      }));
    }
    
    // USDC残高の更新
    if (usdcBalanceData !== undefined) {
      try {
        const formattedUsdc = formatUnits(usdcBalanceData as bigint, 6); // USDCは6桁
        setBalances(prev => ({
          ...prev,
          usdc: formattedUsdc
        }));
      } catch (error) {
        console.error("USDC残高のフォーマットエラー:", error);
        setBalances(prev => ({
          ...prev,
          error: "残高の取得中にエラーが発生しました"
        }));
      }
    }
  }, [
    isConnected, 
    isReadyToSendTx, 
    activeAddress, 
    ethBalanceData, 
    usdcBalanceData, 
    isEthLoading, 
    isUsdcLoading
  ]);
  
  // チェーン切り替え時に残高をリセット
  useEffect(() => {
    if (activeAddress) {
      setBalances({
        eth: "0",
        usdc: "0",
        loading: true,
        error: null
      });
      
      setTimeout(() => {
        refreshBalances();
      }, 500);
    }
  }, [activeChainId, activeAddress]);
  
  // エラーハンドリング - エラー発生時の再試行
  useEffect(() => {
    if (balances.error && activeAddress) {
      const timer = setTimeout(() => {
        refreshBalances();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [balances.error, activeAddress, refreshBalances]);
  
  // 新しいブロックが生成されたときに残高を更新（オプション）
  useEffect(() => {
    // ブロック番号が更新された時だけ実行するためのチェック
    if (!blockNumber || !activeAddress || (!isConnected && !isReadyToSendTx)) {
      return;
    }
    
    // メモリーを使って前回のブロック番号を記憶
    const lastBlockRef = window.localStorage.getItem('lastBlockNumber');
    const lastBlock = lastBlockRef ? BigInt(lastBlockRef) : BigInt(0);
    
    if (typeof blockNumber === 'bigint') {
      // 10ブロックごとに更新
      const blockDiff = blockNumber - lastBlock;
      if (blockDiff >= BigInt(10)) {
        window.localStorage.setItem('lastBlockNumber', blockNumber.toString());
        refreshBalances();
      }
    }
  }, [blockNumber, isConnected, isReadyToSendTx, activeAddress, refreshBalances]);

  // ネットワーク名を取得
  const networkName = contractConfig[activeChainId as keyof typeof contractConfig]?.name || "Unknown Network";
  
  // ウォレットタイプ
  const walletType = isReadyToSendTx ? "Smart Wallet" : "EOA";
  
  return {
    balances,
    refreshBalances,
    activeAddress,
    activeChainId,
    networkName,
    walletType,
    isLoading: balances.loading
  };
}
