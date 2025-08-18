import { parseErc6492Signature, getContract } from 'viem'
import type { Address, PublicClient } from 'viem'

export const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3' as const

export interface PermitDetails {
  token: Address
  amount: bigint
  expiration: bigint
  nonce: bigint
}

export interface PermitSingle {
  details: PermitDetails
  spender: Address
  sigDeadline: bigint
}

export interface Permit2SignatureData {
  permit: PermitSingle
  signature: `0x${string}`
}

export interface SignatureTransferDetails {
  to: Address
  requestedAmount: bigint
}

/**
 * Permit2管理クラス
 * EOAとスマートウォレット両方に対応したPermit2操作を提供
 */
export class Permit2Manager {
  constructor(
    private publicClient: PublicClient,
    private currentChainId: number
  ) {}

  /**
   * ウォレットタイプの検出
   * @param address チェック対象のアドレス
   * @returns 'eoa' | 'smart'
   */
  async detectWalletType(address: Address): Promise<'eoa' | 'smart'> {
    try {
      const bytecode = await this.publicClient.getBytecode({ address })
      return bytecode === '0x' || !bytecode ? 'eoa' : 'smart'
    } catch (error) {
      console.warn('Failed to detect wallet type, defaulting to EOA:', error)
      return 'eoa'
    }
  }

  /**
   * Permit2のnonceを取得
   * @param owner トークン所有者のアドレス
   * @param token トークンアドレス
   * @param spender spenderアドレス
   * @returns 現在のnonce値
   */
  async getPermit2Nonce(
    owner: Address,
    token: Address,
    spender: Address
  ): Promise<bigint> {
    try {
      // Permit2コントラクトのallowance関数を呼び出してnonceを取得
      const result = await this.publicClient.readContract({
        address: PERMIT2_ADDRESS,
        abi: [
          {
            name: 'allowance',
            type: 'function',
            stateMutability: 'view',
            inputs: [
              { name: 'user', type: 'address' },
              { name: 'token', type: 'address' },
              { name: 'spender', type: 'address' }
            ],
            outputs: [
              { name: 'amount', type: 'uint160' },
              { name: 'expiration', type: 'uint48' },
              { name: 'nonce', type: 'uint48' }
            ]
          }
        ],
        functionName: 'allowance',
        args: [owner, token, spender]
      }) as [bigint, bigint, bigint]

      return result[2] // nonce
    } catch (error) {
      console.warn('Failed to get Permit2 nonce, using 0:', error)
      return BigInt(0)
    }
  }

  /**
   * Permit2署名を生成
   * @param token トークンアドレス
   * @param amount 許可する金額
   * @param spender spenderアドレス
   * @param owner トークン所有者アドレス
   * @param signTypedDataAsync 署名関数
   * @returns Permit2署名データ
   */
  async generatePermit2Signature(
    token: Address,
    amount: bigint,
    spender: Address,
    owner: Address,
    signTypedDataAsync: any
  ): Promise<Permit2SignatureData> {
    try {
      // nonceを取得
      const nonce = await this.getPermit2Nonce(owner, token, spender)
      
      // 1時間後の有効期限
      const expiration = BigInt(Math.floor(Date.now() / 1000) + 3600)
      // 30分後の署名有効期限
      const sigDeadline = BigInt(Math.floor(Date.now() / 1000) + 1800)

      const permit: PermitSingle = {
        details: {
          token,
          amount,
          expiration,
          nonce
        },
        spender,
        sigDeadline
      }

      // EIP-712ドメイン
      const domain = {
        name: 'Permit2',
        chainId: this.currentChainId,
        verifyingContract: PERMIT2_ADDRESS
      }

      // EIP-712タイプ定義
      const types = {
        PermitSingle: [
          { name: 'details', type: 'PermitDetails' },
          { name: 'spender', type: 'address' },
          { name: 'sigDeadline', type: 'uint256' }
        ],
        PermitDetails: [
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'expiration', type: 'uint256' },
          { name: 'nonce', type: 'uint256' }
        ]
      }

      // 署名実行
      const signature = await signTypedDataAsync({
        domain,
        types,
        primaryType: 'PermitSingle' as const,
        message: permit
      })

      return { permit, signature }
    } catch (error) {
      console.error('Failed to generate Permit2 signature:', error)
      throw new Error(`Permit2署名生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * ERC-6492プリデプロイ署名の処理
   * @param signature 元の署名
   * @returns 処理済み署名
   */
  async handlePreDeploySignature(signature: `0x${string}`): Promise<`0x${string}`> {
    try {
      // ERC-6492署名かどうかをチェック
      const magicBytes = '0x6492649264926492649264926492649264926492649264926492649264926492'
      
      if (signature.endsWith(magicBytes.slice(2))) {
        // ERC-6492署名の場合、パースして実際の署名部分を抽出
        const parsed = parseErc6492Signature(signature)
        return parsed.signature
      }
      
      // 通常の署名はそのまま返す
      return signature
    } catch (error) {
      console.warn('Failed to parse ERC-6492 signature, using original:', error)
      return signature
    }
  }

  /**
   * Permit2が利用可能かチェック
   * @returns Permit2の利用可能性
   */
  async isPermit2Available(): Promise<boolean> {
    try {
      // Permit2コントラクトのDOMAIN_SEPARATORを呼び出してみる
      await this.publicClient.readContract({
        address: PERMIT2_ADDRESS,
        abi: [
          {
            name: 'DOMAIN_SEPARATOR',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ name: '', type: 'bytes32' }]
          }
        ],
        functionName: 'DOMAIN_SEPARATOR'
      })
      return true
    } catch (error) {
      console.warn('Permit2 not available on this network:', error)
      return false
    }
  }

  /**
   * ユーザーの現在のPermit2許可状態を取得
   * @param owner トークン所有者
   * @param token トークンアドレス
   * @param spender spenderアドレス
   * @returns 許可状態 {amount, expiration, nonce}
   */
  async getCurrentAllowance(
    owner: Address,
    token: Address,
    spender: Address
  ): Promise<{ amount: bigint; expiration: bigint; nonce: bigint } | null> {
    try {
      const result = await this.publicClient.readContract({
        address: PERMIT2_ADDRESS,
        abi: [
          {
            name: 'allowance',
            type: 'function',
            stateMutability: 'view',
            inputs: [
              { name: 'user', type: 'address' },
              { name: 'token', type: 'address' },
              { name: 'spender', type: 'address' }
            ],
            outputs: [
              { name: 'amount', type: 'uint160' },
              { name: 'expiration', type: 'uint48' },
              { name: 'nonce', type: 'uint48' }
            ]
          }
        ],
        functionName: 'allowance',
        args: [owner, token, spender]
      }) as [bigint, bigint, bigint]

      return {
        amount: result[0],
        expiration: result[1],
        nonce: result[2]
      }
    } catch (error) {
      console.error('Failed to get current allowance:', error)
      return null
    }
  }
}

/**
 * Permit2エラーハンドリング用のユーティリティ関数
 */
export function isPermit2Error(error: any): boolean {
  if (!error?.message) return false
  
  const permit2ErrorMessages = [
    'InvalidAmount',
    'AllowanceExpired',
    'InsufficientAllowance',
    'InvalidNonce',
    'InvalidSignature',
    'InvalidSigner',
    'SignatureExpired'
  ]
  
  return permit2ErrorMessages.some(msg => 
    error.message.includes(msg)
  )
}

/**
 * Permit2エラーメッセージを日本語に変換
 */
export function translatePermit2Error(error: any): string {
  if (!error?.message) return '不明なエラーが発生しました'
  
  const message = error.message
  
  if (message.includes('InvalidAmount')) {
    return '許可金額が無効です'
  }
  if (message.includes('AllowanceExpired')) {
    return '許可の有効期限が切れています'
  }
  if (message.includes('InsufficientAllowance')) {
    return '許可金額が不足しています'
  }
  if (message.includes('InvalidNonce')) {
    return '無効なnonceです'
  }
  if (message.includes('InvalidSignature')) {
    return '署名が無効です'
  }
  if (message.includes('InvalidSigner')) {
    return '署名者が無効です'
  }
  if (message.includes('SignatureExpired')) {
    return '署名の有効期限が切れています'
  }
  if (message.includes('User rejected') || message.includes('rejected')) {
    return 'ユーザーが署名をキャンセルしました'
  }
  
  return `Permit2エラー: ${message}`
}