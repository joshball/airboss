---
title: 'Tasks: Reference renderer runtime'
product: cross-cutting
feature: reference-renderer-runtime
type: tasks
status: unread
review_status: pending
---

# Tasks: Reference renderer runtime

## Pre-flight

- [ ] Read [ADR 019](../../decisions/019-reference-identifier-system/decision.md). Pay special attention to §1.4 (multi-reference adjacency), §2.5 (render-time loading + `@ab/sources/render` API), §3.1 (substitution tokens + render-mode behavior table), §3.4 (frontmatter `acknowledgments`), §6.2 (cross-corpus supersession), §6.3 (acknowledgment cascade).
- [ ] Read [revisit.md](../../decisions/019-reference-identifier-system/revisit.md) -- R2 (TTS spoken aliases), R5 (hangar UI), R7 (NOTICE-tier IDE feedback) are deferred and out of scope.
- [ ] Read prior phase WPs: [Phase 1](../reference-identifier-scheme-validator/), [Phase 2](../reference-source-registry-core/), [Phase 3](../reference-cfr-ingestion-bulk/).
- [ ] Skim `libs/sources/src/{types,parser,validator,lesson-parser,index}.ts` and `libs/sources/src/registry/{corpus-resolver,query,sources,editions}.ts` and `libs/sources/src/regs/{resolver,citation,url,locator}.ts`.
- [ ] Read this WP's [spec.md](spec.md) and [design.md](design.md).

## Phase 1 -- Types + render directory scaffold

- [ ] Extend `libs/sources/src/types.ts`:
    - Widen `RenderMode` to `'web' | 'plain-text' | 'print' | 'tts' | 'screen-reader' | 'rss' | 'share-card' | 'rag' | 'slack-unfurl' | 'transclusion' | 'tooltip'`. Phase 1 callers continue to typecheck.
    - Add `ResolvedAnnotation`, `ResolvedIdentifier`, `ResolvedIdentifierMap` interfaces per spec Data Model.
    - Add `SerializableResolvedMap`, `SerializableResolvedIdentifier`, `SerializableSourceEntry` interfaces.
    - Add `AdjacencyGroup` interface.
    - Add `Token`, `TokenContext` interfaces.
    - Add `BatchResolveContext` interface.
    - Add `LinkRenderContext` interface (the per-link state passed to a mode handler).
- [ ] Create `libs/sources/src/render/` directory.
- [ ] Create `libs/sources/src/render/index.ts` with empty exports (filled in by later phases).
- [ ] `bun run check` passes.
- [ ] Commit: `feat(sources): phase-4 types -- RenderMode widen + ResolvedIdentifier shapes`.

## Phase 2 -- Token registry + 12 default tokens

- [ ] Create `libs/sources/src/render/tokens.ts`:
    - Module-scoped `RegisteredTokens = new Map<string, Token>()`.
    - `export function registerToken(token: Token): void` -- throws on name collision.
    - `export function getToken(name: string): Token | null`.
    - `export function listTokens(): readonly Token[]`.
    - `export const __token_internal__ = { resetToDefaults(): void; }` (test-only).
    - Eagerly register the 12 §3.1 tokens at module init: `@short`, `@formal`, `@title`, `@cite`, `@list`, `@as-of`, `@text`, `@quote`, `@last-amended`, `@deeplink`, `@chapter`, `@subpart`, `@part`. Each is a small `{ name, kind, substitute }` literal.
    - `@chapter` / `@subpart` / `@part` walk the entry's id (slug-prefix) to find the parent chapter/subpart/part entry via `resolveIdentifier(parentSlug)`. When the parent isn't in the registry, return empty string.
    - `@text` / `@quote` consume `ctx.resolved.indexed?.normalizedText`. `@quote` wraps in blockquote markup.
    - `@list` consumes `ctx.group?.listText` (or the entry's own `canonical_short` for a 1-element group).
    - `@deeplink` consumes `ctx.resolved.liveUrl ?? ''` (per ADR 019 §10, resolver service is dropped; per-corpus live URL is the fallback).
- [ ] Create `libs/sources/src/render/tokens.test.ts`:
    - Each of the 12 default tokens is registered at module load.
    - `registerToken({ name: '@custom', ... })` adds it; `getToken('@custom')` returns it.
    - Re-registering throws.
    - Per-token substitution produces the §3.1 output (one test per token + a parameterized table).
    - `__token_internal__.resetToDefaults()` restores the 12 defaults.
- [ ] `bun run check` passes; `bun test libs/sources/src/render/tokens.test.ts` passes.
- [ ] Commit: `feat(sources): phase-4 token registry + 12 default tokens`.

## Phase 3 -- `extractIdentifiers` + body walker reuse

- [ ] Create `libs/sources/src/render/extract.ts`:
    - `export function extractIdentifiers(body: string): readonly string[]` -- internally uses `parseLesson('<inline>', frontmatterless body)` (or a private `walkBody` adapter to avoid the YAML overhead). Returns the deduplicated raw identifier list, source-order.
    - The dedup key is the full raw string with pin (so `?at=2026` and `?at=2027` for the same entry are two entries).
- [ ] Create `libs/sources/src/render/extract.test.ts`:
    - Empty body -> `[]`.
    - One inline link -> `[id]`.
    - Two inline links to same id same pin -> `[id]` (dedup).
    - Two inline links to same id different pins -> `[idA, idB]`.
    - Reference-style links extracted.
    - Bare URLs extracted (NOTICE-tier; renderer treats them as occurrences but doesn't substitute tokens).
    - Fenced code skipped.
    - Inline code skipped.
- [ ] `bun run check` passes; `bun test libs/sources/src/render/extract.test.ts` passes.
- [ ] Commit: `feat(sources): phase-4 extractIdentifiers via lesson-parser walker`.

## Phase 4 -- Adjacency analysis

- [ ] Create `libs/sources/src/render/adjacency.ts`:
    - `export function computeAdjacencyGroups(body: string, parsedById: ReadonlyMap<string, ParsedIdentifier>): readonly AdjacencyGroup[]` -- walks the body's link matches with byte ranges; groups runs whose interstitial text matches the §1.4 separator set; emits `AdjacencyGroup` records.
    - Range-form detection: locator-prefix-equal + last-segment numeric + contiguous N..N+k.
    - Comma-list-form fallback otherwise (using `canonical_short` from the resolved entry, but adjacency runs against parsed identifiers; the actual `listText` building moves into `substitute.ts` where it has the resolved map).
    - Actually: store the locator-only short forms in the group (so `91.167` for a CFR id without title prefix). The full `listText` ("§91.167-91.169") is built by `substitute.ts` using each member's `canonical_short`.
    - Decide: store the **range or list shape** plus the member ids; let `substitute.ts` build the final text from resolved entries. Minimizes work in this module.
- [ ] Create `libs/sources/src/render/adjacency.test.ts`:
    - Single identifier in body -> one 1-element group.
    - Two adjacent same-corpus same-pin identifiers separated by `, ` -> one 2-element group; range form when locators are contiguous.
    - Three adjacent identifiers separated by `, ` and `, and ` -> one 3-element group.
    - Same-corpus same-pin but separated by prose -> two 1-element groups.
    - Different corpora adjacent -> two 1-element groups.
    - Different pins adjacent -> two 1-element groups.
    - Range-form: `91/167`, `91/168`, `91/169` (member shape: 'range', from: 167, to: 169).
    - Comma-list-form: `91/167`, `91/169`, `91/171` (member shape: 'list').
- [ ] `bun run check` passes; `bun test libs/sources/src/render/adjacency.test.ts` passes.
- [ ] Commit: `feat(sources): phase-4 adjacency analysis -- range vs comma-list`.

## Phase 5 -- Annotation cascade

- [ ] Create `libs/sources/src/render/annotations.ts`:
    - `export function computeAnnotation(input: AnnotationInput): ResolvedAnnotation`.
    - `AnnotationInput` carries: the resolved `SourceEntry`, the supersession chain, the lesson's `acknowledgments` slice that targets this id (looked up by raw target or by reference label), `historicalLens` flag.
    - The cascade per spec Behavior section: `historical_lens` precedence, per-target ack precedence, ack cascade walk, `cross-corpus` annotation, default `none`.
- [ ] Create `libs/sources/src/render/annotations.test.ts`:
    - No acks, no supersession -> `none`.
    - Ack covering target with chain end matching `superseder` -> `covered`.
    - Ack with `historical: true` -> `historical`, regardless of supersession state.
    - Ack with `superseder` that's now superseded itself -> `chain-advanced`.
    - `historical_lens: true` and no per-target ack -> `historical`.
    - `historical_lens: true` and a per-target ack with `historical: false` -> per-target ack wins per §3.4.
    - Chain crosses corpus -> `cross-corpus`, text contains `(via §X in <corpus>)`.
- [ ] `bun run check` passes; `bun test libs/sources/src/render/annotations.test.ts` passes.
- [ ] Commit: `feat(sources): phase-4 annotation cascade per ADR 019 §3.4 + §6.3`.

## Phase 6 -- `batchResolve`

- [ ] Create `libs/sources/src/render/batch-resolve.ts`:
    - `export async function batchResolve(ids: readonly string[], ctx: BatchResolveContext): Promise<ResolvedIdentifierMap>`.
    - For each id: `parseIdentifier`, `resolveIdentifier` (pin-stripped), `walkSupersessionChain`, `getCorpusResolver(corpus)?.getLiveUrl(id, pin)`.
    - Inspect the body: if any link to this id has `@text` or `@quote` in its link text, also call `getCorpusResolver(corpus)?.getIndexedContent(id, pin)`.
    - For each id: build `AnnotationInput` from acks + chain + lens; call `computeAnnotation`.
    - Resolver factory override: when `ctx.resolverFactory` is set, use it; otherwise use the production registry.
    - Return as `ResolvedIdentifierMap`.
- [ ] Create `libs/sources/src/render/batch-resolve.test.ts`:
    - Static-only path: id resolves, chain has 1 element, no annotation.
    - Indexed-tier path: body has `@text`; indexed content present in resolved.
    - Indexed-tier path: body has only `@cite`; indexed content NOT read (assert via spy on resolver factory).
    - Supersession chain length > 1 surfaces in resolved.
    - Cross-corpus chain surfaces as `cross-corpus` annotation.
    - Unknown corpus -> `entry: null, chain: []`.
    - Empty ids -> empty map.
- [ ] `bun run check` passes; `bun test libs/sources/src/render/batch-resolve.test.ts` passes.
- [ ] Commit: `feat(sources): phase-4 batchResolve with lazy indexed-tier reads`.

## Phase 7 -- Mode handlers

- [ ] Create `libs/sources/src/render/modes/web.ts`:
    - `export function renderWebLink(ctx: LinkRenderContext): string` -- builds `<a href class>` HTML with substituted tokens, attached annotation span, optional `title=` for tooltip-bound notes.
    - For grouped links: only the first link in the group emits an anchor; the rest return empty (and `substitute.ts` swallows the interstitial separators; see Phase 8).
- [ ] Create `libs/sources/src/render/modes/web.test.ts`:
    - Single identifier with `@cite` -> `<a href="<liveUrl>" class="ab-ref ab-ref-regs">§91.103 Preflight action</a>`.
    - With annotation `covered` -> trailing `<span class="ab-ref-annotation ab-ref-covered">(...)</span>`.
    - With ack `note` -> `title="<note>"` on the anchor.
- [ ] Create `libs/sources/src/render/modes/plain-text.ts`:
    - `export function renderPlainTextLink(ctx: LinkRenderContext): string` -- substituted tokens followed by ` (<URL>)`. Annotation appended inline.
- [ ] Create `libs/sources/src/render/modes/plain-text.test.ts`:
    - Single identifier with `@cite` -> `§91.103 Preflight action (https://www.ecfr.gov/current/...)`.
    - With annotation -> `§91.103 Preflight action (https://...) (acknowledged 2030 supersession; original-intact)`.
- [ ] Create `libs/sources/src/render/modes/print.ts`:
    - `export function renderPrintLink(ctx: LinkRenderContext): string` -- substituted tokens followed by `<sup>n</sup>`; print-mode dispatcher accumulates footnote text via a context callback.
- [ ] Create `libs/sources/src/render/modes/print.test.ts`:
    - Footnote markup present.
    - Footnote text contains URL + optional ack note.
- [ ] Create `libs/sources/src/render/modes/tts.ts`:
    - `export function renderTtsLink(ctx: LinkRenderContext): string` -- substituted token text only; URL omitted; identifier removed.
- [ ] Create `libs/sources/src/render/modes/tts.test.ts`:
    - `@cite` -> `§91.103 Preflight action`.
    - `@text` -> the section's normalized text.
    - URL not present in output.
- [ ] Create `libs/sources/src/render/modes/default.ts` for the seven forward-compatible modes (`screen-reader`, `rss`, `share-card`, `rag`, `slack-unfurl`, `transclusion`, `tooltip`):
    - One small render function per mode.
    - Per-mode behavior per spec table.
- [ ] Create `libs/sources/src/render/modes/default.test.ts`:
    - One test per mode, asserting the §3.1 surface shape.
    - `share-card` truncates to 80 chars.
    - `tooltip` truncates to 200 chars.
    - `rag` includes machine-readable `<!-- airboss-ref:... -->` comment.
- [ ] `bun run check` passes; `bun test libs/sources/src/render/modes/` passes.
- [ ] Commit: `feat(sources): phase-4 render-mode handlers`.

## Phase 8 -- `substituteTokens` dispatcher

- [ ] Create `libs/sources/src/render/substitute.ts`:
    - `export function substituteTokens(body: string, resolved: ResolvedIdentifierMap, mode: RenderMode = 'web'): string`.
    - Internally: compute adjacency groups; pick the mode's render function; walk body's link matches; for each match, build `LinkRenderContext`, call the mode's render function, splice the result into the output.
    - Group handling: when a link is part of a group of size > 1, only the first link emits an anchor; subsequent member positions are swallowed (along with their interstitial separators) so the source `[link a], [link b], and [link c]` collapses to a single anchor.
- [ ] Create `libs/sources/src/render/substitute.test.ts`:
    - Web-mode end-to-end snapshot for fixture 1 (happy path).
    - Web-mode end-to-end snapshot for fixture 2 (adjacency).
    - Web-mode end-to-end snapshot for fixture 3 (acknowledgment).
    - Plain-text-mode snapshots for the same three.
    - Print-mode snapshot for fixture 1.
    - TTS-mode snapshot for fixture 1.
- [ ] `bun run check` passes; `bun test libs/sources/src/render/substitute.test.ts` passes.
- [ ] Commit: `feat(sources): phase-4 substituteTokens dispatcher with adjacency-aware group emit`.

## Phase 9 -- Serialize helpers

- [ ] Create `libs/sources/src/render/serialize.ts`:
    - `export function toSerializable(map: ResolvedIdentifierMap): SerializableResolvedMap`.
    - `export function fromSerializable(record: SerializableResolvedMap): ResolvedIdentifierMap`.
    - Round-trip `Date` <-> ISO string; round-trip Map <-> Record; round-trip readonly arrays preserved.
- [ ] Create `libs/sources/src/render/serialize.test.ts`:
    - Round-trip preserves entry, chain, liveUrl, indexed, annotation.
    - Round-trip preserves `last_amended_date` to millisecond precision.
    - Empty map round-trips.
- [ ] `bun run check` passes; `bun test libs/sources/src/render/serialize.test.ts` passes.
- [ ] Commit: `feat(sources): phase-4 serialize helpers for SvelteKit transport`.

## Phase 10 -- Public surface assembly

- [ ] Update `libs/sources/src/render/index.ts` to re-export the public API:
    - `extractIdentifiers`, `batchResolve`, `substituteTokens`
    - `registerToken`, `getToken`, `listTokens`
    - `toSerializable`, `fromSerializable`
    - The types: `ResolvedIdentifier`, `ResolvedIdentifierMap`, `SerializableResolvedMap`, `RenderMode`, `Token`, `TokenContext`, `AdjacencyGroup`, `BatchResolveContext`, `LinkRenderContext`, `ResolvedAnnotation`.
- [ ] Update `libs/sources/src/index.ts`:
    - Add `export * from './render/index.ts'` so consumers can `import { substituteTokens } from '@ab/sources'`.
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `feat(sources): phase-4 public surface for @ab/sources/render`.

## Phase 11 -- SvelteKit server load helper + component

- [ ] Create `apps/study/src/lib/server/references.ts`:
    - `export interface LoadedLessonReferences { body: string; resolved: SerializableResolvedMap; mode: RenderMode; }`
    - `export async function loadLessonReferences(body: string, acknowledgments: readonly LessonAcknowledgment[], options?: { historicalLens?: boolean; mode?: RenderMode }): Promise<LoadedLessonReferences>`.
    - Internally calls `extractIdentifiers`, `batchResolve` (with the `body`, acks, lens), and `toSerializable`. Returns the payload.
- [ ] Create `apps/study/src/lib/server/references.test.ts` (Vitest):
    - Round-trip: load yields a payload that, when fed through the component-side `fromSerializable + substituteTokens`, produces the expected HTML.
- [ ] Create `apps/study/src/lib/components/RenderedLesson.svelte` per spec Behavior:
    - `$props` for `body`, `resolved`, `mode = 'web'`.
    - `$derived` for the resolved map (via `fromSerializable`) and the rendered HTML (via `substituteTokens`).
    - Render via `{@html html}`.
- [ ] `bun run check` passes; `bun test apps/study/` passes.
- [ ] Commit: `feat(study): phase-4 RenderedLesson component + server load helper`.

## Phase 12 -- Demo route + fixtures

- [ ] Create `apps/study/src/routes/(dev)/references/fixtures/happy-path.md`:
    - Frontmatter: `title`, `week`, no acks.
    - Body: a paragraph with `[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)` and `[@short](airboss-ref:regs/cfr-14/91/167?at=2026)` and a `[@text](...)` to exercise the indexed-tier path.
- [ ] Create `apps/study/src/routes/(dev)/references/fixtures/adjacency.md`:
    - Body: a paragraph with `[§91.167](airboss-ref:regs/cfr-14/91/167?at=2026), [§91.169](airboss-ref:regs/cfr-14/91/169?at=2026), and [§91.171](airboss-ref:regs/cfr-14/91/171?at=2026)` to exercise comma-list adjacency.
    - Plus a paragraph with three contiguous (167, 168, 169) to exercise range form.
- [ ] Create `apps/study/src/routes/(dev)/references/fixtures/acknowledgment.md`:
    - Frontmatter with an `acknowledgments` entry binding to a synthetic superseded entry.
    - Body referencing that entry plus `[Walker (2017)][walker]` reference-style link binding to the ack.
    - Reference-label definition `[walker]: airboss-ref:interp/...`.
- [ ] Create `apps/study/src/routes/(dev)/references/+page.server.ts`:
    - Reads each fixture, runs through the render pipeline at the requested mode (default `web`, override via `?mode=...` query parameter), returns the data.
    - Note: `interp` corpus is not yet ingested; use `unknown:` carve-out OR prime a tiny in-test SOURCES record at server load time. The cleaner path: prime a synthetic `interp/.../walker-2017` + `interp/.../smith-2027` entry in a server-side init helper that runs on first load, since this is `(dev)/`-only.
- [ ] Create `apps/study/src/routes/(dev)/references/+page.svelte`:
    - Lists the three fixtures.
    - Renders each via `RenderedLesson`.
    - Mode toggle UI (links that update `?mode=...`).
- [ ] `bun run check` passes.
- [ ] Manual smoke: visit `/references` in dev mode; visually inspect the three fixtures in `web` and `plain-text` modes.
- [ ] Commit: `feat(study): phase-4 demo route + three render fixtures`.

## Phase 13 -- Test helpers + render-fixture priming

- [ ] Extend `libs/sources/src/registry/__test_helpers__.ts`:
    - `export function primeRenderFixtures(): void` -- inserts a small set of fixture `SourceEntry`s + `Edition`s + an `IndexedContent` map for §91.103, §91.107, §91.167, §91.168, §91.169, §91.171, plus synthetic `interp/walker-2017` and `interp/smith-2027` (with supersession pointer) for ack tests.
    - `export function clearRenderFixtures(): void` -- restores the empty registry state.
- [ ] Update render tests to call `primeRenderFixtures()` in `beforeEach` and `clearRenderFixtures()` in `afterEach`.
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `test(sources): phase-4 render fixtures via __test_helpers__`.

## Phase 14 -- Rollout doc + final verification

- [ ] Update `docs/work/plans/adr-019-rollout.md`:
    - Mark Phase 4 row Status `🟧` first (during implementation), then `✅` once PR merges.
    - Fill in WP link and PR number after PR is created.
    - Add a brief "Phase 4 -- reference-renderer-runtime" notes block summarizing what shipped and which modes are production vs forward-compatible.
- [ ] Final pass:
    - `bun run check` clean.
    - `bun test libs/sources/` passes (target: existing 100+ tests still pass + new render tests).
    - `bun test apps/study/` passes.
    - Manual smoke at `/references` in `web` mode.
    - Manual smoke at `/references?mode=plain-text`.
    - Grep for the symptom: `grep -r "@cite" apps/study/` returns no untouched literals (i.e., the renderer substituted them).
- [ ] Commit: `docs(adr-019): phase 4 rollout marker + plan update`.

## PR

- [ ] Stage files individually (no `git add -A`).
- [ ] `bunx biome format --write` on the staged files.
- [ ] Push branch.
- [ ] Open PR titled `feat(sources): ADR 019 phase 4 -- renderer runtime`. Body: link ADR 019, link Phases 1-3 PRs (#241, #246, #247), link this WP, summary of shipped surface, list of modes (4 production + 7 forward-compatible).
- [ ] Update rollout tracker with PR number.
- [ ] Notify dispatcher with the PR URL via `.ball-coord/to-dispatcher.md`.
