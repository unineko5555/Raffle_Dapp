// ラッフルの参加を取り消す関数
export const createHandleCancelEntry = (
  isConnected: boolean,
  address: string | undefined,
  contractAddress: string,
  checkPlayerEntered: () => Promise<boolean>,
  publicClient: any,
  writeContract: any,
  setIsLoading: (loading: boolean) => void,
  setError: (error: string | null) => void,
  updateRaffleData: (forceUpdate?: boolean) => Promise<void>,
  RaffleABI: any
) => {
  return async () => {
    if (!isConnected || !address) {
      setError("ウォレットが接続されていません");
      return { success: false, error: "ウォレットが接続されていません" };
    }

    if (!contractAddress) {
      setError("コントラクトアドレスが設定されていません");
      return { success: false, error: "コントラクトアドレスが設定されていません" };
    }
    
    // プレイヤーが参加しているかチェック
    const playerEntered = await checkPlayerEntered();
    if (!playerEntered) {
      setError("あなたはこのラッフルに参加していません");
      return { success: false, error: "あなたはこのラッフルに参加していません" };
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log("ラッフルの参加を取り消します");
      
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
        const cancelTxHash = await writeContract(request);
        
        console.log('ラッフル参加取り消しトランザクションハッシュ:', cancelTxHash);

        // トランザクション完了を待機
        if (cancelTxHash) {
          console.log('トランザクション完了を待機中...');
          
          try {
            const receipt = await publicClient.waitForTransactionReceipt({ hash: cancelTxHash });
            console.log('ラッフル参加取り消しトランザクション完了:', receipt);
            
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
                await checkPlayerEntered();
              } else {
                console.warn('checkPlayerEntered関数が利用できません');
              }
            } catch (checkError) {
              console.warn('参加状態確認エラー:', checkError);
            }
          } catch (receiptError) {
            console.error('トランザクション受領エラー:', receiptError);
            throw new Error(`取り消しトランザクションの完了確認に失敗しました: ${receiptError instanceof Error ? receiptError.message : '不明なエラー'}`);
          }
        } else {
          console.warn('トランザクションハッシュが取得できませんでした');
        }
        
        return {
          success: true,
          txHash: cancelTxHash || "",
        };
      } catch (error) {
        console.error('ラッフル参加取り消しエラー:', error);
        throw new Error(`ラッフル参加取り消しに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
      }
    } catch (err) {
      console.error("Error canceling raffle entry:", err);
      setError(err instanceof Error ? err.message : "ラッフル参加取り消し中にエラーが発生しました");
      return { success: false, error: err instanceof Error ? err.message : "ラッフル参加取り消し中にエラーが発生しました" };
    } finally {
      setIsLoading(false);
    }
  };
};
