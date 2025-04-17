"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useChainId, usePublicClient, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { contractConfig, ERC20ABI } from "@/app/lib/contract-config";
import { useToast } from "@/components/ui/use-toast";
import { useSmartAccountContext } from "@/app/providers/smart-account-provider";

// ブリッジコントラクトのABI
export const BridgeABI = [
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "destinationChainSelector",
        "type": "uint64"
      },
      {
        "internalType": "address",
        "name": "receiver",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "autoEnterRaffle",
        "type": "bool"
      }
    ],
    "name": "bridgeTokens",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "destinationChainSelector",
        "type": "uint64"
      },
      {
        "internalType": "address",
        "name": "receiver",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "autoEnterRaffle",
        "type": "bool"
      }
    ],
    "name": "estimateFee",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "fee",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getPoolBalance",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getSupportedChainSelectors",
    "outputs": [
      {
        "internalType": "uint64[]",
        "name": "",
        "type": "uint64[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint64",
        "name": "chainSelector",
        "type": "uint64"
      }
    ],
    "name": "getDestinationChainInfo",
    "outputs": [
      {
        "internalType": "bool",
        "name": "supported",
        "type": "bool"
      },
      {
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "internalType": "address",
        "name": "bridgeContract",
        "type": "address"
      },
      {
        "internalType": "bool",
        "name": "poolLow",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// チェーンIDとCCIPセレクタのマッピング
const chainSelectors: Record<number, bigint> = {
  11155111: 16015286601757825753n, // Sepolia
  84532: 15971525489660198786n,    // Base Sepolia
  421614: 3478487238524512106n,    // Arbitrum Sepolia
};

// ブリッジコントラクトアドレス - 実際のデプロイ後に更新が必要
const bridgeAddresses: Record<number, string> = {
  11155111: "0x0000000000000000000000000000000000000000", // Sepolia
  84532: "0x0000000000000000000000000000000000000000",    // Base Sepolia
  421614: "0x0000000000000000000000000000000000000000",   // Arbitrum Sepolia
};

// チェーン名のマッピング
const chainNames: Record<number, string> = {
  11155111: "Sepolia",
  84532: "Base Sepolia",
  421614: "Arbitrum Sepolia",
};

export type BridgeTransaction = {
  txHash: string;
  timestamp: number;
  sourceChain: number;
  destinationChain: number;
  amount: string;
  status: 'pending' | 'success' | 'failed';
  autoEnterRaffle: boolean;
};

export type DestinationChainInfo = {
  chainId: number;
  name: string;
  ccipSelector: bigint;
  supported: boolean;
  bridgeContract: string;
  poolLow: boolean;
};

export function useTokenBridge() {
  const { address, isConnected } = useAccount();
  const currentChainId = useChainId();
  const publicClient = usePublicClient();
  const { toast } = useToast();
  const { smartAccountAddress, isReadyToSendTx } = useSmartAccountContext();
  
  // Active address - EOA or Smart Wallet
  const activeAddress = isReadyToSendTx ? smartAccountAddress : address;
  
  // State variables
  const [isLoading, setIsLoading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [estimatedFee, setEstimatedFee] = useState<bigint | null>(null);
  const [poolBalance, setPoolBalance] = useState<string>("0");
  const [allowance, setAllowance] = useState<bigint>(BigInt(0));
  const [transactions, setTransactions] = useState<BridgeTransaction[]>([]);
  const [destinationChains, setDestinationChains] = useState<DestinationChainInfo[]>([]);
  
  // Write contract hooks
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();
  const { data: txHash, isPending: isTxPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: currentChainId,
  });
  
  // Get USDC balance
  const { data: usdcBalance } = useReadContract({
    address: contractConfig[currentChainId as keyof typeof contractConfig]?.erc20Address as `0x${string}`,
    abi: ERC20ABI,
    functionName: "balanceOf",
    args: [activeAddress as `0x${string}`],
    enabled: !!activeAddress,
  });
  
  // Load bridge data
  const fetchBridgeData = useCallback(async () => {
    if (!activeAddress || !publicClient) return;
    
    try {
      // 現在のチェーンのブリッジコントラクトアドレス
      const bridgeAddress = bridgeAddresses[currentChainId] as `0x${string}`;
      if (!bridgeAddress || bridgeAddress === "0x0000000000000000000000000000000000000000") {
        console.warn(`ブリッジコントラクトアドレスが設定されていません: チェーンID ${currentChainId}`);
        return;
      }
      
      // USDC addressを取得
      const usdcAddress = contractConfig[currentChainId as keyof typeof contractConfig]?.erc20Address as `0x${string}`;
      if (!usdcAddress) {
        console.warn(`USDCアドレスが見つかりません: チェーンID ${currentChainId}`);
        return;
      }
      
      // プール残高を取得
      const poolBalanceResult = await publicClient.readContract({
        address: bridgeAddress,
        abi: BridgeABI,
        functionName: "getPoolBalance",
      });
      
      // USDCのデシマルを取得（デフォルトは6）
      let usdcDecimals = 6;
      try {
        const decimalsResult = await publicClient.readContract({
          address: usdcAddress,
          abi: ERC20ABI,
          functionName: "decimals",
        });
        usdcDecimals = Number(decimalsResult);
      } catch (error) {
        console.warn("USDCデシマル取得エラー:", error);
      }
      
      // プール残高をフォーマット
      const formattedPoolBalance = formatUnits(poolBalanceResult as bigint, usdcDecimals);
      setPoolBalance(formattedPoolBalance);
      
      // アローワンスを取得
      const allowanceResult = await publicClient.readContract({
        address: usdcAddress,
        abi: ERC20ABI,
        functionName: "allowance",
        args: [activeAddress as `0x${string}`, bridgeAddress],
      });
      
      setAllowance(allowanceResult as bigint);
      
      // 宛先チェーン情報を取得
      const supportedSelectorsResult = await publicClient.readContract({
        address: bridgeAddress,
        abi: BridgeABI,
        functionName: "getSupportedChainSelectors",
      });
      
      const supportedSelectors = supportedSelectorsResult as bigint[];
      const destinationChainsInfo: DestinationChainInfo[] = [];
      
      for (const selector of supportedSelectors) {
        // セレクタからチェーンIDを取得（逆マッピング）
        const chainId = Object.entries(chainSelectors).find(
          ([_, value]) => value === selector
        )?.[0];
        
        if (chainId) {
          const chainInfo = await publicClient.readContract({
            address: bridgeAddress,
            abi: BridgeABI,
            functionName: "getDestinationChainInfo",
            args: [selector],
          });
          
          // 戻り値は [supported, name, bridgeContract, poolLow]
          const [supported, name, bridgeContract, poolLow] = chainInfo as [boolean, string, string, boolean];
          
          destinationChainsInfo.push({
            chainId: Number(chainId),
            name: name || chainNames[Number(chainId)] || "Unknown Chain",
            ccipSelector: selector,
            supported,
            bridgeContract,
            poolLow,
          });
        }
      }
      
      setDestinationChains(destinationChainsInfo);
      
    } catch (error) {
      console.error("ブリッジデータ取得エラー:", error);
    }
  }, [activeAddress, currentChainId, publicClient]);
  
  // Get estimated fee for bridging
  const estimateBridgeFee = useCallback(async (
    destinationChainId: number,
    amount: string,
    autoEnterRaffle: boolean = false
  ) => {
    if (!activeAddress || !publicClient) return null;
    
    try {
      const bridgeAddress = bridgeAddresses[currentChainId] as `0x${string}`;
      if (!bridgeAddress || bridgeAddress === "0x0000000000000000000000000000000000000000") {
        return null;
      }
      
      // チェーンIDからセレクタを取得
      const destinationSelector = chainSelectors[destinationChainId];
      if (!destinationSelector) {
        console.warn(`セレクタが見つかりません: チェーンID ${destinationChainId}`);
        return null;
      }
      
      // USDC amount（デフォルトでは6デシマル）
      const parsedAmount = parseUnits(amount, 6);
      
      // 手数料を見積もる
      const feeResult = await publicClient.readContract({
        address: bridgeAddress,
        abi: BridgeABI,
        functionName: "estimateFee",
        args: [destinationSelector, activeAddress, parsedAmount, autoEnterRaffle],
      });
      
      setEstimatedFee(feeResult as bigint);
      return feeResult as bigint;
    } catch (error) {
      console.error("手数料見積もりエラー:", error);
      return null;
    }
  }, [activeAddress, currentChainId, publicClient]);
  
  // Approve USDC for bridge
  const approveUSDC = useCallback(async (amount: string) => {
    if (!activeAddress || !writeContractAsync) {
      toast({
        title: "エラー",
        description: "ウォレットが接続されていません",
        variant: "destructive",
      });
      return null;
    }
    
    try {
      setIsApproving(true);
      
      const bridgeAddress = bridgeAddresses[currentChainId] as `0x${string}`;
      if (!bridgeAddress || bridgeAddress === "0x0000000000000000000000000000000000000000") {
        throw new Error(`ブリッジコントラクトアドレスが設定されていません: チェーンID ${currentChainId}`);
      }
      
      const usdcAddress = contractConfig[currentChainId as keyof typeof contractConfig]?.erc20Address as `0x${string}`;
      if (!usdcAddress) {
        throw new Error(`USDCアドレスが見つかりません: チェーンID ${currentChainId}`);
      }
      
      // 承認額（大きめに設定）
      const parsedAmount = parseUnits(amount, 6);
      const approveAmount = parsedAmount * BigInt(2); // 余裕を持たせる
      
      const tx = await writeContractAsync({
        address: usdcAddress,
        abi: ERC20ABI,
        functionName: "approve",
        args: [bridgeAddress, approveAmount],
      });
      
      toast({
        title: "承認送信",
        description: "USDCの承認トランザクションを送信しました",
      });
      
      // トランザクション確認を待つ
      await publicClient!.waitForTransactionReceipt({ hash: tx });
      
      toast({
        title: "承認完了",
        description: "USDCの承認が完了しました",
      });
      
      // アローワンスを更新
      const newAllowance = await publicClient!.readContract({
        address: usdcAddress,
        abi: ERC20ABI,
        functionName: "allowance",
        args: [activeAddress as `0x${string}`, bridgeAddress],
      });
      
      setAllowance(newAllowance as bigint);
      return tx;
    } catch (error) {
      console.error("USDC承認エラー:", error);
      
      toast({
        title: "承認エラー",
        description: error instanceof Error ? error.message : "不明なエラー",
        variant: "destructive",
      });
      
      return null;
    } finally {
      setIsApproving(false);
    }
  }, [activeAddress, currentChainId, writeContractAsync, publicClient, toast]);
  
  // Bridge USDC
  const bridgeUSDC = useCallback(async (
    destinationChainId: number,
    amount: string,
    autoEnterRaffle: boolean = false
  ) => {
    if (!activeAddress || !writeContractAsync) {
      toast({
        title: "エラー",
        description: "ウォレットが接続されていません",
        variant: "destructive",
      });
      return null;
    }
    
    try {
      setIsLoading(true);
      
      const bridgeAddress = bridgeAddresses[currentChainId] as `0x${string}`;
      if (!bridgeAddress || bridgeAddress === "0x0000000000000000000000000000000000000000") {
        throw new Error(`ブリッジコントラクトアドレスが設定されていません: チェーンID ${currentChainId}`);
      }
      
      // チェーンIDからセレクタを取得
      const destinationSelector = chainSelectors[destinationChainId];
      if (!destinationSelector) {
        throw new Error(`セレクタが見つかりません: チェーンID ${destinationChainId}`);
      }
      
      // USDC amount
      const parsedAmount = parseUnits(amount, 6);
      
      // 手数料を見積もる
      const fee = await estimateBridgeFee(destinationChainId, amount, autoEnterRaffle);
      if (!fee) {
        throw new Error("手数料の見積もりに失敗しました");
      }
      
      // ブリッジトランザクションを送信
      const tx = await writeContractAsync({
        address: bridgeAddress,
        abi: BridgeABI,
        functionName: "bridgeTokens",
        args: [destinationSelector, activeAddress, parsedAmount, autoEnterRaffle],
        value: fee,
      });
      
      toast({
        title: "ブリッジ送信",
        description: `${amount} USDCのブリッジトランザクションを送信しました`,
      });
      
      // ローカルでトランザクションを追跡
      const newTransaction: BridgeTransaction = {
        txHash: tx,
        timestamp: Date.now(),
        sourceChain: currentChainId,
        destinationChain: destinationChainId,
        amount,
        status: 'pending',
        autoEnterRaffle,
      };
      
      // トランザクションリストに追加
      setTransactions(prev => [newTransaction, ...prev]);
      
      // ローカルストレージに保存
      const storedTxs = localStorage.getItem('bridge_transactions');
      const parsedTxs = storedTxs ? JSON.parse(storedTxs) : [];
      localStorage.setItem('bridge_transactions', JSON.stringify([newTransaction, ...parsedTxs]));
      
      // トランザクション確認を待つ
      try {
        await publicClient!.waitForTransactionReceipt({ hash: tx });
        
        // 成功したトランザクションを更新
        setTransactions(prev => prev.map(t => 
          t.txHash === tx ? { ...t, status: 'success' } : t
        ));
        
        // ローカルストレージも更新
        const updatedStoredTxs = localStorage.getItem('bridge_transactions');
        const updatedParsedTxs = updatedStoredTxs ? JSON.parse(updatedStoredTxs) : [];
        localStorage.setItem('bridge_transactions', JSON.stringify(
          updatedParsedTxs.map((t: BridgeTransaction) => 
            t.txHash === tx ? { ...t, status: 'success' } : t
          )
        ));
        
        toast({
          title: "ブリッジ送信完了",
          description: `${amount} USDCを${chainNames[destinationChainId]}にブリッジしました。トークンが届くまで数分かかる場合があります。`,
        });
      } catch (error) {
        console.error("トランザクション確認エラー:", error);
        
        // 失敗したトランザクションを更新
        setTransactions(prev => prev.map(t => 
          t.txHash === tx ? { ...t, status: 'failed' } : t
        ));
        
        // ローカルストレージも更新
        const failedStoredTxs = localStorage.getItem('bridge_transactions');
        const failedParsedTxs = failedStoredTxs ? JSON.parse(failedStoredTxs) : [];
        localStorage.setItem('bridge_transactions', JSON.stringify(
          failedParsedTxs.map((t: BridgeTransaction) => 
            t.txHash === tx ? { ...t, status: 'failed' } : t
          )
        ));
      }
      
      return tx;
    } catch (error) {
      console.error("USDCブリッジエラー:", error);
      
      toast({
        title: "ブリッジエラー",
        description: error instanceof Error ? error.message : "不明なエラー",
        variant: "destructive",
      });
      
      return null;
    } finally {
      setIsLoading(false);
      
      // データを再取得
      fetchBridgeData();
    }
  }, [activeAddress, currentChainId, writeContractAsync, publicClient, toast, estimateBridgeFee, fetchBridgeData]);
  
  // Load transactions from localStorage
  useEffect(() => {
    const storedTxs = localStorage.getItem('bridge_transactions');
    if (storedTxs) {
      try {
        const parsedTxs = JSON.parse(storedTxs);
        // アドレスに関連するトランザクションのみをフィルタリング
        // Note: 現在のバージョンではアドレスでのフィルタリングは行っていない
        setTransactions(parsedTxs);
      } catch (error) {
        console.error("保存されたトランザクションの解析エラー:", error);
      }
    }
  }, []);
  
  // Fetch bridge data on mount and when chain changes
  useEffect(() => {
    if (isConnected || isReadyToSendTx) {
      fetchBridgeData();
    }
  }, [isConnected, isReadyToSendTx, currentChainId, fetchBridgeData]);
  
  // Format USDC balance
  const formattedUsdcBalance = useCallback(() => {
    if (!usdcBalance) return "0";
    return formatUnits(usdcBalance as bigint, 6);
  }, [usdcBalance]);
  
  // Check if approval is needed
  const needsApproval = useCallback((amount: string) => {
    try {
      const parsedAmount = parseUnits(amount, 6);
      return allowance < parsedAmount;
    } catch (error) {
      return true; // エラーの場合は承認が必要とみなす
    }
  }, [allowance]);
  
  return {
    activeAddress,
    isLoading,
    isApproving,
    estimatedFee,
    poolBalance,
    destinationChains,
    transactions,
    usdcBalance: formattedUsdcBalance(),
    needsApproval,
    approveUSDC,
    bridgeUSDC,
    estimateBridgeFee,
    fetchBridgeData
  };
}
