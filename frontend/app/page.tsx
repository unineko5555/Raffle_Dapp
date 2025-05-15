"use client";

import { useState, useEffect, useCallback } from "react";
import { Zap, Wallet, CreditCard } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { ToastIcon } from "@/components/ui/toast-icon";
import { Badge } from "@/components/ui/badge";
import { supportedChains } from "./lib/web3-config";
import { useAccount, useChainId } from "wagmi";
import { useRaffleContract } from "@/hooks/use-raffle-contract";
import { useRaffleWinEvents } from "@/hooks/use-raffle-win-events";
import { useWeb3Auth } from "@/hooks/use-web3auth";
import { useSmartAccountContext } from "./providers/smart-account-provider";
import { useRaffleHistory } from "@/hooks/use-raffle-history";

// コンポーネントのインポート
import { RafflePrizeInfo } from "./components/raffle/raffle-prize-info";
import { RaffleCountdown } from "./components/raffle/raffle-countdown";
import { PlayersList } from "./components/raffle/players-list";
import { StartRaffleButton } from "./components/raffle/start-raffle-button";
import { RaffleHistory } from "./components/raffle/raffle-history";
import { RaffleHeader } from "./components/raffle/raffle-header";
import { EnterRaffleButton } from "./components/raffle/enter-raffle-button";
import { WinnerModal } from "./components/raffle/winner-modal";
import RaffleEntryStatus from "./components/raffle/raffle-entry-status";
import JackpotInfo from "./components/raffle/jackpot-info";
import { UserProfile } from "./components/user/user-profile";
import { AppHeader } from "./components/header/app-header";
import OwnerAdminPanel from "./components/admin/owner-admin-panel";

export default function RaffleDapp() {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const { user } = useWeb3Auth();
  const { toast } = useToast();

  // スマートアカウントの状態を取得
  const {
    smartAccountAddress,
    isReadyToSendTx,
    isLoading: isSmartAccountLoading,
  } = useSmartAccountContext();

  // ユーザーのラッフル履歴を取得
  const {
    userStats,
    pastRaffles,
    isLoading: isHistoryLoading,
  } = useRaffleHistory(smartAccountAddress || address);

  // 当選イベント監視フックを使用
  const { winner, prize, isJackpot, showModal, closeModal } =
    useRaffleWinEvents();

  const [activeChain, setActiveChain] = useState(supportedChains[0]);
  const [isTransactionSuccess, setIsTransactionSuccess] = useState(false);

  // useRaffleContractフックから実際のコントラクトデータを取得
  const {
    raffleData,
    isLoading,
    contractAddress,
    checkPlayerEntered,
    performManualUpkeep,
    checkAutomationStatus,
    getContractEthBalance,
    getContractUsdcBalance,
  } = useRaffleContract();

  // コントラクト残高データ
  const [contractBalances, setContractBalances] = useState({
    ethBalance: "0.015",
    usdcBalance: "0",
  });

  // コントラクト残高を取得する関数
  const updateContractBalances = useCallback(async () => {
    if (!getContractEthBalance || !getContractUsdcBalance) {
      return;
    }

    try {
      const ethBalance = await getContractEthBalance();
      const usdcBalance = await getContractUsdcBalance();

      setContractBalances({
        ethBalance: ethBalance,
        usdcBalance: usdcBalance,
      });
    } catch (error) {
      // エラーログを抑制し、代わりにデフォルト値を設定
      console.warn("コントラクト残高取得エラー:", error);
      setContractBalances({
        ethBalance: "0.015", // デフォルト値
        usdcBalance: "0", // デフォルト値
      });
    }
  }, [getContractEthBalance, getContractUsdcBalance]);

  // 初回読み込み時のみコントラクト残高を更新（遅延実行）
  useEffect(() => {
    // 初回読み込みを少し遅らせてレート制限を回避
    const timer = setTimeout(() => {
      updateContractBalances();
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // 重要なイベント後のみコントラクト残高を更新（更に遅延）
  useEffect(() => {
    if (isTransactionSuccess || winner) {
      setTimeout(() => {
        updateContractBalances();
      }, 5000); // 5秒に延長してレート制限を回避
    }
  }, [isTransactionSuccess, winner, updateContractBalances]);

  // 手動でラッフルを開始する
  const startRaffle = async () => {
    try {
      if (
        !confirm(
          "ラッフルを開始しますか？この操作は元に戻せません。\n\n参加者の中からランダムに当選者が選ばれます。"
        )
      ) {
        return;
      }

      if (raffleData.numberOfPlayers < 3) {
        alert(
          "ラッフルを開始するには少なくとも3人の参加者が必要です。\n現在の参加者数: " +
            raffleData.numberOfPlayers
        );
        return;
      }

      const automationStatus = await checkAutomationStatus();
      if (!automationStatus || !automationStatus.upkeepNeeded) {
        alert(
          "現在ラッフルを開始できません\n\n全ての条件が揃っているか確認してください。\n・最少参加者数を満たしている\n・ラッフルがオープン状態\n・参加から1分以上経過している"
        );
        return;
      }

      try {
        const upkeepResult = await performManualUpkeep();

        if (upkeepResult) {
          toast({
            title: "ラッフル開始",
            description: "ラッフルが開始されました！結果をお待ちください。",
            variant: "default",
            icon: (
              <ToastIcon variant="default" icon={<Zap className="w-5 h-5" />} />
            ),
          });

          alert("ラッフルが開始されました！トランザクション: " + upkeepResult);

          setIsTransactionSuccess(true);
          setTimeout(() => setIsTransactionSuccess(false), 5000);
        } else {
          alert(
            "ラッフル開始トランザクションが生成されましたが、結果が不明です。\n後ほど確認してください。"
          );
        }
      } catch (upkeepError) {
        console.error("Upkeepエラー詳細:", upkeepError);
        const errorMessage =
          upkeepError instanceof Error ? upkeepError.message : "不明なエラー";

        alert(
          `ラッフル開始中にエラーが発生しました: ${errorMessage}\n\nブロックチェーンが混雑しているか、ガス代が不足している可能性があります。`
        );
      }
    } catch (error) {
      console.error("ラッフル開始エラー:", error);
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラー";
      alert(`エラーが発生しました: ${errorMessage}`);
    }
  };

  // Wagmiの接続状態監視
  useEffect(() => {
    if (isConnected && address) {
      checkPlayerEntered();
    }
  }, [isConnected, address, checkPlayerEntered]);

  // チェーンが変更されたときにアクティブチェーンを更新
  useEffect(() => {
    if (chainId) {
      const newActiveChain = supportedChains.find((c) => c.id === chainId);
      if (newActiveChain) {
        setActiveChain(newActiveChain);
      }
    }
  }, [chainId]);

  // ラッフル参加成功時のコールバック
  const handleRaffleEntrySuccess = () => {
    // ラッフル参加後、自動的にデータが更新されるため何もしない
    console.log("ラッフル参加成功");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 text-slate-900 dark:text-slate-100">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-4 md:py-6">
        {/* コントラクト残高の表示 */}
        <div className="mb-2 md:mb-4 flex flex-wrap gap-2 justify-center md:justify-end">
          <div className="flex items-center gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-100 dark:bg-slate-700 rounded-full text-xs sm:text-sm whitespace-nowrap">
            <Wallet className="w-3 h-3 sm:w-4 sm:h-4 text-slate-500" />
            <span className="font-medium">
              {contractBalances.ethBalance} ETH
            </span>
          </div>
          <div className="flex items-center gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-100 dark:bg-slate-700 rounded-full text-xs sm:text-sm whitespace-nowrap">
            <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 text-slate-500" />
            <span className="font-medium">
              {(Number(contractBalances.usdcBalance) / 1000000).toFixed(2)} USDC
            </span>
          </div>
        </div>

        <AppHeader />

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl md:rounded-2xl shadow-lg p-3 sm:p-4 md:p-6 transition-all duration-300 hover:shadow-xl backdrop-blur-sm bg-white/80 dark:bg-slate-800/80">
            <RaffleHeader />

            <RafflePrizeInfo
              numberOfPlayers={raffleData.numberOfPlayers}
              isLoading={isLoading}
            />

            <JackpotInfo
              jackpotAmount={BigInt(raffleData.jackpotAmount || "0")}
              entranceFee={10}
              jackpotProbability={35}
              contributionRate={10}
            />

            <RaffleCountdown initialMinutes={0} initialSeconds={42} />

            <PlayersList
              players={raffleData.players || []}
              numberOfPlayers={raffleData.numberOfPlayers}
              isLoading={isLoading}
              minPlayers={3}
            />

            <div className="relative">
              <RaffleEntryStatus />
              <EnterRaffleButton
                raffleAddress={contractAddress || ""}
                entryFee={
                  typeof raffleData.entranceFee === "string"
                    ? BigInt(raffleData.entranceFee)
                    : raffleData.entranceFee || BigInt(10)
                }
                isRaffleOpen={!isLoading}
                onSuccess={handleRaffleEntrySuccess}
              />
              <div className="absolute -top-2 right-2">
                <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0">
                  ガス代無料
                </Badge>
              </div>
            </div>

            <StartRaffleButton
              isConnected={isConnected}
              isReadyToSendTx={isReadyToSendTx}
              numberOfPlayers={raffleData.numberOfPlayers}
              minPlayers={3}
              isLoading={isLoading}
              isSmartAccountLoading={isSmartAccountLoading}
              onStartRaffle={startRaffle}
            />

            <RaffleHistory
              pastRaffles={pastRaffles || []}
              currentAddress={smartAccountAddress || address}
              isLoading={isHistoryLoading}
            />
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl md:rounded-2xl shadow-lg p-3 sm:p-4 md:p-6 transition-all duration-300 hover:shadow-xl backdrop-blur-sm bg-white/80 dark:bg-slate-800/80">
            <UserProfile
              address={address}
              smartAccountAddress={smartAccountAddress}
              user={user}
              userStats={userStats}
              isLoading={isHistoryLoading}
              isConnected={isConnected}
            />

            {/* 管理パネル */}
            {(isConnected || smartAccountAddress || user) && (
              <div className="mt-6">
                <OwnerAdminPanel
                  isOwner={true}
                  contractAddress={contractAddress || ""}
                  balance={contractBalances.ethBalance || "0"}
                  usdcBalance={contractBalances.usdcBalance || "0"}
                  jackpotAmount={raffleData.jackpotAmount || "0"}
                  ownerAddress={raffleData.owner || ""}
                  supportedChains={supportedChains}
                  onChangeOwner={(newOwner) =>
                    console.log("Change owner", newOwner)
                  }
                  onUpgradeContract={(newImplementation, initData) =>
                    console.log("Upgrade contract", newImplementation, initData)
                  }
                  onManualPerformUpkeep={performManualUpkeep}
                  isLoading={isLoading}
                />
              </div>
            )}
          </div>
        </main>

        {/* 当選モーダル */}
        {winner && (
          <WinnerModal
            isOpen={showModal}
            onClose={closeModal}
            winner={winner}
            prize={prize}
            isJackpot={isJackpot}
          />
        )}
      </div>
    </div>
  );
}
