// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/** ****************************************************************************
 * @notice VRFコンシューマー向けのインターフェース
 * ****************************************************************************
 * @dev このコントラクトは、VRFコーディネーターからのコールバックを受け取るために実装されています。
 */
abstract contract VRFConsumerBaseV2 {
    error OnlyCoordinatorCanFulfill(address have, address want);
    address private immutable vrfCoordinator;

    /**
     * @param _vrfCoordinator VRFコーディネーターのアドレス
     */
    constructor(address _vrfCoordinator) {
        vrfCoordinator = _vrfCoordinator;
    }

    /**
     * @notice VRFコーディネーターがフルフィルメントで呼び出すコールバック関数
     * @dev コンシューマーに実装される必要があります
     * @param requestId リクエストID
     * @param randomWords 生成された乱数
     */
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal virtual;

    /**
     * @notice VRFコーディネーターによって呼び出されるコールバックの実装
     * @param requestId リクエストID
     * @param randomWords 生成された乱数
     */
    function rawFulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external {
        if (msg.sender != vrfCoordinator) {
            revert OnlyCoordinatorCanFulfill(msg.sender, vrfCoordinator);
        }
        fulfillRandomWords(requestId, randomWords);
    }
}
