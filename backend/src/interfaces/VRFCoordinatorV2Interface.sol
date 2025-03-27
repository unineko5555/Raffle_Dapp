// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface VRFCoordinatorV2Interface {
    /**
     * @notice 新しいサブスクリプションを作成する関数
     * @return subId サブスクリプションID
     */
    function createSubscription() external returns (uint64 subId);

    /**
     * @notice サブスクリプションをキャンセルする関数
     * @param subId サブスクリプションID
     */
    function cancelSubscription(uint64 subId, address to) external;

    /**
     * @notice サブスクリプションにコンシューマーを追加する関数
     * @param subId サブスクリプションID
     * @param consumer コンシューマーのアドレス
     */
    function addConsumer(uint64 subId, address consumer) external;

    /**
     * @notice サブスクリプションからコンシューマーを削除する関数
     * @param subId サブスクリプションID
     * @param consumer コンシューマーのアドレス
     */
    function removeConsumer(uint64 subId, address consumer) external;

    /**
     * @notice 乱数生成をリクエストする関数
     * @param subId サブスクリプションID
     * @param minimumRequestConfirmations 最小確認数
     * @param callbackGasLimit コールバック時のガスリミット
     * @param numWords 必要な乱数の数
     * @return requestId リクエストID
     */
    function requestRandomWords(
        bytes32 keyHash,
        uint64 subId,
        uint16 minimumRequestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords
    ) external returns (uint256 requestId);
}
