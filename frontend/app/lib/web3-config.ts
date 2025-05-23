import { sepolia, arbitrumSepolia, baseSepolia } from "wagmi/chains";
import { contractConfig } from "./contract-config";

// wagmi v2ではこの場所での静的な設定は非推奨で、WagmiProviderで設定しています

// サポートするチェーン情報
export const supportedChains = [
  {
    id: sepolia.id,
    name: "Ethereum Sepolia",
    icon: "/icons/ethereum.svg",
    color: "bg-blue-500",
    textColor: "text-blue-500",
    borderColor: "border-blue-500",
    currency: {
      name: "Sepolia ETH",
      symbol: "SEP",
      decimals: 18,
    },
  },
  {
    id: baseSepolia.id,
    name: "Base Sepolia",
    icon: "/icons/base.svg",
    color: "bg-blue-400",
    textColor: "text-blue-400",
    borderColor: "border-blue-400",
    currency: {
      name: "Sepolia ETH",
      symbol: "SEP",
      decimals: 18,
    },
  },
  {
    id: arbitrumSepolia.id,
    name: "Arbitrum Sepolia",
    icon: "/icons/arbitrum.svg",
    color: "bg-blue-600",
    textColor: "text-blue-600",
    borderColor: "border-blue-600",
    currency: {
      name: "Sepolia ETH",
      symbol: "SEP",
      decimals: 18,
    },
  },
];

// チェーンIDからコントラクト設定を取得
export function getContractConfig(chainId: number) {
  return contractConfig[chainId as keyof typeof contractConfig] || null;
}

// ソーシャルログイン用の設定
export const socialLoginProviders = [
  {
    id: "email_passwordless",
    name: "メール",
    icon: "/icons/email.svg",
  },
  {
    id: "google",
    name: "Google",
    icon: "/icons/google.svg",
  },
];
