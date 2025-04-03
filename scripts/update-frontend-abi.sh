#!/bin/bash

# パス設定
PROJECT_ROOT="/Users/s.p./Desktop/Web3_Dev/Cyfrin_Updraft/Raffle_Dapp"
ABI_FILE="${PROJECT_ROOT}/backend/out/RaffleImplementation.sol/RaffleImplementation.json"
CONFIG_FILE="${PROJECT_ROOT}/frontend/app/lib/contract-config.ts"

echo "Updating frontend ABI from: ${ABI_FILE}"
echo "Target file: ${CONFIG_FILE}"

# ABIファイルの存在確認
if [ ! -f "$ABI_FILE" ]; then
  echo "❌ Error: ABI file not found at ${ABI_FILE}"
  exit 1
fi

# 設定ファイルの存在確認
if [ ! -f "$CONFIG_FILE" ]; then
  echo "❌ Error: Config file not found at ${CONFIG_FILE}"
  exit 1
fi

# ABIを抽出
ABI_CONTENT=$(cat "$ABI_FILE" | jq '.abi')

if [ -z "$ABI_CONTENT" ]; then
  echo "❌ Error: Failed to extract ABI content"
  exit 1
fi

echo "ABI content extracted successfully"

# 一時ファイル作成
TMP_FILE=$(mktemp)

# config.tsファイルを処理
BEGIN_MARKER="export const RaffleABI ="
END_MARKER="];"

# ファイルを行ごとに読み込み、ABI部分を置換
{
  # configファイルを最初から読み込む
  while IFS= read -r line; do
    # ABI開始マーカーを見つけたら新しいABIを書き込む
    if [[ "$line" == *"$BEGIN_MARKER"* ]]; then
      echo "$BEGIN_MARKER $ABI_CONTENT;"
      # ABIの終わりを見つけるまで読み飛ばす
      while IFS= read -r skip_line; do
        if [[ "$skip_line" == *"$END_MARKER"* ]]; then
          break
        fi
      done
    else
      # 通常の行はそのまま出力
      echo "$line"
    fi
  done
} < "$CONFIG_FILE" > "$TMP_FILE"

# 一時ファイルを元のファイルに上書き
mv "$TMP_FILE" "$CONFIG_FILE"

echo "✅ Frontend ABI successfully updated!"
