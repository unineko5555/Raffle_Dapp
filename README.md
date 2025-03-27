# Raffle Dapp

Raffle Dappは、ブロックチェーン技術を活用した分散型抽選アプリケーションです。ユーザーはUSDCトークンを使用して抽選に参加でき、透明性の高い抽選プロセスと自動的な賞金分配を実現しています。

## 概要

このDappは、完全にオンチェーンで動作する抽選システムを提供します。主な特徴は以下の通りです：

- 完全に分散化された抽選プロセス
- スマートコントラクトによる透明な賞金分配
- 複数のブロックチェーンネットワークのサポート（Ethereum、Polygon、Arbitrum、Optimism）
- ガス代無料の参加オプション
- 定期的な抽選と自動的なジャックポット蓄積システム

## 技術スタック

### フロントエンド

- **フレームワーク**: Next.js 15
- **UI/UXライブラリ**: 
  - Tailwind CSS
  - Radix UI コンポーネント
  - Lucide React（アイコン）
- **ステート管理**: React Hooks + Context API
- **Webアプリケーション**: SPA（Single Page Application）
- **Web3連携**: 
  - wagmi
  - viem
  - ethers.js

### バックエンド

- **スマートコントラクト開発**: Solidity
- **開発環境**: Foundry（Anvil、Forge）
- **ブロックチェーンインフラ**: 
  - Alchemy API
  - WalletConnect
- **テスト**: Forge Test Suite

### インフラストラクチャ

- **コンテナ化**: Docker / Docker Compose
- **CI/CD**: GitHub Actions
- **デプロイ**: Vercel（フロントエンド）、各ブロックチェーンネットワーク（スマートコントラクト）

## アーキテクチャ

このプロジェクトはモノレポ構造を採用しており、以下のコンポーネントで構成されています：

1. **フロントエンド**: ユーザーインターフェースとWeb3接続ロジック
2. **バックエンド**: Solidityスマートコントラクトとブロックチェーン統合
3. **共通設定**: Docker Compose設定、環境変数、デプロイスクリプト

## ローカル開発

プロジェクトのローカル開発環境はDockerを使用して統一されており、フロントエンドとバックエンドの両方を同時に起動することができます。

```bash
# 開発環境の起動
docker-compose up

# フロントエンドのみの起動
docker-compose up frontend

# バックエンドのみの起動
docker-compose up backend
```

## ロードマップ

- マルチチェーンサポートの拡張
- DAO（分散型自治組織）による抽選パラメータの投票機能
- NFTベースの参加券システム
- モバイルウォレット最適化

---

このプロジェクトは[Cyfrin Updraft](https://updraft.cyfrin.io/)のWeb3開発コースの一環として開発されました。