import { Badge } from "@/components/ui/badge";
import { RafflePrizeInfo } from "./raffle-prize-info";
import { RaffleCountdown } from "./raffle-countdown";
import { PlayersList } from "./players-list";
import { StartRaffleButton } from "./start-raffle-button";
import { RaffleHistory } from "./raffle-history";
import { RaffleHeader } from "./raffle-header";
import { EnterRaffleButton } from "./enter-raffle-button";
import RaffleEntryStatus from "./raffle-entry-status";
import JackpotInfo from "./jackpot-info";

interface RaffleMainContentProps {
  // Raffle data
  raffleData: {
    numberOfPlayers: number;
    entranceFee: string | bigint;
    jackpotAmount: string;
    players: string[];
    raffleState: number;
  };
  isLoading: boolean;
  contractAddress: string;
  
  // Countdown data
  minPlayersReachedTime: number;
  minimumPlayers: number;
  
  // History data
  pastRaffles: any[];
  currentAddress?: string;
  isHistoryLoading: boolean;
  
  // Connection state
  isConnected: boolean;
  isReadyToSendTx: boolean;
  isSmartAccountLoading: boolean;
  
  // Callbacks
  onRaffleEntrySuccess: () => void;
  onStartRaffle: () => Promise<void>;
  onStartRaffleWithVRF: () => Promise<void>;
  onStartRaffleWithMock: () => Promise<void>;
}

export function RaffleMainContent({
  raffleData,
  isLoading,
  contractAddress,
  minPlayersReachedTime,
  minimumPlayers,
  pastRaffles,
  currentAddress,
  isHistoryLoading,
  isConnected,
  isReadyToSendTx,
  isSmartAccountLoading,
  onRaffleEntrySuccess,
  onStartRaffle,
  onStartRaffleWithVRF,
  onStartRaffleWithMock,
}: RaffleMainContentProps) {
  return (
    <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl md:rounded-2xl shadow-lg p-3 sm:p-4 md:p-6 transition-all duration-300 hover:shadow-xl backdrop-blur-sm bg-white/80 dark:bg-slate-800/80">
      <RaffleHeader />

      <RafflePrizeInfo
        numberOfPlayers={raffleData.numberOfPlayers}
        isLoading={isLoading}
      />

      <JackpotInfo
        jackpotAmount={BigInt(raffleData.jackpotAmount || "0")}
        entranceFee={10}
        jackpotProbability={35}
        contributionRate={10}
      />

      <RaffleCountdown 
        minPlayersReachedTime={minPlayersReachedTime}
        raffleState={raffleData.raffleState}
        playerCount={raffleData.numberOfPlayers}
        minimumPlayers={minimumPlayers}
        minTimeAfterMinPlayers={60} // 1 minute in seconds
      />

      <PlayersList
        players={raffleData.players || []}
        numberOfPlayers={raffleData.numberOfPlayers}
        isLoading={isLoading}
        minPlayers={3}
      />

      <div className="relative">
        <RaffleEntryStatus />
        <EnterRaffleButton
          raffleAddress={contractAddress || ""}
          entryFee={
            typeof raffleData.entranceFee === "string"
              ? BigInt(raffleData.entranceFee)
              : raffleData.entranceFee || BigInt(10)
          }
          isRaffleOpen={!isLoading}
          onSuccess={onRaffleEntrySuccess}
        />
        <div className="absolute -top-2 right-2">
          <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0">
            ガス代無料
          </Badge>
        </div>
      </div>

      <StartRaffleButton
        isConnected={isConnected}
        isReadyToSendTx={isReadyToSendTx}
        numberOfPlayers={raffleData.numberOfPlayers}
        minPlayers={3}
        isLoading={isLoading}
        isSmartAccountLoading={isSmartAccountLoading}
        onStartRaffle={onStartRaffle}
        onStartRaffleWithVRF={onStartRaffleWithVRF}
        onStartRaffleWithMock={onStartRaffleWithMock}
      />

      <RaffleHistory
        pastRaffles={pastRaffles || []}
        currentAddress={currentAddress}
        isLoading={isHistoryLoading}
      />
    </div>
  );
}