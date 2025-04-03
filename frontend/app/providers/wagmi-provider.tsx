"use client";

import { WagmiProvider, createConfig } from "wagmi";
import { sepolia, baseSepolia, arbitrumSepolia } from "wagmi/chains";
import { http } from "viem";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, ReactNode } from "react";
import { injected, metaMask, walletConnect } from 'wagmi/connectors';

// .envからAlchemy API Keyを取得
// 現在の値はコードにハードコードされたプレースホルダーです
const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "wHEFFjcDt1xkPRjzDZycgAsnKWk1GHcK";

interface WagmiProviderProps {
  children: ReactNode;
}

export function WagmiProviderWrapper({ children }: WagmiProviderProps) {
  const [queryClient] = useState(() => new QueryClient());
  
  const config = createConfig({
    chains: [sepolia, baseSepolia, arbitrumSepolia],
    transports: {
      [sepolia.id]: http(`https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`), 
      [baseSepolia.id]: http(`https://base-sepolia.g.alchemy.com/v2/${alchemyApiKey}`),
      [arbitrumSepolia.id]: http(`https://arb-sepolia.g.alchemy.com/v2/${alchemyApiKey}`),
    },
    connectors: [
      injected({ target: 'metaMask' }),
      metaMask(),
      walletConnect({ projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "961e384786ed6449576cd6ad8a368588" })
    ],
  });

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
