import { Pool, type QueryResult, type QueryResultRow } from 'pg'

import { env } from '../config/env.js'

export class DbClient {
  private readonly pool: Pool

  public constructor() {
    this.pool = new Pool({
      connectionString: env.DATABASE_URL
    })
  }

  public query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values)
  }

  public async close(): Promise<void> {
    await this.pool.end()
  }
}
