---
title: 'User stories: Reference renderer runtime'
product: cross-cutting
feature: reference-renderer-runtime
type: user-stories
status: unread
review_status: pending
---

# User stories: Reference renderer runtime

The Phase 4 renderer serves five personas: lesson authors who want their `airboss-ref:` URLs to render as proper citations, learners who need readable cross-references, the SvelteKit lesson page that needs a server-load + component pair, downstream surfaces (RAG, RSS, share-cards, etc.) that need a stable token-substitution API, and reviewers checking the rendered output for ack annotations.

## Personas

- **Author**: writing lessons that cite regulations. Today they write `[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)` and the validator passes, but the rendered output is the literal `@cite`. Phase 4 makes `@cite` substitute to `§91.103 Preflight action`.
- **Learner**: reading a lesson on the study app. Wants citations that read naturally, link to the regulation, and surface acknowledgment annotations when applicable.
- **Lesson page (SvelteKit)**: a `+page.server.ts` + `+page.svelte` pair that needs to render lesson body Markdown with token substitution. Phase 4 ships `loadLessonReferences` + `<RenderedLesson>` for that.
- **Downstream surface**: RAG indexer, RSS feed, share-card image builder. Each needs the same `(body, resolved, mode)` API; each consumes a different mode.
- **Reviewer**: looking at a rendered lesson to check that supersession annotations and acknowledgment notes appear correctly. Phase 4's `(dev)/references` route is the surface they use to spot-check.

## US-1: Author sees `@cite` substitute to a real citation

**As** a lesson author,
**I want** my `[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)` to render as `§91.103 Preflight action`,
**so that** my lessons read naturally without me having to retype the section title.

### Acceptance criteria

- I write `[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)` in lesson body.
- A consumer (the demo route, a lesson page, etc.) calls `loadLessonReferences(body, [], {})` server-side.
- The component renders `<a href="https://www.ecfr.gov/current/title-14/...">§91.103 Preflight action</a>` (web mode).
- I see no `@cite` literal in the output.
- If I switch the mode to `plain-text`, the output is `§91.103 Preflight action (https://www.ecfr.gov/current/...)` -- text + URL, no anchor.

### Out of scope

- Live preview while authoring (a separate hangar feature, R5).

## US-2: Author writes adjacent references, renderer merges

**As** a lesson author,
**I want** to write `[§91.167](...167?at=2026), [§91.169](...169?at=2026), and [§91.171](...171?at=2026)` and have the renderer collapse it,
**so that** the rendered output is the single normalized list `§91.167, §91.169, §91.171` (or the range `§91.167-91.171` when contiguous).

### Acceptance criteria

- I write three contiguous `airboss-ref:regs/cfr-14/91/167`, `91/168`, `91/169` links separated by `, ` and `, and `.
- The renderer detects the adjacency group, all same corpus + same pin, all same locator prefix.
- The rendered output is a single anchor with text `§91.167-91.169`. The interstitial separators are consumed.
- When I write a non-contiguous group `91/167`, `91/169`, `91/171`, the renderer emits the comma-list form.
- When I write a same-corpus same-pin pair separated by prose ("§91.167... See also §91.169."), the renderer emits two separate anchors.
- When I mix corpora or pins, no merge happens.

### Out of scope

- Lesson-level grouping ("the IFR fuel + alternate trio") with custom prose -- ADR 019 §1.4 already lets the author write `[The IFR fuel + alternate trio @list](airboss-ref:regs/...)` and the renderer substitutes; that's covered by US-1's `@list` substitution.

## US-3: Lesson page consumes `loadLessonReferences` + `<RenderedLesson>`

**As** the SvelteKit lesson page,
**I want** a server load helper that produces a JSON-safe payload and a component that consumes it,
**so that** lessons render with all `airboss-ref:` URLs substituted, hyperlinked, and annotated -- without my route knowing about the renderer's internals.

### Acceptance criteria

- My `+page.server.ts` calls `loadLessonReferences(body, frontmatter.acknowledgments, { historicalLens: frontmatter.historical_lens })`.
- The function returns `{ body, resolved, mode }`. JSON-safe.
- My `+page.svelte` imports `RenderedLesson` and passes the returned data: `<RenderedLesson body={data.body} resolved={data.resolved} mode={data.mode} />`.
- The rendered HTML is correct on first paint (SSR), no flash of un-substituted `@cite` literals.
- Hydration produces the same output (no SSR / hydration mismatch warning in console).

### Out of scope

- Wiring this into a production lesson route. The demo route at `(dev)/references/` exercises the integration; production wiring is a separate WP.

## US-4: Author writes acknowledgment, renderer annotates

**As** an author,
**I want** my frontmatter `acknowledgments` to surface as annotations in the rendered output,
**so that** learners see "(acknowledged 2030 supersession; original-intact)" inline with the reference.

### Acceptance criteria

- My lesson frontmatter includes:
    ```yaml
    acknowledgments:
      - target: airboss-ref:interp/walker-2017
        superseder: airboss-ref:interp/smith-2030
        reason: original-intact
        note: "Smith narrows but does not overturn the active-investigation standard cited here."
    ```
- My body references `[Walker (2017)](airboss-ref:interp/walker-2017)` (or by reference label).
- The renderer detects the ack covers the target, walks the supersession chain from `superseder`, and annotates the rendered output with `(acknowledged §<smith-2030 short> supersession; original-intact)`.
- In web mode the annotation is a `<span class="ab-ref-annotation ab-ref-covered">...</span>` after the anchor.
- The `note` field is attached as `title=` on the anchor (web mode tooltip).
- If the chain has advanced past `smith-2030` to a hypothetical `jones-2032`, the annotation becomes `(ack chain advanced; please re-validate)`.
- If the ack has `historical: true`, the annotation is `(historical reference)` regardless of supersession state.

### Out of scope

- Hangar UI for editing acks.
- Automated chain re-validation (the validator already emits a row-13 WARNING; the renderer surfaces it visually).

## US-5: Downstream surface consumes the render API for RAG citations

**As** a future RAG citation pipeline,
**I want** to call `substituteTokens(body, resolved, 'rag')` and get a structured citation snippet,
**so that** my retrieval system can store and surface the citation alongside the embedding.

### Acceptance criteria

- I call `extractIdentifiers(body)`, `batchResolve(ids, ctx)`, `substituteTokens(body, resolved, 'rag')`.
- The output for each identifier is `<formal-citation> (<liveUrl>) <!-- airboss-ref:<id> -->`.
- The machine-readable comment lets my pipeline link the citation back to the registry without re-parsing.
- I get the same API surface for `'rss'`, `'share-card'`, `'slack-unfurl'`, `'transclusion'`, `'tooltip'`. Each emits the §3.1-specified surface.

### Out of scope

- The actual RAG pipeline (embeddings, vector store, retrieval). Phase 4 ships only the citation-snippet shape.

## US-6: Reviewer spot-checks rendered output via demo route

**As** a reviewer,
**I want** to visit `/references` in the dev environment and see the three fixture lessons rendered live,
**so that** I can confirm token substitution, adjacency merge, and ack annotation behave correctly without writing more tests.

### Acceptance criteria

- Visit `/references` in `bun run dev`. See three lessons listed.
- Each lesson is rendered via `<RenderedLesson>` in `web` mode by default.
- The first fixture (happy path) shows `§91.103 Preflight action` hyperlinked and `§91.167 Fuel requirements...` etc.
- The second fixture (adjacency) shows a single anchor for the three contiguous Part-91 sections.
- The third fixture (acknowledgment) shows the `(acknowledged ...)` annotation on the binding link.
- Mode toggle UI lets me switch to `plain-text`, `print`, `tts`, `screen-reader`, etc.; each changes the rendered surface accordingly.
- No console errors; no `@cite` literals leaking through.

### Out of scope

- A real production lesson route. The demo route under `(dev)/` is dev-only.

## US-7: Author registers a custom token

**As** an author building a specialized lesson surface (e.g. flashcard front rendering),
**I want** to register a custom token like `@flashcard-front`,
**so that** my surface's substitution rule lives next to my surface's code.

### Acceptance criteria

- I call `registerToken({ name: '@flashcard-front', kind: 'derived', substitute(ctx) { ... } })`.
- `getToken('@flashcard-front')` returns my token.
- `substituteTokens` finds and uses my token when it appears in lesson link text.
- Re-registering with the same name throws (loud error; not silent overwrite).

### Out of scope

- A registry of surface-specific tokens. Each surface owns its tokens; we don't centralize.

## US-8: TTS pipeline consumes the `tts` mode

**As** a future audio TTS pipeline,
**I want** to call `substituteTokens(body, resolved, 'tts')` and get a text-only string with identifiers removed,
**so that** my TTS engine can speak the substituted text without trying to pronounce the URL.

### Acceptance criteria

- I call `substituteTokens(body, resolved, 'tts')` for a body with `[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)`.
- The output is `Section 91.103 Preflight action` (or whatever `@cite` substituted to), no URL, no Markdown link syntax.
- `@text` token outputs the section's normalized text; `@quote` does the same (quote markup is omitted in TTS mode).
- Spoken-form aliases for the regs corpus are NOT yet implemented (R2 deferral); the TTS engine pronounces `§91.103` as it sees fit.

### Out of scope

- Spoken-form alias generation (R2; ships with `apps/audio/`).
- TTS engine integration.
