# Decisions Log (ADR-lite)

## D-001: Explicit Task Start Trigger
**Decision:** Do not auto-start processing on every incoming message. Start only when user presses `Create task`.

**Reason:** User may gather draft content over a long period and from multiple sources; debounce is not reliable enough for that workflow.

---

## D-002: In-Memory State Instead of Database
**Decision:** Store session state and last selection in process memory.

**Reason:** MVP, single-user setup, low complexity.

**Constraint:** State is lost on process restart.

---

## D-003: Reuse Last Board/List Selection
**Decision:** Add confirmation step with `Create here / Change board`.

**Reason:** Speed up repeated task creation into the same Trello list.

---

## D-004: Reply Keyboard in Draft Mode + Remove on Start
**Decision:** Reply buttons are available in draft mode; on `Create task` keyboard is removed (`ReplyKeyboardRemove`), and restored after flow completion.

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
