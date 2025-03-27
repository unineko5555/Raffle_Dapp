import React, { useState, useEffect } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription, 
  SheetFooter,
  SheetClose
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, Sparkles, X, ChevronRight, ArrowUpRight } from "lucide-react";

const UpgradeNotification = ({
  isOpen = false,
  onOpenChange = () => {},
  upgrades = [], // アップグレード情報の配列
  currentVersion = "1.0.0",
  previousVersion = null, // 過去のバージョン（初回ログイン時はnull）
  contractAddress = "0x...",
  upgradeTimestamp = null, // アップグレード日時のタイムスタンプ
  explorerUrl = "", // ブロックエクスプローラのURL
}) => {
  const [showAll, setShowAll] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  
  // 日付をフォーマットする関数
  const formatDate = (timestamp) => {
    if (!timestamp) return "不明";
    
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // アップグレードが行われたかを確認
  const hasUpgrade = previousVersion && previousVersion !== currentVersion;
  
  // localStorageからアップグレード通知の表示状態を取得
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const dismissedUpgrade = localStorage.getItem(`upgrade-dismissed-${currentVersion}`);
      setDismissed(!!dismissedUpgrade);
    }
  }, [currentVersion]);
  
  // アップグレード通知を閉じたときに閉じた状態を保存
  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`upgrade-dismissed-${currentVersion}`, 'true');
      setDismissed(true);
      onOpenChange(false);
    }
  };
  
  // アップグレードがあり、かつまだ閉じていない場合は自動的に開く
  useEffect(() => {
    if (hasUpgrade && !dismissed) {
      onOpenChange(true);
    }
  }, [hasUpgrade, dismissed, onOpenChange]);
  
  // 表示するアップグレード情報を制限
  const visibleUpgrades = showAll ? upgrades : upgrades.slice(0, 3);
  
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <SheetTitle>最新アップグレード</SheetTitle>
            <Badge variant="outline" className="ml-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              v{currentVersion}
            </Badge>
          </div>
          <SheetDescription>
            {hasUpgrade ? (
              <span>コントラクトが v{previousVersion} から v{currentVersion} にアップグレードされました</span>
            ) : (
              <span>現在のバージョン: v{currentVersion}</span>
            )}
          </SheetDescription>
        </SheetHeader>
        
        <div className="py-4">
          {upgradeTimestamp && (
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              アップグレード日時: {formatDate(upgradeTimestamp)}
            </div>
          )}
          
          <div className="space-y-4">
            {visibleUpgrades.map((upgrade, index) => (
              <div 
                key={index} 
                className={`p-3 border rounded-lg ${
                  upgrade.type === 'feature' ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' :
                  upgrade.type === 'fix' ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20' :
                  upgrade.type === 'security' ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20' :
                  'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/20'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {upgrade.type === 'feature' && (
                    <Sparkles className="h-4 w-4 text-green-500 dark:text-green-400" />
                  )}
                  {upgrade.type === 'fix' && (
                    <CheckCircle className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                  )}
                  {upgrade.type === 'security' && (
                    <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                  )}
                  
                  <span className={`text-sm font-medium ${
                    upgrade.type === 'feature' ? 'text-green-600 dark:text-green-400' :
                    upgrade.type === 'fix' ? 'text-blue-600 dark:text-blue-400' :
                    upgrade.type === 'security' ? 'text-amber-600 dark:text-amber-400' :
                    'text-slate-600 dark:text-slate-400'
                  }`}>
                    {upgrade.title}
                  </span>
                </div>
                
                <p className={`text-xs ${
                  upgrade.type === 'feature' ? 'text-green-600/80 dark:text-green-400/80' :
                  upgrade.type === 'fix' ? 'text-blue-600/80 dark:text-blue-400/80' :
                  upgrade.type === 'security' ? 'text-amber-600/80 dark:text-amber-400/80' :
                  'text-slate-600/80 dark:text-slate-400/80'
                }`}>
                  {upgrade.description}
                </p>
              </div>
            ))}
            
            {upgrades.length > 3 && !showAll && (
              <Button 
                variant="ghost" 
                className="w-full text-slate-500"
                onClick={() => setShowAll(true)}
              >
                すべての更新を表示 <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
        
        <SheetFooter className="flex flex-col gap-3 sm:flex-row mt-2">
          {explorerUrl && (
            <Button 
              variant="outline" 
              className="w-full sm:w-auto"
              onClick={() => window.open(`${explorerUrl}/address/${contractAddress}`, '_blank')}
            >
              <ArrowUpRight className="h-4 w-4 mr-2" />
              ブロックエクスプローラで確認
            </Button>
          )}
          
          <SheetClose asChild>
            <Button 
              className="w-full sm:w-auto"
              onClick={handleDismiss}
            >
              理解しました
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default UpgradeNotification;