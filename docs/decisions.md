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
