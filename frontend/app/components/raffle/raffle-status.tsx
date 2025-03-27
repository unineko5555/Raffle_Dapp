import React, { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, Users, AlertCircle, CheckCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

// ラッフルの状態を表す列挙型
const RaffleState = {
  OPEN: 0,
  CALCULATING_WINNER: 1,
  CLOSED: 2
};

const RaffleStatus = ({ 
  raffleState = RaffleState.OPEN,
  playerCount = 0,
  minPlayers = 3,
  minTimeAfterMinPlayers = 60, // 秒単位
  minPlayersReachedTime = null,
  onTimerComplete = () => {}
}) => {
  const [timeRemaining, setTimeRemaining] = useState(minTimeAfterMinPlayers);
  const [progress, setProgress] = useState(0);

  // ステータス表示テキストとスタイルを設定
  const getStatusDisplay = () => {
    switch (raffleState) {
      case RaffleState.OPEN:
        return {
          text: "参加受付中",
          color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
        };
      case RaffleState.CALCULATING_WINNER:
        return {
          text: "当選者計算中",
          color: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
        };
      case RaffleState.CLOSED:
        return {
          text: "抽選終了",
          color: "bg-slate-100 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
        };
      default:
        return {
          text: "不明",
          color: "bg-slate-100 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
        };
    }
  };
  
  // タイマーを管理するためのuseEffect
  useEffect(() => {
    // プレイヤー数が最小に達し、かつステータスがオープンの場合のみタイマーを実行
    if (playerCount >= minPlayers && raffleState === RaffleState.OPEN && minPlayersReachedTime) {
      const currentTime = Math.floor(Date.now() / 1000); // 現在時間（秒）
      const elapsedTime = currentTime - minPlayersReachedTime;
      const remaining = Math.max(0, minTimeAfterMinPlayers - elapsedTime);
      
      setTimeRemaining(remaining);
      setProgress((remaining / minTimeAfterMinPlayers) * 100);
      
      // タイマーが0になったらコールバックを実行
      if (remaining <= 0) {
        onTimerComplete();
        return;
      }
      
      // 1秒ごとにタイマーを更新
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          const newTime = Math.max(0, prev - 1);
          setProgress((newTime / minTimeAfterMinPlayers) * 100);
          
          if (newTime <= 0) {
            clearInterval(timer);
            onTimerComplete();
          }
          
          return newTime;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [playerCount, minPlayers, raffleState, minPlayersReachedTime, minTimeAfterMinPlayers, onTimerComplete]);
  
  // 残り時間を分:秒形式でフォーマット
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const statusDisplay = getStatusDisplay();
  const isReady = playerCount >= minPlayers;
  
  return (
    <div className="w-full space-y-3 p-4 bg-white dark:bg-slate-800 rounded-xl shadow">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">ラッフルステータス</h3>
        <Badge variant="outline" className={statusDisplay.color}>
          {raffleState === RaffleState.CALCULATING_WINNER && (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          )}
          {statusDisplay.text}
        </Badge>
      </div>
      
      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
        <Users className="w-4 h-4" />
        <span>参加者: </span>
        <span className="font-bold">{playerCount}/{minPlayers}必要</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help">
                <AlertCircle className="w-4 h-4 text-slate-400" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>ラッフルを開始するには最低{minPlayers}人の参加者が必要です</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      {raffleState === RaffleState.OPEN && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <Clock className="w-4 h-4" />
              <span>抽選まで: </span>
              {isReady ? (
                <span className="font-mono font-bold">{formatTime(timeRemaining)}</span>
              ) : (
                <span className="text-slate-500">参加者不足</span>
              )}
            </div>
            {isReady && timeRemaining <= 15 && (
              <Badge className="bg-red-500 text-white border-0 animate-pulse">
                まもなく抽選
              </Badge>
            )}
          </div>
          
          {isReady && (
            <Progress value={progress} className="h-2" />
          )}
          
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isReady 
              ? `${minPlayers}人目の参加から${minTimeAfterMinPlayers}秒後に自動的に抽選が実行されます`
              : `抽選を開始するにはあと${minPlayers - playerCount}人の参加者が必要です`}
          </p>
        </div>
      )}
      
      {raffleState === RaffleState.CALCULATING_WINNER && (
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Chainlink VRFにより公平な抽選を実行中...</span>
        </div>
      )}
      
      {raffleState === RaffleState.CLOSED && (
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <CheckCircle className="w-4 h-4" />
          <span>抽選は完了しました。次のラウンドをお待ちください。</span>
        </div>
      )}
    </div>
  );
};

export default RaffleStatus;