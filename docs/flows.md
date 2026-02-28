# User Flows

## 1. Main Flow: Draft -> Trello Card

1. User sends `/start`.
2. Bot checks active Trello connection for this Telegram user.
3. If Trello is connected, bot sends task-creation welcome message and reply keyboard:
   - `Create task`
   - `Cancel`
   - `Disconnect Trello`
4. If Trello is not connected/revoked/expired, bot sends connect-required welcome message (with safety note) and reply keyboard:
   - `Connect Trello`
5. User sends one or more text messages (bot silently accumulates draft).
6. User presses `Create task`.
7. Bot validates draft:
   - empty -> `draftEmpty`;
   - < 15 chars -> `tooShort`;
   - otherwise continue.
8. Bot checks active Trello connection for this Telegram user:
   - no connection/revoked/expired -> send connect CTA with inline button and stop flow;
   - active -> continue.
9. If `lastBoard/lastList` exists, bot offers inline options:
   - `Create here`
   - `↩️ Change board`
   - `❌ Cancel`
10. If `Create here`, bot goes directly to LLM + Trello card creation.
11. If `↩️ Change board` (or no last selection), bot shows boards list.
12. User selects board:
    - selection message is edited to `Доска: ...`.
13. Bot shows lists of selected board.
14. User selects list:
    - selection message is edited to `Колонка: ...`.
15. Bot sends `cardInProgress`.
16. Bot:
    - generates card payload via LLM;
    - appends signature to `desc`;
    - creates card in Trello using user credentials.
17. `cardInProgress` is edited to `cardCreated` + `Open card` button.
18. Bot clears current task, stores last selection, restores authorized reply keyboard.

## 2. Trello Authorization Flows

### 2.1 Connect / Reconnect
1. User presses `Connect Trello`.
2. Bot creates one-time auth session (TTL 15 minutes by default).
3. Bot sends inline button URL `/auth/trello/start?sid=...&secret=...`.
4. User completes Trello OAuth page.
5. Callback stores encrypted token and marks connection active.
6. Bot optionally sends notification: `Trello подключен, можно создавать задачу`.

### 2.2 Status
1. User sends `/trello_status` command.
2. Bot shows one of:
   - not connected;
   - connected + username + expiry datetime;
   - expired + reconnect hint.

### 2.3 Disconnect
1. User presses `Disconnect Trello`.
2. Bot marks connection as revoked and invalidates pending auth sessions.
3. Bot confirms disconnect and shows reply keyboard with only `Connect Trello`.

## 3. Cancel Flows

### 3.1 Cancel in Draft Mode (`Cancel`)
1. Bot resets current task.
2. Bot sends cancellation confirmation.
3. Bot shows reply keyboard for a new draft.

### 3.2 Cancel in Inline Flow (`action:cancel`)
1. Bot resets current task.
2. Bot sends cancellation confirmation.
3. Bot shows reply keyboard for a new draft.

## 4. Edge Cases

1. No available boards -> `noBoards`.
2. No lists in selected board -> `noLists`, return to board selection.
3. Expired callback query -> safely handled via `safeAnswerCbQuery`.
4. Invalid/unstable LLM response -> parse/shape diagnostics.
5. Auth-required interruption preserves user draft messages.
6. Replayed/expired auth link returns safe HTML error page.
