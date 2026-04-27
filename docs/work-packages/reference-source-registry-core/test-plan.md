---
title: 'Test plan: Reference source registry core'
product: cross-cutting
feature: reference-source-registry-core
type: test-plan
status: unread
review_status: pending
---

# Test plan: Reference source registry core

## Setup

- Phase 1 in place (validator, parser, lesson-parser, NULL_REGISTRY exported).
- This WP adds `libs/sources/src/registry/`, `fix.ts`, `snapshot.ts`, swaps the default registry in `validateReferences`, and activates row 1.
- `course/regulations/**` is the production lesson set (today: zero `airboss-ref:` URLs).
- Test fixtures under `libs/sources/src/__test_helpers__.ts` allow tests to prime `SOURCES` / `EDITIONS` / `BATCHES` for query-API integration tests.

---

## Automated (Vitest)

### Corpus resolver tests (`libs/sources/src/registry/corpus-resolver.test.ts`)

| ID | Scenario | Expected |
| --- | --- | --- |
| CR-01 | At module load, `getCorpusResolver('regs')` returns the default no-op resolver | Non-null; `getCurrentEdition()` returns null. |
| CR-02 | `isEnumeratedCorpus(c)` returns true for every corpus in `ENUMERATED_CORPORA` | True for all 14. |
| CR-03 | `isEnumeratedCorpus('not-a-corpus')` returns false | False. |
| CR-04 | `registerCorpusResolver(realResolver)` replaces the default | Subsequent `getCorpusResolver(corpus)` returns the real resolver. |
| CR-05 | Default resolver's `parseLocator('cfr-14/91/103')` returns segmented opaque shape | `{ kind: 'ok', segments: ['cfr-14', '91', '103'] }`. |
| CR-06 | Default resolver's `formatCitation(entry, 'short')` returns `entry.canonical_short` | The literal field. |
| CR-07 | Default resolver's `getEditions(id)` returns `EDITIONS.get(id) ?? []` | Empty array when EDITIONS is empty. |

### Lifecycle tests (`libs/sources/src/registry/lifecycle.test.ts`)

| ID | Scenario | Expected |
| --- | --- | --- |
| LC-01 | `getValidTransitions('draft')` | `['pending']` |
| LC-02 | `getValidTransitions('pending')` | `['accepted', 'retired']` |
| LC-03 | `getValidTransitions('accepted')` | `['retired', 'superseded', 'pending']` (de-promote) |
| LC-04 | `getValidTransitions('retired')` | `[]` (terminal) |
| LC-05 | `getValidTransitions('superseded')` | `[]` (terminal) |
| LC-06 | `recordPromotion` for a 3-entry batch (all `pending`, target `accepted`) | `ok: true`; all 3 entries' lifecycle is now `accepted`; batch in `BATCHES`. |
| LC-07 | `recordPromotion` where 1 of 3 entries is already `retired` | `ok: false` with error naming the offending entry; no entry mutated. |
| LC-08 | `recordDePromotion` from `accepted` back to `pending` | `ok: true`; `previousBatchId` recorded; entries now `pending`. |
| LC-09 | `getBatch(id)` returns the recorded batch | Matches what `recordPromotion` returned. |
| LC-10 | `listBatches()` returns all batches in insertion order | Two batches: original promotion + de-promotion. |
| LC-11 | Transition to `draft` from any non-draft state is rejected | `ok: false`. |
| LC-12 | Empty scope (zero entries) | `ok: false` with error naming "empty scope". |

### Query API tests (`libs/sources/src/registry/query.test.ts`)

| ID | Scenario | Expected |
| --- | --- | --- |
| Q-01 | `resolveIdentifier('airboss-ref:regs/cfr-14/91/103')` (entry exists) | Returns the entry. |
| Q-02 | `resolveIdentifier('airboss-ref:regs/cfr-14/91/103?at=2026')` (with pin) | Strips pin; returns same entry. |
| Q-03 | `resolveIdentifier('airboss-ref:regs/missing')` | null. |
| Q-04 | `hasEntry(id)` returns true for a known entry | True. |
| Q-05 | `getChildren('airboss-ref:regs/cfr-14/91')` | Returns one-level-deep children only (e.g. `/103`, `/107`); excludes grandchildren (`/103/b`). |
| Q-06 | `walkSupersessionChain` on a 3-entry chain | Returns the full chain. |
| Q-07 | `walkSupersessionChain` cycle protection | Detects cycle, returns visited set, doesn't infinite-loop. |
| Q-08 | `isSupersessionChainBroken` | True when a chain hop targets a missing entry. |
| Q-09 | `findEntriesByCanonicalShort('§91.103')` | Returns the entry; case-insensitive match. |
| Q-10 | `findLessonsCitingEntry` walks lessons; finds a cite | Returns the lesson's `LessonId`. |
| Q-11 | `findLessonsCitingEntry` ignores pin in the body URL | A body URL `airboss-ref:.../103?at=2026` matches a query for the same id without pin. |
| Q-12 | `findLessonsCitingMultiple([id1, id2])` | Set intersection. |
| Q-13 | `getCurrentEdition('regs')` with no resolver registered | null (default no-op). |
| Q-14 | `getCurrentEdition('regs')` after `registerCorpusResolver` with a real resolver | Returns the resolver's value. |
| Q-15 | `getEditions(id)` async resolution | Resolves to the EDITIONS map's value or `[]`. |
| Q-16 | `isPinStale(id, '2024')` when current is '2026' (distance > 1) | True. |
| Q-17 | `isPinStale(id, '2025')` when current is '2026' (distance 1) | False. |
| Q-18 | `findLessonsTransitivelyCitingEntry` degrades to direct lookup | Returns the same as `findLessonsCitingEntry`. |

### Reverse-index tests (in `query.test.ts` or `reverse-index.test.ts`)

| ID | Scenario | Expected |
| --- | --- | --- |
| RI-01 | `stripPin('airboss-ref:regs/cfr-14/91/103?at=2026')` | `'airboss-ref:regs/cfr-14/91/103'`. |
| RI-02 | `stripPin('airboss-ref:regs/cfr-14/91/103')` | unchanged. |
| RI-03 | `lessonId('course/regulations/foo/bar.md')` | `'course/regulations/foo/bar'`. |
| RI-04 | Index handles malformed-YAML lesson | Lesson contributes zero entries to index; no exception. |
| RI-05 | `clearReverseIndex()` then re-build | Index reflects current filesystem state. |

### Production registry integration tests (`libs/sources/src/registry/registry.test.ts`)

| ID | Scenario | Expected |
| --- | --- | --- |
| PR-01 | `productionRegistry.isCorpusKnown('regs')` | True (every enumerated corpus). |
| PR-02 | `productionRegistry.isCorpusKnown('not-a-corpus')` | False. |
| PR-03 | `productionRegistry.hasEntry(id)` with primed test entries | True. |
| PR-04 | `productionRegistry.getEntry(id)` strips pin | Returns the same entry whether pin is present or not. |
| PR-05 | `productionRegistry.walkSupersessionChain(id)` matches `query.walkSupersessionChain(id)` | Identical results. |

### Validator integration tests (existing `validator.test.ts` updates + new cases)

| ID | Scenario | Expected |
| --- | --- | --- |
| V1-01 | Identifier with non-enumerated corpus passed through `productionRegistry` | Row-1 ERROR ("corpus 'not-a-corpus' is not enumerated"). |
| V1-02 | Identifier with enumerated corpus + missing entry | Row-2 ERROR (entry not found). Row 1 does NOT fire because corpus is known. |
| V1-03 | Phase 1 tests that wrote `airboss-ref:badcorpus/foo` and expected row-2 | Updated expectation: row 1 fires now. |
| V1-04 | Existing fixture-registry tests (passing custom RegistryReader) | All pass unchanged. |

### `--fix` tests (`libs/sources/src/fix.test.ts`)

| ID | Scenario | Expected |
| --- | --- | --- |
| F-01 | Lesson with `[@cite](airboss-ref:regs/cfr-14/91/103)` and corpus has accepted edition `2026` | File rewritten with `?at=2026`; report says 1 file modified, 1 identifier stamped. |
| F-02 | Lesson with `[@cite](airboss-ref:regs/cfr-14/91/103?at=2025)` (already pinned) | File unchanged. |
| F-03 | Lesson with slug-encoded edition `airboss-ref:ac/61-65/j` | File unchanged. |
| F-04 | Lesson with `airboss-ref:not-a-corpus/foo` | File unchanged. |
| F-05 | Lesson with `airboss-ref:/regs/cfr-14/91/103?at=2026` (path-absolute, malformed) | File unchanged. |
| F-06 | Lesson with `airboss-ref:regs/cfr-14/91/103` inside fenced code block | File unchanged. |
| F-07 | Lesson with three unpinned identifiers | All three stamped; offsets correct. |
| F-08 | Run fix twice on the same file (idempotence) | Second run: 0 files modified. |
| F-09 | `process.env.CI === 'true'` | Exit code 2; stderr message; no file writes. |
| F-10 | Fix succeeds; re-run validator on rewritten files; no new ERRORs | Exit code 0. |
| F-11 | Bare URL `airboss-ref:.../103` (no `[...](...)`) and unpinned | Stamped (the rewriter inserts `?at=` even on bare URLs; the lesson-parser identifies them). |

### Snapshot tests (`libs/sources/src/snapshot.test.ts`)

| ID | Scenario | Expected |
| --- | --- | --- |
| S-01 | `generateSnapshot()` with empty registry | `{ version: 1, generatedAt: <iso>, entries: {} }`. |
| S-02 | `generateSnapshot()` with primed test entries | Each entry appears with full `entry`, `editions`, `currentEdition`. |
| S-03 | `writeSnapshotSync(path)` writes valid JSON | Read back via `JSON.parse`; round-trips. |
| S-04 | `runSnapshotCli([])` writes to default path `data/sources-snapshot.json` | File exists; matches schema. |
| S-05 | `runSnapshotCli(['--out=/tmp/foo.json'])` | Writes to `/tmp/foo.json`. |
| S-06 | `runSnapshotCli` with invalid arg | Exit code 2; stderr usage. |

### `check.ts` integration (`libs/sources/src/check.test.ts` updates)

| ID | Scenario | Expected |
| --- | --- | --- |
| C-PR1 | `validateReferences()` (no opts) uses `productionRegistry` by default | Row-1 fires for unknown corpora; existing C-04 still passes (no airboss-ref: URLs in regs lessons today). |
| C-PR2 | Tests that need empty-registry semantics pass `{ registry: NULL_REGISTRY }` | Continue to work as before. |

---

## Manual gates

### M-1: Initial smoke -- `bun run check` passes after the swap

1. Fresh checkout of branch.
2. Run `bun install` (no new deps; should be a no-op).
3. Run `bun run check`.
4. **Expected:** Exit 0. The "Validating reference identifiers (airboss-ref: per ADR 019)" step prints `0 references checked, 0 findings` (or similar). svelte-check (1777 files) clean.

### M-2: Insert an unknown-corpus identifier; row 1 fires

1. Edit `course/regulations/week-04-part-91-general-and-flight-rules/overview.md`. Add `[@cite](airboss-ref:not-a-corpus/foo?at=2026)`.
2. Run `bun run check`.
3. **Expected:** Non-zero exit; row-1 ERROR naming "corpus 'not-a-corpus' is not enumerated in ADR 019 §1.2".
4. Revert.

### M-3: Insert an enumerated-corpus identifier; row 2 fires (entry not in empty registry)

1. Add `[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)`.
2. Run `bun run check`.
3. **Expected:** Non-zero exit; row-2 ERROR ("identifier does not resolve to a registered entry"). Row 1 does NOT fire (regs is enumerated).
4. Revert.

### M-4: --fix is a no-op when no unpinned URLs exist

1. Run `bun scripts/airboss-ref.ts --fix`.
2. **Expected:** Exit 0; "0 files modified, 0 identifiers stamped".

### M-5: --fix stamps when corpus has accepted edition

1. Phase 2 ships with no real CFR resolver (Phase 3 ships that). To exercise this manually we register a temporary resolver in a smoke script. Skip if Phase 3 hasn't landed; the test is in F-01 (Vitest).
2. Vitest F-01 covers this fully via fixture registries; manual gate is informational.

### M-6: Snapshot round-trip

1. `bun scripts/airboss-ref.ts snapshot --out=/tmp/snap.json`.
2. `cat /tmp/snap.json`.
3. **Expected:** Valid JSON; `version: 1`, `entries: {}` (empty registry).

### M-7: --fix refuses to run in CI

1. `CI=true bun scripts/airboss-ref.ts --fix`.
2. **Expected:** Exit code 2; stderr "--fix is local-only; CI must not write to lesson files."

### M-8: Help message

1. `bun scripts/airboss-ref.ts --help`.
2. **Expected:** Usage prints; exit 0.

### M-9: Existing `course/regulations/` walk unchanged

1. `bun scripts/airboss-ref.ts`.
2. **Expected:** Exit 0; `0 references checked, 0 findings`.

### M-10: Phase 1 tests pass after row-1 update

1. `bun test libs/sources/`.
2. **Expected:** All Phase 1 tests pass (with updated expectations for cases that now hit row 1 instead of row 2). All Phase 2 tests pass.

---

## Definition of done

- All Vitest tests pass (`bun test libs/sources/`).
- All manual gates pass.
- `bun run check` exits 0 on `main` after merge.
- 1777 svelte-check files unaffected.
- The PR body references this test plan and ADR 019 §1.3 + §2 + §6.
- `docs/work/plans/adr-019-rollout.md` updated with PR link and Phase 2 marked ✅.
