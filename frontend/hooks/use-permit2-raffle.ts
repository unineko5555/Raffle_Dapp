import { useState, useCallback } from 'react'
import { useAccount, useSignTypedData, useWriteContract, useReadContract } from 'wagmi'
import { Permit2Manager, isPermit2Error, translatePermit2Error, type Permit2SignatureData } from '@/lib/permit2-utils'
import { useContractConfig } from '@/hooks/shared/use-contract-config'
import { RaffleABI } from '@/app/lib/contract-config'

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
  const { chainId: currentChainId, contractAddress, erc20Address, publicClient } = useContractConfig()
  
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
    console.log('🔍 [checkPermit2Availability] Starting check...', {
      publicClient: !!publicClient,
      currentChainId,
      publicClientType: publicClient?.constructor?.name
    });

    if (!publicClient || !currentChainId) {
      console.warn('❌ [checkPermit2Availability] Missing dependencies:', {
        hasPublicClient: !!publicClient,
        currentChainId
      });
      return false
    }

    try {
      console.log('🏗️ [checkPermit2Availability] Creating Permit2Manager...');
      const permit2Manager = new Permit2Manager(publicClient, currentChainId)
      
      console.log('🚀 [checkPermit2Availability] Calling isPermit2Available...');
      const result = await permit2Manager.isPermit2Available()
      
      console.log('✅ [checkPermit2Availability] Result:', result);
      return result
    } catch (error) {
      console.error('❌ [checkPermit2Availability] Permit2 availability check failed:', error)
      return false
    }
  }, [publicClient, currentChainId])

  /**
   * ユーザーのUSDC残高とPermit2許可状況をチェック
   */
  const checkUSDCAllowanceAndBalance = useCallback(async (): Promise<{
    balance: string;
    hasEnoughBalance: boolean;
    permit2Allowance: string;
    hasPermit2Allowance: boolean;
  } | null> => {
    if (!address || !erc20Address || !publicClient) return null

    try {
      // USDC残高チェック
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

      // Permit2への許可量チェック
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

      const entranceFee = entranceFeeData as bigint || BigInt(0)
      
      console.log('💰 USDC Balance & Permit2 Status:', {
        userAddress: address,
        usdcAddress: erc20Address,
        balance: balance.toString(),
        entranceFee: entranceFee.toString(),
        hasEnoughBalance: balance >= entranceFee,
        permit2Allowance: allowance.toString(),
        hasPermit2Allowance: allowance >= entranceFee,
        permit2Address: PERMIT2_ADDRESS
      })

      return {
        balance: balance.toString(),
        hasEnoughBalance: balance >= entranceFee,
        permit2Allowance: allowance.toString(),
        hasPermit2Allowance: allowance >= entranceFee
      }
    } catch (error) {
      console.error('Failed to check USDC allowance and balance:', error)
      return null
    }
  }, [address, erc20Address, publicClient, entranceFeeData])

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

      // ウォレットタイプに応じた最適化された署名生成
      const signatureData = walletType === 'smart' 
        ? await permit2Manager.generateSmartWalletPermit2Signature(
            erc20Address as `0x${string}`,
            entranceFeeData as bigint,
            contractAddress as `0x${string}`,
            address,
            signTypedDataAsync,
            walletType
          )
        : await permit2Manager.generatePermit2Signature(
            erc20Address as `0x${string}`,
            entranceFeeData as bigint,
            contractAddress as `0x${string}`,
            address,
            signTypedDataAsync
          )

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
      console.log('🔍 Checking if player already entered...')
      const alreadyEntered = await checkPlayerEntered()
      console.log(`🎯 Player already entered: ${alreadyEntered}`)
      if (alreadyEntered) {
        throw new Error('すでにこのラッフルに参加しています')
      }

      // USDC残高とPermit2許可状況をチェック
      const allowanceStatus = await checkUSDCAllowanceAndBalance()
      if (!allowanceStatus) {
        throw new Error('USDC残高とPermit2許可状況の確認に失敗しました')
      }

      if (!allowanceStatus.hasEnoughBalance) {
        throw new Error(`USDC残高が不足しています。必要: ${(Number(entranceFeeData) / 1e6).toFixed(2)} USDC, 現在: ${(Number(allowanceStatus.balance) / 1e6).toFixed(2)} USDC`)
      }

      if (!allowanceStatus.hasPermit2Allowance) {
        throw new Error(`Permit2への許可が不足しています。USDCをPermit2に許可してください。必要: ${(Number(entranceFeeData) / 1e6).toFixed(2)} USDC, 現在の許可: ${(Number(allowanceStatus.permit2Allowance) / 1e6).toFixed(2)} USDC`)
      }

      // Permit2署名生成（キャッシュがある場合は再利用）
      let signatureData = permit2Data
      if (!signatureData) {
        signatureData = await generatePermit2Signature()
        if (!signatureData) {
          throw new Error('署名生成に失敗しました')
        }
      }

      // デバッグ用：Permit2パラメータをログ出力
      console.log('🔍 Permit2 Parameters:', {
        contractAddress,
        erc20Address,
        entranceFee: entranceFeeData?.toString(),
        permit: {
          details: {
            token: signatureData.permit.details.token,
            amount: signatureData.permit.details.amount.toString(),
            expiration: signatureData.permit.details.expiration.toString(),
            nonce: signatureData.permit.details.nonce.toString()
          },
          spender: signatureData.permit.spender,
          sigDeadline: signatureData.permit.sigDeadline.toString()
        },
        signature: signatureData.signature,
        currentTimestamp: Math.floor(Date.now() / 1000)
      })

      // enterRaffleWithPermit2実行
      const hash = await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: RaffleABI,
        functionName: 'enterRaffleWithPermit2',
        args: [signatureData.permit, signatureData.signature]
      })

      console.log(`🚀 Transaction submitted with hash: ${hash}`)
      console.log('⏳ Waiting for transaction confirmation...')

      // トランザクションレシートを待機して実際の成功/失敗を確認
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash,
        timeout: 60_000 // 60秒でタイムアウト
      })

      console.log(`📋 Transaction receipt:`, {
        status: receipt.status,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice?.toString()
      })

      if (receipt.status === 'reverted') {
        throw new Error('トランザクションが失敗しました。ブロックエクスプローラーで詳細を確認してください。')
      }

      // 成功後はキャッシュをクリア
      setPermit2Data(null)

      return { success: true, hash }
    } catch (error: any) {
      console.error('Failed to enter raffle with Permit2:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        data: error.data,
        cause: error.cause,
        shortMessage: error.shortMessage,
        reason: error.reason,
        details: error.details,
        metaMessages: error.metaMessages,
        stack: error.stack
      })
      
      let errorMessage: string
      if (isPermit2Error(error)) {
        errorMessage = translatePermit2Error(error)
      } else if (error.message?.includes('User rejected') || error.message?.includes('rejected')) {
        errorMessage = 'ユーザーが署名をキャンセルしました'
      } else if (error.details) {
        // Viemの詳細エラー情報を確認
        errorMessage = `コントラクトエラー: ${error.details}`
      } else if (error.shortMessage) {
        errorMessage = `ラッフル参加に失敗しました: ${error.shortMessage}`
      } else if (error.reason) {
        errorMessage = `コントラクトエラー: ${error.reason}`
      } else if (error.data?.message) {
        errorMessage = `実行エラー: ${error.data.message}`
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
   * USDCをPermit2に許可
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
      
      console.log('🔓 Approving USDC to Permit2:', {
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

      console.log('✅ USDC approve transaction successful:', hash)
      return { success: true, hash }

    } catch (error: any) {
      console.error('Failed to approve USDC to Permit2:', error)
      
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
   * 改善されたラッフル参加フロー（許可チェック込み）
   */
  const enterRaffleWithOptimizedFlow = useCallback(async (): Promise<Permit2RaffleResult> => {
    if (!address || !contractAddress || !publicClient) {
      return { success: false, error: 'Required dependencies not available' }
    }

    try {
      setIsLoading(true)
      setError(null)

      // 事前チェック
      const isAvailable = await checkPermit2Availability()
      if (!isAvailable) {
        throw new Error('Permit2がこのネットワークで利用できません')
      }

      // すでに参加しているかチェック
      console.log('🔍 Checking if player already entered...')
      const alreadyEntered = await checkPlayerEntered()
      console.log(`🎯 Player already entered: ${alreadyEntered}`)
      if (alreadyEntered) {
        throw new Error('すでにこのラッフルに参加しています')
      }

      // USDC残高とPermit2許可状況をチェック
      const allowanceStatus = await checkUSDCAllowanceAndBalance()
      if (!allowanceStatus) {
        throw new Error('USDC残高とPermit2許可状況の確認に失敗しました')
      }

      if (!allowanceStatus.hasEnoughBalance) {
        throw new Error(`USDC残高が不足しています。必要: ${(Number(entranceFeeData) / 1e6).toFixed(2)} USDC, 現在: ${(Number(allowanceStatus.balance) / 1e6).toFixed(2)} USDC`)
      }

      // Permit2許可が不足している場合は自動的に許可
      if (!allowanceStatus.hasPermit2Allowance) {
        console.log('🔄 Permit2許可が不足しています。自動的に許可します...')
        
        const approveResult = await approveUSDCToPermit2()
        if (!approveResult.success) {
          throw new Error(approveResult.error || 'USDC許可に失敗しました')
        }

        console.log('✅ Permit2許可が完了しました。ラッフル参加を続行します...')
        
        // 許可完了後、少し待機して状態を更新
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      // Permit2署名生成
      let signatureData = permit2Data
      if (!signatureData) {
        signatureData = await generatePermit2Signature()
        if (!signatureData) {
          throw new Error('署名生成に失敗しました')
        }
      }

      // デバッグ用：Permit2パラメータをログ出力
      console.log('🔍 Permit2 Parameters:', {
        contractAddress,
        erc20Address,
        entranceFee: entranceFeeData?.toString(),
        permit: {
          details: {
            token: signatureData.permit.details.token,
            amount: signatureData.permit.details.amount.toString(),
            expiration: signatureData.permit.details.expiration.toString(),
            nonce: signatureData.permit.details.nonce.toString()
          },
          spender: signatureData.permit.spender,
          sigDeadline: signatureData.permit.sigDeadline.toString()
        },
        signature: signatureData.signature,
        currentTimestamp: Math.floor(Date.now() / 1000)
      })

      // enterRaffleWithPermit2実行
      const hash = await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: RaffleABI,
        functionName: 'enterRaffleWithPermit2',
        args: [signatureData.permit, signatureData.signature]
      })

      console.log(`🚀 Transaction submitted with hash: ${hash}`)
      console.log('⏳ Waiting for transaction confirmation...')

      // トランザクションレシートを待機して実際の成功/失敗を確認
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash,
        timeout: 60_000 // 60秒でタイムアウト
      })

      console.log(`📋 Transaction receipt:`, {
        status: receipt.status,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice?.toString()
      })

      if (receipt.status === 'reverted') {
        throw new Error('トランザクションが失敗しました。ブロックエクスプローラーで詳細を確認してください。')
      }

      // 成功後はキャッシュをクリア
      setPermit2Data(null)

      return { success: true, hash }

    } catch (error: any) {
      console.error('Failed to enter raffle with optimized Permit2 flow:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        data: error.data,
        cause: error.cause,
        shortMessage: error.shortMessage,
        reason: error.reason,
        stack: error.stack
      })
      
      let errorMessage: string
      if (isPermit2Error(error)) {
        errorMessage = translatePermit2Error(error)
      } else if (error.message?.includes('User rejected') || error.message?.includes('rejected')) {
        errorMessage = 'ユーザーが署名をキャンセルしました'
      } else if (error.details) {
        // Viemの詳細エラー情報を確認
        errorMessage = `コントラクトエラー: ${error.details}`
      } else if (error.shortMessage) {
        errorMessage = `ラッフル参加に失敗しました: ${error.shortMessage}`
      } else if (error.reason) {
        errorMessage = `コントラクトエラー: ${error.reason}`
      } else if (error.data?.message) {
        errorMessage = `実行エラー: ${error.data.message}`
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
    checkUSDCAllowanceAndBalance,
    approveUSDCToPermit2,
    permit2Data,
    generatePermit2Signature,
    writeContractAsync,
    contractAddress,
    erc20Address,
    entranceFeeData
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
    enterRaffleWithPermit2,
    enterRaffleWithOptimizedFlow, // 新しい改善されたフロー
    preparePermit2Signature,
    generatePermit2Signature,
    checkPermit2Availability,
    approveUSDCToPermit2, // 許可機能
    
    // 状態管理
    isLoading,
    error,
    permit2Data,
    
    // ユーティリティ
    clearPermit2Cache,
    checkPlayerEntered,
    checkUSDCAllowanceAndBalance,
    
    // 計算された値
    isPermit2Ready: !!permit2Data,
    entranceFee: entranceFeeData
  }
}