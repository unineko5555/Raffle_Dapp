import { useState, useCallback } from 'react'
import { useAccount, useSignTypedData, useWriteContract } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'
import { Permit2Manager, isPermit2Error, translatePermit2Error, type Permit2SignatureData } from '@/lib/permit2-utils'
import { useContractConfig } from '@/hooks/shared/use-contract-config'
import { 
  bridgeAddresses, 
  chainSelectors, 
  getClientForChain,
  type BridgeTransaction 
} from '@/hooks/use-token-bridge'
import { BRIDGE_ABI as RaffleBridgeABI } from '@/app/lib/bridge-contract-config'

export interface Permit2BridgeResult {
  success: boolean
  hash?: `0x${string}`
  messageId?: string
  error?: string
}

export interface BridgeEstimate {
  fee: bigint
  feeFormatted: string
  gasEstimate: bigint
}

/**
 * Permit2を使用したブリッジ機能のカスタムフック
 */
export function usePermit2Bridge() {
  const { address } = useAccount()
  const { signTypedDataAsync } = useSignTypedData()
  const { writeContractAsync } = useWriteContract()
  const { chainId: currentChainId, erc20Address, publicClient } = useContractConfig()
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permit2Data, setPermit2Data] = useState<Permit2SignatureData | null>(null)

  /**
   * ブリッジ手数料を見積もり
   */
  const estimateBridgeFee = useCallback(async (
    amount: string,
    destinationChainId: number
  ): Promise<BridgeEstimate | null> => {
    if (!currentChainId || !publicClient) return null

    try {
      const bridgeAddress = bridgeAddresses[currentChainId]
      const destinationSelector = chainSelectors[destinationChainId]
      
      if (!bridgeAddress || !destinationSelector) {
        throw new Error('Unsupported chain configuration')
      }

      // CCIPメッセージ手数料を見積もり
      const fee = await publicClient.readContract({
        address: bridgeAddress as `0x${string}`,
        abi: RaffleBridgeABI,
        functionName: 'estimateFee',
        args: [destinationSelector, address, parseUnits(amount, 6)]
      }) as bigint

      // ガス見積もり（簡易的な計算）
      const gasEstimate = BigInt(250000) // Permit2 + Bridge操作の推定ガス

      return {
        fee,
        feeFormatted: formatUnits(fee, 18),
        gasEstimate
      }
    } catch (error) {
      console.error('Failed to estimate bridge fee:', error)
      return null
    }
  }, [currentChainId, publicClient, address])

  /**
   * Permit2署名を生成（ブリッジ用）
   */
  const generatePermit2SignatureForBridge = useCallback(async (
    amount: string,
    destinationChainId: number
  ): Promise<Permit2SignatureData | null> => {
    if (!address || !erc20Address || !publicClient || !currentChainId) {
      throw new Error('Required dependencies not available')
    }

    const bridgeAddress = bridgeAddresses[currentChainId]
    if (!bridgeAddress) {
      throw new Error('Bridge not supported on this chain')
    }

    try {
      const permit2Manager = new Permit2Manager(publicClient, currentChainId)
      
      // ウォレットタイプ検出
      const walletType = await permit2Manager.detectWalletType(address)
      console.log(`Bridge Permit2 - Detected wallet type: ${walletType}`)

      // 金額をBigIntに変換
      const amountBigInt = parseUnits(amount, 6)

      // ウォレットタイプに応じた最適化された署名生成
      const signatureData = walletType === 'smart'
        ? await permit2Manager.generateSmartWalletPermit2Signature(
            erc20Address as `0x${string}`,
            amountBigInt,
            bridgeAddress as `0x${string}`,
            address,
            signTypedDataAsync,
            walletType
          )
        : await permit2Manager.generatePermit2Signature(
            erc20Address as `0x${string}`,
            amountBigInt,
            bridgeAddress as `0x${string}`,
            address,
            signTypedDataAsync
          )

      setPermit2Data(signatureData)
      return signatureData
    } catch (error: any) {
      console.error('Failed to generate Permit2 signature for bridge:', error)
      
      if (isPermit2Error(error)) {
        throw new Error(translatePermit2Error(error))
      }
      
      throw new Error(`ブリッジ署名生成に失敗しました: ${error.message || 'Unknown error'}`)
    }
  }, [address, erc20Address, publicClient, currentChainId, signTypedDataAsync])

  /**
   * Permit2を使用してブリッジを実行
   */
  const bridgeWithPermit2 = useCallback(async (
    amount: string,
    destinationChainId: number,
    receiverAddress?: string
  ): Promise<Permit2BridgeResult> => {
    if (!address || !currentChainId || !publicClient) {
      return { success: false, error: 'Required dependencies not available' }
    }

    setIsLoading(true)
    setError(null)

    try {
      const bridgeAddress = bridgeAddresses[currentChainId]
      const destinationSelector = chainSelectors[destinationChainId]
      const receiver = receiverAddress || address

      if (!bridgeAddress || !destinationSelector) {
        throw new Error('サポートされていないチェーンです')
      }

      // ブリッジ手数料見積もり
      const estimate = await estimateBridgeFee(amount, destinationChainId)
      if (!estimate) {
        throw new Error('ブリッジ手数料の見積もりに失敗しました')
      }

      // Permit2署名生成（キャッシュがある場合は再利用）
      let signatureData = permit2Data
      if (!signatureData) {
        signatureData = await generatePermit2SignatureForBridge(amount, destinationChainId)
        if (!signatureData) {
          throw new Error('署名生成に失敗しました')
        }
      }

      // 金額をBigIntに変換
      const amountBigInt = parseUnits(amount, 6)

      // bridgeTokensWithPermit2実行
      const hash = await writeContractAsync({
        address: bridgeAddress as `0x${string}`,
        abi: RaffleBridgeABI,
        functionName: 'bridgeTokensWithPermit2',
        args: [
          destinationSelector,
          receiver as `0x${string}`,
          amountBigInt,
          signatureData.permit,
          signatureData.signature
        ],
        value: estimate.fee // CCIP手数料をETHで支払い
      })

      // 成功後はキャッシュをクリア
      setPermit2Data(null)

      // トランザクションレシートからメッセージIDを取得（可能であれば）
      let messageId: string | undefined
      try {
        // TODO: ログからmessageIdを抽出する実装を追加
        // const receipt = await publicClient.waitForTransactionReceipt({ hash })
        // messageId = extractMessageIdFromLogs(receipt.logs)
      } catch (error) {
        console.warn('Failed to extract message ID:', error)
      }

      return { 
        success: true, 
        hash,
        messageId
      }
    } catch (error: any) {
      console.error('Failed to bridge with Permit2:', error)
      
      let errorMessage: string
      if (isPermit2Error(error)) {
        errorMessage = translatePermit2Error(error)
      } else if (error.message?.includes('Insufficient CCIP fee')) {
        errorMessage = 'CCIP手数料が不足しています'
      } else if (error.message?.includes('User rejected') || error.message?.includes('rejected')) {
        errorMessage = 'ユーザーが署名をキャンセルしました'
      } else {
        errorMessage = `ブリッジに失敗しました: ${error.message || 'Unknown error'}`
      }
      
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }, [
    address,
    currentChainId,
    publicClient,
    permit2Data,
    estimateBridgeFee,
    generatePermit2SignatureForBridge,
    writeContractAsync
  ])

  /**
   * ユーザーのUSDC残高チェック
   */
  const checkUserBalance = useCallback(async (
    requiredAmount: string
  ): Promise<{ hasEnough: boolean; balance: string; formatted: string }> => {
    if (!address || !erc20Address || !publicClient) {
      return { hasEnough: false, balance: '0', formatted: '0' }
    }

    try {
      const balance = await publicClient.readContract({
        address: erc20Address as `0x${string}`,
        abi: [
          {
            name: 'balanceOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }]
          }
        ],
        functionName: 'balanceOf',
        args: [address]
      }) as bigint

      const requiredBigInt = parseUnits(requiredAmount, 6)
      const formatted = formatUnits(balance, 6)

      return {
        hasEnough: balance >= requiredBigInt,
        balance: balance.toString(),
        formatted
      }
    } catch (error) {
      console.error('Failed to check user balance:', error)
      return { hasEnough: false, balance: '0', formatted: '0' }
    }
  }, [address, erc20Address, publicClient])

  /**
   * Permit2署名を事前生成（UX改善のため）
   */
  const preparePermit2SignatureForBridge = useCallback(async (
    amount: string,
    destinationChainId: number
  ): Promise<boolean> => {
    try {
      await generatePermit2SignatureForBridge(amount, destinationChainId)
      return true
    } catch (error) {
      console.error('Failed to prepare Permit2 signature for bridge:', error)
      return false
    }
  }, [generatePermit2SignatureForBridge])

  /**
   * USDCをPermit2に許可（ブリッジ用）
   */
  const approveUSDCToPermit2 = useCallback(async (amount?: bigint): Promise<{
    success: boolean;
    hash?: `0x${string}`;
    error?: string;
  }> => {
    if (!address || !erc20Address || !publicClient) {
      return { success: false, error: 'Required dependencies not available' }
    }

    try {
      setIsLoading(true)
      setError(null)

      const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3'
      // デフォルトは最大値（無制限許可）、または指定された金額
      const approveAmount = amount || BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
      
      console.log('🔓 [Bridge] Approving USDC to Permit2:', {
        tokenAddress: erc20Address,
        permit2Address: PERMIT2_ADDRESS,
        amount: approveAmount.toString(),
        userAddress: address
      })

      // USDCコントラクトのapprove関数を呼び出し
      const hash = await writeContractAsync({
        address: erc20Address as `0x${string}`,
        abi: [
          {
            name: 'approve',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'spender', type: 'address' },
              { name: 'amount', type: 'uint256' }
            ],
            outputs: [{ name: '', type: 'bool' }]
          }
        ],
        functionName: 'approve',
        args: [PERMIT2_ADDRESS, approveAmount]
      })

      console.log('✅ [Bridge] USDC approve transaction successful:', hash)
      return { success: true, hash }

    } catch (error: any) {
      console.error('Failed to approve USDC to Permit2 for bridge:', error)
      
      let errorMessage: string
      if (error.message?.includes('User rejected') || error.message?.includes('rejected')) {
        errorMessage = 'ユーザーが承認をキャンセルしました'
      } else if (error.shortMessage) {
        errorMessage = `USDC承認に失敗しました: ${error.shortMessage}`
      } else {
        errorMessage = `USDC承認に失敗しました: ${error.message || 'Unknown error'}`
      }
      
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }, [address, erc20Address, publicClient, writeContractAsync])

  /**
   * 改善されたブリッジフロー（許可チェック込み）
   */
  const bridgeWithOptimizedFlow = useCallback(async (
    amount: string,
    destinationChainId: number,
    receiverAddress?: string
  ): Promise<Permit2BridgeResult> => {
    if (!address || !currentChainId || !publicClient) {
      return { success: false, error: 'Required dependencies not available' }
    }

    setIsLoading(true)
    setError(null)

    try {
      const bridgeAddress = bridgeAddresses[currentChainId]
      const destinationSelector = chainSelectors[destinationChainId]
      const receiver = receiverAddress || address

      if (!bridgeAddress || !destinationSelector) {
        throw new Error('サポートされていないチェーンです')
      }

      // ブリッジ手数料見積もり
      const estimate = await estimateBridgeFee(amount, destinationChainId)
      if (!estimate) {
        throw new Error('ブリッジ手数料の見積もりに失敗しました')
      }

      // USDC残高チェック
      const balance = await checkUserBalance(amount)
      if (!balance.hasEnough) {
        throw new Error(`USDC残高が不足しています。必要: ${amount} USDC, 現在: ${balance.formatted} USDC`)
      }

      // Permit2許可状況をチェック
      const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3'
      const allowance = await publicClient.readContract({
        address: erc20Address as `0x${string}`,
        abi: [
          {
            name: 'allowance',
            type: 'function',
            stateMutability: 'view',
            inputs: [
              { name: 'owner', type: 'address' },
              { name: 'spender', type: 'address' }
            ],
            outputs: [{ name: '', type: 'uint256' }]
          }
        ],
        functionName: 'allowance',
        args: [address, PERMIT2_ADDRESS]
      }) as bigint

      const amountBigInt = parseUnits(amount, 6)
      const hasPermit2Allowance = allowance >= amountBigInt

      console.log('💰 [Bridge] USDC Balance & Permit2 Status:', {
        userAddress: address,
        usdcAddress: erc20Address,
        bridgeAmount: amountBigInt.toString(),
        hasEnoughBalance: balance.hasEnough,
        permit2Allowance: allowance.toString(),
        hasPermit2Allowance,
        permit2Address: PERMIT2_ADDRESS
      })

      // Permit2許可が不足している場合は自動的に許可
      if (!hasPermit2Allowance) {
        console.log('🔄 [Bridge] Permit2許可が不足しています。自動的に許可します...')
        
        const approveResult = await approveUSDCToPermit2()
        if (!approveResult.success) {
          throw new Error(approveResult.error || 'USDC許可に失敗しました')
        }

        console.log('✅ [Bridge] Permit2許可が完了しました。ブリッジを続行します...')
        
        // 許可完了後、少し待機して状態を更新
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      // Permit2署名生成（キャッシュがある場合は再利用）
      let signatureData = permit2Data
      if (!signatureData) {
        signatureData = await generatePermit2SignatureForBridge(amount, destinationChainId)
        if (!signatureData) {
          throw new Error('署名生成に失敗しました')
        }
      }

      // bridgeTokensWithPermit2実行
      const hash = await writeContractAsync({
        address: bridgeAddress as `0x${string}`,
        abi: RaffleBridgeABI,
        functionName: 'bridgeTokensWithPermit2',
        args: [
          destinationSelector,
          receiver as `0x${string}`,
          amountBigInt,
          signatureData.permit,
          signatureData.signature
        ],
        value: estimate.fee // CCIP手数料をETHで支払い
      })

      // 成功後はキャッシュをクリア
      setPermit2Data(null)

      // トランザクションレシートからメッセージIDを取得（可能であれば）
      let messageId: string | undefined
      try {
        // TODO: ログからmessageIdを抽出する実装を追加
      } catch (error) {
        console.warn('Failed to extract message ID:', error)
      }

      return { 
        success: true, 
        hash,
        messageId
      }
    } catch (error: any) {
      console.error('Failed to bridge with optimized Permit2 flow:', error)
      
      let errorMessage: string
      if (isPermit2Error(error)) {
        errorMessage = translatePermit2Error(error)
      } else if (error.message?.includes('Insufficient CCIP fee')) {
        errorMessage = 'CCIP手数料が不足しています'
      } else if (error.message?.includes('User rejected') || error.message?.includes('rejected')) {
        errorMessage = 'ユーザーが署名をキャンセルしました'
      } else {
        errorMessage = `ブリッジに失敗しました: ${error.message || 'Unknown error'}`
      }
      
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }, [
    address,
    currentChainId,
    publicClient,
    permit2Data,
    estimateBridgeFee,
    checkUserBalance,
    approveUSDCToPermit2,
    generatePermit2SignatureForBridge,
    writeContractAsync,
    erc20Address
  ])

  /**
   * キャッシュされた署名をクリア
   */
  const clearPermit2Cache = useCallback(() => {
    setPermit2Data(null)
    setError(null)
  }, [])

  return {
    // 主要機能
    bridgeWithPermit2,
    bridgeWithOptimizedFlow, // 新しい改善されたブリッジフロー
    estimateBridgeFee,
    preparePermit2SignatureForBridge,
    generatePermit2SignatureForBridge,
    approveUSDCToPermit2, // 許可機能
    
    // バリデーション
    checkUserBalance,
    
    // 状態管理
    isLoading,
    error,
    permit2Data,
    
    // ユーティリティ
    clearPermit2Cache,
    
    // 計算された値
    isPermit2Ready: !!permit2Data,
    
    // サポートされているチェーン
    supportedChains: Object.keys(bridgeAddresses).map(Number),
    currentChainId
  }
}