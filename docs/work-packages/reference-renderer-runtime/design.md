---
title: 'Design: Reference renderer runtime'
product: cross-cutting
feature: reference-renderer-runtime
type: design
status: unread
review_status: pending
---

# Design: Reference renderer runtime

## The renderer lives in `libs/sources/src/render/`, not in `apps/study/`

**Question:** Phase 4 deliverable is "renderer in `apps/study/`." Where does the bulk of code live?

**Chosen:** The render API (`extractIdentifiers`, `batchResolve`, `substituteTokens`, the 12 tokens, the mode dispatchers, the adjacency / annotation logic, the serialization helpers) lives in `libs/sources/src/render/`. The `apps/study/` deliverables are **only** the SvelteKit server load helper (one file, ~30 lines) plus the Svelte 5 component (one file, ~40 lines) plus the demo route under `(dev)/`.

**Why:**

- ADR 019 §2.5 explicitly names the surfaces that consume the render API: lesson page SSR, RAG indexer, RSS feed, share-card image builder, search-snippet builder, CLI PDF export, CLI bibliography export. Putting the renderer inside `apps/study/` would force every other surface to re-export (or worse, re-implement) it.
- The renderer is a pure function of `(body, resolved, mode)`. It has no SvelteKit dependency, no `$effect`, no DOM. A lib is the right home; an app is not.
- Phase 5 (annual diff job) needs `extractIdentifiers` to walk every lesson without depending on `apps/study/`. The annual diff runs as a CLI tool.
- The lib boundary matches the test boundary. Vitest unit tests for the render API run against `libs/sources/`; Vitest tests for the SvelteKit helper + component run against `apps/study/`. Splitting the code matches that split.

**Cost accepted:** A new `libs/sources/src/render/` subdirectory with ~10 files. Each is small. The lib's `index.ts` re-exports everything so consumers can `import { substituteTokens } from '@ab/sources'` without knowing about the subpath.

## `@ab/sources/render` is a subpath of `@ab/sources`, not its own lib

**Question:** Should the renderer be a separate `@ab/render` lib?

**Chosen:** No. It's the `render/` subpath of the existing `@ab/sources` lib. Imports go through `@ab/sources` (the lib's main `index.ts` re-exports everything) or `@ab/sources/render` (Bun's monorepo aliasing makes both paths work).

**Why:**

- ADR 019 §2.5 names the surface as `@ab/sources/render`, not a separate lib. The contract is that the renderer is part of the `@ab/sources` package.
- Splitting into two libs would create a circular-dependency risk (render needs registry queries; registry might want to render snippets in some future debug surface). Keeping them in one lib means there's one source of truth for the registry's surface.
- The lib boundary in airboss is "BC + types" granularity. The renderer is part of the `@ab/sources` BC, not a new BC.

**Cost accepted:** None concrete. The subpath import (`@ab/sources/render`) is a stylistic choice for callers who want a narrower surface; the main path import works equally.

## `RenderMode` widens, doesn't fork

**Question:** Phase 1 declared `RenderMode = 'web' | 'print' | 'tts' | 'plain-text'`. ADR 019 §3.1 specifies 11 modes. Do we add a parallel type, or widen?

**Chosen:** Widen. The Phase 1 type was forward-looking but narrow; Phase 4 expands it to the full §3.1 set in `libs/sources/src/types.ts`. Phase 1 callers (today: zero outside the type itself; the validator doesn't dispatch on mode) keep working because the four old members are a subset of the new union.

**Why:**

- Two parallel types would force callers to know "is this the validator's mode or the renderer's mode?" The mode is the same concept; one type.
- The §3.1 modes are an open-ish set. ADR 019 calls the set "specified for 11 modes" -- if a future ADR adds a 12th, widening this same union is the right place.
- TypeScript's structural typing means widening a union is non-breaking for narrow-mode callers.

**Cost accepted:** One union type that's now 11 members long. Each mode has a documented behavior in §3.1's table; the union members map 1:1 to that table.

## Tokens are an open registry, not an enum

**Question:** §3.1 declares the 12-token set as **open**. How is "open" implemented?

**Chosen:** A `Map<string, Token>` populated at module init with the 12 default tokens, plus a `registerToken(token)` function for downstream extension. `getToken(name)` returns the token or null.

**Why:**

- §3.1 explicitly says the token set is open and extension is via `@ab/sources/tokens.ts` without ADR amendment. A registry is the right shape; an enum would force ADR amendment for any new token.
- Future surfaces (audio narrative substituting different tokens; share-card preview formatter) might want corpus-specific or surface-specific tokens. The registry makes that additive.
- Each token's `substitute(ctx)` is a pure function. Tests can register a custom token and verify it dispatches correctly; the production registry stays untouched.

**Cost accepted:** Mutable global state at module init. Mitigated by:
- Test helper resets the registry to defaults between tests.
- Re-registering with the same name throws (loud error; not silent overwrite).

## `batchResolve` reads indexed-tier content lazily, not eagerly

**Question:** When the body has a `@text` token, `batchResolve` needs the indexed content. When it doesn't, the indexed-tier read is wasted I/O. How does `batchResolve` know which to read?

**Chosen:** `batchResolve` accepts the body as part of `BatchResolveContext`; it does a cheap regex scan of link text in the body to identify which identifiers have `@text`/`@quote` tokens bound to them, and only reads indexed content for those.

**Why:**

- Indexed-tier reads (Phase 3 ships JSON-file backend; future swap to Postgres) are I/O. Reading every section's text for a lesson that uses only `@cite` would be wasteful.
- The regex scan is the same cost as `extractIdentifiers`; it's already happening at substitute time. Doing it once inside `batchResolve` lets the function decide its own work.
- The alternative (split into `batchResolveStatic` + `batchResolveContent`) doubles the API surface. Lazy is the right default.

**Cost accepted:** One extra regex scan per body inside `batchResolve`. Small.

## Adjacency analysis is text-driven, not occurrence-driven

**Question:** Adjacency merge per §1.4 needs to know "are these two identifier links contiguous in source?" Does the renderer use the `IdentifierOccurrence`s from the lesson-parser, or does it walk the body itself?

**Chosen:** Walks the body itself in `adjacency.ts`. Reuses the same `INLINE_LINK_REGEX` from `lesson-parser.ts`; for each match, records the byte range in the body. Two identifiers are "adjacent" when the bytes between their match end and the next match start contain only the §1.4-allowed separators (whitespace, `,`, `;`, `and`, `or`, parens, emphasis markers).

**Why:**

- The lesson-parser's occurrences contain `SourceLocation` (line + column) but not the byte range. The renderer needs byte-level context to tell whether the prose between two links is "just a comma" or "a sentence."
- Walking the body twice (once in `extractIdentifiers`, once in `adjacency`) is cheap; both passes are linear in body length and run once per lesson.
- Separating concerns: `extractIdentifiers` knows about identifiers; `adjacency` knows about identifier proximity. Mixing them would couple the lesson-parser's surface to the renderer's needs.

**Cost accepted:** One additional regex pass over the body. Tens of microseconds per lesson at typical sizes.

## Adjacency range-form vs comma-list-form

**Question:** When three identifiers `91/167`, `91/168`, `91/169` are detected as a group, the link text is the range `§91.167-91.169`. When `91/167`, `91/169`, `91/171`, the link text is `§91.167, §91.169, §91.171`. Where does the boundary live?

**Chosen:** The locator's last segment is parsed as a number; if all members have the same locator prefix and their last segments form a contiguous N..N+k run with no gaps, the form is range. Otherwise comma-list.

**Why:**

- ADR 019 §1.4 gives the worked example: `91.167-91.171` as a contiguous run; `91.103, 91.107, 91.113` as comma-list. The contiguity test is "all numbers, contiguous, no gaps."
- The numeric parse must tolerate `91.103` being a single locator segment. The render lib parses the last segment as `<number>(\.<number>)*` (CFR allows decimal subsections like `.103a` -- handled as a separate non-numeric branch that always falls into comma-list).
- Future corpora may have non-numeric locators. For those, comma-list is always safe; the range branch is opt-in via the corpus resolver. Phase 4 ships range-form for `regs` only; `aim`, `ac`, `handbooks` etc. fall back to comma-list until their resolver opts in.

**Cost accepted:** The "contiguous numeric run" test is corpus-local. We accept that (and surface it via a `CorpusResolver` extension hook in a future phase if needed; not now).

## `LessonAcknowledgment` is the renderer's input, not a side channel

**Question:** Annotations come from frontmatter `acknowledgments`. The renderer doesn't see frontmatter; it sees body. How does the renderer get acks?

**Chosen:** `BatchResolveContext.acknowledgments: readonly LessonAcknowledgment[]` is the parameter. The route's server load helper extracts acks from frontmatter (via `parseLesson` or a dedicated lightweight parser) and passes them in.

**Why:**

- The renderer should not parse frontmatter. Lessons aren't always rendered straight from disk; transclusion may pass an in-memory body. The acks travel with the body.
- The lesson-parser already extracts acks (`LessonParseResult.acknowledgments`). Reusing that means the server load helper is a thin wrapper.
- The renderer's contract is "given body + acks + mode, produce output." Pure function. Easy to test.

**Cost accepted:** One extra parameter on `batchResolve` (and on `substituteTokens` indirectly, via the resolved map carrying per-id annotations). Trivial.

## Annotations are computed once, in `batchResolve`

**Question:** Where does the §3.4 / §6.3 cascade decision happen? In `batchResolve` (once per identifier, baked into the resolved map) or in the mode dispatcher (once per render)?

**Chosen:** In `batchResolve`. The decision is "given this resolved entry + the lesson's acks + supersession chain, what kind of annotation applies?" That's pure data; it doesn't depend on render mode. Each mode then **places** the annotation per §3.1, but the annotation kind + text is computed once.

**Why:**

- Re-computing the cascade per mode would duplicate the logic across `web.ts`, `print.ts`, etc.
- Tests for annotations live separately from tests for mode-specific HTML; the split matches the data shape.
- Mode dispatchers stay thin: their job is "given a `ResolvedIdentifier` + its annotation + its adjacency group, emit the surface text/HTML."

**Cost accepted:** `ResolvedIdentifier` carries an extra `annotation` field. Cheap; tens of bytes per id.

## Cross-corpus supersession is detected in `walkSupersessionChain`'s output

**Question:** §6.2 says when the chain crosses corpora, the renderer surfaces the original `canonical_short` plus `(via §X in regs:tsa-49)`. Where does that detection happen?

**Chosen:** In `annotations.ts`. The function reads the chain from `ResolvedIdentifier.chain`, compares `chain[0].corpus` to `chain[chain.length - 1].corpus`. If they differ, the annotation is `cross-corpus` and the text is `(via ${chainEnd.canonical_short} in ${chainEnd.corpus})`.

**Why:**

- The chain walker (`walkSupersessionChain`) is corpus-agnostic; its job is graph traversal. The cross-corpus surface is a render concern.
- Future renders may want different annotation text per cross-corpus case; centralizing in `annotations.ts` keeps the change surface small.
- The §3.4 ack cascade and the §6.2 cross-corpus annotation are both render-time decisions; same module is the right home.

**Cost accepted:** None. The chain is already in the resolved map.

## Server load helper passes serializable JSON, not Maps

**Question:** SvelteKit serializes `data` from server to client as JSON. `Map<string, ResolvedIdentifier>` and `Date` aren't JSON-safe. How does the helper return them?

**Chosen:** Two helper functions in `libs/sources/src/render/serialize.ts`:
- `toSerializable(map: ResolvedIdentifierMap): SerializableResolvedMap` -- flattens the Map to a `Record`, ISO-encodes Date fields.
- `fromSerializable(record: SerializableResolvedMap): ResolvedIdentifierMap` -- restores the Map and parses Dates.

The server helper calls `toSerializable` before returning; the component calls `fromSerializable` once at mount.

**Why:**

- SvelteKit's transport is JSON. We work with what the framework gives us.
- The component would otherwise have to do this conversion inline; centralizing keeps the component dumb.
- Tests round-trip through `toSerializable -> fromSerializable` to assert no precision loss.

**Cost accepted:** Two functions. ~30 lines. Small.

## The component renders pre-computed HTML via `{@html}`

**Question:** Should the component build HTML in Svelte, or consume HTML pre-built by the server?

**Chosen:** The component receives the resolved map, calls `substituteTokens` inside a `$derived`, and renders via `{@html}`. The server helper does NOT pre-build HTML; it only builds the resolved map.

**Why:**

- Mode flexibility. The same resolved map can render to web, plain-text, print, etc. depending on the component's `mode` prop. Pre-building HTML would lock the surface to one mode.
- The substitution is cheap (regex pass over body). Doing it client-side once per render is fine for typical lesson sizes (~10-50 identifiers).
- `{@html}` is the right tool when the producer is server-controlled. Lessons are not user input; they're authored in `course/`. The render output is trusted.

**Cost accepted:** Server-side substitution duplicate when SSR + hydration both run. For SvelteKit, SSR runs once; hydration uses the same `data`; substitution runs both server-side (during SSR) and client-side (during hydration). Acceptable; if it ever shows up as a perf problem, memoize at the `$derived` boundary.

## Demo route under `(dev)/` mirrors `primitives` precedent

**Question:** Where does the demo route live?

**Chosen:** `apps/study/src/routes/(dev)/references/+page.{server.ts,svelte}`. Three fixture lessons in `(dev)/references/fixtures/`. Mode-toggle UI on the page.

**Why:**

- The `(dev)/primitives/` route already exists for hand-eyeballing the primitives lib. The renderer needs the same; the precedent is right there.
- Hidden from production navigation (the `(dev)` group is convention for "internal demo").
- Three fixtures cover the three behavior families (happy path, adjacency, ack). One file each; ~20 lines each.

**Cost accepted:** Three small fixture files plus a route. Total ~150 lines. Worth it for the visual smoke test.

## Behavior of the five forward-compatible modes

**Question:** ADR 019 §3.1 specifies 11 modes. Phase 4 ships 4 production modes. What does the spec say about the other 7?

**Chosen:** Implement them all, even when downstream consumers don't yet exist. Each is a small function (5-15 lines) that emits the §3.1-specified surface. They share the same `LinkRenderContext` plumbing as the production modes.

| Mode | Behavior |
| --- | --- |
| `screen-reader` | Wraps the anchor in a `<span aria-label>` with the `@cite`-form annotation included. |
| `rss` | Same as `web` but `<a href>` URLs are absolute (the per-corpus live URL is already absolute). |
| `share-card` | Token-substituted text only, identifier stripped, truncated to 80 chars per §3.1. |
| `rag` | `@formal`-form text followed by ` (${liveUrl})` followed by ` <!-- airboss-ref:... -->` machine-readable comment. |
| `slack-unfurl` | Title from `@cite`, description from the lesson title (passed in via context). |
| `transclusion` | Same as `web`; pin preserves per §3.1 transclusion-preserves-pins rule (the pin lives on the resolved entry's `raw` field; transclusion doesn't touch it). |
| `tooltip` | Token-substituted text, truncated to 200 chars per §3.1. |

**Why:**

- ADR 019 §3.1 commits the renderer to all 11 modes. Shipping 4 + 7 stubs would be a known-issue bait per CLAUDE.md prime directive.
- Each mode's behavior is small; the cost of "do it now" vs "do it later" is roughly equal except that "do it now" means the contract is fully specified and the test surface is fully covered.
- Future surfaces consume these modes without needing to amend Phase 4's API. Each mode is an opt-in by the consumer.

**Cost accepted:** Five extra small mode functions plus tests. ~150 lines total. No new abstraction to maintain.

## Adjacency analysis runs after `batchResolve`, not before

**Question:** Does the renderer need to know adjacency before resolving (so `batchResolve` can compute group-aware annotations)?

**Chosen:** No. Adjacency is a presentation concern: it affects the link text (`@list` substitution) and whether to emit a single anchor for a group. It doesn't affect the resolved entry, the chain, or the annotation kind. Adjacency runs inside `substituteTokens`, after `batchResolve` has populated the map.

**Why:**

- Annotations are per-identifier; adjacency is per-group. Decoupling lets each be tested in isolation.
- The single-occurrence `@list` case (a one-element group) is naturally handled: a "group" of size 1 still has a `listText` field equal to the entry's `canonical_short`.
- Tests for `batchResolve` don't need to think about adjacency at all.

**Cost accepted:** None.

## Test helper for the render-API tests

**Question:** Render tests need fixture `SourceEntry`s, fixture `Edition`s, and sometimes a fixture `getIndexedContent` response. How are these primed?

**Chosen:** Reuse the Phase 2/3 helper at `libs/sources/src/registry/__test_helpers__.ts` (extended with a `primeRenderFixtures()` helper that loads a small fixture set: §91.103, §91.107, §91.167, §91.169, §91.171, plus a synthetic superseded interp letter). Render tests `import { primeRenderFixtures, resetRegistry } from '../registry/__test_helpers__';` and call them in `beforeEach` / `afterEach`.

**Why:**

- The Phase 2/3 helper is the established pattern; render tests should follow it.
- Synthetic supersession + ack fixtures are small; one or two synthetic entries suffice.
- The helper is test-only (`__test_helpers__/` directory + `vitest.config.ts` ignore guard); production never imports it.

**Cost accepted:** ~50 extra lines in the test helper. Cheap.
