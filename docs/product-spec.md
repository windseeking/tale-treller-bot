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

## UX Principles
- No noisy bot responses while draft is being collected.
- Task creation starts only on explicit user action.
- Selection buttons should disappear via message edits.
- If user is not connected to Trello, the reply keyboard shows only `Connect Trello`.
- If user is connected to Trello, the reply keyboard shows `Create task`, `Cancel`, `Disconnect Trello`.
- If Trello is missing/revoked/expired, flow stops safely and draft text is preserved.
- Error responses must include enough debug context.

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
