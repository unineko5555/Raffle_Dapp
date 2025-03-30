// 各ネットワークのコントラクトアドレスと関連設定
export const contractConfig = {
  // Ethereum Sepolia
  11155111: {
    name: "Ethereum Sepolia",
    raffleProxy: "0xd046d3280454fd2079e88569c2be016a476331d3", // Sepoliaにデプロイしたプロキシアドレス
    erc20Address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // SepoliaのUSDC (またはモックトークン) アドレス
    ccipRouter: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59", // SepoliaのCCIPルーターアドレス
    blockExplorer: "https://sepolia.etherscan.io",
    rpcUrl: "wss://sepolia.gateway.tenderly.co",
  },
  // Base Sepolia
  84532: {
    name: "Base Sepolia",
    raffleProxy: "0x2f6768b0585754642b32704fd1ee98b47b8f60a9", // Base Sepoliaにデプロイしたプロキシアドレス
    erc20Address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base SepoliaのUSDC (またはモックトークン) アドレス
    ccipRouter: "0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93", // Base SepoliaのCCIPルーターアドレス
    blockExplorer: "https://sepolia.basescan.org",
    rpcUrl: "https://base-sepolia.gateway.tenderly.co",
  },
  // Arbitrum Sepolia
  421614: {
    name: "Arbitrum Sepolia",
    raffleProxy: "0xf3d402c2c1b90104a0832a7330437ebb208c77b4", // Arbitrum Sepoliaにデプロイしたプロキシアドレス
    erc20Address: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", // Arbitrum SepoliaのUSDC (またはモックトークン) アドレス
    ccipRouter: "0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165", // Arbitrum SepoliaのCCIPルーターアドレス
    blockExplorer: "https://sepolia-explorer.arbitrum.io",
    rpcUrl: "wss://arbitrum-sepolia-rpc.publicnode.com",
  },
};

// スマートコントラクトのABI（out/RaffleImplementation.solから）
export const RaffleABI = [
  {
      "inputs": [
          {
              "internalType": "address",
              "name": "vrfCoordinatorV2",
              "type": "address"
          },
          {
              "internalType": "uint64",
              "name": "subscriptionId",
              "type": "uint64"
          },
          {
              "internalType": "bytes32",
              "name": "keyHash",
              "type": "bytes32"
          },
          {
              "internalType": "uint32",
              "name": "callbackGasLimit",
              "type": "uint32"
          },
          {
              "internalType": "uint256",
              "name": "entranceFee",
              "type": "uint256"
          },
          {
              "internalType": "address",
              "name": "usdcAddress",
              "type": "address"
          },
          {
              "internalType": "address",
              "name": "ccipRouter",
              "type": "address"
          }
      ],
      "stateMutability": "nonpayable",
      "type": "constructor"
  },
  {
      "stateMutability": "payable",
      "type": "receive"
  },
  {
      "inputs": [
          {
              "internalType": "bytes",
              "name": "",
              "type": "bytes"
          }
      ],
      "name": "checkUpkeep",
      "outputs": [
          {
              "internalType": "bool",
              "name": "upkeepNeeded",
              "type": "bool"
          },
          {
              "internalType": "bytes",
              "name": "",
              "type": "bytes"
          }
      ],
      "stateMutability": "view",
      "type": "function"
  },
  {
      "inputs": [],
      "name": "enterRaffle",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
  },
  {
      "inputs": [],
      "name": "getEntranceFee",
      "outputs": [
          {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
          }
      ],
      "stateMutability": "view",
      "type": "function"
  },
  {
      "inputs": [],
      "name": "getJackpotAmount",
      "outputs": [
          {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
          }
      ],
      "stateMutability": "view",
      "type": "function"
  },
  {
      "inputs": [],
      "name": "getLastRaffleTime",
      "outputs": [
          {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
          }
      ],
      "stateMutability": "view",
      "type": "function"
  },
  {
      "inputs": [],
      "name": "getMinPlayersReachedTime",
      "outputs": [
          {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
          }
      ],
      "stateMutability": "view",
      "type": "function"
  },
  {
      "inputs": [],
      "name": "getMinimumPlayers",
      "outputs": [
          {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
          }
      ],
      "stateMutability": "view",
      "type": "function"
  },
  {
      "inputs": [],
      "name": "getNumberOfPlayers",
      "outputs": [
          {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
          }
      ],
      "stateMutability": "view",
      "type": "function"
  },
  {
      "inputs": [],
      "name": "getOwner",
      "outputs": [
          {
              "internalType": "address",
              "name": "",
              "type": "address"
          }
      ],
      "stateMutability": "view",
      "type": "function"
  },
  {
      "inputs": [
          {
              "internalType": "uint256",
              "name": "index",
              "type": "uint256"
          }
      ],
      "name": "getPlayer",
      "outputs": [
          {
              "internalType": "address",
              "name": "",
              "type": "address"
          }
      ],
      "stateMutability": "view",
      "type": "function"
  },
  {
      "inputs": [],
      "name": "getRaffleState",
      "outputs": [
          {
              "internalType": "enum IRaffle.RaffleState",
              "name": "",
              "type": "uint8"
          }
      ],
      "stateMutability": "view",
      "type": "function"
  },
  {
      "inputs": [],
      "name": "getRecentWinner",
      "outputs": [
          {
              "internalType": "address",
              "name": "",
              "type": "address"
          }
      ],
      "stateMutability": "view",
      "type": "function"
  },
  {
      "inputs": [
          {
              "internalType": "bytes",
              "name": "",
              "type": "bytes"
          }
      ],
      "name": "performUpkeep",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
  },
  {
      "inputs": [
          {
              "internalType": "uint256",
              "name": "requestId",
              "type": "uint256"
          },
          {
              "internalType": "uint256[]",
              "name": "randomWords",
              "type": "uint256[]"
          }
      ],
      "name": "rawFulfillRandomWords",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
  },
  {
      "inputs": [
          {
              "internalType": "uint64",
              "name": "destinationChainSelector",
              "type": "uint64"
          },
          {
              "internalType": "address",
              "name": "winner",
              "type": "address"
          },
          {
              "internalType": "uint256",
              "name": "prize",
              "type": "uint256"
          },
          {
              "internalType": "bool",
              "name": "isJackpot",
              "type": "bool"
          }
      ],
      "name": "sendCrossChainMessage",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
  },
  {
      "inputs": [
          {
              "internalType": "address",
              "name": "newOwner",
              "type": "address"
          }
      ],
      "name": "setOwner",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
  },
  {
      "inputs": [
          {
              "internalType": "address",
              "name": "newImplementation",
              "type": "address"
          }
      ],
      "name": "upgradeTo",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
  },
  {
      "inputs": [
          {
              "internalType": "address",
              "name": "newImplementation",
              "type": "address"
          },
          {
              "internalType": "bytes",
              "name": "data",
              "type": "bytes"
          }
      ],
      "name": "upgradeToAndCall",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
  },
  {
      "inputs": [
          {
              "internalType": "address",
              "name": "token",
              "type": "address"
          }
      ],
      "name": "withdraw",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
  },
  {
      "anonymous": false,
      "inputs": [
          {
              "indexed": true,
              "internalType": "uint64",
              "name": "destinationChainSelector",
              "type": "uint64"
          },
          {
              "indexed": true,
              "internalType": "bytes32",
              "name": "messageId",
              "type": "bytes32"
          }
      ],
      "name": "CrossChainMessageSent",
      "type": "event"
  },
  {
      "anonymous": false,
      "inputs": [
          {
              "indexed": true,
              "internalType": "address",
              "name": "player",
              "type": "address"
          },
          {
              "indexed": false,
              "internalType": "uint256",
              "name": "entranceFee",
              "type": "uint256"
          }
      ],
      "name": "RaffleEnter",
      "type": "event"
  },
  {
      "anonymous": false,
      "inputs": [
          {
              "indexed": false,
              "internalType": "enum IRaffle.RaffleState",
              "name": "newState",
              "type": "uint8"
          }
      ],
      "name": "RaffleStateChanged",
      "type": "event"
  },
  {
      "anonymous": false,
      "inputs": [
          {
              "indexed": true,
              "internalType": "address",
              "name": "winner",
              "type": "address"
          },
          {
              "indexed": false,
              "internalType": "uint256",
              "name": "prize",
              "type": "uint256"
          },
          {
              "indexed": false,
              "internalType": "bool",
              "name": "isJackpot",
              "type": "bool"
          }
      ],
      "name": "WinnerPicked",
      "type": "event"
  },
  {
      "inputs": [
          {
              "internalType": "address",
              "name": "have",
              "type": "address"
          },
          {
              "internalType": "address",
              "name": "want",
              "type": "address"
          }
      ],
      "name": "OnlyCoordinatorCanFulfill",
      "type": "error"
  }
];

// ERC20トークン用の簡易ABI
export const ERC20ABI = [
{
"type": "function",
"name": "approve",
"inputs": [
{
"name": "spender",
"type": "address"
},
{
"name": "amount",
"type": "uint256"
}
],
"outputs": [
{
"name": "",
"type": "bool"
}
],
"stateMutability": "nonpayable"
},
{
"type": "function",
"name": "balanceOf",
"inputs": [
{
"name": "account",
"type": "address"
}
],
"outputs": [
{
"name": "",
"type": "uint256"
}
],
"stateMutability": "view"
},
{
"type": "function",
"name": "allowance",
"inputs": [
{
"name": "owner",
"type": "address" 
},
{
"name": "spender",
"type": "address"
}
],
"outputs": [
{
"name": "",
"type": "uint256"
}
],
"stateMutability": "view"
},
  {
      "inputs": [],
      "name": "decimals",
      "outputs": [
        {
          "internalType": "uint8",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ];
