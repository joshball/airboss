---
title: 'Retro Backend Review: Hangar Review Queue (Phases 1-2)'
reviewer: backend
date: 2026-05-04
diff: main...worktree-agent-ae8eb8cb532bdfcc4
---

# Retro Backend Review: Hangar Review Queue (Phases 1-2)

## Summary

Phase 1+2 land BC primitives, schema, frontmatter writer, test-plan parser, discovery rules, and the loader runner. No `+page.server.ts` / `+server.ts` files yet, so this review is purely BC + scripts. The BC is shaped well: every helper takes an explicit `Db` arg defaulting to the singleton, errors throw with row context, idempotent helpers (`getOrCreateBoard`, `seedDefault*`, `startSession`, `recordStep`, `upsertItem`) are explicit. Drizzle-only, no raw SQL in app code (the only `sql` usages are CHECK constraint expressions and the generated tsvector literal -- both legitimate). No `any`, no non-null assertions, all routes registered in `ROUTES`, all literals in `libs/constants/src/review.ts`.

The substantive backend gaps are around concurrency the loader and `upsertItem` don't actually defend against, plus an O(N*M) inner loop in the loader and an FTS upsert pattern that does N round-trips for ~4666 rows. Most findings are minor; one major concurrency gap.

- Files reviewed: 11 (libs/bc/hangar/src/{review,review-loader,review-discovery,review-frontmatter,review-test-plan,schema,index}.ts + tests; libs/utils/src/markdown.ts + test; libs/constants/src/{review,routes,index}.ts; scripts/db/reload-reviews.ts; libs/sources/src/source-pdf.ts)
- Critical: 0
- Major: 2
- Minor: 6
- Nit: 4

## Findings

### Critical

(none)

### Major

#### M1: `upsertItem` SELECT-then-INSERT is racy; concurrent loader callers can hit 23505

- **Location**: `libs/bc/hangar/src/review.ts:361-414`
- **Problem**: `upsertItem` does a `SELECT ... LIMIT 1` and branches into UPDATE-existing or INSERT-new with no transaction and no `onConflictDoUpdate`. Two concurrent loader runs against the same `(boardId, kindId, ref)` can both miss the existing row and both attempt INSERT; the unique partial index `hangar_review_item_ref_unique_idx` enforces uniqueness, so the loser surfaces SQLSTATE 23505 to the caller. The doc comment claims the loader's in-flight Promise singleton prevents stampede, but the singleton is in-process only; CLI scripts (e.g. `scripts/db/reload-reviews.ts`) running while the dev server is up will collide. `startSession` retries 23505 selectively; `upsertItem` does not.
- **Why it matters**: The singleton-stampede guard is local to a single Node process. A `bun scripts/db/reload-reviews.ts` while `bun dev` runs, or two concurrent admin "Refresh" clicks across a dev box + CI, will surface ugly Postgres errors instead of converging.
- **Recommended fix**: Replace the SELECT-then-branch with `db.insert(hangarReviewItem).values({...}).onConflictDoUpdate({ target: [boardId, kindId, ref], set: {...}, where: isNull(deletedAt) })` and a separate "find soft-deleted" path for resurrection. Drizzle supports composite-target `onConflictDoUpdate` over the partial unique index. Alternatively, wrap the SELECT+INSERT in a `db.transaction` and catch 23505 + retry the SELECT, mirroring `startSession`'s pattern.

#### M2: Loader composite write is not transactional; partial state is observable mid-run

- **Location**: `libs/bc/hangar/src/review-loader.ts:50-101`
- **Problem**: `runLoader` does (1) `getOrCreateBoard` (transactional only on first creation), (2) `seedDefaultBuckets`, (3) per-item `upsertItem` (one auto-commit per item), (4) per-item `softDeleteItem` (one auto-commit per item), (5) per-row FTS upsert. A reader hitting `/review` mid-run sees a partial item set: half the prunes done, half the new items in. Worse, if the loader is killed between the upsert pass and the prune pass, items that should soft-delete stay live indefinitely until the next run. The `inflight` singleton only prevents intra-process stampede, not partial visibility.
- **Why it matters**: The board's queries are not snapshot-stable. A drag-drop write that races the loader can read a bucket count, miss the new state, and write a stale `pinnedColumnId` back. The spec calls the loader idempotent but not atomic; this is the gap.
- **Recommended fix**: Wrap the item upsert + prune in a single `db.transaction` so external readers see one consistent snapshot. The FTS rebuild can stay outside (its row-by-row upsert is large and `path`-keyed; a long-held tx hurts more than the partial visibility for FTS). Alternatively, scope a `loader-running` advisory lock via Postgres `pg_advisory_lock` to serialise concurrent loader runs across processes (the `bun dev` + `scripts/db/reload-reviews.ts` collision case in M1).

### Minor

#### m1: Loader's `liveItems.find(...)` is O(N*M); should be `Map`-keyed

- **Location**: `libs/bc/hangar/src/review-loader.ts:60-91`
- **Problem**: `liveItems` is a flat array; for each discovered item the loader does `liveItems.find(row => key === ...)`. With ~190 items the inner pass is ~36k string comparisons; not catastrophic, but the same loop already builds a `Set<string>` (`seenKeys`) keyed identically -- swapping `liveItems` to a `Map<string, {id}>` is one line and removes the quadratic factor. This matters more as the WP count grows.
- **Why it matters**: Loader runtime scales with the discovered set; the spec mentions 4666 FTS rows. Once the discovered item set grows past a few hundred, the quadratic inner loop dominates.
- **Recommended fix**: `const liveByKey = new Map(liveItems.map(r => [r.kindId + ' ' + r.ref, r]));` then `liveByKey.get(key)`.

#### m2: FTS rebuild does N individual upserts -- ~4666 round-trips per scan

- **Location**: `libs/bc/hangar/src/review-loader.ts:139-153`
- **Problem**: The rebuild loops `for (const row of rows)` and issues one `INSERT ... ON CONFLICT DO UPDATE` per file. The doc comment notes "Drizzle has no batch-upsert helper that scales; loop one-by-one." This is wrong: Drizzle's `insert(...).values(arrayOfRows).onConflictDoUpdate({target, set: ...})` is supported. The 17s budget mentioned in the WP context is mostly DB round-trip latency; chunked batch upserts (500 rows/chunk) typically cut this 5-10x.
- **Why it matters**: Loader runs are admin-paced today, but called on hangar boot + on `/review` page load (per spec). 17 seconds of cold-boot wait is felt in dev.
- **Recommended fix**: Chunk `rows` (500 at a time, mirroring the existing prune-side chunking) and `db.insert(...).values(chunk).onConflictDoUpdate({target: hangarDocsSearchIndex.path, set: { title: sql\`excluded.title\`, body: sql\`excluded.body\`, frontmatter: sql\`excluded.frontmatter\` }})`. The `excluded.*` projection is the standard Drizzle pattern for batch upsert with per-row values.

#### m3: Loader's in-flight singleton ignores the `db` argument; tests using a per-test transaction collide

- **Location**: `libs/bc/hangar/src/review-loader.ts:36-48`
- **Problem**: `let inflight: Promise<...> | null` is module-scoped. If two callers pass different `db` args (e.g. a test scoped to a tx vs the live default), the second caller awaits the first's result against the wrong DB. The current tests don't exercise this, but it's a foot-gun for any future test that mocks the DB.
- **Why it matters**: Module-level mutable state shared across DB connections is the classic test-isolation hazard. Phase 3+ tests that exercise the loader against a per-test DB will see flakes that look like "the loader returned, but my row isn't in my tx".
- **Recommended fix**: Key the singleton on the DB identity (`Map<Db, Promise<...>>`), or accept that a per-test loader test creates its own scope. Document the constraint in the doc comment if you keep it.

#### m4: `discoverReferenceTocs` emits items for every reference with non-null `verbatim`, regardless of TOC content

- **Location**: `libs/bc/hangar/src/review-discovery.ts:139-154`
- **Problem**: The doc comment at top says "TOC content"; the actual filter is `verbatim IS NOT NULL`. `hangar.reference.verbatim` is the verbatim source-block jsonb, not specifically TOC-shaped. Every reference with a verbatim block becomes a `reference_toc` review item, including references that aren't TOCs. The Phase 1 review notes this as "spec gap #2" but the gap isn't bounded -- if the registry has, say, 200 references with verbatim blocks, all 200 land as items.
- **Why it matters**: The board fills with non-TOC references the reviewer cannot meaningfully spot-check. Bucket counts misrepresent work-to-do.
- **Recommended fix**: Add a discriminator. Either (a) require `verbatim ? 'toc' IS NOT NULL` to gate on a TOC-shaped block, or (b) introduce a `reference.tocReviewable` boolean / `reference_toc_status` column in the registry, or (c) defer reference_toc discovery until the verbatim shape is normalized in a follow-up WP. Pick one and write it down (currently a known-issue per CLAUDE.md "zero tolerance for known issues").

#### m5: Frontmatter writer is read-modify-write with no fsync / temp-rename atomicity

- **Location**: `libs/bc/hangar/src/review-frontmatter.ts:41-62`
- **Problem**: `writeFrontmatterField` does `readFile` -> mutate -> `writeFile`. The doc claims atomicity "in the sense that POSIX writeFile replaces the path in one syscall when same-fs" -- this is incorrect. `fs.writeFile` (Node) calls `open(O_WRONLY|O_CREAT|O_TRUNC)` then writes then closes; a process kill between the open-truncate and the close leaves the file empty (zero bytes on disk, frontmatter and body both gone). To get the atomicity the comment claims, the canonical pattern is `writeFile(tempPath); rename(tempPath, finalPath)` -- the rename is the atomic syscall, not the write.
- **Why it matters**: A SIGKILL between read and write loses the WP spec body. The board's drag-drop is the main caller; under heavy use the chance of a kill mid-write is non-zero. The spec calls out "frontmatter writer atomically updates `review_status`" as a key behavior.
- **Recommended fix**: Write to `<path>.tmp-<pid>-<ts>`, then `rename` to `<path>`. Node's `fs.rename` is atomic on POSIX same-fs renames. Update the doc comment to match. Optional: file-level lock via `proper-lockfile` if concurrent writers from multiple browser tabs become a concern.

#### m6: `getOrCreateBoard` SELECT-then-create is racy on first run

- **Location**: `libs/bc/hangar/src/review.ts:90-110`
- **Problem**: The SELECT-by-name + INSERT-if-missing happens outside a tx. Two concurrent first-run callers both see no existing row and both enter the `db.transaction` branch; the loser fails the unique index `hangar_board_name_unique_idx` with 23505. The transaction wraps the seed work but doesn't help with the existence check race.
- **Why it matters**: First-boot of the hangar app on a fresh DB with two parallel callers (e.g. a CLI script kicked off in parallel with the dev server bootstrap) surfaces a bare 23505 instead of converging.
- **Recommended fix**: Catch 23505 on the insert and retry the SELECT (mirror `startSession`). Or move the SELECT inside the transaction with `SELECT ... FOR UPDATE` + the INSERT (heavier but unambiguous). The first option is probably the least invasive.

### Nit

#### n1: `void eq;` in review-discovery.ts is dead code

- **Location**: `libs/bc/hangar/src/review-discovery.ts:34, 157`
- **Problem**: `eq` is imported from `drizzle-orm` and never used in any function body. The trailing `void eq;` is a workaround to silence the lint warning. Just drop both.
- **Recommended fix**: Remove `eq` from the import list and delete `void eq;`.

#### n2: `void notInArray;` similarly dead in loader

- **Location**: `libs/bc/hangar/src/review-loader.ts:19, 167`
- **Problem**: Same shape as n1. The comment says "Suppress unused-import warning if `notInArray` ever stops being needed" -- but it's already unused (the chunked-IN-array path uses `inArray`).
- **Recommended fix**: Delete `notInArray` from imports and the void.

#### n3: Loader dynamic-import of `node:fs/promises` inside `walkMarkdownFiles` is unnecessary

- **Location**: `libs/bc/hangar/src/review-loader.ts:171-196`
- **Problem**: `walkMarkdownFiles` does `const { readdir, stat } = await import('node:fs/promises');` inside the generator, but the file already statically imports `readFile` from the same module at line 14. The dynamic import buys nothing here -- `bc/hangar` is not in the browser-bundle allow-list, so static `node:fs/promises` is fine. The mixed pattern (static for `readFile`, dynamic for `readdir`/`stat`) is just inconsistent.
- **Recommended fix**: Hoist `readdir, stat` to the top-level import block alongside `readFile`.

#### n4: `bauthUser` cleanup in test runs serially when it could batch

- **Location**: `libs/bc/hangar/src/review.test.ts:91-92`
- **Problem**: Two `await db.delete(...)` calls for the two test users. `inArray(bauthUser.id, [TEST_USER_ID, TEST_USER_2_ID])` would be one round-trip.
- **Recommended fix**: Single `db.delete(bauthUser).where(inArray(bauthUser.id, [TEST_USER_ID, TEST_USER_2_ID]))`.

## Areas verified clean

- **Drizzle vs raw SQL**: All BC writes/reads go through Drizzle. The only raw `sql` template literals in the diff are CHECK constraint expressions in schema.ts (legitimate, sourced from `@ab/constants` enum values) and the generated tsvector expression (necessary -- Drizzle has no `setweight`/`to_tsvector` builders).
- **Routes through `ROUTES`**: All new hangar review routes (`/review`, `/review/buckets/[id]`, `/review/[kind]/[id]/walker`, `/review/admin/buckets/...`, etc.) registered as `HANGAR_REVIEW_*` constants in `libs/constants/src/routes.ts`. No inline path strings in the BC.
- **Magic strings**: `REVIEW_KIND_VALUES`, `REVIEW_OUTCOME_VALUES`, `SESSION_OUTCOME_VALUES`, `FRONTMATTER_STATUS_VALUES`, `FRONTMATTER_REVIEW_STATUS_VALUES`, `REVIEW_BOARD_DEFAULT_COLUMNS`, `TASK_TYPE_VALUES`, `PRODUCT_AREA_VALUES`, `REVIEW_BOARD_DEFAULT_NAME`, `REVIEW_LIST_HARD_CAP`, `REVIEW_SESSION_HISTORY_LIMIT`, `DOCS_SEARCH_ROOTS` -- all live in `libs/constants/src/review.ts`. Form-action ids centralised in `REVIEW_ACTIONS`.
- **Type discipline**: No `any`, no `as any`, no non-null assertions (`!`) anywhere in the new BC files.
- **ID generation**: All new IDs use `@ab/utils` `generateHangar*Id()` helpers (`brd_`, `bcol_`, `rkind_`, `rbkt_`, `ritem_`, `rses_`, `rstp_`, `task_`). No direct `nanoid()` / `ulid()` calls.
- **Default-Db arg pattern**: Every public BC function takes `db: Db = defaultDb` -- tests can pass a per-tx db cleanly.
- **Idempotency claims that hold**: `seedDefaultColumns` (filter-already-have, no-op insert when empty), `seedDefaultBuckets` (same), `seedReviewKinds` (same), `recordStep` (SELECT-by-(sessionId,stepRef), then UPDATE-or-INSERT), `startSession` (SELECT open + 23505 retry on insert), `softDeleteItem` (UPDATE deletedAt unconditionally), `deleteTask` (DELETE unconditionally), `finishSession` (UPDATE; though re-finishing overwrites timestamps -- minor cosmetic).
- **Resurrection logic**: `upsertItem` correctly detects `deletedAt !== null`, clears `pinnedColumnId` only on resurrection (not on every update), and exercises the path in test (`upsertItem resurrects a soft-deleted row and clears stale pinnedColumnId`).
- **Test-plan parser stable hashing**: `stepRef` includes filePath + section + rowIndex. Tests verify hash changes when rowIndex moves, and that two files with identical content produce different stepRefs. Sound.
- **Test-plan separator detection**: `isTableSeparator` correctly handles GFM alignment markers (`:--`, `--:`, `:--:`).
- **Frontmatter parser/writer round-trip**: `parseFrontmatter(setFrontmatterField(md, k, v)).entries` covered in tests; quote-policy + colon/numeric-looking value escapes covered.
- **Schema constraints**: CHECK constraints sourced from `@ab/constants` for every status/outcome/kind/type/product-area enum. Unique partial index on `(boardId, kindId, ref) WHERE deleted_at IS NULL` matches the loader's idempotency key. Unique partial index on `(itemId, userId) WHERE finished_at IS NULL` matches `startSession`'s contract.
- **Test coverage**: Tests exercise the upsert/update path, soft-delete + resurrect, multi-user concurrent sessions, finishSession + re-open, recordStep idempotency on (sessionId, stepRef), task CRUD, board isolation. Test-plan parser tests cover stepRef stability across renumbering and across files.
