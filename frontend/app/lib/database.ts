import { Pool } from 'pg';

// 共通データベース設定
// 全APIルートで重複していた設定を統一
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

/**
 * データベース接続プールを取得
 */
export function getDbPool() {
  return pool;
}

/**
 * データベースクエリの共通実行ヘルパー
 */
export async function executeQuery<T = unknown>(
  query: string, 
  params: unknown[] = []
): Promise<{ rows: T[]; rowCount: number | null }> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(query, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount,
    };
  } finally {
    client.release();
  }
}

/**
 * 条件付きクエリビルダー
 * API routesで重複していたWHERE句構築ロジックを統一
 */
export function buildConditionalQuery(
  baseQuery: string,
  conditions: { field: string; value: unknown; operator?: string }[],
  orderBy?: string,
  limit?: number,
  offset?: number
): { query: string; params: unknown[] } {
  let query = baseQuery;
  const params: unknown[] = [];
  const whereClauses: string[] = [];

  // WHERE条件を構築
  conditions.forEach(({ field, value, operator = '=' }) => {
    if (value !== null && value !== undefined) {
      if (operator === 'ILIKE' || operator === 'LOWER') {
        whereClauses.push(`LOWER(${field}) = LOWER($${params.length + 1})`);
      } else {
        whereClauses.push(`${field} ${operator} $${params.length + 1}`);
      }
      params.push(value);
    }
  });

  // WHERE句を追加
  if (whereClauses.length > 0) {
    query += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  // ORDER BY句を追加
  if (orderBy) {
    query += ` ORDER BY ${orderBy}`;
  }

  // LIMIT/OFFSET句を追加
  if (limit !== undefined) {
    query += ` LIMIT $${params.length + 1}`;
    params.push(limit);
  }

  if (offset !== undefined) {
    query += ` OFFSET $${params.length + 1}`;
    params.push(offset);
  }

  return { query, params };
}

/**
 * 共通エラーレスポンス作成
 */
export function createErrorResponse(
  error: unknown,
  message: string,
  status: number = 500
) {
  console.error(`API Error: ${message}`, error);
  
  return Response.json(
    {
      success: false,
      error: message,
      details: error instanceof Error ? error.message : String(error)
    },
    { status }
  );
}

/**
 * 共通成功レスポンス作成
 */
export function createSuccessResponse<T>(
  data: T,
  total?: number
) {
  return Response.json({
    success: true,
    data,
    ...(total !== undefined && { total }),
  });
}