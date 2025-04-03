// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface VRFCoordinatorV2_5Interface {
  function requestRandomWords(
    bytes32 keyHash,
    uint64 subId,
    uint16 requestConfirmations,
    uint32 callbackGasLimit,
    uint32 numWords
  ) external returns (uint256 requestId);

  function getRequestConfig() external view returns (uint16, uint32, bytes32[] memory);

  function requestSubscriptionOwnerTransfer(uint64 subId, address newOwner) external;

  function acceptSubscriptionOwnerTransfer(uint64 subId) external;

  function createSubscription() external returns (uint64 subId);

  function addConsumer(uint64 subId, address consumer) external;

  function removeConsumer(uint64 subId, address consumer) external;

  function cancelSubscription(uint64 subId, address to) external;

  function getSubscription(uint64 subId) external view returns (
    uint96 balance,
    uint64 reqCount,
    address owner,
    address[] memory consumers
  );

  function pendingRequestExists(uint64 subId) external view returns (bool);
}