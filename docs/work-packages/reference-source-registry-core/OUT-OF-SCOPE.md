---
title: 'Out of Scope: Reference source registry core'
product: platform
feature: reference-source-registry-core
type: out-of-scope
status: unread
---

# Out of Scope: Reference source registry core

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out" subsection of [spec.md](./spec.md) Scope (lines 71-81) and the "Out of Scope (resolved, not deferred)" table (lines 325-336). Phase 2 of the ADR 019 ten-phase rollout is the WP this captures; it shipped via PR #246 (per the WP git log). Most of the resolved-table rows are explicit Phase pointers in the ADR 019 ten-phase rollout -- they ship in their own phase's WP, not here -- so they're classified `Follow-on WP`. The "Out" subsection items are the boundaries Phase 2 drew between "build the registry substrate" and "everything that ingests against it or sits beside it."

## Summary

| Item                                                          | Status       | Trigger to revisit                                                        |
| ------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------- |
| Actual corpus content (CFR, handbooks, AIM, AC, irregulars)   | Follow-on WP | Phases 3, 6, 7, 8, 10 of the ADR 019 rollout                              |
| Annual diff job                                               | Follow-on WP | Phase 5 of the ADR 019 rollout (`reference-versioning-tooling`)           |
| Renderer + token substitution                                 | Follow-on WP | Phase 4 of the ADR 019 rollout (`reference-renderer-runtime`)             |
| Lesson migration tool (rewrites pre-ADR-019 lessons)          | Follow-on WP | Phase 9 of the ADR 019 rollout                                            |
| Hangar UI for non-engineer registry editing                   | Deferred     | When `apps/hangar/` revives (per revisit.md R5 + hangar revival ADR)      |
| HTTP API for external tools                                   | Rejected     | Never -- see detail below                                                 |
| Persisted lifecycle state (Postgres-backed promotion batches) | Deferred     | When promotion runs need durability across processes                      |
| Citation formatters beyond `formatCitation`                   | Follow-on WP | Phase 4 of the ADR 019 rollout (renderer owns the token vocabulary)       |
| Lesson-to-lesson reference graph                              | Deferred     | When lesson-to-lesson refs are introduced (no ADR 019 phase has them yet) |

## Actual corpus content (CFR, handbooks, AIM, AC, irregulars)

Status: Follow-on WP

What was postponed:
Per-corpus content -- the `SourceEntry` rows for each `airboss-ref:` entry in each corpus, the per-edition derivative trees, the resolver implementations that walk that tree. Phase 2's `SOURCES` constants table and `EDITIONS` map ship empty; the typed shape is the contract every later phase loads against.

Why:
Per [spec.md](./spec.md) Scope -> Out: ingestion is per-corpus and each corpus has its own ingest pipeline (XML walker for CFR, Python markdown extractor for handbooks, etc.). Building any corpus content into Phase 2 would conflate substrate construction with corpus shape decisions; the substrate is the contract every per-corpus WP loads against, not the place where content lives.

Trigger that fires the follow-on:
Each corpus has its own phase in the ADR 019 ten-phase rollout. CFR (Phase 3, `reference-cfr-ingestion-bulk`, shipped). Handbooks (Phase 6, `reference-handbook-ingestion`, shipped). AIM (Phase 7, `reference-aim-ingestion`, shipped). AC (Phase 8). Irregulars (Phase 10).

Implementation pattern when triggered:
Each corpus's WP appends entries to `SOURCES`, populates `EDITIONS`, and calls `registerCorpusResolver(resolver)` to replace the default no-op resolver with the corpus's real one. See `reference-cfr-ingestion-bulk/spec.md` and `reference-handbook-ingestion/spec.md` for the canonical patterns.

References:

- [spec.md](./spec.md) Scope -> Out
- [docs/decisions/019-reference-identifier-system/decision.md](../../decisions/019-reference-identifier-system/decision.md) §1.2 (the corpus enumeration)
- [reference-cfr-ingestion-bulk/](../reference-cfr-ingestion-bulk/) (Phase 3)
- [reference-handbook-ingestion/](../reference-handbook-ingestion/) (Phase 6)
- [reference-aim-ingestion/](../reference-aim-ingestion/) (Phase 7)

## Annual diff job

Status: Follow-on WP

What was postponed:
The annual rollover machinery -- ingest the next edition through Phase 3, hash-compare across editions, rewrite lesson `?at=` pins where content is unchanged, surface deltas where it isn't. Phase 2 ships the `promotion_batches` audit trail that Phase 5 walks; Phase 5 is the consumer.

Why:
Per [spec.md](./spec.md) Scope -> Out: annual rollover is its own contract (diffing semantics, lesson-pin rewrite policy, operator workflow) and doesn't belong inside the registry-substrate phase. Phase 2's `promotion_batches` shape is final; Phase 5 is the consumer.

Trigger that fires the follow-on:
Phase 5 of the ADR 019 rollout. Already authored as `reference-versioning-tooling` (PR #250). The first annual rollover (when 2027 publishes) is the operational trigger.

Implementation pattern when triggered:
See [reference-versioning-tooling/spec.md](../reference-versioning-tooling/spec.md). The diff job consumes Phase 2's `getEditionDistance`, `EDITIONS` map, and `promotion_batches` audit trail.

References:

- [spec.md](./spec.md) Scope -> Out
- [docs/decisions/019-reference-identifier-system/decision.md](../../decisions/019-reference-identifier-system/decision.md) §5 + Phase 5
- [reference-versioning-tooling/](../reference-versioning-tooling/)

## Renderer + token substitution

Status: Follow-on WP

What was postponed:
The render-time token substitution pipeline -- `@cite`, `@title`, `@text`, `@quote` substitution, citation chip rendering, footnote pipeline. Phase 2 exposes the per-corpus `formatCitation(entry, style)` substrate; Phase 4 is the consumer that builds the token vocabulary on top.

Why:
Per [spec.md](./spec.md) Scope -> Out: rendering and registry have different review surfaces (token substitution semantics vs registry data correctness) and different cadences. Phase 2's job is to expose `formatCitation` as a place the renderer can call; the token vocabulary belongs to the renderer's WP.

Trigger that fires the follow-on:
Phase 4 of the ADR 019 rollout. Already authored as `reference-renderer-runtime` (PR #249).

Implementation pattern when triggered:
See [reference-renderer-runtime/spec.md](../reference-renderer-runtime/spec.md). The renderer consumes Phase 2's query API (`resolveIdentifier`, `walkSupersessionChain`, `getCurrentEdition`) and the per-corpus `formatCitation` to drive substitution.

References:

- [spec.md](./spec.md) Scope -> Out
- [docs/decisions/019-reference-identifier-system/decision.md](../../decisions/019-reference-identifier-system/decision.md) Phase 4
- [reference-renderer-runtime/](../reference-renderer-runtime/)

## Lesson migration tool (rewrites pre-ADR-019 lessons)

Status: Follow-on WP

What was postponed:
A bulk migration pass over pre-ADR-019 lessons (the existing FIRC and study lessons authored before the `airboss-ref:` scheme existed) that rewrites their plain eCFR / FAA URLs into structured `airboss-ref:` references. Phase 2's `--fix` mode auto-stamps `?at=` pins on already-structured identifiers; Phase 9's migration tool is the producer of structured identifiers from legacy URLs.

Why:
Per [spec.md](./spec.md) Scope -> Out: lesson migration is a one-time bulk operation against existing content with its own concerns (URL classification heuristics, ambiguity surfacing, reviewer-in-the-loop). Phase 2 owns "make structured identifiers stamp themselves"; Phase 9 owns "produce structured identifiers from legacy URLs."

Trigger that fires the follow-on:
Phase 9 of the ADR 019 rollout. The signal is content-side: enough corpora have shipped (Phases 3, 6, 7, 8) that the migration tool can resolve most legacy URLs into structured references with low manual touch.

Implementation pattern when triggered:
A bulk pass over `course/**/*.{md,yaml}` that walks each lesson's links, classifies each URL by source (eCFR / faa.gov / aim / pcg / etc.), looks up the matching `SourceEntry` via the registry, and rewrites the link in-place to `[@cite](airboss-ref:<corpus>/<locator>?at=<edition>)`. The validator (Phase 1) gates the rewrite -- a rewrite that doesn't validate is rolled back.

References:

- [spec.md](./spec.md) Scope -> Out
- [docs/decisions/019-reference-identifier-system/decision.md](../../decisions/019-reference-identifier-system/decision.md) Phase 9
- [reference-renderer-runtime/OUT-OF-SCOPE.md](../reference-renderer-runtime/OUT-OF-SCOPE.md) "Lesson migration tool (Phase 9)" (the renderer-side analogue)

## Hangar UI for non-engineer registry editing

Status: Deferred

What was deferred:
A hangar-side surface that lets a non-engineer curate registry entries (browse, edit canonical fields, manually de-promote / re-promote, manage aliases). Phase 2 ships the registry as code-driven; all entry mutations happen through ingestion-pipeline runs or direct script invocation.

Why:
Per [spec.md](./spec.md) Scope -> Out and revisit.md R5: the `apps/hangar/` surface is dormant pending a hangar revival ADR. Building a registry-curation UI inside a dormant app is premature; the BC + lifecycle infrastructure is the right place for the engine, and the UI follows when hangar revives.

Trigger to revisit:
The `apps/hangar/` revival ADR lands AND the hangar product surface is in flight AND a non-engineer reviewer (or Joshua acting as a curator rather than as an engineer) needs to manage entries through a UI rather than through the CLI.

Implementation pattern when triggered:
Add a hangar surface under `/registry` (or whichever route the hangar revival ADR establishes). Reads pull from `SOURCES` + `EDITIONS`; writes go through the existing `recordPromotion` / `recordDePromotion` BC functions plus a hangar-authored entry-edit BC that mutates `canonical_short` / `canonical_formal` / `canonical_title`. Audit-trail integration is automatic via the lifecycle module.

References:

- [spec.md](./spec.md) Scope -> Out ("`apps/hangar/` UI for non-engineer registry editing")
- [docs/decisions/019-reference-identifier-system/revisit.md](../../decisions/019-reference-identifier-system/revisit.md) R5
- [reference-cfr-ingestion-bulk/OUT-OF-SCOPE.md](../reference-cfr-ingestion-bulk/OUT-OF-SCOPE.md) "Hangar-driven editing UI" (the corpus-side analogue)
- [reference-renderer-runtime/OUT-OF-SCOPE.md](../reference-renderer-runtime/OUT-OF-SCOPE.md) "Hangar UI for editing references / acks" (the renderer-side analogue)

## HTTP API for external tools

Status: Rejected

What was rejected:
A network-callable HTTP service that wraps the registry's query API for non-TypeScript consumers. Phase 2's external-tool integration path is "import the query API directly from `@ab/sources`" plus the JSON snapshot for non-TypeScript consumers (Python RAG, Lambda image builders).

Why:
Per [spec.md](./spec.md) Scope -> Out and ADR 019 §2.7: the registry is a code module, not a service. External TypeScript tools import `@ab/sources` directly; non-TypeScript tools consume the JSON snapshot. An HTTP layer would add operational complexity (deployment, auth, caching, rate limiting) for a use case the snapshot already covers.

A re-decision would have to clear: an external tool that genuinely cannot consume either path -- e.g., a real-time consumer that needs sub-second freshness from outside the JS runtime AND for which the snapshot's per-build cadence is structurally inadequate. No such consumer exists today.

References:

- [spec.md](./spec.md) Scope -> Out ("HTTP API for external tools")
- [docs/decisions/019-reference-identifier-system/decision.md](../../decisions/019-reference-identifier-system/decision.md) §2.7

## Persisted lifecycle state (Postgres-backed promotion batches)

Status: Deferred

What was deferred:
A Postgres-backed `promotion_batches` table. Phase 2 ships an in-memory `Map<batchId, PromotionBatch>`; the audit-trail shape (`PromotionBatch` record, `recordPromotion` / `recordDePromotion` API) is final, only the storage backend is provisional.

Why:
Per [spec.md](./spec.md) Scope -> Out: the in-memory map is sufficient when promotion runs are CLI-invoked one-at-a-time by an engineer (the current pattern). Persisting to Postgres adds schema, migrations, and query semantics for a use case that doesn't yet exist (promotion runs that span processes or need durability across restarts).

Trigger to revisit:
Real promotion runs require durability across processes -- e.g., a promotion run that spans hours needs to survive a process crash, OR a multi-user content-curation surface where multiple reviewers act on the same registry concurrently.

Implementation pattern when triggered:
Author a Postgres-backed `PromotionBatchRepository` that implements the same surface (`recordPromotion`, `recordDePromotion`, `getBatch`, `listBatches`). The `lifecycle.ts` module's API is unchanged; only the backing store swaps. Migration: dump the current in-memory batches at process exit, re-import on startup, then swap to live Postgres reads.

References:

- [spec.md](./spec.md) Scope -> Out ("Persisted lifecycle state")
- [docs/decisions/019-reference-identifier-system/decision.md](../../decisions/019-reference-identifier-system/decision.md) §2.4

## Citation formatters beyond `formatCitation`

Status: Follow-on WP

What was postponed:
The token vocabulary (`@cite`, `@title`, `@text`, `@quote`, share-card text shape, RAG citation shape, TTS spoken-form aliases) and the per-token render functions. Phase 2 exposes the per-corpus `formatCitation(entry, style)` as the substrate; Phase 4 builds the vocabulary on top.

Why:
Per [spec.md](./spec.md) Scope -> Out: the token vocabulary is render-time concern with its own review surface (output-mode semantics, accessibility, attribution rules). Phase 2's `formatCitation` is the substrate; the vocabulary lives in the renderer.

Trigger that fires the follow-on:
Phase 4 of the ADR 019 rollout. Already authored as `reference-renderer-runtime` (PR #249).

Implementation pattern when triggered:
See [reference-renderer-runtime/spec.md](../reference-renderer-runtime/spec.md) §3 (output modes). The renderer's `runCite` / `runTitle` / `runText` / `runQuote` functions call into the per-corpus resolver's `formatCitation` plus the resolver's `getDerivativeContent` / `getIndexedContent`.

References:

- [spec.md](./spec.md) Scope -> Out
- [reference-renderer-runtime/spec.md](../reference-renderer-runtime/spec.md) §3

## Lesson-to-lesson reference graph

Status: Deferred

What was deferred:
The graph that lets one lesson reference another (so `findLessonsTransitivelyCitingEntry` actually walks lesson-to-lesson edges, not just direct citations). Phase 2 ships `findLessonsTransitivelyCitingEntry` as a degenerate alias of `findLessonsCitingEntry`; the walk algorithm slot is reserved for when lesson-to-lesson refs land.

Why:
Per [spec.md](./spec.md) Scope -> Out: no ADR 019 phase introduces lesson-to-lesson references. Building the walk algorithm against a non-existent edge type would over-design a feature whose shape (how lesson-to-lesson refs are written, parsed, validated) hasn't been decided.

Trigger to revisit:
Lesson-to-lesson references are introduced -- a content-authoring decision that names the shape (e.g., `[[lesson::path/to/lesson]]`, or `airboss-ref:lessons/<id>`, or another mechanism). At that point the walk algorithm has a real edge type to traverse.

Implementation pattern when triggered:
Promote `findLessonsTransitivelyCitingEntry` from a degenerate alias to a real BFS walker. Build the lesson-to-lesson edge index alongside the existing reverse-index walk (`buildReverseIndex` in `query.ts`). The function's signature is unchanged; only the body switches from `findLessonsCitingEntry(id)` to a real graph traversal.

References:

- [spec.md](./spec.md) Scope -> Out (the `Out of Scope (resolved, not deferred)` table row "Lesson-to-lesson reference graph")
- [spec.md](./spec.md) Open Items (the `findLessonsTransitivelyCitingEntry` JSDoc note)
