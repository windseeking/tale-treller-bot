import { DbClient } from '../client.js'
import type {
  UserSetting,
  UserSettings,
  UserSettingsRepositoryPort
} from '../../../../interfaces/settings/user-settings-repository.js'

type UserSettingsRow = {
  telegram_user_id: string;
  setting_key: string;
  setting_value: string | null;
};

export class UserSettingsRepository implements UserSettingsRepositoryPort {
  public constructor(private readonly db: DbClient) {}

  public async findByTelegramUserId(telegramUserId: number): Promise<UserSettings | null> {
    const result = await this.db.query<UserSettingsRow>(
      `
      SELECT telegram_user_id, setting_key, setting_value
      FROM user_settings
      WHERE telegram_user_id = $1
      `,
      [telegramUserId]
    )

    if (result.rows.length === 0) {
      return null
    }

    return {
      telegramUserId,
      values: Object.fromEntries(result.rows.map((row) => [row.setting_key, row.setting_value]))
    }
  }

  public async findValue(telegramUserId: number, key: string): Promise<string | null> {
    const result = await this.db.query<UserSettingsRow>(
      `
      SELECT telegram_user_id, setting_key, setting_value
      FROM user_settings
      WHERE telegram_user_id = $1 AND setting_key = $2
      LIMIT 1
      `,
      [telegramUserId, key]
    )

    return result.rows[0]?.setting_value ?? null
  }

  public async upsertValue(params: UserSetting): Promise<void> {
    await this.db.query(
      `
      INSERT INTO user_settings (telegram_user_id, setting_key, setting_value)
      VALUES ($1, $2, $3)
      ON CONFLICT (telegram_user_id, setting_key)
      DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()
      `,
      [params.telegramUserId, params.key, params.value]
    )
  }

}
