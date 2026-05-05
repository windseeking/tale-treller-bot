import { DbClient } from "../client.js";
import type { AppSessionRecord, AppSessionStatus } from "./types.js";

type AppSessionRow = {
  id: string;
  telegram_user_id: string;
  telegram_chat_id: string;
  session_secret_hash: string;
  api_token_hash: string | null;
  status: AppSessionStatus;
  expires_at: Date;
};

export class AppSessionsRepository {
  public constructor(private readonly db: DbClient) {}

  public async create(params: {
    id: string;
    telegramUserId: number;
    telegramChatId: number;
    sessionSecretHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.db.query(
      `
      INSERT INTO app_sessions (
        id,
        telegram_user_id,
        telegram_chat_id,
        session_secret_hash,
        status,
        expires_at
      )
      VALUES ($1, $2, $3, $4, 'pending', $5)
      `,
      [
        params.id,
        params.telegramUserId,
        params.telegramChatId,
        params.sessionSecretHash,
        params.expiresAt
      ]
    );
  }

  public async findById(id: string): Promise<AppSessionRecord | null> {
    const result = await this.db.query<AppSessionRow>(
      `
      SELECT
        id,
        telegram_user_id,
        telegram_chat_id,
        session_secret_hash,
        api_token_hash,
        status,
        expires_at
      FROM app_sessions
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    return result.rows[0] ? mapAppSession(result.rows[0]) : null;
  }

  public async findActiveByTokenHash(apiTokenHash: string): Promise<AppSessionRecord | null> {
    const result = await this.db.query<AppSessionRow>(
      `
      SELECT
        id,
        telegram_user_id,
        telegram_chat_id,
        session_secret_hash,
        api_token_hash,
        status,
        expires_at
      FROM app_sessions
      WHERE api_token_hash = $1 AND status = 'active'
      LIMIT 1
      `,
      [apiTokenHash]
    );

    return result.rows[0] ? mapAppSession(result.rows[0]) : null;
  }

  public async activate(params: { id: string; apiTokenHash: string }): Promise<void> {
    await this.db.query(
      `
      UPDATE app_sessions
      SET status = 'active', api_token_hash = $2, updated_at = NOW()
      WHERE id = $1
      `,
      [params.id, params.apiTokenHash]
    );
  }

  public async updateStatus(id: string, status: AppSessionStatus): Promise<void> {
    await this.db.query(
      `
      UPDATE app_sessions
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      `,
      [id, status]
    );
  }

  public async markExpired(): Promise<void> {
    await this.db.query(
      `
      UPDATE app_sessions
      SET status = 'expired', updated_at = NOW()
      WHERE status IN ('pending', 'active') AND expires_at < NOW()
      `
    );
  }
}

function mapAppSession(row: AppSessionRow): AppSessionRecord {
  return {
    id: row.id,
    telegramUserId: Number(row.telegram_user_id),
    telegramChatId: Number(row.telegram_chat_id),
    sessionSecretHash: row.session_secret_hash,
    apiTokenHash: row.api_token_hash,
    status: row.status,
    expiresAt: new Date(row.expires_at)
  };
}
