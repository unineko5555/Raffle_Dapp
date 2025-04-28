"use client";

import { Users, Trophy, Sparkles, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { formatAddress } from "@/app/utils/format-address";

interface UserProfileProps {
  address?: string;
  smartAccountAddress: string | null;
  user?: { email?: string };
  userStats: {
    totalParticipations: number;
    totalWins: number;
    jackpotWins: number;
  };
  isLoading: boolean;
  isConnected: boolean;
}

export function UserProfile({
  address,
  smartAccountAddress,
  user,
  userStats,
  isLoading,
  isConnected
}: UserProfileProps) {
  const { toast } = useToast();

  const handleCopyAddress = () => {
    const addrToCopy = smartAccountAddress || address;
    if (addrToCopy) {
      navigator.clipboard.writeText(addrToCopy);
      toast({
        title: "コピー完了",
        description: "アドレスがクリップボードにコピーされました",
        variant: "default",
      });
    }
  };

  return (
    <>
      <h3 className="text-xl font-bold mb-4">ユーザー情報</h3>
      <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded-xl font-mono text-sm mb-6 break-all flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isConnected || smartAccountAddress ? (
            <span>{formatAddress(smartAccountAddress || address || user?.email || "N/A")}</span>
          ) : (
            <span className="text-slate-400">未接続</span>
          )}
          {(isConnected || smartAccountAddress) && (
            <button 
              onClick={handleCopyAddress}
              className="ml-1 p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500" />
            </button>
          )}
        </div>
        {smartAccountAddress ? (
          <Badge
            variant="outline"
            className="ml-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 cursor-pointer"
            onClick={() => window.open(`https://sepolia.etherscan.io/address/${smartAccountAddress}`, '_blank')}
          >
            スマートアカウント
          </Badge>
        ) : isConnected ? (
          <Badge
            variant="outline"
            className="ml-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800"
          >
            EOA
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="ml-2 bg-slate-100 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
          >
            未接続
          </Badge>
        )}
      </div>

      <div className="space-y-4 mb-8">
        {isLoading ? (
          <div className="py-8 text-center text-slate-500">ユーザー統計情報を読み込み中...</div>
        ) : (
          [
            { label: "総参加数", value: userStats.totalParticipations.toString(), icon: <Users className="w-4 h-4 text-slate-400" /> },
            { label: "勝利回数", value: userStats.totalWins.toString(), icon: <Trophy className="w-4 h-4 text-slate-400" /> },
            { label: "ジャックポット獲得", value: userStats.jackpotWins.toString(), icon: <Sparkles className="w-4 h-4 text-slate-400" /> }
          ].map((item, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="flex items-center gap-2">
                {item.icon}
                <span className="text-sm">{item.label}</span>
              </div>
              <span className="font-bold">{item.value}</span>
            </div>
          ))
        )}
      </div>
    </>
  );
} 