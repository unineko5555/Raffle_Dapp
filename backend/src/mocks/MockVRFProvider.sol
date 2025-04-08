// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

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
}

/**
 * @title MockVRFProvider
 * @notice Chainlink VRFをシミュレートしたモッククラス
 * @dev テストネット環境で使用するためのVRFの代替
 */
contract MockVRFProvider is IMockRandomProvider {
    // ランダム値のリクエストを記録
    uint256 private s_lastRequestId;
    uint256[] private s_randomWords;
    bool private s_randomWordsAvailable;
    address private s_owner;
    
    // シード値を組み合わせるための状態変数
    uint256 private s_nonce = 0;

    event RandomWordsRequested(uint256 indexed requestId, address indexed requester);
    event RandomWordsFulfilled(uint256 indexed requestId, uint256[] randomWords);
    
    modifier onlyOwner() {
        require(msg.sender == s_owner, "Only owner can call this function");
        _;
    }
    
    constructor() {
        s_owner = msg.sender;
    }
    
    /**
     * @notice ランダム値をリクエストする
     * @dev Chainlink VRF互換のインターフェースを持つが、内部実装は異なる
     * @param numWords 必要なランダム値の数
     * @return requestId リクエストID
     */
    function requestRandomWords(uint32 numWords) external override returns (uint256) {
        s_lastRequestId = uint256(keccak256(abi.encode(block.timestamp, msg.sender, s_nonce)));
        s_nonce++; // nonceをインクリメントして次のリクエストでは異なる値が生成されるようにする
        
        // このモックバージョンではリクエストと同時にランダム値を生成
        generateRandomWords(numWords);
        
        emit RandomWordsRequested(s_lastRequestId, msg.sender);
        return s_lastRequestId;
    }
    
    /**
     * @notice ランダム値を生成する内部関数
     * @dev ブロックの情報とノンスを組み合わせてランダム性を高める
     * @param numWords 生成するランダム値の数
     */
    function generateRandomWords(uint32 numWords) private {
        // 既存のランダム値をクリア
        delete s_randomWords;
        
        // 新しいランダム値を生成
        for (uint32 i = 0; i < numWords; i++) {
            uint256 randomValue = uint256(keccak256(abi.encode(
                block.timestamp,
                blockhash(block.number - 1),
                msg.sender,
                s_nonce,
                i
            )));
            s_randomWords.push(randomValue);
        }
        
        s_randomWordsAvailable = true;
        emit RandomWordsFulfilled(s_lastRequestId, s_randomWords);
    }
    
    /**
     * @notice 最新のランダム値を取得する
     * @return randomWords ランダム値の配列
     */
    function getLatestRandomWords() external view override returns (uint256[] memory) {
        require(s_randomWordsAvailable, "No random words available yet");
        return s_randomWords;
    }
    
    /**
     * @notice ランダム値が利用可能かどうかを確認する
     * @return isAvailable 利用可能かどうか
     */
    function randomWordsAvailable() external view override returns (bool) {
        return s_randomWordsAvailable;
    }
    
    /**
     * @notice ランダム値をリセットする
     * @dev 次のリクエストのためにリセットする
     */
    function resetRandomWords() external override {
        delete s_randomWords;
        s_randomWordsAvailable = false;
    }
    
    /**
     * @notice オーナーを変更する
     * @param newOwner 新しいオーナーのアドレス
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        s_owner = newOwner;
    }
}