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
        uint256 subscriptionId;
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
        } else if (block.chainid == 421614) {
            activeNetworkConfig = getArbitrumSepoliaConfig();
        } else if (block.chainid == 84532) {
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
            vrfCoordinatorV2: 0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B, // VRF 2.5のコーディネーターアドレス
            subscriptionId: 35215710747108285885424679702400045098207236400821432776421763953481952749017,
            keyHash: 0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae,
            callbackGasLimit: 500000,
            entranceFee: 10 * 1e6, // 10 USDC (6 decimals)
            usdcAddress: 0x74ce1e12998fB861A612CD6C65244f8620e2937A, // Sepolia USDC
            ccipRouter: 0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59 // Sepolia CCIP Router
        });
    }

    /**
     * @notice Arbitrum Sepolia設定を取得する関数
     */
    function getArbitrumSepoliaConfig() public pure returns (NetworkConfig memory) {
        return NetworkConfig({
            vrfCoordinatorV2: 0x5CE8D5A2BC84beb22a398CCA51996F7930313D61, // Arbitrum Sepolia VRF 2.5
            subscriptionId: 101240342784025722467677436226156457361476948824878688464903340927284469428368, // 実際のサブスクリプションIDに更新する必要あり
            keyHash: 0x1770bdc7eec7771f7ba4ffd640f34260d7f095b79c92d34a5b2551d6f6cfd2be,
            callbackGasLimit: 500000,
            entranceFee: 10 * 1e6, // 10 USDC (6 decimals)
            usdcAddress: 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d, // Arbitrum Sepolia USDC
            ccipRouter: 0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165 // Arbitrum Sepolia CCIP Router
        });
    }

    /**
     * @notice Base Sepolia設定を取得する関数
     */
    function getBaseSepoliaConfig() public pure returns (NetworkConfig memory) {
        return NetworkConfig({
            vrfCoordinatorV2: 0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE, // Base Sepolia VRF 2.5
            subscriptionId: 33458206399445572067715640330168096614526430692290839248425322519759385655642, // 実際のサブスクリプションIDに更新する必要あり
            keyHash: 0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71,
            callbackGasLimit: 500000,
            entranceFee: 10 * 1e6, // 10 USDC (6 decimals)
            usdcAddress: 0x036CbD53842c5426634e7929541eC2318f3dCF7e, // Base Sepolia USDC
            ccipRouter: 0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93 // Base Sepolia CCIP Router
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
        MockVRFCoordinatorV2_5 vrfCoordinatorV2Mock = new MockVRFCoordinatorV2_5();
        
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
 * @title MockVRFCoordinatorV2_5
 * @notice テスト用のVRFコーディネーターモック (VRF 2.5対応)
 */
contract MockVRFCoordinatorV2_5 {
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
        // 2つのランダムワードを生成（ジャックポット判定用に2つ必要）
        uint256[] memory randomWords = new uint256[](2);
        randomWords[0] = uint256(keccak256(abi.encode(requestId, block.timestamp)));
        randomWords[1] = uint256(keccak256(abi.encode(requestId, block.timestamp, blockhash(block.number))));
        
        // rawFulfillRandomWords関数を呼び出す
        (bool success, ) = callback.call(
            abi.encodeWithSignature("rawFulfillRandomWords(uint256,uint256[])", requestId, randomWords)
        );
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
        uint256 indexed destinationChainSelector,
        address sender,
        bytes receiver,
        bytes data
    );

    // モック用カウンター
    uint256 private messageIdCounter;

    function getFee(
        uint256 destinationChainSelector,
        EVM2AnyMessage memory message
    ) external view returns (uint256) {
        // 簡略化のためハードコードした手数料を返す
        return 0.01 ether;
    }

    function ccipSend(
        uint256 destinationChainSelector,
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