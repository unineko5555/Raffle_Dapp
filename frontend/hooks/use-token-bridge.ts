"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useChainId, usePublicClient, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits, createPublicClient, http } from "viem";
import { sepolia, baseSepolia, arbitrumSepolia } from "viem/chains";
import { contractConfig, ERC20ABI } from "@/app/lib/contract-config";
import { useToast } from "@/components/ui/use-toast";
import { useSmartAccountContext } from "@/app/providers/smart-account-provider";
import useBridgeContractConfig, { BRIDGE_ABI, BRIDGE_CONFIGS } from "@/app/lib/bridge-contract-config";


// チェーンIDとCCIPセレクタのマッピング
const chainSelectors: Record<number, bigint> = BRIDGE_CONFIGS.reduce((acc, config) => {
  if (config.ccipSelector) {
    acc[config.networkId] = BigInt(config.ccipSelector);
  }
  return acc;
}, {} as Record<number, bigint>);

// ブリッジコントラクトアドレス - 実際のデプロイ後に更新が必要
const bridgeAddresses: Record<number, string> = BRIDGE_CONFIGS.reduce((acc, config) => {
  acc[config.networkId] = config.bridgeAddress;
  return acc;
}, {} as Record<number, string>);

// チェーン名のマッピング
const chainNames: Record<number, string> = {
  11155111: "Sepolia",
  84532: "Base Sepolia",
  421614: "Arbitrum Sepolia",
};

// 環境変数からRPC URLを取得する関数
const getRpcUrl = (chainId: number): string => {
  switch (chainId) {
    case 11155111: // Sepolia
      return process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://rpc.sepolia.org";
    case 84532: // Base Sepolia
      return process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
    case 421614: // Arbitrum Sepolia
      return process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";
    default:
      return "https://rpc.sepolia.org";
  }
};

const CHAIN_CONFIGS = {
  11155111: sepolia,
  84532: baseSepolia,
  421614: arbitrumSepolia,
};

const getClientForChain = (chainId: number) => {
  const chain = CHAIN_CONFIGS[chainId as keyof typeof CHAIN_CONFIGS];
  if (!chain) return null;
  // 環境変数からRPC URLを取得して使用
  const rpcUrl = getRpcUrl(chainId);
  return createPublicClient({ 
    chain, 
    transport: http(rpcUrl)
  });
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
  poolBalance: string; // プール残高
};

// 3チェーン分の流動性状態を常に表示するための補助関数
const ALL_CHAIN_IDS = [11155111, 84532, 421614];

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
  const { data: usdcBalance } = useReadContract(
    activeAddress ? {
      address: contractConfig[currentChainId as keyof typeof contractConfig]?.erc20Address as `0x${string}`,
      abi: ERC20ABI,
      functionName: "balanceOf",
      args: [activeAddress as `0x${string}`],
    } : { abi: ERC20ABI, functionName: "balanceOf" }
  );
  
  // 各チェーンの残高を取得する関数
  const fetchChainBalance = useCallback(async (chainId: number): Promise<{
    chainId: number;
    poolBalance: string;
    poolLow: boolean;
    supported: boolean;
    name: string;
    bridgeContract: string;
    success: boolean;
  }> => {
    try {
      // チェーンの基本情報を取得
      const bridgeAddress = bridgeAddresses[chainId] as `0x${string}`;
      const selector = chainSelectors[chainId];
      const chain = CHAIN_CONFIGS[chainId as keyof typeof CHAIN_CONFIGS];
      const chainName = chainNames[chainId] || "Unknown Chain";
      
      if (!bridgeAddress || !selector || !chain) {
        console.warn(`チェーンID ${chainId} の基本情報が見つかりません`);
        return {
          chainId,
          poolBalance: "0",
          poolLow: false,
          supported: false,
          name: chainName,
          bridgeContract: bridgeAddress || "",
          success: false
        };
      }
      
      // 使用するクライアントを選択
      let client;
      
      // 現在のチェーンならPublicClientを使用
      if (chainId === currentChainId && publicClient) {
        client = publicClient;
      } else {
        // それ以外は環境変数から取得したRPC URLを使用して別のクライアントを作成
        const rpcUrl = getRpcUrl(chainId);
        client = createPublicClient({
          chain,
          transport: http(rpcUrl)
        });
      }
      
      // 並列で残高と流動性状態を取得
      // 個別に実行して、いずれかが失敗しても続行できるようにする
      let poolBalance = "0";
      let supported = false;
      let name = chainName;
      let bridgeContract = bridgeAddress;
      let poolLow = false;
      
      try {
        const poolBalanceResult = await client.readContract({
          address: bridgeAddress,
          abi: BRIDGE_ABI,
          functionName: "getPoolBalance",
        });
        poolBalance = formatUnits(poolBalanceResult as bigint, 6);
      } catch (error) {
        // エラー発生時は静かに失敗
      }
      
      try {
        const chainInfoResult = await client.readContract({
          address: bridgeAddress,
          abi: BRIDGE_ABI,
          functionName: "getDestinationChainInfo",
          args: [selector],
        });
        const info = chainInfoResult as [boolean, string, string, boolean];
        supported = info[0];
        name = info[1] || chainName;
        bridgeContract = info[2] as `0x${string}`;
        poolLow = info[3];
      } catch (error) {
        // エラー発生時は静かに失敗
      }
      
      return {
        chainId,
        poolBalance,
        poolLow,
        supported,
        name,
        bridgeContract,
        success: true
      };
    } catch (error) {
      return {
        chainId,
        poolBalance: "0", 
        poolLow: false,
        supported: false,
        name: chainNames[chainId] || "Unknown Chain",
        bridgeContract: bridgeAddresses[chainId] as string || "",
        success: false
      };
    }
  }, [currentChainId, publicClient]);
  
  // 全チェーンデータ取得の実装
  const fetchBridgeData = useCallback(async () => {
    if (!activeAddress) return;
    
    try {
      // 現在接続中のチェーンのブリッジアドレスとUSDCアドレスを取得
      const bridgeAddress = bridgeAddresses[currentChainId] as `0x${string}`;
      const usdcAddress = contractConfig[currentChainId as keyof typeof contractConfig]?.erc20Address as `0x${string}`;
      
      // 並列処理を行う、publicClientがある場合のみアローワンスを取得
      const fetchTasks = [];
      
      // アローワンス取得タスク
      if (bridgeAddress && publicClient && usdcAddress && activeAddress) {
        fetchTasks.push(
          (async () => {
            try {
              const allowanceResult = await publicClient.readContract({
                address: usdcAddress,
                abi: ERC20ABI,
                functionName: "allowance",
                args: [activeAddress as `0x${string}`, bridgeAddress],
              });
              setAllowance(allowanceResult as bigint);
            } catch (error) {
              // エラー発生時は静かに失敗
            }
          })()
        );
      }
      
      // 全チェーンの残高を取得するタスク
      const chainDataPromise = (async () => {
        try {
          const allChainPromises = ALL_CHAIN_IDS.map(chainId => fetchChainBalance(chainId));
          const chainResults = await Promise.all(allChainPromises);
          
          // 取得結果から有効なもののみを使用してDestinationChainInfoを構築
          const validChainInfos = chainResults.map(result => ({
            chainId: result.chainId,
            name: result.name,
            ccipSelector: chainSelectors[result.chainId] || BigInt(0),
            supported: result.supported,
            bridgeContract: result.bridgeContract,
            poolLow: result.poolLow,
            poolBalance: result.poolBalance
          }));
          
          // 接続中チェーンのプール残高をステートに設定
          const currentChainInfo = validChainInfos.find(info => info.chainId === currentChainId);
          if (currentChainInfo) {
            setPoolBalance(currentChainInfo.poolBalance);
          }
          
          setDestinationChains(validChainInfos);
        } catch (error) {
          // エラー発生時は静かに失敗
        }
      })();
      
      // チェーンデータ取得タスクを追加
      fetchTasks.push(chainDataPromise);
      
      // すべてのタスクを完了するまで待機
      await Promise.all(fetchTasks);
      
    } catch (error) {
      // エラー発生時は静かに失敗
    }
  }, [activeAddress, currentChainId, publicClient, fetchChainBalance]);
  
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
      
      // フロントエンド側で設定されている値をログ出力
      console.log("============ フロントエンド側の設定値 ============");
      console.log(`現在のチェーンID: ${currentChainId}`);
      console.log(`現在のチェーンのブリッジアドレス: ${bridgeAddress}`);
      console.log(`宛先チェーンID: ${destinationChainId}`);
      console.log(`宛先チェーンセレクタ: ${destinationSelector}`);
      console.log(`宛先チェーンのブリッジアドレス (フロントエンド設定): ${bridgeAddresses[destinationChainId]}`);
      
      // コントラクト内に設定されている値を取得
      try {
        const chainInfo = await publicClient.readContract({
          address: bridgeAddress,
          abi: BRIDGE_ABI,
          functionName: "getDestinationChainInfo",
          args: [destinationSelector],
        });
        
        // コントラクト内の設定値をログ出力
        console.log("============ コントラクト内の設定値 ============");
        console.log("サポートされているか:", chainInfo[0]);
        console.log("チェーン名:", chainInfo[1]);
        console.log("ブリッジコントラクトアドレス:", chainInfo[2]);
        console.log("プール残高不足フラグ:", chainInfo[3]);
        
        // 比較結果
        console.log("============ 比較結果 ============");
        console.log("フロントエンドとコントラクトのアドレス一致:", 
                    bridgeAddresses[destinationChainId].toLowerCase() === chainInfo[2].toLowerCase());
        console.log("不一致の場合、以下のコマンドで更新してください:");
        console.log(`updateDestinationBridgeContract(${destinationSelector}n, "${bridgeAddresses[destinationChainId]}")`);
      } catch (error) {
        console.error("チェーン情報取得エラー:", error);
      }
      
      // USDC amount（デフォルトでは6デシマル）
      const parsedAmount = parseUnits(amount, 6);
      
      // 手数料を見積もる
      const feeResult = await publicClient.readContract({
        address: bridgeAddress,
        abi: BRIDGE_ABI,
        functionName: "estimateFee",
        args: [destinationSelector, activeAddress as `0x${string}`, parsedAmount, autoEnterRaffle],
      });
      
      setEstimatedFee(feeResult as bigint);
      return feeResult as bigint;
    } catch (error: any) {
      console.error("手数料見積もりエラー詳細:");
      console.error("  エラー名:", error.name);
      console.error("  メッセージ:", error.message);
      if (error.shortMessage) {
        console.error("  短いメッセージ:", error.shortMessage);
      }
      if (error.cause) {
        console.error("  原因:", error.cause);
      }
      if (error.meta) {
        console.error("  メタ情報:", error.meta);
      }

      // estimateFee呼び出し時の引数をログ出力
      const bridgeAddress = bridgeAddresses[currentChainId] as `0x${string}`;
      const destinationSelector = chainSelectors[destinationChainId];
      // USDC amount（デフォルトでは6デシマル）
      const parsedAmount = parseUnits(amount, 6);

      console.error("  estimateFee呼び出し引数:");
      console.error(`    ソースブリッジコントラクトアドレス (bridgeAddress): ${bridgeAddress}`);
      console.error(`    宛先セレクタ (destinationSelector): ${destinationSelector?.toString()}`);
      console.error(`    ユーザーアドレス (activeAddress): ${activeAddress}`);
      console.error(`    解析された金額 (parsedAmount): ${parsedAmount.toString()}`);
      console.error(`    自動ラッフル参加 (autoEnterRaffle): ${autoEnterRaffle}`);
      
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
  
  // プール初期化
  const initializePool = useCallback(async (amount: string) => {
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
      
      const usdcAddress = contractConfig[currentChainId as keyof typeof contractConfig]?.erc20Address as `0x${string}`;
      if (!usdcAddress) {
        throw new Error(`USDCアドレスが見つかりません: チェーンID ${currentChainId}`);
      }
      
      // USDC amount
      const parsedAmount = parseUnits(amount, 6);
      
      // USDC承認
      await approveUSDC(amount);
      
      // プール初期化
      const tx = await writeContractAsync({
        address: bridgeAddress,
        abi: BRIDGE_ABI,
        functionName: "initializePool",
        args: [parsedAmount],
      });
      
      toast({
        title: "プール初期化送信",
        description: `${amount} USDCでプールを初期化しました`,
      });
      
      // トランザクション確認を待つ
      await publicClient!.waitForTransactionReceipt({ hash: tx });
      
      toast({
        title: "プール初期化完了",
        description: "USDCプールの初期化が完了しました",
      });
      
      // データを再取得
      fetchBridgeData();
      
      return tx;
    } catch (error) {
      console.error("プール初期化エラー:", error);
      
      toast({
        title: "初期化エラー",
        description: error instanceof Error ? error.message : "不明なエラー",
        variant: "destructive",
      });
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [activeAddress, currentChainId, writeContractAsync, publicClient, toast, approveUSDC, fetchBridgeData]);
  
  // プール補充
  const replenishPool = useCallback(async (amount: string) => {
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
      
      const usdcAddress = contractConfig[currentChainId as keyof typeof contractConfig]?.erc20Address as `0x${string}`;
      if (!usdcAddress) {
        throw new Error(`USDCアドレスが見つかりません: チェーンID ${currentChainId}`);
      }
      
      // USDC amount
      const parsedAmount = parseUnits(amount, 6);
      
      // USDC承認
      await approveUSDC(amount);
      
      // プール補充
      const tx = await writeContractAsync({
        address: bridgeAddress,
        abi: BRIDGE_ABI,
        functionName: "replenishPool",
        args: [parsedAmount],
      });
      
      toast({
        title: "プール補充送信",
        description: `${amount} USDCでプールを補充しました`,
      });
      
      // トランザクション確認を待つ
      await publicClient!.waitForTransactionReceipt({ hash: tx });
      
      toast({
        title: "プール補充完了",
        description: "USDCプールの補充が完了しました",
      });
      
      // データを再取得
      fetchBridgeData();
      
      return tx;
    } catch (error) {
      console.error("プール補充エラー:", error);
      
      toast({
        title: "補充エラー",
        description: error instanceof Error ? error.message : "不明なエラー",
        variant: "destructive",
      });
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [activeAddress, currentChainId, writeContractAsync, publicClient, toast, approveUSDC, fetchBridgeData]);
  
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
        abi: BRIDGE_ABI,
        functionName: "bridgeTokens",
        args: [destinationSelector, activeAddress as `0x${string}`, parsedAmount, autoEnterRaffle],
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
  
  // Fetch bridge data on mount, when chain changes, and periodically
  useEffect(() => {
    if (isConnected || isReadyToSendTx) {
      // 初回ロード
      fetchBridgeData();
      
      // 10秒ごとにデータを自動更新
      const intervalId = setInterval(() => {
        fetchBridgeData();
      }, 10000); // 10秒間隔で更新（実稼働時には15秒以上が推奨）
      
      // クリーンアップ関数
      return () => clearInterval(intervalId);
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
    fetchBridgeData,
    initializePool,
    replenishPool
  };
}
