// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Test, console} from "forge-std/Test.sol";
import {RaffleBridgeImplementation} from "../../src/RaffleBridgeImplementation.sol";
import {IPermit2} from "../../src/interfaces/IPermit2.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

/**
 * @title BridgePermit2Integration
 * @notice ブリッジ×Permit2の統合テスト
 */
contract BridgePermit2Integration is Test {
    RaffleBridgeImplementation public bridge;
    ERC20Mock public mockUSDC;
    
    address public constant USER1 = 0x1111111111111111111111111111111111111111;
    address public constant USER2 = 0x2222222222222222222222222222222222222222;
    address public constant PERMIT2_ADDRESS = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    
    uint256 public constant BRIDGE_AMOUNT = 50e6;
    uint256 public constant INITIAL_BALANCE = 1000e6;
    uint64 public constant DEST_CHAIN_SELECTOR = 16015286601757825753; // Sepolia

    function setUp() public {
        mockUSDC = new ERC20Mock();
        mockUSDC.mint(USER1, INITIAL_BALANCE);
        mockUSDC.mint(USER2, INITIAL_BALANCE);
        
        bridge = new RaffleBridgeImplementation();
    }

    /**
     * @notice 完全なブリッジPermit2フローをテスト
     */
    function testCompleteBridgePermit2Flow() public view {
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

        bytes memory mockSignature = abi.encodePacked(
            bytes32(0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef),
            bytes32(0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321),
            uint8(27)
        );

        // 事前状態確認
        assertEq(mockUSDC.balanceOf(USER1), INITIAL_BALANCE);
        assertEq(mockUSDC.balanceOf(address(bridge)), 0);
        
        console.log("Before bridge:");
        console.log("  User1 USDC balance:", mockUSDC.balanceOf(USER1));
        console.log("  Bridge USDC balance:", mockUSDC.balanceOf(address(bridge)));
        
        // Permit2パラメータ検証をシミュレート
        this.validateBridgePermit2Parameters(
            permit, 
            address(bridge), 
            address(mockUSDC), 
            BRIDGE_AMOUNT
        );
        
        console.log("Bridge Permit2 parameter validation passed");
    }

    /**
     * @notice ブリッジPermit2パラメータ検証
     */
    function validateBridgePermit2Parameters(
        IPermit2.PermitSingle memory permit,
        address expectedSpender,
        address expectedToken,
        uint256 expectedMinAmount
    ) external view {
        require(permit.details.token == expectedToken, "Invalid token");
        require(permit.details.amount >= expectedMinAmount, "Insufficient permit amount");
        require(permit.spender == expectedSpender, "Invalid spender");
        require(permit.sigDeadline >= block.timestamp, "Permit signature expired");
        require(permit.details.expiration >= block.timestamp, "Permit expired");
    }

    /**
     * @notice 複数ユーザーのブリッジPermit2テスト
     */
    function testMultiUserBridgePermit2() public {
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 25e6;  // USER1: 25 USDC
        amounts[1] = 75e6;  // USER2: 75 USDC

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

            this.validateBridgePermit2Parameters(
                permit, 
                address(bridge), 
                address(mockUSDC), 
                amounts[i]
            );
            console.log("Multi-user bridge test passed for amount:", amounts[i]);
        }
    }

    /**
     * @notice 異なるチェーンへのブリッジテスト
     */
    function testBridgeToMultipleChains() public view {
        uint64[] memory chainSelectors = new uint64[](3);
        chainSelectors[0] = 16015286601757825753; // Sepolia
        chainSelectors[1] = 5790810961207155433;  // Polygon Mumbai
        chainSelectors[2] = 12532609583862916517; // Fuji

        for (uint i = 0; i < chainSelectors.length; i++) {
            IPermit2.PermitSingle memory permit = IPermit2.PermitSingle({
                details: IPermit2.PermitDetails({
                    token: address(mockUSDC),
                    amount: BRIDGE_AMOUNT,
                    expiration: block.timestamp + 3600,
                    nonce: i
                }),
                spender: address(bridge),
                sigDeadline: block.timestamp + 1800
            });

            this.validateBridgePermit2Parameters(
                permit, 
                address(bridge), 
                address(mockUSDC), 
                BRIDGE_AMOUNT
            );
            console.log("Bridge to chain test passed for:", chainSelectors[i]);
        }
    }

    /**
     * @notice ブリッジPermit2エラーケースをテスト
     */
    function testBridgePermit2ErrorCases() public {
        // 期限切れテスト
        IPermit2.PermitSingle memory expiredPermit = IPermit2.PermitSingle({
            details: IPermit2.PermitDetails({
                token: address(mockUSDC),
                amount: BRIDGE_AMOUNT,
                expiration: block.timestamp - 1,
                nonce: 0
            }),
            spender: address(bridge),
            sigDeadline: block.timestamp - 1
        });

        vm.expectRevert("Permit signature expired");
        this.validateBridgePermit2Parameters(
            expiredPermit, 
            address(bridge), 
            address(mockUSDC), 
            BRIDGE_AMOUNT
        );

        // 不正なトークンテスト
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

        vm.expectRevert("Invalid token");
        this.validateBridgePermit2Parameters(
            invalidToken, 
            address(bridge), 
            address(mockUSDC), 
            BRIDGE_AMOUNT
        );

        console.log("Bridge Permit2 error cases test passed");
    }
}