/**
 * Postgres implementation of the app's database surface, used by the Vercel
 * function in `api/index.ts`. The queries are written for SQLite (`?`
 * placeholders), so they are rewritten to Postgres `$1..$n` here.
 *
 * This module is only imported by the Vercel entry point, never by the
 * Cloudflare Worker, so `pg` stays out of the Workers bundle.
 */
import pg from 'pg'

import type { Db, DbResult, DbRow, PreparedStatement } from './sql'

/* Postgres returns int8/numeric as strings; the app expects numbers. */
pg.types.setTypeParser(20, (value: string) => Number(value))
pg.types.setTypeParser(1700, (value: string) => Number(value))

let pool: pg.Pool | null = null
let poolKey = ''

function connectionString(): string {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING
  if (!url) {
    throw new Error(
      'No database configured. Set DATABASE_URL to a Postgres connection string in the Vercel project settings.',
    )
  }
  return url
}

/** Hosted Postgres requires TLS; a local development database does not. */
function needsTls(url: string): boolean {
  return !/localhost|127\.0\.0\.1|\[::1\]/.test(url)
}

function getPool(): pg.Pool {
  const url = connectionString()
  if (!pool || poolKey !== url) {
    pool = new pg.Pool({
      connectionString: url,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 15_000,
      ssl: needsTls(url) ? { rejectUnauthorized: false } : undefined,
    })
    poolKey = url
  }
  return pool
}

/**
 * SQLite-style `?` placeholders become Postgres `$1..$n`, skipping anything
 * that sits inside quoted SQL text.
 */
export function toPgPlaceholders(sql: string): string {
  let out = ''
  let index = 0
  let quote: string | null = null
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]
    if (quote) {
      out += ch
      if (ch === quote) {
        if (sql[i + 1] === quote) {
          out += sql[i + 1]
          i++
          continue
        }
        quote = null
      }
      continue
    }
    if (ch === "'" || ch === '"') {
      quote = ch
      out += ch
      continue
    }
    if (ch === '?') {
      index++
      out += `$${index}`
      continue
    }
    out += ch
  }
  return out
}

function statement(sql: string, params: readonly unknown[] = []): PreparedStatement {
  return {
    sql,
    params,
    bind(...values: unknown[]) {
      return statement(sql, values)
    },
    async first<T = DbRow>(colName?: string): Promise<T | null> {
      const result = await getPool().query(toPgPlaceholders(sql), params as unknown[])
      const row = result.rows[0] as DbRow | undefined
      if (!row) return null
      return (colName === undefined ? row : row[colName]) as T
    },
    async all<T = DbRow>(): Promise<DbResult<T>> {
      const result = await getPool().query(toPgPlaceholders(sql), params as unknown[])
      return { results: result.rows as T[], success: true, meta: { changes: result.rowCount ?? result.rows.length } }
    },
    async run<T = DbRow>(): Promise<DbResult<T>> {
      const result = await getPool().query(toPgPlaceholders(sql), params as unknown[])
      return { results: result.rows as T[], success: true, meta: { changes: result.rowCount ?? result.rows.length } }
    },
  }
}

async function runBatch<T = DbRow>(statements: PreparedStatement[]): Promise<Array<DbResult<T>>> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const results: Array<DbResult<T>> = []
    for (const item of statements) {
      const result = await client.query(toPgPlaceholders(item.sql), item.params as unknown[])
      results.push({
        results: result.rows as T[],
        success: true,
        meta: { changes: result.rowCount ?? result.rows.length },
      })
    }
    await client.query('COMMIT')
    return results
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

export function createDb(): Db {
  return {
    prepare: (sql: string) => statement(sql),
    batch: <T = DbRow>(statements: PreparedStatement[]) => runBatch<T>(statements),
  }
}
