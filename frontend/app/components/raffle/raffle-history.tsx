"use client";

import { Trophy, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { formatAddress } from "@/app/utils/format-address";

interface RaffleHistoryItem {
  time: string;
  winner: string;
  prize: string;
  jackpot: string;
}

interface RaffleHistoryProps {
  pastRaffles: RaffleHistoryItem[];
  currentAddress: string | null | undefined;
  isLoading: boolean;
}

export function RaffleHistory({ pastRaffles, currentAddress = "", isLoading }: RaffleHistoryProps) {
  const { toast } = useToast();

  if (isLoading || !pastRaffles || pastRaffles.length === 0) {
    return null;
  }

  const userAddress = currentAddress || "";

  return (
    <div className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-6">
      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-amber-500" />
        過去のラッフル当選履歴
      </h3>
      
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 border-b border-slate-200 dark:border-slate-700 grid grid-cols-12 text-xs font-medium text-slate-500 dark:text-slate-400">
          <div className="col-span-3">日時</div>
          <div className="col-span-5">当選アドレス</div>
          <div className="col-span-2 text-center">賞金</div>
          <div className="col-span-2 text-center">ステータス</div>
        </div>
        
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {pastRaffles.slice(0, 5).map((raffle, index) => {
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
          <button className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
            もっと見る ({pastRaffles.length - 5}件)
          </button>
        </div>
      )}
    </div>
  );
} 