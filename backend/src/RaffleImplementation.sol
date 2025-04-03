// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./interfaces/IRaffle.sol";
import "./interfaces/VRFCoordinatorV2_5Interface.sol";
import "./interfaces/VRFConsumerBaseV2_5.sol";
import "./interfaces/AutomationCompatibleInterface.sol";
import "./interfaces/CCIPInterface.sol";
import "./interfaces/IERC20.sol";
import "./libraries/RaffleLib.sol";
import "./interfaces/IUUPSUpgradeable.sol";

/**
 * @title RaffleImplementation
 * @notice クロスチェーン対応のラッフルアプリケーション実装
 * @dev Chainlink VRF 2.5、Automation、CCIPを使用して、複数チェーン間で動作するラッフルを実装
 */
contract RaffleImplementation is 
    IRaffle, 
    VRFConsumerBaseV2_5, 
    AutomationCompatibleInterface,
    IUUPSUpgradeable
{
    /* 状態変数 */
    // Chainklink VRF用の変数
    VRFCoordinatorV2_5Interface private s_vrfCoordinator;
    uint64 private s_subscriptionId;
    bytes32 private s_keyHash;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private s_callbackGasLimit;
    uint32 private constant NUM_WORDS = 2;
    uint256 private s_lastRequestId;

    // ラッフル設定
    uint256 private s_entranceFee;
    uint256 private s_minimumPlayers;
    uint256 private s_minTimeAfterMinPlayers;
    address private s_usdcAddress;
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
    CCIPInterface private s_ccipRouter;

    // 初期化状態管理
    bool private s_initialized;

    // オーナー管理
    address private s_owner;

    // コンストラクタ - シンプルな実装
    constructor() VRFConsumerBaseV2_5(address(0)) {
        // コンストラクタはそのまま使用されない
        // プロキシパターンでは初期化関数を使用する
    }

    /**
     * @notice 初期化関数 - プロキシパターンで使用される
     * @param vrfCoordinatorV2 VRFコーディネーターアドレス
     * @param subscriptionId VRFサブスクリプションID
     * @param keyHash VRFキーハッシュ
     * @param callbackGasLimit VRFコールバックのガスリミット
     * @param entranceFee ラッフル参加料
     * @param usdcAddress USDCトークンのアドレス
     * @param ccipRouter CCIPルーターのアドレス
     * @param addMockPlayers テスト用にモックプレイヤーを追加するかどうか
     */
    function initialize(
        address vrfCoordinatorV2,
        uint256 subscriptionId,
        bytes32 keyHash,
        uint32 callbackGasLimit,
        uint256 entranceFee,
        address usdcAddress,
        address ccipRouter,
        bool addMockPlayers
    ) external {
        // 初期化は一度だけ
        require(!s_initialized, "Already initialized");
        
        // VRFコーディネーターを設定
        s_vrfCoordinator = VRFCoordinatorV2_5Interface(vrfCoordinatorV2);
        s_subscriptionId = uint64(subscriptionId);
        s_keyHash = keyHash;
        s_callbackGasLimit = callbackGasLimit;
        
        // ラッフル設定
        s_entranceFee = entranceFee;
        s_usdcAddress = usdcAddress;
        s_ccipRouter = CCIPInterface(ccipRouter);
        s_minimumPlayers = 3;
        s_minTimeAfterMinPlayers = 1 minutes;
        s_raffleState = RaffleState.OPEN;
        s_owner = msg.sender;
        
        // テスト環境用にモックプレイヤーを追加
        if (addMockPlayers) {
            // 2つのモックアドレスを生成して追加
            address mockPlayer1 = address(uint160(uint256(keccak256(abi.encodePacked("mockPlayer1", block.timestamp)))));
            address mockPlayer2 = address(uint160(uint256(keccak256(abi.encodePacked("mockPlayer2", block.timestamp)))));
            
            s_players.push(mockPlayer1);
            s_players.push(mockPlayer2);
            
            // ジャックポットへの寄与を追加 (2人分の10%)
            s_jackpotAmount += (entranceFee / 10) * 2;
            
            // イベントを発行
            emit RaffleEnter(mockPlayer1, entranceFee);
            emit RaffleEnter(mockPlayer2, entranceFee);
            
            // 最小プレイヤー数に達した場合のタイムスタンプを設定
            if (s_players.length >= s_minimumPlayers) {
                s_minPlayersReachedTime = block.timestamp;
            }
            
            // ログ記録
            emit RaffleStateChanged(s_raffleState);
        }
        
        // 初期化完了をマーク
        s_initialized = true;
    }

    /**
     * @notice ラッフルに参加する関数
     * @dev 10 USDCの参加料が必要
     */
    function enterRaffle() external override {
        // ラッフルがオープン状態であることを確認
        require(s_raffleState == RaffleState.OPEN, "Raffle is not open");
        
        // 同じアドレスからの複数参加を防止
        for (uint256 i = 0; i < s_players.length; i++) {
            require(s_players[i] != msg.sender, "Player already entered");
        }

        // 参加料の転送
        IERC20 usdc = IERC20(s_usdcAddress);
        require(usdc.transferFrom(msg.sender, address(this), s_entranceFee), "USDC transfer failed");

        // ジャックポットに10%を追加
        uint256 jackpotContribution = s_entranceFee / 10;
        s_jackpotAmount += jackpotContribution;

        // プレイヤーを追加
        s_players.push(msg.sender);

        // 最小プレイヤー数に達したかチェック
        if (s_players.length == s_minimumPlayers) {
            s_minPlayersReachedTime = block.timestamp;
        }

        // イベント発火
        emit RaffleEnter(msg.sender, s_entranceFee);
    }

    /**
     * @notice ラッフルへの参加を取り消す関数
     * @dev 参加者のみが自分の参加を取り消せる
     */
    function cancelEntry() external {
        // ラッフルがオープン状態であることを確認
        require(s_raffleState == RaffleState.OPEN, "Raffle is not open");
        
        // プレイヤーが参加しているか確認
        bool found = false;
        uint256 playerIndex;
        
        for (uint256 i = 0; i < s_players.length; i++) {
            if (s_players[i] == msg.sender) {
                found = true;
                playerIndex = i;
                break;
            }
        }
        
        require(found, "Player not found");
        
        // 参加料の90%を返金（10%はジャックポットとして保持）
        uint256 refundAmount = (s_entranceFee * 90) / 100;
        IERC20 usdc = IERC20(s_usdcAddress);
        require(usdc.transfer(msg.sender, refundAmount), "USDC refund failed");
        
        // プレイヤーをリストから削除（最後のプレイヤーと入れ替えて削除）
        s_players[playerIndex] = s_players[s_players.length - 1];
        s_players.pop();
        
        // 最小プレイヤー数を下回った場合、タイマーをリセット
        if (s_players.length < s_minimumPlayers) {
            s_minPlayersReachedTime = 0;
        }
        
        // イベント発火
        emit RaffleExit(msg.sender, refundAmount);
    }

    /**
     * @notice ラッフルの状態を確認する関数
     * @dev ChainlinkのAutomationで定期的に呼び出される
     * @return upkeepNeeded 抽選を実行する必要があるかどうか
     * @return bytes 実行に必要なデータ
     */
    function checkUpkeep(bytes memory /* performData */) 
        public 
        view
        override(AutomationCompatibleInterface, IRaffle) 
        returns (bool upkeepNeeded, bytes memory /* performData */) 
    {
        bool isOpen = s_raffleState == RaffleState.OPEN;
        bool hasPlayers = s_players.length >= s_minimumPlayers;
        bool hasTimePassed = false;
        
        if (hasPlayers) {
            hasTimePassed = (block.timestamp - s_minPlayersReachedTime) > s_minTimeAfterMinPlayers;
        }
        
        upkeepNeeded = (isOpen && hasPlayers && hasTimePassed);
        return (upkeepNeeded, "");
    }

    /**
     * @notice 抽選の実行を行う関数
     * @dev Automationによって自動的に呼び出される
     */
    function performUpkeep(bytes calldata /* performData */) external override(AutomationCompatibleInterface, IRaffle) {
        (bool upkeepNeeded, ) = checkUpkeep("");
        require(upkeepNeeded, "Upkeep not needed");

        // ラッフル状態を更新
        s_raffleState = RaffleState.CALCULATING_WINNER;
        emit RaffleStateChanged(s_raffleState);

        // Chainlink VRFに乱数生成をリクエスト
        uint256 requestId = s_vrfCoordinator.requestRandomWords(
            s_keyHash,
            s_subscriptionId,
            REQUEST_CONFIRMATIONS,
            s_callbackGasLimit,
            NUM_WORDS
        );

        s_lastRequestId = requestId;
    }

    /**
     * @notice VRFからの乱数を受け取るコールバック関数
     * @dev Chainlink VRFノードによって呼び出される
     * @param randomWords 生成された乱数配列
     */
    function fulfillRandomWords(uint256 /* requestId */, uint256[] memory randomWords) internal override {
        // 参加者の中から当選者を選ぶ
        uint256 winnerIndex = randomWords[0] % s_players.length;
        address winner = s_players[winnerIndex];
        s_recentWinner = winner;

        // 賞金額を計算
        uint256 prize = (s_entranceFee * s_players.length) * 90 / 100; // 参加料の90%が賞金
        s_recentPrize = prize;

        // 修正: ジャックポット当選判定 - 配列の長さをチェック
        bool isJackpotWinner = false;
        if (randomWords.length > 1) {
            isJackpotWinner = RaffleLib.isWinner(randomWords[1], RaffleLib.getJackpotProbability());
        } else {
            // 配列の要素が足りない場合は、最初の乱数を使用
            isJackpotWinner = RaffleLib.isWinner(randomWords[0], RaffleLib.getJackpotProbability());
        }
        s_recentJackpotWon = isJackpotWinner;
        
        // ジャックポットを当選した場合は、ジャックポット額も賞金に上乗せ
        if (isJackpotWinner) {
            prize += s_jackpotAmount;
            s_jackpotAmount = 0;
        }

        // 当選者に賞金を送金
        IERC20 usdc = IERC20(s_usdcAddress);
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
        uint256 destinationChainSelector,
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
        uint256 fee = s_ccipRouter.getFee(destinationChainSelector, message);
        require(address(this).balance >= fee, "Insufficient balance for fee");

        // メッセージを送信
        bytes32 messageId = s_ccipRouter.ccipSend{value: fee}(destinationChainSelector, message);

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
            if (token == s_usdcAddress) {
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
    
    /**
     * @dev UUPSアップグレード用の関数
     * @param newImplementation 新しい実装コントラクトのアドレス
     */
    function upgradeTo(address newImplementation) external override {
        require(msg.sender == s_owner, "Only owner can upgrade");
        _authorizeUpgrade(newImplementation);
        // コードスロットに新しい実装を書き込む
        assembly {
            sstore(0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc, newImplementation)
        }
    }

    /**
     * @dev UUPSアップグレードと初期化用の関数
     * @param newImplementation 新しい実装コントラクトのアドレス
     * @param data 初期化データ
     */
    function upgradeToAndCall(address newImplementation, bytes memory data) external payable override {
        require(msg.sender == s_owner, "Only owner can upgrade");
        _authorizeUpgrade(newImplementation);
        // コードスロットに新しい実装を書き込む
        assembly {
            sstore(0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc, newImplementation)
        }
        // 初期化関数を呼び出す
        (bool success, ) = newImplementation.delegatecall(data);
        require(success, "Call failed");
    }

    /**
     * @notice UUPSアップグレードの承認
     * @dev オーナーのみがアップグレードを承認できる
     * @param newImplementation 新しい実装コントラクトのアドレス
     */
    function _authorizeUpgrade(address newImplementation) internal override {
        require(msg.sender == s_owner, "Only owner can upgrade");
    }

    /**
     * @notice 管理者用のラッフル手動実行関数
     * @dev オーナーのみが呼び出せる特別な関数
     */
    function manualPerformUpkeep() external {
        // オーナーのみが呼び出せるように制限
        require(msg.sender == s_owner, "Only owner can manual perform upkeep");
        
        // ラッフルを開始するための最小条件を確認
        bool isOpen = s_raffleState == RaffleState.OPEN;
        bool hasPlayers = s_players.length >= s_minimumPlayers;
        
        require(isOpen, "Raffle is not open");
        require(hasPlayers, "Not enough players");
        
        // ラッフル状態を更新
        s_raffleState = RaffleState.CALCULATING_WINNER;
        emit RaffleStateChanged(s_raffleState);

        // Chainlink VRFに乱数生成をリクエスト
        uint256 requestId = s_vrfCoordinator.requestRandomWords(
            s_keyHash,
            s_subscriptionId,
            REQUEST_CONFIRMATIONS,
            s_callbackGasLimit,
            NUM_WORDS
        );

        s_lastRequestId = requestId;
    }

    /**
     * @notice デバッグ用のアップキープ状態確認関数
     * @dev 現在のアップキープ条件の状態を詳細に返す
     */
    function checkUpkeepDebug() external view returns (
        bool isOpen,
        bool hasPlayers,
        bool hasTimePassed,
        uint256 timeSinceMinPlayers,
        uint256 requiredTime,
        uint256 playerCount
    ) {
        isOpen = s_raffleState == RaffleState.OPEN;
        hasPlayers = s_players.length >= s_minimumPlayers;
        timeSinceMinPlayers = s_minPlayersReachedTime > 0 ? block.timestamp - s_minPlayersReachedTime : 0;
        requiredTime = s_minTimeAfterMinPlayers;
        hasTimePassed = hasPlayers && timeSinceMinPlayers > requiredTime;
        playerCount = s_players.length;
        
        return (isOpen, hasPlayers, hasTimePassed, timeSinceMinPlayers, requiredTime, playerCount);
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
        return s_entranceFee;
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
        return s_minimumPlayers;
    }

    function getOwner() external view returns (address) {
        return s_owner;
    }

    /**
     * @dev Fallback関数 - コントラクトがネイティブトークンを受け取れるようにする
     */
    receive() external payable {}
}