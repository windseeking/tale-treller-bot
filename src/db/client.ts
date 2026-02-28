import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

import { env } from "../config/env.js";

export class DbClient {
  private readonly pool: Pool;

  public constructor() {
    this.pool = new Pool({
      connectionString: env.DATABASE_URL
    });
  }

  public query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }

  public async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
