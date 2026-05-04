---
title: 'Retro Correctness Review: Hangar Review Queue (Phases 1-2)'
reviewer: correctness
date: 2026-05-04
diff: main...worktree-agent-ae8eb8cb532bdfcc4
---

# Retro Correctness Review: Hangar Review Queue (Phases 1-2)

## Summary

- Files reviewed: 11 (BC primitives, schema, frontmatter writer/parser, test-plan parser, discovery, loader, constants, ids, source-pdf, runner, tests)
- Critical: 1
- Major: 3
- Minor: 6
- Nit: 2

The foundation is solid: `getOrCreateBoard` is correctly transactional, `startSession` retries narrowly on PG 23505 only, `recordStep` is idempotent on `(sessionId, stepRef)`, and resurrection clears `pinnedColumnId` only when the row was actually soft-deleted. Most spec invariants are honored. The headline finding is that the frontmatter writer documents itself as atomic but is not -- a `writeFile` interruption can truncate or corrupt a tracked spec/test-plan. The other concrete defects cluster around CRLF preservation in the writer, ENOENT detection by string match, the `reference_toc` bucket showing all TOCs (no "needs review" predicate yet -- spec gap #2 was only half-implemented), and several seeders that race to a unique violation if two boots overlap.

## Findings

### Critical

#### CR-1: `writeFrontmatterField` is not atomic despite the comment claiming it is

- **File**: `libs/bc/hangar/src/review-frontmatter.ts:36-50`
- **Problem**: The doc comment claims "either the new bytes are on disk or the original is intact -- we go through `writeFile` which on POSIX replaces the path in one syscall." That is incorrect. `fs.promises.writeFile(path, buf, 'utf8')` opens the existing path in write/truncate mode and streams the buffer; a process kill, ENOSPC, or filesystem error mid-stream truncates or partially writes the target file. There is no rename involved.
- **Why it matters**: Spec invariant: "Frontmatter writer must be ATOMIC (no partial-write that corrupts the file)." A power loss or `kill -9` during a board-drag flip (or any future automated batch flip) can leave a tracked work-package spec with a truncated header and lost body. The user is committing these files to git; partial writes are not recoverable from the BC layer.
- **Recommended fix**: Write to a sibling temp file (`writeFile(path + '.tmp.<pid>.<random>', after)` then `rename(tmp, path)`). On POSIX same-filesystem rename is atomic. Either keep the doc comment and implement it, or weaken the comment and document the partial-write window. Implementation:

  ```ts
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, after, 'utf8');
  await rename(tmp, path);
  ```

### Major

#### MA-1: `setFrontmatterField` corrupts CRLF line endings into mixed CRLF/LF

- **File**: `libs/utils/src/markdown.ts:325-345`
- **Problem**: For a CRLF-authored file, `head.split('\n')` retains a trailing `\r` on every line. The rewritten line (`lines[i] = formatted`) contains no `\r`. Re-joining with `\n` produces a file where every original line ends in `\r\n` but the rewritten/inserted frontmatter line ends in `\n` only. `parseFrontmatter` is CRLF-tolerant (covered by tests), but downstream tooling (git diff, editors, Windows shells) sees a mixed-EOL file -- and because the writer is invoked on every drag, the corruption is sticky.
- **Why it matters**: The writer is the BC's only mutation path for frontmatter; the bug fires on every drag-write to a CRLF-authored doc. There is no test coverage for CRLF inputs to `setFrontmatterField` (unlike `stripFrontmatter`, which does have one), so this regressed silently.
- **Recommended fix**: Detect the dominant EOL of the input (`md.includes('\r\n')` -> CRLF), strip `\r` from every split line before rewrite, then `lines.join(eol)` with the detected EOL. Add a CRLF round-trip test.

#### MA-2: ENOENT detection in `discoverWorkPackages` is by string match, not error code

- **File**: `libs/bc/hangar/src/review-discovery.ts:106, 111`
- **Problem**: The "missing spec.md / test-plan.md is fine" branch is gated on `tpRow.error.message.includes('ENOENT')`. The message comes from `describeError` which formats `${err.name}: ${err.message}`. Today on Node + macOS that includes `ENOENT`, but the canonical signal is `err.code === 'ENOENT'` -- the human-readable message is not part of Node's contract and varies by libuv version + locale.
- **Why it matters**: A locale shift, a different error-message format, or a Bun/Node minor that changes the readable message turns "missing test-plan" from a silent skip into a noisy `errors[]` entry. Per the spec the test-plan is optional; surfacing every WP without one as an error would flood the loader admin and rebuild the FTS index slower because `errors.length > 0` makes `reload-reviews.ts` exit non-zero (CI red).
- **Recommended fix**: In `readMarkdownItem`, capture the error code (`(err as NodeJS.ErrnoException).code`) and propagate it on `DiscoveryError`. The caller filters on `error.code !== 'ENOENT'` instead of message-substring matching.

#### MA-3: `reference_toc` bucket filter does not enforce "needs review" -- spec gap #2 only half-implemented

- **File**: `libs/bc/hangar/src/review.ts:221-225` (`DEFAULT_BUCKET_SEEDS`)
- **Problem**: Spec gap #2's recommended resolution: "emit one `reference_toc` item per `hangar.reference` row whose `verbatim` jsonb has TOC content; 'needs review' derived in the bucket filter, not the discovery rule." The discovery rule does emit one item per qualifying reference (correct), but the seeded bucket's `filterCriteria` is `{ kind: 'reference_toc' }` -- no predicate excluding refs that already have a passing session. Every reference TOC ever reviewed continues to render in "References -- TOC review" forever.
- **Why it matters**: The whole point of the "needs review" framing was to keep the bucket from showing already-reviewed TOCs. As shipped, the bucket count grows monotonically with the corpus; reviewers can't tell from the badge whether work is outstanding. This is the load-bearing UX the spec calls out for the kind.
- **Recommended fix**: Either (a) add a structured predicate to `BucketFilterCriteria` (e.g. `noPassingSession: true`) and teach the bucket-filter executor (lands in Phase 4/7) to JOIN against `review_session` to exclude items with `outcome = 'pass'`; or (b) flip `reviewStatus` on the underlying `hangar.reference` row when a session passes and filter on `reviewStatus IS NOT 'done'`. Path (a) keeps the source of truth in `review_session`; path (b) requires an extra column on `reference`. Either is fine; neither is implemented today.

### Minor

#### MI-1: `setFrontmatterField` rewrites only the first matching key occurrence

- **File**: `libs/utils/src/markdown.ts:330-340`
- **Problem**: The `for` loop breaks on the first key match (`replaced = true; break;`). If a malformed frontmatter has duplicate keys (`status: unread\n...\nstatus: reading\n`), only the first is rewritten; the second survives and `parseFrontmatter`'s "last write wins" rule means the file's effective state still equals the un-rewritten value.
- **Why it matters**: A frontmatter authored or merged into duplicate-key state will silently fail to update. The resulting file passes parse but does not reflect the requested change. There is no test for this edge case.
- **Recommended fix**: Continue past the first match, rewriting every occurrence. Or: drop subsequent occurrences after the first rewrite. Either preserves the post-condition `parseFrontmatter(setFrontmatterField(md, k, v)).entries` always contains exactly one `(k, v)`.

#### MI-2: `parseTestPlan` skips short rows but still increments `rowIndex`

- **File**: `libs/bc/hangar/src/review-test-plan.ts:71-81`
- **Problem**: When a row has fewer than 3 cells, the row is skipped (`cells.length >= 3` guard) but `rowIndex` increments anyway. Subsequent steps after a malformed row get a different stepRef than they would have had if the malformed row were absent.
- **Why it matters**: A test-plan author fixing a malformed row by removing it (or by adding the missing column) shifts the rowIndex of every subsequent row. The stepRef hash includes `rowIndex`, so all subsequent steps' refs change, invalidating prior session outcomes that the user had recorded. The current behavior is consistent under a stable file but fragile under the kind of fix-up that hits a malformed row.
- **Recommended fix**: Either (a) only increment `rowIndex` for rows the parser actually emits, so adding/removing malformed rows doesn't invalidate good steps; or (b) document explicitly that test-plan rows must always have 3+ columns and surface a parser warning otherwise. (a) is safer for the user's session history.

#### MI-3: `setFrontmatterField` quoting policy doesn't quote leading `*`/`&`/`!`/`@`/`%`/`>`/`|` (YAML reserved indicators)

- **File**: `libs/utils/src/markdown.ts:384-398` (`formatYamlScalarValue`)
- **Problem**: The needs-quote check covers colon, hash, newline, leading whitespace, single/double quotes, reserved bare values, numerics. YAML 1.1/1.2 also treats `*`, `&`, `!`, `@`, `` ` ``, `%`, `>`, `|`, `[`, `]`, `{`, `}`, `,` as reserved when they appear at the start of a value. `setFrontmatterField('---\n---', 'k', '*foo')` writes `k: *foo` which the round-trip parser happens to accept (it splits on first colon and trims), but a real YAML parser (e.g. someone running `gray-matter` or `js-yaml` on the file) would reject `*foo` as an alias reference.
- **Why it matters**: We don't use `js-yaml` today, but other tools that touch these files (gh, prettier with the YAML plugin, IDE frontmatter linters) might. The existing quote rule is permissive enough for the project; widening it to leading-indicator chars is a small belt-and-suspenders pass.
- **Recommended fix**: Add `/^[*&!@`%>|\[\]{},]/.test(value)` to the `needsQuote` disjunction.

#### MI-4: `seedDefaultColumns`, `seedReviewKinds`, `seedDefaultBuckets` race on PG 23505 if two boots run concurrently

- **File**: `libs/bc/hangar/src/review.ts:113-130, 165-176, 241-257`
- **Problem**: Each seeder follows the read-then-insert pattern: `SELECT ...; INSERT missing rows`. Between the SELECT and the INSERT another boot can also see the missing rows and insert them; the loser hits PG 23505 (unique violation on `(boardId, name)` for columns/buckets, on PK `id` for kinds). None of the seeders catch + retry like `startSession` does.
- **Why it matters**: Single-user dev today, low risk. But hangar's boot hooks (Phase 2's `apps/hangar/src/hooks.server.ts`) plus the loader's `inflight` debouncer plus `/review` page-load triggering a re-seed means two near-simultaneous requests on cold-boot can race. The error surface is opaque ("duplicate key value violates unique constraint") rather than a graceful no-op.
- **Recommended fix**: Wrap each seeder's INSERT in `.onConflictDoNothing()` (Drizzle's `onConflictDoNothing` works for both unique-name and PK collisions) -- single-statement guard, no retry loop required.

#### MI-5: Loader is non-transactional; a partial run leaves inconsistent state

- **File**: `libs/bc/hangar/src/review-loader.ts:50-101`
- **Problem**: `runLoader` upserts each item one at a time, then iterates again to soft-prune unseen items, then runs `rebuildDocsSearchIndex`. There is no enclosing `db.transaction`. A process kill mid-loader leaves the board with N-of-M items upserted, no soft-pruning, no FTS update.
- **Why it matters**: On the next run the loader recovers (it reads live items, diffs against discovery, soft-prunes the gap). The state is recoverable. But during the partial state the `/review` page renders with phantom items still pointing at deleted files and missing pins for the items that didn't get to the soft-prune phase. For the FTS index, a stale row blocks search results from updating until the next full run.
- **Recommended fix**: Wrap the item upsert + soft-prune in a single transaction so the live row set is always consistent. The FTS rebuild can stay outside the transaction (it's idempotent and large). Alternatively, document that partial runs are recoverable on next call and do nothing -- but that surrenders the spec's "loader scan keeps the cache fresh" invariant during the window.

#### MI-6: `loadReviewItems` `inflight` debouncer is not error-isolating across callers

- **File**: `libs/bc/hangar/src/review-loader.ts:36-48`
- **Problem**: `inflight = runLoader(...).finally(() => { inflight = null; })` returns one shared promise to every concurrent caller. If `runLoader` rejects (e.g. transient DB error mid-scan), every caller awaiting the inflight promise sees the same rejection and the next caller after the rejection settles starts fresh. That's correct. But the rejection state isn't logged anywhere; the `reload-reviews.ts` runner sees it via the rejected promise but a hooks.server.ts caller swallows it silently if it doesn't await.
- **Why it matters**: A boot-time loader failure is invisible unless the caller specifically handles it. Combined with MI-5, the user could see a stale board with no surface signal that the last scan failed.
- **Recommended fix**: Either log the rejection in the `.finally` (replace with `.then(...)` / `.catch(err => { console.error('loader failed', err); throw err; })` chain), or introduce a `lastLoaderResult` module-scoped state the admin page can surface.

### Nit

#### NI-1: `discoverAllItems` parses every markdown file twice

- **File**: `libs/bc/hangar/src/review-loader.ts:118-127`
- **Problem**: For each markdown file under `DOCS_SEARCH_ROOTS`, the loader calls `parseFrontmatter(text)` once for the title/frontmatter map, then `stripFrontmatter(text)` (which calls `parseFrontmatter` again) for the body. Two parses per file across thousands of files is wasted work.
- **Why it matters**: 16.5s for 4666 FTS rows in the dev smoke test; not painful today but trivially halved with no behavior change.
- **Recommended fix**: Use the body returned from the first parse: `const parsed = parseFrontmatter(text); const body = parsed.body;`.

#### NI-2: `readMarkdownItem` return type allows `{}` (the empty case) which is unreachable

- **File**: `libs/bc/hangar/src/review-discovery.ts:163-197`
- **Problem**: The signature returns `{ item: DiscoveredItem } | { error?: DiscoveryError }`. The optional `error` makes the second branch satisfiable by `{}`, even though every code path either pushes an `item` key or an `error` key. Callers guard with `'item' in row` and `else if (row.error)` which exhaust the real cases, but TS doesn't know that.
- **Why it matters**: Future maintenance hazard -- a refactor that adds a third return path (e.g. "skip silently") could land a `{}` return that compiles cleanly and silently drops files.
- **Recommended fix**: Tighten the type to a discriminated union: `{ kind: 'item'; item: DiscoveredItem } | { kind: 'error'; error: DiscoveryError }`. Or use `error: DiscoveryError | null` (non-optional) so the second branch is structurally distinct.

## Areas verified clean

- `getOrCreateBoard` transactional path is correct: insert + seed columns + seed kinds in one `db.transaction`. The early-return for an existing board calls the (idempotent) seeders without a transaction, which is fine because each seeder's INSERT is its own statement -- the only risk there is the MI-4 race, not partial-state corruption.
- `startSession` PG 23505 retry scope is correct: `isPgUniqueViolation` checks SQLSTATE `23505` only; FK violations (e.g. invalid itemId), connection drops, etc. propagate without a retry. The retry path re-fetches the open session and returns it, falling back to throwing the original error if the open session vanished between the failed insert and the re-fetch.
- Resurrection of a soft-deleted row clears `pinnedColumnId` only when `wasDeleted` is true. The conditional spread `...(wasDeleted ? { pinnedColumnId: null } : {})` does NOT touch the column when the row was already live, preserving an active user pin -- correct.
- `recordStep` idempotency on `(sessionId, stepRef)` is honored by the schema's `uniqueIndex('hangar_review_step_ref_unique_idx')` plus the BC's read-then-update-or-insert path. Saving twice flips the stored outcome and note as documented.
- `parseTestPlan` `stepRef` hashing is deterministic per `(filePath, h2, rowIndex)` and changes when any of those change -- tests cover insert-row-at-top mutation, file-path scoping, and identical content -> identical hash.
- Test-plan parser `i = j - 1` post-table cursor advance is correct: after consuming rows up through `j-1`, the outer loop's `i++` resumes at `j`, which is the first non-row line.
- `softDeleteItem` + the unique-on-`(boardId, kindId, ref)` partial index correctly allow re-insertion (or resurrection) after delete, because the partial filter is `WHERE deletedAt IS NULL`.
- `listItems` + filter chain composition over `kindIds`/`frontmatterStatus`/`reviewStatus` uses `inArray` with empty-array guards, avoiding the Drizzle "empty IN ()" SQL error.
- Schema CHECK constraints on `frontmatter_status`, `review_status`, `outcome` (session + step), `task type`, `product_area`, `kind id`, `source type`, `sync_log kind`, `sync_log outcome` all source from `@ab/constants` arrays via the `inList()` helper -- a typo in app code surfaces as a constraint violation, not a silent bad-row.
- `setFrontmatterField` correctly handles three structural cases: (a) no frontmatter -> prepend a fresh block; (b) malformed (no closing fence) -> prepend a fresh block; (c) well-formed -> rewrite-or-append. The post-condition tests cover all three.
- The frontmatter parser correctly tolerates duplicate keys via "last write wins" while preserving the original ordinal of the first occurrence.
- `loadReviewItems` `inflight` Promise sharing prevents N parallel scans on a stampede of concurrent callers (boot + page load + admin button).
