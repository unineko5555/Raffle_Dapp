// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Script} from "forge-std/Script.sol";
import {RaffleBridge} from "../src/RaffleBridge.sol";
import {console} from "forge-std/console.sol";

/**
 * @title RaffleBridgeDeployer
 * @notice RaffleBridgeコントラクトをデプロイするスクリプト
 * @dev Sepolia、Arbitrum Sepolia、Base Sepoliaにデプロイするために使用
 */
contract RaffleBridgeDeployer is Script {
    // デプロイ対象のチェーンID
    uint256 private constant SEPOLIA_CHAIN_ID = 11155111;
    uint256 private constant BASE_SEPOLIA_CHAIN_ID = 84532;
    uint256 private constant ARBITRUM_SEPOLIA_CHAIN_ID = 421614;

    // CCIP chain selectors
    uint64 private constant SEPOLIA_CHAIN_SELECTOR = 16015286601757825753;
    uint64 private constant BASE_SEPOLIA_CHAIN_SELECTOR = 10344971235874465080; 
    uint64 private constant ARBITRUM_SEPOLIA_CHAIN_SELECTOR = 3478487238524512106;

    // CCIP router addresses
    address private constant SEPOLIA_ROUTER = 0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59;
    address private constant BASE_SEPOLIA_ROUTER = 0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93;
    address private constant ARBITRUM_SEPOLIA_ROUTER = 0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165;

    // USDC addresses
    address private constant SEPOLIA_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address private constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address private constant ARBITRUM_SEPOLIA_USDC = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;

    // Pool threshold (10 USDC)
    uint256 private constant MINIMUM_POOL_THRESHOLD = 10 * 1e6;

    function run() external {
        // 現在のチェーンIDを取得
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        
        console.log("Current chain ID:", chainId);
        
        // 対応するルーター、USDC、その他のパラメータを設定
        address defaultRouter;
        address usdc;
        uint64[] memory supportedChainSelectors = new uint64[](2);
        address[] memory destinationBridgeContracts = new address[](2);
        string[] memory chainNames = new string[](2);
        
        // チェーン別ルーターアドレスとセレクタの設定
        address[] memory routerAddresses = new address[](3);
        uint64[] memory routerChainSelectors = new uint64[](3);
        
        // 全チェーンのルーターアドレスとセレクタを設定
        routerAddresses[0] = SEPOLIA_ROUTER;
        routerChainSelectors[0] = SEPOLIA_CHAIN_SELECTOR;
        
        routerAddresses[1] = BASE_SEPOLIA_ROUTER;
        routerChainSelectors[1] = BASE_SEPOLIA_CHAIN_SELECTOR;
        
        routerAddresses[2] = ARBITRUM_SEPOLIA_ROUTER;
        routerChainSelectors[2] = ARBITRUM_SEPOLIA_CHAIN_SELECTOR;
        
        if (chainId == SEPOLIA_CHAIN_ID) {
            defaultRouter = SEPOLIA_ROUTER;
            usdc = SEPOLIA_USDC;
            
            // Sepolia -> Arbitrum Sepolia, Base Sepolia
            supportedChainSelectors[0] = ARBITRUM_SEPOLIA_CHAIN_SELECTOR;
            supportedChainSelectors[1] = BASE_SEPOLIA_CHAIN_SELECTOR;
            
            // 宛先コントラクトアドレスは後で更新されるため、一時的にゼロアドレスを設定
            destinationBridgeContracts[0] = address(0);
            destinationBridgeContracts[1] = address(0);
            
            chainNames[0] = "Arbitrum Sepolia";
            chainNames[1] = "Base Sepolia";
        } 
        else if (chainId == BASE_SEPOLIA_CHAIN_ID) {
            defaultRouter = BASE_SEPOLIA_ROUTER;
            usdc = BASE_SEPOLIA_USDC;
            
            // Base Sepolia -> Sepolia, Arbitrum Sepolia
            supportedChainSelectors[0] = SEPOLIA_CHAIN_SELECTOR;
            supportedChainSelectors[1] = ARBITRUM_SEPOLIA_CHAIN_SELECTOR;
            
            destinationBridgeContracts[0] = address(0);
            destinationBridgeContracts[1] = address(0);
            
            chainNames[0] = "Ethereum Sepolia";
            chainNames[1] = "Arbitrum Sepolia";
        }
        else if (chainId == ARBITRUM_SEPOLIA_CHAIN_ID) {
            defaultRouter = ARBITRUM_SEPOLIA_ROUTER;
            usdc = ARBITRUM_SEPOLIA_USDC;
            
            // Arbitrum Sepolia -> Sepolia, Base Sepolia
            supportedChainSelectors[0] = SEPOLIA_CHAIN_SELECTOR;
            supportedChainSelectors[1] = BASE_SEPOLIA_CHAIN_SELECTOR;
            
            destinationBridgeContracts[0] = address(0);
            destinationBridgeContracts[1] = address(0);
            
            chainNames[0] = "Ethereum Sepolia";
            chainNames[1] = "Base Sepolia";
        }
        else {
            revert("Unsupported chain");
        }
        
        // 秘密鍵の取得
        // コマンドラインから--private-keyフラグで渡される秘密鍵を使用するため、
        // 環境変数からの読み込みは不要
        
        // ブロードキャストの開始
        vm.startBroadcast();
        
        // RaffleBridgeコントラクトのデプロイ
        RaffleBridge bridge = new RaffleBridge(
            defaultRouter,
            routerAddresses,
            routerChainSelectors,
            usdc,
            supportedChainSelectors,
            destinationBridgeContracts,
            chainNames,
            MINIMUM_POOL_THRESHOLD
        );
        
        console.log("RaffleBridge deployed at:", address(bridge));
        
        // ブロードキャストの終了
        vm.stopBroadcast();
    }
}
