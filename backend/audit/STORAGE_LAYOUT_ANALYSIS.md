# Storage Layout Analysis - Raffle DApp Contracts

**Generated**: 2025-07-09  
**Tool**: `forge inspect <contract> storage-layout`

## Overview

This document provides a comprehensive analysis of storage layouts for all contracts in the Raffle DApp backend. Understanding storage layouts is crucial for UUPS proxy upgrades and ensuring storage compatibility between implementation versions.

## Contract Storage Summaries

| Contract                   | Storage Slots   | Type           | Key Features                           |
| -------------------------- | --------------- | -------------- | -------------------------------------- |
| RaffleImplementation       | 28 slots (0-27) | Implementation | Main raffle logic with VRF integration |
| RaffleBridgeImplementation | 12 slots (0-11) | Implementation | CCIP cross-chain bridge functionality  |
| MockVRFProvider            | 7 slots (0-6)   | Mock           | Testing VRF provider                   |
| RaffleProxy                | 0 slots         | Proxy          | UUPS proxy pattern                     |
| RaffleBridgeProxy          | 0 slots         | Proxy          | UUPS proxy pattern                     |
| RaffleLib                  | 0 slots         | Library        | Pure functions only                    |

## Detailed Storage Layouts

### 1. RaffleImplementation.sol (28 Storage Slots)

#### Core System Variables (Slots 0-1)

```
Slot 0: s_owner (address, 20 bytes)
Slot 1: s_pendingOwner (address, 20 bytes)
```

#### VRF Configuration (Slots 2-7)

```
Slot 2: s_vrfCoordinator (IVRFCoordinatorV2Plus, 20 bytes)
Slot 3: s_subscriptionId (uint256, 32 bytes)
Slot 4: s_keyHash (bytes32, 32 bytes)
Slot 5: s_callbackGasLimit (uint32, 4 bytes)
Slot 6: s_lastRequestId (uint256, 32 bytes)
Slot 7: s_mockVRFProvider (IMockRandomProvider, 20 bytes) + s_useMockVRF (bool, 1 byte)
```

#### Raffle Core Settings (Slots 8-13)

```
Slot 8:  s_entranceFee (uint256, 32 bytes)
Slot 9:  s_minimumPlayers (uint256, 32 bytes)
Slot 10: s_minTimeAfterMinPlayers (uint256, 32 bytes)
Slot 11: s_usdcAddress (address, 20 bytes)
Slot 12: s_jackpotAmount (uint256, 32 bytes)
Slot 13: s_raffleState (IRaffle.RaffleState enum, 1 byte)
```

#### Raffle State Management (Slots 14-20)

```
Slot 14: s_players (address[] dynamic array, 32 bytes)
Slot 15: s_recentWinner (address, 20 bytes)
Slot 16: s_recentPrize (uint256, 32 bytes)
Slot 17: s_recentJackpotWon (bool, 1 byte)
Slot 18: s_lastRaffleTime (uint256, 32 bytes)
Slot 19: s_minPlayersReachedTime (uint256, 32 bytes)
Slot 20: s_raffleHistory (RaffleHistory[] dynamic array, 32 bytes)
```

#### User Statistics (Slots 21-23)

```
Slot 21: s_userEntryCount (mapping(address => uint256), 32 bytes)
Slot 22: s_userWinCount (mapping(address => uint256), 32 bytes)
Slot 23: s_userJackpotCount (mapping(address => uint256), 32 bytes)
```

#### Advanced Features (Slots 24-27)

```
Slot 24: s_nativePayment_v2 (bool, 1 byte)
Slot 25: s_pendingRandomWord (uint256, 32 bytes)
Slot 26: s_pendingPlayers (address[] dynamic array, 32 bytes)
Slot 27: s_pendingPlayerCount (uint256, 32 bytes)
```

### 2. RaffleBridgeImplementation.sol (12 Storage Slots)

#### CCIP Router Configuration (Slots 0-1)

```
Slot 0: s_defaultRouter (address, 20 bytes)
Slot 1: s_chainRouters (mapping(uint64 => address), 32 bytes)
```

#### Bridge Core Settings (Slots 2-4)

```
Slot 2: s_usdcAddress (address, 20 bytes)
Slot 3: s_raffleAddress (address, 20 bytes)
Slot 4: s_owner (address, 20 bytes)
```

#### Chain Management (Slots 5-9)

```
Slot 5: s_supportedChains (mapping(uint64 => bool), 32 bytes)
Slot 6: s_chainNames (mapping(uint64 => string), 32 bytes)
Slot 7: s_destinationBridgeContracts (mapping(uint64 => address), 32 bytes)
Slot 8: s_chainPoolsLow (mapping(uint64 => bool), 32 bytes)
Slot 9: s_supportedSelectorsArray (uint64[] dynamic array, 32 bytes)
```

#### Bridge Configuration (Slots 10-11)

```
Slot 10: s_minimumPoolThreshold (uint256, 32 bytes)
Slot 11: s_initialized (bool, 1 byte)
```

### 3. MockVRFProvider.sol (7 Storage Slots)

#### VRF Mock Core (Slots 0-2)

```
Slot 0: s_lastRequestId (uint256, 32 bytes)
Slot 1: s_randomWords (uint256[] dynamic array, 32 bytes)
Slot 2: s_randomWordsAvailable (bool, 1 byte) + s_owner (address, 20 bytes)
```

#### Mock Management (Slots 3-6)

```
Slot 3: s_nonce (uint256, 32 bytes)
Slot 4: s_authorizedCallers (mapping(address => bool), 32 bytes)
Slot 5: s_isProcessing (bool, 1 byte)
Slot 6: s_lastProcessedBlock (uint256, 32 bytes)
```

### 4. Proxy Contracts (No Storage)

#### RaffleProxy.sol

```
No storage variables - UUPS proxy pattern
Storage is delegated to RaffleImplementation.sol
```

#### RaffleBridgeProxy.sol

```
No storage variables - UUPS proxy pattern
Storage is delegated to RaffleBridgeImplementation.sol
```

### 5. RaffleLib.sol (No Storage)

```
No storage variables - Pure library functions only
Contains utility functions for raffle operations
```

## Storage Layout Compatibility Notes

### UUPS Upgrade Considerations

1. **Storage Slot Preservation**: When upgrading implementations, existing storage slots MUST NOT be modified
2. **New Variables**: Always append new storage variables to the end of the layout
3. **Proxy Pattern**: Proxy contracts have no storage - all state is in implementations

### Critical Storage Patterns

#### Slot Packing Examples

```solidity
// Slot 7 in RaffleImplementation.sol
s_mockVRFProvider (20 bytes) + s_useMockVRF (1 byte) = 21 bytes total
// Remaining 11 bytes in slot 7 are unused

// Slot 2 in MockVRFProvider.sol
s_randomWordsAvailable (1 byte) + s_owner (20 bytes) = 21 bytes total
// Remaining 11 bytes in slot 2 are unused
```

#### Dynamic Arrays

```solidity
// These use separate storage slots for length and data
s_players (Slot 14) - Dynamic array of addresses
s_raffleHistory (Slot 20) - Dynamic array of structs
s_pendingPlayers (Slot 26) - Dynamic array of addresses
s_supportedSelectorsArray (Slot 9) - Dynamic array of uint64
```

#### Mappings

```solidity
// Mappings use keccak256 hashing for key-value storage
s_userEntryCount (Slot 21) - mapping(address => uint256)
s_chainRouters (Slot 1) - mapping(uint64 => address)
s_authorizedCallers (Slot 4) - mapping(address => bool)
```

## Upgrade Safety Guidelines

### ✅ Safe Upgrade Operations

- Add new storage variables at the end
- Modify function logic without changing storage
- Add new mappings or arrays after existing variables

### ❌ Unsafe Upgrade Operations

- Reorder existing storage variables
- Change types of existing variables
- Remove storage variables
- Insert variables between existing ones

### Example Safe Upgrade

```solidity
// Current RaffleImplementation.sol ends at slot 27
// Safe to add new variables:
contract RaffleImplementationV2 {
    // ... existing variables (slots 0-27)

    // New variables (safe to add)
    uint256 private s_newFeature;           // Slot 28
    mapping(address => bool) private s_vip; // Slot 29
}
```

## Testing Storage Layout

### Commands Used

```bash
# Check storage layout for each contract
forge inspect RaffleImplementation storage-layout
forge inspect RaffleBridgeImplementation storage-layout
forge inspect MockVRFProvider storage-layout
forge inspect RaffleProxy storage-layout
forge inspect RaffleBridgeProxy storage-layout
forge inspect RaffleLib storage-layout
```

### Verification Steps

1. ✅ All proxy contracts have no storage variables
2. ✅ Implementation contracts have proper slot allocation
3. ✅ No storage slot conflicts detected
4. ✅ Packed storage is efficiently utilized

## Important Notes

- **Storage slots 0-27** are fully utilized in RaffleImplementation.sol
- **Storage slots 0-11** are used in RaffleBridgeImplementation.sol
- **Proxy contracts** delegate all storage to implementations
- **Libraries** contain no state variables
- **Mock contracts** are for testing only and have isolated storage

This analysis ensures safe UUPS proxy upgrades and maintains storage compatibility across contract versions.
