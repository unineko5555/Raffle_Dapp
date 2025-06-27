import { NextRequest } from 'next/server';
import { buildConditionalQuery, executeQuery, createErrorResponse, createSuccessResponse } from '@/app/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const network = searchParams.get('network');
    const userAddress = searchParams.get('userAddress');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    const baseQuery = `
      SELECT 
        winner,
        prize,
        is_jackpot,
        tx_hash,
        block_number,
        network,
        tx_index,
        log_index
      FROM raffle_indexer_raffle_implementation.winner_picked
    `;

    // 共通クエリビルダーを使用
    const conditions = [
      { field: 'network', value: network },
      { field: 'winner', value: userAddress, operator: 'LOWER' }
    ].filter(c => c.value !== null);

    const { query, params } = buildConditionalQuery(
      baseQuery,
      conditions,
      'block_number DESC',
      limit,
      offset
    );

    const result = await executeQuery(query, params);

    const historyData = result.rows.map(row => ({
      winner: row.winner,
      prize: row.prize,
      jackpotWon: row.is_jackpot,
      txHash: row.tx_hash,
      blockNumber: row.block_number,
      network: row.network,
      txIndex: row.tx_index,
      logIndex: row.log_index,
    }));

    return createSuccessResponse(historyData, result.rowCount || 0);

  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch raffle history');
  }
}