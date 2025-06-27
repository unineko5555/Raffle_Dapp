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
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = `
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

    const queryParams: unknown[] = [];
    const conditions: string[] = [];

    if (network) {
      conditions.push(`network = $${queryParams.length + 1}`);
      queryParams.push(network);
    }

    if (userAddress) {
      conditions.push(`LOWER(player) = LOWER($${queryParams.length + 1})`);
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

    const entriesData = result.rows.map(row => ({
      player: row.player,
      entranceFee: row.entrance_fee,
      txHash: row.tx_hash,
      blockNumber: row.block_number,
      network: row.network,
      txIndex: row.tx_index,
      logIndex: row.log_index,
    }));

    return NextResponse.json({
      success: true,
      data: entriesData,
      total: result.rowCount,
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch raffle entries',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}