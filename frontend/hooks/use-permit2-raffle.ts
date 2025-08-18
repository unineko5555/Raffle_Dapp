import { useState, useCallback } from 'react'
import { useAccount, useSignTypedData, useWriteContract, useReadContract } from 'wagmi'
import { Permit2Manager, isPermit2Error, translatePermit2Error, type Permit2SignatureData } from '@/lib/permit2-utils'
import { useContractConfig } from '@/hooks/shared/use-contract-config'
import { RaffleABI } from '@/app/lib/abi'

export interface Permit2RaffleResult {
  success: boolean
  hash?: `0x${string}`
  error?: string
}

/**
 * Permit2を使用したラッフル参加機能のカスタムフック
 */
export function usePermit2Raffle() {
  const { address } = useAccount()
  const { signTypedDataAsync } = useSignTypedData()
  const { writeContractAsync } = useWriteContract()
  const { contractAddress, erc20Address, publicClient, currentChainId } = useContractConfig()
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permit2Data, setPermit2Data] = useState<Permit2SignatureData | null>(null)

  // エントランス料金を取得
  const { data: entranceFeeData } = useReadContract(
    contractAddress && currentChainId
      ? {
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: 'getEntranceFee',
          chainId: currentChainId
        }
      : undefined
  )

  /**
   * Permit2の利用可能性をチェック
   */
  const checkPermit2Availability = useCallback(async (): Promise<boolean> => {
    if (!publicClient || !currentChainId) return false

    try {
      const permit2Manager = new Permit2Manager(publicClient, currentChainId)
      return await permit2Manager.isPermit2Available()
    } catch (error) {
      console.warn('Permit2 availability check failed:', error)
      return false
    }
  }, [publicClient, currentChainId])

  /**
   * 現在のユーザーの参加状態をチェック
   */
  const checkPlayerEntered = useCallback(async (): Promise<boolean> => {
    if (!address || !contractAddress || !publicClient) return false

    try {
      // プレイヤー数を取得
      const playerCount = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: RaffleABI,
        functionName: 'getNumberOfPlayers'
      }) as bigint

      // プレイヤーリストをチェック
      for (let i = 0; i < Number(playerCount); i++) {
        const player = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: 'getPlayer',
          args: [BigInt(i)]
        }) as string

        if (player.toLowerCase() === address.toLowerCase()) {
          return true
        }
      }

      return false
    } catch (error) {
      console.error('Failed to check player entered status:', error)
      return false
    }
  }, [address, contractAddress, publicClient])

  /**
   * Permit2署名を生成
   */
  const generatePermit2Signature = useCallback(async (): Promise<Permit2SignatureData | null> => {
    if (!address || !contractAddress || !erc20Address || !publicClient || !currentChainId || !entranceFeeData) {
      throw new Error('Required dependencies not available')
    }

    try {
      const permit2Manager = new Permit2Manager(publicClient, currentChainId)
      
      // ウォレットタイプ検出
      const walletType = await permit2Manager.detectWalletType(address)
      console.log(`Detected wallet type: ${walletType}`)

      // Permit2署名生成
      const signatureData = await permit2Manager.generatePermit2Signature(
        erc20Address as `0x${string}`,
        entranceFeeData as bigint,
        contractAddress as `0x${string}`,
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
      console.error('Failed to generate Permit2 signature:', error)
      
      if (isPermit2Error(error)) {
        throw new Error(translatePermit2Error(error))
      }
      
      throw new Error(`署名生成に失敗しました: ${error.message || 'Unknown error'}`)
    }
  }, [address, contractAddress, erc20Address, publicClient, currentChainId, entranceFeeData, signTypedDataAsync])

  /**
   * Permit2を使用してラッフルに参加
   */
  const enterRaffleWithPermit2 = useCallback(async (): Promise<Permit2RaffleResult> => {
    if (!address || !contractAddress || !publicClient) {
      return { success: false, error: 'Required dependencies not available' }
    }

    setIsLoading(true)
    setError(null)

    try {
      // 事前チェック
      const isAvailable = await checkPermit2Availability()
      if (!isAvailable) {
        throw new Error('Permit2がこのネットワークで利用できません')
      }

      // すでに参加しているかチェック
      const alreadyEntered = await checkPlayerEntered()
      if (alreadyEntered) {
        throw new Error('すでにこのラッフルに参加しています')
      }

      // Permit2署名生成（キャッシュがある場合は再利用）
      let signatureData = permit2Data
      if (!signatureData) {
        signatureData = await generatePermit2Signature()
        if (!signatureData) {
          throw new Error('署名生成に失敗しました')
        }
      }

      // enterRaffleWithPermit2実行
      const hash = await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: RaffleABI,
        functionName: 'enterRaffleWithPermit2',
        args: [signatureData.permit, signatureData.signature]
      })

      // 成功後はキャッシュをクリア
      setPermit2Data(null)

      return { success: true, hash }
    } catch (error: any) {
      console.error('Failed to enter raffle with Permit2:', error)
      
      let errorMessage: string
      if (isPermit2Error(error)) {
        errorMessage = translatePermit2Error(error)
      } else if (error.message?.includes('User rejected') || error.message?.includes('rejected')) {
        errorMessage = 'ユーザーが署名をキャンセルしました'
      } else {
        errorMessage = `ラッフル参加に失敗しました: ${error.message || 'Unknown error'}`
      }
      
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }, [
    address,
    contractAddress,
    publicClient,
    checkPermit2Availability,
    checkPlayerEntered,
    permit2Data,
    generatePermit2Signature,
    writeContractAsync
  ])

  /**
   * Permit2署名を事前生成（UX改善のため）
   */
  const preparePermit2Signature = useCallback(async (): Promise<boolean> => {
    try {
      await generatePermit2Signature()
      return true
    } catch (error) {
      console.error('Failed to prepare Permit2 signature:', error)
      return false
    }
  }, [generatePermit2Signature])

  /**
   * キャッシュされた署名をクリア
   */
  const clearPermit2Cache = useCallback(() => {
    setPermit2Data(null)
    setError(null)
  }, [])

  return {
    // 主要機能
    enterRaffleWithPermit2,
    preparePermit2Signature,
    generatePermit2Signature,
    checkPermit2Availability,
    
    // 状態管理
    isLoading,
    error,
    permit2Data,
    
    // ユーティリティ
    clearPermit2Cache,
    checkPlayerEntered,
    
    // 計算された値
    isPermit2Ready: !!permit2Data,
    entranceFee: entranceFeeData
  }
}