# CLAUDE.md

このファイルは、このリポジトリでコードを扱う際の Claude Code (claude.ai/code) への指針を提供します。

# Raffle DApp - Claude 開発ガイド

**最終更新**: 2025-07-07

## プロジェクト概要

これは**Chainlink VRF**、**Automation**、**CCIP**を使用したクロスチェーン機能を持つ**マルチチェーン Raffle DApp**です。複数の L2 テストネット上で USDC ベースのラッフルに参加でき、透明で検証可能なランダム勝者選択を提供します。

### 主要機能

- **分散型ラッフルシステム**: 証明可能なランダム性のための Chainlink VRF を使用した完全オンチェーン
- **マルチチェーンサポート**: Ethereum Sepolia, Base Sepolia, Arbitrum Sepolia
- **自動運用**: 定期的な抽選のための Chainlink Automation
- **クロスチェーンブリッジ**: クロスチェーントークン転送のための CCIP 統合
- **アップグレード可能コントラクト**: 安全なアップグレードのための UUPS プロキシパターン
- **スマートウォレット統合**: Account Kit と Web3Auth のサポート
- **ガス最適化**: L2 固有のガス処理（Base Sepolia で重要）

## アーキテクチャ

### 技術スタック

**バックエンド（スマートコントラクト）**

- **フレームワーク**: Foundry (Forge, Anvil, Cast)
- **言語**: Solidity ^0.8.19
- **ライブラリ**: OpenZeppelin v5.0.2, Chainlink CCIP v1.6.0
- **テスト**: ユニット/統合テストを含む Forge テストスイート
- **デプロイ**: Makefile ベースのマルチチェーンデプロイ

**フロントエンド（Web アプリケーション）**

- **フレームワーク**: Next.js 15 (React 18)
- **スタイリング**: Tailwind CSS v4.1.5, Radix UI コンポーネント
- **Web3**: wagmi v2.14.16, viem v2.8.6, ethers.js v5.7.2
- **状態管理**: React Hooks + Context API
- **認証**: Account Kit (Alchemy), Web3Auth, WalletConnect

**インフラストラクチャ**

- **コンテナ化**: Docker + Docker Compose
- **フロントエンドデプロイ**: Vercel
- **コントラクト検証**: Etherscan, Basescan, Arbiscan
- **RPC プロバイダー**: Alchemy API

### プロジェクト構造

```
Raffle_Dapp/
├── backend/                    # Foundryスマートコントラクト
│   ├── src/                   # コントラクトソースコード
│   │   ├── RaffleImplementation.sol      # メインラッフルロジック
│   │   ├── RaffleProxy.sol              # UUPSプロキシ
│   │   ├── RaffleBridgeImplementation.sol # CCIPブリッジ
│   │   └── interfaces/                   # コントラクトインターフェース
│   ├── script/                # デプロイスクリプト
│   │   ├── RaffleProxyDeployer.s.sol    # メインデプロイスクリプト
│   │   ├── RaffleUpgrader.s.sol         # アップグレードスクリプト
│   │   └── HelperConfig.s.sol           # ネットワーク設定
│   ├── test/                  # テストスイート
│   ├── broadcast/             # デプロイログとアドレス
│   ├── Makefile              # ビルド、テスト、デプロイコマンド
│   └── foundry.toml          # Foundry設定
├── frontend/                   # Next.jsアプリケーション
│   ├── app/                   # Appルーター構造
│   │   ├── components/        # Reactコンポーネント
│   │   │   ├── raffle/        # ラッフル固有コンポーネント
│   │   │   ├── admin/         # 管理パネル
│   │   │   ├── bridge/        # クロスチェーンブリッジUI
│   │   │   └── auth/          # ウォレット接続
│   │   ├── lib/              # 設定とユーティリティ
│   │   │   ├── contract-config.ts    # コントラクトアドレスとABI
│   │   │   ├── web3-config.ts        # Web3プロバイダー設定
│   │   │   ├── database.ts           # 共有APIデータベースユーティリティ
│   │   │   └── alchemy/              # Account Kit設定
│   │   ├── api/              # データインデックス用APIルート
│   │   │   └── raffle/       # ラッフル固有エンドポイント
│   │   └── providers/        # Reactコンテキストプロバイダー
│   ├── hooks/                # カスタムReactフック
│   │   ├── shared/           # 共有ユーティリティフック
│   │   │   ├── use-contract-config.ts    # コントラクトアドレス解決
│   │   │   └── use-smart-account-transaction.ts # 統一トランザクション処理
│   │   ├── use-raffle-automation.ts  # VRF自動化（ガス最適化）
│   │   ├── use-raffle-data.ts       # コントラクトデータ取得
│   │   └── use-smart-account.ts     # スマートウォレット統合
│   └── package.json          # 依存関係とスクリプト
├── scripts/                    # デプロイとメンテナンススクリプト
│   ├── update-contracts.js    # コントラクト設定自動更新
│   └── update-bridge-config.js # ブリッジ設定
├── raffleIndexer/             # rindexerによるイベントインデックス
│   ├── rindexer.yaml         # インデックス設定
│   └── data/                 # CSVデータ出力
├── docker-compose.yml         # 開発環境
├── package.json              # ルートパッケージ設定
└── CLAUDE.md                 # このファイル
```

## 開発セットアップ

### 前提条件

- **Docker & Docker Compose** (ローカル開発推奨)
- **Node.js** v18+ (Docker なしで実行する場合)
- **Foundry** (バックエンドをローカルで実行する場合)

### Docker でのクイックスタート

```bash
# プロジェクトをクローンしてディレクトリに移動
cd /path/to/Raffle_Dapp

# 開発環境を開始
docker-compose up

# サービスにアクセス
# フロントエンド: http://localhost:3000
# バックエンド (Anvil): http://localhost:8545
```

### 環境変数

必要に応じて`.env`ファイルを作成:

```bash
# バックエンド (backend/ディレクトリの.env)
PRIVATE_KEY=your_private_key
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-key
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/your-key
ARBITRUM_SEPOLIA_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/your-key
ETHERSCAN_API_KEY=your_etherscan_key
BASE_API_KEY=your_basescan_key
ARBISCAN_API_KEY=your_arbiscan_key

# フロントエンド (frontend/ディレクトリの.env.local)
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_id
```

## よく使用する開発コマンド

### バックエンド (Foundry)

```bash
# バックエンドコンテナに入る
docker-compose exec backend sh

# またはプロジェクトルートからMakefileコマンドを使用
cd backend/

# 依存関係をインストール
make install

# コントラクトをビルド
make build

# 全テストを実行
make test

# ユニットテストのみ実行
make test-unit

# 詳細出力で実行
forge test -vvv

# 全テストネットにデプロイ
make deploy-raffle-proxy

# 特定のネットワークにデプロイ
make deploy-raffle-proxy-sepolia
make deploy-raffle-proxy-base
make deploy-raffle-proxy-arb

# 全ネットワークでコントラクトをアップグレード
make upgrade-raffle

# デプロイ後にフロントエンド設定を更新
make update-frontend

# コードをフォーマット
make format

# Anvilでのローカル開発
make anvil                    # ローカルチェーンを開始
make deploy-anvil            # ローカルチェーンにデプロイ
```

### フロントエンド (Next.js)

```bash
# フロントエンドコンテナに入る
docker-compose exec frontend sh

# またはローカルで実行
cd frontend/

# 依存関係をインストール
npm install

# 開発サーバーを開始
npm run dev

# 本番用にビルド
npm run build

# 本番サーバーを開始
npm start

# コードをリント
npm run lint

# コントラクト設定を更新 (プロジェクトルートから)
npm run update-contracts
```

### デプロイワークフロー

```bash
# 1. 全テストネットにコントラクトをデプロイ
cd backend && make deploy-raffle-proxy

# 2. フロントエンド設定を更新
cd .. && npm run update-contracts

# 3. コントラクトを検証 (オプション)
cd backend && make verify-sepolia verify-base-sepolia verify-arb-sepolia
```

## コントラクト設定

### ネットワーク詳細

```typescript
// コントラクトアドレスは frontend/app/lib/contract-config.ts で自動管理されます
export const contractConfig = {
  11155111: {
    // Ethereum Sepolia
    name: "Ethereum Sepolia",
    raffleProxy: "0x...",
    erc20Address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC
    blockExplorer: "https://sepolia.etherscan.io",
  },
  84532: {
    // Base Sepolia
    name: "Base Sepolia",
    raffleProxy: "0x...",
    erc20Address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC
    blockExplorer: "https://sepolia.basescan.org",
  },
  421614: {
    // Arbitrum Sepolia
    name: "Arbitrum Sepolia",
    raffleProxy: "0x...",
    erc20Address: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", // USDC
    blockExplorer: "https://sepolia-explorer.arbitrum.io",
  },
};
```

### 主要なコントラクト関数

- `enterRaffle(uint256 amount)` - USDC でラッフルに参加
- `performUpkeep(bytes calldata)` - Chainlink automation トリガー
- `fulfillRandomWords(uint256, uint256[])` - VRF コールバック
- `processWinner()` - 勝者選択の確定
- `addMockPlayer(address)` - テスト用管理関数
- `resetPlayers()` - 状態リセット用管理関数

## 重要な実装詳細

### L2 ネットワークのガス最適化

**重要**: Base Sepolia は二重料金構造（L2 実行 + L1 データ可用性）により特別なガス処理が必要です。

`frontend/hooks/use-raffle-automation.ts`に実装:

```typescript
// Base Sepolia gas optimization (chainId 84532)
if (chainId === 84532) {
  console.log("Base Sepolia: ガス設定を最適化");
  try {
    const gasEstimate = await publicClient.estimateContractGas({
      address: contractAddress as `0x${string}`,
      abi: RaffleABI,
      functionName: "performUpkeep",
      args: ["0x"],
      account: address,
    });
    // 30% gas buffer for L1 data availability fee volatility
    txParams.gas = gasEstimate + (gasEstimate * BigInt(30)) / BigInt(100);
  } catch (gasError) {
    console.warn("ガス估算エラー - デフォルト値を使用:", gasError);
    txParams.gas = BigInt(2500000); // Base Sepolia VRF max gas limit
  }
}
```

**重要な理由**: 適切なガス最適化なしでは、L1 データ投稿コストの不足により、Base Sepolia で`performUpkeep`コールが revert します。

### スマートコントラクトプロキシパターン

**UUPS (Universal Upgradeable Proxy Standard)**パターンを使用:

- `RaffleProxy.sol` - プロキシコントラクト（アドレス不変）
- `RaffleImplementation.sol` - ロジックコントラクト（アップグレード可能）
- `upgradeTo(address newImplementation)`経由でアップグレード

### Chainlink 統合

**VRF (Verifiable Random Function)**:

- サブスクリプションベースの VRF 2.5
- `HelperConfig.s.sol`でネットワーク毎に設定
- ランダムワードで勝者選択を実現

**Automation (Keepers)**:

- アップキープ条件でラッフル状態をチェック
- 条件が満たされると`performUpkeep`を自動トリガー
- 各 L2 ネットワーク用にガス最適化済み

## 主要なフロントエンドフック

### 共有ユーティリティフック (hooks/shared/)

- `use-contract-config.ts` - **コア**: サポートされた全ネットワークのチェーン ID 検証とコントラクトアドレス解決
- `use-smart-account-transaction.ts` - **コア**: EOA と Account Abstraction の L2 ガス最適化統一トランザクション処理

### ラッフル機能フック

- `use-raffle-data.ts` - コントラクト状態読み取り（プレイヤー、ステータス、ジャックポット）- **共有フック使用**
- `use-raffle-participation.ts` - ラッフル参加/退出操作
- `use-raffle-automation.ts` - **重要**: L2 ガス最適化付き VRF 自動化
- `use-auto-winner-processor.ts` - 状態変更時の自動勝者処理

### ウォレットとアカウント管理

- `use-smart-account.ts` - スマートウォレット用 Account Kit 統合
- `use-web3auth.ts` - Web3Auth ソーシャルログイン統合
- `use-wallet-balances.ts` - USDC と ETH 残高追跡

### クロスチェーン機能

- `use-token-bridge.ts` - CCIP クロスチェーントークン転送
- `use-contract-balance.ts` - マルチチェーンコントラクト残高監視

### API 統合

- `app/lib/database.ts` - **共有**: API ルート用データベース接続プールとクエリユーティリティ
- `app/api/raffle/entries/route.ts` - ラッフル参加履歴エンドポイント
- `app/api/raffle/history/route.ts` - 勝者履歴エンドポイント
- `app/api/raffle/stats/route.ts` - 統計集約エンドポイント

## テスト

### バックエンドテスト

```bash
# Unit tests
forge test --match-path "test/unit/**" -vvv

# Integration tests
forge test --match-path "test/integration/**" -vvv

# Test coverage
forge coverage

# Gas reporting
forge test --gas-report
```

### Frontend Testing

Currently no formal test suite. Manual testing workflow:

1. Connect wallet on each supported network
2. Enter raffle with various USDC amounts
3. Trigger automation (admin panel)
4. Verify winner selection and prize distribution
5. Test cross-chain bridge functionality

## Deployment & Upgrades

### Initial Deployment

```bash
# Deploy proxies to all testnets and update frontend
make deploy-raffle-proxy-with-update

# Or deploy to specific network
make deploy-raffle-proxy-sepolia
make update-frontend
```

### Contract Upgrades

```bash
# Upgrade implementations on all networks
make upgrade-raffle

# Upgrade with initialization data
make upgrade-raffle-with-data

# Update frontend ABI only (for upgrades)
make update-frontend-upgrade
```

### Verification

```bash
# Verify on all networks
make verify-sepolia verify-base-sepolia verify-arb-sepolia
```

## Troubleshooting

### Common Issues

1. **Base Sepolia `performUpkeep` Reverts**

   - **Solution**: Ensure gas optimization is implemented in `use-raffle-automation.ts`
   - **Root Cause**: L2 networks have dual fee structure requiring gas buffers

2. **Contract Address Mismatch**

   - **Solution**: Run `npm run update-contracts` after deployment
   - **Location**: Check `frontend/app/lib/contract-config.ts`

3. **VRF Subscription Issues**

   - **Solution**: Verify subscription has sufficient LINK balance
   - **Check**: Chainlink VRF subscription manager

4. **Smart Wallet Connection Fails**
   - **Solution**: Verify Account Kit configuration in `frontend/app/lib/alchemy/`
   - **Common**: API key or network mismatch

### Debug Commands

```bash
# Check contract deployment status
cd backend && ls broadcast/RaffleProxyDeployer.s.sol/*/

# View deployment logs
cat backend/broadcast/RaffleProxyDeployer.s.sol/84532/run-latest.json

# Check frontend config
cat frontend/app/lib/contract-config.ts

# Docker container logs
docker-compose logs frontend
docker-compose logs backend
```

## Important Files to Monitor

### Configuration Files

- `frontend/app/lib/contract-config.ts` - **Auto-generated**: Contract addresses & ABIs
- `backend/script/HelperConfig.s.sol` - Network-specific configurations
- `backend/foundry.toml` - Foundry build settings
- `docker-compose.yml` - Development environment config

### Key Deployment Files

- `backend/script/RaffleProxyDeployer.s.sol` - Main deployment script
- `scripts/update-contracts.js` - Auto-updates frontend config from deployments
- `backend/broadcast/` - Deployment logs with contract addresses

### Critical Frontend Components

- `hooks/shared/use-contract-config.ts` - **Core**: Unified contract address resolution
- `hooks/shared/use-smart-account-transaction.ts` - **Core**: Transaction handling with gas optimization
- `hooks/use-raffle-automation.ts` - **Contains L2 gas optimization fixes**
- `components/admin/owner-admin-panel.tsx` - Contract management interface (refactored with shared utilities)
- `app/lib/web3-config.ts` - Wagmi/Web3 provider configuration
- `app/lib/database.ts` - **Shared**: API database utilities and query builders

## Development Notes

### Code Conventions

- **Solidity**: Follow OpenZeppelin patterns, extensive NatSpec comments
- **TypeScript**: Strict typing, descriptive function/variable names, avoid `any` types
- **React**: Custom hooks for contract interactions, component composition, shared utility hooks in `hooks/shared/`
- **Styling**: Tailwind utility classes, Radix UI for complex components
- **Code Organization**: Use shared utilities to avoid duplication, centralized configuration management

### Security Considerations

- All contracts use OpenZeppelin's security patterns
- UUPS proxy pattern with proper access controls
- VRF provides cryptographic randomness
- Multi-sig recommended for production owner roles

### Performance Optimizations

- Gas optimization for L2 networks (implemented)
- Contract state reading batched where possible
- Frontend React.memo for expensive components
- Image optimization via Next.js

---

## クイックリファレンス

**開発開始**: `docker-compose up`
**全ネットワークデプロイ**: `cd backend && make deploy-raffle-proxy-with-update`
**設定更新**: `npm run update-contracts`
**テスト実行**: `cd backend && make test`
**ログ確認**: `docker-compose logs [frontend|backend]`

**最近の改善点**:

**2025-06-27**:
- **コードリファクタリング**: 共有ユーティリティにより 1200+行の重複コードを削除
- **共有フック**: 統一されたコントラクト設定とトランザクション処理で`hooks/shared/`を作成
- **API 最適化**: `app/lib/database.ts`でデータベースユーティリティを統合
- **型安全性**: TypeScript 型を改善し`any`使用を削減
- **ガス最適化**: トランザクションユーティリティで L2 ネットワークガス処理を強化

**2025-07-07**:
- **イベント監視実装**: `use-raffle-event-listener.ts`による完全自動VRF勝者処理
- **ポーリング方式廃止**: `use-auto-winner-processor.ts`削除、リソース効率向上
- **EOA/AA統一**: 共有トランザクションユーティリティでウォレット種別を問わず自動実行
- **反応速度向上**: 3秒間隔ポーリング → 1秒以内イベント監視に改善

**解決済み重要問題**: 
- Base Sepolia ガス最適化（共有トランザクションユーティリティ）
- VRF自動勝者処理の完全自動化（イベント監視方式）

このガイドは、Raffle DApp の今後の開発作業に包括的なコンテキストを提供します。このプロジェクトは、適切な L2 最適化、モダンな Web3 UX パターン、保守可能なコードのための整理された共有ユーティリティを備えた洗練されたマルチチェーンラッフルシステムを正常に実装しています。

## 開発中のつまづきポイントとワークアラウンド

### 解決済み問題

- **Base Sepolia ガス不足問題** (2025-06-27)

  - 問題: `performUpkeep`がガス不足で revert
  - 解決策: `use-raffle-automation.ts`で 30%ガスバッファ追加
  - 場所: `frontend/hooks/use-raffle-automation.ts:264-279`

- **コード重複問題** (2025-06-27)

  - 問題: 1200+行の重複コード
  - 解決策: 共有 utility hooks 作成 (`hooks/shared/`)
  - 影響: TypeScript 型安全性向上、保守性改善

- **プロキシコントラクトとイミュータブル変数問題** (2025 年開発中)

  - 問題: イミュータブル変数がプロキシパターンで委譲されない
  - 現象: フロントエンドとコントラクトで異なる USDC アドレスを参照
  - 解決策: イミュータブル変数を通常のストレージ変数に変更、初期化関数で設定
  - 注意: ガスコスト増加（3 ガス → 2100 ガス）だが、プロキシ互換性が向上

- **スマートアカウントチェーン切り替え問題** (2025 年開発中)

  - 問題: チェーン切り替え時に RPC URL が更新されず、常に Ethereum Sepolia に送信
  - 現象: Base Sepolia で操作しても Sepolia RPC エンドポイントに送信される
  - 解決策: チェーン切り替え時にスマートアカウントクライアントを完全にリセット
  - 場所: スマートアカウント管理 hook

- **Base Sepolia VRF コールバック重複問題** (2025 年開発中)

  - 問題: `OnlyCoordinatorCanFulfill`エラー（0x79bfd401）
  - 根本原因: VRFConsumerBaseV2Plus 継承によるストレージレイアウト競合
  - 現象: L2 特有のガス計算で VRF コールバックが 2 回実行、owner()が zero address
  - 解決策: initialize 関数で assembly 直接設定 `sstore(0, initialOwner)`
  - 影響: Base Sepolia での VRF 機能正常化

- **Arbitrum Sepolia 動的ガス設定問題** (2025 年開発中)
  - 問題: `intrinsic gas too low`エラー
  - 原因: L1+L2 二層料金体系で明示的なガス設定が必要
  - 解決策: estimateContractGas + 20%バッファ + フォールバック値設定
  - 注意: Arbitrum では`gasPrice`または`maxFeePerGas`の明示的設定が必須

### 既知の課題

- **Base Sepolia での L1 データ可用性費用の変動**
- **Base Sepolia スマートアカウント使用時のAPI制限問題** (2025-07-07)
  - 現象: Base Sepoliaでのみスマートアカウント接続時に`429 Too Many Requests`エラーが頻発
  - 原因: L2特有の二層構造（L1データ可用性+L2実行）でAccount Kit SDKが大量のRPC呼び出しを実行
  - 他チェーン: Ethereum Sepolia、Arbitrum Sepoliaでは問題なし
  - 対策: Base Sepolia専用のポーリング間隔延長、RPC分散、キャッシュ強化が必要
- VRF サブスクリプションの自動補充未実装
- ストレージレイアウト互換性：UUPS アップグレード時は新変数を末尾に配置必須
- Chainlink Automation 設定：target contract は proxy address、ABI は Implementation 使用

### 開発時の注意点

- 新しい hook は`hooks/shared/`の共通 utilities 使用を検討
- L2 ネットワークでは必ずガス最適化を実装
- **プロキシパターン使用時はイミュータブル変数を避ける**
- **スマートアカウントでチェーン切り替え時はクライアント再初期化必須**
- **UUPS アップグレード前にストレージレイアウト互換性を必ず確認**
- **VRF 継承使用時は初期化で owner()を適切に設定**
- **Base/Arbitrum Sepolia では動的ガス設定とバッファが必要**
- **Base Sepolia スマートアカウントでは特別なAPI制限対策が必要**
  - ポーリング間隔を他チェーンより長く設定（15秒 vs 3秒）
  - 複数RPCエンドポイントの併用（Alchemy + Base公式 + Infura）
  - スマートアカウント専用のキャッシュ戦略実装
- **Chainlink VRF デプロイ後は mockVRFProvider コントラクトでの承認が必要**

### 状態管理のガイドライン

#### **階層構造の原則**
- **Global State**: wagmi + React Query（ブロックチェーン状態）
- **Context API**: カスタム状態（スマートアカウント等）
- **Component State**: useState（UI状態、フォーム、キャッシュ）
- **Server State**: useReadContract（自動ポーリング + キャッシュ）

#### **共有フックの活用**
```typescript
// ✅ 推奨: 共有utilities使用
const { contractAddress, publicClient, isValidChainId } = useContractConfig();
const { executeTransaction } = useSmartAccountTransaction();

// ❌ 避ける: 重複実装
const chainId = useChainId();
const contractAddress = contractConfig[chainId]?.raffleProxy;
```

#### **状態更新パターン**
- **楽観的更新**: UIを即座に更新後、サーバー状態で確認
- **エラーハンドリング**: 失敗時は前の状態にロールバック
- **条件付きレンダリング**: 必要時のみコンポーネント描画

#### **パフォーマンス最適化**
- **useCallback/useMemo**: 重い処理とデータ変換のメモ化必須
- **キャッシュ戦略**: 頻繁なRPCコールを避けるためのローカルキャッシュ
- **依存配列**: useEffectの依存配列を適切に管理

#### **永続化戦略**
- **localStorage**: 認証情報とウォレット接続状態
- **React Query**: サーバーデータの自動キャッシュ（24時間GC、5分stale）
- **Session Storage**: 一時的なUI状態

## VRF自動勝者処理の重要な修正（2025-07-04→2025-07-07）

### 第1段階: ポーリング方式への改善（2025-07-04）

#### 修正前の問題
```typescript
// 問題のあった実装
const { data: raffleStateData } = useReadContract({...}); // wagmiキャッシュ依存
useEffect(() => {
  if (raffleState === 2) { // フロントエンド状態監視
    autoProcessWinner();
  }
}, [raffleState]);
```

**問題点**:
- wagmiのReact Queryキャッシュに依存
- タブが非アクティブ時は状態更新が停止
- 手動リフレッシュまたはタブ切り替えが必要
- VRF完了後も自動勝者決定が実行されない

#### 第1段階の改善実装
```typescript
// 改善された実装（use-auto-winner-processor.ts）
useEffect(() => {
  const pollContractState = async () => {
    // フロントエンド状態を無視して直接コントラクトから読み取り
    const currentState = await publicClient.readContract({
      address: contractAddress,
      abi: RaffleABI,
      functionName: "getRaffleState"
    });
    
    if (Number(currentState) === 2 && !hasProcessedWinner) {
      console.log("🚨 コントラクトでWINNER_SELECTED状態検知 - 自動処理開始");
      await autoProcessWinner(); // 即座に実行
    }
    
    // 状態リセット処理
    if (Number(currentState) === 0 && hasProcessedWinner) {
      setHasProcessedWinner(false);
      setIsPolling(true);
    }
  };
  
  // 初回即座に実行
  pollContractState();
  
  // 3秒間隔でポーリング（タブが非アクティブでも継続）
  const interval = setInterval(pollContractState, 3000);
  return () => clearInterval(interval);
}, [contractAddress, publicClient, isPolling, hasProcessedWinner]);
```

### 第2段階: イベント監視への最終改善（2025-07-07）

#### イベント監視方式の実装

**新規ファイル**: `frontend/hooks/use-raffle-event-listener.ts`

```typescript
// 🔥 完全なイベント監視実装
export function useRaffleEventListener({ updateRaffleData }: UseRaffleEventListenerOptions) {
  const { executeTransaction } = useSmartAccountTransaction(); // EOA/AA統一処理

  // 🎯 自動processWinner実行関数
  const autoProcessWinner = useCallback(async () => {
    const result = await executeTransaction({
      contractAddress,
      abi: RaffleABI,
      functionName: "processWinner",
      args: [],
      value: BigInt(0),
      gasOptimization: { chainId: publicClient?.chain?.id || 0, gasBufferPercent: 20 },
    });
    // 成功処理...
  }, [contractAddress, executeTransaction, updateRaffleData, toast, publicClient]);

  // 🔥 イベント監視の開始
  useEffect(() => {
    // RandomWordsReceived イベント監視
    const unwatchRandomWords = publicClient.watchContractEvent({
      address: contractAddress as `0x${string}`,
      abi: RaffleABI,
      eventName: "RandomWordsReceived",
      onLogs: (logs) => { /* VRF結果受信ログ */ },
    });

    // RaffleStateChanged イベント監視 - WINNER_SELECTED状態で自動実行
    const unwatchStateChange = publicClient.watchContractEvent({
      address: contractAddress as `0x${string}`,
      abi: RaffleABI,
      eventName: "RaffleStateChanged",
      onLogs: (logs) => {
        logs.forEach((log: Log & { args?: any }) => {
          const args = log.args as { newState?: number };
          const newState = args.newState;
          
          // 状態2（WINNER_SELECTED）で自動実行
          if (newState === 2) {
            console.log("🚨 WINNER_SELECTED状態検知 - 自動勝者処理開始");
            setTimeout(() => autoProcessWinner(), 1000); // 1秒後に実行
          }
        });
      },
    });

    // WinnerPicked イベント監視
    const unwatchWinnerPicked = publicClient.watchContractEvent({
      address: contractAddress as `0x${string}`,
      abi: RaffleABI,
      eventName: "WinnerPicked",
      onLogs: (logs) => {
        updateRaffleData(true); // データ更新
      },
    });

    // クリーンアップ関数を返す
    return () => {
      unwatchRandomWords();
      unwatchStateChange();
      unwatchWinnerPicked();
    };
  }, [contractAddress, publicClient, autoProcessWinner, updateRaffleData]);
}
```

#### 実装の変更点

**削除されたファイル**: 
- `frontend/hooks/use-auto-winner-processor.ts` (ポーリング方式)

**修正されたファイル**:
- `frontend/app/page.tsx`: `useRaffleEventListener`へ置き換え

```typescript
// 修正前（ポーリング方式）
useAutoWinnerProcessor({
  contractAddress: contractAddress || undefined,
  isConnected, isReadyToSendTx, smartAccountAddress, sendUserOperation,
  updateRaffleData,
});

// 修正後（イベント監視方式）
useRaffleEventListener({
  updateRaffleData,
});
```

### 改善効果の比較

| 項目 | 初期実装 | ポーリング方式 | **イベント監視方式** |
|------|---------|---------------|-------------------|
| **反応速度** | UI更新待ち | 3秒間隔 | **即座（1秒以内）** |
| **リソース消費** | 高（UI監視） | 中（定期RPC） | **低（必要時のみ）** |
| **信頼性** | UI状態依存 | コントラクト直接 | **ブロックチェーンイベント直接** |
| **タブ非アクティブ** | 停止 | 停止する可能性 | **常に動作** |
| **EOA/AA対応** | 個別実装 | 個別実装 | **統一処理** |
| **L2ガス最適化** | なし | 一部対応 | **完全対応** |

### 最終的なUX改善結果

**初期実装**: ユーザーがラッフル開始 → VRF完了 → **手動でF5またはタブ切り替え** → 勝者決定

**ポーリング方式**: ユーザーがラッフル開始 → VRF完了 → **最大3秒待機** → 勝者決定

**イベント監視方式**: ユーザーがラッフル開始 → VRF完了 → **自動で勝者決定完了** ⚡

この最終実装により、ユーザーは**ラッフル開始ボタンを押すだけで、VRF結果→勝者決定まで完全自動化**され、**どのウォレット（EOA/スマートアカウント）でも統一された体験**を提供します。

## Base Sepolia スマートアカウント接続時のAPI制限対策（2025-07-07）

### 問題の詳細

#### **現象**
```
POST https://base-sepolia.g.alchemy.com/v2/KEY 429 (Too Many Requests)
use-raffle-participation.ts:129 checkPlayerEntered
use-raffle-participation.ts:265 checkTokenBalanceWithInfo
```

Base Sepoliaでスマートアカウント接続時のみ、大量のRPCリクエストによりAlchemy API制限に達する。

#### **影響範囲**
- **問題チェーン**: Base Sepolia (84532) のみ
- **正常チェーン**: Ethereum Sepolia (11155111), Arbitrum Sepolia (421614)
- **条件**: スマートアカウント（Account Kit）使用時のみ

#### **根本原因**
1. **L2特有の二層構造**: L1データ可用性 + L2実行の複雑なガス計算
2. **Account Kit SDKの過剰な状態監視**: Base Sepoliaで未最適化
3. **React の重複レンダリング**: useEffectの依存配列問題

### 技術的分析

#### **Base Sepolia特有の複雑さ**
```javascript
// Base Sepoliaでの追加監視項目
- L1ガス価格の監視
- L2実行ガスの監視  
- データ可用性コストの計算
- バンドラーの状態確認
- UserOperation の mempool 監視
```

#### **他チェーンとの比較**
| チェーン | ガス構造 | 監視項目 | RPC負荷 |
|---------|----------|----------|---------|
| Ethereum Sepolia | 単層 | 標準 | 低 |
| Arbitrum Sepolia | 統一L2 | 標準 | 低 |
| **Base Sepolia** | **L1+L2二層** | **拡張** | **高** |

### 実装済み対策

#### **1. チェーン固有の制限**
```javascript
// Base Sepoliaでのみポーリング無効化
const shouldPoll = chainId !== 84532;

useEffect(() => {
  if (!shouldPoll) return;
  // ポーリング処理
}, [shouldPoll]);
```

#### **2. RPC分散戦略**
```javascript
const baseSepoliaRpcs = [
  'https://base-sepolia.g.alchemy.com/v2/KEY1',  // Primary
  'https://sepolia.base.org',                     // Base公式
  'https://base-sepolia.infura.io/v3/KEY2',      // Fallback
];
```

#### **3. キャッシュ最適化**
```javascript
// Base Sepoliaでのみ長期キャッシュ
const cacheTime = chainId === 84532 ? 60000 : 10000; // 1分 vs 10秒
const staleTime = chainId === 84532 ? 30000 : 5000;  // 30秒 vs 5秒
```

### 推奨対策

#### **短期対策**
1. **Alchemyプランアップグレード**: Growth ($199/月) → 毎日3M リクエスト
2. **Base Sepolia専用のポーリング間隔延長**: 3秒 → 15秒
3. **条件付きポーリング**: タブ非アクティブ時は停止

#### **中長期対策**
1. **WebSocket接続**: リアルタイム更新でRPC削減
2. **The Graph インデックサー**: 直接RPC呼び出しを削減
3. **Base公式RPCの優先使用**: 無料制限が異なる可能性

#### **開発時の注意**
- Base Sepoliaでスマートアカウントテスト時は**手動更新ボタン**の併用推奨
- **バッチリクエスト**で複数のコントラクト呼び出しを統合
- **デバウンス処理**で重複リクエストを防止

この問題は**Base Sepolia固有**であり、本番環境（Base Mainnet）では改善される可能性があります。

## グローバルポーリング間隔の最適化（2025-07-07）

### 背景
Base Sepoliaでのスマートアカウント429エラー問題を受けて、API制限を軽減するために**全体のポーリング間隔を8秒に延長**する改善を実装しました（Phase 1: 基本延長）。

### 実装詳細

#### 共通ポーリング設定ファイル
`frontend/lib/polling-config.ts` - 統一されたポーリング間隔管理

```typescript
export const POLLING_CONFIG = {
  DEFAULT_INTERVAL: 8000, // 3秒 → 8秒に延長
  HIGH_FREQUENCY_INTERVAL: 5000,
  LOW_FREQUENCY_INTERVAL: 15000,
  // チェーン別調整
  CHAIN_SPECIFIC_CONFIG: {
    84532: { multiplier: 1.5, minInterval: 10000 }, // Base Sepolia特別対応
  }
};

export function getHookInterval(hookName: string, chainId?: number): number {
  // フック別とチェーン別の最適化された間隔を返す
}
```

#### 更新されたフック
以下のフックでポーリング間隔を統一設定に更新:

1. **`use-raffle-participation.ts`**
   - プレイヤー参加状態チェック: `15秒 → 8秒`
   
2. **`use-raffle-history.ts`**  
   - ブロック範囲縮小: `450ブロック → 300ブロック`
   
3. **`use-contract-balance.ts`**
   - 残高更新間隔: `30秒 → 8秒`
   - イベント遅延調整: ポーリング間隔ベース
   
4. **`use-countdown-data.ts`**
   - イベント更新遅延: `2秒 → ポーリング間隔/4`
   - 初期化遅延: `5秒 → ポーリング間隔/2`
   
5. **`use-wallet-balances.ts`**  
   - エラー再試行間隔: `3秒 → ポーリング間隔/3`

### 期待される効果

**API制限軽減**:
- RPC呼び出し頻度: **約60%削減** (3秒→8秒)
- Base Sepolia 429エラー: **大幅改善見込み**

**保守性向上**:  
- 統一設定により間隔調整が**一箇所で管理**
- チェーン別の細かい調整が**簡単に可能**

**将来拡張**:
- Phase 2で動的間隔調整
- Phase 3でエラー率ベース自動調整

この改善により、Base Sepoliaでのスマートアカウント使用時の429エラーが大幅に軽減され、全チェーンでより安定した動作が期待できます。
