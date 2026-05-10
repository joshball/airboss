---
title: 'Out of Scope: Reference CFR ingestion (bulk)'
product: course
feature: reference-cfr-ingestion-bulk
type: out-of-scope
status: unread
---

# Out of Scope: Reference CFR ingestion (bulk)

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out" subsection of [spec.md](./spec.md) Scope (lines 107-115) and the "Out of Scope (resolved, not deferred)" table (lines 307-317). This WP shipped via PR #247 (per the WP git log). Most of the resolved-table rows are explicit Phase pointers in the ADR 019 ten-phase rollout -- they ship in their own phase's WP, not here -- so they're classified `Follow-on WP`. The "Out" subsection items are real boundaries the WP drew at ship time and remain live.

## Summary

| Item                                                        | Status       | Trigger to revisit                                                                              |
| ----------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------- |
| Phase 4 (renderer) token substitution                       | Follow-on WP | Phase 4 of the ADR 019 rollout (`reference-renderer-runtime`)                                   |
| Phase 5 (annual diff job)                                   | Follow-on WP | Phase 5 of the ADR 019 rollout (annual edition rollover)                                        |
| Per-paragraph SourceEntries                                 | Rejected     | Never -- see detail below                                                                       |
| 49 USC (statutes corpus) ingestion                          | Deferred     | When a lesson cites a statute that isn't already in 14 CFR                                      |
| Cross-corpus supersession of CFR sections                   | Follow-on WP | Phase 10 + the ADR 016 reorganization scenario lands                                            |
| Postgres-backed indexed tier                                | Deferred     | When `sections.json` JSON-file reads become the bottleneck OR ADR 019 §2.5 phase implementation |
| A real `phase-3` reviewer identity (auth integration)       | Deferred     | When real auth integration for batch promotion is authored                                      |
| Hangar-driven editing UI for non-engineer registry curation | Deferred     | When `apps/hangar/` revives (per revisit.md R5 + hangar revival ADR)                            |

## Phase 4 (renderer) token substitution

Status: Follow-on WP

What was postponed:
Token substitution at render time -- `@cite`, `@title`, `@text`, `@quote` substitution that turns `airboss-ref:regs/cfr-14/91/103?at=2026` into rendered citations / titles / body excerpts in lesson markdown. Phase 3 ships `getDerivativeContent` and `getIndexedContent` as the substrate; the renderer is the consumer.

Why:
Per [spec.md](./spec.md) Scope -> Out: ingestion + rendering have different review surfaces (XML pipeline correctness vs render-time markdown semantics) and different cadences (per-corpus vs per-token-shape). Bundling Phase 4 into Phase 3 would conflate two distinct contracts.

Trigger that fires the follow-on:
Phase 4 of the ADR 019 ten-phase rollout. The follow-on WP is `reference-renderer-runtime` (already authored). It consumes the resolver's `getDerivativeContent` / `getIndexedContent` output to drive substitution in lesson rendering.

Implementation pattern when triggered:
See [reference-renderer-runtime/spec.md](../reference-renderer-runtime/spec.md). Substitution happens in the markdown pipeline; the resolver contract from Phase 3 is the input.

References:

- [spec.md](./spec.md) Scope -> Out
- [docs/decisions/019-reference-identifier-system/decision.md](../../decisions/019-reference-identifier-system/decision.md) Phase 4
- [reference-renderer-runtime/](../reference-renderer-runtime/)

## Phase 5 (annual diff job)

Status: Follow-on WP

What was postponed:
The annual rollover machinery -- ingest the next year's edition through Phase 3, hash-compare the two editions, and rewrite lesson `?at=` pins where the cited content has not changed (and surface diffs where it has). Phase 3 ingests one edition at a time; Phase 5 walks edition-to-edition.

Why:
Per [spec.md](./spec.md) Scope -> Out: the annual rollover is its own contract (diffing semantics, lesson-pin rewrite policy, operator workflow) and doesn't belong inside the per-edition ingestion pipeline. Phase 5 is a downstream consumer of Phase 3's idempotent re-ingest + per-section hash output.

Trigger that fires the follow-on:
Phase 5 of the ADR 019 ten-phase rollout. The first time the calendar advances past the current ingested edition (e.g., 2027 publishes), Phase 5's WP becomes the natural mover.

Implementation pattern when triggered:
Re-run Phase 3 ingestion for the new edition. Phase 5 consumes `getEditions(id)` and the per-section `body_sha256` from each edition's `sections.json` to compute per-entry diffs. Where bodies are unchanged, lesson `?at=` pins are auto-rewritten to the new edition; where bodies changed, the lesson keeps its existing pin and the diff is surfaced for review.

References:

- [spec.md](./spec.md) Scope -> Out
- [docs/decisions/019-reference-identifier-system/decision.md](../../decisions/019-reference-identifier-system/decision.md) Phase 5
- [spec.md](./spec.md) Behavior -> Idempotence (the per-section hash this consumes)

## Per-paragraph SourceEntries

Status: Rejected

What was rejected:
A `SourceEntry` per paragraph (e.g., a separate row for `airboss-ref:regs/cfr-14/91/103/b/1/i`) instead of one entry per section. Phase 3 stores section-level entries; paragraph-level identifiers parse via `parseLocator` and resolve to the section's entry; the renderer descends into the section's text at substitution time.

Why:
Per [spec.md](./spec.md) Scope -> Out and the resolved table: paragraph-level entries would explode the registry size by an order of magnitude (a typical CFR section has 5-30 paragraphs), with the same lifecycle, edition, and audit-trail overhead per entry, to support a use case (paragraph-level deep-linking) that the section-entry + renderer-descent pattern already covers. The renderer (Phase 4) handles paragraph text descent; the registry stays at section granularity.

A re-decision would have to clear: a use case where paragraph-level lifecycle / edition / audit-trail is meaningfully different from section-level (e.g., a single paragraph being deprecated while the rest of the section stays live) AND no cleaner alternative exists (such as a `paragraph_lifecycle` overlay table on the section entry).

References:

- [spec.md](./spec.md) Scope -> Out
- [spec.md](./spec.md) Out of Scope (resolved, not deferred) table
- [docs/decisions/019-reference-identifier-system/decision.md](../../decisions/019-reference-identifier-system/decision.md) §1.2 (the locator shape supports paragraph descent without per-paragraph entries)

## 49 USC (statutes corpus) ingestion

Status: Deferred

What was deferred:
Ingestion of 49 USC (United States Code, Title 49 -- Transportation) as its own corpus. ADR 019 §1.2 lists `statutes` as a separate corpus identifier; Phase 3 covers regulations only (14 CFR + selected 49 CFR Parts). No statute entries exist in the registry.

Why:
Per [spec.md](./spec.md) Scope -> Out and the resolved table: a separate corpus has a separate ingestion shape (the USC publishes via OLRC / xml.house.gov, not eCFR), separate locator parsing, separate citation formatter, separate live URL. Building two corpora at once conflates two pipelines before either is proven. With no current lesson citing 49 USC, the shape can't be designed against real use.

Trigger to revisit:
A lesson cites a statute (49 USC §X) that isn't already covered by the corresponding 14 CFR rule. The validator would surface this as an `unknown:` placeholder or a row-2 ERROR; the operator surfaces it for the statutes-corpus WP.

Implementation pattern when triggered:
Mirror the Phase 3 shape: `libs/sources/src/statutes/` directory, separate XML/HTML walker for the OLRC publication format, separate normalizer, separate `CorpusResolver`. The infrastructure (cache, derivative writer, registry, lifecycle, batch promotion) is reusable from `libs/sources/src/regs/` -- factor common helpers up if the shape converges. ADR 019 §1.2 already names `statutes` as the corpus identifier.

References:

- [spec.md](./spec.md) Scope -> Out
- [spec.md](./spec.md) Out of Scope (resolved, not deferred) table
- [docs/decisions/019-reference-identifier-system/decision.md](../../decisions/019-reference-identifier-system/decision.md) §1.2

## Cross-corpus supersession of CFR sections

Status: Follow-on WP

What was postponed:
A mechanism for one corpus to supersede an entry in another (e.g., an ICAO-aligned standard in a future `icao` corpus replacing a CFR section). Phase 3 stores in-corpus supersession via `superseded_by_id` (within `regs`); cross-corpus supersession is a richer relationship.

Why:
Per [spec.md](./spec.md) Scope -> Out and the resolved table: cross-corpus supersession is an ADR 016 reorganization scenario (Phase 10 territory). With no second corpus that supersedes CFR yet, the cross-corpus relationship has no shape to design against.

Trigger that fires the follow-on:
Phase 10 of the ADR 019 rollout AND an ADR 016 reorganization scenario where one corpus's entry replaces another's. Likely when ICAO standards are ingested as their own corpus and lessons need to express "this rule is the international equivalent of 14 CFR 91.X."

Implementation pattern when triggered:
A cross-corpus supersession table or join (separate from `superseded_by_id` which is in-corpus). The relationship is many-to-many across corpora. Lifecycle implications: when a CFR section is superseded by an ICAO standard, the CFR entry stays `accepted` (the regulation still exists) but the lesson's preferred citation may shift to the ICAO corpus.

References:

- [spec.md](./spec.md) Scope -> Out
- [spec.md](./spec.md) Out of Scope (resolved, not deferred) table
- [docs/decisions/019-reference-identifier-system/decision.md](../../decisions/019-reference-identifier-system/decision.md) Phase 10

## Postgres-backed indexed tier

Status: Deferred

What was deferred:
The Postgres-backed indexed tier per ADR 019 §2.5. Phase 3 ships an in-repo JSON file (`sections.json`) at the indexed-tier slot; the resolver's `getIndexedContent` reads from JSON. Future phases swap the read path to Postgres without touching the resolver's contract.

Why:
Per [spec.md](./spec.md) Scope -> Out and the resolved table: the JSON-file backend is sufficient for current scale (Title 14 has ~2,500 sections; the JSON loads in milliseconds). Postgres adds operational complexity (schema, migrations, indexing strategy, query semantics) that isn't justified until JSON reads become the bottleneck or a feature requires query semantics that JSON can't express (full-text search, joins across sections).

Trigger to revisit:
Either (a) JSON-file reads become measurably slow for a real consumer (the renderer or a future search surface), or (b) ADR 019 §2.5 phase implementation lands the Postgres tier as part of broader corpus query infrastructure.

Implementation pattern when triggered:
Add a Postgres-backed `getIndexedContent` implementation behind the same `CorpusResolver` interface. The JSON-file path stays as a fallback / development mode. Migration: import `sections.json` into a `regs_section` table per edition. The resolver contract is unchanged; only the read path swaps.

References:

- [spec.md](./spec.md) Scope -> Out
- [spec.md](./spec.md) Out of Scope (resolved, not deferred) table
- [docs/decisions/019-reference-identifier-system/decision.md](../../decisions/019-reference-identifier-system/decision.md) §2.5

## A real `phase-3` reviewer identity (auth integration)

Status: Deferred

What was deferred:
A real auth-integrated reviewer identity for batch promotion. ADR 019 §2.4 requires a reviewer ID for batch promotion; in this automated context the agent records the promotion under the placeholder reviewer `'phase-3-bulk-ingestion'`. The PR body documents this so the user can re-promote (or de-promote) under his own reviewer ID if he chooses.

Why:
Per [spec.md](./spec.md) Scope -> Out and the resolved table: real auth integration is a separate WP. The audit-trail shape itself (the `reviewer_id` field on the promotion record) is final; only the value source needs to swap from a placeholder string to an authenticated user identity.

Trigger to revisit:
A WP authors real auth integration for batch promotion. Likely paired with the hangar revival or a multi-user content-curation surface where multiple reviewers act on the same registry.

Implementation pattern when triggered:
Replace the constant `PHASE_3_REVIEWER_ID = 'phase-3-bulk-ingestion'` in `libs/sources/src/regs/ingest.ts` with a value sourced from the auth context. The CLI gains a `--reviewer-id=` flag (or reads from an env var when running interactively). The placeholder reviewer string can be re-promoted via `recordDePromotion` + `recordPromotion` under the new reviewer identity.

References:

- [spec.md](./spec.md) Scope -> Out
- [spec.md](./spec.md) Out of Scope (resolved, not deferred) table
- [docs/decisions/019-reference-identifier-system/decision.md](../../decisions/019-reference-identifier-system/decision.md) §2.4

## Hangar-driven editing UI for non-engineer registry curation

Status: Deferred

What was deferred:
A hangar-side surface that lets a non-engineer curate registry entries (browse, edit canonical fields, manually de-promote / re-promote, manage aliases). Phase 3 ships the registry as code-driven; all entry mutations happen through the ingestion pipeline or direct script invocation.

Why:
Per [spec.md](./spec.md) Scope -> Out and revisit.md R5: the `apps/hangar/` surface is dormant pending a hangar revival ADR. Building a registry-curation UI inside a dormant app is premature; the BC + lifecycle infrastructure is the right place for the engine, and the UI follows when hangar revives.

Trigger to revisit:
The `apps/hangar/` revival ADR lands AND the hangar product surface is in flight AND a non-engineer reviewer (or Joshua acting as a curator rather than as an engineer) needs to manage entries through a UI rather than through the CLI.

Implementation pattern when triggered:
Add a hangar surface under `/registry/regs` (or whichever route the hangar revival ADR establishes). Reads pull from `SOURCES` + `EDITIONS`; writes go through the existing `recordPromotion` / `recordDePromotion` BC functions plus a hangar-authored entry-edit BC that mutates `canonical_short` / `canonical_formal` / `canonical_title`. Audit-trail integration is automatic via the lifecycle module.

References:

- [spec.md](./spec.md) Scope -> Out ("Hangar-driven editing UI ... revisit.md R5; deferred until `apps/hangar/` revives.")
- [spec.md](./spec.md) Out of Scope (resolved, not deferred) table
- [docs/decisions/019-reference-identifier-system/revisit.md](../../decisions/019-reference-identifier-system/revisit.md) R5
