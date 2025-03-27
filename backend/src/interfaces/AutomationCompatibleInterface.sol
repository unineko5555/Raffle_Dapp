// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * @title Chainlink Automation互換インターフェース
 * @notice このインターフェースは、Chainlink AutomationネットワークがデコレートされたコントラクトをCheckと呼ぶために使用します
 */
interface AutomationCompatibleInterface {
    /**
     * @notice メンテナンスが必要かどうかを判断するために、Chainlink Automation Nodeによって呼び出される関数
     * @param checkData オプションのデータは、ノードがupkeepをシミュレートするときに使用されます
     * @return upkeepNeeded アップキープが必要かどうかを示すboolean値
     * @return performData 実際のアップキープコールに渡されるパラメータ
     */
    function checkUpkeep(bytes calldata checkData) external returns (bool upkeepNeeded, bytes memory performData);

    /**
     * @notice checkUpkeepで真を返した場合に、Chainlink Automation Nodeによって呼び出される関数
     * @param performData checkUpkeepからのカスタムパラメータ
     */
    function performUpkeep(bytes calldata performData) external;
}
