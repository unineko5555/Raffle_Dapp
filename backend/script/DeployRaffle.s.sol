// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Script} from "forge-std/Script.sol";
import {RaffleImplementation} from "../src/RaffleImplementation.sol";
import {RaffleProxy} from "../src/RaffleProxy.sol";
import {HelperConfig} from "./HelperConfig.s.sol";

/**
 * @title DeployRaffle
 * @notice ラッフルコントラクトとプロキシをデプロイするスクリプト
 */
contract DeployRaffle is Script {
    function run() external returns (RaffleImplementation, RaffleProxy, HelperConfig) {
        HelperConfig helperConfig = new HelperConfig();
        (
            address vrfCoordinatorV2,
            uint256 subscriptionId,
            bytes32 keyHash,
            uint32 callbackGasLimit,
            uint256 entranceFee,
            address usdcAddress,
            address ccipRouter
        ) = helperConfig.activeNetworkConfig();

        // デプロイトランザクションの開始
        vm.startBroadcast();

        // 実装コントラクトのデプロイ
        RaffleImplementation implementation = new RaffleImplementation();

        // 初期化データの準備
        bytes memory initData = abi.encodeWithSelector(
            RaffleImplementation.initialize.selector,
            vrfCoordinatorV2,
            subscriptionId,
            keyHash,
            callbackGasLimit,
            entranceFee,
            usdcAddress,
            ccipRouter,
            true  // addMockPlayers: テスト用にモックプレイヤーを2人追加
        );

        // プロキシコントラクトのデプロイ
        RaffleProxy proxy = new RaffleProxy(
            address(implementation),
            initData
        );

        vm.stopBroadcast();

        // コントラクトのインスタンスを返す
        return (implementation, proxy, helperConfig);
    }
}
