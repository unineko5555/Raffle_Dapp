"use client";

import { TokenBridge } from "@/app/components/bridge/token-bridge";
import { useAccount } from "wagmi";
import { useSmartAccountContext } from "@/app/providers/smart-account-provider";

export default function BridgePage() {
  const { isConnected } = useAccount();
  const { isReadyToSendTx } = useSmartAccountContext();
  
  // ウォレット接続状態を確認
  const isWalletConnected = isConnected || isReadyToSendTx;
  
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
            <TokenBridge />
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 text-center">
              <h2 className="text-xl font-semibold mb-4">ウォレットを接続してください</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                ブリッジ機能を使用するには、ウォレットを接続する必要があります。
              </p>
            </div>
          )}
          
          {/* 説明セクション */}
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
              <h3 className="font-bold text-lg mb-3">高速クロスチェーン転送</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Chainlink CCIPを使用して、数分でチェーン間のUSDC転送を実現します。
                トランザクションはセキュアで信頼性の高いCCIPネットワークによって処理されます。
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
              <h3 className="font-bold text-lg mb-3">複数チェーンサポート</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Sepolia、Base Sepolia、Arbitrum Sepoliaの間でシームレスに資金を移動できます。
                各チェーンのラッフルに参加するための資金を簡単に準備できます。
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
              <h3 className="font-bold text-lg mb-3">自動ラッフル参加</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ブリッジした資金で自動的にラッフルに参加するオプションも用意されています。
                一度の操作で資金移動とラッフル参加を完了させることができます。
              </p>
            </div>
          </div>
          
          {/* よくある質問 */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">よくある質問</h2>
            
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">ブリッジ手数料はいくらですか？</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  ブリッジ手数料はChainlink CCIPの現在のガス価格に基づいて計算されます。
                  トランザクション前に正確な手数料が表示されます。
                </p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">USDCのブリッジにはどれくらい時間がかかりますか？</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  通常、ブリッジ処理は2〜5分で完了します。
                  ネットワークの混雑状況によっては、より長い時間がかかる場合があります。
                </p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">ブリッジ処理が失敗した場合はどうなりますか？</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  送信元チェーンでトランザクションが失敗した場合、資金は引き落とされません。
                  CCIP処理中のエラーについては、サポートチームにお問い合わせください。
                </p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">どのチェーンからブリッジできますか？</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  現在、Ethereum Sepolia、Base Sepolia、Arbitrum Sepoliaの間でブリッジが可能です。
                  将来的には対応チェーンを増やす予定です。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
