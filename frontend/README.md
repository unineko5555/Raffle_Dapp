# Raffle Dapp フロントエンド

このリポジトリは、クロスチェーン対応のラッフル（抽選）Dappのフロントエンド実装です。React、Next.js、Tailwind CSSを使用したモダンなUI設計で、Ethereum、Polygon、Arbitrum、Optimism、Baseの各テストネットで動作します。

## 技術スタック

- **フロントエンドフレームワーク**: [Next.js](https://nextjs.org/) 14.x
- **UI言語**: [TypeScript](https://www.typescriptlang.org/) 5.x
- **スタイリング**: [Tailwind CSS](https://tailwindcss.com/) 3.x
- **コンポーネントライブラリ**: [shadcn/ui](https://ui.shadcn.com/)
- **Web3連携**:
  - [wagmi](https://wagmi.sh/) - React Hooks for Ethereum
  - [viem](https://viem.sh/) - 低レベルのEthereum操作
  - [Alchemy AccountKit](https://accountkit.alchemy.com/) - アカウント抽象化
- **状態管理**:
  - React Context API
  - React Hooks (useState, useEffect, useReducer)
- **データ可視化**:
  - [Recharts](https://recharts.org/) - 統計グラフ
- **アイコン**: [Lucide React](https://lucide.dev/)

## アーキテクチャ

```
+-----------------------+         +------------------------+         +-------------------+
|                       |         |                        |         |                   |
|  コンポーネント層     |         |   サービス層           |         |   プロバイダー層  |
|  (UI Components)      |<------->|   (Services)           |<------->|   (Providers)     |
|                       |         |                        |         |                   |
+-----------------------+         +------------------------+         +-------------------+
         ^                                    ^                               ^
         |                                    |                               |
         v                                    v                               v
+-----------------------+         +------------------------+         +-------------------+
|                       |         |                        |         |                   |
|  フック層             |         |   ユーティリティ層     |         |   定数/型定義     |
|  (Custom Hooks)       |<------->|   (Utilities)          |<------->|   (Constants)     |
|                       |         |                        |         |                   |
+-----------------------+         +------------------------+         +-------------------+
```

### 主要なコンポーネント

1. **コンポーネント層**
   - ページコンポーネント (`app/page.tsx`)
   - ラッフル関連コンポーネント (`app/components/raffle/`)
   - 認証関連コンポーネント (`app/components/auth/`)
   - UI共通コンポーネント (`components/ui/`)
   - 管理者専用コンポーネント (`app/components/admin/`)

2. **サービス層**
   - ウォレット接続処理 (`app/services/wallet.ts`)
   - コントラクト操作 (`app/services/contracts.ts`)
   - クロスチェーン通信 (`app/services/cross-chain.ts`)

3. **プロバイダー層**
   - Web3プロバイダー (`app/lib/web3-config.ts`)
   - テーマプロバイダー (`components/theme-provider.tsx`)

4. **フック層**
   - カスタムフック (`hooks/use-*.ts`)

5. **ユーティリティ層**
   - 共通ユーティリティ関数 (`lib/utils.ts`)

## 主要機能

### 1. **ウォレット接続とアカウント抽象化**
- MetaMask、WalletConnect、Coinbase Walletなどの従来のウォレット対応
- Google、Xなどを使用したソーシャルログイン（スマートアカウント自動作成）
- ガスレストランザクション（ERC-4337準拠）

### 2. **ラッフル参加と状態表示**
- リアルタイムのラッフル状態表示（OPEN, CALCULATING_WINNER, CLOSED）
- 最小プレイヤー数と自動実行タイマーの可視化
- ジャックポットシステムの説明と蓄積額表示
- USDC残高と承認フローの統合

### 3. **クロスチェーン対応UI**
- 複数チェーン間でのシームレスな切り替え
- チェーン特有の情報表示（ガス残高など）
- クロスチェーン結果の可視化

### 4. **管理者機能**
- コントラクトオーナー専用の管理パネル
- 資金管理（ETH、USDCの引き出し）
- クロスチェーンメッセージの手動送信
- コントラクトアップグレード機能

### 5. **通知システム**
- トランザクション結果通知
- コントラクトアップグレード通知
- エラー通知

## コンポーネント設計思想

このプロジェクトでは、以下の設計原則に従ってコンポーネントを構築しています：

1. **コンポーネント分割**  
   機能ごとに責任を明確に分離したコンポーネント設計を行い、再利用性と保守性を高めています。

2. **Atomic Design**  
   原子（Button, Input）、分子（Card, Dialog）、有機体（Form, Layout）の階層構造に基づいたコンポーネント設計を採用しています。

3. **Headless UI + Tailwind CSS**  
   ロジックとスタイルを分離するために、Headless UIパターンを採用し、Tailwind CSSでスタイリングしています。これにより、高いカスタマイズ性と一貫したデザインシステムを実現しています。

4. **Responsive Design**  
   モバイルファースト設計を採用し、すべての画面サイズで最適な表示を提供します。

5. **Accessibility (a11y)**  
   WAI-ARIAガイドラインに準拠し、スクリーンリーダー対応などのアクセシビリティを確保しています。

## 状態管理

このアプリケーションでは、複数の状態管理戦略を組み合わせています：

1. **ローカル状態**  
   コンポーネント固有の状態には `useState` と `useReducer` を使用

2. **グローバル状態**  
   アプリケーション全体の状態には React Context API を使用

3. **持続的な状態**  
   ユーザー設定などの永続的な状態には localStorage を使用

4. **Web3状態**  
   ブロックチェーン関連の状態管理には wagmi のフックを使用

## テーマとデザインシステム

- **ダークモード / ライトモード**  
  `next-themes` を使用したテーマ切り替えをサポート

- **デザイントークン**  
  カラー、スペーシング、フォントなどのデザイン変数を CSS 変数として定義

- **アニメーション**  
  `tailwindcss-animate` を使用した滑らかなトランジションとアニメーション

## Web3統合

- **Connect Kit**  
  複数のウォレットプロバイダーへの統一したインターフェース

- **マルチチェーンサポート**  
  Ethereum、Polygon、Arbitrum、Optimism、Base testnetsをサポート

- **コントラクト統合**  
  ABI型安全なコントラクト操作

## 開発環境のセットアップ

### 前提条件

- Node.js 18.x以上
- pnpm（推奨）またはnpm, yarn
- メタマスクなどのWeb3ウォレット

### インストール

```bash
# リポジトリのクローン
git clone https://github.com/your-username/raffle-dapp.git
cd raffle-dapp/frontend

# 依存関係のインストール
pnpm install

# 開発サーバーの起動
pnpm dev
```

### 環境変数

`.env.local` ファイルを作成し、以下の環境変数を設定します：

```
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

## デプロイ

このプロジェクトは、[Vercel](https://vercel.com/)、[Netlify](https://www.netlify.com/)などの静的サイトホスティングサービスに簡単にデプロイできます。

```bash
# 本番用ビルド
pnpm build

# 静的ファイルの生成（オプション）
pnpm export
```

## テスト用アカウント

テストネットで利用可能なUSDCファウセットとアカウント：

- Sepolia: [Alchemy Sepolia Faucet](https://sepoliafaucet.com/)
- Mumbai: [Mumbai Faucet](https://mumbaifaucet.com/)

## ライセンス

MIT