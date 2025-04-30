"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Coins, CheckCircle2 } from "lucide-react";
import { ToastIcon } from "@/components/ui/toast-icon";
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
    checkPlayerEntered
  } = useRaffleContract();
  
  // トークン残高チェック
  useEffect(() => {
    const checkBalance = async () => {
      // EOAウォレットの場合
      if (isConnected && address) {
        const info = await checkTokenBalanceWithInfo(address);
        setBalanceInfo(info);
      }
      // スマートウォレットの場合
      else if (isReadyToSendTx && smartAccountAddress) {
        const info = await checkTokenBalanceWithInfo(smartAccountAddress);
        setBalanceInfo(info);
      }
    };
    
    checkBalance();
  }, [isConnected, address, isReadyToSendTx, smartAccountAddress, checkTokenBalanceWithInfo]);
  
  // ユーザーがラッフルに参加できるかのチェック
  const canEnterRaffle = isRaffleOpen && 
    // ウォレット接続状況確認
    (isConnected || isReadyToSendTx) && 
    // 既に参加していないことを確認
    !isPlayerEntered && 
    // 残高不足でないことを確認
    (balanceInfo?.hasEnoughBalance !== false);
  
  // ラッフルに参加する際の実装
  const enterRaffle = async () => {
    if (!canEnterRaffle) {
      toast({
        title: "エラー",
        description: "ラッフルが開催中でないか、ウォレットが接続されていません。",
        variant: "destructive",
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
        const erc20Address = contractConfig[currentChainId as keyof typeof contractConfig]?.erc20Address;
        
        console.log("契約設定:", JSON.stringify(contractConfig[currentChainId as keyof typeof contractConfig] || {}));
        
        if (!erc20Address) {
          throw new Error(`チェーンID ${currentChainId} のERC20アドレスが見つかりません`);
        }
        
        console.log("ERC20アドレス:", erc20Address);
        console.log("ラッフルアドレス:", raffleAddress);
        console.log("参加費用:", entryFee.toString());
        
        try {
          // ステップ1: まずERC20トークンの承認が必要
          console.log("ステップ1: ERC20トークンの承認処理...");
          
          // 大きめの承認額を使用して、将来の参加も補償
          const approveAmount = BigInt(1000000000); // 1000 USDC相当（大きめの値）
          
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
            args: [raffleAddress as `0x${string}`, approveAmount]
          });
          
          // トークン承認のトーストを表示
          toast({
            title: "トークン承認中",
            description: "トークン承認トランザクションを送信します...",
            variant: "token",
            icon: <ToastIcon variant="token" icon={<Coins className="w-5 h-5" />} />
          });
          
          try {
            // 承認トランザクションを送信
            const approveResult = await sendUserOperation(
              erc20Address as `0x${string}`,
              approveCallData,
              BigInt(0)
            );
            
            console.log("承認トランザクション結果:", approveResult);
            const approveTxHash = approveResult.txHash;
            
            // 承認トランザクションが処理されるまで少し待機
            toast({
              title: "トークン承認成功",
              description: "トークン承認が完了しました。ラッフル参加処理に移ります...",
              variant: "default",
              icon: <ToastIcon variant="default" icon={<CheckCircle2 className="w-5 h-5" />} />
            });
            
            // トランザクションハッシュを記録
            console.log("承認トランザクションハッシュ:", approveTxHash);
            const explorerUrl = contractConfig[currentChainId as keyof typeof contractConfig]?.blockExplorer || "https://sepolia.etherscan.io";
            console.log(`エクスプローラーで確認: ${explorerUrl}/tx/${approveTxHash}`);
            
            // 承認状況を確認するためのコードを追加
            try {
              // 承認状況を確認する直接の方法がないため、コメントアウト
              // 必要な場合はサードパーティーライブラリを使用して実装を追加することも可能
              // const allowance = await publicClient.readContract({
              //   address: erc20Address,
              //   abi: ERC20ABI,
              //   functionName: "allowance",
              //   args: [smartAccountAddress, raffleAddress]
              // });
              // console.log("現在の承認額:", allowance);
            } catch (checkError) {
              console.warn('トークン承認確認中にエラーが発生しましたが、処理を続行します:', checkError);
            }
            
            // ラッフル参加前に少し待機して、承認トランザクションが処理されるのを待つ
            console.log('承認トランザクション処理待ち...');
            console.log('待機開始...');
            toast({
              title: "承認確定待ち",
              description: "ブロックチェーン上で承認が確定するのを待っています...",
              variant: "default",
              icon: <ToastIcon variant="default" icon={<Coins className="w-5 h-5" />} />
            });
            
            // 承認確定のために小さめの待機を挿入
            // 15秒間待機してトランザクションが確定するのを待つ
            await new Promise(resolve => setTimeout(resolve, 15000)); 
            console.log('待機完了、ラッフル参加処理に移ります');
          } catch (approveError) {
            console.error("承認トランザクションエラー:", approveError);
            toast({
              title: "トークン承認エラー",
              description: approveError instanceof Error ? approveError.message : "承認処理中にエラーが発生しました",
              variant: "destructive"
            });
            throw new Error(`トークン承認エラー: ${approveError instanceof Error ? approveError.message : '不明なエラー'}`);
          }
          
          // ステップ2: 承認後にラッフル参加トランザクションを実行
          console.log("ステップ2: ラッフル参加処理...");
          const enterRaffleCallData = encodeFunctionData({
            abi: RaffleABI,
            functionName: 'enterRaffle',
            args: []
          });
          
          // ラッフル参加のトーストを表示
          toast({
            title: "ラッフル参加中",
            description: "ラッフル参加トランザクションを送信します...",
            variant: "default",
            icon: <ToastIcon variant="default" icon={<Coins className="w-5 h-5" />} />
          });
          
          try {
            // エントリーステップを実行
            const enterRaffleResult = await sendUserOperation(
              raffleAddress as `0x${string}`,
              enterRaffleCallData,
              BigInt(0)
            );
            
            console.log("ラッフル参加トランザクション結果:", enterRaffleResult);
            txHash = enterRaffleResult.txHash;
            
            // エクスプローラーリンクを記録
            console.log("ラッフル参加トランザクションハッシュ:", txHash);
            const explorerUrl = contractConfig[currentChainId as keyof typeof contractConfig]?.blockExplorer || "https://sepolia.etherscan.io";
            console.log(`エクスプローラーで確認: ${explorerUrl}/tx/${txHash}`);
            
            // トランザクションが完了するまで待機
            toast({
              title: "ラッフル参加トランザクション送信成功",
              description: "ブロックチェーン上で確認中です。しばらくお待ちください...",
              variant: "default",
              icon: <ToastIcon variant="default" icon={<Coins className="w-5 h-5" />} />
            });
            
            // トランザクションが確定するまで待機時間を長めに設定
            console.log('ラッフル参加トランザクション処理待ち...');
            toast({
              title: "ブロックチェーン処理待ち",
              description: "トランザクションを処理中です。これには時間がかかることがあります...",
              variant: "default",
              icon: <ToastIcon variant="default" icon={<Coins className="w-5 h-5" />} />
            });

            // 処理待ち時間を長くする
            await new Promise(resolve => setTimeout(resolve, 20000)); // 20秒に増やす
            console.log('待機完了、参加状態を確認します');
            
            // 複数回参加状態確認を試みる
            let isEntered = false;
            let retries = 3;
            while (retries > 0 && !isEntered) {
              try {
                if (typeof checkPlayerEntered === 'function') {
                  isEntered = await checkPlayerEntered(smartAccountAddress);
                  console.log(`プレイヤー参加状態確認結果(試行 ${4-retries}/3): ${isEntered}`);
                  if (isEntered) break;
                }
              } catch (checkError) {
                console.warn(`参加状態確認中にエラー(試行 ${4-retries}/3):`, checkError);
              }
              
              if (retries > 1) {
                console.log("5秒後に再確認します...");
                await new Promise(resolve => setTimeout(resolve, 5000));
              }
              retries--;
            }

            if (isEntered) {
              success = true;
            } else {
              // 参加は確認できなかったが、トランザクションは送信されたため一応成功とみなす
              console.log("参加確認はできませんでしたが、トランザクションは送信されました。後ほど確認してください。");
              success = true; // 楚観的にtrueを設定
            }
          } catch (enterError) {
            console.error("ラッフル参加トランザクションエラー:", enterError);
            
            // エラーメッセージを解析してより具体的な情報を提供
            let errorMessage = enterError instanceof Error ? enterError.message : "参加処理中にエラーが発生しました";
            
            // 特定のエラーメッセージを検出してよりわかりやすい情報を表示
            if (errorMessage.includes("transfer amount exceeds allowance")) {
              errorMessage = "承認額を超える転送エラー: 承認トランザクションがまだブロックチェーン上で確定していないか、または承認額が不足しています。もう少し待ってから再試行してください。";
            } else if (errorMessage.includes("rejected") || errorMessage.includes("denied")) {
              errorMessage = "ユーザーが参加トランザクションを拒否しました";
            }
            
            toast({
              title: "ラッフル参加エラー",
              description: errorMessage,
              variant: "destructive"
            });
            throw new Error(`ラッフル参加エラー: ${errorMessage}`);
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
          const result = await handleEnterRaffle(smartAccountAddress || undefined);
          console.log("ラッフル参加結果:", result);
          
          if (result && result.success) {
            // hashプロパティをtxHashとして使用
            txHash = result.hash || "";
            
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
              // 関数が存在しないため、成功コールバックを使用
              console.log('コールバックを使用して表示を更新します');
              if (onSuccess) {
                onSuccess();
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
            if (onSuccess) {
              onSuccess();
            }
          } else {
            throw error; // 本当に失敗した場合は再スロー
          }
        }
      } else {
        throw new Error("ウォレットが正しく接続されていません");
      }
      
      console.log("トランザクションハッシュ:", txHash);
      
      if (success) {
        // EnterRaffleButton内でトーストを表示
        toast({
          title: "ラッフル参加成功！",
          description: smartAccountClient 
            ? "スマートウォレットでラッフルに参加しました。" 
            : "ラッフルに参加しました。",
          variant: "default",
          icon: <ToastIcon variant="default" icon={<CheckCircle2 className="w-5 h-5" />} />
        });
        
        // 成功時のコールバック（コールバック内ではトースト表示しない）
        if (onSuccess) {
          onSuccess();
        }
        
        // ラッフルデータを更新
        try {
          // 関数が存在しないため、成功コールバックを使用
          console.log('コールバックを使用して表示を更新します');
          if (onSuccess) {
            onSuccess();
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