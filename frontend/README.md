# 🎨 Frontend - Raffle DApp

Next.js + TypeScript + Web3で構築されたモダンなDAppフロントエンド

## 🛠️ 技術スタック

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5.x
- **Styling**: Tailwind CSS + shadcn/ui
- **Web3**: wagmi + viem + Account Kit
- **State**: React Context + Hooks
- **Icons**: Lucide React
- **Deployment**: Vercel

## 📦 開発環境セットアップ

### インストール

```bash
cd frontend
npm install
```

### 環境変数

`.env.local`ファイルを作成：

```env
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

### 開発サーバー

```bash
npm run dev     # 開発サーバー起動
npm run build   # 本番ビルド
npm run start   # 本番サーバー起動
npm run lint    # ESLint実行
```

## 🏗️ プロジェクト構造

```
frontend/
├── app/                    # App Router
│   ├── components/         # ページコンポーネント
│   │   ├── raffle/        # ラッフル関連
│   │   ├── auth/          # 認証関連
│   │   ├── admin/         # 管理者機能
│   │   └── ui/            # UI共通部品
│   ├── lib/               # 設定・ユーティリティ
│   ├── providers/         # Context Providers
│   └── api/               # API Routes
├── components/ui/          # shadcn/ui components
├── hooks/                 # カスタムフック
└── public/                # 静的ファイル
```

## 🎯 主要コンポーネント

### Core Components

#### RaffleMainContent
```typescript
// メインのラッフル画面
<RaffleMainContent
  raffleData={raffleData}
  isLoading={isLoading}
  onRaffleEntrySuccess={() => {}}
/>
```

#### EnterRaffleButton
```typescript
// ラッフル参加ボタン（Account Abstraction対応）
<EnterRaffleButton
  raffleAddress="0x..."
  entryFee={BigInt(10)}
  isRaffleOpen={true}
/>
```

#### RaffleHistory
```typescript
// 履歴表示（Rindexer/直接読み込み対応）
<RaffleHistory
  useRindexer={false}
  currentAddress="0x..."
/>
```

### Custom Hooks

#### useRaffleContract
```typescript
// コントラクト情報とデータ取得
const { raffleData, isLoading } = useRaffleContract();
```

#### useSmartAccount
```typescript
// Account Abstraction
const { 
  smartAccountAddress,
  isSmartAccountLoading,
  sendUserOperation 
} = useSmartAccount();
```

#### useRaffleHistory
```typescript
// ブロックチェーン履歴直接読み込み
const { pastRaffles, userStats } = useRaffleHistory(userAddress);
```

#### useRindexerHistory
```typescript
// Rindexer経由での履歴取得
const { winnerHistory, stats } = useRindexerHistory();
```

## 🔧 設定ファイル

### Web3設定 (`lib/web3-config.ts`)

```typescript
export const config = createConfig({
  chains: [sepolia, baseSepolia, arbitrumSepolia],
  connectors: [
    walletConnect({ projectId }),
    metaMask(),
    coinbaseWallet({ appName: "Raffle DApp" })
  ],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
    // ...
  }
});
```

### Account Kit設定 (`lib/alchemy/account-kit-config.ts`)

```typescript
export const config = createConfig({
  apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY!,
  chain: sepolia,
  ssr: true,
  signerConnection: {
    rpcUrl: "/api/rpc/alchemy-proxy",
  },
});
```

## 🎨 スタイリング

### Tailwind + shadcn/ui

```bash
# コンポーネント追加
npx shadcn@latest add button
npx shadcn@latest add dialog
npx shadcn@latest add badge
```

### テーマ対応

```typescript
// ダークモード/ライトモード切り替え
import { useTheme } from "next-themes";

const { theme, setTheme } = useTheme();
```

## 🔄 状態管理

### React Context Pattern

```typescript
// providers/wagmi-provider.tsx
export function WagmiProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

### Custom Hooks Pattern

```typescript
// hooks/use-raffle-data.ts
export function useRaffleData() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    // データ取得ロジック
  }, []);
  
  return { data, isLoading, error };
}
```

## 🌐 API統合

### Rindexer API

```typescript
// api/raffle/history/route.ts
export async function GET(request: NextRequest) {
  const pool = new Pool({
    host: 'localhost',
    port: 5440,
    user: 'postgres',
    // ...
  });
  
  const result = await pool.query(
    'SELECT * FROM winner_picked ORDER BY block_number DESC LIMIT $1',
    [limit]
  );
  
  return NextResponse.json({ data: result.rows });
}
```

### Web3 Integration

```typescript
// ブロックチェーンデータ読み込み
const { data: raffleState } = useReadContract({
  address: contractAddress,
  abi: RaffleABI,
  functionName: 'getRaffleState',
});
```

## 📱 レスポンシブデザイン

### Breakpoints

```css
/* tailwind.config.ts */
screens: {
  'sm': '640px',
  'md': '768px', 
  'lg': '1024px',
  'xl': '1280px',
  '2xl': '1536px',
}
```

### モバイル最適化

```typescript
// hooks/use-mobile.tsx
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(window.innerWidth < 768);
    };
    // ...
  }, []);
  
  return isMobile;
}
```

## 🧪 テスト用データ

### テストネット情報

```typescript
export const testnetInfo = {
  sepolia: {
    faucet: "https://sepoliafaucet.com/",
    explorer: "https://sepolia.etherscan.io",
    usdc: "0x...",
  },
  baseSepolia: {
    faucet: "https://bridge.base.org/deposit",
    explorer: "https://base-sepolia.blockscout.com",
    usdc: "0x...",
  },
  arbitrumSepolia: {
    faucet: "https://bridge.arbitrum.io/",
    explorer: "https://sepolia.arbiscan.io",
    usdc: "0x...",
  }
};
```

## 🚀 デプロイ

### Vercel デプロイ

```bash
# Vercel CLI
npm i -g vercel
vercel

# または GitHub連携で自動デプロイ
```

### 環境変数設定

Vercelダッシュボードで以下を設定：

```
NEXT_PUBLIC_ALCHEMY_API_KEY
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
```

## 🔍 デバッグ

### 開発者ツール

```typescript
// デバッグ用コンソール出力
if (process.env.NODE_ENV === 'development') {
  console.log('Debug:', { raffleData, userAddress });
}
```

### Web3デバッグ

```typescript
// トランザクション詳細ログ
const { data, error, isLoading } = useWaitForTransactionReceipt({
  hash: txHash,
  onSuccess: (receipt) => {
    console.log('Transaction successful:', receipt);
  },
  onError: (error) => {
    console.error('Transaction failed:', error);
  }
});
```

## 🎯 パフォーマンス最適化

### 動的インポート

```typescript
// 重いコンポーネントの遅延読み込み
const AdminPanel = dynamic(() => import('./admin-panel'), {
  loading: () => <p>Loading...</p>,
});
```

### メモ化

```typescript
// 計算コストの高いデータ
const expensiveValue = useMemo(() => {
  return heavyCalculation(data);
}, [data]);

// コールバック関数
const handleClick = useCallback(() => {
  // 処理
}, [dependency]);
```

---

## 🔗 関連リンク

- [Next.js Documentation](https://nextjs.org/docs)
- [wagmi Documentation](https://wagmi.sh/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Account Kit](https://accountkit.alchemy.com/)