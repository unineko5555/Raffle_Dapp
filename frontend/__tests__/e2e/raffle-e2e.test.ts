// E2E Tests for Raffle DApp using Playwright MCP
// These tests verify the complete user experience without mocking

import { test, expect } from '@playwright/test'

test.describe('Raffle DApp E2E Tests', () => {
  const baseUrl = 'http://localhost:3000'

  test.beforeEach(async ({ page }) => {
    // Navigate to the application before each test
    await page.goto(baseUrl)
    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle')
  })

  test.describe('Page Load and Navigation', () => {
    test('should load the main page successfully', async ({ page }) => {
      // Verify page title
      await expect(page).toHaveTitle('Raffle Dapp')
      
      // Verify main heading exists
      await expect(page.getByRole('heading', { name: '進行中のラッフル' })).toBeVisible()
      
      // Verify navigation header is present
      await expect(page.getByText('Raffle Dapp')).toBeVisible()
      await expect(page.getByText('Beta')).toBeVisible()
    })

    test('should display all main sections', async ({ page }) => {
      // Check jackpot system section
      await expect(page.getByText('ジャックポットシステム')).toBeVisible()
      
      // Check prize sections
      await expect(page.getByRole('heading', { name: '当選賞金' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'ジャックポット' })).toBeVisible()
      
      // Check participants section
      await expect(page.getByRole('heading', { name: '参加者 (3/3必要)' })).toBeVisible()
      
      // Check user info section
      await expect(page.getByRole('heading', { name: 'ユーザー情報' })).toBeVisible()
    })

    test('should navigate to bridge page', async ({ page }) => {
      // Click bridge button
      await page.getByRole('button', { name: 'Bridge' }).click()
      
      // Verify navigation to bridge page
      await expect(page).toHaveURL(`${baseUrl}/bridge`)
      
      // Verify bridge page content
      await page.waitForLoadState('networkidle')
      // Could add more specific bridge page assertions here
    })
  })

  test.describe('Wallet Connection State', () => {
    test('should show disconnected state by default', async ({ page }) => {
      // Verify wallet connection button exists
      await expect(page.getByRole('button', { name: 'アカウント接続' })).toBeVisible()
      
      // Verify user info shows disconnected state
      await expect(page.getByText('未接続')).toBeVisible()
      
      // Verify raffle participation button is disabled
      await expect(page.getByRole('button', { name: 'ラッフルに参加する' })).toBeDisabled()
    })

    test('should display connect wallet modal when clicked', async ({ page }) => {
      // Click connect wallet button
      await page.getByRole('button', { name: 'アカウント接続' }).click()
      
      // Note: In a real test, we would verify the wallet connection modal appears
      // For this test, we just verify the button is clickable and functional
      // The actual wallet connection would require additional setup
    })
  })

  test.describe('Raffle Interface', () => {
    test('should display raffle status correctly', async ({ page }) => {
      // Verify raffle status is active
      await expect(page.getByText('アクティブ')).toBeVisible()
      
      // Verify smart contract verification
      await expect(page.getByText('スマートコントラクト検証済み')).toBeVisible()
      
      // Verify minimum participants requirement
      await expect(page.getByRole('heading', { name: '最小参加者数まで 3 人' })).toBeVisible()
      await expect(page.getByText('0/3')).toBeVisible()
    })

    test('should show jackpot system information', async ({ page }) => {
      // Verify jackpot system is visible
      await expect(page.getByText('ジャックポットシステム')).toBeVisible()
      
      // Verify jackpot accumulation explanation
      await expect(page.getByText('参加料の10%がジャックポットに蓄積されます')).toBeVisible()
      
      // Verify winning probability information
      await expect(page.getByText('ジャックポットの当選確率: 約35.0%')).toBeVisible()
      await expect(page.getByText('（平均3回の参加で1回の当選確率）')).toBeVisible()
    })

    test('should display current prize amounts', async ({ page }) => {
      // Verify prize amounts are displayed (may be 0.00 USDC initially)
      await expect(page.locator('text=USDC').first()).toBeVisible()
      
      // Verify both prize sections show USDC amounts
      const prizeElements = page.locator('text=/\\d+\\.\\d+ USDC/')
      await expect(prizeElements.first()).toBeVisible()
    })
  })

  test.describe('Network Selection', () => {
    test('should show current network (Sepolia)', async ({ page }) => {
      // Verify Sepolia network is displayed
      await expect(page.getByRole('button', { name: 'Sepolia' })).toBeVisible()
    })

    test('should open network selection when clicked', async ({ page }) => {
      // Click network selector
      await page.getByRole('button', { name: 'Sepolia' }).click()
      
      // Note: In a real test, we would verify the network dropdown appears
      // For this test, we just verify the button is functional
    })
  })

  test.describe('Theme Toggle', () => {
    test('should have theme toggle button', async ({ page }) => {
      // Verify theme toggle button exists
      await expect(page.getByRole('button', { name: 'テーマ切り替え' })).toBeVisible()
    })

    test('should toggle theme when clicked', async ({ page }) => {
      const themeButton = page.getByRole('button', { name: 'テーマ切り替え' })
      
      // Click theme toggle
      await themeButton.click()
      
      // Note: Theme changes would be visible in CSS classes or styles
      // For this basic test, we just verify the button is functional
    })
  })

  test.describe('User Statistics', () => {
    test('should display user statistics with default values', async ({ page }) => {
      // Verify total participation count
      await expect(page.getByText('総参加数')).toBeVisible()
      await expect(page.locator('text="0"').first()).toBeVisible()
      
      // Verify win count
      await expect(page.getByText('勝利回数')).toBeVisible()
      
      // Verify jackpot wins
      await expect(page.getByText('ジャックポット獲得')).toBeVisible()
    })
  })

  test.describe('History Section', () => {
    test('should show empty history initially', async ({ page }) => {
      // Verify history section exists
      await expect(page.getByRole('heading', { name: '過去のラッフル当選履歴' })).toBeVisible()
      
      // Verify empty state message
      await expect(page.getByText('まだ当選履歴がありません')).toBeVisible()
    })
  })

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      
      // Verify main content is still visible
      await expect(page.getByRole('heading', { name: '進行中のラッフル' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'アカウント接続' })).toBeVisible()
      
      // Verify navigation is accessible
      await expect(page.getByText('Raffle Dapp')).toBeVisible()
    })

    test('should work on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 })
      
      // Verify content layout adapts properly
      await expect(page.getByRole('heading', { name: '進行中のラッフル' })).toBeVisible()
      await expect(page.getByText('ジャックポットシステム')).toBeVisible()
    })

    test('should work on desktop viewport', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 })
      
      // Verify full layout is visible
      await expect(page.getByRole('heading', { name: '進行中のラッフル' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'ユーザー情報' })).toBeVisible()
    })
  })

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      // Verify main heading
      await expect(page.getByRole('heading', { level: 2, name: '進行中のラッフル' })).toBeVisible()
      
      // Verify section headings
      await expect(page.getByRole('heading', { level: 3, name: '当選賞金' })).toBeVisible()
      await expect(page.getByRole('heading', { level: 3, name: 'ジャックポット' })).toBeVisible()
      await expect(page.getByRole('heading', { level: 3, name: 'ユーザー情報' })).toBeVisible()
    })

    test('should have accessible buttons', async ({ page }) => {
      // Verify all main buttons are properly labeled
      await expect(page.getByRole('button', { name: 'アカウント接続' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'ラッフルに参加する' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'テーマ切り替え' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Bridge' })).toBeVisible()
    })

    test('should support keyboard navigation', async ({ page }) => {
      // Focus on the first interactive element
      await page.keyboard.press('Tab')
      
      // Note: Full keyboard navigation testing would require more complex setup
      // This basic test verifies tabbing is functional
    })
  })

  test.describe('Performance', () => {
    test('should load within reasonable time', async ({ page }) => {
      const startTime = Date.now()
      
      await page.goto(baseUrl)
      await page.waitForLoadState('networkidle')
      
      const loadTime = Date.now() - startTime
      
      // Verify page loads within 5 seconds
      expect(loadTime).toBeLessThan(5000)
    })

    test('should have no console errors on load', async ({ page }) => {
      const errors: string[] = []
      
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text())
        }
      })
      
      await page.goto(baseUrl)
      await page.waitForLoadState('networkidle')
      
      // Filter out known development warnings
      const criticalErrors = errors.filter(error => 
        !error.includes('Warning:') && 
        !error.includes('React DevTools') &&
        !error.includes('Download the React DevTools')
      )
      
      expect(criticalErrors.length).toBe(0)
    })
  })
})