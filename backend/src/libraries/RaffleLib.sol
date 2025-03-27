// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * @title RaffleLib
 * @dev ラッフルアプリケーションのためのヘルパーライブラリ
 */
library RaffleLib {
    /**
     * @dev 与えられた確率で当選するかどうかを計算する関数
     * @param randomNumber 乱数
     * @param probability 当選確率（10000で割った値）
     * @return result 当選かどうか
     */
    function isWinner(uint256 randomNumber, uint256 probability) internal pure returns (bool result) {
        // 0 - 9999 の範囲で確率を計算
        uint256 scaledRandomNumber = randomNumber % 10000;
        
        // 例: 確率が1%の場合、probability = 100
        // 0 - 99 の間の値が出たら当選
        return scaledRandomNumber < probability;
    }

    /**
     * @dev 与えられた乱数から参加者の中から当選者を選ぶ関数
     * @param randomNumber 乱数
     * @param players 参加者の配列
     * @return winner 当選者のアドレス
     */
    function selectWinner(uint256 randomNumber, address[] memory players) internal pure returns (address winner) {
        uint256 winnerIndex = randomNumber % players.length;
        return players[winnerIndex];
    }

    /**
     * @dev ジャックポット当選確率を計算する関数
     * 基本確率: 1%
     * @return probability 当選確率（10000ベース）
     */
    function getJackpotProbability() internal pure returns (uint256 probability) {
        return 100; // 1%
    }

    /**
     * @dev 開始時刻から経過した時間を秒単位で計算する関数
     * @param startTime 開始時刻
     * @return secondsElapsed 経過秒数
     */
    function getTimeElapsed(uint256 startTime) internal view returns (uint256 secondsElapsed) {
        return block.timestamp - startTime;
    }
}
