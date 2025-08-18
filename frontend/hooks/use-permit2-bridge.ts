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
import { RaffleBridgeABI } from '@/app/lib/abi'

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
  const { currentChainId, publicClient, erc20Address } = useContractConfig()
  
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

      // Permit2署名生成
      const signatureData = await permit2Manager.generatePermit2Signature(
        erc20Address as `0x${string}`,
        amountBigInt,
        bridgeAddress as `0x${string}`,
        address,
        signTypedDataAsync
      )

      // スマートウォレットの場合はERC-6492処理
      if (walletType === 'smart') {
        const processedSignature = await permit2Manager.handlePreDeploySignature(signatureData.signature)
        signatureData.signature = processedSignature
      }

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
   * キャッシュされた署名をクリア
   */
  const clearPermit2Cache = useCallback(() => {
    setPermit2Data(null)
    setError(null)
  }, [])

  return {
    // 主要機能
    bridgeWithPermit2,
    estimateBridgeFee,
    preparePermit2SignatureForBridge,
    generatePermit2SignatureForBridge,
    
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