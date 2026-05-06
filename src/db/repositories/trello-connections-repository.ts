import { DbClient } from '../client.js'
import type { TrelloConnectionRecord } from './types.js'

type TrelloConnectionRow = {
  telegram_user_id: string;
  trello_member_id: string;
  trello_username: string;
  trello_api_key: string;
  trello_token: string;
  token_expires_at: Date;
  status: 'active' | 'revoked';
  revoked_at: Date | null;
};

export class TrelloConnectionsRepository {
  public constructor(private readonly db: DbClient) {}

  public async upsertActive(params: {
    telegramUserId: number;
    trelloMemberId: string;
    trelloUsername: string;
    trelloApiKeyEncrypted: string;
    trelloTokenEncrypted: string;
    tokenExpiresAt: Date;
  }): Promise<void> {
    await this.db.query(
      `
      INSERT INTO trello_connections (
        telegram_user_id,
        trello_member_id,
        trello_username,
        trello_api_key,
        trello_token,
        token_expires_at,
        status,
        revoked_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'active', NULL)
      ON CONFLICT (telegram_user_id)
      DO UPDATE SET
        trello_member_id = EXCLUDED.trello_member_id,
        trello_username = EXCLUDED.trello_username,
        trello_api_key = EXCLUDED.trello_api_key,
        trello_token = EXCLUDED.trello_token,
        token_expires_at = EXCLUDED.token_expires_at,
        status = 'active',
        revoked_at = NULL,
        updated_at = NOW()
      `,
      [
        params.telegramUserId,
        params.trelloMemberId,
        params.trelloUsername,
        params.trelloApiKeyEncrypted,
        params.trelloTokenEncrypted,
        params.tokenExpiresAt
      ]
    )
  }

  public async findByTelegramUserId(telegramUserId: number): Promise<TrelloConnectionRecord | null> {
    const result = await this.db.query<TrelloConnectionRow>(
      `
      SELECT
        telegram_user_id,
        trello_member_id,
        trello_username,
        trello_api_key,
        trello_token,
        token_expires_at,
        status,
        revoked_at
      FROM trello_connections
      WHERE telegram_user_id = $1
      LIMIT 1
      `,
      [telegramUserId]
    )

    const row = result.rows[0]
    if (!row) {
      return null
    }

    return {
      telegramUserId: Number(row.telegram_user_id),
      trelloMemberId: row.trello_member_id,
      trelloUsername: row.trello_username,
      trelloApiKeyEncrypted: row.trello_api_key,
      trelloTokenEncrypted: row.trello_token,
      tokenExpiresAt: new Date(row.token_expires_at),
      status: row.status,
      revokedAt: row.revoked_at ? new Date(row.revoked_at) : null
    }
  }

  public async revoke(telegramUserId: number): Promise<void> {
    await this.db.query(
      `
      UPDATE trello_connections
      SET status = 'revoked', revoked_at = NOW(), updated_at = NOW()
      WHERE telegram_user_id = $1 AND status = 'active'
      `,
      [telegramUserId]
    )
  }
}
