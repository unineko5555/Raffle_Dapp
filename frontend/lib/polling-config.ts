/**
 * 共通ポーリング設定
 * 全体のポーリング間隔を8秒に延長してAPI制限問題を軽減
 */
export const POLLING_CONFIG = {
  // メインポーリング間隔（8秒）
  DEFAULT_INTERVAL: 8000,
  
  // 高頻度更新が必要な場合の間隔（5秒）
  HIGH_FREQUENCY_INTERVAL: 5000,
  
  // 低頻度更新で十分な場合の間隔（15秒）
  LOW_FREQUENCY_INTERVAL: 15000,
  
  // 初回遅延（コンポーネント初期化後の最初のポーリング）
  INITIAL_DELAY: 2000,
  
  // チェーン切り替え後の遅延
  CHAIN_SWITCH_DELAY: 3000,
  
  // トランザクション後の更新遅延
  TRANSACTION_UPDATE_DELAY: 3000,
} as const;

/**
 * フック別の推奨ポーリング間隔
 */
export const HOOK_SPECIFIC_INTERVALS = {
  // ラッフル参加状況（高優先度）
  RAFFLE_PARTICIPATION: POLLING_CONFIG.DEFAULT_INTERVAL,
  
  // ラッフル履歴（高優先度）
  RAFFLE_HISTORY: POLLING_CONFIG.DEFAULT_INTERVAL,
  
  // コントラクト残高（中優先度）
  CONTRACT_BALANCE: POLLING_CONFIG.DEFAULT_INTERVAL,
  
  // カウントダウンデータ（中優先度）
  COUNTDOWN_DATA: POLLING_CONFIG.DEFAULT_INTERVAL,
  
  // ウォレット残高（低優先度）
  WALLET_BALANCE: POLLING_CONFIG.LOW_FREQUENCY_INTERVAL,
  
  // ユーザー統計（低優先度）
  USER_STATS: POLLING_CONFIG.LOW_FREQUENCY_INTERVAL,
} as const;

/**
 * チェーン別の調整設定
 */
export const CHAIN_SPECIFIC_CONFIG = {
  // Base Sepolia (84532) - API制限が厳しい
  84532: {
    multiplier: 1.5, // 通常より1.5倍長く
    minInterval: 10000, // 最低10秒
  },
  
  // デフォルト設定
  default: {
    multiplier: 1.0,
    minInterval: POLLING_CONFIG.DEFAULT_INTERVAL,
  },
} as const;

/**
 * チェーンIDに応じたポーリング間隔を取得
 */
export function getPollingInterval(baseInterval: number, chainId?: number): number {
  if (!chainId) return baseInterval;
  
  const chainConfig = CHAIN_SPECIFIC_CONFIG[chainId as keyof typeof CHAIN_SPECIFIC_CONFIG] 
    || CHAIN_SPECIFIC_CONFIG.default;
  
  const adjustedInterval = Math.max(
    baseInterval * chainConfig.multiplier,
    chainConfig.minInterval
  );
  
  return Math.round(adjustedInterval);
}

/**
 * フック名に基づいて推奨間隔を取得
 */
export function getHookInterval(hookName: keyof typeof HOOK_SPECIFIC_INTERVALS, chainId?: number): number {
  const baseInterval = HOOK_SPECIFIC_INTERVALS[hookName];
  return getPollingInterval(baseInterval, chainId);
}