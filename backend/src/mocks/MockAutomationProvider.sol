// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "../interfaces/AutomationCompatibleInterface.sol";

/**
 * @title IMockAutomationProvider
 * @notice Chainlink Automationと互換性を持つモックインターフェース
 */
interface IMockAutomationProvider {
    /**
     * @dev モックによる自動実行の設定を行う
     * @param enabled 自動実行を有効にするかどうか
     * @param interval チェック間隔（秒）
     */
    function setAutomation(bool enabled, uint256 interval) external;
    
    /**
     * @dev Automationの現在の設定を取得する
     * @return enabled 自動実行が有効かどうか
     * @return interval チェック間隔（秒）
     * @return lastCheckTime 最後にチェックした時間
     */
    function getAutomationStatus() external view returns (
        bool enabled,
        uint256 interval,
        uint256 lastCheckTime
    );
}

/**
 * @title MockAutomationProvider
 * @notice Chainlink Automationをシミュレートしたモッククラス
 * @dev テストネット環境で使用するためのAutomationの代替
 */
contract MockAutomationProvider is IMockAutomationProvider {
    // 設定
    bool private s_automationEnabled;
    uint256 private s_checkInterval;
    uint256 private s_lastCheckTime;
    address private s_owner;
    
    event AutomationStatusChanged(bool enabled, uint256 interval);
    event UpkeepPerformed(address indexed target, bool success);
    
    modifier onlyOwner() {
        require(msg.sender == s_owner, "Only owner can call this function");
        _;
    }
    
    constructor() {
        s_owner = msg.sender;
        s_automationEnabled = false;
        s_checkInterval = 1 hours; // デフォルト: 1時間
        s_lastCheckTime = block.timestamp;
    }
    
    /**
     * @notice Automationの設定を変更する
     * @param enabled 自動実行を有効にするかどうか
     * @param interval チェック間隔（秒）
     */
    function setAutomation(bool enabled, uint256 interval) external override onlyOwner {
        s_automationEnabled = enabled;
        s_checkInterval = interval;
        s_lastCheckTime = block.timestamp;
        
        emit AutomationStatusChanged(enabled, interval);
    }
    
    /**
     * @notice Automationの現在の設定を取得する
     * @return enabled 自動実行が有効かどうか
     * @return interval チェック間隔（秒）
     * @return lastCheckTime 最後にチェックした時間
     */
    function getAutomationStatus() external view override returns (
        bool enabled,
        uint256 interval,
        uint256 lastCheckTime
    ) {
        return (s_automationEnabled, s_checkInterval, s_lastCheckTime);
    }
    
    /**
     * @notice 対象コントラクトのチェックを行い、必要に応じて実行する
     * @param target チェック対象のコントラクト
     * @return performed 実行されたかどうか
     */
    function checkAndPerform(address target) external onlyOwner returns (bool performed) {
        if (!s_automationEnabled) {
            return false;
        }
        
        // 前回のチェックから十分な時間が経過しているか確認
        if (block.timestamp < s_lastCheckTime + s_checkInterval) {
            return false;
        }
        
        // 更新
        s_lastCheckTime = block.timestamp;
        
        // checkUpkeepを呼び出す
        (bool upkeepNeeded, bytes memory performData) = AutomationCompatibleInterface(target).checkUpkeep("");
        
        if (upkeepNeeded) {
            // performUpkeepを呼び出す
            try AutomationCompatibleInterface(target).performUpkeep(performData) {
                emit UpkeepPerformed(target, true);
                return true;
            } catch {
                emit UpkeepPerformed(target, false);
                return false;
            }
        }
        
        return false;
    }
    
    /**
     * @notice オーナーを変更する
     * @param newOwner 新しいオーナーのアドレス
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        s_owner = newOwner;
    }
}