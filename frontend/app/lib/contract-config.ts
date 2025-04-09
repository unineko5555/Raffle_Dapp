// 各ネットワークのコントラクトアドレスと関連設定
export const contractConfig = {
  // Ethereum Sepolia
  11155111: {
    name: "Ethereum Sepolia",
    raffleProxy: "0x3fc8a0ad8ed97ace6641d9f3fda60569f0d3f3a9", // Sepoliaにデプロイしたプロキシアドレス
    erc20Address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // SepoliaのUSDC (またはモックトークン) アドレス
    ccipRouter: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59", // SepoliaのCCIPルーターアドレス
    blockExplorer: "https://sepolia.etherscan.io",
    rpcUrl: "${NEXT_PUBLIC_SEPOLIA_RPC_URL}",
  },
  // Base Sepolia
  84532: {
    name: "Base Sepolia",
    raffleProxy: "0x5f6bde3eac2c005eedb64a1a6fb78f72c9f667be", // Base Sepoliaにデプロイしたプロキシアドレス
    erc20Address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base SepoliaのUSDC (またはモックトークン) アドレス
    ccipRouter: "0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93", // Base SepoliaのCCIPルーターアドレス
    blockExplorer: "https://sepolia.basescan.org",
    rpcUrl: "${NEXT_PUBLIC_BASE_RPC_URL}",
  },
  // Arbitrum Sepolia
  421614: {
    name: "Arbitrum Sepolia",
    raffleProxy: "0x126b24a0c87f63d4a07f2d4640f2bd53a78ecc15", // Arbitrum Sepoliaにデプロイしたプロキシアドレス
    erc20Address: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", // Arbitrum SepoliaのUSDC (またはモックトークン) アドレス
    ccipRouter: "0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165", // Arbitrum SepoliaのCCIPルーターアドレス
    blockExplorer: "https://sepolia-explorer.arbitrum.io",
    rpcUrl: "${NEXT_PUBLIC_ARBITRUM_RPC_URL}",
  },
};

// スマートコントラクトのABI（out/RaffleImplementation.solから）
export const RaffleABI = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "receive",
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "cancelEntry",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "checkUpkeep",
    "inputs": [
      {
        "name": "",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "upkeepNeeded",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "checkUpkeepDebug",
    "inputs": [],
    "outputs": [
      {
        "name": "isOpen",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "hasPlayers",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "hasTimePassed",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "timeSinceMinPlayers",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "requiredTime",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "playerCount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "enterRaffle",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getEntranceFee",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getJackpotAmount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getLastRaffleTime",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getLatestRaffleHistory",
    "inputs": [],
    "outputs": [
      {
        "name": "winner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "prize",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "jackpotWon",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "timestamp",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "playerCount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMinPlayersReachedTime",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMinimumPlayers",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMockVRFStatus",
    "inputs": [],
    "outputs": [
      {
        "name": "useMockVRF",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "mockVRFProvider",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getNumberOfPlayers",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getOwner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPlayer",
    "inputs": [
      {
        "name": "index",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRaffleHistoryAtIndex",
    "inputs": [
      {
        "name": "index",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "winner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "prize",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "jackpotWon",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "timestamp",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "playerCount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRaffleHistoryCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRaffleState",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "enum IRaffle.RaffleState"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRecentWinner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getUserStats",
    "inputs": [
      {
        "name": "user",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "entryCount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "winCount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "jackpotCount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "initialize",
    "inputs": [
      {
        "name": "vrfCoordinatorV2",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "subscriptionId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "keyHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "callbackGasLimit",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "entranceFee",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "usdcAddress",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "ccipRouter",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "addMockPlayers",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "mockVRFProvider",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "useMockVRF",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "manualPerformUpkeep",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "performUpkeep",
    "inputs": [
      {
        "name": "",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "rawFulfillRandomWords",
    "inputs": [
      {
        "name": "requestId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "randomWords",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "sendCrossChainMessage",
    "inputs": [
      {
        "name": "destinationChainSelector",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "winner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "prize",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "isJackpot",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setMockVRF",
    "inputs": [
      {
        "name": "mockVRFProvider",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "useMockVRF",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setOwner",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "upgradeTo",
    "inputs": [
      {
        "name": "newImplementation",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "upgradeToAndCall",
    "inputs": [
      {
        "name": "newImplementation",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "data",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "withdraw",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "CrossChainMessageSent",
    "inputs": [
      {
        "name": "destinationChainSelector",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "messageId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RaffleEnter",
    "inputs": [
      {
        "name": "player",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "entranceFee",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RaffleExit",
    "inputs": [
      {
        "name": "player",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "refundAmount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RaffleStateChanged",
    "inputs": [
      {
        "name": "newState",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum IRaffle.RaffleState"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "WinnerPicked",
    "inputs": [
      {
        "name": "winner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "prize",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "isJackpot",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "OnlyCoordinatorCanFulfill",
    "inputs": [
      {
        "name": "have",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "want",
        "type": "address",
        "internalType": "address"
      }
    ]
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
    },
  {
    "type": "function",
    "name": "transfer",
    "inputs": [
      {
        "name": "recipient",
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
    "name": "transferFrom",
    "inputs": [
      {
        "name": "sender",
        "type": "address"
      },
      {
        "name": "recipient",
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
  }
  ];