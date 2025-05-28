// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./interfaces/IRaffle.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/CCIPInterface.sol";
import "./interfaces/IUUPSUpgradeable.sol";

/**
 * @title RaffleBridgeImplementation
 * @notice CCIPを使用して各チェーン間でUSDCをブリッジするためのコントラクト
 * @dev UUPS upgradeable pattern対応の実装コントラクト
 */
contract RaffleBridgeImplementation is IUUPSUpgradeable {
    /* 状態変数 */
    // CCIP Router
    address private s_defaultRouter;
    
    // チェーンごとのルーターアドレスのマッピング
    mapping(uint64 => address) private s_chainRouters;
    
    // USDC Token
    address private s_usdcAddress;
    
    // Raffle Contract
    address private s_raffleAddress;
    
    // オーナー
    address private s_owner;
    
    // サポートされている宛先チェーン
    mapping(uint64 => bool) private s_supportedChains;
    
    // チェーンセレクタをチェーン名にマッピング (UI表示用)
    mapping(uint64 => string) private s_chainNames;
    
    // 宛先チェーンごとの対応コントラクトアドレス
    mapping(uint64 => address) private s_destinationBridgeContracts;
    
    // チェーンごとのトークン流動性状態
    mapping(uint64 => bool) private s_chainPoolsLow;
    
    // サポートされているチェーンセレクタの配列
    uint64[] private s_supportedSelectorsArray;
    
    // トークン流動性の閾値
    uint256 private s_minimumPoolThreshold;
    
    // 初期化フラグ
    bool private s_initialized;
    
    // イベント
    event TokensBridged(
        address indexed sender,
        address indexed receiver,
        uint64 destinationChainSelector,
        uint256 amount,
        bytes32 messageId
    );
    
    event TokensReceived(
        uint64 sourceChainSelector,
        address indexed receiver,
        uint256 amount,
        bytes32 messageId
    );
    
    event PoolInitialized(uint256 amount);
    event PoolReplenished(uint256 amount);
    event LowPoolAlert(uint256 currentBalance, uint256 threshold);
    event RaffleAddressUpdated(address newRaffleAddress);
    event DefaultRouterUpdated(address indexed newRouter);
    event Upgraded(address indexed newImplementation);
    
    // ✅ デバッグ用イベント追加
    event DebugLog(string indexed functionName, string indexed stage, uint256 value);
    event DebugLogAddress(string indexed functionName, string indexed stage, address addr);
    event DebugLogBool(string indexed functionName, string indexed stage, bool flag);

    // 修飾子
    modifier onlyOwner() {
        require(msg.sender == s_owner, "Only owner can call this function");
        _;
    }

    /**
     * @dev 初期化確認の修飾子
     */
    modifier initializer() {
        require(!s_initialized, "Already initialized");
        _;
        s_initialized = true;
    }

    /**
     * @notice 初期化関数
     * @param router デフォルトのCCIPルーターのアドレス
     * @param routerAddresses 宛先チェーンのルーターアドレスの配列
     * @param routerChainSelectors ルーターに対応するチェーンセレクタの配列
     * @param usdcAddress USDCトークンのアドレス
     * @param supportedChainSelectors サポートする宛先チェーンのセレクタ配列
     * @param destinationBridgeContracts 宛先チェーンの対応するブリッジコントラクト配列
     * @param chainNames チェーン名の配列
     * @param minimumPoolThreshold 最小プール閾値
     */
    function initialize(
        address router,
        address[] memory routerAddresses,
        uint64[] memory routerChainSelectors,
        address usdcAddress,
        uint64[] memory supportedChainSelectors,
        address[] memory destinationBridgeContracts,
        string[] memory chainNames,
        uint256 minimumPoolThreshold
    ) external initializer {
        require(router != address(0), "Router cannot be zero address");
        require(usdcAddress != address(0), "USDC address cannot be zero address");
        require(
            supportedChainSelectors.length == destinationBridgeContracts.length &&
            supportedChainSelectors.length == chainNames.length,
            "Array length mismatch"
        );
        require(
            routerAddresses.length == routerChainSelectors.length,
            "Router arrays length mismatch"
        );
        
        s_defaultRouter = router;
        s_usdcAddress = usdcAddress;
        s_owner = msg.sender;
        s_minimumPoolThreshold = minimumPoolThreshold;
        
        // サポートチェーンの設定
        s_supportedSelectorsArray = supportedChainSelectors;
        for (uint256 i = 0; i < supportedChainSelectors.length; i++) {
            s_supportedChains[supportedChainSelectors[i]] = true;
            s_destinationBridgeContracts[supportedChainSelectors[i]] = destinationBridgeContracts[i];
            s_chainNames[supportedChainSelectors[i]] = chainNames[i];
        }
        
        // チェーンごとのルーターアドレスの設定
        for (uint256 i = 0; i < routerChainSelectors.length; i++) {
            s_chainRouters[routerChainSelectors[i]] = routerAddresses[i];
        }
    }

    /**
     * @notice コントラクトをアップグレードするための関数
     * @param newImplementation 新しい実装アドレス
     */
    function upgradeTo(address newImplementation) external override onlyOwner {
        _authorizeUpgrade(newImplementation);
        _upgradeTo(newImplementation);
    }

    /**
     * @notice コントラクトをアップグレードし、初期化関数を呼び出す関数
     * @param newImplementation 新しい実装アドレス
     * @param data 初期化データ
     */
    function upgradeToAndCall(address newImplementation, bytes memory data) external payable override onlyOwner {
        _authorizeUpgrade(newImplementation);
        _upgradeTo(newImplementation);
        
        // 初期化関数を呼び出す
        (bool success, ) = newImplementation.delegatecall(data);
        require(success, "Call failed");
    }

    /**
     * @notice UUPSアップグレードの承認関数
     * @param newImplementation 新しい実装コントラクトのアドレス
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        require(newImplementation != address(0), "Invalid implementation address");
    }

    /**
     * @dev 実装コントラクトを更新する内部関数
     * @param newImplementation 新しい実装コントラクトのアドレス
     */
    function _upgradeTo(address newImplementation) internal {
        require(newImplementation != address(0), "Implementation cannot be zero address");
        
        // コードスロットに新しい実装を書き込む
        assembly {
            sstore(0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc, newImplementation)
        }
        

    }

    /**
     * @notice チェーンセレクタに対応するルーターアドレスを取得する内部関数
     * @param chainSelector チェーンセレクタ
     * @return ルーターアドレス
     */
    function _getRouterForChain(uint64 chainSelector) internal view returns (address) {
        // The s_chainRouters mapping, as populated by the current deployer,
        // maps destination chain selectors to routers ON THOSE DESTINATION CHAINS.
        // This is not what we need for getFee/ccipSend, which must be called on the SOURCE chain's router.
        // Therefore, we should always use s_defaultRouter, which is set to the current chain's router during initialization.
        
        // The chainSelector parameter is intentionally not used in this corrected logic.
        // You can add `uint64 memory _ = chainSelector;` if needed to silence compiler warnings about unused parameters.
        return s_defaultRouter; 
    }

    /**
     * @notice チェーンのルーターアドレスを設定する関数
     * @param chainSelector チェーンセレクタ
     * @param routerAddress ルーターアドレス
     */
    function setChainRouter(uint64 chainSelector, address routerAddress) external onlyOwner {
        require(routerAddress != address(0), "Router address cannot be zero");
        s_chainRouters[chainSelector] = routerAddress;
    }

    /**
     * @notice USDCをブリッジする関数 (CCIP Pool-based Pattern + 安全なtransferFrom)
     * @param destinationChainSelector 宛先チェーンのセレクタ
     * @param receiver 受取人のアドレス
     * @param amount ブリッジするUSDCの量
     * @dev Pool-based pattern: ユーザー → ブリッジプール → CCIP（データのみ）
     */
    function bridgeTokens(
        uint64 destinationChainSelector,
        address receiver,
        uint256 amount
    ) external payable {
        // ============ デバッグログ開始 ============
        emit DebugLog("bridgeTokens", "function_start", 0);
        emit DebugLogAddress("bridgeTokens", "sender", msg.sender);
        emit DebugLogAddress("bridgeTokens", "receiver", receiver);
        emit DebugLog("bridgeTokens", "amount", amount);
        
        // 基本的なチェック
        require(amount > 0, "Amount must be greater than 0");
        require(s_supportedChains[destinationChainSelector], "Destination chain not supported");
        require(receiver != address(0), "Receiver cannot be zero address");
        
        emit DebugLog("bridgeTokens", "basic_checks_passed", 1);
        
        // USDC Token
        IERC20 usdc = IERC20(s_usdcAddress);
        address routerAddress = s_defaultRouter;
        require(routerAddress != address(0), "ERR:NO_ROUTER");
        
        emit DebugLogAddress("bridgeTokens", "usdc_address", s_usdcAddress);
        emit DebugLogAddress("bridgeTokens", "router_address", routerAddress);
        
        // ============ 詳細な残高・承認チェック ============
        uint256 userBalance = usdc.balanceOf(msg.sender);
        uint256 bridgeAllowance = usdc.allowance(msg.sender, address(this));
        uint256 contractBalanceBefore = usdc.balanceOf(address(this));
        
        emit DebugLog("bridgeTokens", "user_balance", userBalance);
        emit DebugLog("bridgeTokens", "bridge_allowance", bridgeAllowance);
        emit DebugLog("bridgeTokens", "contract_balance_before", contractBalanceBefore);
        
        require(userBalance >= amount, "Insufficient USDC balance");
        require(bridgeAllowance >= amount, "Please approve bridge contract for USDC transfer");
        
        emit DebugLog("bridgeTokens", "balance_allowance_checks_passed", 2);
        
        // ============ より安全なtransferFromパターン ============
        emit DebugLog("bridgeTokens", "before_transferFrom", 3);
        
        // ✅ 修正: transferFromを実行する前に、承認額を再確認
        uint256 currentAllowance = usdc.allowance(msg.sender, address(this));
        emit DebugLog("bridgeTokens", "current_allowance_recheck", currentAllowance);
        require(currentAllowance >= amount, "Allowance insufficient at execution time");
        
        // ✅ 修正: より安全なtransferFromの実行
        bool transferSuccess = usdc.transferFrom(msg.sender, address(this), amount);
        require(transferSuccess, "USDC transfer to bridge contract failed");
        
        emit DebugLog("bridgeTokens", "transferFrom_success", 4);
        
        // 転送後の残高確認
        uint256 newUserBalance = usdc.balanceOf(msg.sender);
        uint256 newContractBalance = usdc.balanceOf(address(this));
        
        emit DebugLog("bridgeTokens", "new_user_balance", newUserBalance);
        emit DebugLog("bridgeTokens", "new_contract_balance", newContractBalance);
        
        // ✅ 追加: 転送量の検証
        require(newContractBalance >= contractBalanceBefore + amount, "Contract balance increase verification failed");
        require(newUserBalance == userBalance - amount, "User balance decrease verification failed");
        
        // メッセージデータを準備
        bytes memory messageData = abi.encode(receiver, amount);
        
        // CCIPメッセージを準備（トークンなし）
        CCIPInterface.EVM2AnyMessage memory message = CCIPInterface.EVM2AnyMessage({
            receiver: abi.encode(s_destinationBridgeContracts[destinationChainSelector]),
            data: messageData,
            tokenAmounts: new CCIPInterface.EVMTokenAmount[](0), // 空の配列
            feeToken: address(0),
            extraArgs: abi.encodePacked(bytes4(0x97a657c9), abi.encode(uint256(200_000)))
        });
        
        // 手数料を計算
        uint256 fee = CCIPInterface(routerAddress).getFee(destinationChainSelector, message);
        require(msg.value >= fee, "Insufficient fee for CCIP transaction");
        
        emit DebugLog("bridgeTokens", "fee_calculated", fee);
        
        // CCIPメッセージを送信
        bytes32 messageId = CCIPInterface(routerAddress).ccipSend{value: fee}(
            destinationChainSelector,
            message
        );
        
        emit DebugLog("bridgeTokens", "ccip_sent", 5);
        
        // イベント発行
        emit TokensBridged(
            msg.sender,
            receiver,
            destinationChainSelector,
            amount,
            messageId
        );
        
        // 残りのETHを返金
        if (msg.value > fee) {
            (bool success, ) = msg.sender.call{value: msg.value - fee}("");
            require(success, "Refund failed");
        }
        
        emit DebugLog("bridgeTokens", "function_completed", 6);
    }

    /**
     * @notice CCIP経由でメッセージを受信する関数 (Pool Pattern)
     * @param message 受信したメッセージ
     */
    function ccipReceive(CCIPInterface.Any2EVMMessage memory message) external {
        require(msg.sender == s_defaultRouter, "Only router can call ccipReceive");
        
        // メッセージデータをデコード
        (address receiver, uint256 amount) = abi.decode(message.data, (address, uint256));
        
        // ✅ Pool Pattern: プールから受取人にUSDCを送金
        IERC20 usdc = IERC20(s_usdcAddress);
        uint256 poolBalance = usdc.balanceOf(address(this));
        require(poolBalance >= amount, "Insufficient pool balance");
        
        require(usdc.transfer(receiver, amount), "USDC transfer to receiver failed");
        
        // イベント発行 - ✅ 修正: uint256からuint64への明示的キャスト
        emit TokensReceived(
            uint64(message.sourceChainSelector),
            receiver,
            amount,
            message.messageId
        );
    }

    /**
     * @notice トークンプールを初期化する関数
     * @param amount 初期化する量
     */
    function initializePool(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        
        // オーナーからコントラクトにUSDCを転送
        IERC20 usdc = IERC20(s_usdcAddress);
        require(usdc.transferFrom(msg.sender, address(this), amount), "USDC transfer failed");
        
        // プール状態を更新
        _updatePoolStatus();
        
        // イベント発行
        emit PoolInitialized(amount);
    }

    /**
     * @dev プール状態を更新する内部関数
     */
    function _updatePoolStatus() internal {
        IERC20 usdc = IERC20(s_usdcAddress);
        uint256 currentBalance = usdc.balanceOf(address(this));
        bool isLow = currentBalance < s_minimumPoolThreshold;
        
        // すべてのチェーンのプール状態を更新
        for (uint256 i = 0; i < s_supportedSelectorsArray.length; i++) {
            s_chainPoolsLow[s_supportedSelectorsArray[i]] = isLow;
        }
        
        if (isLow) {
            emit LowPoolAlert(currentBalance, s_minimumPoolThreshold);
        }
    }

    /**
     * @notice プールを補充する関数
     * @param amount 補充する量
     */
    function replenishPool(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        
        // オーナーからコントラクトにUSDCを転送
        IERC20 usdc = IERC20(s_usdcAddress);
        require(usdc.transferFrom(msg.sender, address(this), amount), "USDC transfer failed");
        
        // プール状態を更新
        _updatePoolStatus();
        
        // イベント発行
        emit PoolReplenished(amount);
    }

    /**
     * @notice ラッフルアドレスを設定する関数
     * @param raffleAddress 新しいラッフルアドレス
     */
    function setRaffleAddress(address raffleAddress) external onlyOwner {
        require(raffleAddress != address(0), "Raffle address cannot be zero address");
        s_raffleAddress = raffleAddress;
        emit RaffleAddressUpdated(raffleAddress);
    }

    /**
     * @notice オーナーを変更する関数
     * @param newOwner 新しいオーナーのアドレス
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        s_owner = newOwner;
    }

    /**
     * @notice 最小プール閾値を設定する関数
     * @param threshold 新しい閾値
     */
    function setMinimumPoolThreshold(uint256 threshold) external onlyOwner {
        require(threshold > 0, "Threshold must be greater than 0");
        s_minimumPoolThreshold = threshold;
    }

    /**
     * @notice デフォルトルーターアドレスを設定する関数（緊急修正用）
     * @param newDefaultRouter 新しいデフォルトルーターアドレス
     */
    function setDefaultRouter(address newDefaultRouter) external onlyOwner {
        require(newDefaultRouter != address(0), "Router address cannot be zero");
        s_defaultRouter = newDefaultRouter;
        emit DefaultRouterUpdated(newDefaultRouter);
    }

    /**
     * @notice 宛先ブリッジコントラクトアドレスを更新する関数
     * @param chainSelector チェーンセレクタ
     * @param bridgeContract 新しいブリッジコントラクトアドレス
     */
    function updateDestinationBridgeContract(uint64 chainSelector, address bridgeContract) external onlyOwner {
        require(s_supportedChains[chainSelector], "Chain not supported");
        require(bridgeContract != address(0), "Bridge contract cannot be zero address");
        s_destinationBridgeContracts[chainSelector] = bridgeContract;
    }

    /* View / Pure functions */

    /**
     * @notice プール残高を取得する関数
     * @return USDC残高
     */
    function getPoolBalance() external view returns (uint256) {
        return IERC20(s_usdcAddress).balanceOf(address(this));
    }

    /**
     * @notice サポートされているチェーンセレクタを取得する関数
     * @return supportedSelectors サポートされているチェーンセレクタの配列
     */
    function getSupportedChainSelectors() public view returns (uint64[] memory) {
        return s_supportedSelectorsArray;
    }

    /**
     * @notice 宛先チェーンの情報を取得する関数
     * @param chainSelector チェーンセレクタ
     * @return supported サポートされているかどうか
     * @return name チェーン名
     * @return bridgeContract ブリッジコントラクトアドレス
     * @return poolLow プール残高が少ないかどうか
     */
    function getDestinationChainInfo(uint64 chainSelector) external view returns (
        bool supported,
        string memory name,
        address bridgeContract,
        bool poolLow
    ) {
        return (
            s_supportedChains[chainSelector],
            s_chainNames[chainSelector],
            s_destinationBridgeContracts[chainSelector],
            s_chainPoolsLow[chainSelector]
        );
    }

    /**
     * @notice チェーンのルーターアドレスを取得する関数
     * @param chainSelector チェーンセレクタ
     * @return router ルーターアドレス
     */
    function getChainRouter(uint64 chainSelector) external view returns (address router) {
        return _getRouterForChain(chainSelector);
    }

    /**
     * @notice 基本情報を取得する関数
     * @return usdcAddress USDCアドレス
     * @return raffleAddress ラッフルアドレス
     * @return owner オーナーアドレス
     * @return minimumPoolThreshold 最小プール閾値
     */
    function getInfo() external view returns (
        address usdcAddress,
        address raffleAddress,
        address owner,
        uint256 minimumPoolThreshold
    ) {
        return (
            s_usdcAddress,
            s_raffleAddress,
            s_owner,
            s_minimumPoolThreshold
        );
    }

    /**
     * @notice CCIPルーターのallowanceを確認するヘルパー関数
     * @param user ユーザーアドレス
     * @param destinationChainSelector 宛先チェーンセレクタ
     * @return allowance CCIPルーターへの承認額
     * @return routerAddress CCIPルーターアドレス
     */
    function getRouterAllowance(address user, uint64 destinationChainSelector) external view returns (
        uint256 allowance,
        address routerAddress
    ) {
        routerAddress = _getRouterForChain(destinationChainSelector);
        if (routerAddress != address(0)) {
            IERC20 usdc = IERC20(s_usdcAddress);
            allowance = usdc.allowance(user, routerAddress);
        }
        return (allowance, routerAddress);
    }

    /**
     * @notice デフォルトルーターアドレスを取得する関数
     * @return defaultRouter デフォルトルーターアドレス
     */
    function getDefaultRouter() external view returns (address defaultRouter) {
        return s_defaultRouter;
    }

    /**
     * @notice CCIP手数料を見積もる関数 (Pool-based Pattern)
     * @param destinationChainSelector 宛先チェーンのセレクタ
     * @param receiver 受取人のアドレス
     * @param amount ブリッジするUSDCの量
     * @return fee 見積もられた手数料
     */
    function estimateFee(
        uint64 destinationChainSelector,
        address receiver,
        uint256 amount
    ) external view returns (uint256 fee) {
        // 基本チェック
        require(s_supportedChains[destinationChainSelector], "ERR:UNSUPPORTED_CHAIN");
        require(amount > 0, "ERR:INVALID_AMOUNT");
        
        address destinationBridge = s_destinationBridgeContracts[destinationChainSelector];
        require(destinationBridge != address(0), "ERR:NO_DESTINATION_BRIDGE");
        
        address routerAddress = s_defaultRouter; // ✅ ソースチェーンのルーター
        require(routerAddress != address(0), "ERR:NO_ROUTER");
        
        bytes memory messageData = abi.encode(receiver, amount);
        
        // ✅ Pool Pattern: トークン転送なしのメッセージ
        CCIPInterface.EVM2AnyMessage memory message = CCIPInterface.EVM2AnyMessage({
            receiver: abi.encode(destinationBridge),
            data: messageData,
            tokenAmounts: new CCIPInterface.EVMTokenAmount[](0), // ✅ 空の配列
            feeToken: address(0),
            extraArgs: abi.encodePacked(
                bytes4(0x97a657c9),
                abi.encode(uint256(200_000))
            )
        });
        
        return CCIPInterface(routerAddress).getFee(destinationChainSelector, message);
    }

    /**
     * @notice 緊急時にコントラクト内のUSDCを回収する関数（オーナー専用）
     * @param amount 回収する量
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        IERC20 usdc = IERC20(s_usdcAddress);
        uint256 contractBalance = usdc.balanceOf(address(this));
        require(contractBalance >= amount, "Insufficient contract balance");
        require(usdc.transfer(s_owner, amount), "Emergency withdrawal failed");
    }

    /**
     * @notice ユーザーの承認状況を確認するヘルパー関数
     * @param user ユーザーアドレス
     * @return allowance ブリッジコントラクトへの承認額
     * @return balance ユーザーのUSDC残高
     */
    function getUserApprovalStatus(address user) external view returns (
        uint256 allowance,
        uint256 balance
    ) {
        IERC20 usdc = IERC20(s_usdcAddress);
        allowance = usdc.allowance(user, address(this)); // ✅ ブリッジコントラクトへの承認
        balance = usdc.balanceOf(user);
    }

    /**
     * @dev コントラクトがネイティブトークンを受け取れるようにする
     */
    receive() external payable {}
}