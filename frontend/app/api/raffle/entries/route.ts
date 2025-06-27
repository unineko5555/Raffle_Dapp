import { NextRequest } from 'next/server';
import { buildConditionalQuery, executeQuery, createErrorResponse, createSuccessResponse } from '@/app/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const network = searchParams.get('network');
    const userAddress = searchParams.get('userAddress');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const baseQuery = `
      SELECT 
        player,
        entrance_fee,
        tx_hash,
        block_number,
        network,
        tx_index,
        log_index
      FROM raffle_indexer_raffle_implementation.raffle_enter
    `;

    // 共通クエリビルダーを使用
    const conditions = [
      { field: 'network', value: network },
      { field: 'player', value: userAddress, operator: 'LOWER' }
    ].filter(c => c.value !== null);

    const { query, params } = buildConditionalQuery(
      baseQuery,
      conditions,
      'block_number DESC',
      limit,
      offset
    );

    interface RaffleEntryRow {
      player: string;
      entrance_fee: string;
      tx_hash: string;
      block_number: number;
      network: string;
      tx_index: number;
      log_index: number;
    }

    const result = await executeQuery<RaffleEntryRow>(query, params);

    const entriesData = result.rows.map(row => ({
      player: row.player,
      entranceFee: row.entrance_fee,
      txHash: row.tx_hash,
      blockNumber: row.block_number,
      network: row.network,
      txIndex: row.tx_index,
      logIndex: row.log_index,
    }));

    return createSuccessResponse(entriesData, result.rowCount || 0);

  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch raffle entries');
  }
}