import React, { useState, useEffect } from 'react';
import { useRaffleContract } from '@/hooks/use-raffle-contract';
import { Button } from '@/components/ui/button';
import { CheckCircle, X, AlertTriangle, Loader2 } from 'lucide-react';
import { useSmartAccountContext } from '@/app/providers/smart-account-provider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const RaffleEntryStatus = () => {
  const { 
    isPlayerEntered, 
    handleCancelEntry, 
    raffleData, 
    isLoading,
    checkPlayerEntered
  } = useRaffleContract();

  // スマートアカウントの情報を取得
  const { smartAccountAddress, isReadyToSendTx } = useSmartAccountContext();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showStatus, setShowStatus] = useState(false);

  // スマートアカウントでの参加状態を確認
  useEffect(() => {
    const checkSmartAccountStatus = async () => {
      if (smartAccountAddress && checkPlayerEntered) {
        try {
          // スマートアカウントアドレスで参加状態を確認
          await checkPlayerEntered(smartAccountAddress);
        } catch (error) {
          console.error('スマートアカウント参加状態確認エラー:', error);
        }
      }
    };

    checkSmartAccountStatus();
  }, [smartAccountAddress, checkPlayerEntered]);

  // 表示条件を統合 (EOAまたはスマートアカウントでプレイヤーが参加している場合)
  useEffect(() => {
    setShowStatus(isPlayerEntered);
  }, [isPlayerEntered]);

  // 参加取り消し処理
  const onCancelEntry = async () => {
    setCancelLoading(true);
    try {
      const result = await handleCancelEntry();
      setDialogOpen(false);
      
      if (result?.success) {
        toast.success('参加を取り消しました', {
          description: `${raffleData.entranceFee ? Number(raffleData.entranceFee) * 0.9 : 9} USDCが返金されました。`,
          duration: 5000
        });
      } else {
        toast.error('参加取り消しに失敗しました', {
          description: result?.error || '不明なエラーが発生しました',
          duration: 5000
        });
      }
    } catch (error) {
      console.error('参加取り消しエラー:', error);
      toast.error('参加取り消しに失敗しました', {
        description: error instanceof Error ? error.message : '不明なエラーが発生しました',
        duration: 5000
      });
    } finally {
      setCancelLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-2">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        <span>ステータス確認中...</span>
      </div>
    );
  }

  // isPlayerEnteredは通常のEOAとスマートアカウントの両方が反映されるようになっている
  if (!showStatus && !isPlayerEntered) {
    return null;
  }

  return (
    <>
      <div className="flex items-center justify-between p-3 my-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <div className="flex items-center">
          <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
          <span className="text-green-700 dark:text-green-300">あなたはこのラッフルに参加しています</span>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="border-red-300 text-red-500 hover:bg-red-50 hover:text-red-600"
          onClick={() => setDialogOpen(true)}
        >
          参加を取り消す
        </Button>
      </div>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center text-amber-600">
              <AlertTriangle className="w-5 h-5 mr-2" />
              参加を取り消しますか？
            </AlertDialogTitle>
            <AlertDialogDescription>
              <p className="mb-2">参加料の90%（{raffleData.entranceFee ? Number(raffleData.entranceFee) * 0.9 : 9} USDC）が返金されます。</p>
              <p className="mb-2">10%（{raffleData.entranceFee ? Number(raffleData.entranceFee) * 0.1 : 1} USDC）はジャックポットに残ります。</p>
              <p className="text-amber-600 font-medium">この操作は取り消せません。</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelLoading}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onCancelEntry();
              }}
              className="bg-red-500 hover:bg-red-600 text-white"
              disabled={cancelLoading}
            >
              {cancelLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  処理中...
                </>
              ) : (
                <>
                  <X className="w-4 h-4 mr-2" />
                  参加を取り消す
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RaffleEntryStatus;
