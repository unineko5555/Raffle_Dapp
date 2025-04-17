"use client";

import { Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function RaffleHeader() {
  return (
    <div className="flex justify-between items-center mb-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold">進行中のラッフル</h2>
        <Badge
          variant="outline"
          className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
        >
          アクティブ
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-indigo-500" />
        <span className="text-xs text-slate-500">スマートコントラクト検証済み</span>
      </div>
    </div>
  );
} 