# 📊 Rindexer - Event Indexing Service

Rust製の高性能EVMイベントインデックサーでRaffleイベントをリアルタイム監視・保存

## 🎯 概要

RindexerはRaffle DAppのブロックチェーンイベントを効率的にインデックスし、PostgreSQLデータベースに保存するサービスです。フロントエンドでの履歴表示やデータ分析を高速化します。

## 🛠️ 技術スタック

- **Indexer**: [Rindexer](https://rindexer.xyz/) (Rust)
- **Database**: PostgreSQL 16
- **Container**: Docker Compose
- **Storage**: PostgreSQL + CSV (オプション)

## 📦 セットアップ

### 前提条件

- Docker & Docker Compose
- Rindexer CLI

```bash
# Rindexer CLIのインストール
curl -L https://rindexer.xyz/install.sh | bash
```

### 環境変数

`.env`ファイルを作成：

```env
# RPC URLs
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
ARBITRUM_SEPOLIA_RPC_URL=https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY

# PostgreSQL設定
POSTGRES_USER=postgres
POSTGRES_PASSWORD=rindexer
POSTGRES_DB=postgres
```

### インデックサー起動

```bash
# PostgreSQL起動
docker-compose up -d postgresql

# データベース初期化待機
sleep 10

# Rindexer起動
rindexer start
```

## 📁 プロジェクト構造

```
raffleIndexer/
├── rindexer.yaml           # メイン設定ファイル
├── docker-compose.yml      # PostgreSQL設定
├── abis/                   # コントラクトABI
│   └── RaffleImplementation.json
├── data/                   # CSVデータ出力
│   └── RaffleContract/
└── README.md              # このファイル
```

## ⚙️ 設定詳細

### rindexer.yaml

```yaml
name: raffleIndexer
project_type: no-code

# 対象ネットワーク
networks:
  - name: ethereum_sepolia
    chain_id: 11155111
    rpc: ${SEPOLIA_RPC_URL}
  - name: base_sepolia
    chain_id: 84532
    rpc: ${BASE_SEPOLIA_RPC_URL}
  - name: arbitrum_sepolia
    chain_id: 421614
    rpc: ${ARBITRUM_SEPOLIA_RPC_URL}

# データストレージ
storage:
  postgres:
    enabled: true
  csv:
    enabled: false
    path: ./data

# インデックス対象コントラクト
contracts:
  - name: RaffleImplementation
    details:
      - network: ethereum_sepolia
        address: 0xf84b248e56fcdf8fba11901cfdc14509786f3121
        start_block: "8610000"
      - network: base_sepolia
        address: 0x885c5510ecc10a89ed27d95c5074ed2d943cd134
        start_block: "20000000"
      - network: arbitrum_sepolia
        address: 0xaa645f62c2bb92b69cfe7612edb0bdffb2bf6106
        start_block: "166500000"
    abi: ./abis/RaffleImplementation.json
    include_events:
      - WinnerPicked
      - RaffleEnter
      - RaffleExit
```

### docker-compose.yml

```yaml
services:
  postgresql:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: rindexer
      POSTGRES_DB: postgres
    ports:
      - "5440:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

## 📊 データベーススキーマ

Rindexerが自動生成するテーブル：

### winner_picked
```sql
CREATE TABLE winner_picked (
    id SERIAL PRIMARY KEY,
    network VARCHAR(50),
    block_number BIGINT,
    block_hash VARCHAR(66),
    transaction_hash VARCHAR(66),
    log_index INTEGER,
    winner VARCHAR(42),
    prize NUMERIC(78,0),
    is_jackpot BOOLEAN,
    block_timestamp TIMESTAMP
);
```

### raffle_enter
```sql
CREATE TABLE raffle_enter (
    id SERIAL PRIMARY KEY,
    network VARCHAR(50),
    block_number BIGINT,
    block_hash VARCHAR(66),
    transaction_hash VARCHAR(66),
    log_index INTEGER,
    player VARCHAR(42),
    entrance_fee NUMERIC(78,0),
    block_timestamp TIMESTAMP
);
```

### raffle_exit
```sql
CREATE TABLE raffle_exit (
    id SERIAL PRIMARY KEY,
    network VARCHAR(50),
    block_number BIGINT,
    block_hash VARCHAR(66),
    transaction_hash VARCHAR(66),
    log_index INTEGER,
    player VARCHAR(42),
    refund_amount NUMERIC(78,0),
    block_timestamp TIMESTAMP
);
```

## 🔄 運用コマンド

### 基本操作

```bash
# Rindexer起動
rindexer start

# 特定ネットワークのみ
rindexer start --network ethereum_sepolia

# バックグラウンド実行
nohup rindexer start > rindexer.log 2>&1 &

# ログ確認
tail -f rindexer.log
```

### メンテナンス

```bash
# データベース接続テスト
docker exec -it raffleindexer-postgresql-1 psql -U postgres -d postgres

# テーブル確認
\dt

# データ確認
SELECT COUNT(*) FROM winner_picked;
SELECT * FROM winner_picked ORDER BY block_number DESC LIMIT 5;

# データリセット（注意！）
DROP TABLE IF EXISTS winner_picked, raffle_enter, raffle_exit;
```

### パフォーマンス監視

```bash
# 同期状況確認
SELECT 
    network,
    MAX(block_number) as latest_block,
    COUNT(*) as total_events
FROM winner_picked 
GROUP BY network;

# 最新イベント確認
SELECT 
    network,
    winner,
    prize,
    block_timestamp
FROM winner_picked 
ORDER BY block_timestamp DESC 
LIMIT 10;
```

## 🌐 API統合

フロントエンドからのデータアクセス：

### Next.js API Route例

```typescript
// pages/api/raffle/history.ts
import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5440,
  user: 'postgres',
  password: 'rindexer',
  database: 'postgres',
});

export default async function handler(req, res) {
  try {
    const { network, limit = 10 } = req.query;
    
    let query = 'SELECT * FROM winner_picked';
    let params = [];
    
    if (network) {
      query += ' WHERE network = $1';
      params.push(network);
    }
    
    query += ' ORDER BY block_number DESC LIMIT $' + (params.length + 1);
    params.push(parseInt(limit));
    
    const result = await pool.query(query, params);
    
    res.status(200).json({
      success: true,
      data: result.rows,
      total: result.rowCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
```

## 🚨 トラブルシューティング

### 一般的な問題

#### PostgreSQL接続エラー
```bash
# コンテナ状態確認
docker-compose ps

# ヘルスチェック確認
docker-compose logs postgresql

# 再起動
docker-compose restart postgresql
```

#### 同期速度が遅い
```yaml
# rindexer.yamlでstart_blockを最新に近づける
start_block: "20500000"  # より新しいブロックから開始
```

#### RPC制限エラー
```bash
# 無料Alchemyプランでは制限あり
# より多くのcompute unitが必要な場合は有料プラン検討
```

### ログ確認

```bash
# Rindexerログ
tail -f rindexer.log

# PostgreSQLログ
docker-compose logs postgresql

# エラーフィルタリング
grep -i error rindexer.log
```

## 📈 本番環境運用

### 推奨構成

```yaml
# 本番用docker-compose.yml
services:
  postgresql:
    image: postgres:16
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    restart: unless-stopped
    
  rindexer:
    build: .
    depends_on:
      - postgresql
    environment:
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgresql:5432/${POSTGRES_DB}
    restart: unless-stopped
```

### バックアップ

```bash
# 自動バックアップスクリプト
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec raffleindexer-postgresql-1 pg_dump -U postgres postgres > backup_${DATE}.sql

# 定期実行 (crontab)
0 2 * * * /path/to/backup.sh
```

## 🔗 関連リンク

- [Rindexer Documentation](https://rindexer.xyz/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Compose Guide](https://docs.docker.com/compose/)

---

**💡 Tip**: Alchemyの無料プランでは同期速度に制限があります。本番環境では有料プランまたは専用ノードの利用を検討してください。