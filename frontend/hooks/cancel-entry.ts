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
          const receipt = await publicClient.waitForTransactionReceipt({ hash: cancelTxHash });
          console.log('ラッフル参加取り消しトランザクション完了:', receipt);
          
          // データを再取得して状態を更新
          console.log('データを再取得します');
          await updateRaffleData(true);
          await checkPlayerEntered();
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
