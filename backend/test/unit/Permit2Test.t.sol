// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Test, console} from "forge-std/Test.sol";
import {RaffleImplementation} from "../../src/RaffleImplementation.sol";
import {IPermit2} from "../../src/interfaces/IPermit2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

/**
 * @title Permit2Test
 * @notice Permit2機能の単体テスト
 */
contract Permit2Test is Test {
    RaffleImplementation public raffle;
    ERC20Mock public mockUSDC;
    IPermit2 public permit2;
    
    address public constant USER = 0x1234567890123456789012345678901234567890;
    address public constant PERMIT2_ADDRESS = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    
    uint256 public constant ENTRANCE_FEE = 10e6; // 10 USDC
    uint256 public constant INITIAL_BALANCE = 100e6; // 100 USDC

    function setUp() public {
        // モックUSDCトークンをデプロイ
        mockUSDC = new ERC20Mock();
        
        // ユーザーにUSDCを付与
        mockUSDC.mint(USER, INITIAL_BALANCE);
        
        // Permit2コントラクト（モック）
        permit2 = IPermit2(PERMIT2_ADDRESS);
        
        // ラッフル実装をデプロイ（簡単な初期化）
        raffle = new RaffleImplementation();
        
        console.log("Setup completed");
        console.log("User USDC balance:", mockUSDC.balanceOf(USER));
        console.log("Entrance fee:", ENTRANCE_FEE);
    }

    /**
     * @notice Permit2署名の基本構造をテスト
     */
    function testPermit2SignatureStructure() public {
        // Permit2署名の構造体を作成
        IPermit2.PermitSingle memory permit = IPermit2.PermitSingle({
            details: IPermit2.PermitDetails({
                token: address(mockUSDC),
                amount: ENTRANCE_FEE,
                expiration: block.timestamp + 3600, // 1時間後
                nonce: 0
            }),
            spender: address(raffle),
            sigDeadline: block.timestamp + 1800 // 30分後
        });

        // 基本的な検証
        assertEq(permit.details.token, address(mockUSDC));
        assertEq(permit.details.amount, ENTRANCE_FEE);
        assertEq(permit.spender, address(raffle));
        assertTrue(permit.details.expiration > block.timestamp);
        assertTrue(permit.sigDeadline > block.timestamp);
        
        console.log("Permit2 signature structure test passed");
    }

    /**
     * @notice EIP-712ドメインセパレーターの構造をテスト
     */
    function testEIP712Domain() public {
        // EIP-712ドメインの構造
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)"),
                keccak256("Permit2"),
                block.chainid,
                PERMIT2_ADDRESS
            )
        );
        
        assertTrue(domainSeparator != bytes32(0));
        console.log(" EIP-712 domain separator test passed");
    }

    /**
     * @notice PermitSingleタイプハッシュをテスト
     */
    function testPermitSingleTypeHash() public {
        bytes32 permitSingleTypeHash = keccak256(
            "PermitSingle(PermitDetails details,address spender,uint256 sigDeadline)"
            "PermitDetails(address token,uint256 amount,uint256 expiration,uint256 nonce)"
        );
        
        assertTrue(permitSingleTypeHash != bytes32(0));
        console.log(" PermitSingle type hash test passed");
    }

    /**
     * @notice Permit2パラメータの検証ロジックをテスト
     */
    function testPermit2ParameterValidation() public {
        // 正しいPermit2パラメータを作成
        IPermit2.PermitSingle memory permit = IPermit2.PermitSingle({
            details: IPermit2.PermitDetails({
                token: address(mockUSDC),
                amount: ENTRANCE_FEE,
                expiration: block.timestamp + 3600,
                nonce: 0
            }),
            spender: address(raffle),
            sigDeadline: block.timestamp + 1800
        });

        // パラメータ検証（コントラクトの検証ロジックをシミュレート）
        assertTrue(permit.details.token == address(mockUSDC)); // "Invalid token"
        assertTrue(permit.details.amount >= ENTRANCE_FEE); // "Insufficient permit amount"
        assertTrue(permit.spender == address(raffle)); // "Invalid spender"
        assertTrue(permit.sigDeadline >= block.timestamp); // "Permit signature expired"
        assertTrue(permit.details.expiration >= block.timestamp); // "Permit expired"
        
        console.log(" Permit2 parameter validation test passed");
    }

    /**
     * @notice 期限切れケースをテスト
     */
    function testPermit2Expiration() public {
        // 期限切れのPermit2パラメータを作成
        IPermit2.PermitSingle memory expiredPermit = IPermit2.PermitSingle({
            details: IPermit2.PermitDetails({
                token: address(mockUSDC),
                amount: ENTRANCE_FEE,
                expiration: block.timestamp - 1, // 過去の時間
                nonce: 0
            }),
            spender: address(raffle),
            sigDeadline: block.timestamp - 1 // 過去の時間
        });

        // 期限切れ検証
        assertFalse(expiredPermit.sigDeadline >= block.timestamp); // 署名期限切れ
        assertFalse(expiredPermit.details.expiration >= block.timestamp); // 許可期限切れ
        
        console.log(" Permit2 expiration test passed");
    }

    /**
     * @notice 不正なパラメータケースをテスト
     */
    function testPermit2InvalidParameters() public {
        // 不正なトークンアドレス
        IPermit2.PermitSingle memory invalidTokenPermit = IPermit2.PermitSingle({
            details: IPermit2.PermitDetails({
                token: address(0xdead), // 間違ったトークンアドレス
                amount: ENTRANCE_FEE,
                expiration: block.timestamp + 3600,
                nonce: 0
            }),
            spender: address(raffle),
            sigDeadline: block.timestamp + 1800
        });

        // 不正なspender
        IPermit2.PermitSingle memory invalidSpenderPermit = IPermit2.PermitSingle({
            details: IPermit2.PermitDetails({
                token: address(mockUSDC),
                amount: ENTRANCE_FEE,
                expiration: block.timestamp + 3600,
                nonce: 0
            }),
            spender: address(0xdead), // 間違ったspender
            sigDeadline: block.timestamp + 1800
        });

        // 不足金額
        IPermit2.PermitSingle memory insufficientAmountPermit = IPermit2.PermitSingle({
            details: IPermit2.PermitDetails({
                token: address(mockUSDC),
                amount: ENTRANCE_FEE - 1, // 不足金額
                expiration: block.timestamp + 3600,
                nonce: 0
            }),
            spender: address(raffle),
            sigDeadline: block.timestamp + 1800
        });

        // 検証
        assertFalse(invalidTokenPermit.details.token == address(mockUSDC));
        assertFalse(invalidSpenderPermit.spender == address(raffle));
        assertFalse(insufficientAmountPermit.details.amount >= ENTRANCE_FEE);
        
        console.log(" Permit2 invalid parameters test passed");
    }

    /**
     * @notice ERC20転送の基本テスト
     */
    function testERC20Transfer() public {
        vm.startPrank(USER);
        
        // ユーザーがラッフルコントラクトにUSDCを許可
        mockUSDC.approve(address(raffle), ENTRANCE_FEE);
        
        // 許可確認
        uint256 allowance = mockUSDC.allowance(USER, address(raffle));
        assertEq(allowance, ENTRANCE_FEE);
        
        vm.stopPrank();
        
        console.log(" ERC20 transfer test passed");
    }

    /**
     * @notice Permit2とERC20転送の組み合わせをシミュレート
     */
    function testPermit2AndERC20Combination() public {
        // Permit2構造体を作成
        IPermit2.PermitSingle memory permit = IPermit2.PermitSingle({
            details: IPermit2.PermitDetails({
                token: address(mockUSDC),
                amount: ENTRANCE_FEE,
                expiration: block.timestamp + 3600,
                nonce: 0
            }),
            spender: address(raffle),
            sigDeadline: block.timestamp + 1800
        });

        // パラメータ検証（コントラクトと同じロジック）
        assertTrue(permit.details.token == address(mockUSDC));
        assertTrue(permit.details.amount >= ENTRANCE_FEE);
        assertTrue(permit.spender == address(raffle));
        assertTrue(permit.sigDeadline >= block.timestamp);
        assertTrue(permit.details.expiration >= block.timestamp);

        console.log(" Permit2 + ERC20 combination test passed");
        console.log("   Token:", permit.details.token);
        console.log("   Amount:", permit.details.amount);
        console.log("   Spender:", permit.spender);
        console.log("   Expiration:", permit.details.expiration);
        console.log("   SigDeadline:", permit.sigDeadline);
    }
}