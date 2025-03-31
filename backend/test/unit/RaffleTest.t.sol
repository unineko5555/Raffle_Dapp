// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Test, console} from "forge-std/Test.sol";
import {DeployRaffle} from "../../script/DeployRaffle.s.sol";
import {RaffleImplementation} from "../../src/RaffleImplementation.sol";
import {RaffleProxy} from "../../src/RaffleProxy.sol";
import {HelperConfig} from "../../script/HelperConfig.s.sol";
import {IERC20} from "../../src/interfaces/IERC20.sol";
import {IRaffle} from "../../src/interfaces/IRaffle.sol";

/**
 * @title RaffleTest
 * @notice ラッフルコントラクトのユニットテスト
 */
contract RaffleTest is Test {
    // イベント定義
    event RaffleEnter(address indexed player, uint256 entranceFee);
    event WinnerPicked(address indexed winner, uint256 prize, bool isJackpot);
    event RaffleStateChanged(IRaffle.RaffleState newState);
    event CrossChainMessageSent(uint256 indexed destinationChainSelector, bytes32 indexed messageId);

    // テスト用変数
    RaffleImplementation public raffleImplementation;
    RaffleProxy public raffleProxy;
    HelperConfig public helperConfig;
    address public vrfCoordinatorV2;
    uint256 public subscriptionId;
    bytes32 public keyHash;
    uint32 public callbackGasLimit;
    uint256 public entranceFee;
    address public usdcAddress;
    address public ccipRouter;

    // テストアドレス
    address public USER = makeAddr("user");
    address public USER2 = makeAddr("user2");
    address public USER3 = makeAddr("user3");
    uint256 public constant STARTING_USER_BALANCE = 10 ether;
    uint256 public constant STARTING_USDC_BALANCE = 1000 * 1e6; // 1000 USDC

    function setUp() public {
        DeployRaffle deployer = new DeployRaffle();
        (raffleImplementation, raffleProxy, helperConfig) = deployer.run();

        // HelperConfigから値を取得
        (
            vrfCoordinatorV2,
            subscriptionId,
            keyHash,
            callbackGasLimit,
            entranceFee,
            usdcAddress,
            ccipRouter
        ) = helperConfig.activeNetworkConfig();

        // プロキシを通してラッフルコントラクトにアクセス
        RaffleImplementation raffle = RaffleImplementation(payable(address(raffleProxy)));

        // テストユーザーにETHとUSDCを付与
        vm.deal(USER, STARTING_USER_BALANCE);
        vm.deal(USER2, STARTING_USER_BALANCE);
        vm.deal(USER3, STARTING_USER_BALANCE);

        // テスト用のUSDCを付与
        MockERC20(usdcAddress).mint(USER, STARTING_USDC_BALANCE);
        MockERC20(usdcAddress).mint(USER2, STARTING_USDC_BALANCE);
        MockERC20(usdcAddress).mint(USER3, STARTING_USDC_BALANCE);
    }

    /**
     * @notice コンストラクタが正しく初期化されていることを確認するテスト
     */
     //test pass
    function testRaffleInitializesInOpenState() public view {
        IRaffle raffle = IRaffle(address(raffleProxy));
        IRaffle.RaffleState raffleState = raffle.getRaffleState();
        assert(raffleState == IRaffle.RaffleState.OPEN);
    }

    /**
     * @notice エントリー料金が正しいことを確認するテスト
     */
     //test pass
    function testEntranceFeeIsCorrect() public view {
        IRaffle raffle = IRaffle(address(raffleProxy));
        uint256 fee = raffle.getEntranceFee();
        assertEq(fee, entranceFee);
    }

    /**
     * @notice ラッフル参加が正しく機能することを確認するテスト
     */
     //test pass
    function testCanEnterRaffle() public {
        IRaffle raffle = IRaffle(address(raffleProxy));
        IERC20 usdc = IERC20(usdcAddress);

        // USERがラッフルに参加
        vm.startPrank(USER);
        usdc.approve(address(raffleProxy), entranceFee);
        
        // イベントが発火することを確認
        vm.expectEmit(true, false, false, true);
        emit RaffleEnter(USER, entranceFee);
        
        raffle.enterRaffle();
        vm.stopPrank();

        // プレイヤー数が1であることを確認
        assertEq(raffle.getNumberOfPlayers(), 1);
    }

    /**
     * @notice ラッフルの状態がOPEN以外の場合に参加できないことを確認するテスト
     */
     //test pass
    function testCantEnterWhenRaffleIsNotOpen() public {
        IRaffle raffle = IRaffle(address(raffleProxy));
        IERC20 usdc = IERC20(usdcAddress);

        // 3人のプレイヤーをラッフルに参加させる
        vm.startPrank(USER);
        usdc.approve(address(raffleProxy), entranceFee);
        raffle.enterRaffle();
        vm.stopPrank();

        vm.startPrank(USER2);
        usdc.approve(address(raffleProxy), entranceFee);
        raffle.enterRaffle();
        vm.stopPrank();

        vm.startPrank(USER3);
        usdc.approve(address(raffleProxy), entranceFee);
        raffle.enterRaffle();
        vm.stopPrank();

        // 1分経過させる
        vm.warp(block.timestamp + 61 seconds);

        // checkUpkeepが真を返すことを確認
        (bool upkeepNeeded, ) = raffle.checkUpkeep("");
        assertTrue(upkeepNeeded);

        // performUpkeepを呼び出し
        vm.prank(USER);
        raffle.performUpkeep("");

        // CALCULATING_WINNER状態でラッフルに参加しようとすると失敗する
        vm.startPrank(USER);
        usdc.approve(address(raffleProxy), entranceFee);
        vm.expectRevert("Raffle is not open");
        raffle.enterRaffle();
        vm.stopPrank();
    }

    /**
     * @notice checkUpkeepが適切な条件を満たした場合のみtrueを返すことを確認するテスト
     */
     //test pass
    function testCheckUpkeepReturnsFalseWhenConditionsAreNotMet() public {
        IRaffle raffle = IRaffle(address(raffleProxy));
        
        // 条件1: プレイヤーが0人
        (bool upkeepNeeded, ) = raffle.checkUpkeep("");
        assertFalse(upkeepNeeded);

        // 条件2: プレイヤーが3人未満
        IERC20 usdc = IERC20(usdcAddress);
        vm.startPrank(USER);
        usdc.approve(address(raffleProxy), entranceFee);
        raffle.enterRaffle();
        vm.stopPrank();

        (upkeepNeeded, ) = raffle.checkUpkeep("");
        assertFalse(upkeepNeeded);

        // 条件3: 十分な時間が経過していない
        vm.startPrank(USER2);
        usdc.approve(address(raffleProxy), entranceFee);
        raffle.enterRaffle();
        vm.stopPrank();

        vm.startPrank(USER3);
        usdc.approve(address(raffleProxy), entranceFee);
        raffle.enterRaffle();
        vm.stopPrank();

        // 時間が経過していない場合
        (upkeepNeeded, ) = raffle.checkUpkeep("");
        assertFalse(upkeepNeeded);

        // 条件を満たす場合: 3人が参加し、1分以上経過
        vm.warp(block.timestamp + 61 seconds);
        (upkeepNeeded, ) = raffle.checkUpkeep("");
        assertTrue(upkeepNeeded);
    }

    /**
     * @notice performUpkeepが適切に機能することを確認するテスト
     */
     //test pass
    function testPerformUpkeep() public {
        IRaffle raffle = IRaffle(address(raffleProxy));
        IERC20 usdc = IERC20(usdcAddress);

        // 3人のプレイヤーをラッフルに参加させる
        vm.startPrank(USER);
        usdc.approve(address(raffleProxy), entranceFee);
        raffle.enterRaffle();
        vm.stopPrank();

        vm.startPrank(USER2);
        usdc.approve(address(raffleProxy), entranceFee);
        raffle.enterRaffle();
        vm.stopPrank();

        vm.startPrank(USER3);
        usdc.approve(address(raffleProxy), entranceFee);
        raffle.enterRaffle();
        vm.stopPrank();

        // 1分経過させる
        vm.warp(block.timestamp + 61 seconds);

        // イベントが発火することを確認
        vm.expectEmit(true, false, false, true);
        emit RaffleStateChanged(IRaffle.RaffleState.CALCULATING_WINNER);
        
        // performUpkeepを呼び出し
        vm.prank(USER);
        raffle.performUpkeep("");

        // 状態がCALCULATING_WINNERに変わることを確認
        assertEq(uint256(raffle.getRaffleState()), uint256(IRaffle.RaffleState.CALCULATING_WINNER));
    }

    /**
     * @notice fulfillRandomWordsが正しく機能することを確認するテスト
     */
     //chainlinkVRFの設定が必要
    function testFulfillRandomWords() public {
        IRaffle raffle = IRaffle(address(raffleProxy));
        IERC20 usdc = IERC20(usdcAddress);

        // 3人のプレイヤーをラッフルに参加させる
        vm.startPrank(USER);
        usdc.approve(address(raffleProxy), entranceFee);
        raffle.enterRaffle();
        vm.stopPrank();

        vm.startPrank(USER2);
        usdc.approve(address(raffleProxy), entranceFee);
        raffle.enterRaffle();
        vm.stopPrank();

        vm.startPrank(USER3);
        usdc.approve(address(raffleProxy), entranceFee);
        raffle.enterRaffle();
        vm.stopPrank();

        // 1分経過させる
        vm.warp(block.timestamp + 61 seconds);

        // performUpkeepを呼び出し
        vm.prank(USER);
        raffle.performUpkeep("");

        // 最新のrequestIdを取得（モックのために固定値を使用）
        uint256 requestId = 1;

        // 当選者が選ばれたイベントが発火することを期待
        // 注: 実際のイベントパラメータはランダムなので正確には指定できない
        vm.expectEmit(true, false, false, false);
        emit WinnerPicked(address(0), 0, false);

        // ラッフル状態が変更されるイベントが発火することを期待
        vm.expectEmit(true, false, false, true);
        emit RaffleStateChanged(IRaffle.RaffleState.OPEN);

        // VRFコーディネーターをシミュレートしてランダムワードをフルフィル
        MockVRFCoordinatorV2(vrfCoordinatorV2).fulfillRandomWords(requestId, address(raffleProxy));

        // ラッフルの状態がOPENに戻っていることを確認
        assertEq(uint256(raffle.getRaffleState()), uint256(IRaffle.RaffleState.OPEN));
        
        // 最近の当選者が設定されていることを確認
        address recentWinner = raffle.getRecentWinner();
        assertTrue(recentWinner == USER || recentWinner == USER2 || recentWinner == USER3);
        
        // プレイヤーリストがリセットされていることを確認
        assertEq(raffle.getNumberOfPlayers(), 0);
    }

    /**
     * @notice クロスチェーンメッセージ送信機能をテスト
     */
     //CCIPの設定が必要
    function testSendCrossChainMessage() public {
        RaffleImplementation raffle = RaffleImplementation(payable(address(raffleProxy)));
        
        // オーナーとしてメッセージを送信
        uint256 destinationChainSelector = 1234;
        address winner = USER;
        uint256 prize = 100 * 1e6; // 100 USDC
        bool isJackpot = false;
        
        // ETHをプロキシに送信してCCIP手数料を支払えるようにする
        vm.deal(address(raffleProxy), 1 ether);
        
        // イベントが発火することを確認
        vm.expectEmit(true, true, false, false);
        emit CrossChainMessageSent(destinationChainSelector, bytes32(0));
        
        // オーナーとしてクロスチェーンメッセージを送信
        vm.prank(raffle.getOwner());
        raffle.sendCrossChainMessage(destinationChainSelector, winner, prize, isJackpot);
    }

    /**
     * @notice オーナーだけが特定の操作を実行できることを確認するテスト
     */
    function testOnlyOwnerCanWithdraw() public {
        RaffleImplementation raffle = RaffleImplementation(payable(address(raffleProxy)));
        
        // コントラクトにETHを送信
        vm.deal(address(raffleProxy), 1 ether);
        
        // 非オーナーとして引き出しを試みる
        vm.prank(USER);
        vm.expectRevert("Only owner can withdraw");
        raffle.withdraw(address(0));
        
        // オーナーとして引き出し
        address owner = raffle.getOwner();
        uint256 initialBalance = owner.balance;
        
        vm.prank(owner);
        raffle.withdraw(address(0));
        
        // 引き出し後の残高が増えていることを確認
        assertGt(owner.balance, initialBalance);
    }

    /**
     * @notice プロキシアップグレードが正しく機能することを確認するテスト
     */
     //test pass
    function testProxyUpgrade() public {
        // 新しい実装コントラクトをデプロイ
        vm.startBroadcast();
        RaffleImplementation newImplementation = new RaffleImplementation();
        vm.stopBroadcast();
        
        // 現在の実装を取得
        address currentImpl = raffleProxy.implementation();
        
        // オーナーとしてアップグレード
        vm.prank(raffleProxy.admin());
        raffleProxy.upgradeTo(address(newImplementation));
        
        // 新しい実装がセットされていることを確認
        address newImpl = raffleProxy.implementation();
        assertEq(newImpl, address(newImplementation));
        assertNotEq(newImpl, currentImpl);
    }

    /**
     * @notice ジャックポットシステムが正しく機能することを確認するテスト
     */
     //test pass
    function testJackpotSystem() public {
        IRaffle raffle = IRaffle(address(raffleProxy));
        IERC20 usdc = IERC20(usdcAddress);

        // 10人のプレイヤーをラッフルに参加させる（ジャックポットを増やす）
        for (uint i = 0; i < 5; i++) {
            address player = makeAddr(string(abi.encodePacked("player", i)));
            vm.deal(player, STARTING_USER_BALANCE);
            MockERC20(usdcAddress).mint(player, STARTING_USDC_BALANCE);
            
            vm.startPrank(player);
            usdc.approve(address(raffleProxy), entranceFee);
            raffle.enterRaffle();
            vm.stopPrank();
        }

        // 第1回目のラッフルを実行
        vm.warp(block.timestamp + 61 seconds);
        vm.prank(USER);
        raffle.performUpkeep("");
        
        uint256 requestId = 1;
        MockVRFCoordinatorV2(vrfCoordinatorV2).fulfillRandomWords(requestId, address(raffleProxy));

        // ジャックポット額を確認
        uint256 jackpotAmount = raffle.getJackpotAmount();
        assertGt(jackpotAmount, 0);
        
        // さらに3人のプレイヤーをラッフルに参加させる
        vm.startPrank(USER);
        usdc.approve(address(raffleProxy), entranceFee);
        raffle.enterRaffle();
        vm.stopPrank();

        vm.startPrank(USER2);
        usdc.approve(address(raffleProxy), entranceFee);
        raffle.enterRaffle();
        vm.stopPrank();

        vm.startPrank(USER3);
        usdc.approve(address(raffleProxy), entranceFee);
        raffle.enterRaffle();
        vm.stopPrank();

        // 第2回目のラッフルを実行
        vm.warp(block.timestamp + 61 seconds);
        vm.prank(USER);
        raffle.performUpkeep("");
        
        // ジャックポット額は以前より増加しているはず
        uint256 newJackpotAmount = raffle.getJackpotAmount();
        assertGt(newJackpotAmount, jackpotAmount);
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
        // 修正：テストではコントラクトが2つのランダム値を予期しているので、配列に2つの値を特定
        uint256[] memory randomWords = new uint256[](2);
        randomWords[0] = uint256(keccak256(abi.encode(requestId, block.timestamp)));
        randomWords[1] = uint256(keccak256(abi.encode(requestId, block.timestamp, blockhash(block.number))));
        
        // 修正: より単純な方法を試す
        bytes memory payload = abi.encodeWithSignature("rawFulfillRandomWords(uint256,uint256[])", requestId, randomWords);
        (bool success, bytes memory returnData) = callback.call(payload);
        
        if (!success) {
            if (returnData.length > 0) {
                // エラーメッセージを取得して出力
                assembly {
                    let returnDataSize := mload(returnData)
                    revert(add(32, returnData), returnDataSize)
                }
            } else {
                revert("Unknown error in callback");
            }
        }
        
        emit RandomWordsFulfilled(requestId, randomWords, 0);
    }
}
