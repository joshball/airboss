---
title: 'Review: cert-syllabus-and-goal-composer (dx)'
feature: cert-syllabus-and-goal-composer
date: 2026-04-28
reviewer: dx
status: unread
review_status: done
scope: PRs #248, #254, #264, #270 (cumulative WP)
issues_found: 1
---

# Review: cert-syllabus developer experience

## Minor (1)

### dx1 -- WP review #5 PR opens off a worktree where `bun install` is required first

A fresh worktree clone misses `node_modules`. The `bun run check` and the test suite both fail until `bun install` runs. Standard for any worktree, but the `fast-xml-parser` ImportError surfaces as a confusing "Cannot find package" rather than "run bun install".

**Fix:** out of WP scope; consider a `Makefile` or `package.json` `prepare` hook in the future. Drop.

## Notes

- BC docstrings (`credentials.ts`, `syllabi.ts`, `goals.ts`, `lenses.ts`) are excellent: each opens with a "Read paths" / "Write paths" / "Build helpers" map, then explains the why before each function. Future maintainers can navigate without re-reading the spec.
- Error types carry actionable context (`CredentialPrereqCycleError.cycle`, `AirbossRefValidationError.identifier`).
- Migration script logs per-cert skip reasons; debugging "why didn't this plan migrate?" is straightforward from the report.
- `validateCredentialDag` and `validateSyllabusTree` errors include the offending row's `code` / `id` -- the seed's failure mode points the author directly at the YAML to fix.
- Generation of `prefix_ULID` ids via the centralised `@ab/utils` module (no inline `nanoid()` / `ulid()`) is consistent.
- `seed-credentials.ts` / `seed-syllabi.ts` are runnable standalone with `bun scripts/db/seed-X.ts <slug>` for partial seeding -- nice for quick iteration on one credential.
