import { createConfig, http } from "wagmi"
import { mainnet, polygon, arbitrum, optimism } from "wagmi/chains"

// 環境変数から取得する想定
const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "demo"
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo"

// Wagmi設定
export const wagmiConfig = createConfig({
  chains: [mainnet, polygon, arbitrum, optimism],
  transports: {
    [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}`),
    [polygon.id]: http(`https://polygon-mainnet.g.alchemy.com/v2/${alchemyApiKey}`),
    [arbitrum.id]: http(`https://arb-mainnet.g.alchemy.com/v2/${alchemyApiKey}`),
    [optimism.id]: http(`https://opt-mainnet.g.alchemy.com/v2/${alchemyApiKey}`),
  },
})

// Alchemy AccountKit設定 - 簡略化したバージョン
export const createAlchemyClient = async (chain: number) => {
  try {
    // 実際のアプリケーションでは、ここでウォレットの接続とサイナーの作成を行います
    // この例では、エラーを避けるために簡略化しています
    return {
      // ダミーのクライアントオブジェクト
      address: "0x0000000000000000000000000000000000000000",
      async writeContract(params: any) {
        console.log("Contract interaction params:", params)
        return { hash: "0x0000000000000000000000000000000000000000000000000000000000000000" }
      },
    }
  } catch (error) {
    console.error("Error creating Alchemy client:", error)
    throw error
  }
}

// ソーシャルログイン用の設定
export const socialLoginProviders = [
  {
    id: "google",
    name: "Google",
    icon: "/icons/google.svg",
  },
  {
    id: "x",
    name: "X",
    icon: "/icons/x.svg",
  },
]

// サポートするチェーン情報
export const supportedChains = [
  {
    id: mainnet.id,
    name: "Ethereum",
    icon: "/icons/ethereum.svg",
    color: "bg-blue-500",
    textColor: "text-blue-500",
    borderColor: "border-blue-500",
  },
  {
    id: polygon.id,
    name: "Polygon",
    icon: "/icons/polygon.svg",
    color: "bg-purple-600",
    textColor: "text-purple-600",
    borderColor: "border-purple-600",
  },
  {
    id: arbitrum.id,
    name: "Arbitrum",
    icon: "/icons/arbitrum.svg",
    color: "bg-blue-400",
    textColor: "text-blue-400",
    borderColor: "border-blue-400",
  },
  {
    id: optimism.id,
    name: "Optimism",
    icon: "/icons/optimism.svg",
    color: "bg-red-500",
    textColor: "text-red-500",
    borderColor: "border-red-500",
  },
]

