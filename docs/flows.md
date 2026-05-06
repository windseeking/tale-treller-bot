# User Flows

## 1. Main Flow: Draft -> Trello Card

1. User sends `/start`.
2. Bot ensures this Telegram user exists in storage.
3. Bot checks active Trello connection for this Telegram user.
4. If Trello is connected, bot sends task-creation welcome message and reply keyboard:
   - `Создать задачу`
   - `Отмена`
   - `Выйти из Trello`
5. If Trello is not connected/revoked/expired, bot sends connect-required welcome message (with safety note) and reply keyboard:
   - `Подключить Trello`
6. User sends one or more text messages (bot silently accumulates draft).
7. User presses `Создать задачу`.
8. Bot validates draft:
   - empty -> `draftEmpty`;
   - < 15 chars -> `tooShort`;
   - otherwise continue.
9. Bot checks active Trello connection for this Telegram user:
   - no connection/revoked/expired -> send connect CTA with inline button and stop flow;
   - active -> continue.
10. If `lastBoard/lastList` exists, bot offers inline options:
   - `Создать тут`
   - `↩️ Поменять доску`
   - `❌ Cancel`
11. If `Создать тут`, bot goes directly to LLM + Trello card creation.
12. If `↩️ Поменять доску` (or no last selection), bot shows boards list.
13. User selects board:
    - selection message is edited to `Доска: ...`.
14. Bot shows lists of selected board.
15. User selects list:
    - selection message is edited to `Колонка: ...`.
16. Bot sends card creation progress message.
17. Bot:
    - resolves user timezone from settings or `APP_TIMEZONE`;
    - computes current date-time with the timezone's current UTC offset;
    - generates card payload via LLM using that current date-time;
    - appends signature to `desc`;
    - creates card in Trello using user credentials.
18. Progress message is edited to created-card message + `Открыть карточку` button.
19. Bot clears current task, stores last selection, restores authorized reply keyboard.

## 2. Trello Authorization Flows

### 2.1 Connect / Reconnect
1. User presses `Connect Trello`.
2. Bot creates one-time auth session (TTL 15 minutes by default).
3. Bot sends inline button URL `/auth/trello/start?sid=...&secret=...`.
4. User completes Trello OAuth page.
5. Callback stores encrypted token and tries to save timezone from Trello prefs if Trello returns a valid IANA timezone.
6. Callback marks connection active.
7. Bot optionally sends success notification.
8. If no timezone is saved, bot sends a setup prompt explaining that timezone is needed for task deadlines.

### 2.2 Status
1. User sends `/trello_status` command.
2. Bot shows one of:
   - not connected;
   - connected + username + expiry datetime;
   - expired + reconnect hint.

### 2.3 Disconnect
1. User presses `Disconnect Trello`.
2. Bot marks connection as revoked and invalidates pending auth sessions.
3. Bot confirms disconnect and shows reply keyboard with `Connect Trello`.

## 3. User Settings App Flows

### 3.1 Open App
1. User opens the standard Telegram Menu Button.
2. Telegram opens the stable `/app` Mini App URL.
3. App reads `window.Telegram.WebApp.initData`.
4. App sends `initData` in `X-Telegram-Init-Data` for protected `/api/app/*` requests.
5. Backend validates Telegram `initData`, resolves the Telegram user, and returns current settings plus Trello status.
6. Existing draft text is preserved during settings changes.

### 3.2 Set Timezone
1. App loads all IANA timezone options from `GET /api/app/time-zones`.
2. App shows a searchable timezone selector with IANA timezone name and current UTC offset.
3. User may press the auto-detect icon button.
4. If browser detection succeeds, App selects the detected timezone and saves it immediately.
5. If browser detection fails, App asks the user to choose manually.
6. When user selects a timezone manually from the list, App saves it immediately.
7. Backend validates the selected timezone and stores the IANA ID in `user_settings.time_zone`.

### 3.3 Trello Status and Actions
1. App shows Trello connection status from `/api/app/trello/status`.
2. If Trello is missing or expired, user can request a connect link.
3. App opens the existing OAuth flow URL.
4. User can disconnect Trello after confirmation.
5. Backend revokes the connection; Trello operations remain blocked until reconnect.

## 4. Cancel Flows

### 4.1 Cancel in Draft Mode (`Cancel`)
1. Bot resets current task.
2. Bot sends cancellation confirmation.
3. Bot shows reply keyboard for a new draft.

### 4.2 Cancel in Inline Flow (`action:cancel`)
1. Bot resets current task.
2. Bot sends cancellation confirmation.
3. Bot shows reply keyboard for a new draft.

## 5. Edge Cases

1. No available boards -> `noBoards`.
2. No lists in selected board -> `noLists`, return to board selection.
3. Expired callback query -> safely handled via `safeAnswerCbQuery`.
4. Invalid/unstable LLM response -> parse/shape diagnostics.
5. Auth-required interruption preserves user draft messages.
6. Replayed/expired auth link returns safe HTML error page.
7. Missing/invalid timezone falls back to `APP_TIMEZONE`.
8. Missing/invalid/expired Telegram App `initData` is rejected safely.
