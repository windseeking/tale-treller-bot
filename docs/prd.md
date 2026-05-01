# Product Requirements Document

## Problem Statement

Trello and Telegram users often capture task ideas as rough, fragmented Telegram messages. Those messages may arrive over time, include incomplete context, and need to be manually rewritten into a clear Trello card before work can begin.

The core problem is that users lose time and focus when they must copy, restructure, summarize, and route those messages into the right Trello board and list by hand.

## Solution

Build a Telegram bot that lets any Telegram user connect their own Trello account, collect one or more text messages as a draft, and explicitly turn that draft into a structured Trello card.

The MVP focuses on reliable, user-controlled task creation:

- The bot silently accumulates text messages into a draft.
- The user explicitly starts task creation with a button.
- The bot validates the draft before doing any Trello work.
- The user connects Trello through a per-user OAuth flow.
- Each Telegram user uses their own Trello credentials.
- The user selects a Trello board and list, or reuses the previous selection.
- An LLM turns the raw draft into a card title, description, and optional metadata.
- The bot creates the card in Trello and returns a link to it.

The next product version will expand the MVP with additional functionality after those requirements are defined separately.

## User Stories

1. As a Telegram user, I want to start the bot, so that I can understand whether I am ready to create Trello tasks.
2. As a Telegram user, I want to connect my Trello account, so that cards are created in my own workspace.
3. As a Telegram user, I want to reconnect Trello at any time, so that I can recover from expired or revoked authorization.
4. As a Telegram user, I want to disconnect Trello from the bot, so that I can stop the bot from creating Trello cards for me.
5. As a Telegram user, I want to check my Trello connection status, so that I know whether task creation will work.
6. As a Telegram user, I want the bot to preserve my draft when Trello is not connected, so that I do not lose captured task context.
7. As a Telegram user, I want to send several separate messages before creating a task, so that I can collect messy thoughts naturally.
8. As a Telegram user, I want the bot to stay quiet while I am collecting draft messages, so that the chat does not become noisy.
9. As a Telegram user, I want task creation to start only when I press a button, so that the bot does not process unfinished thoughts.
10. As a Telegram user, I want the bot to reject empty drafts, so that no meaningless Trello cards are created.
11. As a Telegram user, I want the bot to reject drafts that are too short, so that accidental or low-quality cards are avoided.
12. As a Telegram user, I want to cancel the current draft, so that I can start over cleanly.
13. As a Telegram user, I want to choose a Trello board, so that the card goes into the correct workspace context.
14. As a Telegram user, I want to choose a Trello list, so that the card enters the right workflow stage.
15. As a Telegram user, I want the bot to reuse my previous board and list, so that repeated task creation is faster.
16. As a Telegram user, I want to change the reused board or list, so that I can route a task somewhere else when needed.
17. As a Telegram user, I want selection buttons to disappear or be edited after I choose an option, so that the chat state remains clear.
18. As a Telegram user, I want to see progress while the card is being generated, so that I know the bot is working.
19. As a Telegram user, I want the bot to structure my raw text into a useful Trello card, so that I do not need to write the title and description manually.
20. As a Telegram user, I want the card description to include source attribution, so that cards created by the bot are recognizable.
21. As a Telegram user, I want a success message with a Trello card link, so that I can immediately open the created task.
22. As a Telegram user, I want clear error messages with enough diagnostic context, so that failures can be investigated.
23. As a Telegram user, I want the bot to handle unavailable boards or lists safely, so that I can recover without losing my draft.
24. As a Telegram user, I want expired or replayed authorization links to fail safely, so that my account connection remains protected.
25. As a product owner, I want each Telegram user isolated to their own Trello credentials, so that one user cannot accidentally create cards through another user's account.
26. As a product owner, I want active users to be measurable, so that adoption of the bot can be tracked.

## Implementation Decisions

- The MVP is a Telegram bot backed by a single Node.js and TypeScript process.
- The process runs Telegram polling, an HTTP server for Trello OAuth callbacks, and PostgreSQL access.
- Draft and selection state are stored in memory because they are transient chat UX state.
- Trello authorization state is stored persistently in PostgreSQL because credentials must survive restarts.
- Trello authorization is per Telegram user, not shared globally.
- Trello OAuth sessions are one-time, secret-protected, and time-limited.
- Trello credentials are encrypted at rest.
- Trello authorization has an app-enforced validity window, after which reconnect is required.
- The bot uses reply keyboards for draft-mode commands and inline keyboards for board/list selection.
- The bot removes or edits selection UI after user actions to keep the Telegram conversation state clear.
- The task creation trigger is explicit; the bot must not auto-create tasks from incoming messages.
- Board/list reuse is part of the MVP to reduce friction for repeated task creation.
- LLM output is handled as structured JSON and validated before sending data to Trello.
- Trello card creation requires a title, description, top position, and list ID.
- Trello card creation may include optional due date and source URL fields when the LLM produces valid values.
- Every generated description includes a fixed bot attribution signature.
- Error diagnostics must preserve enough context for LLM, Trello, Telegram, and authorization failures while avoiding plaintext token logging.
- The next product version will be specified later and should build on this MVP without breaking approved MVP flows.

## Testing Decisions

- Tests should focus on externally visible behavior and stable contracts rather than private implementation details.
- The highest-value test areas are the draft state machine, Trello authorization guardrails, LLM output validation, and Trello card payload shaping.
- Draft behavior should verify silent accumulation, explicit creation, validation errors, cancellation, and draft preservation during auth-required interruptions.
- Authorization behavior should verify connect, reconnect, status, disconnect, expired sessions, replayed links, and revoked connections.
- Trello selection behavior should verify board selection, list selection, last-selection reuse, changing selection, and empty board/list edge cases.
- LLM behavior should verify valid JSON output, malformed output diagnostics, optional fields, and required card field enforcement.
- Security-sensitive tests should verify that token material is encrypted at rest and not exposed in logs or diagnostics.
- Manual smoke testing remains required for the integrated Telegram, Trello, OAuth callback, PostgreSQL, and LLM workflow.

## Out of Scope

- Automatically creating Trello tasks without an explicit user button press.
- Supporting task trackers other than Trello.
- Using shared Trello credentials across multiple Telegram users.
- Non-text input processing unless defined in a future PRD update.
- File attachments, image parsing, voice message transcription, and other media workflows unless defined in a future PRD update.
- Team administration, billing, analytics dashboards, or public marketing site work unless defined in a future PRD update.

## Further Notes

- The primary success metric for the MVP is the number of active users.
- The product should remain usable by any Telegram user who has a Trello account.
- Future functionality should be added as a new PRD section or follow-up PRD once the next-version requirements are provided.
