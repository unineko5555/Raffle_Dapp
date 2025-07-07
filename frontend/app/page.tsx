"use client";

import { useState, useEffect, useRef } from "react";
import { Zap } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { ToastIcon } from "@/components/ui/toast-icon";
import { supportedChains } from "./lib/web3-config";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { useRaffleContract } from "@/hooks/use-raffle-contract";
import { useRaffleWinEvents } from "@/hooks/use-raffle-win-events";
import { useWeb3Auth } from "@/hooks/use-web3auth";
import { useSmartAccountContext } from "./providers/smart-account-provider";
import { useRaffleHistory } from "@/hooks/use-raffle-history";
import { useContractBalance } from "@/hooks/use-contract-balance";
import { useRaffleEventListener } from "@/hooks/use-raffle-event-listener";
import { useCountdownData } from "@/hooks/use-countdown-data";

// コンポーネントのインポート
import { WinnerModal } from "./components/raffle/winner-modal";
import { UserProfile } from "./components/user/user-profile";
import { AppHeader } from "./components/header/app-header";
import OwnerAdminPanel from "./components/admin/owner-admin-panel";
import { ContractBalanceDisplay } from "./components/balance/contract-balance-display";
import { RaffleMainContent } from "./components/raffle/raffle-main-content";

export default function RaffleDapp() {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const { user } = useWeb3Auth();
  const { toast } = useToast();
  const publicClient = usePublicClient({ chainId });

  // useRefフックをコンポーネントトップレベルで定義
  const chainChangeIdRef = useRef<number | null>(null);

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

  const [_activeChain, setActiveChain] = useState(supportedChains[0]);
  const [_isTransactionSuccess, setIsTransactionSuccess] = useState(false);

  // useRaffleContractフックから実際のコントラクトデータを取得
  const {
    raffleData,
    isLoading,
    contractAddress,
    checkPlayerEntered,
    performUpkeep,
    performManualUpkeepWithVRF,
    performManualUpkeepWithMock,
    checkAutomationStatus,
    getContractEthBalance,
    getContractUsdcBalance,
    updateRaffleData,
    getMinPlayersReachedTime,
    getMinimumPlayers,
  } = useRaffleContract();

  // 新しいカスタムフックを使用
  const { contractBalances, updateContractBalances } = useContractBalance({
    getContractEthBalance,
    getContractUsdcBalance,
    contractAddress: contractAddress || undefined,
    publicClient,
  });

  const { minPlayersReachedTime, minimumPlayers, updateCountdownData } = useCountdownData({
    getMinPlayersReachedTime,
    getMinimumPlayers,
    contractAddress: contractAddress || undefined,
    numberOfPlayers: raffleData.numberOfPlayers,
  });

  // 🔥 イベント監視による自動勝者処理（ポーリング方式から置き換え）
  useRaffleEventListener({
    updateRaffleData,
  });

  // 初回読み込み時のデータ更新
  useEffect(() => {
    const timer = setTimeout(() => {
      updateContractBalances();
    }, 5000);
    return () => clearTimeout(timer);
  }, [updateContractBalances]);

  // 共通のラッフル開始処理
  const executeRaffle = async (upkeepFunction: () => Promise<unknown>, mode: string) => {
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
      const upkeepResult = await upkeepFunction();

      if (upkeepResult) {
        toast({
          title: "ラッフル開始",
          description: `ラッフルが開始されました！(${mode})`,
          variant: "default",
          icon: (
            <ToastIcon variant="default" icon={<Zap className="w-5 h-5" />} />
          ),
        });

        setIsTransactionSuccess(true);
        setTimeout(() => setIsTransactionSuccess(false), 5000);
      }
    } catch (upkeepError) {
      console.error("Upkeepエラー詳細:", upkeepError);
      const errorMessage =
        upkeepError instanceof Error ? upkeepError.message : "不明なエラー";

      alert(
        `ラッフル開始中にエラーが発生しました: ${errorMessage}\n\nブロックチェーンが混雑しているか、ガス代が不足している可能性があります。`
      );
    }
  };

  // 手動でラッフルを開始する（デフォルト）
  const startRaffle = async () => {
    try {
      await executeRaffle(performUpkeep, "現在の設定");
    } catch (error) {
      console.error("ラッフル開始エラー:", error);
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラー";
      alert(`エラーが発生しました: ${errorMessage}`);
    }
  };

  // VRFでラッフルを開始する
  const startRaffleWithVRF = async () => {
    try {
      await executeRaffle(performManualUpkeepWithVRF, "ChainlinkVRF");
    } catch (error) {
      console.error("VRFラッフル開始エラー:", error);
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラー";
      alert(`VRFラッフルエラー: ${errorMessage}`);
    }
  };

  // Mockでラッフルを開始する
  const startRaffleWithMock = async () => {
    try {
      await executeRaffle(performManualUpkeepWithMock, "Mock(RANDAO)");
    } catch (error) {
      console.error("Mockラッフル開始エラー:", error);
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラー";
      alert(`Mockラッフルエラー: ${errorMessage}`);
    }
  };

  // Wagmiの接続状態監視
  useEffect(() => {
    if (isConnected && address && checkPlayerEntered) {
      checkPlayerEntered(address);
    }
    if (smartAccountAddress && checkPlayerEntered) {
      checkPlayerEntered(smartAccountAddress);
    }
  }, [isConnected, address, smartAccountAddress, checkPlayerEntered]);

  // チェーンが変更されたときに残高を更新
  useEffect(() => {
    if (chainId && chainChangeIdRef.current !== chainId) {
      chainChangeIdRef.current = chainId;
      
      const newActiveChain = supportedChains.find((c) => c.id === chainId);
      if (newActiveChain) {
        setActiveChain(newActiveChain);
        setTimeout(() => {
          updateContractBalances(true);
        }, 1000);
      }
    }
  }, [chainId, updateContractBalances]);

  // ラッフル参加成功時のコールバック
  const handleRaffleEntrySuccess = () => {
    console.log("ラッフル参加成功");
    // カウントダウンデータも更新（最小プレイヤー数に達した可能性）
    setTimeout(() => {
      updateCountdownData();
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 text-slate-900 dark:text-slate-100">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-4 md:py-6">
        <ContractBalanceDisplay 
          ethBalance={contractBalances.ethBalance}
          usdcBalance={contractBalances.usdcBalance}
        />

        <AppHeader />

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <RaffleMainContent
            raffleData={raffleData}
            isLoading={isLoading}
            contractAddress={contractAddress || ""}
            minPlayersReachedTime={minPlayersReachedTime}
            minimumPlayers={minimumPlayers}
            pastRaffles={(pastRaffles || []).map((raffle) => ({
              time: raffle.time || "日時不明",
              winner: raffle.winner || "不明",
              prize: raffle.prize || "0 USDC",
              jackpot: raffle.jackpot || "なし"
            }))}
            currentAddress={smartAccountAddress || address}
            isHistoryLoading={isHistoryLoading}
            isConnected={isConnected}
            isReadyToSendTx={isReadyToSendTx}
            isSmartAccountLoading={isSmartAccountLoading}
            onRaffleEntrySuccess={handleRaffleEntrySuccess}
            onStartRaffle={startRaffle}
            onStartRaffleWithVRF={startRaffleWithVRF}
            onStartRaffleWithMock={startRaffleWithMock}
          />

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
                  currentRaffleState={raffleData.raffleState || 0}
                  supportedChains={supportedChains}
                  onChangeOwner={(newOwner) =>
                    console.log("Change owner", newOwner)
                  }
                  onUpgradeContract={(newImplementation, initData) =>
                    console.log("Upgrade contract", newImplementation, initData)
                  }
                  onStateChanged={() => {
                    // 状態変更後にデータを更新
                    updateRaffleData(true);
                  }}
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
