# バックエンド用Dockerfile
FROM ghcr.io/foundry-rs/foundry:latest

# ルートユーザーに切り替え
USER root

WORKDIR /app

# 必要なツールのインストール
RUN apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
    bash \
    curl \
    git \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# スクリプトと依存関係をコピー
COPY . .

# フォージの初期化
RUN forge build || echo "初回ビルドは失敗するかもしれませんが問題ありません"

# デフォルトコマンド
CMD ["bash"]