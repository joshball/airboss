---
id: flightbag-citation-url-migration
title: 'Spec: Flightbag citation URL migration'
product: study
category: platform
status: in-flight
agent_review_status: pending
human_review_status: pending
created: 2026-05-14
owner: agent
depends_on: []
unblocks: []
tags:
  - citations
  - urls
  - flightbag
  - routes
  - cross-origin
  - reference-rendering
legacy_fields:
  feature: flightbag-citation-url-migration
  type: spec
---

# Spec: Flightbag citation URL migration

Migrate the six remaining `LIBRARY_*` route constants that have live callers to flightbag-direct URLs via the canonical `urlForReference()` helper. Today every citation click and every library / handbook card href emits a `/library/*` URL on the study origin, which 301-redirects to the flightbag origin. That works, but every redirect is an extra HTTP round-trip the citation chip is paying on every click. This WP closes the gap so the link the browser receives is already the flightbag URL.

## Why this WP exists

The library reader migrated from study to flightbag in WP-FLIGHTBAG-READER-UX. Study still ships every `/library/*` path as a 301 to the flightbag equivalent (see `apps/study/src/hooks.server.ts`). The redirect protects existing links, but it is a known transitional shape, not the end state. The six constants with live callers in this WP's scope are the residual debt -- they are the only sites in the repo still emitting study-local URLs by construction.

Three forces make this debt worth paying off now:

- Every citation chip and library card click costs an extra round-trip plus a 301 in the network tab. The chip is a hot path; the cost compounds across a reading session.
- The constants are marked `@deprecated` in `libs/constants/src/routes.ts`, which means every new piece of code in this area has to reason about which constant to use. The deprecation comments are advisory; this WP makes them enforceable by removing the names entirely.
- The flightbag URL shape requires an `edition` argument that the study-local shape did not. Every caller that emits a handbook chapter / section URL today is silently building a URL that lacks the edition pin -- the 301 redirect resolves the edition on the server, but a flightbag-direct emit forces the caller to know the edition. That is a per-call-site decision worth surfacing.

A documented pattern already covers cross-origin reference URLs: [`urlForReference()` in `libs/sources/src/url-for-reference.ts`](../../../libs/sources/src/url-for-reference.ts). It owns the `airboss-ref:` URI scheme, parses per-corpus locators, dispatches to the right `FLIGHTBAG_*` route, and handles edition resolution + fallback when the URI is malformed. This WP routes every remaining call site through that helper instead of letting each site re-derive the URL from a `documentSlug` + `chapter` + `section` triple.

## The six constants in scope

| Constant                      | Callers                                                                                                                                                                                                                                                          | Migration target                                                           | Why hard                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `LIBRARY`                     | `libs/bc/study/src/library-card-projection.ts:263` (handbook card fallback href)                                                                                                                                                                                 | `FLIGHTBAG_HOME` on flightbag origin                                       | BC code has no `url` access; the projection contract has to thread the flightbag origin in.                 |
| `LIBRARY_REGULATIONS_SECTION` | `libs/help/src/loaders/cfr-sections.ts:75`, `aim-sections.ts:64`, `fts-passages.ts:261,268,274` (5 sites)                                                                                                                                                        | `FLIGHTBAG_CFR_SECTION` / `FLIGHTBAG_AIM_SECTION` / `FLIGHTBAG_AC_SECTION` | Symmetric helper today; flightbag splits by corpus. `urlForReference()` already kind-switches.              |
| `LIBRARY_HANDBOOK`            | `libs/bc/study/src/library-card-projection.ts:263`, `libs/aviation/src/ui/handbooks/HandbookCard.svelte:28`, `apps/study/.../build-handbook-tree.server.ts:120,132` (4 sites)                                                                                    | `FLIGHTBAG_HANDBOOK(slug, edition)`                                        | Flightbag URL requires `edition`; callers currently pass `documentSlug` only.                               |
| `LIBRARY_HANDBOOK_CHAPTER`    | `libs/bc/study/src/references.ts:788,1055,1056`, `libs/aviation/src/ui/handbooks/HandbookChapterListItem.svelte:30`, `libs/help/src/loaders/handbook-sections.ts:75`, `libs/help/src/loaders/fts-passages.ts:249`, `build-handbook-tree.server.ts:119` (7 sites) | `FLIGHTBAG_HANDBOOK_CHAPTER(slug, edition, chapter)`                       | Same edition-plumbing issue. The citation resolver in `references.ts` is pure and reachable from `.svelte`. |
| `LIBRARY_HANDBOOK_SECTION`    | `libs/bc/study/src/references.ts:789,1057`, `libs/aviation/src/ui/handbooks/HandbookSectionListItem.svelte:33`, `libs/help/src/loaders/handbook-sections.ts:76`, `libs/help/src/loaders/fts-passages.ts:250` (5 sites)                                           | `FLIGHTBAG_HANDBOOK_SECTION(slug, edition, chapter, section)`              | Same.                                                                                                       |
| `LIBRARY_AIRCRAFT`            | `libs/bc/study/src/library-card-projection.ts:369` (POH card)                                                                                                                                                                                                    | No clean target -- flightbag has no per-aircraft reader                    | POH card href today resolves to a 410 Gone on study. No flightbag equivalent yet.                           |

Call-site counts collapse to 23 references across 9 files. Five of those files are reachable from the browser (`library-card-projection.ts`, `references.ts`, two `HandbookListItem` svelte components, one `HandbookCard` svelte component); the other four are server-side (`build-handbook-tree.server.ts`, three help loaders).

## Architectural decisions

### Decision 1 -- adopt `urlForReference()` as the single URL helper

Two paths are available:

- **A.** Plumb `flightbagOrigin` + `edition` through the projection contract end-to-end. Each call site grows arguments; the projection's input type gains fields; every consumer is touched.
- **B.** Adopt `urlForReference()` from `@ab/sources`. The helper already owns the `airboss-ref:` URI scheme, parses per-corpus locators, dispatches to the right `FLIGHTBAG_*` route function, and falls back to `FLIGHTBAG_HOME` on malformed input. Cross-origin prefixing happens in the caller via `siblingOrigin(url, HOST_PREFIXES.FLIGHTBAG)` (the existing pattern documented in `libs/constants/src/routes.ts`).

This WP picks **B**. Rationale:

- The canonical reference is `docs/ingestion-pipeline/reference-citations-pattern.md` ("Citations / cross-references" in CLAUDE.md "Before You Build"). It names `urlForReference()` as the helper every citation surface should use.
- The helper already kind-switches over corpora (handbook / AIM / CFR / AC / ACS / NTSB-ALJ / SAFO / InFO), so Decision 3 (loader signature change) collapses into "stop building the URL by hand; call `urlForReference(uri)`".
- Edition resolution lives in one place. The helper already requires an edition segment for handbooks and falls back gracefully when none is pinned. Callers that have a `ReferenceRow` get a sibling `urlForReferenceRow(row)` shim that builds the URI from the row's fields and delegates -- one helper, one place to maintain.
- Migrations of new corpora (SAFO live route, per-aircraft surface, NTSB-ALJ) become additive: one branch in `urlForReference()`, every consumer picks it up.

The single-helper choice is load-bearing for the design and is the reason this WP is achievable as one phased effort.

### Decision 2 -- POH / AFM card renders chrome-only until flightbag ships per-aircraft

`LIBRARY_AIRCRAFT(slug)` is the POH card href in `library-card-projection.ts:369`. The corresponding study route was retired in WP-FLIGHTBAG-READER-UX and now returns 410 Gone. The flightbag app does not have a per-aircraft reader.

Three options were considered:

- **A.** Render POH cards without an `href` (chrome-only) until flightbag ships a per-aircraft surface. The card still displays manufacturer / model / edition / description / topics / external link, but the body is not a link.
- **B.** Keep emitting the 410-Gone URL via a literal so the constant disappears but the behaviour is preserved. Equivalent to the current state; just removes the `LIBRARY_*` indirection.
- **C.** Block this WP on the `flightbag-poh-surface` WP landing first.

This WP picks **A**. Rationale:

- (B) ships a known-broken URL on purpose. Zero tolerance for known issues per CLAUDE.md prime directive; a 410 URL is a known issue.
- (C) couples this URL-migration WP to a content-shape WP (per-aircraft surface). The two are independent; coupling them blocks both indefinitely.
- (A) is a one-line projection-shape change: the `PohCard` variant carries `href: string | null` instead of `href: string`, and the renderer treats `null` as "render the card body as chrome, not as a link." The chrome variant is already a documented pattern for cards whose target hasn't shipped yet (matches the existing AIM / PCG / ACS / PTS card shape today, which renders without an in-app `href` -- only an `external` link).

The trigger to re-add `href` is documented: when a flightbag `/aircraft/<slug>` reader ships. That is the canonical revisit trigger for this OUT-OF-SCOPE entry; future agents do not have to guess.

### Decision 3 -- help loaders call `urlForReference()` instead of building URLs by hand

The four help loaders (`cfr-sections.ts`, `aim-sections.ts`, `handbook-sections.ts`, `fts-passages.ts`) each currently build a URL inline from `documentSlug` + a derived `kind` enum + a code string. Each loader has its own kind-switch logic that mirrors what `urlForReference()` already implements.

If Decision 1 = B, this is the resulting shape: each loader joins to the `referenceSection.airbossRef` column (the canonical `airboss-ref:` URI already stored per ADR + content-citations work), passes the URI to `urlForReference()`, and prefixes the flightbag origin via `siblingOrigin(url, HOST_PREFIXES.FLIGHTBAG)`. The four kind-switches collapse into zero -- the helper handles it. The loader signatures gain a `request.url` argument (already available on every loader entry point since the loaders run inside server endpoints).

The remaining work in the loader is database join + URI projection -- the URL construction logic disappears.

## Scope

### In

- Adopt `urlForReference()` (already shipped at `libs/sources/src/url-for-reference.ts`) as the canonical URL helper for every citation chip / library card / help-result href.
- Add a sibling helper `urlForReferenceRow(row: ReferenceRow)` in `libs/sources/src/url-for-reference.ts` that builds an `airboss-ref:` URI from a reference row's `kind` + `documentSlug` + `edition` fields and delegates to `urlForReference()`. Keeps the projection / list-item callers from constructing URI strings inline.
- Migrate the five browser-reachable call sites:
  - `libs/bc/study/src/library-card-projection.ts` -- swap `ROUTES.LIBRARY_HANDBOOK(slug)` and `ROUTES.LIBRARY` for `urlForReferenceRow(ref)`. Swap `ROUTES.LIBRARY_AIRCRAFT(...)` for `href: null` on the `PohCard` variant.
  - `libs/bc/study/src/references.ts` (`resolveHandbookCitationUrl`, `buildHandbookUrlFallback`) -- swap the inline `LIBRARY_HANDBOOK_CHAPTER` / `LIBRARY_HANDBOOK_SECTION` calls for `urlForReference()` against the `airboss-ref:` URI the citation already carries.
  - `libs/aviation/src/ui/handbooks/HandbookCard.svelte` -- swap `ROUTES.LIBRARY_HANDBOOK(slug)` for `urlForReferenceRow(...)`. Caller passes the row.
  - `libs/aviation/src/ui/handbooks/HandbookChapterListItem.svelte` and `HandbookSectionListItem.svelte` -- swap their inline `LIBRARY_HANDBOOK_*` calls for `urlForReference()` against a constructed URI.
- Migrate the four server-side call sites:
  - `apps/study/src/lib/server/build-handbook-tree.server.ts` -- swap the three `LIBRARY_HANDBOOK_*` calls (lines 119/120/132) for `urlForReference()` / `urlForReferenceRow()` plus the flightbag origin prefix.
  - `libs/help/src/loaders/cfr-sections.ts` -- swap `LIBRARY_REGULATIONS_SECTION` for `urlForReference()` against the row's `airbossRef`.
  - `libs/help/src/loaders/aim-sections.ts` -- same.
  - `libs/help/src/loaders/handbook-sections.ts` -- same.
  - `libs/help/src/loaders/fts-passages.ts` -- swap the four `ROUTES.LIBRARY_*` references for `urlForReference()` against the row's URI.
- POH card chrome-only: `library-card-projection.ts` emits `href: null` for the POH variant. The renderer renders the card body as chrome (not a link) when `href === null`. The `external` link (manufacturer-labelled) is preserved when present.
- Remove all six `LIBRARY_*` constants from `libs/constants/src/routes.ts` after every caller is migrated. This is the close-out signal that the migration is complete.
- Cross-origin prefixing: every browser-rendered chip / card href that comes out of `urlForReference()` is wrapped with `siblingOrigin(url, HOST_PREFIXES.FLIGHTBAG)` at the call site (study app rendering a citation -> flightbag origin; flightbag app rendering same -> same-origin, no prefix). The wrap pattern is documented in `libs/constants/src/routes.ts` and exists in adjacent code.
- Tests: extend `url-for-reference.test.ts` to cover every corpus / locator shape currently emitted by the six migrated constants. Add regression tests for the citation-chip resolver in `references.ts` (handbook + cfr + aim + ac kinds, with and without section locators). Add a regression test for the POH card chrome-only shape.
- Manual test plan: every migrated surface walked in a real browser with the network tab open; the assertion is "no 301 on click of any citation chip or library card."
- Phasing: five phases (A through E). Each phase ships its own PR.

### Out

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

## Anchor docs

- [`libs/constants/src/routes.ts`](../../../libs/constants/src/routes.ts) -- the six constants under migration and the `FLIGHTBAG_*` shapes they map to. Top-of-file comment documents the redirect transitional shape.
- [`libs/sources/src/url-for-reference.ts`](../../../libs/sources/src/url-for-reference.ts) -- the canonical helper this WP adopts everywhere. Already kind-switches per corpus; already handles malformed-input fallback.
- [`libs/bc/study/src/library-card-projection.ts`](../../../libs/bc/study/src/library-card-projection.ts) -- the BC projection that emits library card hrefs. Three call sites to migrate here.
- [`libs/bc/study/src/references.ts`](../../../libs/bc/study/src/references.ts) -- the citation resolver that emits chip hrefs. Pure function; reachable from `.svelte` at hydration. Three call sites here.
- [`libs/help/src/loaders/`](../../../libs/help/src/loaders/) -- the four server-side help loaders. Five call sites across these files.
- [`apps/study/src/lib/server/build-handbook-tree.server.ts`](../../../apps/study/src/lib/server/build-handbook-tree.server.ts) -- the handbook tree builder. Three call sites.
- [`docs/ingestion-pipeline/reference-citations-pattern.md`](../../ingestion-pipeline/reference-citations-pattern.md) -- the canonical citations / cross-references pattern doc. Names `urlForReference()` as the helper every surface should use.
- [`apps/study/src/hooks.server.ts`](../../../apps/study/src/hooks.server.ts) -- the 301-redirect layer. Stays in place for now; this WP eliminates the 301s on hot paths but does not remove the redirect (legacy bookmarks + content authored before the migration still rely on it).
- [WP-FLIGHTBAG-READER-UX](../flightbag-reader-ux/spec.md) (if extant) -- the WP that originally migrated the reader. This WP closes that WP's residual debt.
- [ADR 023](../../decisions/023-flightbag-app-surface/) (or the canonical ADR naming flightbag as the reader surface; this WP's spec links the ADR if/when its numbering is confirmed).
- [ADR 025](../../decisions/025-wp-frontmatter-contract/decision.md) -- WP frontmatter contract.

## Architecture overview

```text
caller surfaces                                   helper                      route
---------------                                   ------                      -----
.svelte chip / card  ->  airboss-ref: URI  ->  urlForReference(uri)  ->  ROUTES.FLIGHTBAG_*(...)
.svelte chip / card  ->  ReferenceRow      ->  urlForReferenceRow(row)
                                                  |
                                                  v
                                               builds airboss-ref: URI
                                                  |
                                                  v
                                               urlForReference(uri)
                                                  |
                                                  v
                                               ROUTES.FLIGHTBAG_*(...)

server help loader   ->  reference_section.airboss_ref  ->  urlForReference(uri)  ->  ROUTES.FLIGHTBAG_*(...)

caller (study app)   ->  siblingOrigin(url, HOST_PREFIXES.FLIGHTBAG) + path  ->  flightbag origin
caller (flightbag)   ->  path only                                            ->  same-origin
```

The shape has three pieces:

1. The caller produces an `airboss-ref:` URI (preferred) or a `ReferenceRow` (compat shim).
2. `urlForReference()` (or `urlForReferenceRow()`) maps it to a flightbag path.
3. The caller prefixes the flightbag origin when it is rendering from a non-flightbag app. The flightbag app uses the path verbatim.

## Success criteria

A walked test plan + a clean check pipeline is the close-out signal. Concretely:

- Every citation chip click in study / hangar / sim renders a flightbag URL in `href` -- no `/library/*` in any rendered DOM.
- Every library card href in study / hangar / sim renders a flightbag URL (or `null` for POH cards, which are intentionally chrome-only).
- Every help-search result item in study / hangar renders a flightbag URL.
- No 301 redirect for any of the migrated surfaces when clicked in a real browser. Network tab confirms.
- All six `LIBRARY_*` constants are deleted from `libs/constants/src/routes.ts`. The route lint passes.
- `url-for-reference.test.ts` covers every corpus shape the six migrated constants previously emitted. The handbook + CFR + AIM + AC paths each have at least one section-level test.
- `bun run check` clean (0 errors, 0 warnings).
- POH cards render with `href: null` and a manufacturer-labelled external link only. Manual test confirms the card body is not a link.

## Phasing

Five phases. Each ships its own PR. Per-phase detail in [tasks.md](./tasks.md).

| Phase | Scope                                                                      | Risk                                                                |
| ----- | -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| A     | Add `urlForReferenceRow()` helper to `libs/sources`; tests.                | Low. Additive only. No call-site changes.                           |
| B     | Migrate `references.ts` + `library-card-projection.ts` (BC + projection).  | Medium. Browser-reachable; real-browser load required before merge. |
| C     | Migrate the four help loaders (server-side).                               | Low. Pure server path; tests + walk-through.                        |
| D     | Migrate the svelte list items + handbook card + tree builder + POH chrome. | Medium. Browser-reachable; visual diff on cards expected.           |
| E     | Delete the six `LIBRARY_*` constants from routes.ts; close.                | Low. Lint + `bun run check`; the deletion is the close-out signal.  |

## Open questions resolved during spec authoring

- **Q: Where does `urlForReferenceRow()` live -- `libs/sources` or `libs/bc/study`?**
  A: `libs/sources`. The helper owns the `airboss-ref:` URI scheme; the shim is a thin URI-builder over the row's fields and stays in the same file as `urlForReference()`. Keeps the URL-helper surface in one place.

- **Q: Should the migrated helpers preserve the existing 301 layer in study hooks?**
  A: Yes. The redirect remains in place for legacy content authored before the migration and for any external link the platform has shipped. This WP removes the redirect from the platform's own emit paths; it does not retire the redirect itself.

- **Q: How is the flightbag origin discovered when the caller has no `URL` object (pure BC code)?**
  A: The BC does not prefix the origin. The projection emits a path; the consumer (svelte component or `+page.server.ts`) wraps with `siblingOrigin(url, HOST_PREFIXES.FLIGHTBAG)` at the render site. The `urlForReference()` contract is unchanged.

- **Q: Why not retire the `/library/*` redirect entirely after this WP?**
  A: Out of scope; legacy bookmarks and content-authored links rely on it. The redirect retirement is a follow-on with its own user-facing impact (broken bookmarks) that needs a separate decision. Captured in [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

- **Q: Why not introduce a biome rule blocking new uses of `LIBRARY_*` rather than relying on the deprecation comments?**
  A: The constants are getting deleted in Phase E. After deletion, the names are no longer importable; a biome rule is redundant. Captured in [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md) with the trigger "if the constants resurrect for any reason."
