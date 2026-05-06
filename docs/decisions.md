# Decisions Log (ADR-lite)

## D-001: Explicit Task Start Trigger
**Decision:** Do not auto-start processing on every incoming message. Start only when user presses `Создать задачу`.

**Reason:** User may gather draft content over a long period and from multiple sources.

---

## D-002: In-Memory UX State + PostgreSQL Auth State
**Decision:** Keep per-chat draft/selection state in memory, but store Trello auth/session data in PostgreSQL.

**Reason:** Draft UX is transient and fast in memory; auth data must survive restarts and support multi-user secure access.

---

## D-003: Reuse Last Board/List Selection
**Decision:** Keep confirmation step with `Создать тут / Поменять доску`.

**Reason:** Speed up repeated task creation into the same Trello list.

---

## D-004: Reply Keyboard in Draft Mode + Remove on Start
**Decision:** Reply buttons are available in draft mode; on `Создать задачу` keyboard is removed and restored after flow completion.

**Reason:** Prevent accidental repeated presses and reduce UI noise during board/list selection.

---

## D-005: Strict JSON-oriented LLM Handling
**Decision:** Use JSON response mode plus stronger parsing/sanitization and diagnostics.

**Reason:** Improve reliability of converting LLM output into Trello payload.

---

## D-006: Signature in Trello Card Description
**Decision:** Always append:
`Task created with [@taletrellerbot](https://t.me/taletrellerbot).`

**Reason:** Keep clear source attribution for generated cards.

---

## D-007: Trello OAuth Per Telegram User + App-enforced TTL
**Decision:** Move Trello auth from global env token to per-user OAuth credentials with app-enforced 30-day validity.

**Reason:** Multi-user security isolation, explicit reconnect UX, and controlled operational policy independent of provider token lifetime.

---

## D-008: Shared Process for Bot + HTTP OAuth Callback
**Decision:** Run Telegram polling bot and Express OAuth callback server in one Node process.

**Reason:** Simplifies deployment and allows direct coordination between bot UX and auth callback completion.

---

## D-009: Token Encryption at Rest (AES-256-GCM)
**Decision:** Encrypt Trello token (and request token secret) in DB using AES-256-GCM with master key from env.

**Reason:** Limit blast radius of DB leakage and satisfy baseline production security requirements.

---

## D-010: User Settings as Key/Value + Internal Timezone
**Decision:** Store user settings as key/value records and store timezone as an internal IANA timezone ID under `time_zone`.

**Reason:** IANA timezone preserves daylight-saving rules while Telegram UX can stay human-readable. The key/value shape is ready for future settings and App writes.

---

## D-011: Telegram App for Settings
**Decision:** Move settings UX to a Telegram App served from `/app`, with APIs under `/api/app/*`, Vue 3 + Vite + PrimeVue 4, Telegram `initData` authentication, and standard IANA timezone names in every locale.

**Reason:** Chat inline keyboards are not a good fit for timezone selection because same-offset cities can be far apart and confusing. A searchable App selector over IANA timezone names plus current UTC offsets gives better UX without maintaining localized timezone labels.

---

## D-012: Product App Palette
**Decision:** Use the palette defined in `docs/product-spec.md` for the App, with Funky Blue as the PrimeVue primary color and Base as the page background.

**Reason:** The App needs a consistent visual identity now that settings and account information are moving into a richer frontend surface.

---

## D-013: Tailwind CSS for App Layout Styling
**Decision:** Use Tailwind CSS utilities for Telegram App layout and custom surface styling while keeping PrimeVue for interactive components and the Aura-based theme.

**Reason:** Utility classes keep single-component App layout changes close to the Vue template without replacing the existing PrimeVue component system.

---

## D-014: Vite Middleware for App Development
**Decision:** In `NODE_ENV=development`, serve the Telegram App from Vite middleware on the same Express server and `/app` path used by Telegram links. In non-development modes, continue serving built static files from `dist/public/app`.

**Reason:** Telegram Mini App previews need the public `APP_BASE_URL/app` URL, but frontend iteration should not require rebuilding the App after every change.

---

## D-015: Telegram initData for App Authorization
**Decision:** Authorize Telegram App API requests by validating Telegram Mini App `initData` from `X-Telegram-Init-Data`. The App is opened from the standard Telegram Menu Button at stable `/app`; bot-generated App launch links are not used.

**Reason:** One-time App launch links are brittle with Telegram WebView caching and Menu Button entry. Verified `initData` ties each request to the current Telegram user without replay-prone `sid`/`secret` links.
