---
title: 'Review: cert-syllabus-and-goal-composer (architecture)'
feature: cert-syllabus-and-goal-composer
date: 2026-04-28
reviewer: architecture
status: unread
review_status: done
scope: PRs #248, #254, #264, #270 (cumulative WP)
issues_found: 2
---

# Review: cert-syllabus architecture

## Major (1)

### A1 -- Side-effect resolver registration is order-dependent

The `@ab/sources` library registers per-corpus resolvers via side-effect imports in `libs/sources/src/index.ts`. The barrel re-exports from `./acs/index.ts`, `./pts/index.ts`, etc., each of which calls `registerCorpusResolver(...)` at import time. If a consumer imports a deeper module without going through the barrel, only some corpora register, and `getCorpusResolver(corpus)` silently falls through to a no-op default.

Combined with the test-pollution issue (correctness review C1), this means the production registration is fragile: any module that imports from `libs/sources/src/registry/corpus-resolver.ts` directly without first hitting the barrel gets the no-op resolvers.

**Fix:** make `getCorpusResolver` lazily ensure registration. Or expose a single `productionRegistry()` that's the only supported way to access resolvers and which ensures every side-effect import has run. The current pattern is widespread (regs, handbooks, aim, ac, acs, pts), so changing the contract is non-trivial; the lighter touch is to make `resetToDefaults` snapshot-aware (see C1).

**Resolution:** route through C1 fix in correctness review; the snapshot approach addresses the test-pollution symptom. Document the side-effect-import contract in `libs/sources/src/registry/corpus-resolver.ts` so future maintainers know not to import directly.

## Minor (1)

### a1 -- BC barrel `libs/bc/study/src/index.ts` exports an `acsLens` whose synthetic root claims `level: 'cert'` but is really a syllabus root

`libs/bc/study/src/lenses.ts:73,324`. The `LensTreeNode.level` union includes `'cert'`, but the ACS lens uses it as the synthetic root for ONE syllabus, and one credential can have multiple syllabi (primary + supplemental). The semantic mismatch surfaces if a goal targets multiple credentials -- the consumer sees N "cert" roots that aren't actually cert-scoped.

**Fix:** rename the synthetic root level to `'syllabus'` (add to the union; already in the wider monorepo type space). Or: lift the cert grouping to the lens result top level (`tree: { credentialId, credentialTitle, syllabi: LensTreeNode[] }[]`).

**Resolution:** rename to `'syllabus'`. Add to the union. The cert dashboard (follow-on WP) will handle credential-level grouping; the lens shouldn't conflate them.

## Notes

- BC structure (`credentials.ts`, `syllabi.ts`, `goals.ts`, `lenses.ts`) is clean, with single-responsibility files and minimal cross-module imports. The lazy `await import('./knowledge')` and `await import('./goals')` in `lenses.ts` correctly avoids eager-loading the wider knowledge BC for marketing surfaces that only need lens primitives.
- `validateCredentialDag` and `validateSyllabusTree` correctly run BEFORE writes so a partial seed never leaves the DB inconsistent. Matches the ADR 016 contract.
- `migrate-study-plans-to-goals.ts` uses transactions per plan and `goal_migrated_at` for idempotency. Good migration shape.
- The `acs` corpus resolver's manifest cache (`_manifestCache` in `libs/sources/src/acs/resolver.ts:48`) is per-process; reasonable for production.
