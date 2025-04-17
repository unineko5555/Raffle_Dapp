"use client";

import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SmartWalletButton } from "../auth/smart-wallet-button";
import { NetworkSelector } from "../network/network-selector";
import { TokenTransferButton } from "../wallet/token-transfer-button";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft } from "lucide-react";
import Link from "next/link";

export function AppHeader() {
  return (
    <header className="flex justify-between items-center mb-8 p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-lg backdrop-blur-sm bg-white/80 dark:bg-slate-800/80">
      <div className="flex items-center gap-2">
        <div className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Raffle Dapp
        </div>
        <Badge
          variant="outline"
          className="ml-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
        >
          Beta
        </Badge>
      </div>
      <div className="flex items-center gap-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/bridge">
                <Button variant="outline" size="sm" className="flex items-center gap-1">
                  <ArrowRightLeft className="h-4 w-4" />
                  Bridge
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              <p>USDCをクロスチェーンでブリッジ</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TokenTransferButton />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <NetworkSelector />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>ネットワークを変更する</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <ThemeToggle />
        <SmartWalletButton />
      </div>
    </header>
  );
}
