// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * @title IRaffle
 * @dev Raffle Dappのインターフェース
 */
interface IRaffle {
    /**
     * @dev ラッフルの状態を表す列挙型
     * OPEN: ラッフル参加受付中
     * CALCULATING_WINNER: 当選者計算中（VRF待機中）
     * WINNER_SELECTED: 当選者選出済み（処理待機中）
     * CLOSED: ラッフル終了
     */
    enum RaffleState {
        OPEN,
        CALCULATING_WINNER,
        WINNER_SELECTED,
        CLOSED
    }

    /**
     * @dev ラッフルに参加するための関数
     * ユーザーは10 USDCを支払って参加します
     */
    function enterRaffle() external;

    /**
     * @dev Chainlink Automationで呼び出される関数
     * 条件を満たした場合にラッフルの当選者を決定するプロセスを開始します
     * @return upkeepNeeded 条件を満たしているかどうか
     * @return performData 実行に必要なデータ
     */
    function checkUpkeep(bytes memory) external view returns (bool upkeepNeeded, bytes memory performData);

    /**
     * @dev upkeepが必要な場合に実行される関数
     * @param performData checkUpkeepで生成されたデータ
     */
    function performUpkeep(bytes calldata performData) external;

    /**
     * @dev 現在のラッフルの状態を取得する関数
     * @return state 現在のラッフル状態
     */
    function getRaffleState() external view returns (RaffleState state);

    /**
     * @dev 最新のラウンドの参加者数を取得する関数
     * @return count 参加者数
     */
    function getNumberOfPlayers() external view returns (uint256 count);

    /**
     * @dev 現在のジャックポット額を取得する関数
     * @return amount ジャックポット額（USDC）
     */
    function getJackpotAmount() external view returns (uint256 amount);

    /**
     * @dev 最新の当選者を取得する関数
     * @return winner 当選者のアドレス
     */
    function getRecentWinner() external view returns (address winner);

    /**
     * @dev ラッフルのエントリー料金を取得する関数
     * @return fee エントリー料金（USDC）
     */
    function getEntranceFee() external view returns (uint256 fee);

    /**
     * @dev ユーザーの統計情報を取得する関数
     * @param user 統計情報を取得するユーザーのアドレス
     * @return entryCount ラッフル参加回数
     * @return winCount ラッフル当選回数
     * @return jackpotCount ジャックポット獲得回数
     */
    function getUserStats(address user) external view returns (
        uint256 entryCount,
        uint256 winCount,
        uint256 jackpotCount
    );

    /**
     * @dev 過去のラッフル結果の件数を取得する関数
     * @return ラッフル履歴の件数
     */
    function getRaffleHistoryCount() external view returns (uint256);

    /**
     * @dev 特定のラッフル結果を取得する関数
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
    );

    /**
     * @dev 最新のラッフル結果を取得する関数
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
    );

    /**
     * @dev ラッフルの状態を手動で変更する関数（オーナー専用）
     * @param newState 新しいラッフル状態
     */
    function setRaffleState(RaffleState newState) external;

    /**
     * @dev VRFで選出された当選者を処理する関数
     * WINNER_SELECTED状態で実行可能
     */
    function processWinner() external;

    // イベント
    /**
     * @dev ラッフルに参加した時に発火するイベント
     * @param player 参加者のアドレス
     * @param entranceFee 支払った参加料
     */
    event RaffleEnter(address indexed player, uint256 entranceFee);

    /**
     * @dev 当選者が選ばれた時に発火するイベント
     * @param winner 当選者のアドレス
     * @param prize 獲得した賞金額
     * @param isJackpot ジャックポット当選かどうか
     */
    event WinnerPicked(address indexed winner, uint256 prize, bool isJackpot);

    /**
     * @dev ラッフルの状態が変わった時に発火するイベント
     * @param newState 新しいラッフル状態
     */
    event RaffleStateChanged(RaffleState newState);

    /**
     * @dev ラッフルから参加を取り消した時に発火するイベント
     * @param player 参加を取り消したプレイヤーのアドレス
     * @param refundAmount 返金額
     */
    event RaffleExit(address indexed player, uint256 refundAmount);

    /**
     * @dev VRFから乱数を受信した時に発火するイベント
     * @param requestId VRFリクエストID
     * @param randomWord 受信した乱数
     */
    event RandomWordsReceived(uint256 indexed requestId, uint256 randomWord);
}