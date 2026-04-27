---
title: 'Design: Reference versioning tooling'
product: cross-cutting
feature: reference-versioning-tooling
type: design
status: unread
review_status: pending
---

# Design: Reference versioning tooling

## Overview

Phase 5 ships two CLIs (`diff` and `advance`) on top of the existing `airboss-ref` script, plus a new `libs/sources/src/diff/` module that holds the pair walker, body hasher, alias resolver, diff orchestrator, and lesson rewriter. The module reuses Phase 3's normalizer and Phase 4's `parseLesson` extraction; it does not introduce new file formats, new dependencies, or new persistence layers.

The job is fundamentally a **pure function** plus a **textual rewrite**. The pure function takes the registry state on disk and emits a partition; the rewrite consumes the partition and edits markdown. Both are deterministic given fixed inputs (registry contents + lesson tree); both have small surface for tests to exercise.

## Module layout

```text
libs/sources/src/diff/
  index.ts                 public surface
  pair-walker.ts           walkEditionPairs(corpus) -> EditionPair[]
  body-hasher.ts           hashEditionBody(id, edition) -> SHA-256 hex
  alias-resolver.ts        resolveAliasOutcome(pair) -> DiffOutcome | null
  diff-job.ts              runDiffJob(args) -> DiffReport
  lesson-rewriter.ts       runRewrite(report) -> RewriteReport
  cli.ts                   runDiffCli(argv), runAdvanceCli(argv)
```

The `scripts/airboss-ref.ts` dispatcher is extended with two `case` branches that route to `runDiffCli` and `runAdvanceCli`. No new top-level script.

## Component responsibilities

### `pair-walker.ts`

```typescript
export interface EditionPair {
    readonly id: SourceId;
    readonly corpus: string;
    readonly oldEdition: EditionId;
    readonly newEdition: EditionId;
}

/** All chronological (old, new) pairs across every entry in the corpus. */
export function walkEditionPairs(corpus: string): readonly EditionPair[];

/** The latest pair only; `null` when the corpus has fewer than two ingested editions for any entry. */
export function latestEditionPair(corpus: string): EditionPair | null;
```

Reads `EDITIONS` (via `getEditionsMap()` from the registry). For each entry whose `corpus` matches, sorts the entry's editions by `published_date`, emits `(old, new)` pairs cumulatively for `i < j`. The entry's `corpus` comes from `SOURCES[id].corpus`.

Cumulative pair emission means a section with editions `[2025, 2026, 2027]` produces three pairs. The diff CLI's default behavior is to filter to `oldEdition === <prior latest>` and `newEdition === <current latest>`, so the operator's "annual rollover" run gets exactly the pairs that bridge the new ingestion. Other consumers (multi-year retro reports) get the full set.

### `body-hasher.ts`

```typescript
export function hashEditionBody(id: SourceId, edition: EditionId, opts: { readonly outRoot: string }): string | null;
```

Resolves the per-edition derivative path via the same logic as `derivative-writer.ts` (`<outRoot>/cfr-<title>/<editionDate>/<part>/<part>-<section>.md`). Reads the file, splits off the heading (first line starting with `# `), passes the body through `normalizeText` from the regs normalizer, computes SHA-256 (via `sha256` from `regs/cache.ts` or a thin re-export). Returns `null` when the file is missing.

A process-local `Map<\`${id}::${edition}\`, string>` cache prevents re-hashing inside one diff run. The cache is cleared between CLI invocations naturally (process restart).

### `alias-resolver.ts`

```typescript
export interface AliasOutcome {
    readonly kind: 'silent' | 'content-change' | 'cross-section' | 'split' | 'merge';
    readonly to: SourceId | readonly SourceId[];
}

export function resolveAliasOutcome(pair: EditionPair): AliasOutcome | null;
```

Wraps `productionRegistry.walkAliases(id, oldEdition, newEdition)`. Returns the first alias whose `from` equals `pair.id`, mapped to the outcome kind. Returns `null` when no alias applies (the section ID is unchanged across editions; the body-hash compare runs).

### `diff-job.ts`

```typescript
export interface DiffJobArgs {
    readonly corpus: string;
    readonly outRoot: string;          // matches what derivative-writer wrote
    readonly editionPair?: { readonly old: EditionId; readonly new: EditionId };
    readonly outPath?: string;         // override for `--out=`
}

export async function runDiffJob(args: DiffJobArgs): Promise<DiffReport>;
```

Algorithm:

```text
1. Walk pairs (filter by editionPair when set, else default to latest).
2. For each pair:
   a. resolveAliasOutcome -> if non-null, emit DiffOutcome with kind 'alias-*' and the AliasOutcome's `to`.
   b. else: hashEditionBody(old) + hashEditionBody(new).
      - If either is null: emit 'missing-old' or 'missing-new'.
      - If equal: emit 'auto-advance'.
      - If different: emit 'needs-review' with a unified-diff snippet (first ~10 lines).
3. Tally counts per kind.
4. Build DiffReport, write to outPath (default `data/sources-diff/<corpus>-<old>-vs-<new>-<timestamp>.json`).
5. Print summary to stdout.
```

The unified-diff snippet uses Bun's built-in tooling -- specifically a small inline myers-diff helper (already used in handbook ingestion if present, or 30-line inline implementation). No new deps.

### `lesson-rewriter.ts`

```typescript
export interface RewriteOpts {
    readonly cwd: string;             // default process.cwd()
    readonly skipGitCheck?: boolean;  // tests bypass; production CLI sets false
}

export function runRewrite(report: DiffReport, opts?: RewriteOpts): RewriteReport;
```

Algorithm:

```text
1. (production only) Refuse to run when `git status --porcelain` non-empty.
2. Build set: { id -> {old, new} } from all 'auto-advance', 'alias-silent', 'alias-merge' outcomes.
3. For each lesson root in LESSON_CONTENT_PATHS:
   a. Walk *.md files.
   b. For each file, parse via parseLesson; collect occurrences whose pin-stripped id is in the set.
   c. For each matching occurrence whose pin === outcome.old:
      - Compute the new raw URL (replace ?at=<old> with ?at=<new>).
      - Find the exact substring in the file content (occurrence.location gives the line; we substring on the raw URL).
      - Replace.
   d. If file content changed, write back with the original line ending.
4. Emit RewriteReport.
```

The rewrite is conservative: it only matches occurrences whose pin literally equals `outcome.old`. A lesson pinned at `?at=2024` is not advanced when the diff job is `2026 -> 2027`; the operator must run a separate diff for that pair if desired.

The rewriter uses `parseLesson` to find occurrences (so it inherits the parser's skip-range awareness: code fences, inline code, ref-definition lines), then operates on the raw file content for the actual substitution. This avoids the round-trip-through-AST hazard of preserving formatting.

### `cli.ts`

```typescript
export function runDiffCli(argv: readonly string[]): Promise<number>;
export function runAdvanceCli(argv: readonly string[]): Promise<number>;
```

Mirrors the existing `runFixCli` / `runSnapshotCli` shape: parse argv, validate, call `runDiffJob` / `runRewrite`, print human-readable summary, return exit code.

`--fixture-pair=<old>,<new>` is the test ergonomics path: when set, the CLI runs `runIngest` for both fixtures into a fresh in-memory registry (the registry test helpers already support this -- `__sources_internal__.setActiveTable` etc.) before running the diff. Production runs assume Phase 3 ingestion has already populated the registry on disk.

## `scripts/airboss-ref.ts` integration

```typescript
if (command === 'diff') {
    return runDiffCli(rest);
}

if (command === 'advance') {
    return runAdvanceCli(rest);
}
```

The dispatcher's `USAGE` constant grows two lines. No structural change.

## Test fixture: 2027

`tests/fixtures/cfr/title-14-2027-fixture.xml` is a 3-5 section slice. Concretely:

- `§61.3` -- body byte-identical to 2026 (auto-advance via hash equality).
- `§61.5` -- body byte-identical except a single `\r\n` -> `\n` line ending (auto-advance via normalization equality).
- `§91.1` -- body amended (one paragraph added; `needs-review`).
- `§91.103` -- renamed to `§91.103a` via a `silent` alias entry added in the test's setUp (alias-silent -> auto-advance to new id).
- `§91.149` -- still `[Reserved]` (auto-advance).

The fixture XML omits any sections we don't want to test; the in-memory registry does not require completeness. The 2026 fixture stays unchanged.

## Output report shape

```json
{
  "schemaVersion": 1,
  "corpus": "regs",
  "editionPair": { "old": "2026", "new": "2027" },
  "generatedAt": "2027-01-15T14:20:30.123Z",
  "counts": {
    "auto-advance": 12,
    "needs-review": 3,
    "alias-silent": 1,
    "alias-content": 0,
    "alias-cross": 0,
    "alias-split": 0,
    "alias-merge": 0,
    "missing-old": 0,
    "missing-new": 0
  },
  "outcomes": [
    {
      "pair": { "id": "airboss-ref:regs/cfr-14/61/3", "corpus": "regs", "oldEdition": "2026", "newEdition": "2027" },
      "kind": "auto-advance",
      "oldHash": "<hex>",
      "newHash": "<hex>"
    },
    {
      "pair": { "id": "airboss-ref:regs/cfr-14/91/1", "corpus": "regs", "oldEdition": "2026", "newEdition": "2027" },
      "kind": "needs-review",
      "oldHash": "<hex>",
      "newHash": "<hex>",
      "diffSnippet": "@@ -3,5 +3,7 @@\n (a) Except as provided ...\n+(f) New paragraph added Jan 2027.\n"
    }
  ]
}
```

## Validator row-6 round-trip test

A dedicated test ingests both 2026 and 2027 fixtures, sets the `regs` corpus's `getCurrentEdition` to `'2027'`, then validates a temp lesson containing `[@cite](airboss-ref:regs/cfr-14/91/103?at=2025)`. Asserts:

- A row-6 WARNING fires (distance is 2 -- 2027 - 2025 -- which is > 1).
- After running `runRewrite` against a synthetic auto-advance report (`2025 -> 2027`), the lesson's pin is `?at=2027`, the validator runs again, and no row-6 finding fires.

This proves the staleness machinery works end-to-end and is the closure the spec promises on the "Phase 2 stub" comment in the rollout doc.

## Failure modes

| Failure                                       | Behavior                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| Old edition's body file missing on disk       | Outcome `missing-old`; report flags but does not error out.                           |
| New edition's body file missing on disk       | Outcome `missing-new`; same as above.                                                 |
| Both editions have the section but with different entry IDs (renumbering) and no alias entry exists | Outcome `needs-review` (the body-hash compare can't run; the report row carries an explanatory note). |
| `git status --porcelain` non-empty when running `advance` | Exit code 2 with stderr message; no rewrite. Operator stashes / commits / cleans before retry. |
| Report file does not exist when running `advance --report=<path>` | Exit code 2 with stderr; no rewrite.                                                                |
| Report's `editionPair.old` does not match any lesson pins | RewriteReport reports `filesRewritten: 0`; exit 0. (Not a failure.)                                  |

## Open questions resolved before implementation

- **Does the rewriter touch backup or generated files?** No. `LESSON_CONTENT_PATHS` is the single source; we match its scope.
- **What about lessons with multiple references to the same section under different pins?** Each occurrence is evaluated independently. Only occurrences with `?at=<old>` advance.
- **Does the diff job need to handle subpart / Part overview entries?** Yes. The pair walker emits pairs for any entry in `EDITIONS`; subparts and Parts are entries. Their derivatives are very small (overview markdown only), so hash compare is cheap and meaningful.
- **What happens when the operator runs `diff` before any second edition is ingested?** The pair walker returns `[]`, the report's `outcomes` array is empty, the CLI exits 0 with a "no second edition ingested for corpus '<corpus>'" notice on stdout.
