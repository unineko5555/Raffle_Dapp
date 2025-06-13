"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Zap, Wallet, CreditCard } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { ToastIcon } from "@/components/ui/toast-icon";
import { Badge } from "@/components/ui/badge";
import { supportedChains } from "./lib/web3-config";
import { contractConfig } from "./lib/contract-config";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { useRaffleContract } from "@/hooks/use-raffle-contract";
import { useRaffleWinEvents } from "@/hooks/use-raffle-win-events";
import { useWeb3Auth } from "@/hooks/use-web3auth";
import { useSmartAccountContext } from "./providers/smart-account-provider";
import { useRaffleHistory } from "@/hooks/use-raffle-history";
import { useWriteContract } from "wagmi";
import { RaffleABI } from "@/app/lib/contract-config";
import { encodeFunctionData } from "viem";

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
  const publicClient = usePublicClient({ chainId });
  const { writeContractAsync } = useWriteContract();

  // useRefフックをコンポーネントトップレベルで定義
  const tokenListenerChainIdRef = useRef<number | null>(null);
  const chainChangeIdRef = useRef<number | null>(null);

  // スマートアカウントの状態を取得
  const {
    smartAccountAddress,
    isReadyToSendTx,
    sendUserOperation,
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
    performUpkeep,
    performManualUpkeepWithVRF,
    performManualUpkeepWithMock,
    checkAutomationStatus,
    getContractEthBalance,
    getContractUsdcBalance,
    updateRaffleData,
  } = useRaffleContract();

  // コントラクト残高データ
  const [contractBalances, setContractBalances] = useState({
    ethBalance: "0.015",
    usdcBalance: "0",
  });

  // コントラクト残高を取得する関数 - forceUpdateフラグ対応
  const updateContractBalances = useCallback(async (forceUpdate = false) => {
    // デバッグログのレベルを下げる
    const isDebugMode = false;
    
    if (!getContractEthBalance || !getContractUsdcBalance) {
      return;
    }

    try {
      // レート制限対策オプションを渡す
      const options = { forceUpdate };
      
      // チェーンIDを含めてログ出力
      if (isDebugMode) console.log(`コントラクト残高更新開始 (チェーンID: ${chainId}${forceUpdate ? ', 強制更新': ''})`);
      
      const ethBalance = await getContractEthBalance(options);
      const usdcBalance = await getContractUsdcBalance(options);

      // 前回値と比較して変更があればログ出力
      if (ethBalance !== contractBalances.ethBalance || usdcBalance !== contractBalances.usdcBalance) {
        if (isDebugMode) {
          console.log('残高更新:', {
            前: { ETH: contractBalances.ethBalance, USDC: contractBalances.usdcBalance },
            後: { ETH: ethBalance, USDC: usdcBalance }
          });
        }
      }
      
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
  }, [getContractEthBalance, getContractUsdcBalance, chainId, contractBalances]);

  // 初回読み込み時のみコントラクト残高を更新（遅延実行）
  useEffect(() => {
    // 初回読み込みを少し遅らせてレート制限を回避
    const timer = setTimeout(() => {
      updateContractBalances();
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // トークン転送イベントの監視
  const watchTokenEvents = useCallback(() => {
    // デバッグログのレベルを下げる
    const isDebugMode = false; // デバッグモードフラグ
    
    if (!contractAddress || !getContractUsdcBalance || !publicClient) {
      if (isDebugMode) console.log('トークン監視のための条件を満たしていません');
      return () => {}; // 空のクリーンアップ関数を返す
    }
    
    // 現在のチェーンのERC20アドレスを取得（サポートされているチェーンのみ）
    const supportedChainIds = [11155111, 84532, 421614] as const;
    const isValidChainId = chainId && supportedChainIds.includes(chainId as any);
    const erc20Address = isValidChainId ? 
      contractConfig[chainId as keyof typeof contractConfig]?.erc20Address : null;
    
    if (!erc20Address) {
      if (isDebugMode) console.log(`現在のチェーンID ${chainId} のERC20アドレスが見つかりません`);
      return () => {}; // 空のクリーンアップ関数を返す
    }

    if (isDebugMode) console.log(`トークンイベント監視開始: チェーンID ${chainId}, トークン ${erc20Address}`);
    
    try {
      const unwatch = publicClient.watchContractEvent({
        address: erc20Address as `0x${string}`,
        abi: [{
          anonymous: false,
          inputs: [
            { indexed: true, name: "from", type: "address" },
            { indexed: true, name: "to", type: "address" },
            { indexed: false, name: "value", type: "uint256" }
          ],
          name: "Transfer",
          type: "event"
        }],
        eventName: "Transfer",
        onLogs: (logs) => {
          // コントラクトが送信元または受信先の転送をフィルタリング
          const relevantLogs = logs.filter(log => {
            const from = log.args.from?.toLowerCase();
            const to = log.args.to?.toLowerCase();
            const contractAddrLower = contractAddress.toLowerCase();
            return from === contractAddrLower || to === contractAddrLower;
          });
          
          if (relevantLogs.length > 0) {
            if (isDebugMode) console.log("コントラクトに関連するトークン転送を検出しました:", relevantLogs);
            // 残高の強制更新を実行
            updateContractBalances(true);
          }
        }
      });
      
      // クリーンアップ関数を返す
      return () => {
        if (isDebugMode) console.log('トークン監視を停止します');
        unwatch();
      };
    } catch (error) {
      console.error('イベント監視の設定エラー:', error);
      return () => {
        if (isDebugMode) console.log('エラーのため監視は実行されていません');
      };
    }
  }, [chainId, contractAddress, publicClient, updateContractBalances, getContractUsdcBalance]);
  
  // イベントリスナーの初期化 - リレンダリングを防ぐために依存配列を最適化
  useEffect(() => {
    // watchTokenEvents関数の依存リストがチェーンIDを含むため、不必要な再初期化を避ける
    // チェーンIDが変更された場合のみイベントリスナーを再初期化
    
    // チェーンが本当に変更された場合のみイベントリスナーを再設定
    if (chainId && tokenListenerChainIdRef.current !== chainId) {
      // 前回のチェーンIDを更新
      tokenListenerChainIdRef.current = chainId;
      
      // 新しいリスナーを設定
      const cleanupFn = watchTokenEvents();
      
      // クリーンアップ関数を返す
      return () => {
        cleanupFn();
      };
    }
    
    // 初回レンダリング時にはリスナー設定
    if (tokenListenerChainIdRef.current === null) {
      tokenListenerChainIdRef.current = chainId || 0;
      const cleanupFn = watchTokenEvents();
      return () => {
        cleanupFn();
      };
    }
    
    // 上記条件に該当しない場合は何もしない
    return () => {};
  }, [chainId, watchTokenEvents]);

  // 共通のラッフル開始処理
  const executeRaffle = async (upkeepFunction: () => Promise<any>, mode: string) => {
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

  // チェーンが変更されたときに強制更新フラグを設定し、残高を更新
  useEffect(() => {
    // デバッグログのレベルを下げる
    const isDebugMode = false;
    
    // 実際にチェーンが変わった場合だけアクションを実行
    if (chainId && chainChangeIdRef.current !== chainId) {
      chainChangeIdRef.current = chainId;
      
      // チェーン変更時に強制更新フラグを設定
      if (typeof window !== 'undefined') {
        (window as any).FORCE_CONTRACT_BALANCE_REFRESH = true;
      }
      
      // チェーン変更通知
      if (isDebugMode) console.log(`チェーン変更検出: チェーンID ${chainId} - 残高を強制更新します`);
      
      // チェーン切り替え後は少し遅延させて残高を更新
      const newActiveChain = supportedChains.find((c) => c.id === chainId);
      if (newActiveChain) {
        setActiveChain(newActiveChain);
        
        // 遅延させて確実にチェーン変更後のデータを取得
        setTimeout(() => {
          updateContractBalances(true);
        }, 1000);
      }
    }
  }, [chainId, updateContractBalances, supportedChains]);

  // 🎯 WINNER_SELECTED状態の自動監視と処理
  useEffect(() => {
    if (raffleData.raffleState === 2) { // WINNER_SELECTED状態を検出
      console.log("🔍 WINNER_SELECTED状態を検出 - 3秒後に自動処理を開始");
      
      // 少し遅延させて状態が安定してから実行
      const timer = setTimeout(() => {
        autoProcessWinner();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [raffleData.raffleState]); // raffleStateが変更されたときのみ実行

  // ラッフル参加成功時のコールバック
  const handleRaffleEntrySuccess = () => {
    // ラッフル参加後、自動的にデータが更新されるため何もしない
    console.log("ラッフル参加成功");
  };

  // 🎯 自動processWinner実行関数
  const autoProcessWinner = async () => {
    if (!contractAddress || (!isConnected && !isReadyToSendTx)) return;
    if (raffleData.raffleState !== 2) return; // WINNER_SELECTED状態でない場合は何もしない
    
    console.log("🎯 WINNER_SELECTED状態を検出 - 自動で勝者処理を実行");
    
    try {
      const useSmartAccount = isReadyToSendTx && smartAccountAddress && sendUserOperation;
      
      if (useSmartAccount && sendUserOperation) {
        console.log("🤖 スマートアカウントで自動勝者処理を実行中...");
        
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
        
        console.log("✅ スマートアカウント: 自動勝者処理完了", result?.txHash);
      } else if (isConnected && address && publicClient && writeContractAsync) {
        console.log("🔑 EOAで自動勝者処理を実行中...");
        
        const txHash = await writeContractAsync({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "processWinner",
          args: [],
          account: address,
        });

        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
          timeout: 60000
        });

        if (receipt.status === "reverted") {
          throw new Error("自動勝者処理トランザクションが失敗しました");
        }

        console.log("✅ EOA: 自動勝者処理完了");
      }
      
      // 成功後にデータを更新
      setTimeout(() => {
        console.log('🔄 自動勝者処理後のデータ更新...');
        updateRaffleData(true);
      }, 3000);
      
      // 成功通知
      toast({
        title: "🏆 勝者決定完了",
        description: "勝者が自動的に決定され、賞金が払い出されました！",
        variant: "default",
      });
      
    } catch (error: any) {
      console.error("❌ 自動勝者処理エラー:", error);
      
      // エラー通知（ユーザーフレンドリー）
      toast({
        title: "⚠️ 自動処理エラー",
        description: "管理パネルから手動で勝者処理を実行してください",
        variant: "destructive",
      });
    }
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
              onStartRaffleWithVRF={startRaffleWithVRF}
              onStartRaffleWithMock={startRaffleWithMock}
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
