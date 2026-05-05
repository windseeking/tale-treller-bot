import { DbClient } from "./client.js";

const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS telegram_users (
    id BIGSERIAL PRIMARY KEY,
    telegram_user_id BIGINT NOT NULL UNIQUE,
    telegram_chat_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS trello_connections (
    id BIGSERIAL PRIMARY KEY,
    telegram_user_id BIGINT NOT NULL UNIQUE REFERENCES telegram_users(telegram_user_id),
    trello_member_id TEXT NOT NULL,
    trello_username TEXT NOT NULL,
    trello_api_key TEXT NOT NULL,
    trello_token TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS trello_auth_sessions (
    id UUID PRIMARY KEY,
    telegram_user_id BIGINT NOT NULL,
    telegram_chat_id BIGINT NOT NULL,
    session_secret_hash TEXT NOT NULL,
    request_token TEXT,
    request_token_secret TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'redirected', 'completed', 'failed', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_trello_auth_sessions_user_status
    ON trello_auth_sessions (telegram_user_id, status);

  CREATE INDEX IF NOT EXISTS idx_trello_auth_sessions_expires_at
    ON trello_auth_sessions (expires_at);

  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'user_settings' AND column_name = 'time_zone'
    ) AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'user_settings' AND column_name = 'setting_key'
    ) THEN
      ALTER TABLE user_settings RENAME TO user_settings_migration_time_zone;
    END IF;
  END $$;

  CREATE TABLE IF NOT EXISTS user_settings (
    id BIGSERIAL PRIMARY KEY,
    telegram_user_id BIGINT NOT NULL REFERENCES telegram_users(telegram_user_id),
    setting_key TEXT NOT NULL,
    setting_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (telegram_user_id, setting_key)
  );

  DO $$
  BEGIN
    IF to_regclass('user_settings_migration_time_zone') IS NOT NULL THEN
      INSERT INTO user_settings (telegram_user_id, setting_key, setting_value, created_at, updated_at)
      SELECT telegram_user_id, 'time_zone', time_zone, created_at, updated_at
      FROM user_settings_migration_time_zone
      WHERE time_zone IS NOT NULL
      ON CONFLICT (telegram_user_id, setting_key)
      DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = EXCLUDED.updated_at;

      DROP TABLE user_settings_migration_time_zone;
    END IF;

    IF to_regclass('user_settings_legacy_time_zone') IS NOT NULL THEN
      INSERT INTO user_settings (telegram_user_id, setting_key, setting_value, created_at, updated_at)
      SELECT telegram_user_id, 'time_zone', time_zone, created_at, updated_at
      FROM user_settings_legacy_time_zone
      WHERE time_zone IS NOT NULL
      ON CONFLICT (telegram_user_id, setting_key)
      DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = EXCLUDED.updated_at;

      DROP TABLE user_settings_legacy_time_zone;
    END IF;
  END $$;

  CREATE TABLE IF NOT EXISTS settings_update_sessions (
    id UUID PRIMARY KEY,
    telegram_user_id BIGINT NOT NULL,
    telegram_chat_id BIGINT NOT NULL,
    purpose TEXT NOT NULL,
    session_secret_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  DO $$
  DECLARE
    constraint_name TEXT;
  BEGIN
    FOR constraint_name IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'settings_update_sessions'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%time_zone%'
    LOOP
      EXECUTE 'ALTER TABLE settings_update_sessions DROP CONSTRAINT ' || quote_ident(constraint_name);
    END LOOP;
  END $$;

  UPDATE settings_update_sessions
  SET purpose = 'time_zone_auto', updated_at = NOW()
  WHERE purpose IN ('time_zone', 'time_zone_offset_auto');

  ALTER TABLE settings_update_sessions
    ADD CONSTRAINT settings_update_sessions_purpose_check
    CHECK (purpose IN ('time_zone_auto'));

  CREATE INDEX IF NOT EXISTS idx_settings_update_sessions_user_status
    ON settings_update_sessions (telegram_user_id, status);

  CREATE INDEX IF NOT EXISTS idx_settings_update_sessions_expires_at
    ON settings_update_sessions (expires_at);

  CREATE TABLE IF NOT EXISTS app_sessions (
    id UUID PRIMARY KEY,
    telegram_user_id BIGINT NOT NULL,
    telegram_chat_id BIGINT NOT NULL,
    session_secret_hash TEXT NOT NULL,
    api_token_hash TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_app_sessions_user_status
    ON app_sessions (telegram_user_id, status);

  CREATE INDEX IF NOT EXISTS idx_app_sessions_api_token_hash
    ON app_sessions (api_token_hash)
    WHERE api_token_hash IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_app_sessions_expires_at
    ON app_sessions (expires_at);
  `
];

export async function runMigrations(db: DbClient): Promise<void> {
  for (const sql of MIGRATIONS) {
    await db.query(sql);
  }
}
