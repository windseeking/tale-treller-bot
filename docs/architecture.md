# Architecture

## Stack
- Node.js + TypeScript
- Telegraf (Telegram Bot API)
- Trello REST API
- LLM API (OpenAI-compatible endpoint)
- Zod (validation)
- Pino (logging)

## Module Layout

### `src/index.ts`
- app bootstrap;
- client initialization;
- bot startup;
- process-level shutdown/error handling.

### `src/bot/telegram-bot.ts`
- main state machine;
- text/callback update handling;
- UX orchestration for messages/keyboards;
- `LLM -> Trello` orchestration.

### `src/bot/session-store.ts`
- in-memory sessions by `chatId`;
- current stage + task data;
- last board/list selection.

### `src/bot/keyboards.ts`
- inline keyboards (boards, lists, actions);
- reply keyboard for draft mode.

### `src/llm/llm-client.ts`
- LLM API calls;
- system/user prompt construction;
- JSON extraction and validation;
- `due` normalization and parse diagnostics.

### `src/trello/trello-client.ts`
- boards and lists retrieval;
- card creation;
- HTTP error handling with request debug details.

## Bot Stages
- `collecting`
- `confirming_last_selection`
- `selecting_board`
- `selecting_list`

## Configuration Source
Environment variables validated in `src/config/env.ts`:

- `NODE_ENV`
- `LOG_LEVEL`
- `APP_TIMEZONE`
- `TELEGRAM_BOT_TOKEN`
- `TRELLO_API_KEY`
- `TRELLO_TOKEN`
- `TRELLO_MEMBER_ID`
- `LLM_API_KEY`
- `LLM_MODEL`
- `LLM_BASE_URL` (optional)

## Implementation Notes
- Trello card creation uses `POST` body to avoid `414 URI Too Long`.
- LLM/Trello errors are enriched with diagnostics.
- User-facing bot messages use Markdown formatting.
