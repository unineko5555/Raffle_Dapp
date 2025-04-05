"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useRaffleContract } from "@/hooks/use-raffle-contract";
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
  const { contract } = useRaffleContract(raffleAddress);
  
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
      if (smartAccountClient && isReadyToSendTx) {
        // スマートアカウントでの参加処理（ガスレス）
        console.log("スマートアカウントでラッフルに参加します");
        console.log("ラッフルアドレス:", raffleAddress);
        console.log("参加料:", entryFee.toString());
        
        // enterRaffle関数のABIエンコード
        const callData = encodeFunctionData({
          abi: [{
            name: "enterRaffle",
            type: "function",
            stateMutability: "payable",
            inputs: [],
            outputs: []
          }],
          functionName: "enterRaffle",
          args: []
        });
        
        console.log("エンコードされたcallData:", callData);
        
        // UserOperationを送信
        const { userOpHash, txHash } = await sendUserOperation(
          raffleAddress as `0x${string}`, 
          callData,
          entryFee
        );
        
        console.log("UserOperation ハッシュ:", userOpHash);
        console.log("トランザクションハッシュ:", txHash);
        
        toast({
          title: "ラッフル参加成功！",
          description: "トランザクションが完了しました。ガスレスで送信されました。",
        });
        
        // 成功時のコールバック
        if (onSuccess) {
          onSuccess();
        }
      } else if (contract && address) {
        // 従来のウォレットでの参加処理
        console.log("通常のウォレットでラッフルに参加します");
        const tx = await contract.write.enterRaffle({ value: entryFee });
        console.log("トランザクションハッシュ:", tx);
        
        toast({
          title: "ラッフル参加成功！",
          description: "トランザクションが送信されました。",
        });
        
        // 成功時のコールバック
        if (onSuccess) {
          onSuccess();
        }
      } else {
        throw new Error("ウォレットが接続されていないか、コントラクトが見つかりません");
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
      disabled={!canEnterRaffle || isLoading}
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
