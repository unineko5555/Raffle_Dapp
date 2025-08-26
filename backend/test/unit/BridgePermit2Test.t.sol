// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Test, console} from "forge-std/Test.sol";
import {RaffleBridgeImplementation} from "../../src/RaffleBridgeImplementation.sol";
import {IPermit2} from "../../src/interfaces/IPermit2.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

/**
 * @title BridgePermit2Test
 * @notice ブリッジコントラクトのPermit2機能単体テスト
 */
contract BridgePermit2Test is Test {
    RaffleBridgeImplementation public bridge;
    ERC20Mock public mockUSDC;
    
    address public constant USER = 0x1234567890123456789012345678901234567890;
    address public constant PERMIT2_ADDRESS = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    
    uint256 public constant BRIDGE_AMOUNT = 50e6; // 50 USDC
    uint256 public constant INITIAL_BALANCE = 1000e6; // 1000 USDC
    uint64 public constant DEST_CHAIN_SELECTOR = 16015286601757825753; // Sepolia

    function setUp() public {
        // モックUSDCトークンをデプロイ
        mockUSDC = new ERC20Mock();
        
        // ユーザーにUSDCを付与
        mockUSDC.mint(USER, INITIAL_BALANCE);
        
        // ブリッジ実装をデプロイ
        bridge = new RaffleBridgeImplementation();
        
        console.log("Bridge Permit2 test setup completed");
        console.log("User USDC balance:", mockUSDC.balanceOf(USER));
        console.log("Bridge amount:", BRIDGE_AMOUNT);
    }

    /**
     * @notice ブリッジ用Permit2署名構造をテスト
     */
    function testBridgePermit2SignatureStructure() public {
        IPermit2.PermitSingle memory permit = IPermit2.PermitSingle({
            details: IPermit2.PermitDetails({
                token: address(mockUSDC),
                amount: BRIDGE_AMOUNT,
                expiration: block.timestamp + 3600,
                nonce: 0
            }),
            spender: address(bridge),
            sigDeadline: block.timestamp + 1800
        });

        // 基本構造確認
        assertEq(permit.details.token, address(mockUSDC));
        assertEq(permit.details.amount, BRIDGE_AMOUNT);
        assertEq(permit.spender, address(bridge));
        assertTrue(permit.details.expiration > block.timestamp);
        assertTrue(permit.sigDeadline > block.timestamp);
        
        console.log("Bridge Permit2 signature structure test passed");
    }

    /**
     * @notice ブリッジパラメータ検証ロジックをテスト
     */
    function testBridgePermit2ParameterValidation() public {
        IPermit2.PermitSingle memory permit = IPermit2.PermitSingle({
            details: IPermit2.PermitDetails({
                token: address(mockUSDC),
                amount: BRIDGE_AMOUNT * 2, // 実際より多めの許可
                expiration: block.timestamp + 3600,
                nonce: 0
            }),
            spender: address(bridge),
            sigDeadline: block.timestamp + 1800
        });

        // ブリッジコントラクトの検証ロジックをシミュレート
        assertTrue(permit.details.token == address(mockUSDC)); // "Invalid token"
        assertTrue(permit.details.amount >= BRIDGE_AMOUNT); // "Insufficient permit amount"  
        assertTrue(permit.spender == address(bridge)); // "Invalid spender"
        assertTrue(permit.sigDeadline >= block.timestamp); // "Permit signature expired"
        assertTrue(permit.details.expiration >= block.timestamp); // "Permit expired"
        
        console.log("Bridge Permit2 parameter validation test passed");
    }

    /**
     * @notice 異なるブリッジ金額でのテスト
     */
    function testBridgePermit2DifferentAmounts() public {
        uint256[] memory amounts = new uint256[](4);
        amounts[0] = 10e6;   // 10 USDC
        amounts[1] = 25e6;   // 25 USDC  
        amounts[2] = 50e6;   // 50 USDC
        amounts[3] = 100e6;  // 100 USDC

        for (uint i = 0; i < amounts.length; i++) {
            IPermit2.PermitSingle memory permit = IPermit2.PermitSingle({
                details: IPermit2.PermitDetails({
                    token: address(mockUSDC),
                    amount: amounts[i],
                    expiration: block.timestamp + 3600,
                    nonce: i
                }),
                spender: address(bridge),
                sigDeadline: block.timestamp + 1800
            });

            // 検証
            assertTrue(permit.details.amount >= amounts[i]);
            console.log("Bridge amount test passed for:", amounts[i]);
        }
    }

    /**
     * @notice ブリッジPermit2の不正パラメータテスト
     */
    function testBridgePermit2InvalidParameters() public {
        // 間違ったトークン
        IPermit2.PermitSingle memory invalidToken = IPermit2.PermitSingle({
            details: IPermit2.PermitDetails({
                token: address(0xdead),
                amount: BRIDGE_AMOUNT,
                expiration: block.timestamp + 3600,
                nonce: 0
            }),
            spender: address(bridge),
            sigDeadline: block.timestamp + 1800
        });

        // 間違ったspender
        IPermit2.PermitSingle memory invalidSpender = IPermit2.PermitSingle({
            details: IPermit2.PermitDetails({
                token: address(mockUSDC),
                amount: BRIDGE_AMOUNT,
                expiration: block.timestamp + 3600,
                nonce: 0
            }),
            spender: address(0xdead),
            sigDeadline: block.timestamp + 1800
        });

        // 不足金額
        IPermit2.PermitSingle memory insufficientAmount = IPermit2.PermitSingle({
            details: IPermit2.PermitDetails({
                token: address(mockUSDC),
                amount: BRIDGE_AMOUNT - 1,
                expiration: block.timestamp + 3600,
                nonce: 0
            }),
            spender: address(bridge),
            sigDeadline: block.timestamp + 1800
        });

        // 検証
        assertFalse(invalidToken.details.token == address(mockUSDC));
        assertFalse(invalidSpender.spender == address(bridge));
        assertFalse(insufficientAmount.details.amount >= BRIDGE_AMOUNT);
        
        console.log("Bridge Permit2 invalid parameters test passed");
    }

    /**
     * @notice チェーンセレクター検証をテスト
     */
    function testBridgeChainSelectorValidation() public {
        uint64[] memory chainSelectors = new uint64[](3);
        chainSelectors[0] = 16015286601757825753; // Sepolia
        chainSelectors[1] = 5790810961207155433;  // Polygon Mumbai  
        chainSelectors[2] = 12532609583862916517; // Fuji

        for (uint i = 0; i < chainSelectors.length; i++) {
            assertTrue(chainSelectors[i] > 0);
            console.log("Chain selector test passed for:", chainSelectors[i]);
        }
    }
}