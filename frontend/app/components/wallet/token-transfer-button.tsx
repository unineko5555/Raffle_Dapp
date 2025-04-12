"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { ToastIcon } from "@/components/ui/toast-icon";
import { useSmartAccountContext } from "@/app/providers/smart-account-provider";
import { ArrowUpRight, Loader2, Coins, CheckCircle2 } from "lucide-react";
import { encodeFunctionData } from "viem";
import { contractConfig } from "@/app/lib/contract-config";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TokenTransferButton() {
  const { toast } = useToast();
  const { 
    smartAccountClient, 
    smartAccountAddress,
    isReadyToSendTx,
    sendUserOperation,
    currentChainId
  } = useSmartAccountContext();

  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState("0"); // USDCの残高（デモ用に0で初期化）

  // スマートウォレットからUSDCを送金する関数
  const transferUSDC = async () => {
    if (!isReadyToSendTx || !smartAccountClient || !smartAccountAddress) {
      toast({
        title: "エラー",
        description: "スマートウォレットが準備できていません",
        variant: "destructive",
      });
      return;
    }

    if (!recipientAddress || !amount) {
      toast({
        title: "エラー",
        description: "送金先アドレスと金額を入力してください",
        variant: "destructive",
      });
      return;
    }

    // 数値変換
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      toast({
        title: "エラー",
        description: "有効な金額を入力してください",
        variant: "destructive",
      });
      return;
    }

    // USDC小数点6桁を考慮
    const amountInSmallestUnit = BigInt(Math.floor(amountValue * 1000000));

    setIsLoading(true);

    try {
      // コントラクト設定からERC20アドレスを取得
      const erc20Address = contractConfig[currentChainId]?.erc20Address;
      
      if (!erc20Address) {
        throw new Error(`チェーンID ${currentChainId} のERC20アドレスが見つかりません`);
      }

      console.log("送金処理を開始します");
      console.log("ERC20アドレス:", erc20Address);
      console.log("送金先:", recipientAddress);
      console.log("送金額:", amountInSmallestUnit.toString());

      // ERC20トークンのtransfer関数を呼び出すための関数データを作成
      const transferCallData = encodeFunctionData({
        abi: [{
          name: "transfer",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [
            { name: "recipient", type: "address" },
            { name: "amount", type: "uint256" }
          ],
          outputs: [{ type: "bool" }]
        }],
        functionName: 'transfer',
        args: [recipientAddress as `0x${string}`, amountInSmallestUnit]
      });

      // トランザクション開始のトースト
      toast({
        title: "送金処理中",
        description: "トランザクションを送信しています...",
        variant: "default",
        icon: <ToastIcon variant="default" icon={<Coins className="w-5 h-5" />} />
      });

      // トランザクションを送信
      const result = await sendUserOperation(
        erc20Address as `0x${string}`,
        transferCallData,
        BigInt(0)
      );

      console.log("送金トランザクション結果:", result);
      
      // 成功トースト
      toast({
        title: "送金成功",
        description: `${amount} USDCを送金しました`,
        variant: "default",
        icon: <ToastIcon variant="default" icon={<CheckCircle2 className="w-5 h-5" />} />
      });

      // ダイアログを閉じる
      setOpen(false);
      setRecipientAddress("");
      setAmount("");
    } catch (error) {
      console.error("送金エラー:", error);
      toast({
        title: "送金エラー",
        description: error instanceof Error ? error.message : "不明なエラーが発生しました",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // スマートウォレットが未接続の場合は何も表示しない
  if (!isReadyToSendTx || !smartAccountAddress) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex items-center justify-between gap-2 min-w-[140px] bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors mr-2"
        >
          <div className="flex items-center gap-1.5">
            <Coins className="h-4 w-4 text-slate-500" />
            <span className="text-sm">USDC送金 ({balance})</span>
          </div>
          <ArrowUpRight className="h-4 w-4 opacity-50" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>USDCを送金</DialogTitle>
          <DialogDescription>
            スマートウォレットからUSDCを任意のアドレスに送金します。
            現在の残高: {balance} USDC
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="recipient" className="text-right">
              送金先
            </Label>
            <Input
              id="recipient"
              placeholder="0x..."
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">
              金額 (USDC)
            </Label>
            <Input
              id="amount"
              type="number"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            キャンセル
          </Button>
          <Button onClick={transferUSDC} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                処理中...
              </>
            ) : (
              "送金する"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
