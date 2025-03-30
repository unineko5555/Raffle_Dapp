# Raffle Dapp バックエンド

このリポジトリは、クロスチェーン対応のラッフル（抽選）Dappのバックエンド実装です。Chainlink VRF、Automation、CCIPを使用して、複数チェーン間で動作する公平なラッフルシステムを提供します。

## 技術スタック

- **開発環境**: [Foundry](https://github.com/foundry-rs/foundry) (Solidity開発・テストフレームワーク)
- **スマートコントラクト言語**: Solidity ^0.8.18
- **外部統合**:
  - Chainlink VRF 2.5 (検証可能なランダム性)
  - Chainlink Automation (自動実行)
  - Chainlink CCIP (クロスチェーン通信)
- **コントラクト設計**: UUPSプロキシパターン (アップグレード可能)
- **対応チェーン**:
  - Ethereum Sepolia
  - Base Sepolia
  - Arbitrum Sepolia

## アーキテクチャ

```
                                    +-----------------+
                                    |                 |
                                    |  フロントエンド  |
                                    |                 |
                                    +--------+--------+
                                             |
                                             v
   +------------------+              +-------+--------+             +-------------------+
   |                  |              |                |             |                   |
   | Chainlink VRF    +------------->   RaffleProxy   <-------------+ Chainlink        |
   | (乱数生成)       |              |   (UUPS)       |             | Automation       |
   |                  |              |                |             | (自動実行)        |
   +------------------+              +-------+--------+             +-------------------+
                                             |
                                             v
                                    +--------+--------+
                                    |                 |
                                    | RaffleImpl      |
                                    | (ロジック)      |
                                    |                 |
                                    +--------+--------+
                                             |
                                             v
    +--------------------+          +--------+--------+
    |                    |          |                 |
    | Ethereum Sepolia   +<-------->+                 +<--------->  +-------------------+
    |                    |          |                 |             |                   |
    +--------------------+          |                 |             | Base Sepolia      |
                                    |   Chainlink     |             |                   |
    +--------------------+          |   CCIP          |             +-------------------+
    |                    |          |   (クロスチェーン|
    | Arbitrum Sepolia   +<-------->+   通信)         |
    |                    |          |                 |
    +--------------------+          +-----------------+
```

## 主要なコンポーネント

### コントラクト

1. **RaffleImplementation.sol**
   - ラッフルの核となるロジックを実装
   - VRF、Automation、CCIPとの統合
   - ジャックポットシステムの管理
   - 参加者管理と当選者決定

2. **RaffleProxy.sol**
   - UUPSプロキシパターンによるアップグレード機能
   - 実装コントラクトへのデリゲーション

### インターフェース

1. **IRaffle.sol**
   - ラッフルの主要機能を定義
   - 外部からアクセス可能な関数とイベントを規定

2. **VRFCoordinatorV2Interface.sol**, **VRFConsumerBaseV2.sol**
   - Chainlink VRFとの連携用

3. **AutomationCompatibleInterface.sol**
   - Chainlink Automationとの連携用

4. **CCIPInterface.sol**
   - Chainlink CCIPとの連携用

5. **IERC20.sol**
   - USDC等のトークン操作用

6. **IUUPSUpgradeable.sol**
   - アップグレード機能用

### ライブラリ

- **RaffleLib.sol**
  - ラッフルのヘルパー関数を提供
  - 当選確率計算や当選者選択ロジック

### デプロイスクリプト

- **DeployRaffle.s.sol**
  - コントラクトデプロイ用スクリプト

- **HelperConfig.s.sol**
  - 各テストネットワーク用の設定を提供
  - モックコントラクトのデプロイ（ローカル環境用）

## 機能

1. **公平なラッフル**
   - Chainlink VRFによる検証可能なランダム性
   - 参加料: 10 USDC / 1回
   - 当選者: 各ラウンド1名（均等確率）

2. **自動実行**
   - ラッフル条件: 3人以上の参加者がいること
   - 実行タイミング: 3人目の参加から1分経過後に自動実行
   - Chainlink Automation による自動化

3. **ジャックポットシステム**
   - 蓄積方式: 参加料の10%をジャックポットとして蓄積
   - 獲得条件: 約1%の確率でジャックポットも当選金として配布
   - 繰越し: 獲得されなかった場合、次回に繰り越し

4. **クロスチェーン通信**
   - 異なるチェーン間でのラッフル結果の共有
   - 対応チェーン: テストネット（Sepolia、Base Sepolia、Arbitrum Sepolia）

5. **アップグレード可能**
   - UUPSプロキシパターンによるアップグレード可能なコントラクト
   - 新機能追加や修正が可能

## 使用方法

### 前提条件

- [Foundry](https://github.com/foundry-rs/foundry) がインストールされていること

### インストール

```bash
git clone https://github.com/your-username/raffle-dapp.git
cd raffle-dapp/backend
forge install
```

### ローカルでのテスト

```bash
forge test
```

### テストネットへのデプロイ

1. 環境変数の設定:

```bash
export PRIVATE_KEY=your_private_key
export SEPOLIA_RPC_URL=your_sepolia_rpc_url
export BASE_SEPOLIA_RPC_URL=your_base_sepolia_rpc_url
export ARBITRUM_SEPOLIA_RPC_URL=your_arbitrum_sepolia_rpc_url
export ETHERSCAN_API_KEY=your_etherscan_api_key
export BASE_API_KEY=your_base_api_key
export ARBISCAN_API_KEY=your_arbiscan_api_key
```

2. デプロイ:

```bash
# Ethereum Sepoliaにデプロイ
make deploy-sepolia

# 他のチェーンにデプロイ
make deploy-base-sepolia
make deploy-arb-sepolia
```

### 検証

```bash
# Ethereum Sepolia上のコントラクトを検証
make verify-sepolia

# 他のチェーン上のコントラクトを検証
make verify-base-sepolia
make verify-arb-sepolia
```

## ライセンス

MIT
