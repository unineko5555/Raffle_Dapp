"use client";

import { Trophy, Copy, RefreshCw, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { formatAddress } from "@/app/utils/format-address";
import { useRindexerHistory } from "@/hooks/use-rindexer-history";
import { useAccount } from "wagmi";
import { useState } from "react";

interface RaffleHistoryItem {
  time: string;
  winner: string;
  prize: string;
  jackpot: string;
}

interface RaffleHistoryProps {
  pastRaffles?: RaffleHistoryItem[];
  currentAddress?: string | null | undefined;
  isLoading?: boolean;
  useRindexer?: boolean;
}

export function RaffleHistory({ 
  pastRaffles: legacyRaffles, 
  currentAddress = "", 
  isLoading: legacyLoading = false,
  useRindexer = false 
}: RaffleHistoryProps) {
  const { toast } = useToast();
  const { address } = useAccount();
  const [showMore, setShowMore] = useState(false);
  
  // Rindexerデータを使用（useRindexerがtrueの場合のみ）
  const rindexerData = useRindexer ? useRindexerHistory() : {
    winnerHistory: [],
    loading: false,
    error: null,
    refreshData: () => {},
    stats: null
  };
  
  const { 
    winnerHistory, 
    loading: rindexerLoading, 
    error: rindexerError, 
    refreshData,
    stats 
  } = rindexerData;

  // データソースを選択
  const isLoading = useRindexer ? rindexerLoading : legacyLoading;
  const userAddress = address || currentAddress || "";

  // データソースに応じて表示データを設定
  const pastRaffles = useRindexer 
    ? winnerHistory.map(entry => ({
        time: new Date(parseInt(entry.blockNumber.toString()) * 12 * 1000).toLocaleString('ja-JP', {
          year: 'numeric',
          month: '2-digit', 
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }),
        winner: entry.winner,
        prize: `${(parseFloat(entry.prize) / 1e6).toFixed(2)} USDC`,
        jackpot: entry.jackpotWon ? "ジャックポット" : "なし"
      }))
    : (legacyRaffles || []);

  if (isLoading) {
    return (
      <div className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="text-xl font-semibold">過去のラッフル当選履歴</h3>
          {useRindexer && <Database className="w-4 h-4 text-blue-500" title="Rindexer Database" />}
        </div>
        <div className="text-center py-8 text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
          履歴を読み込み中...
        </div>
      </div>
    );
  }

  if (rindexerError && useRindexer) {
    return (
      <div className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="text-xl font-semibold">過去のラッフル当選履歴</h3>
          <Database className="w-4 h-4 text-red-500" title="Database Error" />
        </div>
        <div className="text-center py-8">
          <p className="text-red-500 mb-2">データの読み込みに失敗しました</p>
          <p className="text-sm text-slate-500 mb-4">{rindexerError}</p>
          <button 
            onClick={refreshData}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  if (!pastRaffles || pastRaffles.length === 0) {
    return (
      <div className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="text-xl font-semibold">過去のラッフル当選履歴</h3>
          {useRindexer && <Database className="w-4 h-4 text-blue-500" title="Rindexer Database" />}
        </div>
        <div className="text-center py-8 text-slate-500">
          まだ当選履歴がありません
        </div>
      </div>
    );
  }

  const displayedRaffles = showMore ? pastRaffles : pastRaffles.slice(0, 5);

  return (
    <div className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          過去のラッフル当選履歴
          {useRindexer && <Database className="w-4 h-4 text-blue-500" title="Rindexer Database" />}
        </h3>
        
        {useRindexer && stats && (
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="text-blue-600">
              総当選者: {stats.summary.totalWinners}
            </Badge>
            <button 
              onClick={refreshData}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
              title="データを更新"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
      
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 border-b border-slate-200 dark:border-slate-700 grid grid-cols-12 text-xs font-medium text-slate-500 dark:text-slate-400">
          <div className="col-span-3">日時</div>
          <div className="col-span-5">当選アドレス</div>
          <div className="col-span-2 text-center">賞金</div>
          <div className="col-span-2 text-center">ステータス</div>
        </div>
        
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {displayedRaffles.map((raffle, index) => {
            const winnerAddress = raffle.winner || "";
            const isCurrentWalletWinner = winnerAddress && 
              userAddress.toLowerCase() === winnerAddress.toLowerCase();
            
            return (
              <div key={index} className="grid grid-cols-12 p-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                <div className="col-span-3 text-slate-600 dark:text-slate-300 font-mono text-xs">
                  {raffle.time || "不明"}
                </div>
                <div className="col-span-5 font-mono text-xs">
                  {winnerAddress ? (
                    <div className="flex items-center gap-1">
                      <span className={`${isCurrentWalletWinner ? "text-green-600 dark:text-green-400 font-medium" : "text-slate-600 dark:text-slate-300"}`}>
                        {formatAddress(winnerAddress)}
                      </span>
                      <button 
                        onClick={() => {
                          if (winnerAddress) {
                            navigator.clipboard.writeText(winnerAddress);
                            toast({
                              title: "コピー完了",
                              description: "アドレスがクリップボードにコピーされました",
                              variant: "default",
                            });
                          }
                        }}
                        className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                      >
                        <Copy className="w-3 h-3 text-slate-400" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-slate-400">不明</span>
                  )}
                </div>
                <div className="col-span-2 text-center font-medium">
                  {raffle.prize || "0 USDC"}
                </div>
                <div className="col-span-2 flex justify-center items-center gap-1">
                  {isCurrentWalletWinner && (
                    <Badge className="bg-green-500 text-white text-xs">当選</Badge>
                  )}
                  {raffle.jackpot && raffle.jackpot !== "なし" && (
                    <Badge className="bg-amber-500 text-white text-xs">JP</Badge>
                  )}
                  {!isCurrentWalletWinner && (!raffle.jackpot || raffle.jackpot === "なし") && (
                    <span className="text-slate-400 text-xs">-</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {pastRaffles.length > 5 && (
        <div className="mt-2 text-center">
          <button 
            onClick={() => setShowMore(!showMore)}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            {showMore ? "表示を減らす" : `もっと見る (${pastRaffles.length - 5}件)`}
          </button>
        </div>
      )}
    </div>
  );
} 