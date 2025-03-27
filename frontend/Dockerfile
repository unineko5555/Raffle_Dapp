# フロントエンド用Dockerfile
FROM node:18-alpine AS base

# インストール先の作業ディレクトリを作成
WORKDIR /app

# 開発時に使用する依存関係を最初にインストール
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# 開発サーバー用のステージ
FROM base AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 開発サーバーを起動
CMD ["npm", "run", "dev"]

# ビルド用のステージ（本番デプロイ時）
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 本番用ビルド
RUN npm run build

# 本番用ステージ
FROM base AS prod
WORKDIR /app

# 本番用ファイルのみをコピー
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT 3000
ENV NODE_ENV production

# 本番サーバーを起動
CMD ["node", "server.js"]