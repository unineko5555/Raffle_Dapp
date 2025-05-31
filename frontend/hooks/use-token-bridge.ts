"use client";

import { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useBalance,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSimulateContract,
} from "wagmi";
import {
  parseUnits,
  formatUnits,
  createPublicClient,
  http,
  maxUint256,
} from "viem";
import { sepolia, baseSepolia, arbitrumSepolia } from "viem/chains";
import { contractConfig, ERC20ABI } from "@/app/lib/contract-config";
import { useToast } from "@/components/ui/use-toast";
import { useSmartAccountContext } from "@/app/providers/smart-account-provider";
import useBridgeContractConfig, {
  BRIDGE_ABI,
  BRIDGE_CONFIGS,
} from "@/app/lib/bridge-contract-config";

// チェーンIDとCCIPセレクタのマッピング
const chainSelectors: Record<number, bigint> = BRIDGE_CONFIGS.reduce(
  (acc, config) => {
    if (config.ccipSelector) {
      acc[config.networkId] = BigInt(config.ccipSelector);
    }
    return acc;
  },
  {} as Record<number, bigint>
);

// ブリッジコントラクトアドレス
const bridgeAddresses: Record<number, string> = BRIDGE_CONFIGS.reduce(
  (acc, config) => {
    acc[config.networkId] = config.bridgeAddress;
    return acc;
  },
  {} as Record<number, string>
);

// CCIPルーターアドレス（参考用・直接は使用しない）
const ccipRouterAddresses: Record<number, string> = BRIDGE_CONFIGS.reduce(
  (acc, config) => {
    acc[config.networkId] = config.ccipRouterAddress;
    return acc;
  },
  {} as Record<number, string>
);

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
      return (
        process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://rpc.sepolia.org"
      );
    case 84532: // Base Sepolia
      return (
        process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ||
        "https://sepolia.base.org"
      );
    case 421614: // Arbitrum Sepolia
      return (
        process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL ||
        "https://sepolia-rollup.arbitrum.io/rpc"
      );
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
    transport: http(rpcUrl),
  });
};

export type BridgeTransaction = {
  txHash: string;
  timestamp: number;
  sourceChain: number;
  destinationChain: number;
  amount: string;
  status: "pending" | "success" | "failed";
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
  const [allowance, setAllowance] = useState<bigint>(BigInt(0)); // ブリッジコントラクトへの承認額
  const [transactions, setTransactions] = useState<BridgeTransaction[]>([]);
  const [destinationChains, setDestinationChains] = useState<
    DestinationChainInfo[]
  >([]);

  // Write contract hooks
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();
  const { data: txHash, isPending: isTxPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash,
      chainId: currentChainId,
    });

  // Get USDC balance
  const { data: usdcBalance } = useReadContract(
    activeAddress
      ? {
          address: contractConfig[currentChainId as keyof typeof contractConfig]
            ?.erc20Address as `0x${string}`,
          abi: ERC20ABI,
          functionName: "balanceOf",
          args: [activeAddress as `0x${string}`],
        }
      : { abi: ERC20ABI, functionName: "balanceOf" }
  );

  // 各チェーンの残高を取得する関数
  const fetchChainBalance = useCallback(
    async (
      chainId: number
    ): Promise<{
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
          return {
            chainId,
            poolBalance: "0",
            poolLow: false,
            supported: false,
            name: chainName,
            bridgeContract: bridgeAddress || "",
            success: false,
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
            transport: http(rpcUrl),
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
          success: true,
        };
      } catch (error) {
        return {
          chainId,
          poolBalance: "0",
          poolLow: false,
          supported: false,
          name: chainNames[chainId] || "Unknown Chain",
          bridgeContract: (bridgeAddresses[chainId] as string) || "",
          success: false,
        };
      }
    },
    [currentChainId, publicClient]
  );

  // 全チェーンデータ取得の実装
  const fetchBridgeData = useCallback(async () => {
    if (!activeAddress) return;

    try {
      // 現在接続中のチェーンのUSDCアドレスとブリッジコントラクトアドレスを取得
      const usdcAddress = contractConfig[
        currentChainId as keyof typeof contractConfig
      ]?.erc20Address as `0x${string}`;
      const bridgeAddress = bridgeAddresses[currentChainId] as `0x${string}`;

      // 並列処理を行う、publicClientがある場合のみアローワンスを取得
      const fetchTasks = [];

      // ブリッジコントラクトへのアローワンス取得タスク（修正版）
      if (bridgeAddress && publicClient && usdcAddress && activeAddress) {
        fetchTasks.push(
          (async () => {
            try {
              const allowanceResult = await publicClient.readContract({
                address: usdcAddress,
                abi: ERC20ABI,
                functionName: "allowance",
                args: [activeAddress as `0x${string}`, bridgeAddress], // ✅ ブリッジコントラクトに修正
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
          const allChainPromises = ALL_CHAIN_IDS.map((chainId) =>
            fetchChainBalance(chainId)
          );
          const chainResults = await Promise.all(allChainPromises);

          // 取得結果から有効なもののみを使用してDestinationChainInfoを構築
          const validChainInfos = chainResults.map((result) => ({
            chainId: result.chainId,
            name: result.name,
            ccipSelector: chainSelectors[result.chainId] || BigInt(0),
            supported: result.supported,
            bridgeContract: result.bridgeContract,
            poolLow: result.poolLow,
            poolBalance: result.poolBalance,
          }));

          // 接続中チェーンのプール残高をステートに設定
          const currentChainInfo = validChainInfos.find(
            (info) => info.chainId === currentChainId
          );
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
  const estimateBridgeFee = useCallback(
    async (destinationChainId: number, amount: string) => {
      if (!activeAddress || !publicClient) return null;

      try {
        const bridgeAddress = bridgeAddresses[currentChainId] as `0x${string}`;
        if (
          !bridgeAddress ||
          bridgeAddress === "0x0000000000000000000000000000000000000000"
        ) {
          return null;
        }

        // チェーンIDからセレクタを取得
        const destinationSelector = chainSelectors[destinationChainId];
        if (!destinationSelector) {

          return null;
        }

        // USDC amount（デフォルトでは6デシマル）
        const parsedAmount = parseUnits(amount, 6);

        // 手数料を見積もる（コントラクトのestimateFee関数を呼び出し）
        const fee = await publicClient.readContract({
          address: bridgeAddress,
          abi: BRIDGE_ABI,
          functionName: "estimateFee",
          args: [
            destinationSelector,
            activeAddress as `0x${string}`,
            parsedAmount,
          ],
        });


        setEstimatedFee(fee as bigint);
        return fee as bigint;
      } catch (error) {

        return null;
      }
    },
    [activeAddress, currentChainId, publicClient]
  );

  // USDC承認関数（ブリッジコントラクトへの承認）
  const approveUSDC = useCallback(
    async (amount: string, destinationChainId?: number) => {
      if (!activeAddress || !writeContractAsync) return null;

      try {
        setIsApproving(true);

        const bridgeAddress = bridgeAddresses[currentChainId] as `0x${string}`;
        const usdcAddress = contractConfig[
          currentChainId as keyof typeof contractConfig
        ]?.erc20Address as `0x${string}`;

        // ✅ 重要情報ログ: 承認実行 - アドレス
        console.log(`Approving: ${bridgeAddress}`);

        // ブリッジコントラクトに対してUSDCを承認
        const { request } = await publicClient!.simulateContract({
          address: usdcAddress,
          abi: ERC20ABI,
          functionName: "approve",
          args: [bridgeAddress, maxUint256],
          account: activeAddress as `0x${string}`,
        });

        const hash = await writeContractAsync(request);

        toast({
          title: "承認送信",
          description: `ブリッジコントラクトへのUSDC承認トランザクションを送信しました`,
        });

        const receipt = await publicClient!.waitForTransactionReceipt({ hash });

        if (receipt.status !== "success") {
          throw new Error("承認トランザクションが失敗しました");
        }

        // ✅ 重要情報ログ: 承認完了
        console.log(`Approval Complete`);

        toast({
          title: "承認完了",
          description: `ブリッジコントラクトへのUSDC承認が完了しました`,
        });

        // データを再取得
        await fetchBridgeData();
        return hash;
      } catch (error) {


        toast({
          title: "承認エラー",
          description:
            error instanceof Error ? error.message : "承認に失敗しました",
          variant: "destructive",
        });

        return null;
      } finally {
        setIsApproving(false);
      }
    },
    [
      activeAddress,
      currentChainId,
      writeContractAsync,
      publicClient,
      toast,
      fetchBridgeData,
    ]
  );

  // USDC ブリッジ関数（修正済み：2段階転送パターン）
  const bridgeUSDC = useCallback(
    async (destinationChainId: number, amount: string) => {
      if (!activeAddress || !writeContractAsync) return null;

      try {
        setIsLoading(true);

        const bridgeAddress = bridgeAddresses[currentChainId] as `0x${string}`;
        const usdcAddress = contractConfig[
          currentChainId as keyof typeof contractConfig
        ]?.erc20Address as `0x${string}`;
        const destinationSelector = chainSelectors[destinationChainId];
        const parsedAmount = parseUnits(amount, 6);

        // 手数料を見積もる
        const fee = await estimateBridgeFee(destinationChainId, amount);
        if (!fee) {
          throw new Error("手数料の見積もりに失敗しました");
        }

        // ✅ 重要情報ログ: 金額、宛先チェーン、手数料、アドレス
        console.log(`Bridge Start: ${amount} USDC to Chain ${destinationChainId} | Fee: ${formatUnits(fee, 18)} ETH | From: ${activeAddress}`);

        // ブリッジコントラクトへの承認確認（修正確認）
        const bridgeAllowance = await publicClient!.readContract({
          address: usdcAddress,
          abi: ERC20ABI,
          functionName: "allowance",
          args: [activeAddress as `0x${string}`, bridgeAddress],
        });



        if ((bridgeAllowance as bigint) < parsedAmount) {
          throw new Error(
            `ブリッジコントラクトへの承認が不足しています。承認額: ${formatUnits(
              bridgeAllowance as bigint,
              6
            )} USDC, 必要額: ${formatUnits(parsedAmount, 6)} USDC`
          );
        }

        // ブリッジトランザクションを実行
        const { request } = await publicClient!.simulateContract({
          address: bridgeAddress,
          abi: BRIDGE_ABI,
          functionName: "bridgeTokens",
          args: [
            destinationSelector,
            activeAddress as `0x${string}`,
            parsedAmount,
          ],
          value: fee,
          account: activeAddress as `0x${string}`,
          gas: 500000n,
        });

        const tx = await writeContractAsync({
          ...request,
          gas: 500000n,
        });

        // ✅ 重要情報ログ: ブリッジ成功
        console.log(`Bridge Success: ${tx} | ${amount} USDC to Chain ${destinationChainId}`);

        toast({
          title: "ブリッジ送信",
          description: `${amount} USDCのブリッジトランザクションを送信しました。CCIP Explorer: https://ccip.chain.link/tx/${tx}`,
        });

        // トランザクションを追跡
        const newTransaction: BridgeTransaction = {
          txHash: tx,
          timestamp: Date.now(),
          sourceChain: currentChainId,
          destinationChain: destinationChainId,
          amount,
          status: "pending",
        };

        setTransactions((prev) => [newTransaction, ...prev]);

        // ローカルストレージに保存
        const storedTxs = localStorage.getItem("bridge_transactions");
        const parsedTxs = storedTxs ? JSON.parse(storedTxs) : [];
        localStorage.setItem(
          "bridge_transactions",
          JSON.stringify([newTransaction, ...parsedTxs])
        );

        // トランザクション確認を待つ
        try {
          const receipt = await publicClient!.waitForTransactionReceipt({
            hash: tx,
          });

          if (receipt.status !== "success") {
            throw new Error(
              `ブリッジトランザクションが失敗しました。ステータス: ${receipt.status}`
            );
          }

          // 成功したトランザクションを更新
          setTransactions((prev) =>
            prev.map((t) => (t.txHash === tx ? { ...t, status: "success" } : t))
          );

          toast({
            title: "ブリッジ成功",
            description: `✨ ${amount} USDCを${chainNames[destinationChainId]}にブリッジしました！トークンが届くまで数分かかる場合があります。CCIP Explorer: https://ccip.chain.link/tx/${tx}`,
          });
        } catch (error) {
          // 失敗したトランザクションを更新
          setTransactions((prev) =>
            prev.map((t) => (t.txHash === tx ? { ...t, status: "failed" } : t))
          );

          throw error;
        }

        return tx;
      } catch (error) {


        toast({
          title: "ブリッジエラー",
          description: error instanceof Error ? error.message : "不明なエラー",
          variant: "destructive",
        });

        return null;
      } finally {
        setIsLoading(false);
        await fetchBridgeData();
      }
    },
    [
      activeAddress,
      currentChainId,
      writeContractAsync,
      publicClient,
      toast,
      estimateBridgeFee,
      fetchBridgeData,
    ]
  );

  // プール初期化関数
  const initializePool = useCallback(
    async (amount: string) => {
      if (!activeAddress || !writeContractAsync) return null;

      try {
        setIsLoading(true);

        const bridgeAddress = bridgeAddresses[currentChainId] as `0x${string}`;
        const usdcAddress = contractConfig[
          currentChainId as keyof typeof contractConfig
        ]?.erc20Address as `0x${string}`;
        const parsedAmount = parseUnits(amount, 6);

        // ✅ 重要情報ログ: プール初期化 - 金額
        console.log(`Pool Init: ${amount} USDC`);

        // USDCをブリッジコントラクトに承認
        const approveRequest = await publicClient!.simulateContract({
          address: usdcAddress,
          abi: ERC20ABI,
          functionName: "approve",
          args: [bridgeAddress, parsedAmount],
          account: activeAddress as `0x${string}`,
        });

        const approveHash = await writeContractAsync(approveRequest.request);
        await publicClient!.waitForTransactionReceipt({ hash: approveHash });

        // プール初期化を実行
        const { request } = await publicClient!.simulateContract({
          address: bridgeAddress,
          abi: BRIDGE_ABI,
          functionName: "initializePool",
          args: [parsedAmount],
          account: activeAddress as `0x${string}`,
        });

        const tx = await writeContractAsync(request);

        toast({
          title: "プール初期化送信",
          description: `${amount} USDCでプールを初期化しました`,
        });

        const receipt = await publicClient!.waitForTransactionReceipt({
          hash: tx,
        });

        if (receipt.status !== "success") {
          throw new Error("プール初期化が失敗しました");
        }

        toast({
          title: "プール初期化完了",
          description: `${amount} USDCでプールが正常に初期化されました`,
        });

        await fetchBridgeData();
        return tx;
      } catch (error) {


        toast({
          title: "プール初期化エラー",
          description:
            error instanceof Error
              ? error.message
              : "プール初期化に失敗しました",
          variant: "destructive",
        });

        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [
      activeAddress,
      currentChainId,
      writeContractAsync,
      publicClient,
      toast,
      fetchBridgeData,
    ]
  );

  // プール補充関数
  const replenishPool = useCallback(
    async (amount: string) => {
      if (!activeAddress || !writeContractAsync) return null;

      try {
        setIsLoading(true);

        const bridgeAddress = bridgeAddresses[currentChainId] as `0x${string}`;
        const usdcAddress = contractConfig[
          currentChainId as keyof typeof contractConfig
        ]?.erc20Address as `0x${string}`;
        const parsedAmount = parseUnits(amount, 6);

        // ✅ 重要情報ログ: プール補充 - 金額
        console.log(`Pool Replenish: ${amount} USDC`);

        // USDCをブリッジコントラクトに承認
        const approveRequest = await publicClient!.simulateContract({
          address: usdcAddress,
          abi: ERC20ABI,
          functionName: "approve",
          args: [bridgeAddress, parsedAmount],
          account: activeAddress as `0x${string}`,
        });

        const approveHash = await writeContractAsync(approveRequest.request);
        await publicClient!.waitForTransactionReceipt({ hash: approveHash });

        // プール補充を実行
        const { request } = await publicClient!.simulateContract({
          address: bridgeAddress,
          abi: BRIDGE_ABI,
          functionName: "replenishPool",
          args: [parsedAmount],
          account: activeAddress as `0x${string}`,
        });

        const tx = await writeContractAsync(request);

        toast({
          title: "プール補充送信",
          description: `${amount} USDCでプールを補充しました`,
        });

        const receipt = await publicClient!.waitForTransactionReceipt({
          hash: tx,
        });

        if (receipt.status !== "success") {
          throw new Error("プール補充が失敗しました");
        }

        toast({
          title: "プール補充完了",
          description: `${amount} USDCでプールが正常に補充されました`,
        });

        await fetchBridgeData();
        return tx;
      } catch (error) {


        toast({
          title: "プール補充エラー",
          description:
            error instanceof Error ? error.message : "プール補充に失敗しました",
          variant: "destructive",
        });

        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [
      activeAddress,
      currentChainId,
      writeContractAsync,
      publicClient,
      toast,
      fetchBridgeData,
    ]
  );

  // Load transactions from localStorage
  useEffect(() => {
    const storedTxs = localStorage.getItem("bridge_transactions");
    if (storedTxs) {
      try {
        const parsedTxs = JSON.parse(storedTxs);
        // アドレスに関連するトランザクションのみをフィルタリング
        // Note: 現在のバージョンではアドレスでのフィルタリングは行っていない
        setTransactions(parsedTxs);
      } catch (error) {

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

  // Check if approval is needed for Bridge Contract
  const needsApproval = useCallback(
    (amount: string, destinationChainId?: number) => {
      try {
        const parsedAmount = parseUnits(amount, 6);

        // ブリッジコントラクトへの承認をチェック
        // allowanceはコンポーネントで取得された値を使用
        return allowance < parsedAmount;
      } catch (error) {
        return true; // エラーの場合は承認が必要とみなす
      }
    },
    [allowance]
  );

  // 承認とブリッジを自動で実行する関数
  const approveAndBridge = useCallback(
    async (destinationChainId: number, amount: string) => {
      if (!activeAddress || !writeContractAsync) {
        toast({
          title: "エラー",
          description: "ウォレットが接続されていません",
          variant: "destructive",
        });
        return null;
      }

      try {
        // ✅ 重要情報ログ: 自動承認+ブリッジ開始
        console.log(`Auto Process: ${amount} USDC to Chain ${destinationChainId}`);

        // 1. 承認が必要かチェック
        if (needsApproval(amount, destinationChainId)) {


          const approveTx = await approveUSDC(amount, destinationChainId);
          if (!approveTx) {
            throw new Error("承認に失敗しました。ブリッジを中止します。");
          }


        } else {

        }

        // 2. ブリッジを実行
        const bridgeTx = await bridgeUSDC(destinationChainId, amount);
        if (!bridgeTx) {
          throw new Error("ブリッジに失敗しました。");
        }

        // ✅ 重要情報ログ: 自動実行完了
        console.log(`Auto Process Complete: ${bridgeTx}`);

        return bridgeTx;
      } catch (error) {


        toast({
          title: "エラー",
          description:
            error instanceof Error
              ? error.message
              : "承認またはブリッジでエラーが発生しました",
          variant: "destructive",
        });

        return null;
      }
    },
    [
      activeAddress,
      writeContractAsync,
      toast,
      needsApproval,
      approveUSDC,
      bridgeUSDC,
    ]
  );



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
    approveAndBridge, // 新しい関数を追加
    estimateBridgeFee,
    fetchBridgeData,
    initializePool,
    replenishPool,

  };
}
