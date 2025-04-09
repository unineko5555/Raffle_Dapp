import React from 'react';
import { Cpu, ArrowRight, Clock, Hash, Zap, Trash2, Trophy, UserPlus } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

interface AutomationLog {
  timestamp: string;
  txHash: string;
  blockNumber: bigint;
  gasUsed?: bigint;
  event?: string;
  details?: string;
}

interface AutomationLogPanelProps {
  logs: AutomationLog[];
  onClear: () => void;
}

const AutomationLogPanel: React.FC<AutomationLogPanelProps> = ({ logs, onClear }) => {
  if (!logs || logs.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-medium">Automation & イベントログ</h3>
          </div>
          <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            監視中
          </Badge>
        </div>
        <div className="text-center py-6 text-slate-500 dark:text-slate-400">
          <div className="mb-2">
            <Cpu className="w-8 h-8 mx-auto text-slate-400" />
          </div>
          <p>Automation発火やイベント発生時にログが表示されます</p>
          <p className="text-xs mt-1">ブラウザを開いたままにしておいてください</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-indigo-500" />
          <h3 className="text-lg font-medium">Automation & イベントログ</h3>
          <Badge className="ml-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
            {logs.length}件
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-1.5"></div>
            監視中
          </Badge>
          <button 
            onClick={onClear}
            className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
            title="ログをクリア"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {logs.map((log, index) => (
          <div key={index} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 text-sm relative">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-1.5">
                {log.event === 'WinnerPicked' ? (
                  <Badge className="bg-amber-500 text-white text-xs">
                    <Trophy className="w-3 h-3 mr-1" />
                    当選者決定
                  </Badge>
                ) : log.event === 'StateChanged' ? (
                  <Badge className="bg-blue-500 text-white text-xs">
                    <ArrowRight className="w-3 h-3 mr-1" />
                    状態変更
                  </Badge>
                ) : log.event === 'RaffleEnter' ? (
                  <Badge className="bg-green-500 text-white text-xs">
                    <UserPlus className="w-3 h-3 mr-1" />
                    参加
                  </Badge>
                ) : (
                  <Badge className="bg-purple-500 text-white text-xs">
                    <Zap className="w-3 h-3 mr-1" />
                    Automation
                  </Badge>
                )}
                <span className="text-slate-500 dark:text-slate-400 text-xs">
                  <Clock className="w-3 h-3 inline mr-1 opacity-70" />
                  {log.timestamp}
                </span>
              </div>
              <a
                href={`https://sepolia.etherscan.io/tx/${log.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-xs flex items-center gap-1"
              >
                <Hash className="w-3 h-3" />
                {log.txHash.slice(0, 6)}...{log.txHash.slice(-4)}
              </a>
            </div>
            
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <div className="text-slate-600 dark:text-slate-300">
                <span className="font-medium">ブロック:</span> {log.blockNumber.toString()}
              </div>
              {log.gasUsed && (
                <div className="text-slate-600 dark:text-slate-300">
                  <span className="font-medium">ガス使用量:</span> {log.gasUsed.toString()}
                </div>
              )}
              {log.details && (
                <div className="w-full mt-1 text-slate-700 dark:text-slate-300 font-mono text-[10px] bg-slate-100 dark:bg-slate-700/70 p-1.5 rounded">
                  {log.details}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AutomationLogPanel;