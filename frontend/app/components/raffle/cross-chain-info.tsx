import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Link2, ArrowRight, Network, Globe, Lock, Zap } from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const CrossChainInfo = ({
  supportedChains = [],
  activeChain = null,
  onChangeChain = () => {},
  isOwner = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  
  // サポートされているチェーンが存在しない場合に備えて、デフォルト値を設定
  const chains = supportedChains.length > 0 ? supportedChains : [
    { id: 11155111, name: "Ethereum Sepolia", icon: "/icons/ethereum.svg", color: "bg-blue-500" },
    { id: 80001, name: "Polygon Mumbai", icon: "/icons/polygon.svg", color: "bg-purple-600" },
    { id: 421613, name: "Arbitrum Sepolia", icon: "/icons/arbitrum.svg", color: "bg-blue-400" },
    { id: 420, name: "Optimism Goerli", icon: "/icons/optimism.svg", color: "bg-red-500" },
    { id: 84531, name: "Base Sepolia", icon: "/icons/ethereum.svg", color: "bg-blue-700" }
  ];
  
  // 現在のアクティブチェーンを設定
  const currentChain = activeChain || chains[0];
  
  return (
    <Card>
      <CardHeader className="p-4 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            クロスチェーンラッフル
          </CardTitle>
          <CardDescription>Chainlink CCIPによる複数チェーン間連携</CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setExpanded(!expanded)}
          className="h-8"
        >
          {expanded ? "閉じる" : "詳細を表示"}
          <ArrowRight className={`w-4 h-4 ml-1 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </Button>
      </CardHeader>
      
      <CardContent className={`p-4 space-y-4 ${expanded ? '' : 'hidden md:block'}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-2">
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-indigo-500" />
            <span className="font-medium">現在のネットワーク:</span>
          </div>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                  <Image
                    src={currentChain.icon}
                    alt={currentChain.name}
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                  <span className="font-medium">{currentChain.name}</span>
                  <div className={`w-2 h-2 rounded-full ${currentChain.color} animate-pulse`}></div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>このチェーンでラッフルに参加します</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        <Tabs defaultValue="overview">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">概要</TabsTrigger>
            <TabsTrigger value="chains">対応チェーン</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="p-2 space-y-4">
            <div className="grid gap-4 mt-2">
              <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <Globe className="w-5 h-5 text-blue-500 mt-0.5" />
                <div>
                  <p className="font-medium">クロスチェーン対応ラッフル</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Chainlink CCIPを使用して、異なるブロックチェーン間でラッフル結果を共有します。
                    どのチェーンでプレイしても同じラッフルに参加できます。
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <Lock className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">安全性と透明性</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Chainlink VRFによる検証可能なランダム性で、公平な抽選を実現。
                    結果操作の心配なくお楽しみいただけます。
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <Zap className="w-5 h-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium">自動実行</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Chainlink Automationによる自動実行で、条件を満たすと自動的に抽選が行われます。
                    抽選結果は全チェーンに反映されます。
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="chains" className="space-y-4">
            <div className="grid gap-3 mt-2">
              {chains.map((chain) => (
                <div 
                  key={chain.id}
                  className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                    chain.id === currentChain.id 
                      ? `${chain.borderColor || 'border-indigo-500'} bg-slate-50 dark:bg-slate-800/50`
                      : 'border-transparent bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Image
                      src={chain.icon}
                      alt={chain.name}
                      width={24}
                      height={24}
                      className="rounded-full"
                    />
                    <div>
                      <p className="font-medium">{chain.name}</p>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${chain.color || 'bg-slate-400'}`}></div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {chain.id === currentChain.id ? '接続中' : 'テストネット'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {chain.id !== currentChain.id && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => onChangeChain(chain)}
                      className="h-8"
                    >
                      切り替え
                    </Button>
                  )}
                  
                  {chain.id === currentChain.id && (
                    <Badge className="bg-green-500 text-white border-0">アクティブ</Badge>
                  )}
                </div>
              ))}
            </div>
            
            {isOwner && (
              <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mb-2">管理者専用機能</p>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 w-full">
                  クロスチェーンメッセージ送信
                </Button>
                <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 mt-2">
                  ※このボタンはオーナーアカウントでログインした場合のみ表示されます
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default CrossChainInfo;