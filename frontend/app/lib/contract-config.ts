// 各ネットワークのコントラクトアドレスと関連設定
export const contractConfig = {
  // Ethereum Sepolia
  11155111: {
    name: "Ethereum Sepolia",
    raffleProxy: "0x6aa9951dc172b38e576e6d1e5c8d7bcf6d55ff4a", // Sepoliaにデプロイしたプロキシアドレス
    erc20Address: "0x74ce1e12998fB861A612CD6C65244f8620e2937A", // SepoliaのUSDC (またはモックトークン) アドレス
    ccipRouter: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59", // SepoliaのCCIPルーターアドレス
    blockExplorer: "https://sepolia.etherscan.io",
    rpcUrl: "${NEXT_PUBLIC_SEPOLIA_RPC_URL}",
  },
  // Base Sepolia
  84532: {
    name: "Base Sepolia",
    raffleProxy: "0xbb11ec666189afe8ac3c9dc7f7e9132431433a6d", // Base Sepoliaにデプロイしたプロキシアドレス
    erc20Address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base SepoliaのUSDC (またはモックトークン) アドレス
    ccipRouter: "0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93", // Base SepoliaのCCIPルーターアドレス
    blockExplorer: "https://sepolia.basescan.org",
    rpcUrl: "${NEXT_PUBLIC_BASE_RPC_URL}",
  },
  // Arbitrum Sepolia
  421614: {
    name: "Arbitrum Sepolia",
    raffleProxy: "0x7636eca50d70c8cb91c781a5db236638fe94bcf0", // Arbitrum Sepoliaにデプロイしたプロキシアドレス
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
      }
    ],
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