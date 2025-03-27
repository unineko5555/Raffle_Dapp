# Docker 開発環境ガイド

このプロジェクトは Docker を利用して開発環境を簡単に構築できるようになっています。これにより、依存関係のインストールやローカル環境の設定を気にすることなく、開発を始めることができます。

## 前提条件

- [Docker](https://docs.docker.com/get-docker/) がインストールされていること
- [Docker Compose](https://docs.docker.com/compose/install/) がインストールされていること

## 環境のセットアップ

1. **.env ファイルの作成**

   プロジェクトのルートディレクトリで `.env.example` をコピーして `.env` ファイルを作成し、必要な環境変数を設定します：

   ```bash
   cp .env.example .env
   ```

   そして、`.env` ファイル内の値を適切に設定してください。

2. **Docker 環境の起動**

   プロジェクトのルートディレクトリで以下のコマンドを実行します：

   ```bash
   docker-compose up
   ```

   これにより、フロントエンドとバックエンドの両方のサービスが起動します。

   初回実行時は、Docker イメージのビルドに時間がかかることがあります。

3. **アプリケーションへのアクセス**

   - フロントエンド: [http://localhost:3000](http://localhost:3000)
   - バックエンド (Anvil): [http://localhost:8545](http://localhost:8545)

## 開発ワークフロー

### コードの編集

ローカルのファイルを編集すると、変更は Docker コンテナ内にマウントされたボリュームに反映されます。フロントエンドでは Next.js のホットリロード機能により、変更が自動的にブラウザに反映されます。

### バックエンドでの作業

バックエンドコンテナにアクセスしてコマンドを実行するには：

```bash
docker-compose exec backend sh
```

コンテナ内で Foundry コマンドを実行できます：

```bash
# テストを実行
forge test

# 特定のテストを実行
forge test --match-path test/unit/RaffleTest.t.sol -vvv

# コントラクトをデプロイ
forge script script/DeployRaffle.s.sol --broadcast --rpc-url http://localhost:8545
```

### フロントエンドでの作業

フロントエンドコンテナにアクセスするには：

```bash
docker-compose exec frontend sh
```

コンテナ内で npm コマンドを実行できます：

```bash
# 依存関係をインストール
npm install some-package

# 型チェックを実行
npm run lint
```

## コンテナの停止

開発作業を終了するには、別のターミナルを開いて以下のコマンドを実行します：

```bash
docker-compose down
```

または、Docker Compose を実行しているターミナルで `Ctrl+C` を押します。

## トラブルシューティング

### ポートの競合

エラーメッセージに「port is already allocated」と表示される場合：

```bash
# 使用中のポートを確認
lsof -i :3000
lsof -i :8545

# Docker コンテナを全て停止
docker-compose down
```

### コンテナが起動しない

```bash
# ログを確認
docker-compose logs

# 特定のサービスのログを確認
docker-compose logs frontend
docker-compose logs backend
```

### キャッシュのクリア

問題が解決しない場合は、Docker イメージを再ビルドしてみてください：

```bash
docker-compose build --no-cache
docker-compose up
```

## 高度な使用法

### バックグラウンドでの実行

```bash
docker-compose up -d
```

### 個別のサービスの起動

```bash
docker-compose up frontend
docker-compose up backend
```

### コンテナの再起動

```bash
docker-compose restart frontend
```

## CI/CD との統合

このセットアップは、GitHub Actions や他の CI/CD サービスで使用することもできます。詳細については、プロジェクトの CI/CD 設定ファイルを参照してください。