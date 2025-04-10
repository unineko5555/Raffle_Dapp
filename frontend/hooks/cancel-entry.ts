import { encodeFunctionData } from "viem";

// ラッフルの参加を取り消す関数
export const createHandleCancelEntry = (
  isConnected: boolean,
  address: string | undefined,
  contractAddress: string,
  checkPlayerEntered: (addressToCheck?: string) => Promise<boolean>,
  publicClient: any,
  writeContract: any,
  setIsLoading: (loading: boolean) => void,
  setError: (error: string | null) => void,
  updateRaffleData: (forceUpdate?: boolean) => Promise<void>,
  RaffleABI: any,
  smartAccountParams?: {
    smartAccountAddress?: string | null;
    isReadyToSendTx?: boolean;
    sendUserOperation?: (to: string, data: string, value?: bigint) => Promise<{ userOpHash: string; txHash: string }>;
  }
) => {
  return async () => {
    // スマートアカウントの使用判定
    const useSmartAccount = smartAccountParams?.smartAccountAddress && 
                          smartAccountParams?.isReadyToSendTx && 
                          smartAccountParams?.sendUserOperation;
    
    // 使用するアドレスの決定
    const userAddress = useSmartAccount ? smartAccountParams?.smartAccountAddress : address;
    
    if (!isConnected && !useSmartAccount) {
      setError("ウォレットが接続されていません");
      return { success: false, error: "ウォレットが接続されていません" };
    }

    if (!contractAddress) {
      setError("コントラクトアドレスが設定されていません");
      return { success: false, error: "コントラクトアドレスが設定されていません" };
    }
    
    if (!userAddress) {
      setError("有効なユーザーアドレスがありません");
      return { success: false, error: "有効なユーザーアドレスがありません" };
    }
    
    // プレイヤーが参加しているかチェック
    const playerEntered = await checkPlayerEntered(userAddress);
    if (!playerEntered) {
      setError("あなたはこのラッフルに参加していません");
      return { success: false, error: "あなたはこのラッフルに参加していません" };
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log("ラッフルの参加を取り消します");
      console.log("使用アドレス:", userAddress);
      console.log("使用モード:", useSmartAccount ? "スマートアカウント" : "通常EOA");
      
      let cancelTxHash = "";
      
      // スマートアカウントを使用する場合
      if (useSmartAccount && smartAccountParams.sendUserOperation) {
        try {
          console.log("スマートアカウントで参加取り消し処理を実行中...");
          
          // cancelEntry関数のエンコード
          const cancelEntryCallData = encodeFunctionData({
            abi: RaffleABI,
            functionName: 'cancelEntry',
            args: []
          });
          
          // UserOperationを送信
          const cancelResult = await smartAccountParams.sendUserOperation(
            contractAddress as `0x${string}`,
            cancelEntryCallData,
            BigInt(0)
          );
          
          cancelTxHash = cancelResult.txHash;
          console.log('スマートアカウント参加取り消しトランザクションハッシュ:', cancelTxHash);
          
          // トランザクション処理後、データの更新が反映されるのを待つ
          console.log('データ反映のために少し待機します...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (smartAccountError) {
          console.error('スマートアカウント参加取り消しエラー:', smartAccountError);
          throw new Error(`スマートアカウントでの参加取り消しに失敗しました: ${smartAccountError instanceof Error ? smartAccountError.message : '不明なエラー'}`);
        }
      } 
      // 通常のEOAを使用する場合
      else {
        try {
          // cancelEntryのシミュレーション
          const { request } = await publicClient.simulateContract({
            address: contractAddress as `0x${string}`,
            abi: RaffleABI,
            functionName: "cancelEntry",
            account: address
          });

          if (!request) {
            throw new Error("リクエストの準備に失敗しました");
          }
          
          // ラッフル参加取り消しトランザクション
          cancelTxHash = await writeContract(request);
          
          console.log('EOAでのラッフル参加取り消しトランザクションハッシュ:', cancelTxHash);

          // トランザクション完了を待機
          if (cancelTxHash) {
            console.log('トランザクション完了を待機中...');
            
            try {
              const receipt = await publicClient.waitForTransactionReceipt({ hash: cancelTxHash });
              console.log('ラッフル参加取り消しトランザクション完了:', receipt);
            } catch (receiptError) {
              console.error('トランザクション受領エラー:', receiptError);
              // エラーをスローせず、処理を継続
              console.warn('トランザクション受領エラーが発生しましたが、処理を継続します');
            }
          } else {
            console.warn('トランザクションハッシュが取得できませんでした');
          }
        } catch (error) {
          console.error('EOAでのラッフル参加取り消しエラー:', error);
          throw new Error(`ラッフル参加取り消しに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
        }
      }
      
      // トランザクション処理後、データの更新が反映されるのを待つ
      console.log('データ反映のために少し待機します...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // データを再取得して状態を更新
      console.log('データを再取得します');
      
      try {
        // updateRaffleDataが正しく渡されているか確認
        if (typeof updateRaffleData === 'function') {
          await updateRaffleData(true); // 強制更新
        } else {
          console.warn('updateRaffleData関数が利用できません');
        }
      } catch (updateError) {
        console.warn('データ更新エラー:', updateError);
      }
      
      try {
        // 参加状態を再確認
        if (typeof checkPlayerEntered === 'function') {
          await checkPlayerEntered(userAddress);
        } else {
          console.warn('checkPlayerEntered関数が利用できません');
        }
      } catch (checkError) {
        console.warn('参加状態確認エラー:', checkError);
      }
      
      return {
        success: true,
        txHash: cancelTxHash || "",
      };
    } catch (err) {
      console.error("Error canceling raffle entry:", err);
      setError(err instanceof Error ? err.message : "ラッフル参加取り消し中にエラーが発生しました");
      return { success: false, error: err instanceof Error ? err.message : "ラッフル参加取り消し中にエラーが発生しました" };
    } finally {
      setIsLoading(false);
    }
  };
};
