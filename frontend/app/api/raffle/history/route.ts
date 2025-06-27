import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5440,
  user: 'postgres',
  password: 'rindexer',
  database: 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const network = searchParams.get('network');
    const userAddress = searchParams.get('userAddress');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = `
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

    const queryParams: unknown[] = [];
    const conditions: string[] = [];

    if (network) {
      conditions.push(`network = $${queryParams.length + 1}`);
      queryParams.push(network);
    }

    if (userAddress) {
      conditions.push(`LOWER(winner) = LOWER($${queryParams.length + 1})`);
      queryParams.push(userAddress);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY block_number DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const client = await pool.connect();
    const result = await client.query(query, queryParams);
    client.release();

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

    return NextResponse.json({
      success: true,
      data: historyData,
      total: result.rowCount,
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch raffle history',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}