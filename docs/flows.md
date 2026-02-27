# User Flows

## 1. Main Flow: Draft -> Trello Card

1. User sends `/start`.
2. Bot sends welcome message and reply keyboard:
   - `Create task`
   - `Cancel`
3. User sends one or more text messages (bot silently accumulates draft).
4. User presses `Create task`.
5. Bot hides reply keyboard (`remove_keyboard`) and validates draft:
   - empty -> `draftEmpty`;
   - < 15 chars -> `tooShort`;
   - otherwise continue.
6. If `lastBoard/lastList` exists, bot offers inline options:
   - `Create here`
   - `↩️ Change board`
   - `❌ Cancel`
7. If `Create here`:
   - bot goes directly to LLM + Trello creation.
8. If `↩️ Change board` (or no last selection):
   - bot shows boards list.
9. User selects board:
   - selection message is edited to `Board: ...`.
10. Bot shows lists of selected board.
11. User selects list:
   - selection message is edited to `List: ...`.
12. Bot sends `cardInProgress`.
13. Bot:
   - generates card payload via LLM;
   - appends signature to `desc`;
   - creates card in Trello.
14. `cardInProgress` is edited to `cardCreated` + `Open card` button.
15. Bot clears current task, stores last selection, and restores reply keyboard for the next draft.

---

## 2. Cancel Flows

### 2.1 Cancel in Draft Mode (reply button `Cancel`)
1. Bot resets current task.
2. Bot sends cancellation confirmation.
3. Bot shows reply keyboard for a new draft.

### 2.2 Cancel in Inline Flow (`action:cancel`)
1. Bot resets current task.
2. Bot sends cancellation confirmation.
3. Bot shows reply keyboard for a new draft.

Inline action buttons use visual markers to distinguish them from selection buttons:
- `↩️ Change board`
- `❌ Cancel`

---

## 3. Edge Cases

1. No available boards:
   - bot sends `noBoards`.
2. No lists in selected board:
   - bot sends `noLists` and returns to board selection.
3. Expired callback query:
   - safely handled via `safeAnswerCbQuery`.
4. Invalid/unstable LLM response:
   - parse and shape errors include diagnostics.
5. `Create task` user message is deleted when possible to reduce chat noise.
