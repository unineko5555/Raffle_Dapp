import React, { useState } from 'react';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, DollarSign, AlertTriangle, ChevronDown, ChevronUp, CheckCircle } from "lucide-react";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

const USDCBalance = ({
  balance = 0,
  entranceFee = 10 * 1e6, // 10 USDC、6桁の小数点を考慮
  isApproved = false,
  isConnected = false,
  isLoading = false,
  onApprove = () => {},
  onEnterRaffle = () => {},
  raffleState = 0, // 0: OPEN, 1: CALCULATING_WINNER, 2: CLOSED
}) => {
  const [showDetails, setShowDetails] = useState(false);
  
  // 残高が十分かチェック
  const hasEnoughBalance = balance >= entranceFee;
  
  // USDCの6桁小数点を考慮してフォーマット
  const formatUSDC = (amount) => {
    return (amount / 1e6).toLocaleString('ja-JP', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };
  
  // 状態に基づいてラッフル参加ボタンの状態を取得
  const getEnterButtonState = () => {
    if (!isConnected) return { disabled: true, text: "ウォレットを接続してください" };
    if (raffleState !== 0) return { disabled: true, text: "ラッフルは現在開催されていません" };
    if (isLoading) return { disabled: true, text: "処理中..." };
    if (!hasEnoughBalance) return { disabled: true, text: "残高不足" };
    if (!isApproved) return { disabled: true, text: "USDCの承認が必要です" };
    
    return { disabled: false, text: `ラッフルに参加する (${formatUSDC(entranceFee)} USDC)` };
  };
  
  const enterButtonState = getEnterButtonState();
  
  return (
    <Card className="overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">USDC残高</p>
              <p className="text-xl font-bold">{formatUSDC(balance)} USDC</p>
            </div>
          </div>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-8"
                  onClick={() => setShowDetails(!showDetails)}
                >
                  {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>詳細を{showDetails ? '隠す' : '表示'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {!hasEnoughBalance && isConnected && (
          <Alert className="mb-3 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="text-amber-600 dark:text-amber-400">残高不足</AlertTitle>
            <AlertDescription className="text-sm">
              ラッフルに参加するには少なくとも {formatUSDC(entranceFee)} USDCが必要です。
            </AlertDescription>
          </Alert>
        )}
        
        {showDetails && (
          <div className="space-y-3 mt-4 border-t pt-4 border-slate-100 dark:border-slate-700">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600 dark:text-slate-400">参加料</span>
              <span className="font-medium">{formatUSDC(entranceFee)} USDC</span>
            </div>
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600 dark:text-slate-400">ジャックポット寄与分 (10%)</span>
              <span className="font-medium">{formatUSDC(entranceFee * 0.1)} USDC</span>
            </div>
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600 dark:text-slate-400">賞金プール寄与分 (90%)</span>
              <span className="font-medium">{formatUSDC(entranceFee * 0.9)} USDC</span>
            </div>
            
            <div className="flex justify-between items-center text-sm font-medium pt-2 border-t border-slate-100 dark:border-slate-700">
              <span>USDC承認状態</span>
              <span className={isApproved ? "text-green-500" : "text-amber-500"}>
                {isApproved ? (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    <span>承認済み</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    <span>未承認</span>
                  </div>
                )}
              </span>
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="p-4 pt-0 flex flex-col gap-2">
        {!isApproved && isConnected && hasEnoughBalance && raffleState === 0 && (
          <Button 
            variant="outline" 
            className="w-full"
            onClick={onApprove}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                承認処理中...
              </>
            ) : (
              <>USDCの使用を承認</>
            )}
          </Button>
        )}
        
        <Button 
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
          onClick={onEnterRaffle}
          disabled={enterButtonState.disabled || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              処理中...
            </>
          ) : (
            enterButtonState.text
          )}
        </Button>
        
        {/* ガス代無料の注釈 */}
        <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-1">
          ガス代は当サービスが負担します（アカウントアブストラクション対応）
        </p>
      </CardFooter>
    </Card>
  );
};

export default USDCBalance;