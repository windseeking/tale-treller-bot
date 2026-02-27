# AGENTS.md

## Purpose
This file defines mandatory project-level working rules so key behavior does not get lost as the codebase grows.

Path convention: all file paths in docs are relative to the repository root.

## Required Reading Before Any Changes
Always read these files before editing code:

1. `docs/product-spec.md`
2. `docs/flows.md`
3. `docs/architecture.md`
4. `docs/decisions.md`
5. `docs/definition-of-done.md`

## Change Rules
- Do not break approved UX scenarios documented in `flows.md`.
- Any user-facing behavior change must update `flows.md` and, when needed, `product-spec.md`.
- Any architectural or long-term technical decision must be logged in `decisions.md`.
- Do not add new required env variables without updating:
  - `.env.example`
  - `docs/architecture.md`
  - `docs/definition-of-done.md`

## Checks Before Completing a Task
- Run: `npm run typecheck`
- Verify behavior matches `product-spec.md` and `flows.md`.
- Ensure error diagnostics are not degraded.
