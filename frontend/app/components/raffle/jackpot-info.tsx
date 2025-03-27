import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, TrendingUp, DollarSign, Info, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const JackpotInfo = ({ 
  jackpotAmount = 0,
  entranceFee = 10,
  jackpotProbability = 1, // 百分率表記（例: 1は1%）
  contributionRate = 10 // 百分率表記（例: 10は10%）
}) => {
  // USDCの6桁小数点を考慮してフォーマット
  const formatUSDC = (amount) => {
    return (amount / 1e6).toLocaleString('ja-JP', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };
  
  // おおよその当選確率を計算するための補助関数
  const getWinProbabilityText = (percentage) => {
    if (percentage < 0.1) return "極めて低い（0.1%未満）";
    if (percentage < 1) return "非常に低い（約" + percentage.toFixed(1) + "%）";
    return "約" + percentage.toFixed(1) + "%";
  };
  
  // ジャックポット獲得までの概算参加回数
  const estimatedTriesToWin = Math.round(100 / jackpotProbability);
  
  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-4 bg-gradient-to-r from-amber-400 to-orange-500 text-white">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            ジャックポットシステム
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-white hover:bg-white/20 rounded-full p-1">
                  <HelpCircle className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-sm">
                <p>ジャックポットは全参加者の参加料の一部が蓄積される特別賞金です。約1%の確率で当選すると、通常の賞金に加えてジャックポット全額が獲得できます。当選しなかった場合、ジャックポットは次回に繰り越されます。</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-500" />
            <span className="font-medium">現在のジャックポット額</span>
          </div>
          <div className="text-xl font-bold">{formatUSDC(jackpotAmount)} USDC</div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-start gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <Info className="w-5 h-5 text-slate-400 mt-0.5" />
            <div>
              <p className="font-medium">ジャックポット蓄積方法</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">参加料の{contributionRate}%（{formatUSDC(entranceFee * contributionRate / 100)} USDC）がジャックポットに蓄積されます</p>
            </div>
          </div>
          
          <div className="flex items-start gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <TrendingUp className="w-5 h-5 text-slate-400 mt-0.5" />
            <div>
              <p className="font-medium">当選確率</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                ジャックポットの当選確率: {getWinProbabilityText(jackpotProbability)}
                <br />
                <span className="text-xs">（平均{estimatedTriesToWin}回の参加で1回の当選確率）</span>
              </p>
            </div>
          </div>
        </div>
        
        <div className="text-xs text-slate-500 dark:text-slate-400 italic">
          ※ジャックポットに当選しなかった場合、蓄積されたジャックポットは次回に繰り越されます
        </div>
      </CardContent>
    </Card>
  );
};

export default JackpotInfo;