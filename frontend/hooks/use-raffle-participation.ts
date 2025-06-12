"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";

import { formatUnits } from "viem";
import { RaffleABI, ERC20ABI, contractConfig } from "@/app/lib/contract-config";
import { useSmartAccountContext } from "@/app/providers/smart-account-provider";

// contractConfigのキーの型を定義
type SupportedChainId = keyof typeof contractConfig;

export function useRaffleParticipation() {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // スマートアカウント機能を使用
  const { smartAccountAddress, isReadyToSendTx, sendUserOperation } = useSmartAccountContext();

  // プレイヤーの参加状態を管理
  const [isPlayerEntered, setIsPlayerEntered] = useState(false);
  // 状態変更時間を追跡
  const [lastStateChange, setLastStateChange] = useState(Date.now());
  
  // 参加状態の変更が適切な間隔で行われるようにデバウンス機能を追加
  const [lastStateChangeDebounce, setLastStateChangeDebounce] = useState(0);
  const STATE_CHANGE_DEBOUNCE = 2000; // 2秒間隔でデバウンス

  // トークン残高情報
  const [tokenBalanceInfo, setTokenBalanceInfo] = useState<{
    hasEnoughBalance: boolean;
    balance: string;
    requiredAmount: string;
  }>({
    hasEnoughBalance: false,
    balance: "0",
    requiredAmount: "0",
  });

  // チェーンIDから正しいコントラクトアドレスを取得
  // サポートされているチェーンIDのみを受け入れ、不正な場合はnullを返す
  const supportedChainIds = [11155111, 84532, 421614] as const;
  const isValidChainId = chainId && supportedChainIds.includes(chainId as any);
  const currentChainId = isValidChainId ? chainId : null;
  const contractAddress = currentChainId ? 
    contractConfig[currentChainId as SupportedChainId]?.raffleProxy || null : null;
  const erc20Address = currentChainId ?
    contractConfig[currentChainId as SupportedChainId]?.erc20Address || null : null;
  
  // プロバイダーチェック
  const publicClient = usePublicClient({ chainId: currentChainId || undefined });

  // コントラクト書き込み関数
  const {
    writeContract,
    writeContractAsync,
    data: contractWriteData,
    error: contractWriteError,
  } = useWriteContract();

  // トランザクション待機
  const { isLoading: isTransactionLoading, isSuccess: isTransactionSuccess } =
    useWaitForTransactionReceipt({
      hash: contractWriteData,
    });

  // エントランス料金を取得
  const { data: entranceFeeData } = useReadContract(
    contractAddress
      ? {
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "getEntranceFee",
          chainId: currentChainId || undefined,
        }
      : undefined
  );

  // プレイヤー参加状態のキャッシュ用変数
  let lastPlayerCheckTime = 0;
  const PLAYER_CHECK_INTERVAL = 15000; // 15秒に延長

  // プレイヤーの参加状態を確認 - スマートアカウントアドレスのサポートを追加
  const checkPlayerEntered = async (checkAddress = "") => {
    // チェック対象のアドレスを決定 - 引数で指定されたアドレスか通常の接続アドレス
    const targetAddress = checkAddress || address;

    if (
      (!isConnected && !checkAddress) ||
      !targetAddress ||
      !contractAddress ||
      !publicClient
    ) {
      setIsPlayerEntered(false);
      return false;
    }

    // 状態更新を適切な間隔で行う
    const now = Date.now();
    if (now - lastPlayerCheckTime < PLAYER_CHECK_INTERVAL) {
      // キャッシュ有効期間内は現在の状態をそのまま返す
      return isPlayerEntered;
    }

    try {
      // 前回のチェックと比較するために現在の状態を記録
      const prevIsPlayerEntered = isPlayerEntered;

      // プレイヤーリストを取得
      const players: string[] = [];
      
      try {
        // プレイヤー数を取得
        const playerCountResult = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: RaffleABI,
          functionName: "getNumberOfPlayers",
        });
        
        const playerCount = Number(playerCountResult || 0);
        
        // プレイヤーが0人の場合は早期リターン
        if (playerCount <= 0) {
          setIsPlayerEntered(false);
          lastPlayerCheckTime = now;
          return false;
        }
        
        // 効率的な方法: 直接ターゲットアドレスがプレイヤーに含まれているかをチェック
        for (let i = 0; i < playerCount; i++) {
          const player = await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: RaffleABI,
            functionName: "getPlayer",
            args: [BigInt(i)],
          });
          
          if (player) {
            players.push(player as string);
            // 現在のプレイヤーが対象アドレスと一致するか確認
            if ((player as string).toLowerCase() === targetAddress.toLowerCase()) {
              // 見つかった場合は早期リターン
              setIsPlayerEntered(true);
              lastPlayerCheckTime = now;
              
              // 状態が変わった場合のみデバッグ情報を出力
              if (prevIsPlayerEntered !== true) {
                setLastStateChange(Date.now());
              }
              
              return true;
            }
          }
          
          // 3-4人程度なので、2人目以降はレート制限回避のために少し待機
          if (i > 0 && i < playerCount - 1) {
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        }
      } catch (error) {
        console.error("プレイヤーリスト取得エラー:", error);
      }

      // プレイヤー配列内にアドレスがあるかをチェック
      const isEntered = players.some(
        (player) => player.toLowerCase() === targetAddress.toLowerCase()
      );

      // 状態が変わった場合のみデバッグ情報を出力
      if (prevIsPlayerEntered !== isEntered) {
        // 現在時刻を取得
        const now = Date.now();
        
        // デバウンスチェック - 前回の状態変更から指定時間経過していない場合はスキップ
        if (now - lastStateChangeDebounce < STATE_CHANGE_DEBOUNCE) {
          console.log("状態変更をデバウンスでスキップ");
          return isPlayerEntered; // 現在の状態をそのまま返す
        }
        
        // デバウンス時間を更新
        setLastStateChangeDebounce(now);
        
        // 状態変更時間を更新
        setLastStateChange(now);

        // 最近のログ出力から3秒以上経過していればログを出力
        if (now - lastStateChange > 3000) {
          console.log("参加状態変更:", {
            targetAddress,
            prevState: prevIsPlayerEntered,
            newState: isEntered,
            playerCount: players.length,
          });
        }
      }

      // 状態を更新
      setIsPlayerEntered(isEntered);
      lastPlayerCheckTime = now; // チェック時間を更新

      // 結果を返す
      return isEntered;
    } catch (error) {
      console.error("プレイヤー参加状態確認エラー:", error);
      // エラーの場合は参加していないと判断
      setIsPlayerEntered(false);
      return false;
    }
  };

  // トークン残高チェック用関数
  const checkTokenBalance = async (checkAddress = "") => {
    const accountAddress = checkAddress || address;

    if (
      (!isConnected && !checkAddress) ||
      !accountAddress ||
      !erc20Address ||
      !publicClient
    )
      return false;

    try {
      const balance = await publicClient.readContract({
        address: erc20Address as `0x${string}`,
        abi: ERC20ABI,
        functionName: "balanceOf",
        args: [accountAddress],
      });

      const minRequired = entranceFeeData || BigInt(10000000);

      if (
        typeof balance === "bigint" &&
        typeof minRequired === "bigint" &&
        balance < minRequired
      ) {
        setError(
          `トークン残高が不足しています (${formatUnits(
            balance as bigint,
            6
          )} / 必要額: ${formatUnits(minRequired, 6)} USDC)`
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error("トークン残高チェックエラー:", error);
      return false;
    }
  };

  // トークン残高チェック用関数 - 情報も返すバージョン
  const checkTokenBalanceWithInfo = async (checkAddress = "") => {
    const accountAddress = checkAddress || address;

    if (
      (!isConnected && !checkAddress) ||
      !accountAddress ||
      !erc20Address ||
      !publicClient
    ) {
      return { hasEnoughBalance: false, balance: "0", requiredAmount: "0" };
    }

    try {
      const balance = await publicClient.readContract({
        address: erc20Address as `0x${string}`,
        abi: ERC20ABI,
        functionName: "balanceOf",
        args: [accountAddress],
      });

      const minRequired = entranceFeeData || BigInt(10000000);

      const formattedBalance =
        typeof balance === "bigint" ? formatUnits(balance, 6) : "0";
      const formattedRequired =
        typeof minRequired === "bigint" ? formatUnits(minRequired, 6) : "0";

      const hasEnough =
        typeof balance === "bigint" &&
        typeof minRequired === "bigint" &&
        balance >= minRequired;

      if (!hasEnough) {
        setError(
          `トークン残高が不足しています (${formattedBalance} / 必要額: ${formattedRequired} USDC)`
        );
      }

      // 残高情報を状態に保存
      const balanceInfo = {
        hasEnoughBalance: hasEnough,
        balance: formattedBalance,
        requiredAmount: formattedRequired,
      };
      setTokenBalanceInfo(balanceInfo);

      return balanceInfo;
    } catch (error) {
      console.error("トークン残高チェックエラー:", error);
      return { hasEnoughBalance: false, balance: "0", requiredAmount: "0" };
    }
  };

  // 承認状態チェック用関数
  const checkAllowance = async (checkAddress = "") => {
    const accountAddress = checkAddress || address;

    if (
      (!isConnected && !checkAddress) ||
      !accountAddress ||
      !erc20Address ||
      !contractAddress ||
      !publicClient
    )
      return false;

    try {
      const allowance = await publicClient.readContract({
        address: erc20Address as `0x${string}`,
        abi: ERC20ABI,
        functionName: "allowance",
        args: [accountAddress, contractAddress as `0x${string}`],
      });

      const minRequired = entranceFeeData || BigInt(10000000);
      return (
        typeof allowance === "bigint" &&
        typeof minRequired === "bigint" &&
        allowance >= minRequired
      );
    } catch (error) {
      console.error("承認状態チェックエラー:", error);
      return false;
    }
  };

  // ラッフルに参加する関数
  const handleEnterRaffle = async (smartAccountAddress = "") => {
    // スマートアカウントが渡された場合はそれを使用し、そうでなければ通常のEOAを使用
    const userAddress = smartAccountAddress || address;

    if (!isConnected && !smartAccountAddress) {
      setError("ウォレットが接続されていません");
      return { success: false, error: "ウォレットが接続されていません" };
    }

    if (!contractAddress || !erc20Address) {
      setError("コントラクトアドレスが設定されていません");
      return {
        success: false,
        error: "コントラクトアドレスが設定されていません",
      };
    }

    // プレイヤーがすでに参加しているかチェック - スマートアカウントアドレスが渡された場合はそのアドレスを使用してチェック
    const playerEntered = await checkPlayerEntered(smartAccountAddress);
    if (playerEntered) {
      setError("あなたはすでにこのラッフルに参加しています");
      return {
        success: false,
        error: "あなたはすでにこのラッフルに参加しています",
      };
    }

    try {
      setIsLoading(true);
      setError(null);

      // トークン残高チェック
      const hasEnoughBalance = await checkTokenBalance(userAddress);
      if (!hasEnoughBalance) {
        throw new Error(
          error ||
            "トークン残高が不足しています。テストネットUSDCを取得してください。"
        );
      }

      // ERC20承認用のヘルパー関数
      const approveErc20Transaction = async (): Promise<
        `0x${string}` | null
      > => {
        // Return hash or null
        // 既存の承認状態をチェック
        const hasAllowance = await checkAllowance(userAddress);
        if (hasAllowance) {
          return null; // Indicate no approval needed or already done
        }

        if (!writeContractAsync) {
          // writeContractAsync を使用
          throw new Error("コントラクト書き込み機能(async)が利用できません");
        }
        if (!publicClient) throw new Error("Public client is not available");

        // ApproveをSimulateする
        let approveRequest;
        try {
          const simulationResult = await publicClient.simulateContract({
            address: erc20Address as `0x${string}`,
            abi: ERC20ABI,
            functionName: "approve",
            args: [contractAddress as `0x${string}`, BigInt("100000000000000")], // 大きめの値で承認
            account: userAddress as `0x${string}`,
          });
          approveRequest = simulationResult.request;
        } catch (simError) {
          throw new Error(
            `承認トランザクションのシミュレーションに失敗しました: ${
              simError instanceof Error ? simError.message : simError
            }`
          );
        }

        if (!approveRequest) {
          throw new Error("承認リクエストの準備に失敗しました");
        }

        try {
          // 承認処理を実行し、ハッシュを取得
          let approveHash: `0x${string}` | undefined;
          try {
            approveHash = await writeContractAsync(approveRequest); // writeContractAsync を使用
          } catch (writeError) {
            // Check for user rejection specifically
            if (
              writeError instanceof Error &&
              (writeError.message.includes("rejected") ||
                writeError.message.includes("denied") ||
                writeError.message.includes("User rejected"))
            ) {
              throw new Error("ユーザーが承認トランザクションを拒否しました。");
            }
            throw new Error(
              `承認トランザクションの送信に失敗しました: ${
                writeError instanceof Error ? writeError.message : writeError
              }`
            );
          }

          // トランザクション完了を待機する
          if (!approveHash) {
            throw new Error(
              "承認トランザクションハッシュが取得できませんでした。"
            );
          }
          try {
            const approveReceipt = await publicClient.waitForTransactionReceipt(
              { hash: approveHash }
            );
            if (approveReceipt.status !== "success") {
              throw new Error(
                `Approve transaction failed with status: ${approveReceipt.status}`
              );
            }
            return approveHash;
          } catch (receiptError) {
            throw new Error(
              `承認トランザクションの完了待機中にエラーが発生しました: ${
                receiptError instanceof Error
                  ? receiptError.message
                  : receiptError
              }`
            );
          }
        } catch (err) {
          if (
            err instanceof Error &&
            (err.message.includes("rejected") ||
              err.message.includes("denied") ||
              err.message.includes("User rejected"))
          ) {
            throw new Error("ユーザーが承認トランザクションを拒否しました。");
          }
          throw err;
        }
      };

      // エントランス料金を使用してトークン承認
      try {
        const approveTxHash = await approveErc20Transaction();

        if (approveTxHash) {
          console.log(`Approval transaction successful: ${approveTxHash}`);
        } else {
          console.log("Approval not needed or already sufficient.");
        }

        // 承認後、承認状態を再確認 (念のため)
        const allowanceAfterApprove = await checkAllowance(userAddress);
        if (!allowanceAfterApprove) {
          throw new Error(
            "承認処理は完了しましたが、承認状態がまだ反映されていません。ネットワークの混雑状況を確認し、少し時間をおいてから再試行してください。"
          );
        }
      } catch (error: any) {
        console.error("トークン承認プロセスエラー:", error);
        setError(`トークン承認エラー: ${error.message || "不明なエラー"}`);
        setIsLoading(false);
        return {
          success: false,
          error: `トークン承認エラー: ${error.message || "不明なエラー"}`,
        };
      }

      // enterRaffleの処理 (承認が成功した場合のみ実行)
      try {
        console.log("Attempting to enter raffle...");
        // enterRaffleのシミュレーション
        if (!publicClient) throw new Error("Public client is not available");
        if (!writeContractAsync)
          throw new Error("コントラクト書き込み機能(async)が利用できません"); // writeContractAsync を使用

        let enterRaffleRequest;
        try {
          const simulationResult = await publicClient.simulateContract({
            address: contractAddress as `0x${string}`,
            abi: RaffleABI,
            functionName: "enterRaffle",
            account: userAddress as `0x${string}`,
          });
          enterRaffleRequest = simulationResult.request;
        } catch (simError) {
          throw new Error(
            `ラッフル参加トランザクションのシミュレーションに失敗しました: ${
              simError instanceof Error ? simError.message : simError
            }`
          );
        }

        if (!enterRaffleRequest) {
          throw new Error("ラッフル参加リクエストの準備に失敗しました");
        }

        // ラッフル参加トランザクション
        let enterRaffleTxHash: `0x${string}` | undefined;
        try {
          enterRaffleTxHash = await writeContractAsync(enterRaffleRequest);
        } catch (writeError) {
          if (
            writeError instanceof Error &&
            (writeError.message.includes("rejected") ||
              writeError.message.includes("denied") ||
              writeError.message.includes("User rejected"))
          ) {
            throw new Error(
              "ユーザーがラッフル参加トランザクションを拒否しました。"
            );
          }
          throw new Error(
            `ラッフル参加トランザクションの送信に失敗しました: ${
              writeError instanceof Error ? writeError.message : writeError
            }`
          );
        }

        // トランザクション完了を待機
        if (!enterRaffleTxHash) {
          throw new Error(
            "ラッフル参加トランザクションハッシュが取得できませんでした。"
          );
        }
        try {
          const enterRaffleReceipt =
            await publicClient.waitForTransactionReceipt({
              hash: enterRaffleTxHash,
            });
          if (enterRaffleReceipt.status !== "success") {
            throw new Error(
              `Enter raffle transaction failed with status: ${enterRaffleReceipt.status}`
            );
          }
        } catch (receiptError) {
          throw new Error(
            `ラッフル参加トランザクションの完了待機中にエラーが発生しました: ${
              receiptError instanceof Error
                ? receiptError.message
                : receiptError
            }`
          );
        }
        // トランザクション成功！データを再取得して状態を更新
        console.log("Enter raffle transaction successful. Updating data...");
        
        // 参加状態を再確認
        await checkPlayerEntered(userAddress);

        return { success: true, hash: enterRaffleTxHash };
      } catch (error: any) {
        console.error("ラッフル参加エラー:", error);
        let errorMessage = `ラッフル参加エラー: ${
          error.message || "不明なエラー"
        }`;
        if (
          error.message.includes("rejected") ||
          error.message.includes("denied")
        ) {
          errorMessage =
            "ユーザーがラッフル参加トランザクションを拒否しました。";
        }
        setError(errorMessage);
        throw error; // Re-throw to be caught by the outer catch
      }
    } catch (error: any) {
      // Outer try-catch for the whole handleEnterRaffle
      console.error("Overall error in handleEnterRaffle:", error);
      // Use the error message from the inner catch if it was re-thrown, otherwise use the general message
      const finalErrorMessage =
        error.message.startsWith("ラッフル参加エラー:") ||
        error.message.startsWith("ユーザーが")
          ? error.message // Use specific error message if available
          : `ラッフル参加中に予期せぬエラーが発生しました: ${
              error.message || "不明なエラー詳細"
            }`;
      setError(finalErrorMessage); // Set final error message
      return { success: false, error: finalErrorMessage };
    } finally {
      // Ensure isLoading is always set to false
      setIsLoading(false);
    }
  };

  // ページロード時に参加状態をリセット
  useEffect(() => {
    return () => {
      setIsPlayerEntered(false);
    };
  }, []);

  return {
    isLoading: isLoading || isTransactionLoading,
    error,
    isPlayerEntered,
    contractAddress,
    erc20Address,
    handleEnterRaffle,
    checkPlayerEntered,
    tokenBalanceInfo,
    checkTokenBalanceWithInfo,
  };
}
