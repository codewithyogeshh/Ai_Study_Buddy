/**
 * The small database surface the API was written against (Cloudflare D1's
 * prepared statements). Cloudflare supplies a real D1 database; the Vercel
 * deployment supplies the Postgres implementation in `pg.ts`.
 */
export type DbRow = Record<string, unknown>

export type DbResult<T = DbRow> = {
  results: T[]
  success: true
  meta: { changes: number }
}

export type PreparedStatement = {
  readonly sql: string
  readonly params: readonly unknown[]
  bind(...values: unknown[]): PreparedStatement
  first<T = DbRow>(colName?: string): Promise<T | null>
  all<T = DbRow>(): Promise<DbResult<T>>
  run<T = DbRow>(): Promise<DbResult<T>>
}

export type Db = {
  prepare(sql: string): PreparedStatement
  batch<T = DbRow>(statements: PreparedStatement[]): Promise<Array<DbResult<T>>>
}
