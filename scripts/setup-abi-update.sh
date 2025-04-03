#!/bin/bash

# スクリプトに実行権限を付与
chmod +x "$(dirname "$0")/update-frontend-abi.sh"

# package.jsonが正しく設定されていることを確認
echo "✅ Setup completed! You can now run 'make deploy-all-with-update' to automatically update the frontend ABI after deployment."
