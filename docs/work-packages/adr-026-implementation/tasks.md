---
title: 'Tasks: ADR 026 implementation -- registry-canonical edition coherence'
product: platform
feature: adr-026-implementation
type: tasks
status: unread
review_status: done
---

# Tasks: ADR 026 implementation -- registry-canonical edition coherence

Single-PR build plan. Greenfield schema (no migrations) means every change lands in one cohesive PR. Tasks ordered so the working tree stays compilable at each step; the actual commits inside the PR can match the task numbering or merge as appropriate.

See [spec.md](./spec.md) for goals + non-goals, [design.md](./design.md) for the resolver API surface and browser-safety split, [test-plan.md](./test-plan.md) for verification steps.

## Task 1: ADR 026 to `accepted`

The ADR is currently `proposed`. Land the status flip + the README index entry first so subsequent tasks reference an accepted contract.

- [ ] [docs/decisions/026-edition-coherence/decision.md](../../decisions/026-edition-coherence/decision.md): flip frontmatter `status: proposed` to `status: accepted`. Update the trailing line in the file if any to record acceptance date 2026-05-09.
- [ ] [docs/decisions/README.md](../../decisions/README.md): add the ADR 026 row to the table.
- [ ] [docs/decisions/019-reference-identifier-system/amendment-2026-05-optional-edition.md](../../decisions/019-reference-identifier-system/amendment-2026-05-optional-edition.md): the existing "Lands on top of" section already references ADR 026; verify the link still resolves once 026 is accepted.

LOC: ~10. No code touched.

## Task 2: audit registry coverage for every consumed slug

Before dropping `supersededById`, confirm every slug that today appears in `study.reference` or `study.syllabus` (kind ACS/PTS) has a row in `sources_registry.editions`. A missing registry row would crash the post-WP readers ("no current edition for slug").

- [ ] Write a one-shot audit script at `scripts/audit-edition-coverage.ts` that joins `study.reference` against `sources_registry.editions` on the `airboss-ref:` URI and reports any rows without a registry counterpart. Same for `study.syllabus WHERE kind IN ('acs', 'pts')`.
- [ ] Run it against a freshly-seeded dev DB. Expect zero gaps for handbooks (the seeder writes the registry today). Investigate any gaps for CFR / ACS / regs.
- [ ] If gaps exist, patch the relevant seeder ([scripts/db/seed-references-from-manifest.ts](../../../scripts/db/seed-references-from-manifest.ts), [scripts/db/seed-references.ts](../../../scripts/db/seed-references.ts), [scripts/db/seed-syllabi.ts](../../../scripts/db/seed-syllabi.ts)) to write the registry row alongside the `study.*` row. Re-run audit. Zero gaps.
- [ ] Delete the audit script (one-shot) OR move to `scripts/audit-edition-coverage.ts` as a permanent diagnostic; prefer permanent so the next contributor can re-run it.

LOC: ~150 (audit script + zero or more seeder patches).

Definition of done: the audit script returns clean against a freshly-seeded dev DB.

## Task 3: resolver API in `@ab/sources/server`

Add the four helpers ADR 026 §6 specifies, in a new server-only file. Add the `@ab/sources/server` exports map entry. Move existing server-only edition helpers into the same barrel.

- [ ] [libs/sources/src/registry/edition-resolver.ts](../../../libs/sources/src/registry/edition-resolver.ts): four exports per [design.md §"Resolver API"](./design.md#resolver-api):

  ```typescript
  export async function getCurrentEdition(sourceId: SourceId): Promise<EditionRow | null>;
  export async function getEditionByLabel(sourceId: SourceId, label: string): Promise<EditionRow | null>;
  export async function isEditionSuperseded(sourceId: SourceId, label: string): Promise<boolean>;
  export async function listEditionsForSource(sourceId: SourceId): Promise<readonly EditionRow[]>;
  ```

  All four query `sources_registry.editions` directly via Drizzle (`db.select().from(editionsTable)`) using the existing partial index `editions_source_current_idx WHERE retired_at IS NULL`. Reuse `getCurrentEditionForSource` from [libs/sources/src/registry/editions.ts](../../../libs/sources/src/registry/editions.ts) -- it already implements `getCurrentEdition`'s semantics. Wrap it under the new name + add the other three helpers next to it.

- [ ] [libs/sources/src/server.ts](../../../libs/sources/src/server.ts) (new file): the server-only barrel. Re-exports the four helpers above. Also re-exports the existing server-only helpers callers reach via deep file import today: `getCurrentEditionForSource`, `loadEditionsFromDb`, `warmEditionsCache`, `getEditionsMapAsync`. (Do NOT re-export `getEditionsMap` from here -- it's the sync, in-memory variant called from per-corpus resolvers that ship in the browser barrel; leave it on its current import path.)
- [ ] [libs/sources/package.json](../../../libs/sources/package.json): add an `exports` map. Today the file has no `exports` field at all, so add one with three entries:
  - `"."`: `./src/index.ts` (root barrel, browser-safe, unchanged behavior)
  - `"./server"`: `./src/server.ts` (new)
  - `"./package.json"`: `./package.json`

  Mirror the structure of [libs/bc/study/package.json](../../../libs/bc/study/package.json).

- [ ] [scripts/check-browser-globals.ts](../../../scripts/check-browser-globals.ts): add `@ab/sources/server` to the `BANNED_RUNTIME_IMPORTS` set so a `.svelte` file that tries to import from it fails the check. Mirror the existing entries for `@ab/bc-study/server`.
- [ ] [libs/sources/src/registry/edition-resolver.test.ts](../../../libs/sources/src/registry/edition-resolver.test.ts) (new): unit tests for all four helpers per [test-plan.md §"Resolver API tests"](./test-plan.md#resolver-api-tests).

LOC: ~250 (resolver file + barrel + tests + package.json + check-browser-globals patch).

Definition of done: `import { getCurrentEdition } from '@ab/sources/server'` resolves; the four helpers query the registry table; unit tests pass; `bun run check` passes.

## Task 4: drop the columns from schema.ts + regenerate `0000_initial.sql`

Edit the schema directly. There are no migrations; the change is a single-file edit + regeneration.

- [ ] [libs/bc/study/src/schema.ts](../../../libs/bc/study/src/schema.ts):
  - Lines 1427-1438 (the `supersededById` column on `reference`): delete the column, the surrounding doc comment, and the `set null` reference clause.
  - Line 1446 (the `referenceDocSupersededIdx` index): delete the index.
  - Update the `reference` table doc comment (lines 1339-1352) to remove the "`superseded_by_id` self-FK lets the seed wire each older edition" sentence.
  - Lines 1996-2002 (the `supersededById` column on `syllabus`): delete the column + its doc comment.
  - Search the file for any other reference to `supersededById` or `superseded_by_id` and remove. The two columns are the only sites today; verify with `grep -n "supersededById\|superseded_by_id" libs/bc/study/src/schema.ts` after the edit returning zero hits.
- [ ] Run `bun run db generate` (or whichever script regenerates `drizzle/0000_initial.sql` from the schema -- check [package.json](../../../package.json) scripts). Commit the regenerated `0000_initial.sql`.
- [ ] Run `bun run db push` (or `bun run db reset` + `db push` -- depends on whether the dev DB has stale state) to apply the new schema to the dev DB.

LOC: ~30 schema + ~50 in regenerated `0000_initial.sql` (the column drops + index drop).

Definition of done: schema.ts has no `supersededById`; `drizzle/0000_initial.sql` regenerated; `bun run db push` against dev DB succeeds; `bun run check types` passes (will fail until task 5 is done -- see below).

## Task 5: migrate the four BC consumers + three route handlers + regulations.ts:964

After task 4 the schema-typed callers don't compile. Fix every reader. Each call site swaps `isNull(reference.supersededById)` for a resolver-driven predicate.

The full list (verified by `grep`):

### 5a. [libs/bc/study/src/references.ts](../../../libs/bc/study/src/references.ts)

- Line 126 (doc comment): rewrite from "When true, includes references whose `superseded_by_id` is set" to "When true, includes references whose registry row carries `retired_at`".
- Line 140 (`if (!options.includeSuperseded) conditions.push(isNull(reference.supersededById))`): replace with a registry-aware filter. Two implementation choices:
  - Filter post-fetch: load all rows, then call `isEditionSuperseded(sourceId, edition)` per row, drop the superseded ones. Simple but N+1.
  - Filter via subquery: build a Drizzle `notExists` subquery against `sources_registry.editions` matching `(sourceId, retired_at IS NOT NULL)`. Single query.

  Use the subquery form. Same shape as the existing `editions_source_current_idx` partial-index reads.
- Line 182 (the `WHERE documentSlug = ? AND superseded_by_id IS NULL` join): same swap.
- Line 888 (`if (row.supersededById !== null) continue;`): swap for `if (await isEditionSuperseded(sourceIdFromRef(row), row.edition)) continue;`. Verify the loop is async-friendly; if not, batch the registry probe via `listEditionsForSource` once.
- Lines 2725-2735 (the `wireSupersedeChain` helper that updates `supersededById`): delete entirely. The registry now owns the chain; the seed writes registry rows, not a `study.reference.supersededById` walk.

### 5b. [libs/bc/study/src/library-by-cert.ts](../../../libs/bc/study/src/library-by-cert.ts)

- Lines 184, 202, 236, 248: four `isNull(reference.supersededById)` predicates in queries. Each becomes a registry-aware `notExists` subquery. Build a shared helper `notSupersededInRegistry(referenceTable)` in the same file (or in `references.ts` if shared with 5a) so the predicate isn't copy-pasted four ways.
- Lines 271-284 (the doc comment + raw-SQL `WHERE r.superseded_by_id IS NULL` example): rewrite to describe the registry-aware path.

### 5c. [libs/bc/study/src/syllabi.ts](../../../libs/bc/study/src/syllabi.ts)

- Line 568 (the `set` block in `createSyllabus` writes `supersededById: input.supersededById`): delete the line + remove `supersededById` from the input type. Personal/school syllabi don't go through the registry; ACS/PTS syllabi inherit current via the registry. The `kind` discriminator already tells the caller which path to use.

### 5d. [libs/bc/study/src/regulations.ts](../../../libs/bc/study/src/regulations.ts)

- Line 663 (`if (cur.rep === null || ref.supersededById === null) cur.rep = ref;`): rewrite to "pick the row whose edition matches the registry's current edition for this slug." Concretely: pre-fetch `getCurrentEdition(sourceId)` for the slug once outside the loop, then `if (ref.edition === current.editionLabel) cur.rep = ref;`.
- Lines 964-966 (the `supersededByEdition` chain walk that calls `getReferenceById(latestRow.supersededById)`): replace with `await getCurrentEdition(sourceIdFromRef(ref))` and read `current.editionLabel` from the registry row directly.

### 5e. Three route handlers under `apps/study/src/routes/(app)/library/handbook/`

- [`[slug]/+page.server.ts:35`](../../../apps/study/src/routes/(app)/library/handbook/[slug]/+page.server.ts): `ref.supersededById ? await getReferenceById(ref.supersededById) : null` becomes `await getCurrentEdition(sourceIdFromRef(ref))` returning the edition label. The "newer edition available" affordance reads the registry row.
- [`[slug]/[chapter]/+page.server.ts:55`](../../../apps/study/src/routes/(app)/library/handbook/[slug]/[chapter]/+page.server.ts): same rewrite.
- [`[slug]/[chapter]/[section]/+page.server.ts:62`](../../../apps/study/src/routes/(app)/library/handbook/[slug]/[chapter]/[section]/+page.server.ts): same rewrite.

LOC: ~200 across the seven files.

Definition of done: `grep -rn 'supersededById\|superseded_by_id' libs/ apps/ scripts/` returns zero hits in production code (test files still match -- those land in task 7); `bun run check types` passes.

## Task 6: seed becomes the only writer of `study.reference.edition`

Make the seed populate `study.reference.edition` from `sources_registry.editions.edition_label`. A manifest-vs-registry mismatch fails the seed.

- [ ] [scripts/db/seed-references-from-manifest.ts](../../../scripts/db/seed-references-from-manifest.ts): every place that today reads `manifest.edition` and writes it to `reference.edition` needs to read `sources_registry.editions.edition_label` for the row's slug instead. The manifest's `edition` field becomes a verification probe -- if it disagrees with the registry, abort the seed with a message naming the slug + both edition labels.
- [ ] [scripts/db/seed-references.ts](../../../scripts/db/seed-references.ts): same pattern. The non-manifest seeders (CFR YAML, ACS, etc.) follow.
- [ ] [scripts/db/seed-syllabi.ts](../../../scripts/db/seed-syllabi.ts): for `kind IN ('acs', 'pts')`, read `edition` from `sources_registry.editions.edition_label`. For `kind IN ('school', 'personal')`, leave free-form (per ADR 026 §4).
- [ ] Update the `wireSupersedeChain` callers (was in `references.ts:2725-2735`, now deleted in task 5a). Any remaining reference to a `superseded_by_id`-based chain walk in seed code goes.

LOC: ~80 across the three seed scripts.

Definition of done: `bun run db reset && bun run db seed` populates `study.reference.edition` for every row from the registry; a manifest mismatch fires an explicit error.

## Task 7: update test fixtures

Eight test files reference `supersededById` today. Each needs an edit pass to remove the field from the row-shape constructors (the column is gone, so the field is gone).

- [ ] [libs/bc/study/src/references-render.test.ts](../../../libs/bc/study/src/references-render.test.ts): lines 34, 106. Remove `supersededById` from the test fixture `ReferenceRow` literals. Where the test was specifically asserting "this older row points at this newer row," migrate the assertion to seed two registry rows (older retired, newer current) and verify via `getCurrentEdition`.
- [ ] [libs/bc/study/src/library-by-cert.test.ts](../../../libs/bc/study/src/library-by-cert.test.ts): line 300 (doc-comment reference -- update prose). Search the rest of the file for `supersededById` and remove from any fixture literals.
- [ ] [libs/bc/study/src/regulations.test.ts](../../../libs/bc/study/src/regulations.test.ts): line 142 (`supersededById: CFR14_REF_ID`). Migrate the test to seed two registry editions for `cfr-14` and assert the resolver returns the current.
- [ ] [libs/bc/study/src/syllabi.test.ts](../../../libs/bc/study/src/syllabi.test.ts): lines 673, 686 (fixture `supersededById: null`). Remove the field; the column is gone.
- [ ] [libs/bc/study/src/references.test.ts](../../../libs/bc/study/src/references.test.ts): lines 129, 142, 155, 986. Same as above. The test at line 129 (`supersededById: PHAK_25C_ID`) is the canonical "older row supersedes" case -- migrate to a registry-driven setup.
- [ ] [libs/bc/study/src/library-card-projection.test.ts](../../../libs/bc/study/src/library-card-projection.test.ts): line 28. Remove from fixture.
- [ ] [scripts/db/seed-references-from-manifest.test.ts](../../../scripts/db/seed-references-from-manifest.test.ts): lines 9 (doc comment), 1335-1336 (the assertion that the older row's `supersededById` points at the newer row). The seed no longer wires `superseded_by_id`; this test now asserts the registry has two rows with the older one's `retired_at` set.

LOC: ~150 across eight test files.

Definition of done: every test file compiles, every test passes, no fixture references the dropped column.

## Task 8: `bun run check` guard for non-seed writes to `reference.edition`

Per ADR 026 §3, the seed is the only writer of `study.reference.edition`. A guard script greps for non-seed writes and fails the check.

- [ ] [scripts/lint/edition-cache-write-guard.ts](../../../scripts/lint/edition-cache-write-guard.ts) (new): walk the repo, parse every `.ts` file (or grep -- a regex over `\.set\(\s*\{[^}]*edition\s*:` is enough), exclude allowed seed paths, fail with a clear error if any other file writes to `reference.edition`. Allowed paths: `libs/bc/study/src/seeders/**`, `scripts/db/seed-references-from-manifest.ts`, `scripts/db/seed-references.ts`, `scripts/db/seed-syllabi.ts`. Anything else is a violation.

  Pattern: mirror the existing lint scripts under [scripts/lint/](../../../scripts/lint/) (e.g. `wp-frontmatter.ts`, the airboss-ref linter).

- [ ] [scripts/check.ts](../../../scripts/check.ts): wire the new guard into the check orchestrator. It runs as a parallel step alongside the other lint scripts. Step name: `edition-cache-write-guard`. It writes its output to `.cache/check/edition-cache-write-guard.{stdout,stderr,exit}` like every other step.
- [ ] Test the guard against a synthetic violation: write a one-line scratch file `apps/study/src/lib/server/scratch-violation.ts` with `await db.update(reference).set({ edition: 'x' })`, run `bun run check edition-cache-write-guard`, confirm it fails. Delete the scratch file.

LOC: ~120 (guard script + check.ts wiring).

Definition of done: the guard runs as part of `bun run check`; a synthetic violation is caught; clean repo passes.

## Task 9: manual walkthrough + test-plan execution

Per [test-plan.md](./test-plan.md), walk the four banner-bearing routes after seeding two AFH editions. Verify the registry-driven affordance.

- [ ] Reset dev DB. Run `bun run db reset && bun run db seed` so both AFH 3B (retired) and 3C (current) land in the registry.
- [ ] `bun run dev`, navigate the four routes per [test-plan.md §"Manual walkthrough"](./test-plan.md#manual-walkthrough). Confirm each renders the registry-current edition title in the "newer edition available" affordance.
- [ ] `bun run check all` -- 0 errors, 0 warnings.
- [ ] Update [docs/work/NOW.md](../../work/NOW.md) to remove this WP from active work; flip frontmatter `agent_review_status: done`.

Definition of done: all eight success-criteria boxes from [spec.md §"Success criteria"](./spec.md#success-criteria) tick.

## Out of scope -- explicitly deferred

Per ADR 026's "Out of scope -- captured for future work" section, these have defined triggers and are NOT touched in this WP. Each becomes its own WP when its trigger fires.

| Item | Trigger                                                                                                                     |
| ---- | --------------------------------------------------------------------------------------------------------------------------- |
| B    | Drop / generate `study.reference_section.airboss_ref` -- triggered by ADR 019 path-grammar evolution. Unblocked by this WP. |
| C    | Move `study.knowledge_node.references` jsonb to `content_citations`. Unblocked by this WP.                                  |
| D    | Migrate `study.scenario.regReferences` jsonb to `content_citations`. Unblocked by this WP.                                  |
| G    | CHECK enforcing "edition-sensitive locator implies edition pinned." Triggered alongside C.                                  |

This WP unblocks B / C / D by landing the resolver API. Their implementation lives in their own work packages.

## Total scope

- ~990 LOC across ~20 files
- 1 PR, no phasing
- Single greenfield schema edit (no migration plan)
- Pattern follows `@ab/bc-study/server` exactly
