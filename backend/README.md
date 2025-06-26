# ⚡ Backend - Raffle DApp

Foundry + Chainlink VRFで構築されたクロスチェーン対応ラッフルシステム

## 🚀 クイックスタート

### 前提条件

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 18以上（フロントエンド連携用）

### インストール

```bash
# リポジトリのクローン
git clone <your-repo-url>
cd Raffle_Dapp/backend

# 全依存関係のインストール
make install

# コントラクトのビルド
make build

# テストの実行
make test
```

## 📦 依存関係

このプロジェクトでは以下の依存関係を使用（`make install`で自動インストール）：

- **Forge Standard Library** (`forge-std@v1.8.2`): テストユーティリティ
- **OpenZeppelin Contracts** (`@openzeppelin/contracts@v5.0.2`): セキュアなコントラクト標準
- **Chainlink Brownie Contracts**: VRF統合

### 手動依存関係インストール

依存関係を手動でインストールする場合：

```bash
# 各依存関係のインストール
forge install foundry-rs/forge-std@v1.8.2 --no-commit
forge install OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-commit
forge install smartcontractkit/chainlink-brownie-contracts --no-commit
```

## 📁 プロジェクト構造

```
backend/
├── src/                          # スマートコントラクト
│   ├── RaffleImplementation.sol  # メインラッフルコントラクト
│   ├── RaffleProxy.sol           # UUPS プロキシ
│   ├── interfaces/               # コントラクトインターフェース
│   ├── libraries/                # ライブラリ
│   └── mocks/                    # テスト用モック
├── test/                         # テストファイル
├── script/                       # デプロイメントスクリプト
├── foundry.toml                  # Foundry設定
├── Makefile                      # ビルド自動化
└── README.md                     # このファイル
```

## ⚙️ 設定

### foundry.toml

プロジェクト設定には以下が含まれます：

- **リマッピング**: 依存関係の自動パス解決
- **最適化**: 200回の最適化実行を有効化
- **依存関係**: 自動インストール用の宣言

### 環境変数

backendディレクトリに`.env`ファイルを作成：

```bash
# デプロイメントに必要
PRIVATE_KEY=your_private_key_here
SEPOLIA_RPC_URL=your_sepolia_rpc_url
BASE_SEPOLIA_RPC_URL=your_base_sepolia_rpc_url
ARBITRUM_SEPOLIA_RPC_URL=your_arbitrum_sepolia_rpc_url

# 検証用APIキー
ETHERSCAN_API_KEY=your_etherscan_api_key
BASE_API_KEY=your_base_api_key
ARBISCAN_API_KEY=your_arbiscan_api_key
```

## 🛠️ 利用可能なコマンド

### 開発

```bash
make install          # 全依存関係のインストール
make build            # コントラクトのコンパイル
make test             # 全テストの実行
make test-unit        # ユニットテストのみ実行
make format           # コードフォーマット
make clean            # ビルド成果物のクリーンアップ
```

### デプロイメント

```bash
# 全テストネットにデプロイ
make deploy-raffle-proxy

# 特定ネットワークにデプロイ
make deploy-raffle-proxy-sepolia
make deploy-raffle-proxy-base
make deploy-raffle-proxy-arbitrum
```

### アップグレード

```bash
# 実装コントラクトのアップグレード
make upgrade-raffle
```

## 🔧 トラブルシューティング

### よくある問題

1. **ビルドエラー**: `make clean && make install && make build`を実行
2. **依存関係の問題**: 全ての依存関係が正しくインストールされているか確認
3. **リマッピングエラー**: `foundry.toml`のリマッピングが正しいか確認

### 依存関係の確認

依存関係が正しくインストールされているか確認：

```bash
# ライブラリの存在確認
ls lib/
# 表示されるべき: forge-std, openzeppelin-contracts, chainlink-brownie-contracts

# コンパイルテスト
make build
```

## 🏗️ アーキテクチャ

このプロジェクトは以下を使用したクロスチェーンラッフルシステムを実装：

- **UUPS プロキシパターン**: アップグレード可能なコントラクト
- **Chainlink VRF v2.5**: 証明可能に公平なランダム性
- **Account Abstraction**: ガスレストランザクション
- **マルチチェーンデプロイ**: Ethereum、Base、Arbitrum対応

## 📋 コントラクト仕様

### コアコントラクト

#### RaffleImplementation.sol
アップグレード可能プロキシパターンを使用したメインラッフルロジック：

```solidity
// 主要関数
function enterRaffle() external           // ラッフル参加 (10 USDC)
function cancelEntry() external           // 参加キャンセル
function processWinner() external         // 勝者選択実行
function getUserStats(address) view       // ユーザー統計取得
function getRaffleHistory() view          // 過去のラッフル結果取得

// VRF統合
function requestRandomWords() internal    // ランダム性要求
function fulfillRandomWords() internal    // VRFレスポンス処理

// 状態: OPEN -> CALCULATING_WINNER -> OPEN
enum RaffleState { OPEN, CALCULATING_WINNER }
```

#### 主要イベント
```solidity
event RaffleEnter(address indexed player, uint256 entranceFee);
event RaffleExit(address indexed player, uint256 refundAmount);
event WinnerPicked(address indexed winner, uint256 prize, bool isJackpot);
```

### ネットワークデプロイ

| ネットワーク | コントラクトアドレス | 開始ブロック |
|-------------|-------------------|-------------|
| Ethereum Sepolia | `0xf84b248e56fcdf8fba11901cfdc14509786f3121` | 8,610,000 |
| Base Sepolia | `0x885c5510ecc10a89ed27d95c5074ed2d943cd134` | 20,000,000 |
| Arbitrum Sepolia | `0xaa645f62c2bb92b69cfe7612edb0bdffb2bf6106` | 166,500,000 |

### ゲームメカニクス

```
参加費用: 10 USDC
最小プレイヤー数: 3人
自動実行: 最小人数到達後60秒
ジャックポット確率: 35%（ジャックポット額≥10 USDCの場合）
賞金分配:
  - 通常: 全参加費（ジャックポット積立10%を除く）
  - ジャックポット: 参加費 + 蓄積されたジャックポット額
```

### セキュリティ機能

- **リエントランシー保護**: OpenZeppelin ReentrancyGuard使用
- **アクセス制御**: Ownable2Step使用による安全な所有権移転
- **アップグレード可能性**: UUPS プロキシパターン
- **VRF統合**: Chainlink VRF v2.5による証明可能なランダム性

### テスト

```bash
# 全テスト実行
forge test

# 詳細出力でテスト実行
forge test -vvv

# 特定テストファイルの実行
forge test --match-path test/unit/RaffleTest.t.sol

# ガス使用量レポート
forge test --gas-report
```

### デプロイメント例

```bash
# Ethereum Sepoliaにデプロイ
forge script script/RaffleProxyDeployer.s.sol:DeployRaffle \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

詳細については、`/src`のコントラクトドキュメントを参照してください。