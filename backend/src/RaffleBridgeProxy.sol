// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./interfaces/IUUPSUpgradeable.sol";

/**
 * @title RaffleBridgeProxy
 * @notice UUPSプロキシパターンを使用したアップグレード可能なブリッジプロキシ
 * @dev OZのUUPSProxyをベースにしたシンプルな実装
 */
contract RaffleBridgeProxy {
    // ストレージスロット keccak256("eip1967.proxy.implementation") - 1 = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
    bytes32 private constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    
    // ストレージスロット keccak256("eip1967.proxy.admin") - 1 = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"
    bytes32 private constant ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    /**
     * @notice プロキシコンストラクタ
     * @param implementationContract 初期実装コントラクトのアドレス
     * @param initData 初期化用のデータ
     */
    constructor(address implementationContract, bytes memory initData) {
        _setAdmin(msg.sender);
        _setImplementation(implementationContract);
        
        if (initData.length > 0) {
            (bool success, ) = implementationContract.delegatecall(initData);
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
        // 新しい実装がコントラクトコードを持っているか確認
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(newImplementation)
        }
        require(codeSize > 0, "New implementation is not a contract");
        
        // 新しい実装が互換性があるか確認
        // UUPS互換性のチェックを簡略化
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
     * @param implementationContract 委譲先の実装コントラクトのアドレス
     */
    function _delegate(address implementationContract) internal {
        assembly {
            // calldataをコピー
            calldatacopy(0, 0, calldatasize())
            
            // delegatecallを実行
            let result := delegatecall(gas(), implementationContract, 0, calldatasize(), 0, 0)
            
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
