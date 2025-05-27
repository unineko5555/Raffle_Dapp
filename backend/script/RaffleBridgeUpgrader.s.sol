// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Script} from "forge-std/Script.sol";
import {RaffleBridgeImplementation} from "../src/RaffleBridgeImplementation.sol";
import {RaffleBridgeProxy} from "../src/RaffleBridgeProxy.sol";
import {console} from "forge-std/console.sol";

/**
 * @title RaffleBridgeUpgrader
 * @notice RaffleBridgeの実装をアップグレードするスクリプト
 * @dev プロキシの実装アドレスを更新するために使用
 */
contract RaffleBridgeUpgrader is Script {
    function run() external {
        // 環境変数からプロキシアドレスを取得
        address proxyAddress = vm.envAddress("BRIDGE_PROXY_ADDRESS");
        
        console.log("Upgrading RaffleBridge at proxy:", proxyAddress);
        
        // アップグレード前の実装アドレスを確認
        RaffleBridgeProxy proxy = RaffleBridgeProxy(payable(proxyAddress));
        address oldImplementation = proxy.implementation();
        console.log("Old implementation address:", oldImplementation);
        
        // ブロードキャストの開始
        vm.startBroadcast();
        
        // 1. 新しい実装コントラクトのデプロイ
        RaffleBridgeImplementation newImplementation = new RaffleBridgeImplementation();
        address newImplementationAddress = address(newImplementation);
        console.log("New implementation deployed at:", newImplementationAddress);
        
        // 2. プロキシのアップグレード
        proxy.upgradeTo(newImplementationAddress);
        
        console.log("Proxy upgraded successfully!");
        
        // ブロードキャストの終了
        vm.stopBroadcast();
        
        // JavaScript取得用の特別なログ出力
        console.log("=== UPGRADE_RESULT ===");
        console.log("PROXY_ADDRESS:", proxyAddress);
        console.log("NEW_IMPLEMENTATION_ADDRESS:", newImplementationAddress);
        console.log("OLD_IMPLEMENTATION_ADDRESS:", oldImplementation);
        console.log("=== END_UPGRADE_RESULT ===");
        
        // アップグレード結果を確認
        address currentImplementation = proxy.implementation();
        console.log("\n==== Upgrade Summary ====");
        console.log("Proxy address:", proxyAddress);
        console.log("Old implementation:", oldImplementation);
        console.log("New implementation deployed:", newImplementationAddress);
        console.log("Current implementation (should match new):", currentImplementation);
        console.log("Admin address:", proxy.admin());
        
        // 検証: 実装アドレスが正しく更新されたかチェック
        require(currentImplementation == newImplementationAddress, "Implementation upgrade failed!");
        console.log("\n[SUCCESS] Implementation upgrade verified successfully!");
        console.log("==========================\n");
        
        // 新しい実装の関数が利用可能かテスト（実装インターフェースにキャスト）
        RaffleBridgeImplementation bridgeImpl = RaffleBridgeImplementation(payable(address(proxy)));
        try bridgeImpl.getDefaultRouter() {
            console.log("[SUCCESS] Default router function accessible");
        } catch {
            console.log("[WARNING] Default router function not accessible");
        }
        
        // CCIPルーター承認チェック関数のテスト
        try bridgeImpl.getRouterAllowance(msg.sender, 10344971235874465080) {
            console.log("[SUCCESS] New getRouterAllowance function accessible");
        } catch {
            console.log("[WARNING] getRouterAllowance function not accessible");
        }
    }
    
    /**
     * @notice データを伴うアップグレードを実行
     * @dev 新しい実装への移行時に追加の設定が必要な場合に使用
     */
    function upgradeWithData() external {
        // 環境変数からプロキシアドレスを取得
        address proxyAddress = vm.envAddress("BRIDGE_PROXY_ADDRESS");
        
        console.log("Upgrading RaffleBridge with data at proxy:", proxyAddress);
        
        // アップグレード前の実装アドレスを確認
        RaffleBridgeProxy proxy = RaffleBridgeProxy(payable(proxyAddress));
        address oldImplementation = proxy.implementation();
        console.log("Old implementation address:", oldImplementation);
        
        // ブロードキャストの開始
        vm.startBroadcast();
        
        // 1. 新しい実装コントラクトのデプロイ
        RaffleBridgeImplementation newImplementation = new RaffleBridgeImplementation();
        address newImplementationAddress = address(newImplementation);
        console.log("New implementation deployed at:", newImplementationAddress);
        
        // 2. 移行用のデータを準備（例：新しいパラメータの設定）
        // ここでは空のデータを使用していますが、必要に応じて構造化されたデータを渡すことができます
        bytes memory data = "";
        
        // 3. プロキシのアップグレードとデータの実行
        proxy.upgradeToAndCall(newImplementationAddress, data);
        
        console.log("Proxy upgraded with data successfully!");
        
        // ブロードキャストの終了
        vm.stopBroadcast();
        
        // JavaScript取得用の特別なログ出力
        console.log("=== UPGRADE_RESULT ===");
        console.log("PROXY_ADDRESS:", proxyAddress);
        console.log("NEW_IMPLEMENTATION_ADDRESS:", newImplementationAddress);
        console.log("OLD_IMPLEMENTATION_ADDRESS:", oldImplementation);
        console.log("=== END_UPGRADE_RESULT ===");
        
        // アップグレード結果を確認
        address currentImplementation = proxy.implementation();
        console.log("\n==== Upgrade Summary ====");
        console.log("Proxy address:", proxyAddress);
        console.log("Old implementation:", oldImplementation);
        console.log("New implementation deployed:", newImplementationAddress);
        console.log("Current implementation (should match new):", currentImplementation);
        console.log("Admin address:", proxy.admin());
        
        // 検証: 実装アドレスが正しく更新されたかチェック
        require(currentImplementation == newImplementationAddress, "Implementation upgrade failed!");
        console.log("==========================\n");
    }
}
