import { DbClient } from '../client.js'
import type {
  TelegramUser,
  TelegramUsersRepositoryPort
} from '../../../../interfaces/telegram-user/telegram-users-repository.js'

type TelegramUserRow = {
  telegram_user_id: string;
  telegram_chat_id: string;
};

export class TelegramUsersRepository implements TelegramUsersRepositoryPort {
  public constructor(private readonly db: DbClient) {}

  public async upsert(params: TelegramUser): Promise<void> {
    await this.db.query(
      `
      INSERT INTO telegram_users (telegram_user_id, telegram_chat_id)
      VALUES ($1, $2)
      ON CONFLICT (telegram_user_id)
      DO UPDATE SET telegram_chat_id = EXCLUDED.telegram_chat_id, updated_at = NOW()
      `,
      [params.telegramUserId, params.telegramChatId]
    )
  }

  public async findByTelegramUserId(telegramUserId: number): Promise<TelegramUser | null> {
    const result = await this.db.query<TelegramUserRow>(
      `
      SELECT telegram_user_id, telegram_chat_id
      FROM telegram_users
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
      telegramChatId: Number(row.telegram_chat_id)
    }
  }
}
