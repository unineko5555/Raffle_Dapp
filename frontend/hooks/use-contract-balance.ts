import { useState, useCallback, useRef, useEffect } from "react";
import { useChainId } from "wagmi";
import { contractConfig } from "@/app/lib/contract-config";

interface ContractBalanceData {
  ethBalance: string;
  usdcBalance: string;
}

interface UseContractBalanceOptions {
  getContractEthBalance?: (options?: { forceUpdate?: boolean }) => Promise<string>;
  getContractUsdcBalance?: (options?: { forceUpdate?: boolean }) => Promise<string>;
  contractAddress?: string;
  publicClient?: any;
}

interface UseContractBalanceReturn {
  contractBalances: ContractBalanceData;
  updateContractBalances: (forceUpdate?: boolean) => Promise<void>;
  watchTokenEvents: () => (() => void);
}

export function useContractBalance({
  getContractEthBalance,
  getContractUsdcBalance,
  contractAddress,
  publicClient,
}: UseContractBalanceOptions): UseContractBalanceReturn {
  const chainId = useChainId();
  
  // コントラクト残高データ
  const [contractBalances, setContractBalances] = useState<ContractBalanceData>({
    ethBalance: "0.015",
    usdcBalance: "0",
  });

  // レート制限用の状態を追加
  const lastBalanceUpdateRef = useRef(0);
  const BALANCE_UPDATE_INTERVAL = 30000; // 30秒制限（API制限対策）
  const tokenListenerChainIdRef = useRef<number | null>(null);

  // コントラクト残高を取得する関数 - forceUpdateフラグ対応（レート制限付き）
  const updateContractBalances = useCallback(async (forceUpdate = false) => {
    // デバッグログのレベルを下げる
    const isDebugMode = false;
    
    if (!getContractEthBalance || !getContractUsdcBalance) {
      return;
    }

    // レート制限チェック（強制更新でない場合）
    const now = Date.now();
    if (!forceUpdate && (now - lastBalanceUpdateRef.current) < BALANCE_UPDATE_INTERVAL) {
      if (isDebugMode) console.log('残高更新をスキップ - レート制限中');
      return;
    }

    try {
      // レート制限対策オプションを渡す
      const options = { forceUpdate };
      
      // チェーンIDを含めてログ出力
      if (isDebugMode) console.log(`コントラクト残高更新開始 (チェーンID: ${chainId}${forceUpdate ? ', 強制更新': ''})`);
      
      const ethBalance = await getContractEthBalance(options);
      const usdcBalance = await getContractUsdcBalance(options);

      // 関数型更新を使用して無限ループを防止
      setContractBalances(prevBalances => {
        // 前回値と比較して変更があればログ出力
        if (ethBalance !== prevBalances.ethBalance || usdcBalance !== prevBalances.usdcBalance) {
          if (isDebugMode) {
            console.log('残高更新:', {
              前: { ETH: prevBalances.ethBalance, USDC: prevBalances.usdcBalance },
              後: { ETH: ethBalance, USDC: usdcBalance }
            });
          }
          lastBalanceUpdateRef.current = now; // 更新時刻を記録
          return {
            ethBalance: ethBalance,
            usdcBalance: usdcBalance,
          };
        }
        return prevBalances; // 変更なしの場合は既存値を返す
      });
    } catch (error) {
      // エラーログを抑制し、代わりにデフォルト値を設定
      console.warn("コントラクト残高取得エラー:", error);
      setContractBalances({
        ethBalance: "0.015", // デフォルト値
        usdcBalance: "0", // デフォルト値
      });
      lastBalanceUpdateRef.current = now; // エラー時も更新時刻を記録
    }
  }, [getContractEthBalance, getContractUsdcBalance, chainId]);

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
        onLogs: (logs: any[]) => {
          // コントラクトが送信元または受信先の転送をフィルタリング
          const relevantLogs = logs.filter((log: any) => {
            const from = log.args.from?.toLowerCase();
            const to = log.args.to?.toLowerCase();
            const contractAddrLower = contractAddress.toLowerCase();
            return from === contractAddrLower || to === contractAddrLower;
          });
          
          if (relevantLogs.length > 0) {
            if (isDebugMode) console.log("コントラクトに関連するトークン転送を検出しました:", relevantLogs);
            // 残高の強制更新を実行（ただし、レート制限を適用）
            setTimeout(() => {
              updateContractBalances(false); // 強制更新ではなく通常更新に変更
            }, 5000); // 5秒遅延してAPI負荷を軽減
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

  return {
    contractBalances,
    updateContractBalances,
    watchTokenEvents,
  };
}