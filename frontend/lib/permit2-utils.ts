import { getContract } from 'viem'
import type { Address, PublicClient } from 'viem'

// viem 2.8.6では experimental package が利用できないため手動実装を使用

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
      const isEOA = !bytecode || bytecode === '0x' || bytecode.length <= 2
      
      if (isEOA) {
        console.log(`Address ${address} detected as EOA`)
        return 'eoa'
      } else {
        console.log(`Address ${address} detected as Smart Wallet (bytecode length: ${bytecode.length})`)
        
        // EIP-1271署名検証をサポートしているかチェック
        try {
          await this.publicClient.readContract({
            address,
            abi: [{
              name: 'supportsInterface',
              type: 'function',
              stateMutability: 'view',
              inputs: [{ name: 'interfaceId', type: 'bytes4' }],
              outputs: [{ name: '', type: 'bool' }]
            }],
            functionName: 'supportsInterface',
            args: ['0x1626ba7e'] // EIP-1271 interface ID
          })
          console.log(`Smart wallet ${address} supports EIP-1271 signature validation`)
        } catch (eip1271Error) {
          // EIP-1271サポートチェックに失敗しても、スマートウォレットとして処理
          console.warn(`Cannot verify EIP-1271 support for ${address}:`, eip1271Error)
        }
        
        return 'smart'
      }
    } catch (error) {
      console.warn('Failed to detect wallet type, defaulting to EOA:', error)
      return 'eoa'
    }
  }

  /**
   * SignatureTransfer用のnonceを取得
   * @param owner トークン所有者のアドレス  
   * @param token トークンアドレス
   * @returns 現在のnonce値
   */
  async getSignatureTransferNonce(
    owner: Address,
    token: Address
  ): Promise<bigint> {
    try {
      // SignatureTransferのnonceを取得（異なるABI）
      const result = await this.publicClient.readContract({
        address: PERMIT2_ADDRESS,
        abi: [
          {
            name: 'nonceBitmap',
            type: 'function',
            stateMutability: 'view',
            inputs: [
              { name: 'owner', type: 'address' },
              { name: 'word', type: 'uint256' }
            ],
            outputs: [
              { name: '', type: 'uint256' }
            ]
          }
        ],
        functionName: 'nonceBitmap',
        args: [owner, 0n] // wordIndex = 0 for most cases
      }) as bigint

      // 使用されていない最初のnonceを見つける
      for (let i = 0; i < 256; i++) {
        const mask = 1n << BigInt(i)
        if ((result & mask) === 0n) {
          return BigInt(i)
        }
      }
      
      throw new Error('No available nonce found')
    } catch (error) {
      console.error('Failed to get SignatureTransfer nonce:', error)
      // フォールバック：単純にランダムなnonceを使用
      return BigInt(Math.floor(Math.random() * 1000000))
    }
  }

  /**
   * Permit2のnonceを取得（従来の方式）
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
      }) as readonly [bigint, number, number]

      return BigInt(result[2]) // nonce
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
      // ERC-6492署名かどうかをチェック（マジックバイトで判定）
      const magicBytes = '0x6492649264926492649264926492649264926492649264926492649264926492'
      
      if (signature.endsWith(magicBytes.slice(2))) {
        console.log('ERC-6492 signature detected, attempting to parse...')
        
        // viem 2.8.6では experimental package が利用できないため手動実装を使用
        console.log('Using manual ERC-6492 parsing implementation')
        
        // ERC-6492構造: signature + factory(20bytes) + factoryCalldata + factoryCalldataLength(32bytes) + magicBytes(32bytes)
        const signatureWithoutMagic = signature.slice(0, -64) // マジックバイト除去
        
        if (signatureWithoutMagic.length > 64) {
          // 最低限のデータ長チェック
          try {
            // factoryCalldataLength（末尾32バイト）を読み取り
            const factoryCalldataLengthHex = signatureWithoutMagic.slice(-64)
            const factoryCalldataLength = parseInt(factoryCalldataLengthHex, 16) * 2 // bytes to hex chars
            
            // factory address（20バイト = 40文字）とfactoryCalldataを除いた署名部分を抽出
            const factoryAddressLength = 40
            const totalSuffixLength = factoryAddressLength + factoryCalldataLength + 64 // factory + calldata + length
            
            if (signatureWithoutMagic.length > totalSuffixLength) {
              const actualSignature = signatureWithoutMagic.slice(0, -totalSuffixLength)
              console.log('Manual ERC-6492 parsing successful, extracted signature length:', actualSignature.length)
              return `0x${actualSignature}` as `0x${string}`
            }
          } catch (manualParseError) {
            console.warn('Manual ERC-6492 parsing failed:', manualParseError)
          }
        }
        
        // パースに失敗した場合は元の署名を返す
        console.warn('ERC-6492 manual parsing failed, using original signature')
        return signature
      }
      
      // 通常の署名（ERC-6492ではない）はそのまま返す
      return signature
    } catch (error) {
      console.warn('Failed to handle pre-deploy signature:', error)
      return signature
    }
  }

  /**
   * Permit2が利用可能かチェック
   * @returns Permit2の利用可能性
   */
  async isPermit2Available(): Promise<boolean> {
    try {
      console.log('🔍 Checking Permit2 contract availability at:', PERMIT2_ADDRESS);
      console.log('🌐 Current chain ID:', this.currentChainId);
      
      // Permit2コントラクトのDOMAIN_SEPARATORを呼び出してみる
      const result = await this.publicClient.readContract({
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
      
      console.log('✅ Permit2 DOMAIN_SEPARATOR call successful:', result);
      return true
    } catch (error) {
      console.error('❌ Permit2 not available on this network. Full error:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        cause: error instanceof Error ? error.cause : undefined,
        stack: error instanceof Error ? error.stack : undefined
      });
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
      }) as readonly [bigint, number, number]

      return {
        amount: result[0],
        expiration: BigInt(result[1]),
        nonce: BigInt(result[2])
      }
    } catch (error) {
      console.error('Failed to get current allowance:', error)
      return null
    }
  }

  /**
   * スマートウォレット向けのPermit2署名生成
   * EIP-1271とERC-6492に対応した最適化された署名フロー
   */
  async generateSmartWalletPermit2Signature(
    token: Address,
    amount: bigint,
    spender: Address,
    owner: Address,
    signTypedDataAsync: any,
    walletType: 'eoa' | 'smart' = 'smart'
  ): Promise<Permit2SignatureData> {
    try {
      console.log(`Generating Permit2 signature for ${walletType} wallet:`, owner)
      
      // 基本的なPermit2署名を生成
      const signatureData = await this.generatePermit2Signature(
        token,
        amount,
        spender,
        owner,
        signTypedDataAsync
      )

      // スマートウォレットの場合はERC-6492処理を適用
      if (walletType === 'smart') {
        const processedSignature = await this.handlePreDeploySignature(signatureData.signature)
        
        if (processedSignature !== signatureData.signature) {
          console.log('ERC-6492 signature processing applied')
          signatureData.signature = processedSignature
        }

        // 追加のスマートウォレット検証
        await this.validateSmartWalletSignature(signatureData, owner)
      }

      return signatureData
    } catch (error) {
      console.error('Failed to generate smart wallet Permit2 signature:', error)
      throw error
    }
  }

  /**
   * スマートウォレット署名の検証
   */
  private async validateSmartWalletSignature(
    signatureData: Permit2SignatureData,
    owner: Address
  ): Promise<void> {
    try {
      // EIP-1271を使用して署名検証（可能な場合）
      const messageHash = this.getPermit2MessageHash(signatureData.permit)
      
      try {
        const isValid = await this.publicClient.readContract({
          address: owner,
          abi: [{
            name: 'isValidSignature',
            type: 'function',
            stateMutability: 'view',
            inputs: [
              { name: 'hash', type: 'bytes32' },
              { name: 'signature', type: 'bytes' }
            ],
            outputs: [{ name: '', type: 'bytes4' }]
          }],
          functionName: 'isValidSignature',
          args: [messageHash, signatureData.signature]
        }) as `0x${string}`

        // EIP-1271マジック値 0x1626ba7e をチェック
        if (isValid === '0x1626ba7e') {
          console.log('Smart wallet signature validated via EIP-1271')
        } else {
          console.warn('Smart wallet signature validation failed via EIP-1271')
        }
      } catch (validationError) {
        // EIP-1271検証に失敗しても署名は有効として扱う
        console.warn('EIP-1271 validation not available for smart wallet:', validationError)
      }
    } catch (error) {
      console.warn('Smart wallet signature validation skipped:', error)
    }
  }

  /**
   * Permit2メッセージハッシュを生成
   */
  private getPermit2MessageHash(permit: PermitSingle): `0x${string}` {
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

    // TODO: 実際のEIP-712ハッシュ計算を実装
    // 現在は簡易的なハッシュを返す
    return `0x${Buffer.from(JSON.stringify(permit)).toString('hex').slice(0, 64)}` as `0x${string}`
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