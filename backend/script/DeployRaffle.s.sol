// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
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

        console.log("VRF Coordinator: ", vrfCoordinatorV2);
        console.log("Subscription ID: ", subscriptionId);
        // console.log("Key Hash: ", keyHas); // keyHashはbytes32型なのでconsole.logで出力できない
        console.log("Callback Gas Limit: ", callbackGasLimit);
        console.log("Entrance Fee: ", entranceFee);
        console.log("USDC Address: ", usdcAddress);
        console.log("CCIP Router: ", ccipRouter);

        // デプロイトランザクションの開始
        vm.startBroadcast();

        // 実装コントラクトのデプロイ
        RaffleImplementation implementation = new RaffleImplementation();
        console.log("Implementation deployed at: ", address(implementation));

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
        console.log("Proxy deployed at: ", address(proxy));

        vm.stopBroadcast();

        // コントラクトのインスタンスを返す
        return (implementation, proxy, helperConfig);
    }
}
