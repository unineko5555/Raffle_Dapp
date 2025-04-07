"use server"

import { contractConfig, RaffleABI } from "../lib/contract-config";
import { createPublicClient, http, createWalletClient, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia, baseSepolia, arbitrumSepolia } from "viem/chains";


// 使用するチェーンを定義
const getChain = (chainId: number) => {
  switch (chainId) {
    case 11155111:
      return sepolia;
    case 84532:
      return baseSepolia;
    case 421614:
      return arbitrumSepolia;
    default:
      return sepolia;
  }
};

// サーバーサイドでラッフルに参加する関数
export async function enterRaffle(chainId: number, userAddress: string) {
  try {
    // このActionはClientComponentから呼び出されるので、実際のトランザクションはクライアント側で処理すべき
    // ここではモックレスポンスを返す
    return {
      success: true,
      txHash:
        "0x" +
        Array(64)
          .fill(0)
          .map(() => Math.floor(Math.random() * 16).toString(16))
          .join(""),
    }
  } catch (error: unknown) {
    console.error("Error entering raffle:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

// ラッフル情報を取得する関数
export async function getRaffleInfo(chainId: number) {
  try {
    const chain = getChain(chainId);
    // チェーンIDをキーとしてアクセスする前に型チェック
    const chainIdKey = chainId as keyof typeof contractConfig;
    const config = contractConfig[chainIdKey];
    
    if (!config) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }
    
    // パブリッククライアントを作成
    const publicClient = createPublicClient({
      chain,
      transport: http(),
    });
    
    // コントラクトから情報を取得
    const [entranceFee, numberOfPlayers, raffleState, jackpotAmount, recentWinner] = await Promise.all([
      publicClient.readContract({
        address: config.raffleProxy as `0x${string}`,
        abi: RaffleABI,
        functionName: "getEntranceFee",
      }),
      publicClient.readContract({
        address: config.raffleProxy as `0x${string}`,
        abi: RaffleABI,
        functionName: "getNumberOfPlayers",
      }),
      publicClient.readContract({
        address: config.raffleProxy as `0x${string}`,
        abi: RaffleABI,
        functionName: "getRaffleState",
      }),
      publicClient.readContract({
        address: config.raffleProxy as `0x${string}`,
        abi: RaffleABI,
        functionName: "getJackpotAmount",
      }),
      publicClient.readContract({
        address: config.raffleProxy as `0x${string}`,
        abi: RaffleABI,
        functionName: "getRecentWinner",
      }),
    ]);
    
    return {
      success: true,
      data: {
        entranceFee,
        numberOfPlayers,
        raffleState,
        jackpotAmount,
        recentWinner,
      }
    };
  } catch (error: unknown) {
    console.error("Error getting raffle info:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}
