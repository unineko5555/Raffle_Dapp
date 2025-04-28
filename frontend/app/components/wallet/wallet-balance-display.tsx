"use client";

import { useEffect, memo } from "react";
import { useWalletBalances } from "@/hooks/use-wallet-balances";
import { useAccount } from "wagmi";
import { useSmartAccountContext } from "@/app/providers/smart-account-provider";
import { Badge } from "@/components/ui/badge";
import { Coins, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const WalletBalanceDisplay = memo(function WalletBalanceDisplay() {
  const { isConnected } = useAccount();
  const { isReadyToSendTx } = useSmartAccountContext();
  const { balances, refreshBalances, activeAddress, activeChainId, networkName, walletType } = useWalletBalances();
  
  // ウォレット接続時に残高を取得
  useEffect(() => {
    // コンポーネントのマウント時にデータを取得
    let isMounted = true;
    
    const fetchData = async () => {
      if (isMounted && (isConnected || isReadyToSendTx)) {
        await refreshBalances();
      }
    };
    
    fetchData();
    
    // クリーンアップ関数
    return () => {
      isMounted = false;
    };
  }, [isConnected, isReadyToSendTx, activeChainId, refreshBalances]);
  
  // ウォレットが接続されていない場合
  if (!isConnected && !isReadyToSendTx) {
    return null;
  }
  
  // アドレスの表示を短くする
  const shortenAddress = (address: string | null | undefined) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col p-3 bg-white/10 dark:bg-black/10 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
            <div className="flex items-center mb-1.5 justify-between">
              <div className="flex items-center">
                <Badge variant="outline" className="text-xs bg-secondary/20 mr-2">
                  {walletType}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {shortenAddress(activeAddress)}
                </span>
              </div>
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary ml-2">
                {networkName}
              </Badge>
            </div>
            
            <div className="flex items-center space-x-3">
              {balances.loading ? (
                <div className="flex items-center text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Loading...
                </div>
              ) : (
                <>
                  <div className="flex items-center text-xs">
                    <div className="w-4 h-4 mr-1 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 flex items-center justify-center text-[8px] text-white font-bold">
                      Ξ
                    </div>
                    <span>{Number(balances.eth).toFixed(4)} ETH</span>
                  </div>
                  <div className="flex items-center text-xs">
                    <div className="w-4 h-4 mr-1 rounded-full bg-gradient-to-r from-green-400 to-green-600 flex items-center justify-center text-[8px] text-white font-bold">
                      $
                    </div>
                    <span>{Number(balances.usdc).toFixed(2)} USDC</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            <p>ウォレット残高</p>
            <p className="text-muted-foreground mt-1">
              ETH: {Number(balances.eth).toFixed(6)} / USDC: {Number(balances.usdc).toFixed(6)}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
