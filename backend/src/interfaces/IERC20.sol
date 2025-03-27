// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * @title ERC20インターフェース
 * @dev ERC20標準に準拠するトークンのインターフェース
 */
interface IERC20 {
    /**
     * @dev トークンの総供給量を返します
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev 指定されたアカウントが所有するトークンの量を返します
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev 指定された受取人へトークンを転送します
     * @return 成功したかどうか
     */
    function transfer(address to, uint256 amount) external returns (bool);

    /**
     * @dev 指定したアカウントに対する許可額を返します
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev 指定したスペンダーにtokens from msg.senderを使用する許可を与えます
     * @return 成功したかどうか
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev 指定されたスペンダーがfromアカウントからtoアカウントへトークンを転送することを許可します
     * @return 成功したかどうか
     */
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    /**
     * @dev トークン転送が発生した時に発行されるイベント
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev トークン承認が発生した時に発行されるイベント
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);
}
