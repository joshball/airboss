---
title: 'Test Plan: Reference versioning tooling'
product: cross-cutting
feature: reference-versioning-tooling
type: test-plan
status: unread
review_status: pending
---

# Test Plan: Reference versioning tooling

## Automated coverage

| Suite                                                          | Type        | Asserts                                                                  |
| -------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| `libs/sources/src/diff/pair-walker.test.ts`                    | Unit        | Pair enumeration: empty, single, multi-edition, multi-corpus filter      |
| `libs/sources/src/diff/body-hasher.test.ts`                    | Unit        | Hash equality CRLF/LF/NFC; missing-file returns null; cache hit          |
| `libs/sources/src/diff/alias-resolver.test.ts`                 | Unit        | Five alias kinds map to expected outcome kinds; null when no alias       |
| `libs/sources/src/diff/diff-job.test.ts`                       | Integration | End-to-end against 2026 + 2027 fixtures: ingest, walk, partition, write  |
| `libs/sources/src/diff/lesson-rewriter.test.ts`                | Unit        | Rewrite single + multiple occurrences, mixed pins, idempotence, no-op    |
| `libs/sources/src/diff/cli.test.ts`                            | Unit        | Argv parsing, error paths, fixture-pair short-circuit                    |
| `libs/sources/src/diff/getEditionDistance.test.ts`             | Integration | Two-fixture ingest, distance==1, validator row-6 fires + clears post-rewrite |

## Manual test plan

The user runs these by hand before the PR merges.

### 1. WP smoke

- [ ] `bun run check` clean.
- [ ] `bun test libs/sources/` passes.
- [ ] `bun run airboss-ref --help` shows `diff` and `advance` subcommands.

### 2. Fixture-pair diff

- [ ] `bun run airboss-ref diff --fixture-pair=tests/fixtures/cfr/title-14-2026-fixture.xml,tests/fixtures/cfr/title-14-2027-fixture.xml --out=/tmp/wp5-diff.json` exits 0.
- [ ] Stdout summary lists the partition counts.
- [ ] `/tmp/wp5-diff.json` is well-formed JSON, schemaVersion 1, contains the expected outcomes for each fixture section per `design.md`.

### 3. Lesson rewriter (synthetic)

- [ ] Author a temp lesson at `course/regulations/_test-rollover.md` with `[@cite](airboss-ref:regs/cfr-14/61/3?at=2026)` in the body.
- [ ] `bun run airboss-ref advance --report=/tmp/wp5-diff.json` exits 0 (assuming clean git tree).
- [ ] The temp lesson's pin is now `?at=2027`.
- [ ] Running again exits 0 with `filesRewritten: 0`.
- [ ] `git status` shows only the lesson file changed (no other side effects).
- [ ] Delete the temp lesson; verify `bun run airboss-ref diff` no longer references it.

### 4. Dirty-tree refusal

- [ ] With unrelated edits in the working tree, `bun run airboss-ref advance --report=...` exits 2 with a stderr message naming the dirty state.

### 5. Validator round-trip

- [ ] Author a temp lesson with `?at=2025` (or whatever older edition you set up).
- [ ] `bun run check` produces a row-6 WARNING for that lesson.
- [ ] After running `advance` with a synthetic `2025 -> 2027` report, `bun run check` no longer warns.

## Performance bar

The diff job runs against the full Title 14 + 49 corpus (~2,500 sections); end-to-end (walker -> hash -> partition -> JSON write) should complete in under 10 seconds on the developer machine.

The lesson rewriter walks `LESSON_CONTENT_PATHS` (currently a small set; `course/regulations/`); end-to-end should complete in under 2 seconds for the current corpus.

These are not hard CI gates -- the corpus + lesson tree are small enough that the operation is dominated by I/O, not computation. They are sanity checks for "did anyone introduce O(N²) behavior" reviews.

## Risk surface

- **False auto-advance.** If the body hasher's normalization is too aggressive (e.g. strips meaningful punctuation), it might call two semantically-different bodies equal and silently advance pins. Mitigation: hash exactly what `normalizeText` produces -- the same normalization the validator uses for §1.5.1's identity check. The two layers stay aligned by re-using the same function.
- **Missed alias.** If the alias resolver runs first but the alias entry is malformed, the body-hash compare is skipped and the section is wrongly classified. Mitigation: alias kinds are exhaustively typed; the test suite covers all five.
- **Rewriter corrupts a lesson.** If the substring substitution accidentally matches inside a code fence, the lesson's example code changes. Mitigation: occurrences come from `parseLesson` which already skips fenced code; the substitution operates on the URL string returned by the parser, not on the raw content blindly.
- **Operator runs `advance` against a stale report.** If the registry has been re-ingested between `diff` and `advance`, the report's edition pair may no longer match the registry. Mitigation: the rewriter operates on the report's `editionPair` only; it does not consult the live registry. Stale-report reproducibility is a feature, not a bug.

## Definition of done

- All automated suites pass.
- Manual test plan items 1-5 all check off.
- `bun run check` clean.
- The PR body documents the new CLI surface, the `data/sources-diff/` output convention, and the row-6 round-trip closure.
- `docs/work/plans/adr-019-rollout.md` Phase 5 marked ✅ with PR number.
