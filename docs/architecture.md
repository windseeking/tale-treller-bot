# Architecture

## Stack
- Node.js + TypeScript
- Telegraf (Telegram Bot API)
- Trello REST API + Trello OAuth 1.0a
- PostgreSQL (`pg`)
- Express (HTTP auth endpoints)
- Vue 3 + Vite + PrimeVue 4 + Tailwind CSS (Telegram App)
- Zod (validation)
- Pino (logging)

## Runtime Topology
Single Node.js process runs:
1. Telegram polling bot
2. HTTP server for Trello OAuth (`/auth/trello/*`), Telegram App (`/app`), and App API (`/api/app/*`)
3. PostgreSQL access layer

In `NODE_ENV=development`, the HTTP server serves the Telegram App through Vite middleware at the same `/app` path, so Telegram can open `APP_BASE_URL/app` with hot frontend updates. In non-development modes, `/app` serves the built static files from `dist/public/app`.

## Module Layout

### `src/index.ts`
- bootstrap DB + migrations;
- initialize concrete infrastructure adapters and application services;
- start HTTP server and Telegram bot;
- graceful shutdown for DB/HTTP/bot.

### `src/config/bot-services.ts`
- composition module for Telegram bot application services, similar to the services config pattern in `docs/clean-architecture-article.md`;
- creates concrete Trello/OpenAI infrastructure adapters;
- wires destination registry, destination handlers, concrete use cases, and bot controllers;
- keeps `src/infrastructure/bot/telegram-bot.ts` free from platform clients.

### Clean Architecture layout

The server is being organized around Clean Architecture layers:

- `src/entities/*`: domain objects and pure domain helpers.
- `src/interfaces/*`: server-side ports/contracts grouped by domain.
- `src/use-cases/*`: application scenarios that coordinate ports.
- `src/application/*`: application-level services/providers that compose use cases or support cross-use-case behavior, but are not product use cases themselves.
- `src/controllers/*`: thin input/output coordinators for delivery adapters.
- `src/infrastructure/*`: concrete runtime adapters for Telegram, HTTP, Postgres, Trello, LLM, security, settings, and logging.
- `src/infrastructure/validation/*`: concrete validation adapters and schemas.
- `src/config/*`: environment/configuration parsing.

Type-only DTO contracts shared by the server and Vue App live inside `src/interfaces/*` with the rest of the application ports and contracts.

The migration does not keep legacy re-export shims for old technical folders. Server code should import concrete implementations from `src/infrastructure/*` and core contracts from `src/interfaces/*`.

### `src/infrastructure/http/express-server.ts`
- `GET /auth/trello/start`;
- `GET /auth/trello/callback`;
- `GET /auth/trello/result`.
- `GET /app`;
- `GET /api/app/time-zones`;
- `GET /api/app/me`;
- `PATCH /api/app/settings`;
- `GET /api/app/trello/status`;
- `POST /api/app/trello/connect-link`;
- `POST /api/app/trello/disconnect`.

### `src/controllers/*`
- App API settings and Trello controllers build response payloads and call use cases/services.
- Trello auth controller adapts OAuth start/callback results to HTTP redirects.
- Controllers should remain delivery-oriented and avoid direct SDK/database details.

### `src/presenters/*`
- Translate domain result codes and data into delivery-layer representations: human-readable messages, HTTP status codes, redirect URLs, Telegram keyboard structures.
- Presenters are output adapters — they complement controllers (input adapters) within the Interface Adapters layer.
- `src/presenters/trello/trello-auth-result-presenter.ts`: maps Trello auth result codes to Russian user-facing messages; maps OAuth start failure codes to HTTP status codes; builds `/auth/trello/result` redirect URLs.
- `src/presenters/bot/bot-messages.ts`: Russian user-facing message catalogue for the Telegram bot delivery layer.
- `src/presenters/bot/bot-keyboards.ts`: builds Telegram inline and reply keyboard structures from domain data (boards, lists, card URLs).

### `src/use-cases/*`
- task draft validation and concrete platform task creation use cases;
- settings payload lookup, timezone saving, and timezone listing;
- Trello board/list lookup use cases.

Use cases should depend on `src/interfaces/*` ports and DTO types, not infrastructure implementations.

`CreateTrelloTask` is the Trello-specific task creation use case. It validates Trello task input, resolves Trello auth context, resolves a task content generator, maps generated content to a Trello card payload, and creates the card through the Trello card gateway. Future destinations should get concrete use cases such as `CreateLinearTask` instead of sharing a premature generic task-creation pipeline.

### `src/interfaces/*`
- `task/*`: card generation and Trello card creation ports.
- `bot.ts`: normalized bot request/session contracts, `BotMessenger`, and task destination registry/handler ports.
- `settings/*`: settings repository and timezone provider ports.
- `trello/*`: board/list/card gateways.
- `trello/auth/*`: auth context, OAuth, connection, and auth-session ports.
- `telegram-user/*`: Telegram user persistence port.
- `notification/*`: outbound Telegram notification port.
- `app/*`, `errors/*`, and `telegram/*`: type-only API and delivery contracts shared by server code and the Vue App.
- `validator.ts`: generic validation port used by concrete validation adapters.

### `src/use-cases/trello/auth/*`
- product-level Trello account scenarios only:
  - `InitiateTrelloConnection`;
  - `ConnectTrelloAccount`;
  - `DisconnectTrelloAccount`;
  - `GetTrelloConnectionStatus`.
- returns typed result codes from `src/interfaces/trello/auth/trello-auth-results.ts` instead of user-facing Russian messages.
- depends on repository/gateway/clock/secret/timezone/notifier ports, with concrete adapters wired in `src/config/trello-auth-services.ts`.
- sends auth-completion notifications through the `TelegramNotifier` port instead of importing bot keyboards/messages directly.

### `src/application/trello/auth/*`
- application-level Trello auth support that is not modeled as business use cases:
  - `TrelloAccountConnectionService` facade implementing `TrelloAccountConnectionServicePort`;
  - `TrelloOAuthRedirectService` for `/auth/trello/start` request-token redirect mechanics;
  - `RepositoryTrelloAuthContextProvider` for Trello API credential lookup.
- keeps technical OAuth/session and credential-provider behavior outside the product use-case folder.

### `src/config/trello-auth-services.ts`
- Trello auth composition module, following the services config pattern in `docs/clean-architecture-article.md`;
- wires product-named Trello auth use cases and application-level Trello auth services to concrete Postgres repositories, Trello OAuth/member HTTP gateways, crypto secrets, system clock, env-derived config, timezone validator, and Telegram notifier.
- keeps Trello OAuth HTTP calls, token encryption, current time, and timezone validation outside the use-case layer.

### `src/infrastructure/settings/*`
- timezone validation and current-offset date-time helpers;
- static App timezone names constants;

### `app/*`
- Vue 3 + Vite Telegram App frontend;
- composable API layer under `app/src/composables/api`;
- infrastructure composables for Telegram initialization and bootstrap loading;
- stateful settings section components for independently growing settings UI;
- PrimeVue 4 components and Aura-based custom theme;
- Tailwind CSS utility classes for App layout and custom surface styling;
- timezone selector, browser timezone detection, Trello status/actions.

### `src/infrastructure/security/crypto.ts`
- AES-256-GCM encrypt/decrypt helpers;
- one-time secret generation;
- secret hash/constant-time validation.

### `src/infrastructure/security/telegram-init-data.ts`
- Telegram Mini App `initData` HMAC validation;
- `auth_date` freshness validation for App API calls;
- verified Telegram user extraction.

### `src/infrastructure/data-access/postgres/*`
- DB client;
- migration runner;
- repositories:
  - `telegram_users`
  - `user_settings`
  - `trello_connections`
  - `trello_auth_sessions`

Postgres repositories implement domain ports from `src/interfaces/*`. Shared repository contract types live with those ports; database row mapping stays inside the concrete Postgres adapter.

### Telegram bot delivery
- `src/infrastructure/bot/telegram-bot.ts` is the thin Telegraf composition adapter: it creates the bot, normalizes Telegraf context into Telegram identity/text/callback data, registers handlers, and applies common error logging/replies.
- `src/infrastructure/bot/telegram-messenger.ts` implements the `BotMessenger` port for safe Telegram delivery operations: Markdown replies, callback answers, message edits, reply keyboard removal, incoming-message deletion, and formatting helpers.
- `src/controllers/bot/*` owns generic Telegram-facing orchestration for `/start`, text actions, inline callbacks, draft/session transitions, cancellation, validation entry, and destination routing.
- `src/controllers/bot/destinations/trello-destination-handler.ts` owns Trello chat UX: connect/status/disconnect, board/list selection, Trello callback routing, auth guardrails, and task creation progress/result messages.
- Generic bot controllers depend on the destination registry and `BotMessenger` port, not on Telegraf, Trello clients, or LLM clients.
- Trello-specific callbacks use the `trello:` namespace. Generic task callbacks use the `task:` namespace.

### `src/infrastructure/trello/trello-client.ts`
- per-user boards/lists/card calls using `TrelloAuthContext`.

### `src/infrastructure/llm/llm-card-generator.ts`
- turns draft text into a Trello card input contract;
- implements the task card-generator port.

### `src/infrastructure/validation/zod/*`
- Zod-based implementation of the generic validation port;
- environment variable validation schema;
- Trello API response validation schemas;
- LLM API/output validation schemas.
- imported through the `#validators/*` alias, which maps to `src/infrastructure/validation/zod/*` in TypeScript and to `dist/infrastructure/validation/zod/*` at runtime.

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

### `user_settings`
- `id` BIGSERIAL PK
- `telegram_user_id` BIGINT FK -> `telegram_users.telegram_user_id`
- `setting_key` TEXT
- `setting_value` TEXT nullable
- `created_at`, `updated_at`
- unique: `(telegram_user_id, setting_key)`

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

Known `user_settings.setting_key` values:
- `time_zone`: IANA timezone ID.

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

`APP_TIMEZONE` is the safe fallback IANA timezone, e.g. `Europe/Lisbon`.

## Build
- Server build: `npm run build:server`
- Telegram App build: `npm run build:app`
- Full build: `npm run build`
- App build output: `dist/public/app`
- Development App serving: `npm run dev` serves `/app` through Vite middleware; no App rebuild is required for frontend-only changes.
- Shared App/API contracts live under `src/interfaces/*`; the Telegram App type-check includes those files and imports them through `#interfaces/*`.

## Security Notes
- Token/key materials are encrypted at rest using AES-256-GCM.
- No plaintext Trello tokens are logged.
- Auth links are one-time and TTL-bound.
- App API calls are authenticated with Telegram Mini App `initData` from `X-Telegram-Init-Data`.
- Session integrity uses secret hash verification and status transitions.
