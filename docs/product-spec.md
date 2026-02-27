# Product Spec (MVP + Implemented Enhancements)

## Product
A Telegram bot that collects a user's text messages and creates Trello cards.

## Core Value
- Convert raw message batches into structured Trello tasks quickly.
- Reduce manual effort for task title/description drafting and list selection.

## Current Scope Limits
- Single user.
- Text-only input.
- In-memory state (no database).

## Core Features
1. Draft accumulation from multiple messages.
2. Explicit task creation trigger via reply button `Create task`.
3. Minimum text length validation (>= 15 characters).
4. Board and list selection via inline buttons.
5. Reuse of previous board/list selection.
6. LLM-based card payload generation.
7. Trello card creation with success link returned to the user.

## UX Principles
- No noisy bot responses while draft is being collected.
- Task creation starts only on explicit user action.
- Selection buttons should disappear via message edits.
- Inline action buttons are visually marked (for example, with emoji prefixes) to distinguish them from board/list selection buttons.
- Error responses must include enough debug context.

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
