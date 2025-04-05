"use client";

import { ReactNode } from 'react';
import { WagmiProviderWrapper } from './wagmi-provider';
import { SmartAccountProvider } from './smart-account-provider';
import { ThemeProvider } from "@/components/theme-provider";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <WagmiProviderWrapper>
        <SmartAccountProvider>
          {children}
        </SmartAccountProvider>
      </WagmiProviderWrapper>
    </ThemeProvider>
  );
}
