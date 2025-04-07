"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useRaffleContract } from "@/hooks/use-raffle-contract";
import { RaffleABI } from "@/app/lib/contract-config";
import { useAccount } from "wagmi";
import { useWeb3Auth } from "@/hooks/use-web3auth";
import { useSmartAccountContext } from "@/app/providers/smart-account-provider";
import { encodeAbiParameters, parseAbiParameters, encodeFunctionData } from "viem";

export interface EnterRaffleButtonProps {
  raffleAddress: string;
  entryFee: bigint;
  isRaffleOpen: boolean;
  onSuccess?: () => void;
}

export function EnterRaffleButton({ 
  raffleAddress, 
  entryFee, 
  isRaffleOpen, 
  onSuccess 
}: EnterRaffleButtonProps) {
  const { toast } = useToast();
  const { address, isConnected } = useAccount();
  const { provider: web3AuthProvider, getAddress: getWeb3AuthAddress } = useWeb3Auth();
  const { 
    smartAccountClient, 
    smartAccountAddress,
    isReadyToSendTx,
    sendUserOperation
  } = useSmartAccountContext();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  
  // useRaffleContractフックからは必要な関数と状態を取得
  const { handleEnterRaffle, isLoading: isContractLoading } = useRaffleContract();
  
  // ユーザーがラッフルに参加できるかのチェック
  const canEnterRaffle = isRaffleOpen && (isConnected || isReadyToSendTx);
  
  // ラッフルに参加する際の実装
  const enterRaffle = async () => {
    if (!canEnterRaffle) {
      toast({
        title: "エラー",
        description: "ラッフルが開催中でないか、ウォレットが接続されていません。",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    setIsEntering(true);
    
    try {
      let txHash;
      
      // スマートアカウントを使用している場合
      if (smartAccountClient && isReadyToSendTx) {
        console.log("スマートアカウントでラッフルに参加中...");
        
        // enterRaffle関数のデータをエンコード
        const callData = encodeFunctionData({
          abi: RaffleABI,
          functionName: 'enterRaffle',
          args: []
        });
        
        // UserOperationを送信
        const { txHash: transactionHash } = await sendUserOperation(
          raffleAddress,
          callData,
          entryFee
        );
        
        txHash = transactionHash;
      } 
      // 通常のウォレット接続の場合
      else if (address) {
        console.log("通常ウォレットでラッフルに参加中...");
        
        // handleEnterRaffle関数を使用してラッフルに参加
        const result = await handleEnterRaffle();
        if (result && result.success && result.txHash) {
          txHash = result.txHash;
        } else {
          throw new Error(result?.error || "ラッフル参加に失敗しました");
        }
      } else {
        throw new Error("ウォレットが正しく接続されていません");
      }
      
      console.log("トランザクションハッシュ:", txHash);
      
      toast({
        title: "ラッフル参加成功！",
        description: smartAccountClient 
          ? "スマートウォレットでラッフルに参加しました。トランザクションが確認されるまでお待ちください。" 
          : "ラッフルに参加しました。トランザクションが確認されるまでお待ちください。",
        variant: "default",
      });
      
      // 成功時のコールバック
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("ラッフル参加エラー:", error);
      
      const errorMessage = error instanceof Error 
        ? error.message
        : "不明なエラーが発生しました";
      
      toast({
        title: "ラッフル参加エラー",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setIsEntering(false);
    }
  };
  
  return (
    <Button
      onClick={enterRaffle}
      disabled={!canEnterRaffle || isLoading || isContractLoading}
      className="w-full mt-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          処理中...
        </>
      ) : smartAccountClient ? (
        "ガスレスでラッフルに参加する"
      ) : (
        "ラッフルに参加する"
      )}
    </Button>
  );
}
