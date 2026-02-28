import { DbClient } from "../client.js";
import type { TrelloAuthSessionRecord, TrelloAuthSessionStatus } from "./types.js";

type TrelloAuthSessionRow = {
  id: string;
  telegram_user_id: string;
  telegram_chat_id: string;
  session_secret_hash: string;
  request_token: string | null;
  request_token_secret: string | null;
  status: TrelloAuthSessionStatus;
  expires_at: Date;
};

export class TrelloAuthSessionsRepository {
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
      INSERT INTO trello_auth_sessions (
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

  public async findById(id: string): Promise<TrelloAuthSessionRecord | null> {
    const result = await this.db.query<TrelloAuthSessionRow>(
      `
      SELECT
        id,
        telegram_user_id,
        telegram_chat_id,
        session_secret_hash,
        request_token,
        request_token_secret,
        status,
        expires_at
      FROM trello_auth_sessions
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      telegramUserId: Number(row.telegram_user_id),
      telegramChatId: Number(row.telegram_chat_id),
      sessionSecretHash: row.session_secret_hash,
      requestTokenEncrypted: row.request_token,
      requestTokenSecretEncrypted: row.request_token_secret,
      status: row.status,
      expiresAt: new Date(row.expires_at)
    };
  }

  public async updateRedirected(params: {
    id: string;
    requestTokenEncrypted: string;
    requestTokenSecretEncrypted: string;
  }): Promise<void> {
    await this.db.query(
      `
      UPDATE trello_auth_sessions
      SET
        request_token = $2,
        request_token_secret = $3,
        status = 'redirected',
        updated_at = NOW()
      WHERE id = $1
      `,
      [params.id, params.requestTokenEncrypted, params.requestTokenSecretEncrypted]
    );
  }

  public async updateStatus(id: string, status: TrelloAuthSessionStatus): Promise<void> {
    await this.db.query(
      `
      UPDATE trello_auth_sessions
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      `,
      [id, status]
    );
  }

  public async markExpired(): Promise<void> {
    await this.db.query(
      `
      UPDATE trello_auth_sessions
      SET status = 'expired', updated_at = NOW()
      WHERE status IN ('pending', 'redirected') AND expires_at < NOW()
      `
    );
  }

  public async failPendingByTelegramUser(telegramUserId: number): Promise<void> {
    await this.db.query(
      `
      UPDATE trello_auth_sessions
      SET status = 'failed', updated_at = NOW()
      WHERE telegram_user_id = $1 AND status IN ('pending', 'redirected')
      `,
      [telegramUserId]
    );
  }
}
