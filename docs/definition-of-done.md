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
6. Error diagnostics are not degraded (LLM/Trello/Telegram).
7. Key UX invariants remain valid:
   - draft is collected silently;
   - processing starts only on `Create task`;
   - inline selection messages are edited correctly;
   - success result includes card link and open button;
   - reply keyboard is restored for next draft.

## Minimum Manual Smoke Check

1. `/start` shows guidance and draft-mode keyboard.
2. Multiple incoming messages do not auto-start board selection.
3. Pressing `Create task` starts validation and flow.
4. Trello card is created and link is shown.
5. `Cancel` clears current task and prepares a new draft.
