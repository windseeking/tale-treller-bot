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
  `
];

export async function runMigrations(db: DbClient): Promise<void> {
  for (const sql of MIGRATIONS) {
    await db.query(sql);
  }
}
