import { DbClient } from "../client.js";
import type {
  SettingsUpdateSessionPurpose,
  SettingsUpdateSessionRecord,
  SettingsUpdateSessionStatus
} from "./types.js";

type SettingsUpdateSessionRow = {
  id: string;
  telegram_user_id: string;
  telegram_chat_id: string;
  purpose: SettingsUpdateSessionPurpose;
  session_secret_hash: string;
  status: SettingsUpdateSessionStatus;
  expires_at: Date;
};

export class SettingsUpdateSessionsRepository {
  public constructor(private readonly db: DbClient) {}

  public async create(params: {
    id: string;
    telegramUserId: number;
    telegramChatId: number;
    purpose: SettingsUpdateSessionPurpose;
    sessionSecretHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.db.query(
      `
      INSERT INTO settings_update_sessions (
        id,
        telegram_user_id,
        telegram_chat_id,
        purpose,
        session_secret_hash,
        status,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, 'pending', $6)
      `,
      [
        params.id,
        params.telegramUserId,
        params.telegramChatId,
        params.purpose,
        params.sessionSecretHash,
        params.expiresAt
      ]
    );
  }

  public async findById(id: string): Promise<SettingsUpdateSessionRecord | null> {
    const result = await this.db.query<SettingsUpdateSessionRow>(
      `
      SELECT
        id,
        telegram_user_id,
        telegram_chat_id,
        purpose,
        session_secret_hash,
        status,
        expires_at
      FROM settings_update_sessions
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
      purpose: row.purpose,
      sessionSecretHash: row.session_secret_hash,
      status: row.status,
      expiresAt: new Date(row.expires_at)
    };
  }

  public async updateStatus(id: string, status: SettingsUpdateSessionStatus): Promise<void> {
    await this.db.query(
      `
      UPDATE settings_update_sessions
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      `,
      [id, status]
    );
  }

  public async markExpired(): Promise<void> {
    await this.db.query(
      `
      UPDATE settings_update_sessions
      SET status = 'expired', updated_at = NOW()
      WHERE status = 'pending' AND expires_at < NOW()
      `
    );
  }
}
