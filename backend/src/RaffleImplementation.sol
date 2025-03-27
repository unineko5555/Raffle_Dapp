// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./interfaces/IRaffle.sol";
import "./interfaces/VRFCoordinatorV2Interface.sol";
import "./interfaces/VRFConsumerBaseV2.sol";
import "./interfaces/AutomationCompatibleInterface.sol";
import "./interfaces/CCIPInterface.sol";
import "./interfaces/IERC20.sol";
import "./libraries/RaffleLib.sol";
import "./interfaces/IUUPSUpgradeable.sol";

/**
 * @title RaffleImplementation
 * @notice クロスチェーン対応のラッフルアプリケーション実装
 * @dev Chainlink VRF、Automation、CCIPを使用して、複数チェーン間で動作するラッフルを実装
 */
contract RaffleImplementation is 
    IRaffle, 
    VRFConsumerBaseV2, 
    AutomationCompatibleInterface
{
    /* 状態変数 */
    // Chainklink VRF用の変数
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    uint64 private immutable i_subscriptionId;
    bytes32 private immutable i_keyHash;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant NUM_WORDS = 2;
    uint256 private s_lastRequestId;

    // ラッフル設定
    uint256 private immutable i_entranceFee;
    uint256 private immutable i_minimumPlayers;
    uint256 private immutable i_minTimeAfterMinPlayers;
    address private immutable i_usdcAddress;
    uint256 private s_jackpotAmount;
    
    // ラッフル状態管理
    RaffleState private s_raffleState;
    address[] private s_players;
    address private s_recentWinner;
    uint256 private s_recentPrize;
    bool private s_recentJackpotWon;
    uint256 private s_lastRaffleTime;
    uint256 private s_minPlayersReachedTime;

    // Chainlink CCIP用の変数
    CCIPInterface private immutable i_ccipRouter;

    // オーナー管理
    address private s_owner;

    // コンストラクタ
    /**
     * @param vrfCoordinatorV2 VRFコーディネーターアドレス
     * @param subscriptionId VRFサブスクリプションID
     * @param keyHash VRFキーハッシュ
     * @param callbackGasLimit VRFコールバックのガスリミット
     * @param entranceFee ラッフル参加料
     * @param usdcAddress USDCトークンのアドレス
     * @param ccipRouter CCIPルーターのアドレス
     */
    constructor(
        address vrfCoordinatorV2,
        uint64 subscriptionId,
        bytes32 keyHash,
        uint32 callbackGasLimit,
        uint256 entranceFee,
        address usdcAddress,
        address ccipRouter
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_subscriptionId = subscriptionId;
        i_keyHash = keyHash;
        i_callbackGasLimit = callbackGasLimit;
        i_entranceFee = entranceFee;
        i_usdcAddress = usdcAddress;
        i_ccipRouter = CCIPInterface(ccipRouter);
        i_minimumPlayers = 3;
        i_minTimeAfterMinPlayers = 1 minutes;
        s_raffleState = RaffleState.OPEN;
        s_owner = msg.sender;
    }

    /**
     * @notice ラッフルに参加する関数
     * @dev 10 USDCの参加料が必要
     */
    function enterRaffle() external override {
        // ラッフルがオープン状態であることを確認
        require(s_raffleState == RaffleState.OPEN, "Raffle is not open");

        // 参加料の転送
        IERC20 usdc = IERC20(i_usdcAddress);
        require(usdc.transferFrom(msg.sender, address(this), i_entranceFee), "USDC transfer failed");

        // ジャックポットに10%を追加
        uint256 jackpotContribution = i_entranceFee / 10;
        s_jackpotAmount += jackpotContribution;

        // プレイヤーを追加
        s_players.push(msg.sender);

        // 最小プレイヤー数に達したかチェック
        if (s_players.length == i_minimumPlayers) {
            s_minPlayersReachedTime = block.timestamp;
        }

        // イベント発火
        emit RaffleEnter(msg.sender, i_entranceFee);
    }

    /**
     * @notice ラッフルの状態を確認する関数
     * @dev ChainlinkのAutomationで定期的に呼び出される
     * @param performData 将来的な拡張用（現在は使用されていない）
     * @return upkeepNeeded 抽選を実行する必要があるかどうか
     * @return performData 実行に必要なデータ
     */
    function checkUpkeep(bytes memory /* performData */) 
        public 
        override 
        returns (bool upkeepNeeded, bytes memory /* performData */) 
    {
        bool isOpen = s_raffleState == RaffleState.OPEN;
        bool hasPlayers = s_players.length >= i_minimumPlayers;
        bool hasTimePassed = false;
        
        if (hasPlayers) {
            hasTimePassed = (block.timestamp - s_minPlayersReachedTime) > i_minTimeAfterMinPlayers;
        }
        
        upkeepNeeded = (isOpen && hasPlayers && hasTimePassed);
        return (upkeepNeeded, "");
    }

    /**
     * @notice 抽選の実行を行う関数
     * @dev Automationによって自動的に呼び出される
     * @param /* performData */ 未使用
     */
    function performUpkeep(bytes calldata /* performData */) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        require(upkeepNeeded, "Upkeep not needed");

        // ラッフル状態を更新
        s_raffleState = RaffleState.CALCULATING_WINNER;
        emit RaffleStateChanged(s_raffleState);

        // Chainlink VRFに乱数生成をリクエスト
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_keyHash,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );

        s_lastRequestId = requestId;
    }

    /**
     * @notice VRFからの乱数を受け取るコールバック関数
     * @dev Chainlink VRFノードによって呼び出される
     * @param /* requestId */ VRFリクエストID
     * @param randomWords 生成された乱数配列
     */
    function fulfillRandomWords(uint256 /* requestId */, uint256[] memory randomWords) internal override {
        // 参加者の中から当選者を選ぶ
        uint256 winnerIndex = randomWords[0] % s_players.length;
        address winner = s_players[winnerIndex];
        s_recentWinner = winner;

        // 賞金額を計算
        uint256 prize = (i_entranceFee * s_players.length) * 90 / 100; // 参加料の90%が賞金
        s_recentPrize = prize;

        // ジャックポット当選判定
        bool isJackpotWinner = RaffleLib.isWinner(randomWords[1], RaffleLib.getJackpotProbability());
        s_recentJackpotWon = isJackpotWinner;
        
        // ジャックポットを当選した場合は、ジャックポット額も賞金に上乗せ
        if (isJackpotWinner) {
            prize += s_jackpotAmount;
            s_jackpotAmount = 0;
        }

        // 当選者に賞金を送金
        IERC20 usdc = IERC20(i_usdcAddress);
        require(usdc.transfer(winner, prize), "Prize transfer failed");

        // ラッフルをリセット
        s_players = new address[](0);
        s_raffleState = RaffleState.OPEN;
        s_lastRaffleTime = block.timestamp;
        s_minPlayersReachedTime = 0;

        // イベント発行
        emit WinnerPicked(winner, prize, isJackpotWinner);
        emit RaffleStateChanged(s_raffleState);
    }

    /**
     * @notice クロスチェーンにラッフル結果を送信する関数
     * @dev オプションで使用される、クロスチェーン通信機能
     * @param destinationChainSelector 宛先チェーンのセレクタ
     * @param winner 当選者のアドレス
     * @param prize 当選金額
     * @param isJackpot ジャックポット当選かどうか
     */
    function sendCrossChainMessage(
        uint64 destinationChainSelector,
        address winner,
        uint256 prize,
        bool isJackpot
    ) external override {
        require(msg.sender == s_owner, "Only owner can send cross-chain messages");

        // エンコードするメッセージデータ
        bytes memory messageData = abi.encode(
            winner,
            prize,
            isJackpot,
            block.timestamp
        );

        // CCIPメッセージ構造体の作成
        CCIPInterface.EVM2AnyMessage memory message = CCIPInterface.EVM2AnyMessage({
            receiver: abi.encode(address(this)),
            data: messageData,
            tokenAmounts: new CCIPInterface.EVMTokenAmount[](0),
            feeToken: address(0), // ネイティブトークンで支払い
            extraArgs: ""
        });

        // メッセージ送信の手数料を計算
        uint256 fee = i_ccipRouter.getFee(destinationChainSelector, message);
        require(address(this).balance >= fee, "Insufficient balance for fee");

        // メッセージを送信
        bytes32 messageId = i_ccipRouter.ccipSend{value: fee}(destinationChainSelector, message);

        // イベント発行
        emit CrossChainMessageSent(destinationChainSelector, messageId);
    }

    /**
     * @notice 資金引き出し関数
     * @dev コントラクトの残高をオーナーに送金
     * @param token 引き出すトークンのアドレス（0アドレスの場合はネイティブトークン）
     */
    function withdraw(address token) external {
        require(msg.sender == s_owner, "Only owner can withdraw");

        if (token == address(0)) {
            // ネイティブトークンの引き出し
            (bool success, ) = s_owner.call{value: address(this).balance}("");
            require(success, "Transfer failed");
        } else {
            // ERC20トークンの引き出し
            IERC20 erc20 = IERC20(token);
            uint256 balance = erc20.balanceOf(address(this));
            
            // ジャックポット分を除く残高のみ引き出し可能
            if (token == i_usdcAddress) {
                balance -= s_jackpotAmount;
            }
            
            require(erc20.transfer(s_owner, balance), "ERC20 transfer failed");
        }
    }

    /**
     * @notice オーナー変更関数
     * @param newOwner 新しいオーナーのアドレス
     */
    function setOwner(address newOwner) external {
        require(msg.sender == s_owner, "Only owner can change owner");
        require(newOwner != address(0), "New owner cannot be zero address");
        s_owner = newOwner;
    }

    /* View / Pure functions */

    function getRaffleState() external view override returns (RaffleState) {
        return s_raffleState;
    }

    function getNumberOfPlayers() external view override returns (uint256) {
        return s_players.length;
    }

    function getJackpotAmount() external view override returns (uint256) {
        return s_jackpotAmount;
    }

    function getRecentWinner() external view override returns (address) {
        return s_recentWinner;
    }

    function getEntranceFee() external view override returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) external view returns (address) {
        return s_players[index];
    }

    function getLastRaffleTime() external view returns (uint256) {
        return s_lastRaffleTime;
    }

    function getMinPlayersReachedTime() external view returns (uint256) {
        return s_minPlayersReachedTime;
    }

    function getMinimumPlayers() external view returns (uint256) {
        return i_minimumPlayers;
    }

    function getOwner() external view returns (address) {
        return s_owner;
    }

    /**
     * @dev Fallback関数 - コントラクトがネイティブトークンを受け取れるようにする
     */
    receive() external payable {}
}
