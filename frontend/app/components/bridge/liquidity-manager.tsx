"use client";

import { useState, useEffect } from "react";
import { useTokenBridge } from "@/hooks/use-token-bridge";
import { useChainId } from "wagmi";
import { formatEther } from "viem";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

export function LiquidityManager() {
  const chainId = useChainId();
  const {
    isLoading,
    poolBalance,
    destinationChains,
    initializePool,
    replenishPool,
    fetchBridgeData,
  } = useTokenBridge();
  
  const [amount, setAmount] = useState<string>("0");
  const [selectedChain, setSelectedChain] = useState<string | null>(null);
  
  useEffect(() => {
    // 初期選択チェーンを設定
    if (destinationChains.length > 0 && !selectedChain) {
      // チェーンIDで現在のチェーンを検索
      const chainInfo = destinationChains.find(chain => chain.chainId === chainId);
      // もし現在のチェーンがなければ、最初のチェーンを選択
      if (!chainInfo) {
        setSelectedChain(destinationChains[0].chainId.toString());
      }
    }
  }, [destinationChains, selectedChain, chainId]);
  
  // 金額変更ハンドラー
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  };
  
  // 初期化ハンドラー
  const handleInitialize = async () => {
    if (parseFloat(amount) <= 0) return;
    await initializePool(amount);
    setAmount("0");
  };
  
  // 補充ハンドラー
  const handleReplenish = async () => {
    if (parseFloat(amount) <= 0) return;
    await replenishPool(amount);
    setAmount("0");
  };
  
  // 再読込ハンドラー
  const handleRefresh = () => {
    fetchBridgeData();
  };
  
  // チェーンセレクタ用のチェーンリスト
  const availableChains = destinationChains.filter(chain => chain.chainId !== chainId);
  
  return (
    <div className="w-full max-w-md mx-auto mt-8 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">流動性管理</h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">データを再読込</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600 dark:text-gray-400">現在の残高:</span>
          <span className="font-medium">{poolBalance} USDC</span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          各チェーンにUSDCを供給して、クロスチェーンブリッジを機能させる
        </div>
      </div>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-md">プール流動性を追加</CardTitle>
          <CardDescription>選択したチェーンに流動性を追加します</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid w-full gap-2">
              <Label htmlFor="amount">USDC金額</Label>
              <Input
                id="amount"
                type="text"
                value={amount}
                onChange={handleAmountChange}
                disabled={isLoading}
                className="text-right"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={handleInitialize}
                disabled={isLoading || parseFloat(amount) <= 0}
                variant="outline"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    処理中...
                  </>
                ) : (
                  "プール初期化"
                )}
              </Button>
              <Button
                onClick={handleReplenish}
                disabled={isLoading || parseFloat(amount) <= 0}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    処理中...
                  </>
                ) : (
                  "プール補充"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="mt-4">
        <h3 className="text-sm font-medium mb-2">チェーン別流動性状態</h3>
        <div className="space-y-2">
          {destinationChains.map((chain) => (
            <div
              key={chain.chainId}
              className={`p-3 rounded-lg flex justify-between items-center
                ${chain.poolLow ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}
            >
              <div className="flex items-center">
                {chain.poolLow ? (
                  <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                )}
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {chain.name}
                    {chain.chainId === chainId && (
                      <span className="ml-2 px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                        接続中
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {chain.supported ? "サポート済" : "未サポート"} ・ 
                    {chain.poolLow ? "流動性不足" : "流動性十分"}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    プール残高: <span className="font-mono">{chain.poolBalance} USDC</span>
                  </div>
                </div>
              </div>
              <Badge variant={chain.poolLow ? "destructive" : "outline"}>
                {chain.poolLow ? "追加必要" : "正常"}
              </Badge>
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-6 text-xs text-gray-500 dark:text-gray-400">
        <p>* 各チェーンに適切な流動性がないと、ブリッジ機能が使用できません</p>
        <p>* ポジティブバランスが必要なチェーンにのみ供給することをお勧めします</p>
      </div>
    </div>
  );
}
