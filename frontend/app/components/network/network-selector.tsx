"use client";

import { useState, useEffect } from 'react';
import { useChainId, useSwitchChain } from "wagmi";
import { sepolia, baseSepolia, arbitrumSepolia } from "wagmi/chains";
import { Check, ChevronDown, Network } from "lucide-react";
import { useSmartAccountContext } from "@/app/providers/smart-account-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import Image from 'next/image';

// サポートするネットワーク情報
export const supportedNetworks = [
  {
    id: sepolia.id,
    name: "Ethereum Sepolia",
    icon: "/icons/ethereum.svg", // アイコンがある場合は追加
    color: "bg-blue-500", // カラーインジケーター用
    shortName: "Sepolia",
    rpcUrl: `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "placeholder"}`,
  },
  {
    id: baseSepolia.id,
    name: "Base Sepolia",
    icon: "/icons/base.svg", // アイコンがある場合は追加
    color: "bg-blue-400",
    shortName: "Base Sepolia",
    rpcUrl: `https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "placeholder"}`,
  },
  {
    id: arbitrumSepolia.id,
    name: "Arbitrum Sepolia",
    icon: "/icons/arbitrum.svg", // アイコンがある場合は追加
    color: "bg-blue-600",
    shortName: "Arb Sepolia",
    rpcUrl: `https://arb-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "placeholder"}`,
  },
];

export function NetworkSelector() {
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { toast } = useToast();
  
  // スマートアカウントのコンテキストを使用
  const { switchChain: switchSmartAccountChain, currentChainId: smartAccountChainId } = useSmartAccountContext();
  
  // 現在のネットワークの状態
  const [currentNetwork, setCurrentNetwork] = useState(supportedNetworks[0]);
  // ネットワーク切り替え中かどうか
  const [isSwitching, setIsSwitching] = useState(false);

  // 現在のチェーンIDに基づいてネットワーク情報を更新
  useEffect(() => {
    // EOAウォレットのチェーンIDを優先的に使用し、
    // なければスマートアカウントのチェーンIDを使用
    const activeChainId = chainId || smartAccountChainId;
    
    const network = supportedNetworks.find(n => n.id === activeChainId);
    if (network) {
      setCurrentNetwork(network);
    }
  }, [chainId, smartAccountChainId]);

  // ネットワーク切り替え処理
  const handleNetworkSwitch = async (network: typeof supportedNetworks[0]) => {
    // 既に同じネットワークを選択している場合は何もしない
    if (network.id === chainId || network.id === smartAccountChainId) {
      return;
    }
    
    setIsSwitching(true);
    
    try {
      // スマートアカウントがある場合は先に切り替える
      if (switchSmartAccountChain) {
        await switchSmartAccountChain(network.id);
      }
      
      // EOAウォレットの切り替え
      if (switchChain) {
        await switchChain({ chainId: network.id });
      }

      // 成功通知
      toast({
        title: "ネットワーク切り替え成功",
        description: `${network.name}に接続しました`,
      });
      
      // 現在のネットワークを更新
      setCurrentNetwork(network);
    } catch (error) {
      console.error("ネットワーク切り替えエラー:", error);
      
      // エラー通知
      toast({
        title: "ネットワーク切り替えエラー",
        description: "ネットワーク切り替え中にエラーが発生しました",
        variant: "destructive",
      });
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="flex items-center justify-between gap-2 min-w-[140px] bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          disabled={isSwitching}
        >
          <div className="flex items-center gap-1.5">
            <Network className="h-4 w-4 text-slate-500" />
            <div className={`w-2 h-2 rounded-full ${currentNetwork.color} animate-pulse`}></div>
            <span className="text-sm">{currentNetwork.shortName}</span>
          </div>
          {isSwitching ? (
            <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <ChevronDown className="h-4 w-4 opacity-50" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        {supportedNetworks.map((network) => (
          <DropdownMenuItem
            key={network.id}
            className="flex items-center justify-between cursor-pointer"
            onClick={() => handleNetworkSwitch(network)}
          >
            <div className="flex items-center gap-2">
              {network.icon && (
                <div className="w-5 h-5 relative">
                  <Image 
                    src={network.icon} 
                    alt={network.name} 
                    width={20} 
                    height={20} 
                    className="object-contain"
                  />
                </div>
              )}
              <div className={`w-2 h-2 rounded-full ${network.color}`}></div>
              <span>{network.name}</span>
            </div>
            {(network.id === chainId || network.id === smartAccountChainId) && (
              <Check className="h-4 w-4" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
