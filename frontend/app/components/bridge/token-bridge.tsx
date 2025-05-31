"use client";

import { useState, useEffect } from "react";
import { useTokenBridge } from "@/hooks/use-token-bridge";
import { useChainId } from "wagmi";
import { formatEther } from "viem";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, AlertTriangle, ExternalLink, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { contractConfig } from "@/app/lib/contract-config";

// チェーンの定義を追加
const SUPPORTED_CHAINS = [
  { id: 11155111, name: "Sepolia" },
  { id: 84532, name: "Base Sepolia" },
  { id: 421614, name: "Arbitrum Sepolia" },
];

export function TokenBridge() {
  const chainId = useChainId();
  const {
    activeAddress,
    isLoading,
    isApproving,
    estimatedFee,
    poolBalance,
    destinationChains,
    transactions,
    usdcBalance,
    needsApproval,
    approveUSDC,
    bridgeUSDC,
    approveAndBridge, // 新しい関数を追加
    estimateBridgeFee,
  } = useTokenBridge();

  // 状態管理
  const [amount, setAmount] = useState<string>("0");
  const [destinationChainId, setDestinationChainId] = useState<number | null>(
    null
  );
  const [currentFee, setCurrentFee] = useState<string>("0");
  const [showRecentTx, setShowRecentTx] = useState<boolean>(false);

  // 手数料見積もり
  useEffect(() => {
    const getFee = async () => {
      if (activeAddress && destinationChainId && parseFloat(amount) > 0) {


        const fee = await estimateBridgeFee(destinationChainId, amount);

        if (fee) {
          setCurrentFee(formatEther(fee));
          // ✅ 重要情報ログ: 手数料、金額、宛先チェーン
          console.log(`Fee Estimate: ${formatEther(fee)} ETH | Amount: ${amount} USDC | To: ${getChainName(destinationChainId)}`);
        }
      }
    };

    getFee();
  }, [activeAddress, destinationChainId, amount, estimateBridgeFee]);

  // 宛先チェーン変更ハンドラー
  const handleDestinationChange = (value: string) => {
    setDestinationChainId(parseInt(value));
  };

  // 選択したチェーン名を取得する関数
  const getChainName = (chainId: number | null) => {
    if (!chainId) return null;
    const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
    return chain ? chain.name : null;
  };

  // 金額変更ハンドラー
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  };

  // 最大金額設定
  const handleMaxAmount = () => {
    setAmount(usdcBalance);
  };

  // 承認+ブリッジ自動実行ハンドラー
  const handleApproveAndBridge = async () => {
    if (destinationChainId) {
      const result = await approveAndBridge(destinationChainId, amount);
      if (result) {
        // 成功後にフォームをリセット
        setAmount("0");
      }
    }
  };

  // ブリッジハンドラー（既に承認済みの場合）
  const handleBridge = async () => {
    if (destinationChainId) {
      await bridgeUSDC(destinationChainId, amount);
      // 送信後にフォームをリセット
      setAmount("0");
    }
  };

  // ブリッジ有効性チェック
  const canExecute =
    !isLoading &&
    !isApproving &&
    destinationChainId !== null &&
    parseFloat(amount) > 0 &&
    parseFloat(amount) <= parseFloat(usdcBalance);

  // 最新のトランザクションを取得
  const recentTransactions = transactions.slice(0, 3);

  // エクスプローラーURLを取得
  const getExplorerUrl = (chainId: number, txHash: string) => {
    const baseUrl =
      contractConfig[chainId as keyof typeof contractConfig]?.blockExplorer;
    return baseUrl
      ? `${baseUrl}/tx/${txHash}`
      : `https://sepolia.etherscan.io/tx/${txHash}`;
  };

  // CCIPエクスプローラーURLを取得
  const getCCIPExplorerUrl = (txHash: string) => {
    return `https://ccip.chain.link/tx/${txHash}`;
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 bg-white dark:bg-slate-800 rounded-xl shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">クロスチェーンUSDCブリッジ</h2>
      </div>

      <div className="space-y-4">
        {/* 宛先チェーン選択 */}
        <div className="space-y-2">
          <Label htmlFor="destination-chain">宛先チェーン</Label>
          <Select
            value={destinationChainId?.toString()}
            onValueChange={handleDestinationChange}
          >
            <SelectTrigger id="destination-chain">
              {destinationChainId ? (
                <div>{getChainName(destinationChainId)}</div>
              ) : (
                <SelectValue placeholder="ブリッジ先のチェーンを選択" />
              )}
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CHAINS.map((chain) => (
                <SelectItem
                  key={chain.id}
                  value={chain.id.toString()}
                  disabled={chain.id === chainId}
                >
                  {chain.name}
                  {chain.id === chainId && " (現在のチェーン)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 金額入力 */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="amount">USDC金額</Label>
            <span className="text-xs text-gray-500">
              残高: {usdcBalance} USDC
            </span>
          </div>
          <div className="relative">
            <Input
              id="amount"
              type="text"
              value={amount}
              onChange={handleAmountChange}
              className="pr-16"
              disabled={isLoading || isApproving}
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1 h-6 text-xs text-blue-600 dark:text-blue-400"
              onClick={handleMaxAmount}
              disabled={isLoading || isApproving}
            >
              最大
            </Button>
          </div>
        </div>

        {/* 手数料情報 */}
        {destinationChainId && parseFloat(amount) > 0 && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                CCIP手数料:
              </span>
              <span>{currentFee} ETH</span>
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span>受取金額:</span>
              <span>{amount} USDC</span>
            </div>
          </div>
        )}

        {/* 承認+ブリッジ自動実行ボタン */}
        <Button
          className="w-full"
          onClick={handleApproveAndBridge}
          disabled={!canExecute || isLoading || isApproving}
        >
          {isLoading || isApproving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isApproving ? "承認中..." : "ブリッジ中..."}
            </>
          ) : (
            <>
              {needsApproval(amount) ? "承認してブリッジ" : "ブリッジする"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      {/* 最近のトランザクション */}
      {recentTransactions.length > 0 && (
        <div className="mt-6">
          <div
            className="flex items-center text-sm font-medium cursor-pointer"
            onClick={() => setShowRecentTx(!showRecentTx)}
          >
            <h3 className="text-sm font-medium flex items-center">
              最近のトランザクション
              <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
                {recentTransactions.length}
              </span>
            </h3>
            <ArrowRight
              className={`ml-auto h-4 w-4 transition-transform ${
                showRecentTx ? "rotate-90" : ""
              }`}
            />
          </div>

          {showRecentTx && (
            <div className="mt-2 space-y-2">
              {recentTransactions.map((tx) => (
                <div
                  key={tx.txHash}
                  className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-xs"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">{tx.amount} USDC</span>
                      <span className="text-gray-500 mx-1">→</span>
                      <span>
                        {contractConfig[
                          tx.destinationChain as keyof typeof contractConfig
                        ]?.name || "Unknown"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 flex justify-between items-center">
                    <span className="text-gray-500">
                      {new Date(tx.timestamp).toLocaleString()}
                    </span>
                    <div className="flex items-center gap-2">
                      <a
                        href={getExplorerUrl(tx.sourceChain, tx.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 flex items-center text-xs"
                      >
                        詳細 <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                      <a
                        href={getCCIPExplorerUrl(tx.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 dark:text-green-400 flex items-center text-xs"
                        title="CCIP Explorer で確認"
                      >
                        CCIP <Search className="ml-1 h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 注意事項 */}
      <div className="mt-6 text-xs text-gray-500 dark:text-gray-400">
        <p>
          * ブリッジしたトークンが宛先チェーンに届くまで数分かかる場合があります
        </p>
        <p>* トークン転送にはCCIP手数料がかかります</p>
      </div>
    </div>
  );
}
