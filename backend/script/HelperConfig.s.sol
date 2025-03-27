// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Script} from "forge-std/Script.sol";

/**
 * @title HelperConfig
 * @notice テストネットワーク用の設定を提供するヘルパースクリプト
 */
contract HelperConfig is Script {
    struct NetworkConfig {
        address vrfCoordinatorV2;
        uint64 subscriptionId;
        bytes32 keyHash;
        uint32 callbackGasLimit;
        uint256 entranceFee;
        address usdcAddress;
        address ccipRouter;
    }

    uint256 public constant DEFAULT_ANVIL_PRIVATE_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    NetworkConfig public activeNetworkConfig;

    /**
     * @notice コンストラクタ - 適切なテストネットワーク設定を選択
     */
    constructor() {
        if (block.chainid == 11155111) {
            activeNetworkConfig = getSepoliaConfig();
        } else if (block.chainid == 80001) {
            activeNetworkConfig = getPolygonMumbaiConfig();
        } else if (block.chainid == 421613) {
            activeNetworkConfig = getArbitrumSepoliaConfig();
        } else if (block.chainid == 420) {
            activeNetworkConfig = getOptimismGoerliConfig();
        } else if (block.chainid == 84531) {
            activeNetworkConfig = getBaseSepoliaConfig();
        } else {
            activeNetworkConfig = getOrCreateAnvilEthConfig();
        }
    }

    /**
     * @notice Ethereum Sepolia設定を取得する関数
     */
    function getSepoliaConfig() public pure returns (NetworkConfig memory) {
        return NetworkConfig({
            vrfCoordinatorV2: 0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625,
            subscriptionId: 0,  // 適切なIDに置き換える必要あり
            keyHash: 0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c,
            callbackGasLimit: 500000,
            entranceFee: 10 * 1e6, // 10 USDC (6 decimals)
            usdcAddress: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238, // Sepolia USDC
            ccipRouter: 0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59 // Sepolia CCIP Router
        });
    }

    /**
     * @notice Polygon Mumbai設定を取得する関数
     */
    function getPolygonMumbaiConfig() public pure returns (NetworkConfig memory) {
        return NetworkConfig({
            vrfCoordinatorV2: 0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed,
            subscriptionId: 0,  // 適切なIDに置き換える必要あり
            keyHash: 0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f,
            callbackGasLimit: 500000,
            entranceFee: 10 * 1e6, // 10 USDC (6 decimals)
            usdcAddress: 0xe11A86849d99F524cAc3E7A0Ec1241828e332C62, // Mumbai USDC
            ccipRouter: 0x70499c328e1E2a3c41108bd3730F6670a44595d1 // Mumbai CCIP Router
        });
    }

    /**
     * @notice Arbitrum Sepolia設定を取得する関数
     */
    function getArbitrumSepoliaConfig() public pure returns (NetworkConfig memory) {
        return NetworkConfig({
            vrfCoordinatorV2: 0x50d47e4142598E3411aA864e08a44284e471AC6b,
            subscriptionId: 0,  // 適切なIDに置き換える必要あり
            keyHash: 0x027f94ff1465b3525f9fc03e7775f2e5fdecb70rarb974f61ffce645b6f115ae,
            callbackGasLimit: 500000,
            entranceFee: 10 * 1e6, // 10 USDC (6 decimals)
            usdcAddress: 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d, // Arbitrum Sepolia USDC
            ccipRouter: 0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165 // Arbitrum Sepolia CCIP Router
        });
    }

    /**
     * @notice Optimism Goerli設定を取得する関数
     */
    function getOptimismGoerliConfig() public pure returns (NetworkConfig memory) {
        return NetworkConfig({
            vrfCoordinatorV2: 0xB9c51146a152648195F5e2C0A2CDA6B8e306138B,
            subscriptionId: 0,  // 適切なIDに置き換える必要あり
            keyHash: 0x252bc3f4ba2089c44a7789fd17f30e0c4aab9c2798271a1dca379f0a8b5048ce,
            callbackGasLimit: 500000,
            entranceFee: 10 * 1e6, // 10 USDC (6 decimals)
            usdcAddress: 0x7E07E15D2a87A24492740D16f5bdF58c16db0c4E, // Optimism Goerli USDC
            ccipRouter: 0xEB52E9Ae4A9Fb37172978642d4C141ef53876f26 // Optimism Goerli CCIP Router
        });
    }

    /**
     * @notice Base Sepolia設定を取得する関数
     */
    function getBaseSepoliaConfig() public pure returns (NetworkConfig memory) {
        return NetworkConfig({
            vrfCoordinatorV2: 0xeb3F5079798A346F91F429d23D9aceb22Fc2F369, // Base Sepolia
            subscriptionId: 0,  // 適切なIDに置き換える必要あり
            keyHash: 0x8c7bdabb86a2870d9f72517b1c861c05e5afda42e51e5fed9a53bd33c0f0a84c,
            callbackGasLimit: 500000,
            entranceFee: 10 * 1e6, // 10 USDC (6 decimals)
            usdcAddress: 0xF175520C52418dfE19C8098071a252da48Cd1C19, // Base Sepolia USDC
            ccipRouter: 0xA8C0c11bf64AF62CDCA6f93D3769B88BdD7cb93D // Base Sepolia CCIP Router
        });
    }

    /**
     * @notice ローカルAnvil設定を作成する関数
     */
    function getOrCreateAnvilEthConfig() public returns (NetworkConfig memory) {
        // Anvilのローカルチェーンでない場合はSepoliaの設定を返す
        if (block.chainid != 31337) {
            return getSepoliaConfig();
        }

        // デプロイキーの設定
        vm.startBroadcast();

        // 仮のVRFコーディネーターをデプロイ
        MockVRFCoordinatorV2 vrfCoordinatorV2Mock = new MockVRFCoordinatorV2();
        
        // 仮のUSDCトークンをデプロイ
        MockERC20 mockUsdc = new MockERC20("USD Coin", "USDC", 6);
        
        // 仮のCCIPルーターをデプロイ
        MockCCIPRouter mockCcipRouter = new MockCCIPRouter();

        vm.stopBroadcast();

        // サブスクリプションを作成
        uint64 subscriptionId = vrfCoordinatorV2Mock.createSubscription();
        
        // コンシューマーをサブスクリプションに追加（実際のコントラクトデプロイ後に行う必要あり）
        // vrfCoordinatorV2Mock.addConsumer(subscriptionId, address(raffleContract));

        return NetworkConfig({
            vrfCoordinatorV2: address(vrfCoordinatorV2Mock),
            subscriptionId: subscriptionId,
            keyHash: 0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c, // ダミーのkeyHash
            callbackGasLimit: 500000,
            entranceFee: 10 * 1e6, // 10 USDC (6 decimals)
            usdcAddress: address(mockUsdc),
            ccipRouter: address(mockCcipRouter)
        });
    }
}

/**
 * @title MockVRFCoordinatorV2
 * @notice テスト用のVRFコーディネーターモック
 */
contract MockVRFCoordinatorV2 {
    uint96 public BASE_FEE = 0.25 ether; // 0.25 LINK
    uint96 public GAS_PRICE_LINK = 1e9; // 1 gwei LINK

    mapping(uint256 => address) public s_requests;
    mapping(uint64 => address) public s_subscriptions;
    uint64 private s_currentSubId;

    event RandomWordsRequested(
        bytes32 indexed keyHash,
        uint256 requestId,
        uint256 preSeed,
        uint64 indexed subId,
        uint16 minimumRequestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords,
        address indexed sender
    );

    event RandomWordsFulfilled(
        uint256 indexed requestId,
        uint256[] randomWords,
        uint256 payment
    );

    event SubscriptionCreated(uint64 indexed subId, address owner);
    event SubscriptionFunded(uint64 indexed subId, uint256 oldBalance, uint256 newBalance);
    
    function createSubscription() external returns (uint64) {
        s_currentSubId++;
        s_subscriptions[s_currentSubId] = msg.sender;
        emit SubscriptionCreated(s_currentSubId, msg.sender);
        return s_currentSubId;
    }

    function addConsumer(uint64 subId, address consumer) external {
        // 簡略化のため実装を省略
    }

    function removeConsumer(uint64 subId, address consumer) external {
        // 簡略化のため実装を省略
    }

    function requestRandomWords(
        bytes32 keyHash,
        uint64 subId,
        uint16 minimumRequestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords
    ) external returns (uint256) {
        uint256 requestId = uint256(keccak256(abi.encode(keyHash, subId, block.timestamp)));
        s_requests[requestId] = msg.sender;
        
        emit RandomWordsRequested(
            keyHash,
            requestId,
            uint256(blockhash(block.number - 1)),
            subId,
            minimumRequestConfirmations,
            callbackGasLimit,
            numWords,
            msg.sender
        );
        
        return requestId;
    }

    // テスト用のランダムワード生成
    function fulfillRandomWords(uint256 requestId, address callback) external {
        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = uint256(keccak256(abi.encode(requestId, block.timestamp)));
        
        (bool success, ) = callback.call(abi.encodeWithSignature("rawFulfillRandomWords(uint256,uint256[])", requestId, randomWords));
        require(success, "Callback failed");
        
        emit RandomWordsFulfilled(requestId, randomWords, 0);
    }
}

/**
 * @title MockERC20
 * @notice テスト用のERC20トークンモック
 */
contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    
    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        
        // デプロイヤーに初期供給を付与
        totalSupply = 1000000 * 10**uint256(_decimals);
        balanceOf[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }
    
    function transfer(address to, uint256 amount) public returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    
    function approve(address spender, uint256 amount) public returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        require(allowance[from][msg.sender] >= amount, "ERC20: insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
    
    // テスト用のミント関数
    function mint(address to, uint256 amount) public {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }
}

/**
 * @title MockCCIPRouter
 * @notice テスト用のCCIPルーターモック
 */
contract MockCCIPRouter {
    struct EVMTokenAmount {
        address token;
        uint256 amount;
    }

    struct EVM2AnyMessage {
        bytes receiver;
        bytes data;
        EVMTokenAmount[] tokenAmounts;
        address feeToken;
        bytes extraArgs;
    }

    event MessageSent(
        bytes32 indexed messageId,
        uint64 indexed destinationChainSelector,
        address sender,
        bytes receiver,
        bytes data
    );

    // モック用カウンター
    uint256 private messageIdCounter;

    function getFee(
        uint64 destinationChainSelector,
        EVM2AnyMessage memory message
    ) external view returns (uint256) {
        // 簡略化のためハードコードした手数料を返す
        return 0.01 ether;
    }

    function ccipSend(
        uint64 destinationChainSelector,
        EVM2AnyMessage calldata message
    ) external payable returns (bytes32) {
        // メッセージIDを生成
        bytes32 messageId = bytes32(keccak256(abi.encode(messageIdCounter++, msg.sender, block.timestamp)));
        
        emit MessageSent(
            messageId,
            destinationChainSelector,
            msg.sender,
            message.receiver,
            message.data
        );
        
        return messageId;
    }
}
