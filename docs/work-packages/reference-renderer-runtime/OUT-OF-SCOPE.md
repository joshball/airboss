---
title: 'Out of Scope: Reference renderer runtime'
product: platform
feature: reference-renderer-runtime
type: out-of-scope
status: unread
---

# Out of Scope: Reference renderer runtime

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out" subsection of [spec.md](./spec.md) Scope (lines 112-124) and the "Out of Scope (resolved, not deferred)" table (lines 418-432). Phase 4 of the ADR 019 ten-phase rollout is the WP this captures. Several items are explicit references to other phases of the rollout (Phases 5, 6+, 9), and several are dependent on future apps that have not yet scaffolded (`apps/audio/`, `apps/hangar/`).

## Summary

| Item                                                          | Status       | Trigger to revisit                                                                              |
| ------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------- |
| Real PDF rasterization (Puppeteer / wkhtmltopdf)              | Deferred     | When a downstream PDF surface needs the `print` mode's HTML+footnote output                     |
| Real audio TTS pipeline (spoken-form aliases)                 | Deferred     | When `apps/audio/` is in flight AND a TTS surface consumes the renderer's `tts` mode            |
| Hangar UI for editing references / acks                       | Deferred     | When `apps/hangar/` revives (per revisit.md R5 + hangar revival ADR)                            |
| IDE language-server NOTICE-tier feedback                      | Deferred     | When per revisit.md R7 the lesson-author DX warrants editor integration                         |
| Annual diff job (Phase 5)                                     | Follow-on WP | Phase 5 of the ADR 019 rollout                                                                  |
| Lesson migration tool (Phase 9)                               | Follow-on WP | Phase 9 of the ADR 019 rollout                                                                  |
| RAG pipeline implementation                                   | Deferred     | When a RAG consumer needs embeddings + retrieval downstream of the renderer's `rag` mode        |
| Real share-card image generation                              | Deferred     | When a share-card surface (1200x630 rasterizer) is in product scope                             |
| Postgres-backed indexed tier                                  | Deferred     | When `sections.json` JSON-file reads become the bottleneck OR ADR 019 §2.5 phase implementation |
| Production lesson page integration                            | Follow-on WP | When the production lesson route shape is finalized (separate WP under `apps/study/`)           |
| `acknowledgments` ack-chain `unbroken` cycle detector         | Rejected     | Never -- see detail below                                                                       |
| `@text` / `@quote` content rendering at paragraph granularity | Follow-on WP | When a Phase-6+ resolver enhances `getIndexedContent` to descend to paragraphs                  |

## Real PDF rasterization (Puppeteer / wkhtmltopdf)

Status: Deferred

What was deferred:
A real PDF rasterizer that takes the `print` mode's HTML+footnote output and produces a downloadable PDF. Phase 4's `print` mode emits HTML-flavored footnote markup (`<sup>` markers + a trailing `<aside class="ab-ref-footnotes">` block); the actual PDF generation is downstream.

Why:
Per [spec.md](./spec.md) Scope -> Out and the resolved table: the renderer is contract-complete for a downstream PDF surface (the HTML+footnote shape is what a Puppeteer / wkhtmltopdf wrapper would consume). Building the rasterizer here would conflate "render references correctly" with "set up a PDF generation toolchain" -- the latter has its own concerns (font management, page-break logic, headless-browser deployment).

Trigger to revisit:
A product surface needs PDF export of lessons (e.g., a "download for offline study" affordance, an instructor's printable lesson handout). At that point the PDF surface consumes the renderer's `print` mode output verbatim.

Implementation pattern when triggered:
Wrap a headless browser (Puppeteer / Playwright) or a static converter (wkhtmltopdf, Prince, weasyprint). Feed the renderer's HTML output through the converter; the footnote aside becomes the PDF's footer or trailing reference list. Page-break and font-loading are the wrapper's concern; the renderer's HTML is unchanged.

References:

- [spec.md](./spec.md) Scope -> Out
- [spec.md](./spec.md) Out of Scope (resolved, not deferred) table

## Real audio TTS pipeline (spoken-form aliases)

Status: Deferred

What was deferred:
A real audio TTS pipeline for the `tts` render mode. Phase 4's `tts` mode emits a text string with the identifier removed and tokens substituted (e.g., `"Section ninety-one one-oh-three Preflight action"`); spoken-form alias generation (R2 in revisit.md) and downstream TTS engine wiring ship with `apps/audio/`.

Why:
Per [spec.md](./spec.md) Scope -> Out and the resolved table: the audio surface app is not yet scaffolded. Building TTS pipeline plumbing inside the renderer before `apps/audio/` exists would create a single-feature audio path that the audio app would later have to retrofit (or replace).

Trigger to revisit:
The `apps/audio/` app is in flight (per [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md) future-surface list) AND a TTS surface consumes the renderer's `tts` mode output. Concrete signal: a "listen to this lesson" affordance lands and needs spoken-form aliases for the regs corpus (`§91.103` -> "Section ninety-one point one-oh-three" or similar).

Implementation pattern when triggered:
Author the spoken-form alias map per corpus (R2 from revisit.md). Wire the audio app's TTS pipeline to consume the renderer's `tts` mode output. The alias map plugs into the per-corpus resolver's `formatCitation` with a new `'spoken'` style, or into a separate `getSpokenForm(id, edition)` resolver method.

References:

- [spec.md](./spec.md) Scope -> Out
- [spec.md](./spec.md) Out of Scope (resolved, not deferred) table
- [docs/decisions/019-reference-identifier-system/revisit.md](../../decisions/019-reference-identifier-system/revisit.md) R2
- [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md) audio surface row

## Hangar UI for editing references / acks

Status: Deferred

What was deferred:
A hangar-side surface that lets a content author browse, edit, or curate lesson `acknowledgments`, manage reference resolution overrides, or visualize supersession chains across the corpus. Phase 4 ships rendering only; authoring of acks happens in lesson YAML / markdown frontmatter directly.

Why:
Per [spec.md](./spec.md) Scope -> Out and revisit.md R5: the `apps/hangar/` surface is dormant pending a hangar revival ADR. Building reference / ack curation UI inside a dormant app is premature; the BC + render API is the right place for the engine, and the UI follows when hangar revives.

Trigger to revisit:
The `apps/hangar/` revival ADR lands AND the hangar product surface is in flight AND a content author (or Joshua acting as a curator) needs to manage acknowledgments through a UI rather than through frontmatter.

Implementation pattern when triggered:
Add a hangar surface under `/references` (or whichever route the hangar revival ADR establishes). Reads consume the same `extractIdentifiers` + `batchResolve` API the renderer uses. Writes update lesson frontmatter `acknowledgments` arrays through a hangar-authored editor. Validation reuses the lesson-parser surface.

References:

- [spec.md](./spec.md) Scope -> Out
- [spec.md](./spec.md) Out of Scope (resolved, not deferred) table
- [docs/decisions/019-reference-identifier-system/revisit.md](../../decisions/019-reference-identifier-system/revisit.md) R5

## IDE language-server NOTICE-tier feedback

Status: Deferred

What was deferred:
An IDE language-server integration that surfaces NOTICE-tier validator feedback (the lower-severity findings the validator emits but doesn't block on) inline in the lesson-author's editor. Phase 4 surfaces nothing in-editor; the validator runs at `bun run check` time only.

Why:
Per [spec.md](./spec.md) Scope -> Out and revisit.md R7: editor integration is a tooling-product surface with its own scope (LSP server, VSCode / Zed extension, on-save behavior). Phase 4 is render-time substitution, not author-time DX. With Joshua as the only lesson author today, the `bun run check` feedback loop is short enough that LSP integration would be over-investment.

Trigger to revisit:
Per revisit.md R7: lesson author DX warrants editor integration. Concrete signals: more than one lesson author working concurrently, or a NOTICE-tier signal that's actionable enough to warrant interrupting the author mid-line rather than at save / check time.

Implementation pattern when triggered:
Wrap the lesson-parser + validator in an LSP server (Node / Bun based). The server consumes the same `validateReferences` API the CLI uses; the editor extension (VSCode / Zed / etc.) renders the findings in-line. NOTICE-tier findings render as info-level diagnostics; ERROR-tier as error-level.

References:

- [spec.md](./spec.md) Scope -> Out
- [spec.md](./spec.md) Out of Scope (resolved, not deferred) table
- [docs/decisions/019-reference-identifier-system/revisit.md](../../decisions/019-reference-identifier-system/revisit.md) R7

## Annual diff job (Phase 5)

Status: Follow-on WP

What was postponed:
The annual diff job that walks editions, compares per-section hashes, and rewrites lesson `?at=` pins where content is unchanged. Phase 4 reads the registry; Phase 5 walks editions and rewrites pins. The two share the `@ab/sources/render` API but are separate WPs.

Why:
Per [spec.md](./spec.md) Scope -> Out and the resolved table: the annual rollover machinery is its own contract (diffing semantics, rewrite policy, operator workflow) and doesn't belong inside the per-render-call substitution pipeline. Phase 5 consumes the renderer's `extractIdentifiers` to walk every lesson's identifiers as part of the rewrite preview.

Trigger that fires the follow-on:
Phase 5 of the ADR 019 ten-phase rollout. The first time the calendar advances past the current ingested CFR edition (e.g., 2027 publishes), Phase 5's WP becomes the natural mover.

Implementation pattern when triggered:
See the Phase 5 WP (when authored). Walks `extractIdentifiers` across every lesson, calls `batchResolve` per lesson, hash-compares each identifier's current vs new edition content via the per-corpus resolver's `getIndexedContent`. Where unchanged, rewrites the lesson pin to the new edition; where changed, surfaces the diff for review.

References:

- [spec.md](./spec.md) Scope -> Out
- [spec.md](./spec.md) Out of Scope (resolved, not deferred) table
- [reference-cfr-ingestion-bulk/OUT-OF-SCOPE.md](../reference-cfr-ingestion-bulk/OUT-OF-SCOPE.md) "Phase 5 (annual diff job)" (the same follow-on from the corpus-side perspective)

## Lesson migration tool (Phase 9)

Status: Follow-on WP

What was postponed:
A migration tool that walks pre-ADR-019 lessons (the existing FIRC and study lessons authored before the `airboss-ref:` scheme existed) and rewrites their plain eCFR / FAA URLs into structured `airboss-ref:` references. Phase 4 makes existing `airboss-ref:` references render correctly; Phase 9 produces them from legacy lessons.

Why:
Per [spec.md](./spec.md) Scope -> Out and the resolved table: lesson migration is a one-time bulk operation against existing content; the renderer is the consumer of its output, not the producer. Bundling migration into Phase 4 would conflate "render references right" with "rewrite every existing lesson." The two have different review surfaces (render correctness vs migration heuristics quality) and different cadences (per-render vs one-shot bulk).

Trigger that fires the follow-on:
Phase 9 of the ADR 019 ten-phase rollout. The signal is content-side: enough corpora have shipped (Phases 3, 6, 7, 8) that the migration tool can resolve most legacy URLs into structured references with low manual touch. Until then, individual lessons can be migrated by hand as they're touched.

Implementation pattern when triggered:
A bulk pass over `course/**/*.{md,yaml}` that walks each lesson's links, classifies each URL by source (eCFR / faa.gov / aim / pcg / etc.), looks up the matching `SourceEntry` via the registry, and rewrites the link in-place to `[@cite](airboss-ref:<corpus>/<locator>?at=<edition>)`. The validator (Phase 1) gates the rewrite -- a rewrite that doesn't validate is rolled back.

References:

- [spec.md](./spec.md) Scope -> Out
- [spec.md](./spec.md) Out of Scope (resolved, not deferred) table
- [docs/decisions/019-reference-identifier-system/decision.md](../../decisions/019-reference-identifier-system/decision.md) Phase 9

## RAG pipeline implementation

Status: Deferred

What was deferred:
The RAG (retrieval-augmented generation) pipeline that consumes the renderer's `rag` mode output (citation snippet shape: `@formal` plus URL plus machine-readable identifier comment) and produces embeddings + retrieval indexes for downstream LLM consumption. Phase 4's `rag` mode emits the right shape; the pipeline is downstream.

Why:
Per [spec.md](./spec.md) Scope -> Out and the resolved table: RAG is a separate product surface (likely an `apps/rag/` or a service) with its own concerns (embedding model selection, vector store, retrieval ranking). The renderer is contract-complete for a RAG pipeline that consumes its output; building the pipeline here would conflate render correctness with retrieval-system design.

Trigger to revisit:
A RAG consumer is in product scope -- e.g., an "ask the corpus" affordance that retrieves relevant sections in response to a learner question, or an LLM-backed lesson-generation tool that grounds itself in the registered corpora.

Implementation pattern when triggered:
Author the RAG pipeline as its own surface. Consume the renderer's `rag` mode output for citation formatting (so retrieval results carry properly-formatted citations back to the LLM). Embedding + vector storage happens upstream of the renderer; the renderer's role is at retrieval-result render time.

References:

- [spec.md](./spec.md) Scope -> Out
- [spec.md](./spec.md) Out of Scope (resolved, not deferred) table

## Real share-card image generation

Status: Deferred

What was deferred:
A real share-card image generator that takes the `share-card` mode's truncated text output and produces a 1200x630 rasterized image suitable for Open Graph / Twitter Card consumption. Phase 4's `share-card` mode emits the truncated text (per §3.1, capped at 80 chars); the rasterizer is downstream.

Why:
Per [spec.md](./spec.md) Scope -> Out and the resolved table: image generation is a separate surface (Satori, Puppeteer, ImageMagick) with its own concerns (font loading, theme alignment, output caching). The renderer is contract-complete for an image builder that consumes its truncated text; building the rasterizer here would over-extend Phase 4's scope.

Trigger to revisit:
A share-card surface enters product scope -- e.g., social-share affordances on lesson pages that produce Open Graph images, or an instructor-facing "share this lesson" feature that generates a preview image.

Implementation pattern when triggered:
Wrap a templated image generator (Satori is the SvelteKit-friendly option). Feed the renderer's `share-card` mode output as the title text; layer on the lesson title, brand mark, and theme. Output 1200x630 PNG, cached by lesson hash.

References:

- [spec.md](./spec.md) Scope -> Out
- [spec.md](./spec.md) Out of Scope (resolved, not deferred) table

## Postgres-backed indexed tier

Status: Deferred

What was deferred:
The Postgres-backed indexed tier per ADR 019 §2.5. Phase 3 ships an in-repo JSON file (`sections.json`) at the indexed-tier slot; Phase 4 reads it via the resolver. A future phase swaps backends without touching Phase 4.

Why:
Per [spec.md](./spec.md) Scope -> Out and the resolved table: the JSON-file backend is sufficient for current scale. Postgres adds operational complexity (schema, migrations, indexing strategy) that isn't justified until JSON reads become the bottleneck or a feature requires query semantics that JSON can't express.

Trigger to revisit:
Either (a) JSON-file reads become measurably slow for a render-time consumer, or (b) ADR 019 §2.5 phase implementation lands the Postgres tier as part of broader corpus query infrastructure. Same trigger as the corpus-side WPs (CFR ingestion, handbook ingestion) noted -- this is the cross-cutting move.

Implementation pattern when triggered:
Add a Postgres-backed `getIndexedContent` implementation behind the same `CorpusResolver` interface. The renderer's `batchResolve` is unchanged; only the resolver's read path swaps. Migration: import per-corpus `sections.json` (and equivalents) into typed Postgres tables.

References:

- [spec.md](./spec.md) Scope -> Out
- [spec.md](./spec.md) Out of Scope (resolved, not deferred) table
- [docs/decisions/019-reference-identifier-system/decision.md](../../decisions/019-reference-identifier-system/decision.md) §2.5
- [reference-cfr-ingestion-bulk/OUT-OF-SCOPE.md](../reference-cfr-ingestion-bulk/OUT-OF-SCOPE.md) "Postgres-backed indexed tier" (corpus-side analogue)

## Production lesson page integration

Status: Follow-on WP

What was postponed:
Production lesson page consumption of the renderer. Phase 4 ships a demo route under `apps/study/src/routes/(dev)/references/`; production lesson pages (the routes Joshua actually uses to study) swap their fixture / current-shape rendering for the demo's pattern.

Why:
Per [spec.md](./spec.md) Scope -> Out and the resolved table: the production lesson route shape is not yet finalized -- the route lives under `apps/study/` and is being refactored as the lesson primitive evolves. Wiring Phase 4 into a moving target would cost more in churn than waiting for the route shape to settle.

Trigger that fires the follow-on:
The production lesson route shape is finalized (a separate WP under `apps/study/` lands the route refactor). The follow-on WP swaps the fixture data for the renderer pattern; the demo route under `(dev)/references/` becomes the reference implementation.

Implementation pattern when triggered:
The production lesson `+page.server.ts` calls `loadLessonReferences(body, acknowledgments, options)`. The route's `+page.svelte` consumes the payload via `RenderedLesson.svelte`. The demo route at `(dev)/references/` is the working example.

References:

- [spec.md](./spec.md) Scope -> Out
- [spec.md](./spec.md) Out of Scope (resolved, not deferred) table

## `acknowledgments` ack-chain `unbroken` cycle detector

Status: Rejected

What was rejected:
A standalone cycle detector for the `acknowledgments` array on a lesson (i.e., a check that an ack's `superseder` doesn't form a cycle within the acks themselves). `walkSupersessionChain` already detects cycles in the registry; Phase 4 trusts that. A separate cycle detector for `acknowledgments` itself was considered and dropped.

Why:
Per [spec.md](./spec.md) Scope -> Out: YAGNI. The `acknowledgments` schema doesn't recurse -- each ack is a flat record with a `target`, optional `superseder`, optional `historical` flag, and an optional `note`. There's no field shape that could form an ack-internal cycle. The supersession chain a `superseder` references lives in `SOURCES`; cycles there are caught by `walkSupersessionChain`.

A re-decision would have to clear: a schema change that introduces ack-to-ack references (e.g., one ack pointing at another). No such change has been proposed.

References:

- [spec.md](./spec.md) Scope -> Out (last bullet)

## `@text` / `@quote` content rendering at paragraph granularity

Status: Follow-on WP

What was postponed:
Paragraph-granular content rendering for `@text` / `@quote` tokens. Phase 4's `@text` and `@quote` substitute whole-section text from the per-corpus resolver's `getIndexedContent`. Paragraph-level descent (e.g., rendering only paragraph (b) of §91.103 when the identifier is `airboss-ref:regs/cfr-14/91/103/b`) is a Phase-6+ resolver enhancement.

Why:
Per [spec.md](./spec.md) Out of Scope (resolved, not deferred) table: Phase 3 stores section-level content; the resolver returns section-level text. Phase 4 trusts that. Paragraph-level descent requires the per-corpus resolver to parse the section markdown into paragraphs and return only the requested paragraph's text -- which is a per-corpus concern (regs, handbooks, AIM all structure paragraphs differently).

Trigger that fires the follow-on:
A per-corpus resolver enhances `getIndexedContent` to descend to paragraphs. Likely concrete signal: a lesson author writes `[@quote](airboss-ref:regs/cfr-14/91/103/b?at=2026)` expecting the body to render only paragraph (b)'s text and finds the whole section rendered. The fix is in the corpus resolver, not in the renderer.

Implementation pattern when triggered:
The per-corpus resolver's `getIndexedContent(id, edition)` handles the paragraph descent. Phase 4's renderer consumes whatever the resolver returns; no change to the renderer's contract. The `@text` / `@quote` substitution functions are unchanged.

References:

- [spec.md](./spec.md) Out of Scope (resolved, not deferred) table
- [reference-cfr-ingestion-bulk/OUT-OF-SCOPE.md](../reference-cfr-ingestion-bulk/OUT-OF-SCOPE.md) "Per-paragraph SourceEntries" (the corpus-side rejection that pairs with this renderer-side deferral)
