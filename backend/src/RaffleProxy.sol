// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./interfaces/IUUPSUpgradeable.sol";

/**
 * @title RaffleProxy
 * @notice UUPSプロキシパターンを使用したアップグレード可能なラッフルプロキシ
 * @dev OZのUUPSProxyをベースにしたシンプルな実装
 */
contract RaffleProxy {
    // ストレージスロット keccak256("PROXIABLE") = "0xc5f16f0fcc639fa48a6947836d9850f504798523bf8c9a3a87d5876cf622bcf7"
    bytes32 private constant IMPLEMENTATION_SLOT = 0xc5f16f0fcc639fa48a6947836d9850f504798523bf8c9a3a87d5876cf622bcf7;
    
    // ストレージスロット keccak256("ADMIN") = "0x10d6a54a4754c8869d6886b5f5d7fbfa5b4522237ea5c60d11bc4e7a1ff9390b"
    bytes32 private constant ADMIN_SLOT = 0x10d6a54a4754c8869d6886b5f5d7fbfa5b4522237ea5c60d11bc4e7a1ff9390b;

    /**
     * @notice プロキシコンストラクタ
     * @param implementation 初期実装コントラクトのアドレス
     * @param initData 初期化用のデータ
     */
    constructor(address implementation, bytes memory initData) {
        _setAdmin(msg.sender);
        _setImplementation(implementation);
        
        if (initData.length > 0) {
            (bool success, ) = implementation.delegatecall(initData);
            require(success, "Initialization failed");
        }
    }

    /**
     * @dev 管理者のみが実行できるようにするモディファイア
     */
    modifier onlyAdmin() {
        require(msg.sender == _getAdmin(), "Caller is not admin");
        _;
    }

    /**
     * @notice 実装アドレスを変更する関数
     * @param newImplementation 新しい実装コントラクトのアドレス
     */
    function upgradeTo(address newImplementation) external onlyAdmin {
        _authorizeUpgrade(newImplementation);
        _setImplementation(newImplementation);
    }

    /**
     * @notice 実装アドレスを変更し、初期化関数を呼び出す関数
     * @param newImplementation 新しい実装コントラクトのアドレス
     * @param data 初期化用のデータ
     */
    function upgradeToAndCall(address newImplementation, bytes memory data) external payable onlyAdmin {
        _authorizeUpgrade(newImplementation);
        _setImplementation(newImplementation);
        
        (bool success, ) = newImplementation.delegatecall(data);
        require(success, "Upgrade call failed");
    }

    /**
     * @notice 管理者アドレスを変更する関数
     * @param newAdmin 新しい管理者のアドレス
     */
    function changeAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "New admin is the zero address");
        _setAdmin(newAdmin);
    }

    /**
     * @notice 現在の実装アドレスを取得する関数
     * @return implementation 実装コントラクトのアドレス
     */
    function implementation() external view returns (address) {
        return _getImplementation();
    }

    /**
     * @notice 現在の管理者アドレスを取得する関数
     * @return admin 管理者のアドレス
     */
    function admin() external view returns (address) {
        return _getAdmin();
    }

    /**
     * @dev 実装アドレスの更新を承認する内部関数
     * @param newImplementation 新しい実装コントラクトのアドレス
     */
    function _authorizeUpgrade(address newImplementation) internal view {
        // 実装コントラクトがUUPSアップグレード可能であることを確認
        (bool success, ) = newImplementation.staticcall(
            abi.encodeWithSignature("_authorizeUpgrade(address)", address(0))
        );
        require(success, "New implementation is not UUPS compatible");
    }

    /**
     * @dev 実装アドレスをストレージに保存する内部関数
     * @param newImplementation 新しい実装コントラクトのアドレス
     */
    function _setImplementation(address newImplementation) internal {
        require(newImplementation != address(0), "Implementation cannot be zero address");
        
        assembly {
            sstore(IMPLEMENTATION_SLOT, newImplementation)
        }
    }

    /**
     * @dev 管理者アドレスをストレージに保存する内部関数
     * @param newAdmin 新しい管理者のアドレス
     */
    function _setAdmin(address newAdmin) internal {
        assembly {
            sstore(ADMIN_SLOT, newAdmin)
        }
    }

    /**
     * @dev 実装アドレスをストレージから取得する内部関数
     * @return impl 実装コントラクトのアドレス
     */
    function _getImplementation() internal view returns (address impl) {
        assembly {
            impl := sload(IMPLEMENTATION_SLOT)
        }
    }

    /**
     * @dev 管理者アドレスをストレージから取得する内部関数
     * @return adm 管理者のアドレス
     */
    function _getAdmin() internal view returns (address adm) {
        assembly {
            adm := sload(ADMIN_SLOT)
        }
    }

    /**
     * @dev フォールバック関数 - すべての呼び出しを現在の実装に委譲
     */
    fallback() external payable {
        _delegate(_getImplementation());
    }

    /**
     * @dev レシーブ関数 - ETHの送金を受け入れる
     */
    receive() external payable {
        _delegate(_getImplementation());
    }

    /**
     * @dev 呼び出しを委譲する内部関数
     * @param implementation 委譲先の実装コントラクトのアドレス
     */
    function _delegate(address implementation) internal {
        assembly {
            // calldataをコピー
            calldatacopy(0, 0, calldatasize())
            
            // delegatecallを実行
            let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)
            
            // returndataをコピー
            returndatacopy(0, 0, returndatasize())
            
            switch result
            // delegatecallが失敗した場合
            case 0 {
                revert(0, returndatasize())
            }
            // delegatecallが成功した場合
            default {
                return(0, returndatasize())
            }
        }
    }
}
