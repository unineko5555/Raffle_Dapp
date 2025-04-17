"use client";

import { Users } from "lucide-react";
import { formatAddress } from "@/app/utils/format-address";

interface PlayersListProps {
  players: string[];
  numberOfPlayers: number;
  isLoading: boolean;
  minPlayers?: number;
}

export function PlayersList({ players, numberOfPlayers, isLoading, minPlayers = 3 }: PlayersListProps) {
  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-500" />
          <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">参加者 ({minPlayers}/{minPlayers}必要)</h3>
        </div>
        <span className="text-sm text-slate-500">
          現在の参加者: {isLoading ? "読み込み中..." : numberOfPlayers}人
        </span>
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        {isLoading ? (
          <div className="text-sm text-slate-500">プレイヤー情報を読み込み中...</div>
        ) : (
          players?.map((player, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-full"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600"></div>
              <span className="text-sm font-medium">{formatAddress(player)}</span>
            </div>
          ))
        )}
      </div>
    </>
  );
} 