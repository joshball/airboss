---
title: 'Test plan: ADR 026 implementation -- registry-canonical edition coherence'
product: platform
feature: adr-026-implementation
type: test-plan
status: unread
review_status: done
---

# Test plan: ADR 026 implementation

Verification has three parts: (1) automated tests for the resolver API, (2) automated coverage of the migrated readers, (3) manual walkthrough of the four user-visible surfaces that today render edition-supersession affordances. Plus a `bun run check` guard test that proves the seed-only writer contract.

## Resolver API tests

New file: [libs/sources/src/registry/edition-resolver.test.ts](../../../libs/sources/src/registry/edition-resolver.test.ts). Vitest, hits a real test DB (the project standard -- mocking the DB is banned per CLAUDE.md). Test fixtures populate `sources_registry.editions` directly via the existing `__editions_internal__.setActiveTable` test surface.

| Case                                                   | Setup                                                             | Expectation                                               |
| ------------------------------------------------------ | ----------------------------------------------------------------- | --------------------------------------------------------- |
| `getCurrentEdition` returns row when one is current    | Seed AFH 3B retired, 3C current                                   | Returns the 3C row                                        |
| `getCurrentEdition` returns null when none current     | Seed AFH 3B retired, 3C also retired                              | Returns `null`                                            |
| `getCurrentEdition` returns null when no rows for slug | Seed nothing for `airboss-ref:handbooks/unknown-slug`             | Returns `null`                                            |
| `getCurrentEdition` tiebreak on equal `published_at`   | Seed two rows with same `published_at`, both `retired_at IS NULL` | Returns the lex-greater `id` (matches `editions.ts` rule) |
| `getEditionByLabel` returns the labelled row           | Seed AFH 3B retired                                               | Returns the 3B row                                        |
| `getEditionByLabel` returns null on unknown label      | Seed AFH 3B + 3C, query for "8083-3D"                             | Returns `null`                                            |
| `isEditionSuperseded` returns true for retired row     | Seed AFH 3B retired                                               | Returns `true`                                            |
| `isEditionSuperseded` returns false for current row    | Seed AFH 3C current                                               | Returns `false`                                           |
| `isEditionSuperseded` returns false for unknown label  | Query for label not in registry                                   | Returns `false` (matches "not retired" semantics)         |
| `listEditionsForSource` returns chronological order    | Seed AFH 3A, 3B, 3C with ascending `published_at`                 | Returns `[3A, 3B, 3C]`                                    |
| `listEditionsForSource` returns empty for unknown slug | Query for unknown slug                                            | Returns `[]`                                              |

All four helpers are async and hit the DB; the existing `getCurrentEditionForSource` shows the pattern.

## Migrated reader tests

The eight test files that today reference `supersededById` (per [tasks.md task 7](./tasks.md#task-7-update-test-fixtures)) all need fixture rewrites. After task 7 lands they continue to assert the same user-facing behavior, but driven by registry rows instead of the dropped column.

Three of them carry load-bearing assertions worth calling out specifically:

### references.test.ts -- "older edition resolves to current"

The test at [references.test.ts:129](../../../libs/bc/study/src/references.test.ts#L129) today seeds an older PHAK row with `supersededById: PHAK_25C_ID`. Post-WP: seed two registry rows for `airboss-ref:handbooks/phak`, one with `retired_at` set (the older), one with `retired_at IS NULL` (the current). Then assert that:

1. `getCurrentEdition` returns the current row's edition label.
2. The reader's "newer edition available" path (the same logic that powers the route handler's banner -- see [tasks.md task 5e](./tasks.md#5e-three-route-handlers-under-appsstudysrcroutesapplibraryhandbook)) reads from the registry and surfaces the current edition's title.

### regulations.test.ts -- "CFR Part picks the latest edition's representative row"

The test at [regulations.test.ts:142](../../../libs/bc/study/src/regulations.test.ts#L142) seeds an older 14 CFR row with `supersededById: CFR14_REF_ID`. Post-WP: seed registry rows for `airboss-ref:regs/cfr-14`, retire the older, leave the newer current. The test asserts that `byPart` (the per-Part rep map in `regulations.ts:657`) picks the row whose `edition` matches the registry's current edition label.

### seed-references-from-manifest.test.ts -- "two-edition seed wires registry, not column"

The test at [seed-references-from-manifest.test.ts:1335-1336](../../../scripts/db/seed-references-from-manifest.test.ts#L1335-L1336) today asserts `older.supersededById === newer.id`. Post-WP it asserts:

1. `older.edition` and `newer.edition` are populated from the registry's `edition_label`.
2. `sources_registry.editions` has two rows for the slug, one with `retired_at` set.
3. There is no `supersededById` field on either row (the column is gone).

The test also covers the new manifest-vs-registry mismatch error path: a manifest with `edition: "8083-3D"` against a registry with `edition_label: "8083-3C"` fires a clear seed-time error naming both labels.

## `bun run check` guard test

Per [tasks.md task 8](./tasks.md#task-8-bun-run-check-guard-for-non-seed-writes-to-referenceedition):

1. Clean repo: `bun run check edition-cache-write-guard` passes.
2. Plant a synthetic violation: a scratch file `apps/study/src/lib/server/scratch-violation.ts` containing `await db.update(reference).set({ edition: 'violator' }).where(...)`.
3. Re-run `bun run check edition-cache-write-guard`. It fails with an error naming the file path + the `set({ edition: ... })` call site.
4. Delete the scratch file. Re-run. Passes.

The guard's allowlist is checked into the script; the test sequence above also serves as a smoke check that the allowlist is wired correctly.

## Manual walkthrough

This is the load-bearing user-visible verification. Four routes today render edition-supersession affordances by reading `reference.supersededById`. After this WP they read the registry. Walk each route, confirm the affordance still shows up correctly with two seeded editions.

### Setup (one-time per session)

1. Reset dev DB: `bun run db reset` then `bun run db push`.
2. Seed AFH 3B (older, retired) AND AFH 3C (current). The default seed today writes 3C; for the test, seed both editions. Concretely: drop a `course/references/handbooks-test-fixtures.yaml` (or extend an existing fixture) that declares both AFH editions, with 3B's `retired_at` set in the registry.
3. Run `bun run db seed`. Verify with `psql airboss -c "SELECT source_id, edition_label, retired_at FROM sources_registry.editions WHERE source_id = 'airboss-ref:handbooks/afh'"` -- expect two rows, 3B with `retired_at` set, 3C with `retired_at IS NULL`.
4. `bun run dev`. Open `http://localhost:5173`.

### Walk 1: top library handbook page

1. Navigate to `/library/handbook/afh`.
2. The "newer edition available" affordance should NOT appear (we're already on the current edition's slug).
3. Navigate to a route that explicitly resolves the 3B row -- if no such route exists today, this part of the walkthrough closes without action; the legacy 3B edition is the one that surfaces the affordance, and reaching it via URL is the test.
4. Verify the page title pulls from the registry-current row (`AFH 8083-3C`), not from a `study.reference.supersededById` walk.

### Walk 2: chapter page

1. Navigate to `/library/handbook/afh/3` (or whichever chapter exists post-seed).
2. Same affordance check as walk 1 but at chapter level.

### Walk 3: section page

1. Navigate to `/library/handbook/afh/3/01-introduction` (or whichever section).
2. Same affordance check.

### Walk 4: regulations detail

1. Navigate to a CFR part detail page (the 14 CFR reader). The route is whichever surface the regulations.ts:964 callsite feeds today.
2. The `supersededByEdition` field in the page data should pull from the registry's current row, not from a `superseded_by_id` walk.

### Walk 5: prove the kill -- grep + dev-tools

1. In the open browser, open dev tools, hit a banner-bearing page.
2. Network tab: the request to load the page should have NO underlying SQL referencing `superseded_by_id` -- visible only if Postgres logging is enabled, optional.
3. From the terminal: `grep -rn 'supersededById\|superseded_by_id' libs/ apps/ scripts/` returns zero hits in production code (test files allowed only if their fixtures include the dropped field with a clear path-to-fix; should be zero after task 7).

## Hard verification gates

Before marking the WP `signed-off`:

- [ ] `bun run check all` returns 0 errors / 0 warnings.
- [ ] `bun run check types` passes for all 5 apps.
- [ ] All four manual walks complete without console errors or hydration crashes (per CLAUDE.md, "Vitest passing is not browser-correct" -- the manual walk in a real browser is the only valid proof).
- [ ] The grep returns zero hits.
- [ ] The synthetic-violation test of the `edition-cache-write-guard` passes (proves the seed-only-writer contract has teeth, not just intent).

## Risks and mitigations

| Risk                                                                                                  | Mitigation                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dev DB has stale state from prior seeds; the test fixture flag-day fails because both editions exist  | Always `bun run db reset` before manual walkthroughs                                                                                                  |
| Browser hydration crash from a missed `@ab/sources/server` value re-export reaching the client bundle | Run [tests/e2e/browser-hydration-smoke.spec.ts](../../../tests/e2e/browser-hydration-smoke.spec.ts) on every banner-bearing route after task 5 lands. |
| Personal syllabus seed crashes on the registry-aware code path                                        | Task 6 explicitly gates the registry call on `kind IN ('acs', 'pts')` -- verify by seeding a personal syllabus fixture                                |
| Test files not surfaced by `grep` (typo in field name, dynamic property access)                       | Run `bun test` after every task; the type errors will surface anything `grep` missed                                                                  |
