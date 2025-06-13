import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Shield,
  CreditCard,
  Link,
  User,
  Wallet,
  ArrowUpRight,
  ArrowDownToLine,
  Loader2,
  Copy,
  CheckCircle,
  LinkIcon,
  History,
  Settings,
  Trophy,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useRaffleStateManagement,
  RaffleState,
} from "@/hooks/use-raffle-state-management";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { encodeFunctionData } from "viem";
import { RaffleABI } from "@/app/lib/contract-config";
import { useSmartAccountContext } from "@/app/providers/smart-account-provider";

interface OwnerAdminPanelProps {
  isOwner: boolean;
  contractAddress: string;
  balance: string | number; // 文字列または数値として受け取れるように型を変更
  usdcBalance: string | number; // 文字列または数値として受け取れるように型を変更
  jackpotAmount: string | number; // 文字列または数値として受け取れるように型を変更
  ownerAddress: string;
  currentRaffleState?: number; // 追加: 現在のラッフル状態
  supportedChains: {
    id: number;
    name: string;
    icon: string;
    color: string;
    textColor: string;
    borderColor: string;
    currency: {
      name: string;
      symbol: string;
      decimals: number;
    };
  }[];
  onChangeOwner: (newOwner: any) => void;
  onUpgradeContract: (newImplementation: any, initData: any) => void;
  onStateChanged?: () => void; // 追加: 状態変更後のコールバック
  isLoading: boolean;
}

const OwnerAdminPanel: React.FC<OwnerAdminPanelProps> = ({
  isOwner,
  contractAddress,
  balance,
  usdcBalance,
  jackpotAmount,
  ownerAddress,
  currentRaffleState = 0,
  supportedChains,
  onChangeOwner,
  onUpgradeContract,
  onStateChanged,
  isLoading,
}: OwnerAdminPanelProps) => {
  const [copied, setCopied] = useState(false);
  const [newOwnerAddress, setNewOwnerAddress] = useState("");
  const [newImplementationAddress, setNewImplementationAddress] = useState("");
  const [upgradeInitData, setUpgradeInitData] = useState("");
  const [selectedState, setSelectedState] = useState<string>("0");

  // 状態管理フックを使用
  const {
    isLoading: isStateLoading,
    error: stateError,
    setRaffleState,
    getStateName,
  } = useRaffleStateManagement();

  // ウォレット接続とコントラクト関連
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { smartAccountAddress, isReadyToSendTx, sendUserOperation } =
    useSmartAccountContext();

  // Mockプレイヤー追加の状態管理
  const [isMockPlayerLoading, setIsMockPlayerLoading] = useState(false);
  const [mockPlayerError, setMockPlayerError] = useState<string | null>(null);

  // プレイヤーリセットの状態管理
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // 勝者処理の状態管理
  const [isProcessWinnerLoading, setIsProcessWinnerLoading] = useState(false);
  const [processWinnerError, setProcessWinnerError] = useState<string | null>(
    null
  );

  // USDCの6桁小数点を考慮してフォーマット
  const formatUSDC = (amount: string | number) => {
    // 数値が直接文字列として渡されることもあるため、適切に処理
    // 文字列 "0" または空文字列の場合は0として処理
    if (amount === "0" || amount === "") return "0.00";

    try {
      // まず文字列に変換
      const amountStr = amount.toString();

      // 入力値を数値として解釈
      let numericAmount: number;

      // 小数点を含む場合は通常の数値として処理
      if (amountStr.includes(".")) {
        numericAmount = parseFloat(amountStr);
      } else {
        // 小数点を含まない場合は最小単位トークンとして処理、100万分の1に変換
        numericAmount = Number(amountStr) / 1000000;
      }

      return numericAmount.toLocaleString("ja-JP", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch (error) {
      console.error("USDC金額フォーマットエラー:", error, "値:", amount);
      return "0.00"; // エラーの場合はデフォルト値を返す
    }
  };

  // アドレスをコピーする関数
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // アドレスを短縮して表示する関数
  const shortenAddress = (address: string) => {
    if (!address || address.length < 10) return address;
    return `${address.substring(0, 6)}...${address.substring(
      address.length - 4
    )}`;
  };

  // 現在の状態名を取得
  const getCurrentStateName = () => {
    return getStateName(currentRaffleState as RaffleState);
  };

  // 状態変更処理
  const handleStateChange = async () => {
    try {
      console.log(
        "状態変更を開始:",
        selectedState,
        "→",
        getStateName(parseInt(selectedState) as RaffleState)
      );
      const result = await setRaffleState(
        parseInt(selectedState) as RaffleState
      );

      console.log("状態変更成功");
      onStateChanged?.();
    } catch (error) {
      console.error("状態変更エラー:", error);
    }
  };

  // Mockプレイヤー追加処理
  const addMockPlayer = async () => {
    if (!contractAddress || (!isConnected && !isReadyToSendTx)) {
      setMockPlayerError("ウォレットが接続されていません");
      return;
    }

    setIsMockPlayerLoading(true);
    setMockPlayerError(null);

    const useSmartAccount =
      isReadyToSendTx && smartAccountAddress && sendUserOperation;

    try {
      console.log("Mockプレイヤー追加を開始...");

      if (useSmartAccount && sendUserOperation) {
        // スマートアカウント経由での実行
        const addMockPlayerCallData = encodeFunctionData({
          abi: RaffleABI,
          functionName: "addMockPlayer",
          args: [],
        });

        const result = await sendUserOperation(
          contractAddress as `0x${string}`,
          addMockPlayerCallData,
          BigInt(0)
        );

        if (result?.txHash && publicClient) {
          console.log("スマートアカウントでMockプレイヤー追加:", result.txHash);

          // トランザクション確認を待つ
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: result.txHash as `0x${string}`,
            timeout: 60000,
          });

          if (receipt.status === "reverted") {
            throw new Error("Mockプレイヤー追加がリバートしました");
          }

          console.log("スマートアカウント: Mockプレイヤー追加完了");
        }
      } else if (isConnected && address && publicClient && writeContractAsync) {
        // EOA経由での実行
        const txHash = await writeContractAsync({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "addMockPlayer",
          args: [],
          account: address,
        });

        if (!txHash) {
          throw new Error(
            "Mockプレイヤー追加トランザクションの送信に失敗しました"
          );
        }

        // トランザクション確認を待つ
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
          timeout: 60000,
        });

        if (receipt.status === "reverted") {
          throw new Error("Mockプレイヤー追加トランザクションが失敗しました");
        }

        console.log("EOA: Mockプレイヤー追加完了");
      }

      // 成功後にデータを更新
      setTimeout(() => {
        onStateChanged?.();
      }, 2000);
    } catch (error: any) {
      console.error("Mockプレイヤー追加エラー:", error);
      setMockPlayerError(error.message || "Mockプレイヤー追加に失敗しました");
    } finally {
      setIsMockPlayerLoading(false);
    }
  };

  // プレイヤーリセット処理
  const resetPlayers = async () => {
    if (!contractAddress || (!isConnected && !isReadyToSendTx)) {
      setResetError("ウォレットが接続されていません");
      return;
    }

    setIsResetLoading(true);
    setResetError(null);

    const useSmartAccount =
      isReadyToSendTx && smartAccountAddress && sendUserOperation;

    try {
      console.log("プレイヤーリセットを開始...");

      if (useSmartAccount && sendUserOperation) {
        // スマートアカウント経由での実行
        const resetPlayersCallData = encodeFunctionData({
          abi: RaffleABI,
          functionName: "resetPlayers",
          args: [],
        });

        const result = await sendUserOperation(
          contractAddress as `0x${string}`,
          resetPlayersCallData,
          BigInt(0)
        );

        if (result?.txHash && publicClient) {
          console.log("スマートアカウントでプレイヤーリセット:", result.txHash);

          // トランザクション確認を待つ
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: result.txHash as `0x${string}`,
            timeout: 60000,
          });

          if (receipt.status === "reverted") {
            throw new Error("プレイヤーリセットがリバートしました");
          }

          console.log("スマートアカウント: プレイヤーリセット完了");
        }
      } else if (isConnected && address && publicClient && writeContractAsync) {
        // EOA経由での実行
        const txHash = await writeContractAsync({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "resetPlayers",
          args: [],
          account: address,
        });

        if (!txHash) {
          throw new Error(
            "プレイヤーリセットトランザクションの送信に失敗しました"
          );
        }

        // トランザクション確認を待つ
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
          timeout: 60000,
        });

        if (receipt.status === "reverted") {
          throw new Error("プレイヤーリセットトランザクションが失敗しました");
        }

        console.log("EOA: プレイヤーリセット完了");
      }

      // 成功後にデータを更新（より長い待機時間とログ追加）
      setTimeout(() => {
        console.log("プレイヤーリセット: データ更新を実行中...");
        onStateChanged?.();

        // さらに追加の更新を実行
        setTimeout(() => {
          console.log("プレイヤーリセット: 追加データ更新を実行中...");
          onStateChanged?.();
        }, 3000);
      }, 5000);
    } catch (error: any) {
      console.error("プレイヤーリセットエラー:", error);
      setResetError(error.message || "プレイヤーリセットに失敗しました");
    } finally {
      setIsResetLoading(false);
    }
  };

  // 勝者処理関数
  const processWinner = async () => {
    if (!contractAddress || (!isConnected && !isReadyToSendTx)) {
      setProcessWinnerError("ウォレットが接続されていません");
      return;
    }

    if (currentRaffleState !== 2) {
      setProcessWinnerError("WINNER_SELECTED状態でのみ実行可能です");
      return;
    }

    setIsProcessWinnerLoading(true);
    setProcessWinnerError(null);

    try {
      const useSmartAccount =
        isReadyToSendTx && smartAccountAddress && sendUserOperation;

      if (useSmartAccount && sendUserOperation) {
        console.log("スマートアカウントで勝者処理を実行中...");

        const processWinnerCallData = encodeFunctionData({
          abi: RaffleABI,
          functionName: "processWinner",
          args: [],
        });

        const result = await sendUserOperation(
          contractAddress as `0x${string}`,
          processWinnerCallData,
          BigInt(0)
        );

        console.log("スマートアカウント: 勝者処理完了", result?.txHash);
      } else if (isConnected && address && publicClient && writeContractAsync) {
        console.log("EOAで勝者処理を実行中...");

        const txHash = await writeContractAsync({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "processWinner",
          args: [],
          account: address,
        });

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
          timeout: 60000,
        });

        if (receipt.status === "reverted") {
          throw new Error("勝者処理トランザクションが失敗しました");
        }

        console.log("EOA: 勝者処理完了");
      }

      // 成功後にデータを更新
      setTimeout(() => {
        console.log("勝者処理: データ更新を実行中...");
        onStateChanged?.();

        // 追加の更新を実行
        setTimeout(() => {
          console.log("勝者処理: 追加データ更新を実行中...");
          onStateChanged?.();
        }, 3000);
      }, 5000);
    } catch (error: any) {
      console.error("勝者処理エラー:", error);
      setProcessWinnerError(error.message || "勝者処理に失敗しました");
    } finally {
      setIsProcessWinnerLoading(false);
    }
  };

  // テストモードの場合は常に表示する
  // if (!isOwner) return null;

  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader className="bg-amber-50 dark:bg-amber-900/20 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <CardTitle className="text-amber-600 dark:text-amber-400">
            コントラクト管理パネル
          </CardTitle>
        </div>
        <CardDescription>
          テストモード: 現在はすべてのユーザーが操作できます
          (ソーシャルログイン/EOA対応)
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 flex flex-col gap-6">
        <Tabs defaultValue="overview" className="flex flex-col gap-6">
          <TabsList className="grid grid-cols-3 gap-2">
            <TabsTrigger value="overview" className="text-sm py-2">
              概要
            </TabsTrigger>
            <TabsTrigger value="state" className="text-sm py-2">
              状態管理
            </TabsTrigger>
            <TabsTrigger value="upgrade" className="text-sm py-2">
              アップグレード
            </TabsTrigger>
          </TabsList>

          {/* 概要タブ */}
          <TabsContent value="overview" className="space-y-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-md">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    コントラクトアドレス
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                    {shortenAddress(contractAddress)}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => copyToClipboard(contractAddress)}
                  >
                    {copied ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-md">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    現在のオーナー
                  </span>
                </div>
                <code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                  {shortenAddress(ownerAddress)}
                </code>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-md">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    コントラクト残高
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-right">
                    {(typeof balance === "string"
                      ? parseFloat(balance)
                      : balance
                    ).toFixed(4)}{" "}
                    ETH
                  </div>
                  <div className="text-xs text-right">
                    {formatUSDC(usdcBalance)} USDC
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-600" />
                  <span className="text-sm text-amber-600 dark:text-amber-400">
                    最新のトランザクション
                  </span>
                </div>
                <Button variant="outline" size="sm" className="h-7">
                  <ArrowUpRight className="w-3 h-3 mr-1" />
                  Explorer
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* 状態管理タブ */}
          <TabsContent value="state" className="space-y-6">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md text-blue-600 dark:text-blue-400 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="w-4 h-4" />
                <span className="font-semibold">ラッフル状態の手動管理</span>
              </div>
              <p>テストやデバッグ目的でラッフルの状態を手動で変更できます。</p>
              <p className="mt-1 text-xs">
                注意: オーナーのみがこの操作を実行できます。
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-md">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    接続中のアドレス
                  </span>
                </div>
                <div className="text-sm font-medium">
                  <code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                    {shortenAddress(ownerAddress || "未接続")}
                  </code>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-md">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    現在の状態
                  </span>
                </div>
                <div className="text-sm font-medium">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      currentRaffleState === 0
                        ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                        : currentRaffleState === 1
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
                        : currentRaffleState === 2
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                    }`}
                  >
                    {getCurrentStateName()}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="state-select">新しい状態を選択</Label>
                <Select value={selectedState} onValueChange={setSelectedState}>
                  <SelectTrigger>
                    <SelectValue placeholder="状態を選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">OPEN (参加受付中)</SelectItem>
                    <SelectItem value="1">
                      CALCULATING_WINNER (抽選中)
                    </SelectItem>
                    <SelectItem value="2">
                      WINNER_SELECTED (勝者選択済み)
                    </SelectItem>
                    <SelectItem value="3">CLOSED (終了)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={
                      isStateLoading ||
                      selectedState === currentRaffleState.toString()
                    }
                  >
                    {isStateLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Settings className="w-4 h-4 mr-2" />
                    )}
                    状態を変更する
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>ラッフル状態変更の確認</DialogTitle>
                    <DialogDescription>
                      ラッフルの状態を手動で変更します。この操作は注意して実行してください。
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-3 py-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 dark:text-slate-400">
                        現在の状態
                      </span>
                      <span className="font-medium">
                        {getCurrentStateName()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 dark:text-slate-400">
                        新しい状態
                      </span>
                      <span className="font-medium text-blue-600">
                        {getStateName(parseInt(selectedState) as RaffleState)}
                      </span>
                    </div>
                  </div>

                  {stateError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-md text-red-600 dark:text-red-400 text-sm">
                      {stateError}
                    </div>
                  )}

                  <DialogFooter>
                    <Button variant="outline" className="w-full sm:w-auto">
                      キャンセル
                    </Button>
                    <Button
                      onClick={handleStateChange}
                      className="w-full sm:w-auto"
                      disabled={isStateLoading}
                    >
                      {isStateLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        "変更する"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <div className="text-xs text-slate-500 mt-2">
                ※この機能はテストやデバッグ目的でのみ使用してください。
              </div>
            </div>

            {/* Mockユーザー管理セクション */}
            <div className="space-y-4">
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-md text-purple-600 dark:text-purple-400 text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4" />
                  <span className="font-semibold">Mockユーザー管理</span>
                </div>
                <p>
                  テスト用のMockユーザーを追加して、ラッフルの参加者数を調整できます。
                </p>
                <p className="mt-1 text-xs">
                  注意: ラッフルがOPEN状態の時のみ追加可能です。
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={addMockPlayer}
                  className="w-full"
                  variant="outline"
                  disabled={isMockPlayerLoading || currentRaffleState !== 0}
                >
                  {isMockPlayerLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <User className="w-4 h-4 mr-2" />
                  )}
                  Mockユーザーを1人追加
                </Button>

                <Button
                  onClick={resetPlayers}
                  className="w-full"
                  variant="destructive"
                  disabled={isResetLoading || currentRaffleState !== 0}
                >
                  {isResetLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <User className="w-4 h-4 mr-2" />
                  )}
                  すべてのプレイヤーをリセット
                </Button>

                {/* 勝者処理ボタン - 常時表示、WINNER_SELECTED状態でのみ有効 */}
                <Button
                  onClick={processWinner}
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white disabled:from-gray-400 disabled:to-gray-500"
                  disabled={isProcessWinnerLoading || currentRaffleState !== 2}
                >
                  {isProcessWinnerLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trophy className="w-4 h-4 mr-2" />
                  )}
                  勝者を決定して賞金を払い出し
                  {currentRaffleState !== 2 && (
                    <span className="ml-2 text-xs opacity-75"></span>
                  )}
                </Button>
              </div>

              {mockPlayerError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-md text-red-600 dark:text-red-400 text-sm">
                  {mockPlayerError}
                </div>
              )}

              {resetError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-md text-red-600 dark:text-red-400 text-sm">
                  {resetError}
                </div>
              )}

              {processWinnerError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-md text-red-600 dark:text-red-400 text-sm">
                  {processWinnerError}
                </div>
              )}

              <div className="text-xs text-slate-500 space-y-1">
                <p>
                  ※各Mockユーザーは自動的にジャックポットに寄与し、最小プレイヤー数到達時にタイマーが開始されます。
                </p>
                <p>※リセット機能は既存のMockプレイヤーを全て削除します。</p>
                <p>
                  ※リセット後、表示が更新されない場合はページをリロードしてください。
                </p>
              </div>
            </div>
          </TabsContent>

          {/* アップグレードタブ */}
          <TabsContent value="upgrade" className="space-y-6">
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md text-amber-600 dark:text-amber-400 text-sm">
              ⚠️
              コントラクトのアップグレードは高度な操作です。正しく実装されたコントラクトのみをデプロイしてください。
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="new-owner">新しいオーナーアドレス</Label>
                <Input
                  id="new-owner"
                  type="text"
                  placeholder="0x..."
                  value={newOwnerAddress}
                  onChange={(e) => setNewOwnerAddress(e.target.value)}
                  className="mt-1"
                />
              </div>

              <Button
                onClick={() => onChangeOwner(newOwnerAddress)}
                disabled={!newOwnerAddress || isLoading}
                variant="outline"
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  "オーナーを変更"
                )}
              </Button>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="implementation-address">
                  新しい実装アドレス
                </Label>
                <Input
                  id="implementation-address"
                  type="text"
                  placeholder="0x..."
                  value={newImplementationAddress}
                  onChange={(e) => setNewImplementationAddress(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="init-data">初期化データ (オプション)</Label>
                <Input
                  id="init-data"
                  type="text"
                  placeholder="0x..."
                  value={upgradeInitData}
                  onChange={(e) => setUpgradeInitData(e.target.value)}
                  className="mt-1"
                />
              </div>

              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    disabled={!newImplementationAddress || isLoading}
                    variant="outline"
                    className="w-full"
                  >
                    コントラクトをアップグレード
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>コントラクトアップグレードの確認</DialogTitle>
                    <DialogDescription className="text-red-500">
                      ⚠️
                      この操作は元に戻せません。新しい実装が正しく動作することを確認してください。
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-3 py-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 dark:text-slate-400">
                        現在の実装
                      </span>
                      <code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                        {shortenAddress(contractAddress)}
                      </code>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 dark:text-slate-400">
                        新しい実装
                      </span>
                      <code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                        {shortenAddress(newImplementationAddress)}
                      </code>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" className="w-full sm:w-auto">
                      キャンセル
                    </Button>
                    <Button
                      onClick={() =>
                        onUpgradeContract(
                          newImplementationAddress,
                          upgradeInitData
                        )
                      }
                      className="w-full sm:w-auto bg-red-500 hover:bg-red-600"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        "アップグレードを実行"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <div className="text-xs text-slate-500 mt-2">
                ※UUPSプロキシパターンによるアップグレード機能です
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      <CardFooter className="bg-amber-50 dark:bg-amber-900/20 rounded-b-lg p-3 text-xs text-amber-600 dark:text-amber-400">
        テストモード:
        この管理パネルは現在すべてのユーザーが操作できます。本番環境ではオーナーのみに制限されます。
      </CardFooter>
    </Card>
  );
};

export default OwnerAdminPanel;
