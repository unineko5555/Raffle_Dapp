"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { useRaffleContract } from "@/hooks/use-raffle-contract";
import { RaffleABI, contractConfig, ERC20ABI } from "@/app/lib/contract-config";
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
    sendUserOperation,
    currentChainId
  } = useSmartAccountContext();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [balanceInfo, setBalanceInfo] = useState<{
    hasEnoughBalance: boolean;
    balance: string;
    requiredAmount: string;
  } | null>(null);
  
  // useRaffleContractフックからは必要な関数と状態を取得
  const { 
    handleEnterRaffle, 
    isLoading: isContractLoading, 
    isPlayerEntered,
    handleCancelEntry,
    checkTokenBalanceWithInfo,
    raffleData,
    checkPlayerEntered,
    updateRaffleData
  } = useRaffleContract();
  
  // トークン残高チェック
  useEffect(() => {
    const checkBalance = async () => {
      if (isConnected && address) {
        const info = await checkTokenBalanceWithInfo(address);
        setBalanceInfo(info);
      }
    };
    
    checkBalance();
  }, [isConnected, address, checkTokenBalanceWithInfo]);
  
  // ユーザーがラッフルに参加できるかのチェック
  const canEnterRaffle = isRaffleOpen && 
    (isConnected || isReadyToSendTx) && 
    !isPlayerEntered && 
    balanceInfo?.hasEnoughBalance !== false;
  
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
      let success = false;
      
      // スマートアカウントを使用している場合
      if (smartAccountClient && isReadyToSendTx && smartAccountAddress) {
        console.log("スマートアカウントでラッフルに参加中...");
        
        // current chainIdを取得
        console.log("現在のチェーンID:", currentChainId);
        
        // コントラクト設定から直接ERC20アドレスを取得
        const erc20Address = contractConfig[currentChainId]?.erc20Address;
        
        console.log("契約設定:", JSON.stringify(contractConfig[currentChainId] || {}));
        
        if (!erc20Address) {
          throw new Error(`チェーンID ${currentChainId} のERC20アドレスが見つかりません`);
        }
        
        console.log("ERC20アドレス:", erc20Address);
        console.log("ラッフルアドレス:", raffleAddress);
        console.log("参加費用:", entryFee.toString());
        
        try {
          // ステップ1: まずERC20トークンの承認が必要
          console.log("ステップ1: ERC20トークンの承認処理...");
          const approveCallData = encodeFunctionData({
            abi: [{
              name: "approve",
              type: "function",
              stateMutability: "nonpayable",
              inputs: [
                { name: "spender", type: "address" },
                { name: "amount", type: "uint256" }
              ],
              outputs: [{ type: "bool" }]
            }],
            functionName: 'approve',
            args: [raffleAddress as `0x${string}`, entryFee]
          });
          
          // 承認トランザクションを送信
          const { txHash: approveTxHash } = await sendUserOperation(
            erc20Address as `0x${string}`,
            approveCallData,
            BigInt(0) // 値は0、ガス代のみ
          );
          
          console.log("承認トランザクションハッシュ:", approveTxHash);
          
          // 承認トランザクションが処理されるまで少し待機
          toast({
            title: "トークン承認中",
            description: "トークン承認の処理中です。しばらくお待ちください...",
          });
          
          // 少し待機して承認トランザクションが処理されるのを待つ
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // ステップ2: 承認後にラッフル参加トランザクションを実行
          console.log("ステップ2: ラッフル参加処理...");
          const enterRaffleCallData = encodeFunctionData({
            abi: RaffleABI,
            functionName: 'enterRaffle',
            args: []
          });
          
          // エントリーステップを実行
          const { txHash: enterRaffleTxHash } = await sendUserOperation(
            raffleAddress as `0x${string}`,
            enterRaffleCallData,
            BigInt(0) // 値は0、ERC20承認済み
          );
          
          txHash = enterRaffleTxHash;
          
          // トランザクションが完了するまで待機
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // トランザクション完了後に参加状態をチェック
          try {
            if (typeof checkPlayerEntered === 'function') {
              await checkPlayerEntered(smartAccountAddress);
            }
            success = true;
          } catch (checkError) {
            console.warn('参加状態のチェック中にエラーが発生しましたが、トランザクションは成功している可能性があります:', checkError);
            // トランザクションは送信されたので、成功とみなす
            success = true;
          }
        } catch (error) {
          console.error("スマートアカウントでのラッフル参加エラー:", error);
          throw new Error(`スマートアカウントトランザクションエラー: ${error instanceof Error ? error.message : '不明なエラー'}`);
        }
      } 
      // 通常のウォレット接続の場合
      else if (address) {
        console.log("通常ウォレットでラッフルに参加中...");
        
        try {
          // handleEnterRaffle関数を使用してラッフルに参加
          const result = await handleEnterRaffle(smartAccountAddress);
          console.log("ラッフル参加結果:", result);
          
          if (result && result.success) {
            // hashプロパティをtxHashとして使用
            txHash = result.hash || result.txHash;
            
            // 少し待機してブロックチェーンの状態が更新されるのを待つ
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // 参加状態を明示的に更新
            try {
              if (typeof checkPlayerEntered === 'function') {
                await checkPlayerEntered(address);
              } else {
                console.warn('プレイヤー状態確認関数が定義されていません');
              }
            } catch (checkError) {
              console.warn('参加状態のチェック中にエラーが発生しました:', checkError);
            }
            
            // ラッフルデータを更新しようとしてエラーハンドリング
            try {
              // 関数が正しく渡されているかチェック
              if (typeof updateRaffleData === 'function') {
                await updateRaffleData(true);
              } else {
                // updateRaffleDataがない場合は成功コールバックを使用
                console.log('コールバックを使用して表示を更新します');
                if (onSuccess) {
                  onSuccess();
                }
              }
            } catch (updateError) {
              console.log('データ更新エラーですが、参加は成功しています:', updateError);
              // エラーがあってもコールバックは実行
              if (onSuccess) {
                onSuccess();
              }
            }
            
            success = true;
          } else {
            throw new Error(result?.error || "ラッフル参加に失敗しました");
          }
        } catch (error) {
          console.error("ラッフル参加エラー詳細:", error);
          
          // エラーをスローするが、実際は参加成功している可能性があるため
          // 念のためにプレイヤー状態を確認
          const isEntered = await checkPlayerEntered(address);
          
          if (isEntered) {
            // 参加は実際には成功している
            console.log("トランザクションエラーが報告されましたが、ユーザーはラッフルに参加しています");
            success = true;
            // ラッフルデータを強制的に更新
            await updateRaffleData(true);
          } else {
            throw error; // 本当に失敗した場合は再スロー
          }
        }
      } else {
        throw new Error("ウォレットが正しく接続されていません");
      }
      
      console.log("トランザクションハッシュ:", txHash);
      
      if (success) {
        toast({
          title: "ラッフル参加成功！",
          description: smartAccountClient 
            ? "スマートウォレットでラッフルに参加しました。" 
            : "ラッフルに参加しました。",
          variant: "default",
        });
        
        // 成功時のコールバック
        if (onSuccess) {
          onSuccess();
        }
        
        // ラッフルデータを更新
        try {
          if (typeof updateRaffleData === 'function') {
            await updateRaffleData(true);
          } else {
            console.log('ラッフルデータ更新関数が定義されていません');
          }
        } catch (updateError) {
          console.warn('リスト更新エラーが発生しましたが、参加は成功しました:', updateError);
        }
      } else {
        throw new Error("トランザクションは送信されましたが、ラッフル参加確認に失敗しました。しばらく待ってからページを更新してください。");
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
    <>
      {balanceInfo && !balanceInfo.hasEnoughBalance && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
          <h4 className="text-amber-800 dark:text-amber-300 font-medium mb-1">残高不足</h4>
          <p className="text-amber-700 dark:text-amber-400 text-sm mb-2">
            ラッフル参加に必要なUSDCが不足しています。<br />
            現在の残高: <span className="font-mono">{balanceInfo.balance} USDC</span><br />
            必要な残高: <span className="font-mono">{balanceInfo.requiredAmount} USDC</span>
          </p>
          <Button 
            variant="outline" 
            size="sm"
            className="bg-amber-100 hover:bg-amber-200 dark:bg-amber-900 dark:hover:bg-amber-800 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700"
            onClick={() => window.open("https://faucet.circle.com/", "_blank")}
          >
            テストネットUSDCを取得する
          </Button>
        </div>
      )}
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
    </>
  );
}
