// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {RaffleImplementation} from "../src/RaffleImplementation.sol";
import {RaffleProxy} from "../src/RaffleProxy.sol";
import {HelperConfig} from "./HelperConfig.s.sol";
import {IMockRandomProvider} from "../src/mocks/MockVRFProvider.sol";

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
            address mockVRFProvider,
            bool useMockVRF,
            bool nativePayment
        ) = helperConfig.activeNetworkConfig();

        console.log("VRF Coordinator: ", vrfCoordinatorV2);
        console.log("Subscription ID: ", subscriptionId);
        // console.log("Key Hash: ", keyHash); // keyHashはbytes32型なのでconsole.logで出力できない
        console.log("Callback Gas Limit: ", callbackGasLimit);
        console.log("Entrance Fee: ", entranceFee);
        console.log("USDC Address: ", usdcAddress);
        console.log("Mock VRF Provider: ", mockVRFProvider);
        console.log("Use Mock VRF: ", useMockVRF);
        console.log("Native Payment: ", nativePayment);

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
            false, // addMockPlayers: 初期は0人、管理パネルから手動追加
            mockVRFProvider,
            useMockVRF,
            nativePayment
        );

        // プロキシコントラクトのデプロイ
        RaffleProxy proxy = new RaffleProxy(
            address(implementation),
            initData
        );
        console.log("Proxy deployed at: ", address(proxy));

        // MockVRFを使用する場合、プロキシアドレスをMockVRFプロバイダーに認証する
        if (useMockVRF && mockVRFProvider != address(0)) {
            console.log("Setting up MockVRF authorization...");
            
            try IMockRandomProvider(mockVRFProvider).authorizeCaller(address(proxy)) {
                console.log("Successfully authorized proxy in MockVRF provider");
                
                // プロキシ経由でMockVRF設定を有効化
                (bool success, ) = address(proxy).call(
                    abi.encodeWithSelector(RaffleImplementation.setMockVRF.selector, mockVRFProvider, true)
                );
                require(success, "Failed to enable MockVRF on proxy");
                console.log("MockVRF enabled on proxy contract");
                
            } catch Error(string memory reason) {
                console.log("MockVRF authorization failed:", reason);
                console.log("You may need to manually authorize the proxy later");
            } catch {
                console.log("MockVRF authorization failed with low-level error");
                console.log("You may need to manually authorize the proxy later");
            }
        }

        vm.stopBroadcast();

        // コントラクトのインスタンスを返す
        return (implementation, proxy, helperConfig);
    }
}
