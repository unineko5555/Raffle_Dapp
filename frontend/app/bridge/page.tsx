"use client";

import { TokenBridge } from "@/app/components/bridge/token-bridge";
import { LiquidityManager } from "@/app/components/bridge/liquidity-manager";
// import { BridgeConfig } from "@/app/components/bridge/bridge-config";
import { useAccount } from "wagmi";
import { useSmartAccountContext } from "@/app/providers/smart-account-provider";
import { useTokenBridge } from "@/hooks/use-token-bridge";

export default function BridgePage() {
  const { isConnected, address } = useAccount();
  const { isReadyToSendTx } = useSmartAccountContext();
  const { bridgeInfo, activeAddress } = useTokenBridge();
  
  // ウォレット接続状態を確認
  const isWalletConnected = isConnected || isReadyToSendTx;
  
  // テスト環境のため、管理者チェックを削除し全ユーザーに表示
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 text-slate-900 dark:text-slate-100">
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-6 text-center">USDCクロスチェーンブリッジ</h1>
        
        <div className="max-w-3xl mx-auto">
          <div className="mb-6 text-center">
            <p className="text-gray-600 dark:text-gray-300">
              Sepolia、Base Sepolia、Arbitrum Sepolia間でUSDCをブリッジします。
              Chainlink CCIPを使用したシームレスなクロスチェーン体験をお楽しみください。
            </p>
          </div>

          {isWalletConnected ? (
            <>
              <TokenBridge />
              <LiquidityManager />
            </>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 text-center">
              <h2 className="text-xl font-semibold mb-4">ウォレットを接続してください</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                ブリッジ機能を使用するには、ウォレットを接続する必要があります。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
