// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Script} from "forge-std/Script.sol";
import {RaffleImplementation} from "../src/RaffleImplementation.sol";
import {RaffleProxy} from "../src/RaffleProxy.sol";
import {console} from "forge-std/console.sol";

/**
 * @title RaffleUpgrader
 * @notice Raffleの実装をアップグレードするスクリプト
 * @dev プロキシの実装アドレスを更新するために使用
 */
contract RaffleUpgrader is Script {
    function run() external {
        // 環境変数からプロキシアドレスを取得
        address proxyAddress = vm.envAddress("RAFFLE_PROXY_ADDRESS");
        
        console.log("Upgrading Raffle at proxy:", proxyAddress);
        
        // チェーンIDに基づいてVRFコーディネーターアドレスを取得
        address vrfCoordinatorV2;
        
        if (block.chainid == 11155111) { // Sepolia
            vrfCoordinatorV2 = 0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B;
        } else if (block.chainid == 84532) { // Base Sepolia
            vrfCoordinatorV2 = 0x5CE8D5A2BC84beb22a398CCA51996F7930313D61;
        } else if (block.chainid == 421614) { // Arbitrum Sepolia
            vrfCoordinatorV2 = 0x5CE8D5A2BC84beb22a398CCA51996F7930313D61;
        } else {
            revert("Unsupported network");
        }
        
        // ブロードキャストの開始
        vm.startBroadcast();
        
        // 1. 新しい実装コントラクトのデプロイ（正しいVRFコーディネーターアドレスを使用）
        RaffleImplementation newImplementation = new RaffleImplementation();
        console.log("New implementation deployed at:", address(newImplementation));
        
        // 2. プロキシのアップグレード
        RaffleProxy proxy = RaffleProxy(payable(proxyAddress));
        proxy.upgradeTo(address(newImplementation));
        
        console.log("Proxy upgraded successfully!");
        
        // ブロードキャストの終了
        vm.stopBroadcast();
        
        // アップグレード結果を確認
        console.log("\n==== Upgrade Summary ====");
        console.log("Proxy address:", proxyAddress);
        console.log("New implementation address:", address(newImplementation));
        console.log("Current implementation:", proxy.implementation());
        console.log("Admin address:", proxy.admin());
        console.log("==========================\n");
    }
    
    /**
     * @notice データを伴うアップグレードを実行
     * @dev 新しい実装への移行時に追加の設定が必要な場合に使用
     */
    function upgradeWithData() external {
        // 環境変数からプロキシアドレスを取得
        address proxyAddress = vm.envAddress("RAFFLE_PROXY_ADDRESS");
        
        console.log("Upgrading Raffle with data at proxy:", proxyAddress);
        
        // チェーンIDに基づいてVRFコーディネーターアドレスを取得
        address vrfCoordinatorV2;
        
        if (block.chainid == 11155111) { // Sepolia
            vrfCoordinatorV2 = 0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B;
        } else if (block.chainid == 84532) { // Base Sepolia
            vrfCoordinatorV2 = 0x5CE8D5A2BC84beb22a398CCA51996F7930313D61;
        } else if (block.chainid == 421614) { // Arbitrum Sepolia
            vrfCoordinatorV2 = 0x5CE8D5A2BC84beb22a398CCA51996F7930313D61;
        } else {
            revert("Unsupported network");
        }
        
        // ブロードキャストの開始
        vm.startBroadcast();
        
        // 1. 新しい実装コントラクトのデプロイ（正しいVRFコーディネーターアドレスを使用）
        RaffleImplementation newImplementation = new RaffleImplementation();
        console.log("New implementation deployed at:", address(newImplementation));
        
        // 2. 移行用のデータを準備（setNativePaymentを呼び出し）
        // LINK支払いを使用（false）に設定（オーナーチェックなしに変更済み）
        bytes memory data = abi.encodeWithSignature("setNativePayment(bool)", false);
        
        // 3. プロキシのアップグレードとデータの実行
        RaffleProxy proxy = RaffleProxy(payable(proxyAddress));
        proxy.upgradeToAndCall(address(newImplementation), data);
        
        console.log("Proxy upgraded with data successfully!");
        
        // ブロードキャストの終了
        vm.stopBroadcast();
        
        // アップグレード結果を確認
        console.log("\n==== Upgrade Summary ====");
        console.log("Proxy address:", proxyAddress);
        console.log("New implementation address:", address(newImplementation));
        console.log("Current implementation:", proxy.implementation());
        console.log("Admin address:", proxy.admin());
        console.log("==========================\n");
    }
}
