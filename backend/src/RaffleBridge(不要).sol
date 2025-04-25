// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./interfaces/IRaffle.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/CCIPInterface.sol";

/**
 * @title RaffleBridge
 * @notice CCIPを使用して各チェーン間でUSDCをブリッジするためのコントラクト
 * @dev Sepolia、Arbitrum Sepolia、Base Sepoliaで使用
 */
contract RaffleBridge {
    /* 状態変数 */
    // CCIP Router
    address private immutable s_defaultRouter;
    
    // チェーンごとのルーターアドレスのマッピング
    mapping(uint64 => address) private s_chainRouters;
    
    // USDC Token
    address private immutable s_usdcAddress;
    
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
    
    // イベント
    event TokensBridged(
        address indexed sender,
        address indexed receiver,
        uint64 destinationChainSelector,
        uint256 amount,
        bytes32 messageId,
        bool autoEnterRaffle
    );
    
    event TokensReceived(
        uint64 sourceChainSelector,
        address indexed receiver,
        uint256 amount,
        bytes32 messageId,
        bool autoEnterRaffle
    );
    
    event PoolInitialized(uint256 amount);
    event PoolReplenished(uint256 amount);
    event LowPoolAlert(uint256 currentBalance, uint256 threshold);
    event RaffleAddressUpdated(address newRaffleAddress);

    // 修飾子
    modifier onlyOwner() {
        require(msg.sender == s_owner, "Only owner can call this function");
        _;
    }

    /**
     * @notice チェーンセレクタに対応するルーターアドレスを取得する内部関数
     * @param chainSelector チェーンセレクタ
     * @return ルーターアドレス
     */
    function _getRouterForChain(uint64 chainSelector) internal view returns (address) {
        address router = s_chainRouters[chainSelector];
        // チェーン特有のルーターが設定されていない場合はデフォルトを使用
        if (router == address(0)) {
            return s_defaultRouter;
        }
        return router;
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
     * @notice コンストラクタ
     * @param router デフォルトのCCIPルーターのアドレス
     * @param routerAddresses 宛先チェーンのルーターアドレスの配列
     * @param routerChainSelectors ルーターに対応するチェーンセレクタの配列
     * @param usdcAddress USDCトークンのアドレス
     * @param supportedChainSelectors サポートする宛先チェーンのセレクタ配列
     * @param destinationBridgeContracts 宛先チェーンの対応するブリッジコントラクト配列
     * @param chainNames チェーン名の配列
     * @param minimumPoolThreshold 最小プール閾値
     */
    constructor(
        address router,
        address[] memory routerAddresses,
        uint64[] memory routerChainSelectors,
        address usdcAddress,
        uint64[] memory supportedChainSelectors,
        address[] memory destinationBridgeContracts,
        string[] memory chainNames,
        uint256 minimumPoolThreshold
    ) {
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
     * @notice USDCをブリッジする関数
     * @param destinationChainSelector 宛先チェーンのセレクタ
     * @param receiver 受取人のアドレス
     * @param amount ブリッジするUSDCの量
     * @param autoEnterRaffle 宛先チェーンでラッフルに自動参加するかどうか
     */
    function bridgeTokens(
        uint64 destinationChainSelector,
        address receiver,
        uint256 amount,
        bool autoEnterRaffle
    ) external payable {
        // 基本的なチェック
        require(amount > 0, "Amount must be greater than 0");
        require(s_supportedChains[destinationChainSelector], "Destination chain not supported");
        require(receiver != address(0), "Receiver cannot be zero address");
        
        // USDC Token
        IERC20 usdc = IERC20(s_usdcAddress);
        
        // プール状態を更新
        _updatePoolStatus();
        
        // トークン転送 (送信者からコントラクトへ)
        require(usdc.transferFrom(msg.sender, address(this), amount), "USDC transfer failed");
        
        // メッセージデータを準備
        bytes memory messageData = abi.encode(
            receiver,           // 受取人アドレス
            amount,            // USDC量
            autoEnterRaffle,   // ラッフル自動参加フラグ
            block.timestamp    // タイムスタンプ
        );
        
        // トークン転送情報を準備
        CCIPInterface.EVMTokenAmount[] memory tokenAmounts = new CCIPInterface.EVMTokenAmount[](1);
        tokenAmounts[0] = CCIPInterface.EVMTokenAmount({
            token: s_usdcAddress,
            amount: amount
        });
        
        // 宛先チェーン用のルーターアドレスを取得
        address routerAddress = _getRouterForChain(destinationChainSelector);
        
        // CCIPメッセージを準備
        CCIPInterface.EVM2AnyMessage memory message = CCIPInterface.EVM2AnyMessage({
            receiver: abi.encode(s_destinationBridgeContracts[destinationChainSelector]),
            data: messageData,
            tokenAmounts: tokenAmounts,
            feeToken: address(0), // ETHで手数料支払い
            extraArgs: ""
        });
        
        // 手数料を計算
        uint256 fee = CCIPInterface(routerAddress).getFee(destinationChainSelector, message);
        require(msg.value >= fee, "Insufficient fee");
        
        // メッセージ送信
        bytes32 messageId = CCIPInterface(routerAddress).ccipSend{value: fee}(
            uint256(destinationChainSelector), 
            message
        );
        
        // イベント発行
        emit TokensBridged(
            msg.sender,
            receiver,
            destinationChainSelector,
            amount,
            messageId,
            autoEnterRaffle
        );
        
        // 残りのETHを返金
        if (msg.value > fee) {
            (bool success, ) = msg.sender.call{value: msg.value - fee}("");
            require(success, "Refund failed");
        }
    }

    /**
     * @notice CCIP経由でメッセージを受信する関数
     * @param message 受信したメッセージ
     */
    function ccipReceive(CCIPInterface.Any2EVMMessage memory message) external {
        // メッセージを処理前に送信元を検証
        // ソースチェーンのルーターを使用
        uint64 sourceChainSelector = uint64(message.sourceChainSelector);
        address routerAddress = _getRouterForChain(sourceChainSelector);
        require(msg.sender == routerAddress, "Only router can call ccipReceive");
        
        // メッセージデータをデコード
        (
            address receiver,
            uint256 amount,
            bool autoEnterRaffle
        ) = abi.decode(message.data, (address, uint256, bool));
        
        // USDC Token
        IERC20 usdc = IERC20(s_usdcAddress);
        
        // まず受取人にUSDCを転送
        require(usdc.transfer(receiver, amount), "USDC transfer failed");
        
        // ラッフル自動参加フラグが立っている場合はラッフルに参加
        if (autoEnterRaffle && s_raffleAddress != address(0)) {
            // 受取人からラッフル参加のための承認を得る必要がある点に注意
            // ここでは簡略化のため、自動参加は実装しない
        }
        
        // イベント発行
        emit TokensReceived(
            sourceChainSelector,
            receiver,
            amount,
            message.messageId,
            autoEnterRaffle
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
     * @notice CCIP手数料を見積もる関数
     * @param destinationChainSelector 宛先チェーンのセレクタ
     * @param receiver 受取人のアドレス
     * @param amount ブリッジするUSDCの量
     * @param autoEnterRaffle ラッフル自動参加フラグ
     * @return fee 見積もられた手数料
     */
    function estimateFee(
        uint64 destinationChainSelector,
        address receiver,
        uint256 amount,
        bool autoEnterRaffle
    ) external view returns (uint256 fee) {
        // 基本チェック
        require(s_supportedChains[destinationChainSelector], "Destination chain not supported");
        
        // メッセージデータを準備
        bytes memory messageData = abi.encode(
            receiver,
            amount,
            autoEnterRaffle,
            block.timestamp
        );
        
        // トークン転送情報を準備
        CCIPInterface.EVMTokenAmount[] memory tokenAmounts = new CCIPInterface.EVMTokenAmount[](1);
        tokenAmounts[0] = CCIPInterface.EVMTokenAmount({
            token: s_usdcAddress,
            amount: amount
        });
        
        // 宛先チェーン用のルーターアドレスを取得
        address routerAddress = _getRouterForChain(destinationChainSelector);
        
        // CCIPメッセージを準備
        CCIPInterface.EVM2AnyMessage memory message = CCIPInterface.EVM2AnyMessage({
            receiver: abi.encode(s_destinationBridgeContracts[destinationChainSelector]),
            data: messageData,
            tokenAmounts: tokenAmounts,
            feeToken: address(0), // ETHで手数料支払い
            extraArgs: ""
        });
        
        // 手数料を見積もる
        return CCIPInterface(routerAddress).getFee(destinationChainSelector, message);
    }

    /**
     * @dev コントラクトがネイティブトークンを受け取れるようにする
     */
    receive() external payable {}
}
