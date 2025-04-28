import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRaffleContract } from '@/hooks/use-raffle-contract';
import { WinnerModal } from './winner-modal';
import { useRaffleWinEvents } from '@/hooks/use-raffle-win-events';

export function RaffleResult() {
  const raffleContract = useRaffleContract();
  const { winner, prize, isJackpot, showModal, closeModal } = useRaffleWinEvents();
  
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>最新のラッフル結果</CardTitle>
        </CardHeader>
        <CardContent>
          {winner ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">当選者:</span>
                <span className="font-mono text-sm truncate">{winner}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">賞金額:</span>
                <span className="font-semibold">{(Number(prize) / 1e6).toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">ジャックポット:</span>
                <span className={isJackpot ? "text-amber-500 font-bold" : "text-gray-500"}>
                  {isJackpot ? "当選！" : "なし"}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 italic">結果はまだありません</p>
          )}
        </CardContent>
      </Card>
      
      {/* 当選モーダル */}
      <WinnerModal 
        isOpen={showModal} 
        onClose={closeModal} 
        winner={winner || ''} 
        prize={prize} 
        isJackpot={isJackpot} 
      />
    </>
  );
}