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

    const client = await pool.connect();

    // 基本統計情報
    const statsQuery = `
      SELECT 
        'entries' as type,
        COUNT(*) as count,
        network
      FROM raffle_indexer_raffle_implementation.raffle_enter
      ${network ? `WHERE network = $1` : ''}
      GROUP BY network
      UNION ALL
      SELECT 
        'exits' as type,
        COUNT(*) as count,
        network
      FROM raffle_indexer_raffle_implementation.raffle_exit
      ${network ? `WHERE network = $1` : ''}
      GROUP BY network
      UNION ALL
      SELECT 
        'winners' as type,
        COUNT(*) as count,
        network
      FROM raffle_indexer_raffle_implementation.winner_picked
      ${network ? `WHERE network = $1` : ''}
      GROUP BY network
    `;

    const statsParams = network ? [network] : [];
    const statsResult = await client.query(statsQuery, statsParams);

    // ユーザー固有の統計情報（指定されている場合）
    let userStats = null;
    if (userAddress) {
      const userStatsQuery = `
        SELECT 
          'user_entries' as type,
          COUNT(*) as count,
          network
        FROM raffle_indexer_raffle_implementation.raffle_enter
        WHERE LOWER(player) = LOWER($1) ${network ? `AND network = $2` : ''}
        GROUP BY network
        UNION ALL
        SELECT 
          'user_wins' as type,
          COUNT(*) as count,
          network
        FROM raffle_indexer_raffle_implementation.winner_picked
        WHERE LOWER(winner) = LOWER($1) ${network ? `AND network = $2` : ''}
        GROUP BY network
        UNION ALL
        SELECT 
          'user_jackpots' as type,
          COUNT(*) as count,
          network
        FROM raffle_indexer_raffle_implementation.winner_picked
        WHERE LOWER(winner) = LOWER($1) AND is_jackpot = true ${network ? `AND network = $2` : ''}
        GROUP BY network
      `;

      const userStatsParams = network ? [userAddress, network] : [userAddress];
      const userStatsResult = await client.query(userStatsQuery, userStatsParams);
      userStats = userStatsResult.rows;
    }

    // ネットワーク別の最新ブロック情報
    const latestBlocksQuery = `
      SELECT 
        network,
        MAX(block_number) as latest_block
      FROM (
        SELECT network, block_number FROM raffle_indexer_raffle_implementation.raffle_enter
        UNION ALL
        SELECT network, block_number FROM raffle_indexer_raffle_implementation.raffle_exit
        UNION ALL
        SELECT network, block_number FROM raffle_indexer_raffle_implementation.winner_picked
      ) combined
      ${network ? `WHERE network = $1` : ''}
      GROUP BY network
      ORDER BY network
    `;

    const latestBlocksParams = network ? [network] : [];
    const latestBlocksResult = await client.query(latestBlocksQuery, latestBlocksParams);

    client.release();

    // レスポンスデータの整形
    const networkStats: { [key: string]: { [key: string]: number } } = {};
    
    statsResult.rows.forEach((row: any) => {
      if (!networkStats[row.network]) {
        networkStats[row.network] = {};
      }
      networkStats[row.network][row.type] = parseInt(row.count);
    });

    latestBlocksResult.rows.forEach((row: any) => {
      if (!networkStats[row.network]) {
        networkStats[row.network] = {};
      }
      networkStats[row.network].latestBlock = parseInt(row.latest_block);
    });

    return NextResponse.json({
      success: true,
      data: {
        networkStats,
        userStats,
        summary: {
          totalNetworks: Object.keys(networkStats).length,
          totalEntries: Object.values(networkStats).reduce((sum: number, network: { [key: string]: number }) => sum + (network.entries || 0), 0),
          totalWinners: Object.values(networkStats).reduce((sum: number, network: { [key: string]: number }) => sum + (network.winners || 0), 0),
        }
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch raffle stats',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}