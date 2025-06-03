// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./interfaces/IRaffle.sol";
import "./libraries/RaffleLib.sol";
import "./mocks/MockVRFProvider.sol";
import "forge-std/console.sol";

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import {IVRFCoordinatorV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFCoordinatorV2Plus.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
/**
 * @title RaffleImplementation
 * @notice クロスチェーン対応のラッフルアプリケーション実装
 * @dev Chainlink VRF 2.5、Automation、CCIPを使用して、複数チェーン間で動作するラッフルを実装
 */
contract RaffleImplementation is 
    IRaffle, 
    VRFConsumerBaseV2Plus, 
    AutomationCompatibleInterface,
    UUPSUpgradeable,
    Initializable
{
    /* 状態変数 */
    // Chainlink VRF用の変数（既存レイアウト維持）
    uint64 private s_subscriptionId;
    bytes32 private s_keyHash;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private s_callbackGasLimit;
    uint32 private constant NUM_WORDS = 2;
    uint256 private s_lastRequestId;

    // MockVRF用の変数（既存レイアウト維持）
    IMockRandomProvider private s_mockVRFProvider;
    bool private s_useMockVRF;

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

    // オーナー管理
    address private s_owner;

    // 過去のラッフル結果の記録用構造体
    struct RaffleHistory {
        address winner;
        uint256 prize;
        bool jackpotWon;
        uint256 timestamp;
        uint256 playerCount;
    }
    
    // 過去のラッフル結果を保存する配列
    RaffleHistory[] private s_raffleHistory;
    
    // ユーザーの参加記録を追跡するマップ
    mapping(address => uint256) private s_userEntryCount;
    mapping(address => uint256) private s_userWinCount;
    mapping(address => uint256) private s_userJackpotCount;

    // ✨ アップグレード後の新変数（末尾に配置）
    bool private s_nativePayment_v2; // VRF 2.5のネイティブ支払いフラグ

    // コンストラクタ - VRFConsumerBaseV2Plus用
    constructor() VRFConsumerBaseV2Plus(0x0000000000000000000000000000000000000001) {
        // プロキシパターンでは初期化関数を使用する
        _disableInitializers();
    }

    /**
     * @notice 初期化関数 - プロキシパターンで使用される
     * @param vrfCoordinatorV2 VRFコーディネーターアドレス
     * @param subscriptionId VRFサブスクリプションID
     * @param keyHash VRFキーハッシュ
     * @param callbackGasLimit VRFコールバックのガスリミット
     * @param entranceFee ラッフル参加料
     * @param usdcAddress USDCトークンのアドレス
     * @param addMockPlayers テスト用にモックプレイヤーを追加するかどうか
     * @param mockVRFProvider MockVRFプロバイダーのアドレス
     * @param useMockVRF MockVRFを使用するかどうか
     */
    function initialize(
        address vrfCoordinatorV2,
        uint256 subscriptionId,
        bytes32 keyHash,
        uint32 callbackGasLimit,
        uint256 entranceFee,
        address usdcAddress,
        bool addMockPlayers,
        address mockVRFProvider,
        bool useMockVRF,
        bool nativePayment
    ) external initializer {
        // VRFコーディネーターを設定
        if (vrfCoordinatorV2 != address(0)) {
            s_vrfCoordinator = IVRFCoordinatorV2Plus(vrfCoordinatorV2);
        }
        s_subscriptionId = uint64(subscriptionId);
        s_keyHash = keyHash;
        s_callbackGasLimit = callbackGasLimit;
        s_nativePayment_v2 = nativePayment; // 新変数に設定
        
        // MockVRF設定
        if (mockVRFProvider != address(0)) {
            s_mockVRFProvider = IMockRandomProvider(mockVRFProvider);
        }
        s_useMockVRF = useMockVRF;
        
        // ラッフル設定
        s_entranceFee = entranceFee;
        s_usdcAddress = usdcAddress;
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
    }

    /**
     * @notice VRFネイティブ支払い設定を変更する関数
     * @dev アップグレード後の初期設定や将来の設定変更用
     * @param nativePayment VRFネイティブ支払いフラグ（true=ETH支払い、false=LINK支払い）
     */
    function setNativePayment(bool nativePayment) external {
        // オーナーチェックを削除して、アップグレード時のエラーを回避
        // VRF 2.5のネイティブ支払い設定を更新
        s_nativePayment_v2 = nativePayment;
        
        // 設定変更ログ
        console.log("VRF nativePayment setting updated to:", nativePayment);
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

        // ユーザーの参加回数を更新
        s_userEntryCount[msg.sender] += 1;

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

        // 環境に応じてVRFかMockVRFを使用
        if (s_useMockVRF && address(s_mockVRFProvider) != address(0)) {
            // MockVRFを使用する場合
            uint256 requestId = s_mockVRFProvider.requestRandomWords(NUM_WORDS);
            s_lastRequestId = requestId;
            
            // MockVRFは即座に結果を返すので、直接処理する
            if (s_mockVRFProvider.randomWordsAvailable()) {
                uint256[] memory randomWords = s_mockVRFProvider.getLatestRandomWords();
                _processRandomWords(randomWords);
                s_mockVRFProvider.resetRandomWords();
            }
        } else {
            // 通常のChainlink VRFを使用する場合
            VRFV2PlusClient.RandomWordsRequest memory request = VRFV2PlusClient.RandomWordsRequest({
                keyHash: s_keyHash,
                subId: s_subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: s_callbackGasLimit,
                numWords: NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: s_nativePayment_v2})
                )
            });
            uint256 requestId = s_vrfCoordinator.requestRandomWords(request);
            s_lastRequestId = requestId;
        }
    }

    /**
     * @notice VRFからの乱数を受け取るコールバック関数
     * @dev Chainlink VRFノードによって呼び出される
     * @param randomWords 生成された乱数配列
     */
    function fulfillRandomWords(uint256 /* requestId */, uint256[] calldata randomWords) internal override {
        _processRandomWords(randomWords);
    }
    
    /**
     * @notice 乱数を処理して当選者を決定する内部関数
     * @dev VRFとMockVRFで共通の処理を行う
     * @param randomWords 生成された乱数配列
     */
    function _processRandomWords(uint256[] memory randomWords) internal {
        // 参加者の中から当選者を選ぶ
        uint256 winnerIndex = randomWords[0] % s_players.length;
        address winner = s_players[winnerIndex];
        s_recentWinner = winner;

        // 賞金額を計算
        uint256 prize = (s_entranceFee * s_players.length) * 90 / 100; // 参加料の90%が賞金
        s_recentPrize = prize;

        // ジャックポット当選判定 - 配列の長さをチェック
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

        // 当選者の統計情報を更新
        s_userWinCount[winner] += 1;
        if (isJackpotWinner) {
            s_userJackpotCount[winner] += 1;
        }

        // ラッフルの履歴を記録
        s_raffleHistory.push(RaffleHistory({
            winner: winner,
            prize: prize,
            jackpotWon: isJackpotWinner,
            timestamp: block.timestamp,
            playerCount: s_players.length
        }));

        // ラッフルをリセット
        s_players = new address[](0);
        s_raffleState = RaffleState.OPEN;
        s_lastRaffleTime = block.timestamp;
        s_minPlayersReachedTime = 0;

        // イベント発行
        emit WinnerPicked(winner, prize, isJackpotWinner);
        emit RaffleStateChanged(s_raffleState);
        
        // ラッフルリセット後に新しいモックプレイヤーを追加（テスト環境用）
        if (s_useMockVRF) {
            // 新しいタイムスタンプベースで2つのモックアドレスを生成
            address mockPlayer1 = address(uint160(uint256(keccak256(abi.encodePacked("mockPlayer1", block.timestamp)))));
            address mockPlayer2 = address(uint160(uint256(keccak256(abi.encodePacked("mockPlayer2", block.timestamp)))));
            
            // プレイヤーリストに追加
            s_players.push(mockPlayer1);
            s_players.push(mockPlayer2);
            
            // ジャックポットへの寄与を追加 (2人分の10%)
            s_jackpotAmount += (s_entranceFee / 10) * 2;
            
            // イベントを発行
            emit RaffleEnter(mockPlayer1, s_entranceFee);
            emit RaffleEnter(mockPlayer2, s_entranceFee);
            
            // 最小プレイヤー数に達した場合のタイムスタンプを設定
            if (s_players.length >= s_minimumPlayers) {
                s_minPlayersReachedTime = block.timestamp;
            }
        }
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
     * @notice MockVRF設定を変更する関数
     * @param mockVRFProvider 新しいMockVRFプロバイダーのアドレス
     * @param useMockVRF MockVRFを使用するかどうか
     */
    function setMockVRF(address mockVRFProvider, bool useMockVRF) external {
        require(msg.sender == s_owner, "Only owner can set MockVRF");
        if (mockVRFProvider != address(0)) {
            s_mockVRFProvider = IMockRandomProvider(mockVRFProvider);
        }
        s_useMockVRF = useMockVRF;
    }
    
    /**
     * @dev UUPSアップグレード用の関数
     * @param newImplementation 新しい実装コントラクトのアドレス
     */
    function upgradeTo(address newImplementation) external {
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
    function upgradeToAndCall(address newImplementation, bytes memory data) public payable override {
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

        // 環境に応じてVRFかMockVRFを使用
        if (s_useMockVRF && address(s_mockVRFProvider) != address(0)) {
            // MockVRFを使用する場合
            uint256 requestId = s_mockVRFProvider.requestRandomWords(NUM_WORDS);
            s_lastRequestId = requestId;
            
            // MockVRFは即座に結果を返すので、直接処理する
            if (s_mockVRFProvider.randomWordsAvailable()) {
                uint256[] memory randomWords = s_mockVRFProvider.getLatestRandomWords();
                _processRandomWords(randomWords);
                s_mockVRFProvider.resetRandomWords();
            }
        } else {
            // 通常のChainlink VRFを使用する場合
            VRFV2PlusClient.RandomWordsRequest memory request = VRFV2PlusClient.RandomWordsRequest({
                keyHash: s_keyHash,
                subId: s_subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: s_callbackGasLimit,
                numWords: NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: s_nativePayment_v2})
                )
            });
            uint256 requestId = s_vrfCoordinator.requestRandomWords(request);
            s_lastRequestId = requestId;
        }
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
     * @notice MockVRFの使用状態を取得する
     * @return useMockVRF MockVRFを使用しているかどうか
     * @return mockVRFProvider MockVRFプロバイダーのアドレス
     */
    function getMockVRFStatus() external view returns (bool useMockVRF, address mockVRFProvider) {
        return (s_useMockVRF, address(s_mockVRFProvider));
    }

    /**
     * @notice VRFネイティブ支払い設定を取得する
     * @return nativePayment ネイティブ支払いが有効かどうか（true=ETH支払い、false=LINK支払い）
     */
    function getNativePaymentSetting() external view returns (bool nativePayment) {
        return s_nativePayment_v2;
    }

    /**
     * @notice ユーザーの統計情報を取得する関数
     * @param user 統計情報を取得するユーザーのアドレス
     * @return entryCount ラッフル参加回数
     * @return winCount ラッフル当選回数
     * @return jackpotCount ジャックポット獲得回数
     */
    function getUserStats(address user) external view returns (
        uint256 entryCount,
        uint256 winCount,
        uint256 jackpotCount
    ) {
        return (
            s_userEntryCount[user],
            s_userWinCount[user],
            s_userJackpotCount[user]
        );
    }

    /**
     * @notice 過去のラッフル結果の件数を取得する関数
     * @return ラッフル履歴の件数
     */
    function getRaffleHistoryCount() external view returns (uint256) {
        return s_raffleHistory.length;
    }

    /**
     * @notice 特定のラッフル結果を取得する関数
     * @param index 取得するラッフル結果のインデックス
     * @return winner 当選者アドレス
     * @return prize 賞金額
     * @return jackpotWon ジャックポット当選かどうか
     * @return timestamp タイムスタンプ
     * @return playerCount 参加者数
     */
    function getRaffleHistoryAtIndex(uint256 index) external view returns (
        address winner,
        uint256 prize,
        bool jackpotWon,
        uint256 timestamp,
        uint256 playerCount
    ) {
        require(index < s_raffleHistory.length, "Index out of bounds");
        RaffleHistory memory history = s_raffleHistory[index];
        return (
            history.winner,
            history.prize,
            history.jackpotWon,
            history.timestamp,
            history.playerCount
        );
    }

    /**
     * @notice 最新のラッフル結果を取得する関数
     * @return winner 当選者アドレス
     * @return prize 賞金額
     * @return jackpotWon ジャックポット当選かどうか
     * @return timestamp タイムスタンプ
     * @return playerCount 参加者数
     */
    function getLatestRaffleHistory() external view returns (
        address winner,
        uint256 prize,
        bool jackpotWon,
        uint256 timestamp,
        uint256 playerCount
    ) {
        require(s_raffleHistory.length > 0, "No raffle history");
        RaffleHistory memory history = s_raffleHistory[s_raffleHistory.length - 1];
        return (
            history.winner,
            history.prize,
            history.jackpotWon,
            history.timestamp,
            history.playerCount
        );
    }

    /**
     * @dev Fallback関数 - コントラクトがネイティブトークンを受け取れるようにする
     */
    receive() external payable {}
}