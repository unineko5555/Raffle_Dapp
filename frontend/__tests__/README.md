# Frontend Test Suite

このディレクトリには、Raffle DAppフロントエンドの包括的なテストスイートが含まれています。

## 📋 テスト構成

### テストの種類

- **Unit Tests**: 個別のコンポーネント、フック、ユーティリティ関数のテスト
- **Integration Tests**: ページ全体のワークフローとユーザージャーニーのテスト

### ディレクトリ構造

```
__tests__/
├── components/          # コンポーネントテスト
│   ├── raffle-header.test.tsx
│   └── enter-raffle-button.test.tsx
├── hooks/              # カスタムフックテスト
│   ├── use-contract-config.test.ts
│   └── use-raffle-data.test.ts
├── integration/        # 統合テスト
│   └── raffle-workflow.test.tsx
└── utils/              # テストユーティリティ
    └── test-utils.tsx
```

## 🚀 テスト実行

### 基本コマンド

```bash
# 全テスト実行
npm test

# ウォッチモードでテスト実行
npm run test:watch

# カバレッジレポート生成
npm run test:coverage
```

### 個別テスト実行

```bash
# 特定のテストファイル実行
npm test raffle-header.test.tsx

# 特定のテストスイート実行
npm test -- --testNamePattern="raffle workflow"

# 統合テストのみ実行
npm test integration/
```

## 🔧 テスト設定

### Jest設定 (`jest.config.js`)

- **テスト環境**: jsdom
- **カバレッジ目標**: 70% (branches, functions, lines, statements)
- **モジュールマッピング**: `@/` → プロジェクトルート
- **セットアップファイル**: `jest.setup.js`

### セットアップファイル (`jest.setup.js`)

以下をモック済み:
- Next.js router/navigation
- wagmi hooks (useAccount, useReadContract, etc.)
- viem utilities
- Alchemy AA SDK
- Web3Auth
- ブラウザAPI (localStorage, ResizeObserver, etc.)

## 📊 テストカバレッジ

### 現在の実装

| カテゴリ | テスト数 | カバレッジ目標 |
|----------|----------|----------------|
| Hooks | 2 | 70% |
| Components | 2 | 70% |
| Integration | 1 | 60% |

### カバレッジ対象

```javascript
collectCoverageFrom: [
  'app/**/*.{js,jsx,ts,tsx}',
  'hooks/**/*.{js,jsx,ts,tsx}',
  'components/**/*.{js,jsx,ts,tsx}',
  '!**/*.d.ts',
  '!**/node_modules/**',
]
```

## 🧪 テストパターン

### 1. コンポーネントテスト

```typescript
describe('ComponentName', () => {
  describe('rendering', () => {
    it('should render correctly', () => {
      render(<ComponentName />)
      expect(screen.getByText('Expected Text')).toBeInTheDocument()
    })
  })
  
  describe('interactions', () => {
    it('should handle click events', async () => {
      const mockFn = jest.fn()
      render(<ComponentName onClick={mockFn} />)
      
      await user.click(screen.getByRole('button'))
      expect(mockFn).toHaveBeenCalled()
    })
  })
})
```

### 2. カスタムフックテスト

```typescript
describe('useCustomHook', () => {
  it('should return expected values', () => {
    const { result } = renderHook(() => useCustomHook())
    
    expect(result.current.value).toBe('expected')
  })
  
  it('should handle updates', () => {
    const { result, rerender } = renderHook(() => useCustomHook(props))
    
    // プロパティ変更をシミュレート
    rerender()
    expect(result.current.updated).toBe(true)
  })
})
```

### 3. 統合テスト

```typescript
describe('User Journey', () => {
  it('should complete full workflow', async () => {
    render(<RafflePage />)
    
    // ユーザーアクションをシミュレート
    await user.click(screen.getByRole('button', { name: /enter raffle/i }))
    
    // 結果を検証
    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument()
    })
  })
})
```

## 🎯 テストのベストプラクティス

### 1. テスト構造

- **AAA パターン**: Arrange → Act → Assert
- **明確な記述**: テスト名でテスト内容を明示
- **独立性**: 各テストが他のテストに依存しない

### 2. モックの使用

```typescript
// 外部依存のモック
jest.mock('@/hooks/use-raffle-data')

// 条件付きレスポンス
mockUseRaffleData.mockReturnValue({
  raffleState: 0,
  isLoading: false,
  error: null,
})
```

### 3. 非同期テスト

```typescript
// waitForを使用した非同期テスト
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument()
})

// act()を使用した状態更新
await act(async () => {
  mockHook.mockReturnValue(newValue)
})
```

### 4. アクセシビリティテスト

```typescript
// ARIA属性のテスト
expect(button).toHaveAttribute('aria-busy', 'true')

// スクリーンリーダー対応のテスト
expect(screen.getByLabelText(/current balance/i)).toBeInTheDocument()
```

## 🚨 トラブルシューティング

### よくある問題

1. **モックが効かない**
   - `jest.clearAllMocks()`を`beforeEach`で実行
   - モック順序を確認

2. **非同期テストの失敗**
   - `waitFor`または`act`の使用
   - タイムアウト設定の調整

3. **型エラー**
   - `@types/testing-library__*`のインストール
   - TypeScript設定の確認

### デバッグ方法

```typescript
// コンポーネントのHTML出力確認
screen.debug()

// 特定要素の確認
screen.debug(screen.getByRole('button'))

// クエリの失敗理由確認
screen.getByRole('button', { name: /submit/i })
```

## 📈 継続的改善

### 今後の拡張予定

1. **E2Eテスト**: Playwright/Cypressの導入
2. **Visual Regression Testing**: Chromatic/Percy
3. **パフォーマンステスト**: Testing Library performance utilities
4. **A11yテスト**: @testing-library/jest-axe

### メトリクス監視

- テストカバレッジ: 70%以上維持
- テスト実行時間: <30秒
- テスト安定性: >95%成功率

---

**更新日**: 2025-07-10  
**メンテナー**: Claude Code Team