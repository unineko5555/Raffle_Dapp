import React from 'react';
import Image from 'next/image';
import Confetti from 'react-confetti';
import { formatAddress } from '@/app/utils/format-address';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface WinnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  winner: string;
  prize: string;
  isJackpot: boolean;
}

export function WinnerModal({ isOpen, onClose, winner, prize, isJackpot }: WinnerModalProps) {
  const formattedPrize = (Number(prize) / 1e6).toFixed(2);
  
  // confetti用の画面サイズを取得
  const [windowSize, setWindowSize] = React.useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0
  });
  
  React.useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);
  
  return (
    <>
      {isOpen && <Confetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={200} />}
      
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold">
              {isJackpot ? '🎉 ジャックポット当選！！ 🎉' : '🎊 当選おめでとうございます！ 🎊'}
            </DialogTitle>
            <DialogDescription className="text-center">
              {isJackpot 
                ? 'おめでとうございます！特別なジャックポットに当選しました！'
                : 'おめでとうございます！ラッフルで当選しました！'}
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                当選アドレス: {formatAddress(winner)}
              </div>
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center justify-center py-4">
            <div className="relative w-40 h-40 mb-4">
              <Image
                src={isJackpot ? '/placeholder.svg' : '/placeholder.svg'}
                alt={isJackpot ? "ジャックポットトロフィー" : "トロフィー"}
                fill
                className="object-contain"
                onError={(e) => {
                  // フォールバック画像
                  (e.target as HTMLImageElement).src = '/placeholder.svg';
                }}
              />
            </div>
            
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">獲得賞金</h3>
              <p className="text-3xl font-bold text-green-600">{formattedPrize} USDC</p>
            </div>
            
            <div className="mt-4 text-center text-sm text-gray-500">
              <p>賞金は自動的にあなたのウォレットに送金されました</p>
            </div>
          </div>
          
          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-center">
            <Button onClick={onClose} className="w-full sm:w-auto">
              閉じる
            </Button>
            <Button variant="outline" className="w-full sm:w-auto" 
              onClick={() => window.open('https://twitter.com/intent/tweet?text=' + 
                encodeURIComponent(`ラッフルDAppで${isJackpot ? 'ジャックポット' : ''}当選し、${formattedPrize} USDCを獲得しました！ #RaffleDApp #Crypto`))}>
              Twitterでシェア
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}