// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * @title IPermit2
 * @notice Uniswap Permit2コントラクトのインターフェース
 * @dev メインネット: 0x000000000022D473030F116dDEE9F6B43aC78BA3
 */
interface IPermit2 {
    /**
     * @notice Permit2で使用される許可詳細構造体
     * @param token 許可対象のERC20トークンアドレス
     * @param amount 許可する金額
     * @param expiration 許可の有効期限（timestamp）
     * @param nonce 許可のnonce（リプレイ攻撃防止）
     */
    struct PermitDetails {
        address token;
        uint256 amount;
        uint256 expiration;
        uint256 nonce;
    }

    /**
     * @notice 単一許可の構造体
     * @param details 許可の詳細
     * @param spender 許可されたspenderアドレス
     * @param sigDeadline 署名の有効期限
     */
    struct PermitSingle {
        PermitDetails details;
        address spender;
        uint256 sigDeadline;
    }

    /**
     * @notice 署名による転送の詳細
     * @param to 転送先アドレス
     * @param requestedAmount 実際に転送する金額
     */
    struct SignatureTransferDetails {
        address to;
        uint256 requestedAmount;
    }

    /**
     * @notice バッチ許可の構造体
     * @param details 複数の許可詳細
     * @param spender 許可されたspenderアドレス
     * @param sigDeadline 署名の有効期限
     */
    struct PermitBatch {
        PermitDetails[] details;
        address spender;
        uint256 sigDeadline;
    }

    /**
     * @notice 許可状態の構造体
     * @param amount 許可されている金額
     * @param expiration 許可の有効期限
     * @param nonce 現在のnonce
     */
    struct PackedAllowance {
        uint160 amount;
        uint48 expiration;
        uint48 nonce;
    }

    /**
     * @notice 署名による単一トークンの転送
     * @param permit 許可の詳細
     * @param transferDetails 転送の詳細
     * @param owner トークンの所有者
     * @param signature EIP-712署名
     */
    function permitTransferFrom(
        PermitSingle memory permit,
        SignatureTransferDetails memory transferDetails,
        address owner,
        bytes memory signature
    ) external;

    /**
     * @notice 署名による複数トークンの転送
     * @param permit バッチ許可の詳細
     * @param transferDetails 複数の転送詳細
     * @param owner トークンの所有者
     * @param signature EIP-712署名
     */
    function permitTransferFrom(
        PermitBatch memory permit,
        SignatureTransferDetails[] memory transferDetails,
        address owner,
        bytes memory signature
    ) external;

    /**
     * @notice 許可状態の設定
     * @param owner トークンの所有者
     * @param permitSingle 単一許可の詳細
     * @param signature EIP-712署名
     */
    function permit(
        address owner,
        PermitSingle memory permitSingle,
        bytes memory signature
    ) external;

    /**
     * @notice バッチ許可状態の設定
     * @param owner トークンの所有者
     * @param permitBatch バッチ許可の詳細
     * @param signature EIP-712署名
     */
    function permit(
        address owner,
        PermitBatch memory permitBatch,
        bytes memory signature
    ) external;

    /**
     * @notice 現在の許可状態を取得
     * @param user トークンの所有者
     * @param token トークンアドレス
     * @param spender spenderアドレス
     * @return amount 許可されている金額
     * @return expiration 許可の有効期限
     * @return nonce 現在のnonce
     */
    function allowance(
        address user,
        address token,
        address spender
    ) external view returns (uint160 amount, uint48 expiration, uint48 nonce);

    /**
     * @notice EIP-712ドメインセパレーターを取得
     * @return ドメインセパレーター
     */
    function DOMAIN_SEPARATOR() external view returns (bytes32);

    // エラー定義
    error InvalidAmount(uint256 maxAmount);
    error LengthMismatch();
    error AllowanceExpired(uint256 deadline);
    error InsufficientAllowance(uint256 amount);
    error ExcessiveInvalidation();
    error InvalidNonce();
    error InvalidSignature();
    error InvalidSigner();
    error InvalidContractSignature();
    error SignatureExpired(uint256 signatureDeadline);
}