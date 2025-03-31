// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * @title Chainlink CCIPインターフェース
 * @notice クロスチェーン通信プロトコルのためのインターフェース
 */
interface CCIPInterface {
    struct EVMTokenAmount {
        address token; // トークンアドレス
        uint256 amount; // トークンの量
    }

    struct Any2EVMMessage {
        bytes32 messageId; // メッセージID
        uint256 sourceChainSelector; // ソースチェーンセレクタ
        bytes sender; // 送信者
        bytes data; // 任意のデータ
        EVMTokenAmount[] tokenAmounts; // トークンの詳細
    }

    struct EVM2AnyMessage {
        bytes receiver; // 受信者
        bytes data; // 任意のデータ
        EVMTokenAmount[] tokenAmounts; // トークンの詳細
        address feeToken; // 手数料トークン
        bytes extraArgs; // 追加の引数
    }

    /**
     * @notice メッセージ送信のために必要な手数料を計算する関数
     * @param destinationChainSelector 宛先チェーンのセレクタ
     * @param message 送信するメッセージ
     * @return fee 必要な手数料
     */
    function getFee(
        uint256 destinationChainSelector,
        EVM2AnyMessage memory message
    ) external view returns (uint256 fee);

    /**
     * @notice クロスチェーンメッセージを送信する関数
     * @param destinationChainSelector 宛先チェーンのセレクタ
     * @param message 送信するメッセージ
     * @return messageId 作成されたメッセージID
     */
    function ccipSend(
        uint256 destinationChainSelector,
        EVM2AnyMessage calldata message
    ) external payable returns (bytes32 messageId);
}
