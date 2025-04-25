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
        
        // ブロードキャストの開始
        vm.startBroadcast();
        
        // 1. 新しい実装コントラクトのデプロイ
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
        
        // ブロードキャストの開始
        vm.startBroadcast();
        
        // 1. 新しい実装コントラクトのデプロイ
        RaffleImplementation newImplementation = new RaffleImplementation();
        console.log("New implementation deployed at:", address(newImplementation));
        
        // 2. 移行用のデータを準備（例：新しいパラメータの設定）
        // ここでは空のデータを使用していますが、必要に応じて構造化されたデータを渡すことができます
        bytes memory data = "";
        
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
