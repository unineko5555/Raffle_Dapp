"use client";

import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Trophy, 
  Coins
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToastIconProps {
  variant?: 'default' | 'destructive' | 'success' | 'token';
  icon?: React.ReactNode;
  className?: string;
}

export function ToastIcon({ 
  variant = 'default',
  icon,
  className
}: ToastIconProps) {
  // アイコンとカラーのマッピング
  const variantMap = {
    default: {
      icon: <CheckCircle2 className="w-5 h-5" />,
      bgClass: 'bg-indigo-100 dark:bg-indigo-900/30',
      textClass: 'text-indigo-600 dark:text-indigo-400'
    },
    destructive: {
      icon: <XCircle className="w-5 h-5" />,
      bgClass: 'bg-red-100 dark:bg-red-900/30',
      textClass: 'text-red-600 dark:text-red-400'
    },
    success: {
      icon: <CheckCircle2 className="w-5 h-5" />,
      bgClass: 'bg-green-100 dark:bg-green-900/30',
      textClass: 'text-green-600 dark:text-green-400'
    },
    token: {
      icon: <Coins className="w-5 h-5" />,
      bgClass: 'bg-amber-100 dark:bg-amber-900/30',
      textClass: 'text-amber-600 dark:text-amber-400'
    }
  };

  const { icon: defaultIcon, bgClass, textClass } = variantMap[variant];
  
  return (
    <div className={cn(
      "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center", 
      bgClass, 
      textClass,
      className
    )}>
      {icon || defaultIcon}
    </div>
  );
}
