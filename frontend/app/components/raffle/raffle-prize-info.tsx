"use client";

import { Sparkles, Trophy } from "lucide-react";

interface RafflePrizeInfoProps {
  numberOfPlayers: number;
  isLoading: boolean;
}

export function RafflePrizeInfo({ numberOfPlayers, isLoading }: RafflePrizeInfoProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white text-center transform transition-transform hover:scale-[1.02] relative overflow-hidden group">
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <Sparkles className="w-6 h-6 mx-auto mb-2 text-white/80" />
        <h3 className="text-lg font-medium opacity-90 mb-2">当選賞金</h3>
        <div className="text-3xl font-bold">
          {isLoading ? "読み込み中..." : `${(numberOfPlayers * 9).toFixed(2)} USDC`}
        </div>
        <div className="mt-2 text-xs text-white/70">
          ≈ {isLoading ? "..." : `${(numberOfPlayers * 9 * 150).toFixed(0)}円`}
        </div>
      </div>
      <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl p-6 text-white text-center transform transition-transform hover:scale-[1.02] relative overflow-hidden group">
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <Trophy className="w-6 h-6 mx-auto mb-2 text-white/80" />
        <h3 className="text-lg font-medium opacity-90 mb-2">ジャックポット</h3>
        <div className="text-3xl font-bold">
          {isLoading ? "読み込み中..." : `${(numberOfPlayers * 1).toFixed(2)} USDC`}
        </div>
        <div className="mt-2 text-xs text-white/70">
          ≈ {isLoading ? "..." : `${(numberOfPlayers * 1 * 150).toFixed(0)}円`}
        </div>
      </div>
    </div>
  );
} 