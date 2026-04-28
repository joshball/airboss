---
title: 'Review summary: cert-syllabus-and-goal-composer'
feature: cert-syllabus-and-goal-composer
date: 2026-04-28
reviewer: orchestrator
status: unread
review_status: done
scope: PRs #248, #254, #264, #270 (cumulative WP)
---

# Review summary

10-axis review of the cert-syllabus-and-goal-composer WP. All reviewers operated against the cumulative diff of merged PRs #248, #254, #264, #270 vs `cf3f3278^` (pre-WP main).

## Findings by category

| Category     | Critical | Major | Minor | Nit | Total |
|--------------|----------|-------|-------|-----|-------|
| ux           | 0        | 0     | 0     | 0   | 0     |
| svelte       | 0        | 0     | 0     | 0   | 0     |
| security     | 0        | 0     | 0     | 0   | 0     |
| perf         | 0        | 0     | 2     | 0   | 2     |
| architecture | 0        | 1     | 1     | 0   | 2     |
| patterns     | 0        | 1     | 4     | 0   | 5     |
| correctness  | 2        | 2     | 1     | 3   | 8     |
| a11y         | 0        | 0     | 0     | 0   | 0     |
| backend      | 0        | 0     | 0     | 0   | 0     |
| schema       | 0        | 0     | 3     | 0   | 3     |
| testing      | 0        | 1     | 1     | 0   | 2     |
| **TOTAL**    | **2**    | **5** | **12**| **3** | **22** |

(testing + correctness overlap on the same root cause -- counted once but tracked in both files.)

## Convergent root causes

Three findings collapse into single root-cause fixes:

1. **C1 (correctness) + T1 (testing) + A1 (architecture)** -- corpus resolver registry test pollution. `__corpus_resolver_internal__.resetToDefaults` wipes real registrations. Fix once in `libs/sources/src/registry/corpus-resolver.ts`.
2. **m1 (correctness) + perf1 (perf)** -- `getCredentialMastery.ancestorAreaId` O(n²). One-line fix in `credentials.ts`.
3. **p1 (patterns) -- "void X" anti-pattern** -- across `syllabi.ts`, `goals.ts`. Single sweep removes the dead statements + unused imports.

## Fix plan

Reviews are read-only; fixes execute in this PR per the project rule "always fix everything from a review". Fix order:

1. `bunx biome check --write` on the 5 WP files flagged by P1 (auto-fixable).
2. C1: rework `__corpus_resolver_internal__` to track production registrations and have `resetToDefaults` restore the snapshot.
3. C2: pass syllabus title through `acsLens` synthetic root.
4. M1: remove the `rebuildKnowledgeNodeRelevanceCache` BC stub (the real implementation lives in `scripts/db/build-relevance-cache.ts`).
5. M2: implement `setGoalNodeWeight` in `goals.ts`.
6. m1 / perf1: materialise `nodesById` map in `getCredentialMastery`.
7. p1: delete `void X` statements + unused imports across `syllabi.ts` and `goals.ts`.
8. p4: add `placeholder?: boolean` to `LensLeaf` and set it where placeholders are emitted.
9. a1: rename `acsLens` synthetic root level to `'syllabus'`.
10. m3 (schema): change `goal.target_date` to `date` type (migration `0005_*.sql`); update `goals.ts` to stop wrapping in `new Date(...)` for the date conversion.

After fixes:

- `bun run check` clean (or matching baseline -- pre-existing PR #249/PR #261 errors are out of WP scope).
- `bun test libs/sources libs/bc/study scripts/db` -- all pass (no test-pollution failures).
- Re-grep for the void anti-pattern, the syllabusId-as-title bug, and the relevance cache stub returns clean.

## Cross-cutting notes

- The WP delivered substantial scope (~25K LoC across 4 PRs) with strong test coverage (1083 passing tests in the modules touched). Code quality is high: clean BC boundaries, defensive validators, idempotent seeds, transactional migrations, well-shaped error types.
- Pre-existing biome and theme-lint errors carried in from PRs #249-262 (sources/pdf, sources/ac, dev references page) are out of WP scope. Track in a follow-on cleanup pass.
- Spec compliance verified against `docs/work-packages/cert-syllabus-and-goal-composer/spec.md` items 1-15 (in scope). Items 7-9 (cert dashboard, lens UI, goal composer pages) explicitly deferred per the spec.

## Per-reviewer files

- `2026-04-28-cert-syllabus-correctness.md`
- `2026-04-28-cert-syllabus-schema.md`
- `2026-04-28-cert-syllabus-architecture.md`
- `2026-04-28-cert-syllabus-patterns.md`
- `2026-04-28-cert-syllabus-testing.md`
- `2026-04-28-cert-syllabus-perf.md`
- `2026-04-28-cert-syllabus-security.md`
- `2026-04-28-cert-syllabus-backend.md`
- `2026-04-28-cert-syllabus-svelte.md`
- `2026-04-28-cert-syllabus-a11y.md`
- `2026-04-28-cert-syllabus-ux.md`
- `2026-04-28-cert-syllabus-dx.md`
