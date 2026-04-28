---
title: 'Review: cert-syllabus-and-goal-composer (backend)'
feature: cert-syllabus-and-goal-composer
date: 2026-04-28
reviewer: backend
status: unread
review_status: done
scope: PRs #248, #254, #264, #270 (cumulative WP)
issues_found: 0
---

# Review: cert-syllabus backend

## Critical / Major / Minor (0)

(none)

## Notes

- This WP is data-layer + BC + scripts. No SvelteKit `+page.server.ts` / `+page.svelte` surface lands here; routes for `/credentials`, `/credentials/[slug]`, `/goals`, `/goals/new`, `/goals/[id]`, `/goals/[id]/edit` are constants-only definitions in `libs/constants/src/routes.ts` per the spec contract.
- BC error types are well-shaped: `CredentialNotFoundError`, `CredentialPrereqCycleError`, `SyllabusNotFoundError`, `SyllabusValidationError`, `AirbossRefValidationError`, `GoalNotFoundError`, `GoalNotOwnedError`, `GoalAlreadyPrimaryError`. These will give route handlers (follow-on WP) actionable error feedback.
- All BC functions accept an optional `db: Db` parameter (default `defaultDb`) so transactional callers can pass a `tx` from `db.transaction(async (tx) => ...)`. Good DI shape.
- `setPrimaryGoal` uses a transaction to clear-then-set so the partial UNIQUE on `goal_user_primary_unique` never trips mid-write. Same pattern in `createGoal` when `isPrimary=true` is the initial state.
- Seed scripts (`seed-credentials.ts`, `seed-references.ts`, `seed-syllabi.ts`) all validate before writing; partial-fail leaves the DB unchanged.
- `migrate-study-plans-to-goals.ts` is well-instrumented (per-cert skip reasons in the report) and idempotent via `goal_migrated_at`.

The backend review surface here is small because the BC + scripts pattern is consistent; nothing to flag.
