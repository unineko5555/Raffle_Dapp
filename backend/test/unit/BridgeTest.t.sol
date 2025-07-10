// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Test, console} from "forge-std/Test.sol";
import {RaffleBridgeImplementation} from "../../src/RaffleBridgeImplementation.sol";
import {RaffleBridgeProxy} from "../../src/RaffleBridgeProxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAny2EVMMessageReceiver} from "@chainlink/contracts/src/v0.8/ccip/interfaces/IAny2EVMMessageReceiver.sol";
import {Client} from "@chainlink/contracts/src/v0.8/ccip/libraries/Client.sol";
import {IRouterClient} from "@chainlink/contracts/src/v0.8/ccip/interfaces/IRouterClient.sol";

/**
 * @title BridgeTest
 * @notice CCIPブリッジコントラクトの包括的ユニットテスト（80%カバレッジ目標）
 */
contract BridgeTest is Test {
    // イベント定義
    event TokensBridged(
        address indexed sender,
        address indexed receiver,
        uint64 destinationChainSelector,
        uint256 amount,
        bytes32 messageId
    );
    
    event TokensReceived(
        uint64 sourceChainSelector,
        address indexed receiver,
        uint256 amount,
        bytes32 messageId
    );
    
    event PoolInitialized(uint256 amount);
    event PoolReplenished(uint256 amount);
    event LowPoolAlert(uint256 currentBalance, uint256 threshold);
    event RaffleAddressUpdated(address newRaffleAddress);
    event DefaultRouterUpdated(address indexed newRouter);
    event Upgraded(address indexed newImplementation);

    // テスト用変数
    RaffleBridgeImplementation public bridgeImplementation;
    RaffleBridgeProxy public bridgeProxy;
    MockCCIPRouter public mockRouter;
    MockERC20 public mockUSDC;
    
    // テストデータ
    address public OWNER = makeAddr("owner");
    address public USER = makeAddr("user");
    address public USER2 = makeAddr("user2");
    address public RECEIVER = makeAddr("receiver");
    address public MALICIOUS_USER = makeAddr("malicious");
    address public NEW_OWNER = makeAddr("new_owner");
    
    uint64 public constant SOURCE_CHAIN = 11155111; // Ethereum Sepolia
    uint64 public constant DEST_CHAIN = 84532; // Base Sepolia
    uint64 public constant DEST_CHAIN_2 = 421614; // Arbitrum Sepolia
    
    uint256 public constant STARTING_BALANCE = 10 ether;
    uint256 public constant STARTING_USDC = 1000 * 1e6; // 1000 USDC
    uint256 public constant BRIDGE_AMOUNT = 100 * 1e6; // 100 USDC
    uint256 public constant MIN_POOL_THRESHOLD = 50 * 1e6; // 50 USDC
    uint256 public constant POOL_INITIAL_AMOUNT = 500 * 1e6; // 500 USDC

    function setUp() public {
        vm.startPrank(OWNER);
        
        // Deploy mocks
        mockRouter = new MockCCIPRouter();
        mockUSDC = new MockERC20("Test USDC", "TUSDC", 6);
        
        // Deploy bridge implementation
        bridgeImplementation = new RaffleBridgeImplementation();
        
        // Deploy proxy
        bridgeProxy = new RaffleBridgeProxy(
            address(bridgeImplementation),
            ""
        );
        
        // Initialize bridge via proxy
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        // Prepare initialization parameters
        address[] memory routerAddresses = new address[](2);
        routerAddresses[0] = address(mockRouter);
        routerAddresses[1] = address(mockRouter);
        
        uint64[] memory routerChainSelectors = new uint64[](2);
        routerChainSelectors[0] = DEST_CHAIN;
        routerChainSelectors[1] = DEST_CHAIN_2;
        
        uint64[] memory supportedChainSelectors = new uint64[](2);
        supportedChainSelectors[0] = DEST_CHAIN;
        supportedChainSelectors[1] = DEST_CHAIN_2;
        
        address[] memory destinationBridgeContracts = new address[](2);
        destinationBridgeContracts[0] = address(0x1234567890123456789012345678901234567890);
        destinationBridgeContracts[1] = address(0x2345678901234567890123456789012345678901);
        
        string[] memory chainNames = new string[](2);
        chainNames[0] = "Base Sepolia";
        chainNames[1] = "Arbitrum Sepolia";
        
        bridge.initialize(
            address(mockRouter),
            routerAddresses,
            routerChainSelectors,
            address(mockUSDC),
            supportedChainSelectors,
            destinationBridgeContracts,
            chainNames,
            MIN_POOL_THRESHOLD
        );
        
        vm.stopPrank();
        
        // Setup test users
        setupTestUsers();
    }

    function setupTestUsers() internal {
        address[] memory users = new address[](5);
        users[0] = USER;
        users[1] = USER2;
        users[2] = RECEIVER;
        users[3] = MALICIOUS_USER;
        users[4] = NEW_OWNER;
        
        for (uint256 i = 0; i < users.length; i++) {
            vm.deal(users[i], STARTING_BALANCE);
            mockUSDC.mint(users[i], STARTING_USDC);
        }
        
        // Give owner more USDC for pool initialization
        mockUSDC.mint(OWNER, POOL_INITIAL_AMOUNT * 2);
    }

    /* ================= INITIALIZATION TESTS ================= */

    function testInitialization() public view {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        (
            address usdcAddress,
            address raffleAddress,
            address owner,
            uint256 minimumPoolThreshold
        ) = bridge.getInfo();
        
        assertEq(usdcAddress, address(mockUSDC));
        assertEq(owner, OWNER);
        assertEq(minimumPoolThreshold, MIN_POOL_THRESHOLD);
        assertEq(raffleAddress, address(0));
    }

    function testGetSupportedChainSelectors() public view {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        uint64[] memory selectors = bridge.getSupportedChainSelectors();
        
        assertEq(selectors.length, 2);
        assertEq(selectors[0], DEST_CHAIN);
        assertEq(selectors[1], DEST_CHAIN_2);
    }

    function testGetDestinationChainInfo() public view {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        (
            bool supported,
            string memory name,
            address bridgeContract,
            bool poolLow
        ) = bridge.getDestinationChainInfo(DEST_CHAIN);
        
        assertTrue(supported);
        assertEq(name, "Base Sepolia");
        assertEq(bridgeContract, address(0x1234567890123456789012345678901234567890));
        assertTrue(poolLow); // Should be low initially (no pool funds)
    }

    function testInitialPoolBalance() public view {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        uint256 poolBalance = bridge.getPoolBalance();
        assertEq(poolBalance, 0);
    }

    /* ================= POOL MANAGEMENT TESTS ================= */

    function testInitializePool() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        vm.startPrank(OWNER);
        mockUSDC.approve(address(bridgeProxy), POOL_INITIAL_AMOUNT);
        
        vm.expectEmit(false, false, false, true);
        emit PoolInitialized(POOL_INITIAL_AMOUNT);
        
        bridge.initializePool(POOL_INITIAL_AMOUNT);
        vm.stopPrank();
        
        assertEq(bridge.getPoolBalance(), POOL_INITIAL_AMOUNT);
    }

    function testOnlyOwnerCanInitializePool() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        vm.startPrank(MALICIOUS_USER);
        mockUSDC.approve(address(bridgeProxy), POOL_INITIAL_AMOUNT);
        
        vm.expectRevert("Only owner can call this function");
        bridge.initializePool(POOL_INITIAL_AMOUNT);
        vm.stopPrank();
    }

    function testReplenishPool() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        uint256 replenishAmount = 200 * 1e6;
        
        // First initialize pool
        vm.startPrank(OWNER);
        mockUSDC.approve(address(bridgeProxy), POOL_INITIAL_AMOUNT + replenishAmount);
        bridge.initializePool(POOL_INITIAL_AMOUNT);
        
        uint256 initialBalance = bridge.getPoolBalance();
        
        vm.expectEmit(false, false, false, true);
        emit PoolReplenished(replenishAmount);
        
        bridge.replenishPool(replenishAmount);
        vm.stopPrank();
        
        assertEq(bridge.getPoolBalance(), initialBalance + replenishAmount);
    }

    function testCannotInitializePoolWithZeroAmount() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        vm.startPrank(OWNER);
        vm.expectRevert("Amount must be greater than 0");
        bridge.initializePool(0);
        vm.stopPrank();
    }

    function testPoolInitializationUpdatesPoolStatus() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        // Initially pool should be low
        (, , , bool poolLowBefore) = bridge.getDestinationChainInfo(DEST_CHAIN);
        assertTrue(poolLowBefore);
        
        // Initialize pool with amount above threshold
        vm.startPrank(OWNER);
        mockUSDC.approve(address(bridgeProxy), POOL_INITIAL_AMOUNT);
        bridge.initializePool(POOL_INITIAL_AMOUNT);
        vm.stopPrank();
        
        // Pool should no longer be low
        (, , , bool poolLowAfter) = bridge.getDestinationChainInfo(DEST_CHAIN);
        assertFalse(poolLowAfter);
    }

    /* ================= BRIDGE FUNCTIONALITY TESTS ================= */

    function testBridgeTokensSuccess() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        // Initialize pool first
        vm.startPrank(OWNER);
        mockUSDC.approve(address(bridgeProxy), POOL_INITIAL_AMOUNT);
        bridge.initializePool(POOL_INITIAL_AMOUNT);
        vm.stopPrank();
        
        // User bridges tokens
        vm.startPrank(USER);
        mockUSDC.approve(address(bridgeProxy), BRIDGE_AMOUNT);
        
        uint256 initialUserBalance = mockUSDC.balanceOf(USER);
        uint256 initialPoolBalance = bridge.getPoolBalance();
        
        vm.expectEmit(true, true, false, false);
        emit TokensBridged(USER, RECEIVER, DEST_CHAIN, BRIDGE_AMOUNT, bytes32(0));
        
        bridge.bridgeTokens{value: 0.1 ether}(DEST_CHAIN, RECEIVER, BRIDGE_AMOUNT);
        vm.stopPrank();
        
        // Check balances
        assertEq(mockUSDC.balanceOf(USER), initialUserBalance - BRIDGE_AMOUNT);
        assertEq(bridge.getPoolBalance(), initialPoolBalance + BRIDGE_AMOUNT);
    }

    function testCannotBridgeWithoutApproval() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        vm.startPrank(USER);
        vm.expectRevert("Please approve bridge contract for USDC transfer");
        bridge.bridgeTokens{value: 0.1 ether}(DEST_CHAIN, RECEIVER, BRIDGE_AMOUNT);
        vm.stopPrank();
    }

    function testCannotBridgeWithInsufficientBalance() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        address poorUser = makeAddr("poor_user");
        vm.deal(poorUser, STARTING_BALANCE);
        
        vm.startPrank(poorUser);
        mockUSDC.approve(address(bridgeProxy), BRIDGE_AMOUNT);
        
        vm.expectRevert("Insufficient USDC balance");
        bridge.bridgeTokens{value: 0.1 ether}(DEST_CHAIN, RECEIVER, BRIDGE_AMOUNT);
        vm.stopPrank();
    }

    function testCannotBridgeToUnsupportedChain() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        uint64 unsupportedChain = 999999;
        
        vm.startPrank(USER);
        mockUSDC.approve(address(bridgeProxy), BRIDGE_AMOUNT);
        
        vm.expectRevert("Destination chain not supported");
        bridge.bridgeTokens{value: 0.1 ether}(unsupportedChain, RECEIVER, BRIDGE_AMOUNT);
        vm.stopPrank();
    }

    function testCannotBridgeWithZeroAmount() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        vm.startPrank(USER);
        vm.expectRevert("Amount must be greater than 0");
        bridge.bridgeTokens{value: 0.1 ether}(DEST_CHAIN, RECEIVER, 0);
        vm.stopPrank();
    }

    function testCannotBridgeToZeroAddress() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        vm.startPrank(USER);
        mockUSDC.approve(address(bridgeProxy), BRIDGE_AMOUNT);
        
        vm.expectRevert("Receiver cannot be zero address");
        bridge.bridgeTokens{value: 0.1 ether}(DEST_CHAIN, address(0), BRIDGE_AMOUNT);
        vm.stopPrank();
    }

    function testBridgeWithInsufficientFee() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        vm.startPrank(USER);
        mockUSDC.approve(address(bridgeProxy), BRIDGE_AMOUNT);
        
        vm.expectRevert("Insufficient fee for CCIP transaction");
        bridge.bridgeTokens{value: 0.001 ether}(DEST_CHAIN, RECEIVER, BRIDGE_AMOUNT);
        vm.stopPrank();
    }

    /* ================= CCIP RECEIVE TESTS ================= */

    function testCcipReceiveSuccess() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        // Initialize pool
        vm.startPrank(OWNER);
        mockUSDC.approve(address(bridgeProxy), POOL_INITIAL_AMOUNT);
        bridge.initializePool(POOL_INITIAL_AMOUNT);
        vm.stopPrank();
        
        // Prepare CCIP message
        bytes memory messageData = abi.encode(RECEIVER, BRIDGE_AMOUNT);
        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: bytes32(uint256(1)),
            sourceChainSelector: SOURCE_CHAIN,
            sender: abi.encode(address(0x1234)),
            data: messageData,
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });
        
        uint256 initialReceiverBalance = mockUSDC.balanceOf(RECEIVER);
        uint256 initialPoolBalance = bridge.getPoolBalance();
        
        vm.expectEmit(true, false, false, false);
        emit TokensReceived(SOURCE_CHAIN, RECEIVER, BRIDGE_AMOUNT, message.messageId);
        
        vm.prank(address(mockRouter));
        bridge.ccipReceive(message);
        
        // Check balances
        assertEq(mockUSDC.balanceOf(RECEIVER), initialReceiverBalance + BRIDGE_AMOUNT);
        assertEq(bridge.getPoolBalance(), initialPoolBalance - BRIDGE_AMOUNT);
    }

    function testOnlyRouterCanCallCcipReceive() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        bytes memory messageData = abi.encode(RECEIVER, BRIDGE_AMOUNT);
        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: bytes32(uint256(1)),
            sourceChainSelector: SOURCE_CHAIN,
            sender: abi.encode(address(0x1234)),
            data: messageData,
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });
        
        vm.expectRevert("Only router can call ccipReceive");
        vm.prank(MALICIOUS_USER);
        bridge.ccipReceive(message);
    }

    function testCcipReceiveWithInsufficientPool() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        // Don't initialize pool - should have 0 balance
        
        bytes memory messageData = abi.encode(RECEIVER, BRIDGE_AMOUNT);
        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: bytes32(uint256(1)),
            sourceChainSelector: SOURCE_CHAIN,
            sender: abi.encode(address(0x1234)),
            data: messageData,
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });
        
        vm.expectRevert("Insufficient pool balance");
        vm.prank(address(mockRouter));
        bridge.ccipReceive(message);
    }

    /* ================= OWNER FUNCTIONS TESTS ================= */

    function testSetRaffleAddress() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        address newRaffleAddress = makeAddr("new_raffle");
        
        vm.expectEmit(false, false, false, true);
        emit RaffleAddressUpdated(newRaffleAddress);
        
        vm.prank(OWNER);
        bridge.setRaffleAddress(newRaffleAddress);
        
        (, address raffleAddress, ,) = bridge.getInfo();
        assertEq(raffleAddress, newRaffleAddress);
    }

    function testOnlyOwnerCanSetRaffleAddress() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        address newRaffleAddress = makeAddr("new_raffle");
        
        vm.expectRevert("Only owner can call this function");
        vm.prank(MALICIOUS_USER);
        bridge.setRaffleAddress(newRaffleAddress);
    }

    function testCannotSetRaffleAddressToZero() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        vm.expectRevert("Raffle address cannot be zero address");
        vm.prank(OWNER);
        bridge.setRaffleAddress(address(0));
    }

    function testTransferOwnership() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        vm.prank(OWNER);
        bridge.transferOwnership(NEW_OWNER);
        
        (, , address owner,) = bridge.getInfo();
        assertEq(owner, NEW_OWNER);
    }

    function testOnlyOwnerCanTransferOwnership() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        vm.expectRevert("Only owner can call this function");
        vm.prank(MALICIOUS_USER);
        bridge.transferOwnership(NEW_OWNER);
    }

    function testCannotTransferOwnershipToZero() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        vm.expectRevert("New owner cannot be zero address");
        vm.prank(OWNER);
        bridge.transferOwnership(address(0));
    }

    function testSetMinimumPoolThreshold() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        uint256 newThreshold = 100 * 1e6;
        
        vm.prank(OWNER);
        bridge.setMinimumPoolThreshold(newThreshold);
        
        (, , , uint256 threshold) = bridge.getInfo();
        assertEq(threshold, newThreshold);
    }

    function testCannotSetZeroThreshold() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        vm.expectRevert("Threshold must be greater than 0");
        vm.prank(OWNER);
        bridge.setMinimumPoolThreshold(0);
    }

    function testSetDefaultRouter() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        address newRouter = makeAddr("new_router");
        
        vm.expectEmit(true, false, false, false);
        emit DefaultRouterUpdated(newRouter);
        
        vm.prank(OWNER);
        bridge.setDefaultRouter(newRouter);
        
        assertEq(bridge.getDefaultRouter(), newRouter);
    }

    function testUpdateDestinationBridgeContract() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        address newBridgeContract = makeAddr("new_bridge");
        
        vm.prank(OWNER);
        bridge.updateDestinationBridgeContract(DEST_CHAIN, newBridgeContract);
        
        (, , address bridgeContract,) = bridge.getDestinationChainInfo(DEST_CHAIN);
        assertEq(bridgeContract, newBridgeContract);
    }

    function testCannotUpdateUnsupportedChainBridge() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        uint64 unsupportedChain = 999999;
        address newBridgeContract = makeAddr("new_bridge");
        
        vm.expectRevert("Chain not supported");
        vm.prank(OWNER);
        bridge.updateDestinationBridgeContract(unsupportedChain, newBridgeContract);
    }

    function testEmergencyWithdraw() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        // Initialize pool
        vm.startPrank(OWNER);
        mockUSDC.approve(address(bridgeProxy), POOL_INITIAL_AMOUNT);
        bridge.initializePool(POOL_INITIAL_AMOUNT);
        
        uint256 initialOwnerBalance = mockUSDC.balanceOf(OWNER);
        uint256 withdrawAmount = 100 * 1e6;
        
        bridge.emergencyWithdraw(withdrawAmount);
        vm.stopPrank();
        
        assertEq(mockUSDC.balanceOf(OWNER), initialOwnerBalance + withdrawAmount);
        assertEq(bridge.getPoolBalance(), POOL_INITIAL_AMOUNT - withdrawAmount);
    }

    function testCannotEmergencyWithdrawMoreThanBalance() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        uint256 withdrawAmount = 100 * 1e6;
        
        vm.expectRevert("Insufficient contract balance");
        vm.prank(OWNER);
        bridge.emergencyWithdraw(withdrawAmount);
    }

    /* ================= VIEW FUNCTION TESTS ================= */

    function testEstimateFee() public view {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        uint256 fee = bridge.estimateFee(DEST_CHAIN, RECEIVER, BRIDGE_AMOUNT);
        assertGt(fee, 0);
    }

    function testEstimateFeeForUnsupportedChain() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        uint64 unsupportedChain = 999999;
        
        vm.expectRevert("ERR:UNSUPPORTED_CHAIN");
        bridge.estimateFee(unsupportedChain, RECEIVER, BRIDGE_AMOUNT);
    }

    function testEstimateFeeWithZeroAmount() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        vm.expectRevert("ERR:INVALID_AMOUNT");
        bridge.estimateFee(DEST_CHAIN, RECEIVER, 0);
    }

    function testGetUserApprovalStatus() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        // Before approval
        (uint256 allowanceBefore, uint256 balanceBefore) = bridge.getUserApprovalStatus(USER);
        assertEq(allowanceBefore, 0);
        assertEq(balanceBefore, STARTING_USDC);
        
        // After approval
        vm.prank(USER);
        mockUSDC.approve(address(bridgeProxy), BRIDGE_AMOUNT);
        
        (uint256 allowanceAfter, uint256 balanceAfter) = bridge.getUserApprovalStatus(USER);
        assertEq(allowanceAfter, BRIDGE_AMOUNT);
        assertEq(balanceAfter, STARTING_USDC);
    }

    function testGetChainRouter() public view {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        address router = bridge.getChainRouter(DEST_CHAIN);
        assertEq(router, address(mockRouter));
    }

    /* ================= ERC165 TESTS ================= */

    function testSupportsInterface() public view {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        // Should support IAny2EVMMessageReceiver
        assertTrue(bridge.supportsInterface(type(IAny2EVMMessageReceiver).interfaceId));
        
        // Should support ERC165
        assertTrue(bridge.supportsInterface(0x01ffc9a7));
        
        // Should not support random interface
        assertFalse(bridge.supportsInterface(0x12345678));
    }

    /* ================= UPGRADE TESTS ================= */

    function testUpgrade() public {
        RaffleBridgeImplementation newImplementation = new RaffleBridgeImplementation();
        
        address currentImpl = bridgeProxy.implementation();
        
        vm.expectEmit(true, false, false, false);
        emit Upgraded(address(newImplementation));
        
        vm.prank(OWNER);
        bridgeProxy.upgradeTo(address(newImplementation));
        
        address newImpl = bridgeProxy.implementation();
        assertEq(newImpl, address(newImplementation));
        assertNotEq(newImpl, currentImpl);
    }

    function testOnlyOwnerCanUpgrade() public {
        RaffleBridgeImplementation newImplementation = new RaffleBridgeImplementation();
        
        vm.expectRevert();
        vm.prank(MALICIOUS_USER);
        bridgeProxy.upgradeTo(address(newImplementation));
    }

    /* ================= INTEGRATION TESTS ================= */

    function testFullBridgeFlow() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        // 1. Owner initializes pool
        vm.startPrank(OWNER);
        mockUSDC.approve(address(bridgeProxy), POOL_INITIAL_AMOUNT);
        bridge.initializePool(POOL_INITIAL_AMOUNT);
        vm.stopPrank();
        
        // 2. User bridges tokens
        vm.startPrank(USER);
        mockUSDC.approve(address(bridgeProxy), BRIDGE_AMOUNT);
        bridge.bridgeTokens{value: 0.1 ether}(DEST_CHAIN, RECEIVER, BRIDGE_AMOUNT);
        vm.stopPrank();
        
        // 3. Simulate CCIP message receipt
        bytes memory messageData = abi.encode(RECEIVER, BRIDGE_AMOUNT);
        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: bytes32(uint256(1)),
            sourceChainSelector: SOURCE_CHAIN,
            sender: abi.encode(address(bridge)),
            data: messageData,
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });
        
        uint256 receiverBalanceBefore = mockUSDC.balanceOf(RECEIVER);
        
        vm.prank(address(mockRouter));
        bridge.ccipReceive(message);
        
        // Verify final state
        assertEq(mockUSDC.balanceOf(RECEIVER), receiverBalanceBefore + BRIDGE_AMOUNT);
        assertEq(bridge.getPoolBalance(), POOL_INITIAL_AMOUNT); // Pool should be back to original
    }

    /* ================= EDGE CASES ================= */

    function testReceiveEther() public {
        // Test that contract can receive ETH
        uint256 sendAmount = 1 ether;
        
        vm.prank(USER);
        (bool success,) = address(bridgeProxy).call{value: sendAmount}("");
        assertTrue(success);
        
        assertEq(address(bridgeProxy).balance, sendAmount);
    }

    function testLowPoolAlert() public {
        RaffleBridgeImplementation bridge = RaffleBridgeImplementation(payable(address(bridgeProxy)));
        
        // Initialize with small amount (below threshold)
        uint256 smallAmount = MIN_POOL_THRESHOLD - 1;
        
        vm.startPrank(OWNER);
        mockUSDC.approve(address(bridgeProxy), smallAmount);
        
        vm.expectEmit(false, false, false, true);
        emit LowPoolAlert(smallAmount, MIN_POOL_THRESHOLD);
        
        bridge.initializePool(smallAmount);
        vm.stopPrank();
    }
}

/**
 * @title MockCCIPRouter
 * @notice テスト用のCCIPルーターモック
 */
contract MockCCIPRouter is IRouterClient {
    uint256 public constant MOCK_FEE = 0.01 ether;
    
    function isChainSupported(uint64) external pure returns (bool) {
        return true;
    }
    
    function getSupportedTokens(uint64) external pure returns (address[] memory) {
        address[] memory tokens = new address[](0);
        return tokens;
    }
    
    function getFee(uint64, Client.EVM2AnyMessage memory) external pure returns (uint256) {
        return MOCK_FEE;
    }
    
    function ccipSend(uint64, Client.EVM2AnyMessage memory) external payable returns (bytes32) {
        require(msg.value >= MOCK_FEE, "Insufficient fee");
        return keccak256(abi.encode(block.timestamp, msg.sender));
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
        totalSupply = 1000000 * 10**uint256(_decimals);
        balanceOf[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }
    
    function transfer(address to, uint256 amount) public returns (bool) {
        require(balanceOf[msg.sender] >= amount, "ERC20: transfer amount exceeds balance");
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
        require(balanceOf[from] >= amount, "ERC20: transfer amount exceeds balance");
        
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
    
    function mint(address to, uint256 amount) public {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }
}