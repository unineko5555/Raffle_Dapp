// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "forge-std/console.sol";

/**
 * @title IMockRandomProvider
 * @notice VRFと互換性を持つランダムプロバイダーのインターフェース
 */
interface IMockRandomProvider {
    /**
     * @dev ランダムな値を生成するリクエストを行う
     * @param numWords 必要なランダム値の数
     * @return requestId リクエストID
     */
    function requestRandomWords(uint32 numWords) external returns (uint256 requestId);
    
    /**
     * @dev 直近でリクエストしたランダム値を取得する
     * @return randomWords ランダム値の配列
     */
    function getLatestRandomWords() external view returns (uint256[] memory);
    
    /**
     * @dev ランダム値が利用可能かどうかを確認する
     * @return isAvailable 利用可能かどうか
     */
    function randomWordsAvailable() external view returns (bool);
    
    /**
     * @dev ランダム値をリセットする (次のリクエストのため)
     */
    function resetRandomWords() external;
    
    /**
     * @dev RaffleImplementationからの呼び出しを許可する
     * @param caller 許可するコントラクトアドレス
     */
    function authorizeCaller(address caller) external;
}

/**
 * @title MockVRFProvider
 * @notice Chainlink VRFをシミュレートしたモッククラス
 * @dev テストネット環境で使用するためのVRFの代替
 */
contract MockVRFProvider is IMockRandomProvider {
    // エラー定義
    error Unauthorized();
    error InvalidRequest();
    error NoRandomWords();
    error AlreadyProcessing();
    
    // ランダム値のリクエストを記録
    uint256 private s_lastRequestId;
    uint256[] private s_randomWords;
    bool private s_randomWordsAvailable;
    address private s_owner;
    
    // シード値を組み合わせるための状態変数
    uint256 private s_nonce = 0;
    
    // 許可されたコントラクトのマッピングを追加
    mapping(address => bool) private s_authorizedCallers;
    
    // VRF互換性のための状態管理
    bool private s_isProcessing = false;
    uint256 private s_lastProcessedBlock;

    event RandomWordsRequested(uint256 indexed requestId, address indexed requester);
    event RandomWordsFulfilled(uint256 indexed requestId, uint256[] randomWords);
    event CallerAuthorized(address indexed caller);
    event VRFProcessingStarted(uint256 indexed requestId);
    event VRFProcessingCompleted(uint256 indexed requestId);
    
    modifier onlyOwner() {
        if (msg.sender != s_owner) revert Unauthorized();
        _;
    }
    
    modifier onlyAuthorized() {
        if (!s_authorizedCallers[msg.sender] && msg.sender != s_owner) revert Unauthorized();
        _;
    }
    
    constructor() {
        s_owner = msg.sender;
        // 所有者は自動的に認証される
        s_authorizedCallers[msg.sender] = true;
        s_lastProcessedBlock = block.number;
        console.log("MockVRF: Deployed with owner:", msg.sender);
        console.log("MockVRF: Initial block number:", block.number);
    }
    
    /**
     * @notice RaffleImplementationからの呼び出しを許可する
     * @param caller 許可するコントラクトアドレス
     */
    function authorizeCaller(address caller) external override onlyOwner {
        if (caller == address(0)) revert InvalidRequest();
        s_authorizedCallers[caller] = true;
        emit CallerAuthorized(caller);
        console.log("MockVRF: Authorized caller:", caller);
    }
    
    /**
     * @notice ランダム値をリクエストする
     * @dev Chainlink VRF互換のインターフェースを持つが、内部実装は異なる
     * @param numWords 必要なランダム値の数
     * @return requestId リクエストID
     */
    function requestRandomWords(uint32 numWords) external override onlyAuthorized returns (uint256) {
        if (s_isProcessing) revert AlreadyProcessing();
        if (numWords == 0 || numWords > 500) revert InvalidRequest();
        
        s_isProcessing = true;
        s_lastRequestId = uint256(keccak256(abi.encode(
            block.timestamp, 
            msg.sender, 
            s_nonce,
            block.number
        )));
        s_nonce++; 
        
        console.log("MockVRF: ========== REQUEST START ==========");
        console.log("MockVRF: Requesting", numWords, "random words");
        console.log("MockVRF: Request ID:", s_lastRequestId);
        console.log("MockVRF: Called by:", msg.sender);
        console.log("MockVRF: Block number:", block.number);
        console.log("MockVRF: Timestamp:", block.timestamp);
        
        emit VRFProcessingStarted(s_lastRequestId);
        emit RandomWordsRequested(s_lastRequestId, msg.sender);
        
        // このモックバージョンではリクエストと同時にランダム値を生成
        generateRandomWords(numWords);
        
        return s_lastRequestId;
    }
    
    /**
     * @notice ランダム値を生成する内部関数
     * @dev ブロックの情報とノンスを組み合わせてランダム性を高める
     * @param numWords 生成するランダム値の数
     */
    function generateRandomWords(uint32 numWords) private {
        console.log("MockVRF: ========== GENERATION START ==========");
        
        // 既存のランダム値をクリア
        delete s_randomWords;
        
        // より確実な乱数生成方法
        uint256 baseSeed = uint256(keccak256(abi.encode(
            block.timestamp,
            block.difficulty, // または block.prevrandao (London upgrade後)
            msg.sender,
            s_nonce,
            address(this),
            block.number,
            gasleft()
        )));
        
        console.log("MockVRF: Base seed generated:", baseSeed);
        
        // 新しいランダム値を生成
        for (uint32 i = 0; i < numWords; i++) {
            uint256 randomValue = uint256(keccak256(abi.encode(
                baseSeed,
                i,
                s_nonce + i,
                block.timestamp + i,
                block.number + i
            )));
            
            // より大きな数値の範囲を使用
            randomValue = randomValue % type(uint256).max;
            s_randomWords.push(randomValue);
            
            console.log("MockVRF: Generated word", i, ":", randomValue);
        }
        
        s_randomWordsAvailable = true;
        s_isProcessing = false;
        s_lastProcessedBlock = block.number;
        
        emit RandomWordsFulfilled(s_lastRequestId, s_randomWords);
        emit VRFProcessingCompleted(s_lastRequestId);
        
        console.log("MockVRF: ========== GENERATION COMPLETE ==========");
        console.log("MockVRF: Generated", numWords, "random words successfully");
        console.log("MockVRF: Total words available:", s_randomWords.length);
        if (s_randomWords.length > 0) {
            console.log("MockVRF: First random word:", s_randomWords[0]);
        }
    }
    
    /**
     * @notice 最新のランダム値を取得する
     * @return randomWords ランダム値の配列
     */
    function getLatestRandomWords() external view override returns (uint256[] memory) {
        if (!s_randomWordsAvailable) revert NoRandomWords();
        if (s_randomWords.length == 0) revert NoRandomWords();
        return s_randomWords;
    }
    
    /**
     * @notice ランダム値が利用可能かどうかを確認する
     * @return isAvailable 利用可能かどうか
     */
    function randomWordsAvailable() external view override returns (bool) {
        return s_randomWordsAvailable && s_randomWords.length > 0 && !s_isProcessing;
    }
    
    /**
     * @notice ランダム値をリセットする
     * @dev 次のリクエストのためにリセットする（アクセス制御追加）
     */
    function resetRandomWords() external override onlyAuthorized {
        console.log("MockVRF: ========== RESET START ==========");
        console.log("MockVRF: Resetting random words by:", msg.sender);
        console.log("MockVRF: Previous words count:", s_randomWords.length);
        
        delete s_randomWords;
        s_randomWordsAvailable = false;
        s_isProcessing = false;
        
        console.log("MockVRF: Reset complete");
        console.log("MockVRF: ========== RESET COMPLETE ==========");
    }
    
    /**
     * @notice オーナーを変更する
     * @param newOwner 新しいオーナーのアドレス
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        s_owner = newOwner;
        console.log("MockVRF: Ownership transferred to:", newOwner);
    }
    
    // デバッグ用の関数
    function getOwner() external view returns (address) {
        return s_owner;
    }
    
    function isAuthorized(address caller) external view returns (bool) {
        return s_authorizedCallers[caller];
    }
    
    function getLastRequestId() external view returns (uint256) {
        return s_lastRequestId;
    }
    
    function getNonce() external view returns (uint256) {
        return s_nonce;
    }
    
    function isProcessing() external view returns (bool) {
        return s_isProcessing;
    }
    
    function getLastProcessedBlock() external view returns (uint256) {
        return s_lastProcessedBlock;
    }
    
    // VRF互換性のための追加関数
    function getStatus() external view returns (
        bool available,
        bool processing,
        uint256 wordsCount,
        uint256 lastBlock,
        address owner
    ) {
        return (
            s_randomWordsAvailable,
            s_isProcessing,
            s_randomWords.length,
            s_lastProcessedBlock,
            s_owner
        );
    }
}