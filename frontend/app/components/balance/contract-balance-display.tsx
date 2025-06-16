import { Wallet, CreditCard } from "lucide-react";

interface ContractBalanceDisplayProps {
  ethBalance: string;
  usdcBalance: string;
}

export function ContractBalanceDisplay({ 
  ethBalance, 
  usdcBalance 
}: ContractBalanceDisplayProps) {
  return (
    <div className="mb-2 md:mb-4 flex flex-wrap gap-2 justify-center md:justify-end">
      <div className="flex items-center gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-100 dark:bg-slate-700 rounded-full text-xs sm:text-sm whitespace-nowrap">
        <Wallet className="w-3 h-3 sm:w-4 sm:h-4 text-slate-500" />
        <span className="font-medium">
          {ethBalance} ETH
        </span>
      </div>
      <div className="flex items-center gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-100 dark:bg-slate-700 rounded-full text-xs sm:text-sm whitespace-nowrap">
        <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 text-slate-500" />
        <span className="font-medium">
          {(Number(usdcBalance) / 1000000).toFixed(2)} USDC
        </span>
      </div>
    </div>
  );
}