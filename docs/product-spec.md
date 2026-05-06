# Product Spec (Multi-User Trello Authorization)

## Product
Telegram bot that collects a user's text messages and creates Trello cards in that user's Trello account.

## Core Value
- Convert message batches into structured Trello tasks quickly.
- Keep every Telegram user isolated with their own Trello credentials.

## Current Scope
- Multi-user support.
- Text-only input.
- In-memory draft/session state for chat UX.
- Persistent PostgreSQL storage for Trello authorization state.
- Persistent PostgreSQL storage for user settings.

## Core Features
1. Draft accumulation from multiple messages.
2. Explicit task creation trigger via `Create task`.
3. Minimum text length validation (>= 15 chars).
4. Board/list selection via inline buttons.
5. Reuse of previous board/list selection.
6. LLM-based card payload generation.
7. Trello card creation with success link.
8. Trello OAuth connect/reconnect per Telegram user.
9. Trello disconnect control in reply keyboard and status check via command.
10. Telegram App settings surface with timezone setup and Trello status/actions.

## UX Principles
- No noisy bot responses while draft is being collected.
- Task creation starts only on explicit user action.
- Selection buttons should disappear via message edits.
- If user is not connected to Trello, the reply keyboard shows `Connect Trello`.
- If user is connected to Trello, the reply keyboard shows `Create task`, `Cancel`, and `Disconnect Trello`.
- If Trello is missing/revoked/expired, flow stops safely and draft text is preserved.
- If timezone is not configured, task creation continues with `APP_TIMEZONE`.
- Error responses must include enough debug context.

## User Settings Policy
- User settings are stored as per-user key/value records.
- Timezone is stored under `time_zone` as an internal IANA timezone ID.
- The bot does not expose timezone selection in Telegram chat; users configure settings in the Telegram App.
- The bot may prefill timezone from Trello prefs, browser detection, or manual selection.
- Manual timezone selection in the App uses a searchable list of IANA timezone names with current UTC offset labels and saves immediately on selection.
- LLM card generation receives the current date-time with the computed current UTC offset in the prompt.
- If no valid timezone is saved, `APP_TIMEZONE` is used as the safe default timezone.

## Telegram App Policy
- The settings App is served from `/app`.
- App API endpoints use `/api/app/*`.
- The App is opened from the standard Telegram Menu Button at the stable `/app` URL.
- App API endpoints validate Telegram Mini App `initData` from the `X-Telegram-Init-Data` request header.
- App launch does not use one-time `sid`/`secret` sessions.
- The App can show Trello connection status, create a Trello connect link, and disconnect Trello.

## Visual Design Palette
- `#1555BD` — Blue, primary.
- `#A78BFA` — Violet, accent.
- `#A9E546` — Lime, secondary accent.
- `#22D3EE` — Cyan, tertiary accent.
- `#0F172A` — Ink, main text.
- `#334155` — Slate, secondary text.
- `#E0F2FE` — Sky Mist, primary surfaces.
- `#F5F3FF` — Violet Mist, accent surfaces.
- `#F7FEE7` — Lime Mist, secondary surfaces.
- `#F8FAFC` — Base, background.
- `#22C55E` — Green, success.
- `#F43F5E` — Rose, cancel/error.

## Trello Auth Policy
- OAuth-based connect flow via web callback endpoint.
- App-enforced Trello auth TTL: 30 days (configurable).
- User can reconnect at any time; latest successful connection is active.
- User can disconnect from bot UI; Trello actions become unavailable until reconnect.

## Required Trello Card Fields
- `name`
- `desc`
- `pos = top`
- `idList`

## Optional Trello Card Fields
- `due`
- `urlSource`

## Card Description Signature
Always append this line to the end of `desc`:

`Task created with [@taletrellerbot](https://t.me/taletrellerbot).`

There must be one blank line between main description text and this signature.
