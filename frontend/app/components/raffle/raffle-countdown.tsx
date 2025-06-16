"use client";

import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";

interface RaffleCountdownProps {
  minPlayersReachedTime: number; // Timestamp when minimum players was reached
  raffleState: number;
  playerCount: number;
  minimumPlayers: number;
  minTimeAfterMinPlayers?: number; // Duration to wait after min players reached (in seconds)
}

export function RaffleCountdown({ 
  minPlayersReachedTime, 
  raffleState, 
  playerCount, 
  minimumPlayers,
  minTimeAfterMinPlayers = 60 // Default 1 minute
}: RaffleCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [progress, setProgress] = useState(0);

  // Calculate time remaining and progress
  useEffect(() => {
    // Only show countdown if minimum players reached and raffle is open
    if (minPlayersReachedTime === 0 || playerCount < minimumPlayers || raffleState !== 0) {
      setTimeRemaining(0);
      setProgress(0);
      return;
    }

    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000); // Current time in seconds
      const elapsed = now - minPlayersReachedTime;
      const remaining = Math.max(0, minTimeAfterMinPlayers - elapsed);
      
      setTimeRemaining(remaining);
      
      // Calculate progress (how much time has passed)
      const progressPercent = minTimeAfterMinPlayers > 0 
        ? Math.min(100, (elapsed / minTimeAfterMinPlayers) * 100)
        : 100;
      setProgress(progressPercent);
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const timer = setInterval(updateCountdown, 1000);

    return () => clearInterval(timer);
  }, [minPlayersReachedTime, minTimeAfterMinPlayers, playerCount, minimumPlayers, raffleState]);

  // Convert seconds to minutes and seconds for display
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  // Don't show countdown if minimum players not reached or raffle not open
  if (minPlayersReachedTime === 0 || playerCount < minimumPlayers || raffleState !== 0) {
    return (
      <div className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">
            {playerCount < minimumPlayers 
              ? `最小参加者数まで ${minimumPlayers - playerCount} 人`
              : raffleState !== 0 
                ? "抽選処理中"
                : "抽選待機中"
            }
          </h3>
          <span className="text-sm text-slate-500">
            {playerCount < minimumPlayers && `${playerCount}/${minimumPlayers}`}
          </span>
        </div>
        <Progress value={playerCount < minimumPlayers ? (playerCount / minimumPlayers) * 100 : 100} className="h-2 mb-6" />
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">
          {timeRemaining > 0 ? "次回抽選まで" : "抽選準備完了"}
        </h3>
        <span className="text-sm text-slate-500">
          {timeRemaining > 0 
            ? `${minutes}:${seconds.toString().padStart(2, "0")}`
            : "準備完了"
          }
        </span>
      </div>
      <Progress value={progress} className="h-2 mb-6" />
    </div>
  );
} 