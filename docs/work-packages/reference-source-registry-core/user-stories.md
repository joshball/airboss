---
title: 'User stories: Reference source registry core'
product: cross-cutting
feature: reference-source-registry-core
type: user-stories
status: unread
review_status: pending
---

# User stories: Reference source registry core

The Phase 2 registry serves four personas: lesson authors who want `--fix` to do the boring stamping work, Phase 3+ ingestion engineers who need a place to register a corpus, the renderer (Phase 4) that needs a typed query API, and external tools that need a JSON snapshot to consume registry data without TypeScript.

## Personas

- **Author**: a lesson writer adding `airboss-ref:` URLs. Today they hand-pin every URL with `?at=YYYY`. Phase 2 lets them write unpinned and run `bun run check --fix` to stamp.
- **Phase-3 engineer**: implementing the `regs` corpus ingestion (CFR XML walk -> `pending` entries). Needs a registration API and a lifecycle state machine.
- **Renderer (Phase 4)**: needs `resolveIdentifier`, `walkSupersessionChain`, `findEntriesByCanonicalShort` to substitute tokens at render time.
- **External tool (Python RAG, Lambda image builder)**: needs a JSON snapshot of the static + indexed tier, no Postgres connection required.
- **Reviewer**: PR reviewer reading registry-related changes; wants to see promotion-batch records and lifecycle transitions clearly.

## US-1: Author runs `--fix` to stamp pins

**As** an author,
**I want** `bun run check --fix` to auto-stamp `?at=<edition>` on my unpinned `airboss-ref:` URLs,
**so that** I don't have to type the year on every reference.

### Acceptance criteria

- I write `[@cite](airboss-ref:regs/cfr-14/91/103)` (no pin).
- I run `bun scripts/airboss-ref.ts --fix` (or `bun run check --fix` once that flag is wired).
- `--fix` looks up `getCurrentAcceptedEdition('regs')` (Phase 3+ provides a real value; Phase 2 default returns null).
- If null: file unchanged. Validator continues to emit row-1 (or row-3) ERROR. I see "0 files modified".
- If non-null (Phase 3+): file rewritten with `?at=<edition>` appended. I see "1 file modified, 1 identifier stamped". The validator on re-run reports 0 errors.
- `git diff` shows the stamp; I commit it.

### Out of scope

- Advancing stale pins. That's the diff job (Phase 5).
- Touching slug-encoded editions, malformed URLs, or unknown-corpus URLs.

## US-2: Author runs `--fix` in CI by accident

**As** the platform,
**I want** `--fix` to refuse to run in CI,
**so that** automated runs can't silently rewrite author-controlled files.

### Acceptance criteria

- A CI job inadvertently includes `--fix` in its pipeline.
- `process.env.CI === 'true'`; the script detects this.
- Exit code 2; stderr message: "--fix is local-only; CI must not write to lesson files."
- No file writes occur.

### Out of scope

- Enforcing this via something stronger than `process.env.CI`. The flag is the convention; deeper enforcement (e.g. checking for write permissions on the git worktree) is overkill.

## US-3: Phase-3 engineer registers the CFR corpus resolver

**As** the Phase-3 ingestion engineer,
**I want** a clean way to register the real CFR resolver,
**so that** Phase 2's default no-op resolver gets replaced and the validator + renderer immediately see real data.

### Acceptance criteria

- I write `class CfrResolver implements CorpusResolver { ... }` with the 7 methods from ADR 019 §2.2.
- At my ingestion module's import-time setup, I call `registerCorpusResolver(new CfrResolver())`.
- After my ingestion run populates `SOURCES`, downstream code sees:
  - `productionRegistry.isCorpusKnown('regs')` -> true (was already true via the default).
  - `productionRegistry.getCurrentAcceptedEdition('regs')` -> my resolver's value.
  - `productionRegistry.hasEntry('airboss-ref:regs/cfr-14/91/103')` -> true.
  - `query.findLessonsCitingEntry('airboss-ref:regs/cfr-14/91/103')` -> walks lessons + matches.
- No changes to the `RegistryReader` interface or to `productionRegistry`'s assembly. My resolver registration is the only new code.

### Out of scope

- The CFR ingestion pipeline itself. Phase 3.

## US-4: Phase-3 engineer runs an atomic batch promotion

**As** the Phase-3 engineer,
**I want** to promote 200 newly-ingested CFR entries from `pending` to `accepted` atomically,
**so that** half-promoted batches are forbidden and the audit trail records who promoted what when.

### Acceptance criteria

- I call `recordPromotion({ corpus: 'regs', reviewerId: 'jball', scope: [...200 SourceIds], inputSource: 'ecfr-2026-cycle-A', targetLifecycle: 'accepted' })`.
- All 200 entries' lifecycle becomes `accepted`. The function returns `{ ok: true, batch: PromotionBatch }`.
- `getBatch(returned.id)` returns the batch with reviewerId, promotionDate, scope, inputSource.
- If any of the 200 entries is in a state that doesn't allow `pending -> accepted`, the function returns `{ ok: false, error: '...' }` and **none** of the entries are mutated.

### Out of scope

- Postgres persistence. In-memory for Phase 2; durability is a future WP.

## US-5: Phase-3 engineer de-promotes a wrong entry

**As** the Phase-3 engineer,
**I want** to walk a single entry back from `accepted` to `pending` after I notice a problem,
**so that** the rest of the batch stays accepted and the audit trail records the de-promotion.

### Acceptance criteria

- After a 200-entry batch lands at `accepted`, I notice entry 73 is wrong.
- I call `recordDePromotion({ scope: [entry73], reviewerId: 'jball', inputSource: 'manual-review' })`.
- Entry 73's lifecycle becomes `pending`. The other 199 entries stay `accepted`.
- A new batch record appears with `state: 'de-promoted'` and `previousBatchId` pointing at the original promotion.
- `listBatches()` returns both records (original + de-promotion) in chronological order.

### Out of scope

- Notifying lessons that auto-stamped to the de-promoted entry. The validator's row-3 (or row-4) ERROR will fire on next `bun run check` and the author will see it; the explicit "ack chain advanced" notification is Phase 5+.

## US-6: Renderer (Phase 4) batch-resolves identifiers

**As** the Phase-4 renderer,
**I want** to call `query.resolveIdentifier(id)` for each identifier in a lesson body,
**so that** I can substitute tokens (`@cite`, `@short`, `@formal`, `@title`) without per-call DB roundtrips.

### Acceptance criteria

- I import `import * as registry from '@ab/sources/registry'`.
- I call `registry.resolveIdentifier('airboss-ref:regs/cfr-14/91/103?at=2026')` and get back a `SourceEntry` with `canonical_short: '§91.103'`, `canonical_title: 'Preflight action'`, etc.
- I call `registry.walkSupersessionChain(id)` to detect whether the entry has been superseded; the chain walk returns the full sequence.
- I call `registry.findEntriesByCanonicalShort('§91.103')` to support `@list` adjacency at render time.
- Phase 4's renderer is the consumer; Phase 2's surface is the contract.

### Out of scope

- Token substitution itself. Phase 4.
- Async indexed-content fetches (`getIndexedContent`). Phase 2 returns null from the default resolver; Phase 3+ resolvers may return real content; Phase 4 calls them.

## US-7: External tool reads the JSON snapshot

**As** an external tool (Python RAG indexer),
**I want** to read a JSON snapshot of the registry,
**so that** I don't need a TypeScript runtime or a Postgres connection.

### Acceptance criteria

- I run `bun scripts/airboss-ref.ts snapshot --out=./airboss-sources.json` as part of my deploy step.
- The file contains `{ version: 1, generatedAt: <iso>, entries: { <SourceId>: { entry, editions, currentEdition } } }`.
- I load the file in Python: `snapshot = json.load(open('airboss-sources.json'))`.
- I look up: `snapshot['entries']['airboss-ref:regs/cfr-14/91/103']['entry']['canonical_short']` -> `'§91.103'`.
- The schema is stable across Phase 2; the `version` field detects future schema drift.

### Out of scope

- HTTP API. Per ADR 019 §2.7, no HTTP surface in v3 scope.
- Snapshot transport (S3 upload, etc.). The snapshot is a file; the consumer's deploy pipeline picks it up.

## US-8: Reviewer reads the validator's row-1 output for a malformed corpus

**As** a reviewer,
**I want** to see "corpus 'not-a-corpus' is not enumerated in ADR 019 §1.2" when an author writes a typo'd corpus prefix,
**so that** I don't have to grep the ADR or the Phase 2 corpus list to figure out what they meant.

### Acceptance criteria

- An author writes `[@cite](airboss-ref:regulation/cfr-14/91/103?at=2026)` (typo: `regulation` instead of `regs`).
- `bun run check` exits non-zero with row-1 ERROR; message names the corpus and the ADR section.
- Phase 1 behavior would have been row-2 ERROR ("identifier does not resolve to a registered entry"), which is technically correct but less informative.
- The improved diagnostic comes from the validator's row-1 activation against `isCorpusKnown`.

### Out of scope

- Did-you-mean suggestions. Future enhancement; not Phase 2.

## US-9: Author runs `--fix` idempotently

**As** an author,
**I want** running `--fix` twice in a row to be a no-op on the second run,
**so that** I can run it as part of a pre-commit hook without producing diffs every time.

### Acceptance criteria

- Run 1: `bun scripts/airboss-ref.ts --fix` stamps N identifiers; reports "N stamped".
- Run 2: `bun scripts/airboss-ref.ts --fix` immediately after: 0 files modified.
- `git diff` after run 2 vs run 1 is empty.

### Out of scope

- Automatic pre-commit-hook installation. Authors set this up themselves if they want it.

## US-10: Author runs `--fix` on a file with mixed pinned + unpinned

**As** an author,
**I want** `--fix` to leave my already-pinned references alone,
**so that** I don't get unwanted changes to pins I deliberately set (including stale pins I'm tracking on purpose).

### Acceptance criteria

- A lesson has three identifiers:
  - `airboss-ref:regs/cfr-14/91/103` (unpinned)
  - `airboss-ref:regs/cfr-14/91/107?at=2024` (pinned to old edition; stale-pin WARNING expected from validator)
  - `airboss-ref:ac/61-65/j` (slug-encoded edition)
- `bun scripts/airboss-ref.ts --fix`.
- The first identifier is stamped (if `getCurrentAcceptedEdition('regs')` is non-null).
- The second is unchanged. Stale-pin WARNING continues to surface from the validator.
- The third is unchanged.

### Out of scope

- Advancing stale pins. The diff job (Phase 5) owns that.
