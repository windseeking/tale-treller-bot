# Definition of Done

## Mandatory Before Marking Any Task Complete

1. Type safety check passes:
   - `npm run typecheck`
2. App build passes when App/frontend changes are included:
   - `npm run build:app`
   - In development, `/app` may be verified through `npm run dev` without rebuilding.
3. New behavior matches current `flows.md`.
4. If user flow changed:
   - update `docs/flows.md`;
   - update `docs/product-spec.md` if needed.
5. If architecture/approach changed:
   - add/update entry in `docs/decisions.md`.
6. If env variables changed:
   - update `.env.example` and `docs/architecture.md`.
7. Error diagnostics are not degraded (LLM/Trello/Telegram/Auth).
8. Security invariants remain valid:
   - no plaintext Trello token logging;
   - token/key materials are encrypted at rest;
   - auth session links are one-time and expiring.
   - App API requests validate Telegram Mini App `initData`.
9. Key UX invariants remain valid:
   - draft is collected silently;
   - processing starts only on `Создать задачу`;
   - auth-required interruptions preserve draft text;
   - settings changes preserve draft text;
   - inline selection messages are edited correctly;
   - success result includes card link/button;
   - reply keyboard is restored for next draft.
   - bot and App user-facing strings come from their i18n JSON catalogs.

## Minimum Manual Smoke Check

1. `/start` shows guidance and draft-mode keyboard.
2. Multiple incoming messages do not auto-start board/list flow.
3. Pressing `Создать задачу` starts validation.
4. If Trello not connected, user gets connect CTA and draft stays intact.
5. OAuth link completion enables Trello card creation for that user.
6. `Статус Trello` shows connected/not connected state with expiry.
7. `Выйти из Trello` blocks Trello operations until reconnect.
8. Replayed or expired auth link returns safe error page.
9. Telegram Menu Button opens the Telegram App.
10. App timezone setup stores a valid IANA timezone ID.
11. App locale setup stores `en` or `ru` and immediately re-renders App copy.
12. Bot `/start` initializes missing locale from Telegram language settings without overwriting an existing locale.
13. App Trello status/actions reflect connected, expired, and disconnected states.
14. Card generation uses the saved timezone, or `APP_TIMEZONE` when timezone is missing.
