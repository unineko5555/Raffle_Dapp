"use client";

import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";

interface RaffleCountdownProps {
  initialMinutes?: number;
  initialSeconds?: number;
}

export function RaffleCountdown({ initialMinutes = 0, initialSeconds = 42 }: RaffleCountdownProps) {
  const [minutes, setMinutes] = useState(initialMinutes);
  const [seconds, setSeconds] = useState(initialSeconds);
  const [progress, setProgress] = useState(75); // デフォルト75%

  // カウントダウンタイマー
  useEffect(() => {
    const timer = setInterval(() => {
      if (seconds > 0) {
        setSeconds(seconds - 1);
        setProgress(((minutes * 60 + seconds - 1) / (initialMinutes * 60 + initialSeconds)) * 100);
      } else if (minutes > 0) {
        setMinutes(minutes - 1);
        setSeconds(59);
        setProgress(((minutes * 60 + 59) / (initialMinutes * 60 + initialSeconds)) * 100);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [minutes, seconds, initialMinutes, initialSeconds]);

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">次回抽選まで</h3>
        <span className="text-sm text-slate-500">
          {minutes}:{seconds.toString().padStart(2, "0")}
        </span>
      </div>
      <Progress value={progress} className="h-2 mb-6" />
    </div>
  );
} 