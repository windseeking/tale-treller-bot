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

---

## D-016: Smart Settings Sections + API Composables
**Decision:** Keep `App.vue` as the settings page shell with page-level header/loading/error markup. Keep API access, Telegram initialization, and bootstrap loading in composables. Put single-use timezone and Trello behavior inside their section components.

**Reason:** Vue composables are useful for reusable or infrastructure stateful logic, while single-use feature behavior is easier to trace inside the component that owns the matching visual layout. This keeps future settings additions local without turning `App.vue` into a monolith.

---

## D-017: Shared Type-Only Contracts Live in `src/interfaces`
**Decision:** Keep server/App shared TS contracts inside `src/interfaces/*` grouped by domain, and import them through `#interfaces/*`.

**Reason:** The server and Telegram App should use the same API/domain payload types without maintaining a second root-level contract tree. Keeping these contracts in `src/interfaces` aligns them with Clean Architecture ports and lets the App type-check against the same source contracts.

---

## D-018: Domain-Structured Clean Architecture Ports
**Decision:** Refactor server-side `src/` toward Clean Architecture layers with domain-structured `src/interfaces/*` ports. Interfaces are grouped by business area, such as `task`, `settings`, `trello`, `trello/auth`, `telegram-user`, and `notification`, while concrete adapters live under `src/infrastructure/*`.

**Reason:** Domain grouping keeps ports aligned with `entities/*` and `use-cases/*`, makes shared business boundaries easier to read, and prevents infrastructure details such as Postgres, Telegraf, Trello REST, and LLM clients from leaking into use cases.

---

## D-019: Validation Port With Zod Infrastructure Adapter
**Decision:** Use a generic `Validator<T>` port in `src/interfaces/validator.ts` and keep concrete Zod schemas under `src/infrastructure/validation/zod/*`.

**Reason:** Validation contracts stay independent from the validation library, while Zod remains an implementation detail for environment parsing, Trello API payload validation, and LLM output validation.

---

## D-020: Validators Alias
**Decision:** Import concrete Zod validators through the `#validators/*` alias.

**Reason:** Validators are infrastructure-level implementation details, but they are used by multiple adapters and config modules. A dedicated alias keeps imports stable after validator folder restructuring and is also mapped for the compiled server runtime.

---

## D-021: Concrete Platform Task Creation Use Cases
**Decision:** Model task creation as concrete platform use cases, starting with `CreateTrelloTask`. Avoid keeping a generic task-creation pipeline until repeated behavior across multiple real destinations proves that a helper is worth extracting.

**Reason:** Use cases should describe concrete business processes. A generic task-creation class made Trello behavior harder to read and encouraged premature abstraction before another destination existed.

---

## D-022: Thin Telegram Adapter + Bot Controllers
**Decision:** Keep `src/infrastructure/bot/telegram-bot.ts` as a thin Telegraf registration adapter. Move Telegram UX orchestration into `src/controllers/bot/*`, route Telegram delivery through a `BotMessenger` port, keep safe Telegraf operations in `telegram-messenger.ts`, and compose Trello task creation in a dedicated infrastructure factory.

**Reason:** The bot flow had grown into a large mixed adapter containing framework calls, session mutation, auth UX, board/list selection, and task creation composition. Splitting these responsibilities follows the Clean Architecture dependency direction, makes session behavior testable, and keeps Telegraf replaceable at the delivery edge.

---

## D-023: Destination-Aware Bot Routing + Concrete Platform Use Cases
**Decision:** Keep Telegram infrastructure as a route/IO adapter that normalizes Telegraf input into `BotRequest` and calls injected controllers. Generic bot controllers route destination-specific commands and callbacks through a `TaskDestinationRegistry`. Platform task creation is modeled as concrete use cases such as `CreateTrelloTask`. Trello callback/action data uses the `trello:` namespace, and generic task callback/action data uses the `task:` namespace.

**Reason:** The previous bot composition still selected Trello and OpenAI at bot creation time. That coupled Telegram delivery and generic draft UX to one destination and one generator. Following the clean architecture examples, concrete business scenarios should be use cases with injected tools/ports, controllers should work with normalized requests, and infrastructure should wire implementations in composition code.

---

## D-024: Product-Named Trello Auth Use Cases
**Decision:** Model Trello authorization use cases around product scenarios: initiate Trello connection, connect Trello account, disconnect Trello account, and get Trello connection status. Keep OAuth redirect mechanics, active auth-context lookup, facade composition, result DTOs, and presentation messages outside `src/use-cases/*`.

**Reason:** Clean Architecture use cases should describe business actions, not provider protocol steps, credential lookups, or delivery text mapping. Technical Trello auth support lives in `src/application/trello/auth/*`, result contracts live in `src/interfaces/trello/auth/*`, and Russian auth messages/status mapping lives in controllers/presentation while preserving the approved Trello authorization flows.
