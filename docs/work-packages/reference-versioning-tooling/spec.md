---
title: 'Spec: Reference versioning tooling'
product: cross-cutting
feature: reference-versioning-tooling
type: spec
status: unread
review_status: pending
---

# Spec: Reference versioning tooling

Phase 5 of the 10-phase ADR 019 rollout. Lands the **annual rollover diff job** described in [ADR 019 §5](../../decisions/019-reference-identifier-system/decision.md). After Phase 5 ships, when the eCFR (or any other corpus with two ingested editions) republishes, an operator can run one command and:

1. See exactly which CFR sections changed between editions.
2. Auto-advance lesson `?at=` pins for sections whose normalized text is hash-equal across editions (mechanical no-change propagation).
3. Get a structured report of sections needing human review (sections whose text changed; the lesson author has to read the diff and decide whether the lesson's claim still holds).

Phase 5 also closes the loop on row 6 of the [§1.5 validation table](../../decisions/019-reference-identifier-system/decision.md): "pin > 1 edition older than current → WARNING." Phase 2 wired the validator call into `getEditionDistance`; Phase 3 populated `EDITIONS`; Phase 5 ships the walker that makes the warning meaningful at scale (and the tooling to clear it).

## Why this matters

Phases 1-4 made the reference system work for one edition at a time. Phase 5 is the first phase that **respects time**. Without it:

- Every January, when the eCFR republishes Title 14, the registry is stuck on last year's edition forever (no rollover machinery).
- Every lesson written against `?at=2026` slowly drifts: even when the text is unchanged, the pin gets older and older, eventually flagged as stale by row 6.
- Authors have no way to know whether a lesson's claim still applies to the new edition without reading every section by hand.
- The annual cadence promised by [ADR 019 §5](../../decisions/019-reference-identifier-system/decision.md) is a paper promise.

Phase 5 makes the rollover mechanical for the no-change case (the vast majority of CFR sections do not change year-over-year) and surfaces only the deltas to a human reviewer. It is the first phase whose value compounds across editions: each year's run uses the prior year's snapshot as its baseline.

## Success Criteria

- A `diff` subcommand on `bun run airboss-ref` walks every entry in the registry that has two or more ingested editions and emits one of three outcomes per (entry, edition-pair):
    - `auto-advance` -- normalized body hash equal across the pair; lesson pins from the older edition can move to the newer.
    - `needs-review` -- normalized body hashes differ; emits a unified diff snippet for the operator.
    - `alias-walk` -- the section ID changed across editions per `EDITIONS[*].aliases`; resolved via `walkAliases` per [§6.1](../../decisions/019-reference-identifier-system/decision.md).
- The diff job writes a JSON report to `data/sources-diff/<run-timestamp>.json` (the directory is gitignored per ADR 018 derivative rules) **and** prints a human-readable summary to stdout (counts per outcome, top-10 needs-review entries, plus the path to the report file).
- An `advance` subcommand consumes the JSON report, walks every `auto-advance` candidate, and rewrites lesson bodies in-place: `?at=<old>` becomes `?at=<new>` for every occurrence of the affected `SourceId` in `course/regulations/**/*.md` and any other lesson root in `LESSON_CONTENT_PATHS`. The rewrite is idempotent (running twice mutates nothing on the second pass).
- The `advance` command **never commits to main** and the operator is responsible for opening the PR. It does write a single commit on the current branch (or refuses to run if `git status --porcelain` is non-empty); operators run it from a fresh `chore/sources-rollover-<edition>` branch.
- `getEditionDistance` is the production implementation in `libs/sources/src/registry/index.ts` (already shipped in Phase 2). Phase 5 confirms it via integration tests against multi-edition fixtures.
- A walker function `walkEditionPairs(corpus)` in `libs/sources/src/diff/index.ts` returns every `(SourceId, oldEdition, newEdition)` triple for which both editions exist; `findAutoAdvanceCandidates(report)` and `findNeedsReviewCandidates(report)` partition the result.
- The diff job respects `EDITIONS[*].aliases` per [§6.1](../../decisions/019-reference-identifier-system/decision.md): when a section ID changes between editions, the walker uses `walkAliases` to find the correspondence; alias kinds `silent` and `content-change` are folded into the diff output (silent -> auto-advance, content-change -> needs-review), `cross-section` and `split` and `merge` are surfaced as needs-review with an explicit reason.
- A second fixture, `tests/fixtures/cfr/title-14-2027-fixture.xml`, ships in the repo with a small slice of Title 14 (3-5 sections) where some sections have unchanged text vs the 2026 fixture and others have amended text. The diff job's integration test ingests both, runs the walker, and asserts the expected partition.
- Vitest tests cover: pair walker (entries with one edition skipped, entries present in both), auto-advance partition (hash-equal cases), needs-review partition (hash-different cases), alias resolution (silent vs content-change vs cross-section), `advance` rewriter (single occurrence, multiple occurrences, mixed pins, idempotence, no-mutation when report is empty), JSON report shape, validator row-6 round-trip (lesson with two-edition-old pin produces row-6 WARNING; same lesson after `advance` produces no findings).
- `bun run check` exits 0; `bun test libs/sources/` passes; `bun run airboss-ref diff --fixture-pair=14-2026,14-2027` exits 0.
- The PR updates `docs/work/plans/adr-019-rollout.md` Phase 5 to ✅ with the merged PR number.

## Scope

### In

- `libs/sources/src/diff/` (new directory):
    - `pair-walker.ts` -- `walkEditionPairs(corpus)` plus `EditionPair` type. Walks `EDITIONS` for the corpus and emits chronologically-ordered pairs `(SourceId, oldEditionId, newEditionId)`. Pair set is cumulative: if a section has editions `[2025, 2026, 2027]`, three pairs come out -- `(2025,2026)`, `(2026,2027)`, `(2025,2027)` -- so callers can answer both "what changed last year" and "what changed in N years".
    - `body-hasher.ts` -- `hashEditionBody(id, edition)`. Reads the per-edition derivative `.md` file, runs the content through `normalizeText` from `libs/sources/src/regs/normalizer.ts` (re-exported), returns SHA-256 hex. Caches by (id, edition) so the diff loop doesn't re-hash.
    - `alias-resolver.ts` -- thin wrapper around `productionRegistry.walkAliases` that turns alias entries into structured `AliasOutcome` records (one per `(from, to, kind)`). Used by the diff loop to fold renumbering hops into the partition.
    - `diff-job.ts` -- the orchestrator. Inputs: corpus filter, optional explicit edition pair (override the default "compare last two ingested"), output path. Outputs: `DiffReport`. Calls `walkEditionPairs`, then for each pair calls `hashEditionBody` for old and new, then partitions into `auto-advance` / `needs-review` / `alias-walk`. Writes JSON to `data/sources-diff/<timestamp>.json`, prints summary to stdout.
    - `lesson-rewriter.ts` -- consumes a `DiffReport`, walks `LESSON_CONTENT_PATHS` (re-exported from `query.ts`), rewrites `?at=<old>` to `?at=<new>` for every `auto-advance` candidate. Pure file-rewriter; idempotent. Emits a `RewriteReport` (files changed, occurrences advanced, files skipped because of pin mismatch).
    - `cli.ts` -- `runDiffCli(args)` and `runAdvanceCli(args)`. Mirrors the shape of `runFixCli` / `runSnapshotCli`. Each CLI returns a numeric exit code; never throws on user-facing errors.
    - `index.ts` -- public surface. Re-exports `walkEditionPairs`, `findAutoAdvanceCandidates`, `findNeedsReviewCandidates`, `runDiffJob`, `runRewrite`, the `DiffReport` / `RewriteReport` types, and the two CLI runners.
- `scripts/airboss-ref.ts` -- extend with two new subcommands:
    - `diff [--corpus=<corpus>] [--edition-pair=<old>,<new>] [--out=<path>] [--fixture-pair=<oldFixture>,<newFixture>]`
    - `advance --report=<path>`
- `tests/fixtures/cfr/title-14-2027-fixture.xml` -- 3-5 sections from Title 14 in 2027 form. Some sections (e.g. `§61.5`) reuse the 2026 body verbatim; others (e.g. `§91.103`) ship amended text. One section gets a `silent` rename via the alias map (test infrastructure adds the alias entry to the in-memory `EDITIONS` table; the fixture itself is just XML). Sized to be tiny -- the goal is structural coverage, not breadth.
- Update `tests/fixtures/cfr/README.md` (already exists per Phase 3) with a short note describing the 2027 fixture and what it differs from 2026 in.
- `data/.gitkeep` + `data/sources-diff/.gitkeep` (so the output directory exists even with no reports). The reports themselves are gitignored per ADR 018.
- `.gitignore` line: `data/sources-diff/*.json` (operator-local artifacts).
- Vitest tests:
    - `libs/sources/src/diff/pair-walker.test.ts` -- empty registry, single-edition entries, three-edition entries; assert pair count and chronology.
    - `libs/sources/src/diff/body-hasher.test.ts` -- normalization round-trip (CRLF vs LF, NFC fold, leading whitespace), cache hits.
    - `libs/sources/src/diff/alias-resolver.test.ts` -- silent / content-change / cross-section / split / merge classification.
    - `libs/sources/src/diff/diff-job.test.ts` -- end-to-end against the two fixtures: ingest 2026, ingest 2027, run diff job, assert partition.
    - `libs/sources/src/diff/lesson-rewriter.test.ts` -- single occurrence, multiple occurrences, mixed pins (one matches old, one matches a different old; only the matching one rewrites), idempotence, no-op on empty report.
    - `libs/sources/src/diff/cli.test.ts` -- argv parsing for both CLIs, error paths (missing report, malformed `--edition-pair`, dirty git tree for `advance`).
    - `libs/sources/src/diff/getEditionDistance.test.ts` -- integration. Ingest two fixtures so a section has both 2026 and 2027 editions; assert `getEditionDistance(id, '2026') === 1` when `currentAccepted='2027'`. Prove the validator row-6 plumbing.
- `docs/work/plans/adr-019-rollout.md` -- Phase 5 row updated to ✅ with the merged PR number.

### Out

- **PR creation tooling.** `advance` writes the rewrite commit on the current branch; it does NOT call `gh pr create`. Opening the PR is the operator's job. Rationale: every annual rollover wants different review choreography (which sections to advance, whether to bundle with other content edits) and automating the PR step is premature.
- **Live eCFR API calls in tests.** All Phase 5 tests are fixture-driven. The CLI accepts `--fixture-pair` for the same reason. Live ingestion is a Phase 3 concern.
- **Notifications.** `revisit.md` R3 (Slack notify on diff job result) and R14 (digest emails for stale pins) stay deferred. Surfaces a runtime concern that the diff job's stdout already covers for the operator-run-by-hand pattern.
- **Cross-reference staleness propagation.** `revisit.md` R4 (when section X is amended, every lesson that cites a related section gets a notice) is deferred. Phase 5 only handles per-section pin advancement.
- **Multi-corpus diffing in one run.** The CLI takes a single `--corpus=` filter (default `regs`). When handbooks land in Phase 6, operators run diff per-corpus. Combining is a future ergonomics improvement, not a Phase 5 requirement.
- **Hangar UI for reviewing the needs-review report.** Future when `apps/hangar/` revives. The JSON report is structured to make a UI trivial later.
- **Postgres-backed historical edition storage.** ADR 019 §2.5 names Postgres for the indexed tier; Phase 5 reads derivatives from disk (the same path Phase 3 writes to). Migration to Postgres is a separate WP whenever the volume warrants it.

## Data Model

### `EditionPair`

```typescript
export interface EditionPair {
    readonly id: SourceId;          // pin-stripped
    readonly corpus: string;
    readonly oldEdition: EditionId;
    readonly newEdition: EditionId;
}
```

### `DiffOutcome`

```typescript
export type DiffOutcomeKind =
    | 'auto-advance'      // body hashes equal
    | 'needs-review'      // body hashes differ
    | 'alias-silent'      // EDITIONS alias kind 'silent' -> auto-advance
    | 'alias-content'     // EDITIONS alias kind 'content-change' -> needs-review
    | 'alias-cross'       // EDITIONS alias kind 'cross-section' -> needs-review (NEVER auto-advance)
    | 'alias-split'       // EDITIONS alias kind 'split' -> needs-review (author chooses target)
    | 'alias-merge'       // EDITIONS alias kind 'merge' -> auto-advance to merged target
    | 'missing-old'       // old edition's body file is missing on disk
    | 'missing-new';      // new edition's body file is missing on disk

export interface DiffOutcome {
    readonly pair: EditionPair;
    readonly kind: DiffOutcomeKind;
    readonly oldHash: string | null;
    readonly newHash: string | null;
    /** Filled when `kind === 'needs-review'` or `kind === 'alias-content'`. */
    readonly diffSnippet?: string;
    /** Filled for any alias-* kind. The `to` from the AliasEntry. */
    readonly aliasTo?: SourceId | readonly SourceId[];
}
```

### `DiffReport`

```typescript
export interface DiffReport {
    readonly schemaVersion: 1;
    readonly corpus: string;
    readonly editionPair: { readonly old: EditionId; readonly new: EditionId };
    readonly generatedAt: string;       // ISO-8601
    readonly counts: Record<DiffOutcomeKind, number>;
    readonly outcomes: readonly DiffOutcome[];
}
```

### `RewriteReport`

```typescript
export interface RewriteReport {
    readonly schemaVersion: 1;
    readonly corpus: string;
    readonly editionPair: { readonly old: EditionId; readonly new: EditionId };
    readonly filesScanned: number;
    readonly filesRewritten: number;
    readonly occurrencesAdvanced: number;
    readonly skipped: readonly { readonly file: string; readonly reason: string }[];
}
```

## Behavior

### Edition pair selection

When `--edition-pair=` is omitted, the diff job picks the most-recent two ingested editions for the corpus, in chronological order. The pair walker emits all distinct `(old, new)` pairs (cumulative); the CLI defaults to the latest two but accepts an explicit override for "diff 2025 vs 2027" workflows.

### Body hashing

The diff job's hash input is **not** the raw markdown file. It runs the file's body section (everything after the heading line) through `normalizeText` from `libs/sources/src/regs/normalizer.ts`: NFC, LF line endings, leading + trailing whitespace stripped, runs of >=3 newlines collapsed to 2. Two editions whose only difference is whitespace or line-ending style hash equal (auto-advance, no human review).

### Alias precedence

When a `(from, to)` alias exists in `EDITIONS[corpus, *].aliases` for the new edition, the alias kind dominates over the body-hash compare. Rationale: the registry author has explicitly classified this transition; the body-hash heuristic shouldn't override it.

The five alias kinds map to outcomes per [ADR 019 §6.1](../../decisions/019-reference-identifier-system/decision.md):

- `silent` -> `alias-silent` -> auto-advance
- `content-change` -> `alias-content` -> needs-review (the rewriter does NOT advance these)
- `cross-section` -> `alias-cross` -> needs-review (per §6.1, the resolver never walks past cross-section; the rewriter never advances these; the report flags them prominently)
- `split` -> `alias-split` -> needs-review (author picks which target)
- `merge` -> `alias-merge` -> auto-advance to merged target

### Lesson rewriter

`runRewrite(report)` walks `LESSON_CONTENT_PATHS`, parses each lesson via `parseLesson`, and for every occurrence whose pin-stripped `SourceId` matches an `auto-advance` (or `alias-silent` / `alias-merge`) outcome AND whose pin equals `report.editionPair.old`, rewrites the link inline.

The rewrite is **textual**: the `?at=<old>` substring of the URL is replaced with `?at=<new>`. No re-serialization of the lesson markdown; we preserve every line ending, every formatting choice, every inline anomaly the author wrote.

When the file ends up unchanged after the substitution pass (every match was at a pin different from `old`), the rewriter does not touch the file. When it does change content, it writes the new content with the same line ending the original file used.

The rewriter refuses to run when `git status --porcelain` reports non-empty in the working tree -- the operator should run it on a clean branch so the resulting commit is just the pin advances. The rewriter does NOT git-add or git-commit; the operator stages and commits manually after reviewing the diff.

### Output report

`DiffReport` is JSON, schema-versioned. The path defaults to `data/sources-diff/<corpus>-<old>-vs-<new>-<timestamp>.json`. The directory is gitignored. Stdout summary lists the count for each `DiffOutcomeKind` plus the top 10 `needs-review` entries by `canonical_short`, with a one-line diff snippet for each. The full snippets are in the JSON.

### `getEditionDistance` -- existing implementation

Phase 2 already shipped the production `getEditionDistance` in `libs/sources/src/registry/index.ts` (returns `currentIndex - pinIndex` against the `EDITIONS` map). Phase 5 does not replace it; Phase 5 confirms it via integration tests that ingest two fixtures and assert distance == 1 when the pin is the older edition. The test also asserts row-6 firing in the validator.

## CLI shape

```text
usage:
  bun run airboss-ref diff [--corpus=<corpus>] [--edition-pair=<old>,<new>] [--out=<path>] [--fixture-pair=<oldFixture>,<newFixture>]
  bun run airboss-ref advance --report=<path>
```

Examples:

```bash
# Compare the latest two ingested editions of regs; write report to default path.
bun run airboss-ref diff

# Compare two specific editions explicitly.
bun run airboss-ref diff --corpus=regs --edition-pair=2025,2027

# Run against fixture XML pair (test ergonomics; ingests both fixtures into a fresh in-memory registry first).
bun run airboss-ref diff --fixture-pair=tests/fixtures/cfr/title-14-2026-fixture.xml,tests/fixtures/cfr/title-14-2027-fixture.xml

# Apply the auto-advance subset to lesson markdown.
bun run airboss-ref advance --report=data/sources-diff/regs-2026-vs-2027-20270115T142030.json
```

## Acceptance

- ✅ All success criteria above pass.
- ✅ `bun run check` clean.
- ✅ `bun test libs/sources/diff/` passes.
- ✅ `bun run airboss-ref diff --fixture-pair=...` exits 0 with the expected partition counts on the two fixtures.
- ✅ `bun run airboss-ref advance --report=<test-report>` rewrites lesson pins idempotently.
- ✅ Validator row 6 fires when a lesson pin is two editions stale; `advance` clears it.
- ✅ `docs/work/plans/adr-019-rollout.md` Phase 5 marked ✅ with PR number.
