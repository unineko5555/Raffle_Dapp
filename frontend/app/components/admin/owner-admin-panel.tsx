import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Shield, 
  CreditCard, 
  Link, 
  User, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownToLine,
  Loader2,
  Copy,
  CheckCircle,
  LinkIcon,
  History
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

const OwnerAdminPanel = ({
  isOwner = false, // オーナーかどうか
  contractAddress = "0x...", // コントラクトアドレス
  balance = 0, // コントラクト残高 (ETH)
  usdcBalance = 0, // コントラクトUSDC残高
  jackpotAmount = 0, // ジャックポット額
  ownerAddress = "0x...", // 現在のオーナーアドレス
  supportedChains = [], // サポートされているチェーン
  onWithdraw = (token) => {}, // 引き出し関数
  onChangeOwner = (newOwner) => {}, // オーナー変更関数
  onSendCrossChain = (chainId, winner, prize, isJackpot) => {}, // クロスチェーンメッセージ送信関数
  onUpgradeContract = (newImplementation, initData) => {}, // コントラクトアップグレード関数
  isLoading = false, // 処理中かどうか
}) => {
  const [copied, setCopied] = useState(false);
  const [selectedChain, setSelectedChain] = useState(supportedChains.length > 0 ? supportedChains[0].id : "");
  const [newOwnerAddress, setNewOwnerAddress] = useState("");
  const [newImplementationAddress, setNewImplementationAddress] = useState("");
  const [upgradeInitData, setUpgradeInitData] = useState("");
  
  // USDCの6桁小数点を考慮してフォーマット
  const formatUSDC = (amount) => {
    return (amount / 1e6).toLocaleString('ja-JP', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };
  
  // アドレスをコピーする関数
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  // アドレスを短縮して表示する関数
  const shortenAddress = (address) => {
    if (!address || address.length < 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
  if (!isOwner) return null;
  
  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader className="bg-amber-50 dark:bg-amber-900/20 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <CardTitle className="text-amber-600 dark:text-amber-400">コントラクト管理パネル</CardTitle>
        </div>
        <CardDescription>
          このパネルはコントラクトオーナーのみが利用できます
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-4">
        <Tabs defaultValue="overview">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">概要</TabsTrigger>
            <TabsTrigger value="finance">資金管理</TabsTrigger>
            <TabsTrigger value="crosschain">クロスチェーン</TabsTrigger>
            <TabsTrigger value="upgrade">アップグレード</TabsTrigger>
          </TabsList>
          
          {/* 概要タブ */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-md">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">コントラクトアドレス</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                    {shortenAddress(contractAddress)}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => copyToClipboard(contractAddress)}
                  >
                    {copied ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-md">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">現在のオーナー</span>
                </div>
                <code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                  {shortenAddress(ownerAddress)}
                </code>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-md">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">コントラクト残高</span>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-right">{balance.toFixed(4)} ETH</div>
                  <div className="text-xs text-right">{formatUSDC(usdcBalance)} USDC</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-600" />
                  <span className="text-sm text-amber-600 dark:text-amber-400">最新のトランザクション</span>
                </div>
                <Button variant="outline" size="sm" className="h-7">
                  <ArrowUpRight className="w-3 h-3 mr-1" />
                  Explorer
                </Button>
              </div>
            </div>
          </TabsContent>
          
          {/* 資金管理タブ */}
          <TabsContent value="finance" className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-md">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-slate-500" />
                <span className="text-sm">ETH残高</span>
              </div>
              <div className="text-sm font-bold">{balance.toFixed(6)} ETH</div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-md">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-500" />
                <span className="text-sm">USDC残高（引き出し可能）</span>
              </div>
              <div className="text-sm font-bold">{formatUSDC(usdcBalance - jackpotAmount)} USDC</div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-amber-600">ジャックポット残高（引き出し不可）</span>
              </div>
              <div className="text-sm font-bold text-amber-600">{formatUSDC(jackpotAmount)} USDC</div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mt-4">
              <Button
                onClick={() => onWithdraw("0x0000000000000000000000000000000000000000")}
                disabled={balance <= 0 || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ArrowDownToLine className="w-4 h-4 mr-2" />
                )}
                ETHを引き出す
              </Button>
              
              <Button
                onClick={() => onWithdraw("usdc")}
                disabled={usdcBalance <= jackpotAmount || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ArrowDownToLine className="w-4 h-4 mr-2" />
                )}
                USDCを引き出す
              </Button>
            </div>
            
            <div className="text-xs text-slate-500 mt-2">
              ※ジャックポット分のUSDCは引き出すことができません
            </div>
          </TabsContent>
          
          {/* クロスチェーンタブ */}
          <TabsContent value="crosschain" className="space-y-4 mt-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-md">
              <Label className="text-sm">送信先チェーン</Label>
              <Select value={selectedChain} onValueChange={setSelectedChain}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="チェーンを選択" />
                </SelectTrigger>
                <SelectContent>
                  {supportedChains.map((chain) => (
                    <SelectItem key={chain.id} value={chain.id.toString()}>
                      {chain.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  className="w-full"
                  disabled={!selectedChain || isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Link className="w-4 h-4 mr-2" />
                  )}
                  クロスチェーンメッセージを送信
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>クロスチェーンメッセージ送信の確認</DialogTitle>
                  <DialogDescription>
                    このアクションはChainlink CCIPを使用して異なるチェーンにメッセージを送信します。
                    少量の手数料が発生します。
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-3 py-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 dark:text-slate-400">送信先チェーン</span>
                    <span className="font-medium">
                      {supportedChains.find(c => c.id.toString() === selectedChain)?.name || "不明"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 dark:text-slate-400">推定手数料</span>
                    <span className="font-medium">~0.01 ETH</span>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" className="w-full sm:w-auto">キャンセル</Button>
                  <Button 
                    onClick={() => onSendCrossChain(parseInt(selectedChain), null, 0, false)}
                    className="w-full sm:w-auto"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      "送信する"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            <div className="text-xs text-slate-500 mt-2">
              ※クロスチェーンメッセージの送信にはETH残高が必要です
            </div>
          </TabsContent>
          
          {/* アップグレードタブ */}
          <TabsContent value="upgrade" className="space-y-4 mt-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md text-amber-600 dark:text-amber-400 text-sm">
              ⚠️ コントラクトのアップグレードは高度な操作です。正しく実装されたコントラクトのみをデプロイしてください。
            </div>
            
            <div className="space-y-3">
              <div>
                <Label htmlFor="new-owner">新しいオーナーアドレス</Label>
                <Input
                  id="new-owner"
                  type="text"
                  placeholder="0x..."
                  value={newOwnerAddress}
                  onChange={e => setNewOwnerAddress(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <Button
                onClick={() => onChangeOwner(newOwnerAddress)}
                disabled={!newOwnerAddress || isLoading}
                variant="outline"
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  "オーナーを変更"
                )}
              </Button>
            </div>
            
            <div className="border-t border-slate-200 dark:border-slate-700 my-4"></div>
            
            <div className="space-y-3">
              <div>
                <Label htmlFor="implementation-address">新しい実装アドレス</Label>
                <Input
                  id="implementation-address"
                  type="text"
                  placeholder="0x..."
                  value={newImplementationAddress}
                  onChange={e => setNewImplementationAddress(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="init-data">初期化データ (オプション)</Label>
                <Input
                  id="init-data"
                  type="text"
                  placeholder="0x..."
                  value={upgradeInitData}
                  onChange={e => setUpgradeInitData(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    disabled={!newImplementationAddress || isLoading}
                    variant="outline"
                    className="w-full"
                  >
                    コントラクトをアップグレード
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>コントラクトアップグレードの確認</DialogTitle>
                    <DialogDescription className="text-red-500">
                      ⚠️ この操作は元に戻せません。新しい実装が正しく動作することを確認してください。
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-3 py-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 dark:text-slate-400">現在の実装</span>
                      <code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                        {shortenAddress(contractAddress)}
                      </code>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 dark:text-slate-400">新しい実装</span>
                      <code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                        {shortenAddress(newImplementationAddress)}
                      </code>
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" className="w-full sm:w-auto">キャンセル</Button>
                    <Button 
                      onClick={() => onUpgradeContract(newImplementationAddress, upgradeInitData)}
                      className="w-full sm:w-auto bg-red-500 hover:bg-red-600"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        "アップグレードを実行"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              <div className="text-xs text-slate-500 mt-2">
                ※UUPSプロキシパターンによるアップグレード機能です
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="bg-amber-50 dark:bg-amber-900/20 rounded-b-lg p-3 text-xs text-amber-600 dark:text-amber-400">
        コントラクトオーナー専用の管理パネルです。一般ユーザーには表示されません。
      </CardFooter>
    </Card>
  );
};

export default OwnerAdminPanel;