// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * @title UUPSアップグレード可能なインターフェース
 * @dev UUPSアップグレード可能なコントラクトを実装するための抽象コントラクト
 */
abstract contract IUUPSUpgradeable {
    /**
     * @dev コントラクトをアップグレードするための関数
     * @param newImplementation 新しい実装アドレス
     */
    function upgradeTo(address newImplementation) external virtual;

    /**
     * @dev コントラクトをアップグレードし、初期化関数を呼び出す関数
     * @param newImplementation 新しい実装アドレス
     * @param data 初期化データ
     */
    function upgradeToAndCall(address newImplementation, bytes memory data) external payable virtual;

    /**
     * @dev アップグレード可能かどうかをチェックする関数
     * @param newImplementation 新しい実装アドレス
     */
    function _authorizeUpgrade(address newImplementation) internal virtual;
}
