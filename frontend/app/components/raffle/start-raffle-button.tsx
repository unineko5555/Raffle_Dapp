"use client";

import { useState } from "react";
import { Zap, Dices } from "lucide-react";
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
  onStartRaffleWithVRF?: () => Promise<void>;
  onStartRaffleWithMock?: () => Promise<void>;
}

export function StartRaffleButton({
  isConnected,
  isReadyToSendTx,
  numberOfPlayers,
  minPlayers = 3,
  isLoading,
  isSmartAccountLoading,
  onStartRaffle,
  onStartRaffleWithVRF,
  onStartRaffleWithMock
}: StartRaffleButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleRaffleStart = async (mode: 'default' | 'vrf' | 'mock') => {
    try {
      setIsProcessing(true);
      const modeText = mode === 'vrf' ? 'ChainlinkVRF' : mode === 'mock' ? 'Mock(RANDAO)' : '現在の設定';
      if (!confirm(`ラッフルを開始しますか？(${modeText})\n\nこの操作は元に戻せません。`)) {
        setIsProcessing(false);
        return;
      }

      if (mode === 'vrf' && onStartRaffleWithVRF) {
        await onStartRaffleWithVRF();
      } else if (mode === 'mock' && onStartRaffleWithMock) {
        await onStartRaffleWithMock();
      } else {
        await onStartRaffle();
      }
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
    <div className="mt-4 space-y-2">
      {/* ChainlinkVRFボタン */}
      {onStartRaffleWithVRF && (
        <button
          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          onClick={() => handleRaffleStart('vrf')}
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
              ラッフルを開始する (ChainlinkVRF)
            </>
          )}
        </button>
      )}
      
      {/* Mock(RANDAO)ボタン */}
      {onStartRaffleWithMock && (
        <button
          className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          onClick={() => handleRaffleStart('mock')}
          disabled={isProcessing || isLoading || isSmartAccountLoading}
        >
          {isProcessing ? (
            <>
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
              処理中...
            </>
          ) : (
            <>
              <Dices className="w-5 h-5" />
              ラッフルを開始する (Mock-RANDAO)
            </>
          )}
        </button>
      )}
      
      {/* デフォルトボタン（既存のプロパティのみの場合） */}
      {!onStartRaffleWithVRF && !onStartRaffleWithMock && (
        <button
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          onClick={() => handleRaffleStart('default')}
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
      )}
      
      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 text-center">
        (テスト用: プレイヤーが{minPlayers}人以上の場合にラッフルを開始できます)
      </div>
    </div>
  );
} 