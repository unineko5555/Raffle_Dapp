"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { ToastIcon } from "@/components/ui/toast-icon";

interface StartRaffleButtonProps {
  isConnected: boolean;
  isReadyToSendTx: boolean;
  numberOfPlayers: number;
  minPlayers?: number;
  isLoading: boolean;
  isSmartAccountLoading: boolean;
  onStartRaffle: () => Promise<void>;
}

export function StartRaffleButton({
  isConnected,
  isReadyToSendTx,
  numberOfPlayers,
  minPlayers = 3,
  isLoading,
  isSmartAccountLoading,
  onStartRaffle
}: StartRaffleButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleStartRaffle = async () => {
    try {
      setIsProcessing(true);
      if (!confirm('ラッフルを開始しますか？この操作は元に戻せません。\n\n参加者の中からランダムに当選者が選ばれます。')) {
        setIsProcessing(false);
        return;
      }

      await onStartRaffle();
    } catch (error) {
      console.error('ラッフル開始エラー:', error);
      toast({
        title: "エラー",
        description: "ラッフル開始中にエラーが発生しました",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!(isConnected || isReadyToSendTx) || numberOfPlayers < minPlayers) {
    return null;
  }

  return (
    <div className="mt-4">
      <button
        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
        onClick={handleStartRaffle}
        disabled={isProcessing || isLoading || isSmartAccountLoading}
      >
        {isProcessing ? (
          <>
            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
            処理中...
          </>
        ) : (
          <>
            <Zap className="w-5 h-5" />
            ラッフルを開始する (手動Upkeep)
          </>
        )}
      </button>
      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 text-center">
        (テスト用: プレイヤーが{minPlayers}人以上の場合にラッフルを開始できます)
      </div>
    </div>
  );
} 