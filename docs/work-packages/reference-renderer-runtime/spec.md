---
title: 'Spec: Reference renderer runtime'
product: cross-cutting
feature: reference-renderer-runtime
type: spec
status: unread
review_status: pending
---

# Spec: Reference renderer runtime

Phase 4 of the 10-phase ADR 019 rollout. After Phase 3 (CFR ingestion) populated the registry with real `regs` entries, lessons can write `[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)` and the validator passes them. What's missing is the rendering: the URL is still a URL, `@cite` is still a literal string, and the supersession / acknowledgment annotations described in ADR 019 §3, §3.1, §3.4, §6.2, §6.3 don't exist.

Phase 4 closes that gap. It introduces the `@ab/sources/render` subpath of the existing `@ab/sources` lib, ships the 12 substitution tokens declared in §3.1, implements multi-reference adjacency merge per §1.4, applies the render-mode behavior table per §3.1, attaches acknowledgment annotations per §3.4 + §6.3, and wires a SvelteKit server load helper plus a Svelte 5 component into `apps/study/` so a fixture lesson renders end-to-end.

The two priority modes are **web** (HTML, hyperlinked tokens, supersession + ack annotations) and **plain-text** (tokens substitute, per-corpus live URL appended in parens). The other modes from §3.1's table (`print`, `tts`, screen-reader, RSS, share-card, RAG, Slack unfurl, transclusion, tooltip) ship as documented surfaces with reasonable defaults so the API is contract-complete; they are not "stubs" in the CLAUDE.md "known issue" sense, they are deliberate skeletons whose contract is finalized and whose behaviors are exactly what §3.1 specifies for them today.

## Why this matters

Phase 1-3 built the publish gate. Phase 4 builds the read path:

1. **Tokens substitute.** Today `[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)` renders as the literal text `@cite`. After Phase 4 it renders as `§91.103 Preflight action`, hyperlinked.
2. **Adjacency merges.** Today three consecutive `airboss-ref:` links render as three separate links. After Phase 4 the renderer detects same-corpus + same-pin contiguous identifiers and emits the normalized `§91.167-91.171` form per §1.4.
3. **Acknowledgments annotate.** Today the `acknowledgments` frontmatter is consumed by the validator (orphan check, multi-target rule) but invisible at render time. After Phase 4 the renderer attaches `(acknowledged 2030 supersession; original-intact)`, `(ack chain advanced; please re-validate)`, or `(historical reference)` annotations per §3.4 + §6.3 cascade rules.
4. **Cross-corpus supersession is visible.** Per §6.2, when the supersession chain crosses corpora, the renderer surfaces the original's `canonical_short` plus a `(via §X in regs:tsa-49)` annotation.
5. **Surfaces share one render API.** Per §2.5, every render surface (lesson page SSR, RAG indexer, RSS feed, share-card image, search-snippet builder) consumes `extractIdentifiers`, `batchResolve`, `substituteTokens` from `@ab/sources/render`. Phase 4 establishes the contract; future surfaces consume it without reimplementing batch resolution.

After Phase 4, the regs corpus's full ADR 019 contract -- ingestion -> registry -> validator -> renderer -- is end-to-end testable. Phase 5 (annual diff) consumes the same `@ab/sources/render` API for its rewrite-preview surface; Phases 6-8 (handbook / AIM / AC ingestion) plug their resolvers into the resolver registry without touching Phase 4.

## Success Criteria

- `libs/sources/src/render/` directory holds the public API (`extract.ts`, `batch-resolve.ts`, `substitute.ts`, `tokens.ts`, `adjacency.ts`, `annotations.ts`, `index.ts`) plus per-mode dispatch (`modes/web.ts`, `modes/plain-text.ts`, `modes/print.ts`, `modes/tts.ts`, `modes/default.ts`).
- `@ab/sources/render` exports the three contract functions:
    - `extractIdentifiers(body: string): readonly SourceId[]` -- reuses `parseLesson`'s body walker; dedupes; returns occurrences in source order.
    - `batchResolve(ids: readonly SourceId[]): Promise<ResolvedIdentifierMap>` -- one map keyed by raw identifier (pin-preserving), entries hold `SourceEntry`, supersession chain, indexed content (when needed), live URL, and per-id annotations.
    - `substituteTokens(body: string, resolved: ResolvedIdentifierMap, mode: RenderMode): string` -- mode-dispatched. Web returns HTML; plain-text returns plain text with appended URLs; the others return their §3.1-specified surface.
- The 12 substitution tokens from §3.1 are registered in `@ab/sources/render/tokens.ts` as a typed registry. Each token's substitution function is a pure function of `ResolvedIdentifier` plus surrounding-context (used for `@list` adjacency, `@as-of` pin, `@chapter`/`@subpart`/`@part` containing-element resolution).
- The token set is **open** per §3.1: a downstream consumer can `registerToken(...)` to add a custom token. Adding a token does not require touching the dispatcher.
- Multi-reference adjacency-merge per §1.4: contiguous identifiers same corpus + same pin merge into a single `<a>` tag with normalized link text. Adjacency threshold is "consecutive identifier links separated only by `,`, `;`, ` and `, ` or `, or whitespace, no other prose between them" (formalized in `adjacency.ts`). When the locator path implies a numeric range (e.g. `91/167`, `91/168`, `91/169` all section-level under the same Part), the link text is the range form `§91.167-91.169`. When non-contiguous (e.g. `91/167`, `91/169`, `91/171`), the link text is the comma-list form `§91.167, §91.169, §91.171`. When mixed corpus or mixed pin, no merge happens.
- Acknowledgment annotations per §3.4 + §6.3: when the lesson's frontmatter `acknowledgments` covers a target referenced in body, the renderer emits the annotation per the cascade rules. Annotation locations are mode-specific per §3.1 (tooltip for web, footnote for print, omitted in TTS / share-card preview, inline-parenthetical in plain-text export).
- Cross-corpus supersession per §6.2: when `walkSupersessionChain` returns a chain that crosses corpora, the rendered web HTML shows the original `canonical_short` with a trailing `(via §X in regs:tsa-49)` annotation, drawn from the successor's per-corpus resolver `formatCitation`.
- The four production-quality modes:
    - **Web**: tokens substitute; identifier becomes `<a href>`. `href` is the live URL from the per-corpus resolver (eCFR for `regs`, faa.gov for `aim`/`ac`/`handbooks`, etc.). `@deeplink` falls back to the same per-corpus live URL since the resolver service is dropped per §10. Annotations render inline as `<span class="ab-ref-annotation">...</span>` for web; tooltip-bound annotations attach as `title=` attributes.
    - **Plain-text**: tokens substitute; identifier removed; per-corpus live URL appended as `(<URL>)` after substituted text per §3.1.
    - **Print**: same as web for token substitution, but identifier becomes inline text and the live URL is rendered as a footnote marker plus a footnote list at the end of the document. Footnote machinery is HTML-flavored (`<sup>` + `<aside class="ab-ref-footnotes">`); a real PDF rasterizer is downstream.
    - **TTS**: tokens substitute; identifier omitted from spoken output; `@cite`/`@text`/`@quote` produce the phrase the TTS engine speaks (e.g. `"Section ninety-one one-oh-three Preflight action"`). Per §3.1 spoken-form aliases for the regs corpus are NOT yet authored (R2 deferral); Phase 4 ships the `@cite`/`@short` substitutions verbatim and lets the downstream TTS engine pronounce them as the engine sees fit.
- Five additional modes ship as forward-compatible surfaces: `screen-reader` (mirrors web with `aria-label`), `rss` (mirrors web with absolute URLs), `share-card` (truncates at 80 chars per §3.1), `rag` (`@formal` plus URL plus machine-readable identifier comment), `slack-unfurl` (title from `@cite`, description from lesson title), `transclusion` (preserves the included lesson's pins per §3.1), `tooltip` (truncates at 200 chars per §3.1).
- The render API is content-tier-aware:
    - Tokens that need only static identity (`@short`, `@formal`, `@title`, `@cite`, `@last-amended`, `@as-of`, `@deeplink`, `@chapter`, `@subpart`, `@part`) resolve from `SourceEntry` alone -- one synchronous map lookup per identifier.
    - Tokens that need indexed-tier content (`@text`, `@quote`) call `CorpusResolver.getIndexedContent` once per identifier inside `batchResolve`. The map caches the result per identifier.
    - `@list` is computed at substitute time from the adjacency analysis, not from `batchResolve`.
- A SvelteKit server load helper at `apps/study/src/lib/server/references.ts` exports `loadLessonReferences(body: string): Promise<RenderedLesson>`. The helper calls `extractIdentifiers` + `batchResolve` and returns a serializable payload (`{ body: string, resolved: SerializableResolvedMap, mode?: RenderMode }`) the route can pass to its component as `data`.
- A Svelte 5 component at `apps/study/src/lib/components/RenderedLesson.svelte` consumes the payload and emits HTML via `{@html substituteTokens(data.body, data.resolved, data.mode ?? 'web')}`. Runes only (`$props`, `$derived`); no `<slot>`, no Svelte-4 stores.
- A demo route at `apps/study/src/routes/(dev)/references/+page.server.ts` + `+page.svelte` renders three fixture lessons end-to-end so the renderer can be visually inspected: a "happy path" lesson with mixed `@cite` / `@short` / `@text` tokens, an "adjacency" lesson exercising the multi-reference merge, and an "acknowledgment" lesson exercising the §6.3 cascade annotations.
- Vitest tests cover: token registration + lookup, every token's pure-function substitution, `extractIdentifiers` (dedup, source order, fenced-code skip via `parseLesson`), `batchResolve` (static-only path, indexed-tier path, supersession chain walk, cross-corpus chain), `substituteTokens` per mode, adjacency-merge formatting (range vs comma-list vs no-merge), acknowledgment annotation cascade (covered + chain-advanced + historical + lesson-level historical lens), and snapshot tests against fixture HTML for the three demo lessons.
- `bun run check` exits 0; `bun test libs/sources/` passes; `bun test apps/study/` passes; the demo route at `/references` renders without runtime error.

## Scope

### In

- `libs/sources/src/render/index.ts` -- assembles + exports the public API (`extractIdentifiers`, `batchResolve`, `substituteTokens`, plus the tokens namespace and `RenderMode` re-export).
- `libs/sources/src/render/extract.ts` -- thin wrapper around `parseLesson` (or its body walker) that returns the deduplicated identifier list. Exposed as `extractIdentifiers(body: string)`. The function takes raw body text (no frontmatter); the server load helper passes the body slice from its lesson loader.
- `libs/sources/src/render/batch-resolve.ts` -- `batchResolve(ids)` walks identifiers in parallel: for each, calls `resolveIdentifier`, `walkSupersessionChain`, `getCorpusResolver(...)?.getLiveUrl(id, edition)`, and (for `@text`/`@quote` tokens) `getIndexedContent`. Returns a `Map<SourceId, ResolvedIdentifier>` keyed on the **raw identifier including pin** (so two refs to the same entry with different pins each get a row).
- `libs/sources/src/render/tokens.ts` -- the open token registry. Each token entry has `name`, `kind` (`identity` or `content` or `derived`), `substitute(ctx: TokenContext)`. Default registry registers the 12 §3.1 tokens at module init.
- `libs/sources/src/render/adjacency.ts` -- detects contiguous-identifier runs in the body (post-extraction) and groups them by corpus + pin. Emits a list of `AdjacencyGroup`s the substitute function consumes when emitting `@list` or merging ranges.
- `libs/sources/src/render/annotations.ts` -- given a `ResolvedIdentifier` plus the lesson's `acknowledgments` (passed through `batchResolve`'s caller context), computes the §3.4 / §6.3 annotation. Pure function; mode-agnostic. Returns `{ kind: 'covered' | 'chain-advanced' | 'historical' | 'cross-corpus' | 'none'; text: string }` so each mode can place the annotation per §3.1's rules.
- `libs/sources/src/render/substitute.ts` -- the dispatcher. Accepts `(body, resolved, mode)`; walks Markdown body (regex-driven, mirroring `lesson-parser.ts`); for each `airboss-ref:` link substitutes per the mode dispatcher; emits the final string.
- `libs/sources/src/render/modes/web.ts` -- web-mode renderer. Accepts a `LinkRenderContext` (the matched link, its resolved identifier, its annotation, its adjacency group), emits HTML.
- `libs/sources/src/render/modes/plain-text.ts` -- plain-text-mode renderer. Same context; emits text + appended URL.
- `libs/sources/src/render/modes/print.ts` -- print-mode renderer. Emits HTML with footnote indirection.
- `libs/sources/src/render/modes/tts.ts` -- TTS-mode renderer. Emits a token-substituted text-only string with the identifier removed.
- `libs/sources/src/render/modes/default.ts` -- the fallback dispatcher for the five forward-compatible modes (`screen-reader`, `rss`, `share-card`, `rag`, `slack-unfurl`, `transclusion`, `tooltip`). Each behavior is a one-screen function over `LinkRenderContext`, returning the §3.1-specified surface.
- `libs/sources/src/types.ts` -- extension only:
    - `RenderMode` widened to the full §3.1 set: `'web' | 'plain-text' | 'print' | 'tts' | 'screen-reader' | 'rss' | 'share-card' | 'rag' | 'slack-unfurl' | 'transclusion' | 'tooltip'`. Phase 1's existing 4-mode union is a subset; no Phase 1 import breaks.
    - New `ResolvedIdentifier` interface (keyed by raw `SourceId` with pin); see Data Model below.
    - New `ResolvedIdentifierMap = ReadonlyMap<string, ResolvedIdentifier>` alias.
    - `SerializableResolvedMap` -- the shape the SvelteKit `data` payload carries (Date fields ISO-encoded, Map flattened to a `Record`).
- `libs/sources/src/render/serialize.ts` -- `toSerializable(map)` and `fromSerializable(record)` helpers for SvelteKit transport. SvelteKit serializes JSON-safe payloads only; Maps and Dates need explicit handling.
- `libs/sources/src/index.ts` -- adds `export * from './render/index.ts'` so consumers can `import { substituteTokens } from '@ab/sources'` (or import from `@ab/sources/render` if they want a narrower surface; Bun's monorepo aliasing makes both work without a separate package.json export).
- `apps/study/src/lib/server/references.ts` -- `loadLessonReferences(body, mode?)` SvelteKit server load helper. Calls the render API; serializes the result; returns `{ body, resolved, mode }`.
- `apps/study/src/lib/components/RenderedLesson.svelte` -- the consumer component. Props: `body: string`, `resolved: SerializableResolvedMap`, `mode?: RenderMode`. Uses `$props`, `$derived`, `{@html ...}`. Pure render; no side effects.
- `apps/study/src/routes/(dev)/references/+page.server.ts` -- demo route load. Reads three fixture lesson files from `apps/study/src/routes/(dev)/references/fixtures/`, runs each through the render pipeline at the requested mode (default `web`, switchable via `?mode=plain-text` etc.), returns the data.
- `apps/study/src/routes/(dev)/references/+page.svelte` -- demo page. Lists the three fixtures, renders each via `RenderedLesson`, plus a mode-toggle group. Dev-only (lives under `(dev)`, not navigated from the app shell).
- `apps/study/src/routes/(dev)/references/fixtures/happy-path.md` -- fixture: §91.103 + §91.167 with `@cite` / `@short` / `@text`.
- `apps/study/src/routes/(dev)/references/fixtures/adjacency.md` -- fixture: contiguous §91.167 / §91.169 / §91.171 to exercise the merge.
- `apps/study/src/routes/(dev)/references/fixtures/acknowledgment.md` -- fixture: a superseded reference with an `acknowledgments` entry (synthetic supersession in `SOURCES` for the fixture; built by the test helper, not real corpus content).
- Vitest tests:
    - `libs/sources/src/render/extract.test.ts` -- dedup, source-order, fenced-code skip.
    - `libs/sources/src/render/batch-resolve.test.ts` -- static-only path, indexed-tier path, supersession chain.
    - `libs/sources/src/render/tokens.test.ts` -- per-token substitution; `registerToken` extension.
    - `libs/sources/src/render/adjacency.test.ts` -- contiguous range merge, comma-list, mixed-corpus no-merge, mixed-pin no-merge.
    - `libs/sources/src/render/annotations.test.ts` -- covered, chain-advanced, historical, cross-corpus.
    - `libs/sources/src/render/substitute.test.ts` -- end-to-end body substitution per mode (snapshot fixtures).
    - `libs/sources/src/render/modes/web.test.ts` -- web HTML shape.
    - `libs/sources/src/render/modes/plain-text.test.ts` -- plain-text shape with URLs.
    - `libs/sources/src/render/modes/default.test.ts` -- the five forward-compatible modes return `LinkRenderContext`-derived strings of the right shape.
- `docs/work/plans/adr-019-rollout.md` -- mark Phase 4 done with the merged PR number.

### Out

- **Real PDF rasterization.** Phase 4's `print` mode emits HTML-flavored footnote markup. A real PDF surface (Puppeteer / wkhtmltopdf / etc.) is downstream; the render API is contract-complete for it.
- **Real audio TTS pipeline.** Phase 4's `tts` mode emits a text string with the identifier removed and tokens substituted. Spoken-form alias generation (R2 in revisit.md) ships when `apps/audio/` exists.
- **Hangar UI for editing references.** revisit.md R5; deferred until `apps/hangar/` revives.
- **IDE language-server integration for NOTICE-tier feedback.** revisit.md R7.
- **Annual diff job (Phase 5).** Phase 4 reads the registry; Phase 5 walks editions and rewrites lesson pins. The two share the `@ab/sources/render` API but are separate WPs.
- **Lesson migration tool (Phase 9).** Phase 4 makes existing `airboss-ref:` references render correctly; Phase 9 rewrites pre-ADR-019 lessons to use them.
- **RAG pipeline implementation.** Phase 4's `rag` mode emits the right shape; the actual embeddings + retrieval is downstream.
- **Real share-card image generation.** Phase 4's `share-card` mode emits the truncated text; a real `1200x630` rasterizer is downstream.
- **Postgres-backed indexed tier.** Phase 3 ships a JSON-file indexed tier; Phase 4 reads it via the resolver. A future phase swaps backends without touching Phase 4.
- **Production lesson page integration.** Phase 4 ships the demo route under `(dev)/`; a production lesson page consumer lands when the lesson route shape is finalized (separate WP under `apps/study/`).
- **The `acknowledgments` ack-chain `unbroken` cycle detector.** `walkSupersessionChain` already detects cycles in the registry; Phase 4 trusts that. A separate cycle detector for `acknowledgments` itself is YAGNI -- the schema doesn't recurse.

## Data Model

### `ResolvedIdentifier` (per occurrence)

```typescript
export interface ResolvedIdentifier {
  /** Raw identifier as written in the body, pin preserved. */
  readonly raw: string;
  readonly parsed: ParsedIdentifier;
  /** The matched SourceEntry, after pin-strip. Null when the registry has no entry. */
  readonly entry: SourceEntry | null;
  /** Supersession chain from `entry` forward. Includes `entry` as element 0. Empty when entry is null. */
  readonly chain: readonly SourceEntry[];
  /** Per-corpus live URL for the pin. Null when resolver returns null. */
  readonly liveUrl: string | null;
  /** Indexed content, populated lazily inside batchResolve when a `@text`/`@quote` token references this identifier. */
  readonly indexed: IndexedContent | null;
  /** Annotation derived from the lesson's `acknowledgments` + supersession chain. */
  readonly annotation: ResolvedAnnotation;
}

export interface ResolvedAnnotation {
  readonly kind: 'none' | 'covered' | 'chain-advanced' | 'historical' | 'cross-corpus';
  readonly text: string;
}

export type ResolvedIdentifierMap = ReadonlyMap<string, ResolvedIdentifier>;
```

### `TokenContext` and `Token`

```typescript
export interface TokenContext {
  readonly resolved: ResolvedIdentifier;
  readonly mode: RenderMode;
  /** Group this identifier belongs to, if any. `@list` consumes this. */
  readonly group?: AdjacencyGroup;
  /** The lesson's pin literal for `@as-of`. */
  readonly pin: string | null;
}

export interface Token {
  readonly name: `@${string}`;
  readonly kind: 'identity' | 'content' | 'derived';
  substitute(ctx: TokenContext): string;
}

export function registerToken(token: Token): void;
export function getToken(name: string): Token | null;
```

### `AdjacencyGroup`

```typescript
export interface AdjacencyGroup {
  readonly corpus: string;
  readonly pin: string | null;
  /** The raw identifiers in source order. Length >= 1. */
  readonly members: readonly string[];
  /** Range-form link text when `members` form a contiguous numeric run; comma-list form otherwise. */
  readonly listText: string;
}
```

### `SerializableResolvedMap`

```typescript
export type SerializableResolvedMap = Record<string, SerializableResolvedIdentifier>;

export interface SerializableResolvedIdentifier {
  readonly raw: string;
  readonly parsed: ParsedIdentifier;
  readonly entry: SerializableSourceEntry | null;
  readonly chain: readonly SerializableSourceEntry[];
  readonly liveUrl: string | null;
  readonly indexed: IndexedContent | null;
  readonly annotation: ResolvedAnnotation;
}

export interface SerializableSourceEntry extends Omit<SourceEntry, 'last_amended_date'> {
  /** ISO-8601 date string. */
  readonly last_amended_date: string;
}
```

`toSerializable` / `fromSerializable` round-trip without precision loss.

## Behavior

### `extractIdentifiers`

- Reuses `parseLesson`'s body walker (no duplicate regex). Internally calls a small adapter that returns the occurrence list, then dedupes by raw identifier preserving first-occurrence source order.
- Skips fenced code blocks, inline code spans, reference-definition lines (already handled in `lesson-parser.ts`).
- Bare identifiers (NOTICE-tier per validator) are extracted with the same skip-range awareness; they participate in resolution but get rendered as plain `<a href>` text without a token substitution.

### `batchResolve`

- For each identifier, derives pin via `parsed.pin` (defaults to current accepted edition for the corpus when null -- §1.3 fallback).
- Looks up `SourceEntry` via `resolveIdentifier(stripPin(id))`.
- Walks supersession chain via `walkSupersessionChain`. Detects cross-corpus boundary inside the chain (`chain[0].corpus !== chain[N].corpus`) and tags the annotation accordingly.
- Calls `getCorpusResolver(parsed.corpus)?.getLiveUrl(id, pin)` for the link target.
- Calls `getCorpusResolver(parsed.corpus)?.getIndexedContent(id, pin)` only when the body contains a `@text` or `@quote` token bound to this identifier (Phase 4 inspects the body once for this; downstream optimization is to pass the token list in).
- Computes the `ResolvedAnnotation` via `annotations.ts` using the lesson's `acknowledgments` (passed in as a sidecar argument since `batchResolve` doesn't see frontmatter).

### `batchResolve` API shape

```typescript
export function batchResolve(
  ids: readonly string[],
  ctx: BatchResolveContext,
): Promise<ResolvedIdentifierMap>;

export interface BatchResolveContext {
  readonly acknowledgments: readonly LessonAcknowledgment[];
  readonly historicalLens: boolean;
  readonly body: string;
  /** Override `getCorpusResolver` for tests (the test helper builds a fixture resolver). Default: production registry. */
  readonly resolverFactory?: (corpus: string) => CorpusResolver | null;
}
```

The `body` is passed in only so `batchResolve` can detect which identifiers need `@text` / `@quote` resolution (and skip indexed-tier reads for the rest). Cheap; no double-walk because `extractIdentifiers` has already established the structure.

### `substituteTokens` (web mode reference)

- Walks the body with the same `INLINE_LINK_REGEX` from `lesson-parser.ts`.
- For each match, looks up `resolved.get(match.url)`; if absent, leaves the link text untouched (defensive; `extractIdentifiers` should have populated it). Logs a `console.warn` in dev so debugging is straightforward.
- Identifies the link's adjacency group (computed once per body inside substitute, cached). When `@list` is present in the link text, substitutes the group's `listText`.
- Substitutes every `@token` in the link text via `getToken(...)` -> `substitute(ctx)`. The resulting text becomes the `<a>` content.
- Wraps in `<a href="<liveUrl or fallback>" class="ab-ref ab-ref-{corpus}">...</a>`.
- Appends the annotation if present and the mode places annotation inline (`web`, `plain-text`); attaches as `title=` for tooltip-bound annotations.
- For grouped links: only the **first** occurrence in the group emits the `<a>`; the trailing occurrences are removed from the output (with their interstitial separators) so the source `[link 1], [link 2], and [link 3]` collapses to a single anchor.

### Multi-reference adjacency merge -- §1.4 mechanics

A run is detected when:

- Two or more identifier links appear in the same line (or contiguous lines).
- Between any two consecutive identifiers, the only characters are whitespace, `,`, `;`, `and`, `or`, parentheses (`(`, `)`), or wrapping markdown emphasis (`*`, `_`).
- All identifiers in the run share the same `corpus` and the same `pin`.

For a 2+ run, the renderer computes:

- **Range form** when every identifier's locator path matches the same prefix and the only varying segment is numeric and contiguous (e.g. all `airboss-ref:regs/cfr-14/91/<N>` with `N ∈ {167, 168, 169}`). Output: `§91.167-91.169`.
- **Comma-list form** otherwise: `§91.167, §91.169, §91.171` (using the `canonical_short` of each member).

Single-occurrence `@list` produces the entry's `canonical_short` (a list of one), per §1.4 last paragraph.

### Acknowledgment cascade -- §6.3 mechanics

For each resolved identifier, the renderer consults the lesson's `acknowledgments`:

1. If `historical_lens` is true on the lesson AND no per-target ack overrides for this identifier: annotation is `historical`, text `"(historical reference)"`.
2. Else, find the ack whose `target` matches the identifier (by reference-label `id` if the link uses a label, by raw target otherwise).
3. If found and `historical: true`: annotation is `historical`, text `"(historical reference)"`.
4. If found and `superseder` is set: walk the supersession chain from `superseder` forward. If the chain end matches `superseder`: annotation is `covered`, text `"(acknowledged ${chainEnd.canonical_short} supersession; ${reason})"`. If the chain has advanced past `superseder`: annotation is `chain-advanced`, text `"(ack chain advanced; please re-validate)"`.
5. Else if no ack but the entry's own supersession chain has advanced (entry has `superseded_by`): annotation is `cross-corpus` only when the chain crosses corpora; otherwise annotation is `none` (the validator already emits a row-13 WARNING; the renderer shouldn't double-surface).
6. Else: annotation is `none`.

The text format for each kind is fixed; tests snapshot it.

### Per-mode annotation placement (per §3.1's table)

| Mode | Annotation placement |
| --- | --- |
| `web` | Inline `<span class="ab-ref-annotation ab-ref-{kind}">...</span>` after the anchor; tooltip (`title=`) for the optional ack `note` field. |
| `print` | `<sup>` footnote marker after anchor; footnote text in trailing `<aside class="ab-ref-footnotes">` block; ack `note` rendered as the footnote body. |
| `tts` | Annotation omitted from spoken output. |
| `screen-reader` | Annotation included in the anchor's `aria-label`. |
| `plain-text` | Inline-parenthetical `(<annotation>)` after substituted text. |
| `rss` | Inline as in `web` (recipients are HTML-capable). |
| `share-card` | Annotation omitted (truncated to 80 chars). |
| `rag` | Annotation included as the citation footnote alongside the URL. |
| `slack-unfurl` | Annotation appended to the description. |
| `transclusion` | Inline as in `web` (the host page is HTML). |
| `tooltip` | Annotation included; truncates the whole token-substituted text to 200 chars. |

### Render-mode dispatch

```typescript
export function substituteTokens(
  body: string,
  resolved: ResolvedIdentifierMap,
  mode: RenderMode = 'web',
): string;
```

`mode` defaults to `web`. The dispatcher picks the mode handler, hands every link match to it, and returns the assembled string. Modes are pure functions; rendering the same body twice with the same `resolved` always produces the same output.

### SvelteKit server load helper

```typescript
// apps/study/src/lib/server/references.ts
export interface LoadedLessonReferences {
  readonly body: string;
  readonly resolved: SerializableResolvedMap;
  readonly mode: RenderMode;
}

export async function loadLessonReferences(
  body: string,
  acknowledgments: readonly LessonAcknowledgment[],
  options?: { historicalLens?: boolean; mode?: RenderMode },
): Promise<LoadedLessonReferences>;
```

The route's `+page.server.ts` calls this with the Markdown body it loaded from disk; the function returns a JSON-safe payload the component can re-hydrate.

### Component contract

```svelte
<script lang="ts">
  import { fromSerializable, substituteTokens, type RenderMode, type SerializableResolvedMap } from '@ab/sources';

  let {
    body,
    resolved,
    mode = 'web' as RenderMode,
  }: {
    body: string;
    resolved: SerializableResolvedMap;
    mode?: RenderMode;
  } = $props();

  const map = $derived(fromSerializable(resolved));
  const html = $derived(substituteTokens(body, map, mode));
</script>

{@html html}
```

Component is dumb. All work happens server-side; the client just renders the precomputed HTML.

## Dependencies

- **Upstream:** ADR 019 (accepted v3), Phase 1 (PR #241), Phase 2 (PR #246), Phase 3 (PR #247).
- **Downstream:** Phase 5 (annual diff job) consumes `extractIdentifiers` to walk every lesson's identifiers; Phase 6+ ingestion phases plug their resolvers in without touching Phase 4. Production lesson pages will swap their fixture data for the demo route's lessons-from-disk pattern.
- **External:** None. Pure TypeScript + Svelte 5; no new npm dependency.

## Validation

| Concern | Where it runs |
| --- | --- |
| `extractIdentifiers` returns dedup, source-ordered list | Vitest unit (`extract.test.ts`) |
| `extractIdentifiers` skips fenced code, inline code, ref-defs | Vitest unit |
| `batchResolve` resolves static-only identifiers via `SOURCES` | Vitest unit (`batch-resolve.test.ts`) |
| `batchResolve` reads indexed-tier content for `@text`/`@quote` body presence | Vitest unit |
| `batchResolve` walks supersession chain | Vitest unit |
| `batchResolve` returns null `entry` for unknown id (defensive) | Vitest unit |
| Token registration: each of the 12 §3.1 tokens is registered at module init | Vitest unit (`tokens.test.ts`) |
| `registerToken({...})` adds a custom token; `getToken('@custom')` returns it | Vitest unit |
| Per-token substitution produces the §3.1-specified output | Vitest unit |
| Adjacency merge produces range form for contiguous numeric run | Vitest unit (`adjacency.test.ts`) |
| Adjacency merge produces comma-list form for non-contiguous | Vitest unit |
| Adjacency does NOT merge across corpora or pins | Vitest unit |
| Annotation kind = `covered` when ack matches chain end | Vitest unit (`annotations.test.ts`) |
| Annotation kind = `chain-advanced` when chain end != ack superseder | Vitest unit |
| Annotation kind = `historical` when ack `historical: true` OR `historical_lens` | Vitest unit |
| Annotation kind = `cross-corpus` when chain crosses corpora | Vitest unit |
| `substituteTokens('web')` emits expected `<a>` HTML against fixture | Vitest snapshot (`substitute.test.ts`) |
| `substituteTokens('plain-text')` emits expected text + URL against fixture | Vitest snapshot |
| `substituteTokens('print')` emits HTML with footnote machinery | Vitest snapshot |
| `substituteTokens('tts')` emits text-only with identifier removed | Vitest snapshot |
| Forward-compatible modes (`screen-reader`, `rss`, `share-card`, `rag`, `slack-unfurl`, `transclusion`, `tooltip`) emit shape per §3.1 | Vitest snapshot (`modes/default.test.ts`) |
| `loadLessonReferences` server helper returns serializable payload | Vitest unit (in apps/study) |
| `RenderedLesson.svelte` renders without error against fixture data | Manual smoke (`/references` demo route) |
| Demo route at `/references` works for `web` and `?mode=plain-text` | Manual smoke |
| `bun run check` exits 0 | Manual gate |
| `bun test libs/sources/` passes | Manual gate |
| `bun test apps/study/` passes | Manual gate |

## Edge Cases

- **Identifier with unknown corpus.** `extractIdentifiers` still returns it (parser is corpus-agnostic). `batchResolve` returns `entry: null`, `chain: []`, `liveUrl: null`. Substitution leaves the original Markdown link text intact (no token substitution possible without entry). The validator already errors on this case (row 1); render-time is a defensive fallback for the dev-route use case where validator is bypassed.
- **Identifier with corpus enumerated but registry has no entry.** Same as above; the validator caught it (row 2 ERROR).
- **`@text` / `@quote` against an entry whose `getIndexedContent` returns null.** Substitution emits `[content unavailable]` placeholder text and logs a `console.warn` in dev. Tests cover this explicitly so the placeholder doesn't silently regress.
- **Two adjacency groups touching.** A line like `[§91.103](airboss-ref:regs/.../103?at=2026), [§91.107](airboss-ref:regs/.../107?at=2026), and [§61.113](airboss-ref:regs/.../113?at=2026)`. The Part-91 pair forms a group; the Part-61 reference is a standalone; comma-list yields `§91.103, §91.107, §61.113` overall, but the rendered HTML emits two anchors (one for the merged Part-91 group, one for the Part-61 standalone). Tests cover this.
- **Adjacency with mixed pins.** No merge -- each identifier keeps its own anchor.
- **Reference-style links that resolve to the same target.** `extractIdentifiers` dedupes by **raw URL with pin**; the body walker emits a separate occurrence for each label-style and inline reference. Adjacency cares about source-order proximity; both forms participate.
- **An ack with `historical: true` AND a `superseder`.** Per §3.4, `historical: true` overrides; annotation is `historical`. The `superseder` field is ignored at render time but still validated by the lesson-parser.
- **`historical_lens: true` with one per-target ack overriding.** Per §3.4 last paragraph. The per-target ack wins for that identifier; every other identifier in the body gets the lesson-level historical annotation.
- **`@as-of` against an unpinned reference.** `parsed.pin` is null; substitution emits the empty string. Authors who want unpinned `@as-of` are using `?at=unpinned` and the substitution returns `'unpinned'` literally.
- **Body containing `@cite` with no surrounding link.** Not a valid token usage (tokens substitute inside link text); the literal `@cite` survives. Authors would have caught this in review or via the Phase 1 validator's empty-link-text check.
- **Markdown link that is NOT an `airboss-ref:`.** Unmodified. The renderer only touches links whose URL parses as `airboss-ref:`.
- **Cross-corpus supersession via `walkSupersessionChain`.** §6.2: when chain[0].corpus !== chain[chain.length - 1].corpus, render annotation includes `(via ${chainEnd.canonical_short} in ${chainEnd.corpus})`.
- **Empty body.** `extractIdentifiers` returns `[]`; `batchResolve` returns empty Map; `substituteTokens` returns the body unchanged.
- **Body with adjacent identifiers but `historical_lens: true`.** Adjacency merging still happens; annotation is `historical` and renders once per group. Tests cover the interaction.
- **A token name collision via `registerToken`.** The registry enforces unique names; re-registering with the same name throws (calling code is buggy, fail loud).
- **Identifier with `?at=unpinned` per §1.3 last row.** Resolves successfully (validator emits WARNING, not ERROR); pin literal `'unpinned'` is what `@as-of` substitutes.
- **`<RenderedLesson>` re-rendered with new props.** `$derived` recomputes; no manual invalidation needed. The `{@html}` reflows.
- **Server load failure (registry missing).** The server load helper surfaces an exception; SvelteKit's `+error.svelte` catches it. The demo route's helper uses the production registry so this only fires when the registry isn't initialized.

## Out of Scope (resolved, not deferred)

| Surfaced consideration | Resolution |
| --- | --- |
| `@text` / `@quote` content rendering at paragraph granularity | Drop. Phase 3 stores section-level content; paragraph-level descent is a Phase-6+ resolver enhancement. Phase 4's `@text` substitutes whole-section text. |
| Spoken-form aliases for TTS | Drop. R2 deferral; ships when `apps/audio/` lands. Phase 4's TTS mode produces a substitution that feeds the downstream TTS engine verbatim. |
| Postgres-backed indexed tier | Drop. Phase 3's JSON-file tier is the read substrate. Future swap of the resolver's `getIndexedContent` doesn't touch Phase 4. |
| Real PDF rasterization | Drop. Phase 4's `print` mode is HTML+footnotes; downstream PDF surface consumes that. |
| Real share-card image generation | Drop. Phase 4's `share-card` mode is a string; downstream image builder consumes it. |
| RAG embedding generation | Drop. Phase 4's `rag` mode emits the citation snippet shape; downstream pipeline consumes it. |
| Production lesson page integration | Drop. Phase 4 ships a `(dev)/` demo route. Production lesson pages swap their fixture for an on-disk lesson loader in a separate WP. |
| Hangar UI for ack editing | Drop. revisit.md R5; hangar revival ADR. |
| IDE language-server NOTICE-tier feedback | Drop. revisit.md R7. |
| Annual diff job | Drop. Phase 5. |
| Lesson migration tool | Drop. Phase 9. |

## Open Items

Ratified during this spec; not deferred:

- The `@deeplink` token falls back to the per-corpus `getLiveUrl(...)` since the resolver service infrastructure is dropped per ADR 019 §10. Authors writing `@deeplink` get the same URL as authors writing `@cite` (rendered to text); the difference is purely formatting (`@cite` produces a citation phrase, `@deeplink` produces just the URL).
- Annotation reason text comes from `LessonAcknowledgment.reason` verbatim. Reason slugs (e.g. `original-intact`, `scope-narrowed`) render as kebab-case in v1; humanizing them is left to a future copy pass.
- The `RenderMode` type widens from Phase 1's 4-mode union to the full 12-mode set in §3.1. Phase 1's import (`type RenderMode = 'web' | 'print' | 'tts' | 'plain-text'`) is a strict subset; no Phase 1 code breaks. The type lives in `libs/sources/src/types.ts`.
- The `RenderedLesson` Svelte component uses `{@html}` because the renderer produces HTML. Per Svelte 5 docs, `{@html}` is the right tool when the host has produced trusted HTML; the renderer's output is server-controlled. No XSS surface beyond what Markdown lessons themselves would produce; lesson body is not user-submitted content.
- Adjacency analysis runs once per body inside `substituteTokens` (after `batchResolve` populated the map). The cost is one regex pass; cheap. No need to cache across requests.
- The demo route lives under `apps/study/src/routes/(dev)/` so the user can manually inspect it without it appearing in production navigation, mirroring the `(dev)/primitives/` precedent.
- `RenderedLesson.svelte` re-renders the HTML on every prop change (via `$derived`); for typical lesson bodies this is single-digit-millisecond work. Optimization (memoize-by-body-hash) is unnecessary at this scale.
- Tests mock the production registry by hand-writing fixture `SourceEntry`s into a test helper that primes `SOURCES` for the duration of the test (mirrors Phase 2/3 helper style at `libs/sources/src/registry/__test_helpers__.ts`). The render API consumes whatever registry is registered; tests don't need a separate injection seam beyond `BatchResolveContext.resolverFactory`.
