# Definition of Done

## Mandatory Before Marking Any Task Complete

1. Type safety check passes:
   - `npm run typecheck`
2. New behavior matches current `flows.md`.
3. If user flow changed:
   - update `docs/flows.md`;
   - update `docs/product-spec.md` if needed.
4. If architecture/approach changed:
   - add/update entry in `docs/decisions.md`.
5. If env variables changed:
   - update `.env.example` and `docs/architecture.md`.
6. Error diagnostics are not degraded (LLM/Trello/Telegram/Auth).
7. Security invariants remain valid:
   - no plaintext Trello token logging;
   - token/key materials are encrypted at rest;
   - auth session links are one-time and expiring.
8. Key UX invariants remain valid:
   - draft is collected silently;
   - processing starts only on `Создать задачу`;
   - auth-required interruptions preserve draft text;
   - inline selection messages are edited correctly;
   - success result includes card link/button;
   - reply keyboard is restored for next draft.

## Minimum Manual Smoke Check

1. `/start` shows guidance and draft-mode keyboard.
2. Multiple incoming messages do not auto-start board/list flow.
3. Pressing `Создать задачу` starts validation.
4. If Trello not connected, user gets connect CTA and draft stays intact.
5. OAuth link completion enables Trello card creation for that user.
6. `Статус Trello` shows connected/not connected state with expiry.
7. `Выйти из Trello` blocks Trello operations until reconnect.
8. Replayed or expired auth link returns safe error page.
