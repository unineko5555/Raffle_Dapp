"use server"

import { contractConfig } from "../lib/contract-config";
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
  } catch (error) {
    console.error("Error entering raffle:", error);
    return { success: false, error: error.message };
  }
}

// ラッフル情報を取得する関数
export async function getRaffleInfo(chainId: number) {
  try {
    const chain = getChain(chainId);
    const config = contractConfig[chainId];
    
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
        abi: contractConfig.RaffleABI,
        functionName: "getEntranceFee",
      }),
      publicClient.readContract({
        address: config.raffleProxy as `0x${string}`,
        abi: contractConfig.RaffleABI,
        functionName: "getNumberOfPlayers",
      }),
      publicClient.readContract({
        address: config.raffleProxy as `0x${string}`,
        abi: contractConfig.RaffleABI,
        functionName: "getRaffleState",
      }),
      publicClient.readContract({
        address: config.raffleProxy as `0x${string}`,
        abi: contractConfig.RaffleABI,
        functionName: "getJackpotAmount",
      }),
      publicClient.readContract({
        address: config.raffleProxy as `0x${string}`,
        abi: contractConfig.RaffleABI,
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
  } catch (error) {
    console.error("Error getting raffle info:", error);
    return { success: false, error: error.message };
  }
}
