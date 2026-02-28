# Architecture

## Stack
- Node.js + TypeScript
- Telegraf (Telegram Bot API)
- Trello REST API + Trello OAuth 1.0a
- PostgreSQL (`pg`)
- Express (HTTP auth endpoints)
- Zod (validation)
- Pino (logging)

## Runtime Topology
Single Node.js process runs:
1. Telegram polling bot
2. HTTP server for Trello OAuth (`/auth/trello/*`)
3. PostgreSQL access layer

## Module Layout

### `src/index.ts`
- bootstrap DB + migrations;
- initialize Trello auth service;
- start HTTP server and Telegram bot;
- graceful shutdown for DB/HTTP/bot.

### `src/http/server.ts`
- `GET /auth/trello/start`;
- `GET /auth/trello/callback`;
- `GET /auth/trello/result`.

### `src/auth/trello-auth-service.ts`
- create one-time auth sessions;
- request/access token OAuth exchange;
- Trello `members/me` identity fetch;
- upsert/revoke/status of user connections;
- auth guard context for Trello API calls.

### `src/security/crypto.ts`
- AES-256-GCM encrypt/decrypt helpers;
- one-time secret generation;
- secret hash/constant-time validation.

### `src/db/*`
- DB client;
- migration runner;
- repositories:
  - `telegram_users`
  - `trello_connections`
  - `trello_auth_sessions`

### `src/bot/telegram-bot.ts`
- draft/session UX state machine;
- connect/status/disconnect UX;
- guardrails before Trello-dependent actions;
- orchestration `LLM -> Trello`.

### `src/trello/trello-client.ts`
- per-user boards/lists/card calls using `TrelloAuthContext`.

## Bot Stages
- `collecting`
- `confirming_last_selection`
- `selecting_board`
- `selecting_list`

## Data Model (PostgreSQL)

### `telegram_users`
- `id` BIGSERIAL PK
- `telegram_user_id` BIGINT UNIQUE
- `telegram_chat_id` BIGINT
- `created_at`, `updated_at`

### `trello_connections`
- `id` BIGSERIAL PK
- `telegram_user_id` BIGINT UNIQUE FK -> `telegram_users.telegram_user_id`
- `trello_member_id`
- `trello_username`
- `trello_api_key` (encrypted)
- `trello_token` (encrypted)
- `token_expires_at`
- `status` (`active` / `revoked`)
- `created_at`, `updated_at`, `revoked_at`

### `trello_auth_sessions`
- `id` UUID PK
- `telegram_user_id` BIGINT
- `telegram_chat_id` BIGINT
- `session_secret_hash`
- `request_token` (encrypted, nullable)
- `request_token_secret` (encrypted, nullable)
- `status` (`pending` / `redirected` / `completed` / `failed` / `expired`)
- `expires_at`
- `created_at`, `updated_at`
- indexes: `(telegram_user_id, status)`, `expires_at`

## Configuration Source
Environment variables validated in `src/config/env.ts`:

- `NODE_ENV`
- `LOG_LEVEL`
- `APP_TIMEZONE`
- `APP_BASE_URL`
- `APP_PORT`
- `TELEGRAM_BOT_TOKEN`
- `TRELLO_API_KEY`
- `TRELLO_API_SECRET`
- `AUTH_ENCRYPTION_KEY`
- `AUTH_SESSION_TTL_MINUTES`
- `TRELLO_AUTH_TTL_DAYS`
- `DATABASE_URL`
- `LLM_API_KEY`
- `LLM_MODEL`
- `LLM_BASE_URL` (optional)

## Security Notes
- Token/key materials are encrypted at rest using AES-256-GCM.
- No plaintext Trello tokens are logged.
- Auth links are one-time and TTL-bound.
- Session integrity uses secret hash verification and status transitions.
