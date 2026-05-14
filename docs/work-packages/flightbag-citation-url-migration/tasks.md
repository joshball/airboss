---
id: flightbag-citation-url-migration
title: 'Tasks: Flightbag citation URL migration'
product: study
category: platform
status: draft
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
  - tasks
legacy_fields:
  feature: flightbag-citation-url-migration
  type: tasks
---

# Tasks: Flightbag citation URL migration

Phased plan for [spec.md](./spec.md). Order is dependency-driven: helper first (A), then the BC-side migrations on the hot citation path (B), then the server-side help loaders (C), then the svelte UI components plus the tree builder plus POH chrome-only (D), then constant deletion + close (E).

Each phase opens its own PR titled `feat(citation-urls): <phase> -- <summary>`.

Depends on: none. `urlForReference()` already exists at `libs/sources/src/url-for-reference.ts` and ships every required `FLIGHTBAG_*` route dispatch.

## Pre-flight

- [ ] Read [spec.md](./spec.md), [design.md](./design.md), [test-plan.md](./test-plan.md), [user-stories.md](./user-stories.md), [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md), [CONSUMER-CONTRACT.md](./CONSUMER-CONTRACT.md) end-to-end.
- [ ] Read [`libs/sources/src/url-for-reference.ts`](../../../libs/sources/src/url-for-reference.ts) and its tests at `libs/sources/src/url-for-reference.test.ts` -- the helper this WP adopts.
- [ ] Read [`libs/constants/src/routes.ts`](../../../libs/constants/src/routes.ts) -- the six `LIBRARY_*` constants under migration plus the `FLIGHTBAG_*` shapes they map to. Note the `siblingOrigin` + `HOST_PREFIXES.FLIGHTBAG` pattern.
- [ ] Read [`libs/constants/src/hosts.ts`](../../../libs/constants/src/hosts.ts) for the cross-origin helper.
- [ ] Read [`libs/bc/study/src/library-card-projection.ts`](../../../libs/bc/study/src/library-card-projection.ts) and [`libs/bc/study/src/references.ts`](../../../libs/bc/study/src/references.ts) -- the two BC files with citation / card URL emit logic.
- [ ] Read [`docs/ingestion-pipeline/reference-citations-pattern.md`](../../ingestion-pipeline/reference-citations-pattern.md) -- the canonical citation pattern doc.
- [ ] Verify the dev DB is reachable: `bun run db status`.
- [ ] Run `bun run check` -- 0 errors before starting.

## Implementation

### Phase A -- `urlForReferenceRow()` helper (foundation)

Foundational. Adds the row-shaped sibling to `urlForReference()` so projection / list-item callers can hand off a row and let the helper build the URI. Pure-code with unit tests; no call-site changes.

PR title: `feat(citation-urls): Phase A -- urlForReferenceRow helper`.

#### A.1 Helper

- [ ] In `libs/sources/src/url-for-reference.ts`, add `export function urlForReferenceRow(row: ReferenceRow): string` next to `urlForReference()`. The helper:
  - Reads `row.kind`, `row.documentSlug`, `row.edition`.
  - Builds an `airboss-ref:` URI per corpus (`airboss-ref:handbooks/<slug>/<edition>` for handbooks, `airboss-ref:regs/<slug>` for CFR, `airboss-ref:aim/<slug>` for AIM, `airboss-ref:ac/<docNumber>/<revision>` for AC, etc.).
  - Delegates to `urlForReference(uri)`.
  - Returns `ROUTES.FLIGHTBAG_HOME` when the row's kind is not yet routable on flightbag (POH today; the spec captures this).
- [ ] Add a JSDoc on the export explaining "thin shim over `urlForReference()` for callers that have a `ReferenceRow` instead of a URI." Cite this WP and the citations pattern doc.
- [ ] Import the `ReferenceRow` type from `@ab/bc-study` (type-only import; the runtime barrel re-exports the row type).
- [ ] Re-export from `libs/sources/src/index.ts` alongside `urlForReference`.

#### A.2 Tests

- [ ] Extend `libs/sources/src/url-for-reference.test.ts` (or add `url-for-reference-row.test.ts` adjacent) with row-shape tests for:
  - Handbook row -> `FLIGHTBAG_HANDBOOK(slug, edition)`.
  - CFR row -> `FLIGHTBAG_CFR_PART(title, part)`.
  - AIM row -> `FLIGHTBAG_AIM`.
  - AC row -> `FLIGHTBAG_AC(doc, rev)`.
  - ACS row -> `FLIGHTBAG_ACS(slug)`.
  - POH row -> `FLIGHTBAG_HOME` (no flightbag per-aircraft surface today; the helper falls back per design).
  - SAFO / INFO / NTSB rows -> `FLIGHTBAG_HOME` (consistent with `urlForReference()` behaviour).
- [ ] Run `bun test libs/sources/src/url-for-reference` -- all green.

#### A.3 Close Phase A

- [ ] `bun run check` clean.
- [ ] Commit (`feat(citation-urls): Phase A -- urlForReferenceRow helper`).
- [ ] Open + merge PR.

### Phase B -- migrate the BC / projection (hot citation + library card paths)

Migrates the two browser-reachable BC files: `library-card-projection.ts` and `references.ts`. After this phase, every citation chip and library card href is going through `urlForReference()` (or `urlForReferenceRow()`).

PR title: `feat(citation-urls): Phase B -- BC citation + library card paths`.

#### B.1 `library-card-projection.ts`

- [ ] Import `urlForReferenceRow` from `@ab/sources`.
- [ ] Handbook variant (line 263): replace `ROUTES.LIBRARY_HANDBOOK(ref.documentSlug)` with `urlForReferenceRow(ref)`. Replace the `ROUTES.LIBRARY` fallback with `ROUTES.FLIGHTBAG_HOME`.
- [ ] POH variant (line 369): change `href: ROUTES.LIBRARY_AIRCRAFT(ref.documentSlug)` to `href: null`. Adjust the `LibraryCardPayload` type so the `PohCard` variant's `href` is `string | null`.
- [ ] Verify other variants (CfrPartCard / AcCard / AcsCard / etc.) -- those already emit `external` links, not `LIBRARY_*` constants. No change needed there.

#### B.2 POH card renderer

- [ ] Update the `PohCard.svelte` (or equivalent) component to render its body as chrome (a `<div>` instead of `<a>`) when `href === null`. Manufacturer-labelled `external` link is preserved.
- [ ] Visual regression: confirm card height / spacing matches the link-variant; no layout shift.

#### B.3 `references.ts`

- [ ] `resolveHandbookCitationUrl` (line 781-790): replace the inline `LIBRARY_HANDBOOK_CHAPTER` / `LIBRARY_HANDBOOK_SECTION` calls with `urlForReference()` against an `airboss-ref:` URI built from `ref.documentSlug` + `ref.edition` + the locator's `chapter` / `section`. Keep the null-on-missing-ref guard.
- [ ] `buildHandbookUrlFallback` (line 1045-1058): same swap; build the URI from `documentSlug` + the consumed segments.
- [ ] Verify the citation render still resolves to the same flightbag path it would have via the 301. Tests cover this; manual walk-through confirms.

#### B.4 Tests

- [ ] Add unit tests for `resolveHandbookCitationUrl` covering handbook chapter (no section) and handbook section (with section) shapes. Assert the result starts with `/handbook/`.
- [ ] Add unit tests for `buildHandbookUrlFallback` covering `editionConsumed=true` and `editionConsumed=false` paths.
- [ ] Add regression tests for `projectLibraryCard` (the `library-card-projection.ts` entry) -- assert the handbook variant emits a `/handbook/<slug>/<edition>` href and the POH variant emits `href: null`.

#### B.5 Browser walk

- [ ] `bun scripts/dev.ts study` (parent repo, not worktree). Log in as Abby (`abby@airboss.test`).
- [ ] Open `/memory/<a card with handbook citation>`. Click the citation chip. Network tab: no `/library/` URL anywhere; no 301 status.
- [ ] Open `/reps/<a session with handbook citation>`. Same checks.
- [ ] Open `/library`. Click a handbook card. Same checks.
- [ ] Open `/library`. Find a POH card. Confirm the body is chrome (not a link); the manufacturer external link is present.

#### B.6 Close Phase B

- [ ] `bun run check` clean.
- [ ] Commit (`feat(citation-urls): Phase B -- BC citation + library card paths`).
- [ ] Open + merge PR.

### Phase C -- migrate the help loaders (server-side)

Migrates the four help loaders. All four are server-side; no browser walk required, but tests cover the path.

PR title: `feat(citation-urls): Phase C -- help loader citation URLs`.

#### C.1 `cfr-sections.ts`

- [ ] Import `urlForReference` from `@ab/sources`.
- [ ] At line 75, replace `ROUTES.LIBRARY_REGULATIONS_SECTION(cfrKind, r.documentSlug, r.code)` with `urlForReference(r.airbossRef)`. Add the join to `referenceSection.airbossRef` in the query if not already present.
- [ ] Verify the loader's return shape is unchanged (the `href` field still carries a string).

#### C.2 `aim-sections.ts`

- [ ] Same swap at line 64.

#### C.3 `handbook-sections.ts`

- [ ] Same swap at lines 75-76 (both chapter and section paths collapse to `urlForReference(r.airbossRef)`).

#### C.4 `fts-passages.ts`

- [ ] `mapReferenceKind` (lines 240-279): the function returns a per-kind `href: (slug, code) => ...` closure. Replace the four closures with a single `href: (_slug, _code, airbossRef) => urlForReference(airbossRef)` shape. Pass the URI through the call-site at lines 249-250 (handbook) and 261/268/274 (CFR/AIM/AC).
- [ ] Verify the `SearchResult.href` shape upstream still works.

#### C.5 Tests

- [ ] Add a focused test per loader: feed a known URI shape, assert the loader emits the expected flightbag URL. The existing loader tests already shape the join; this adds an `href` assertion.

#### C.6 Close Phase C

- [ ] `bun run check` clean.
- [ ] Manual smoke: open `/study/help/search?q=cessna`. Click a result. Network tab confirms flightbag-direct URL.
- [ ] Commit (`feat(citation-urls): Phase C -- help loader citation URLs`).
- [ ] Open + merge PR.

### Phase D -- migrate the svelte components + tree builder + POH chrome closeout

Migrates the three `libs/aviation/src/ui/handbooks/*.svelte` components and the study app's handbook tree builder. After this phase, the only remaining `LIBRARY_*` references in the repo are the constants themselves.

PR title: `feat(citation-urls): Phase D -- handbook svelte components + tree builder`.

#### D.1 `HandbookCard.svelte`

- [ ] Replace `ROUTES.LIBRARY_HANDBOOK(slug)` at line 28 with `urlForReferenceRow(props.reference)`. Update the component's `Props` type if needed so it accepts a `ReferenceRow` (or a row-shaped subset) instead of a bare slug.
- [ ] Verify every caller of `HandbookCard` passes a row, not a slug. Update callers if the shape changes.

#### D.2 `HandbookChapterListItem.svelte` and `HandbookSectionListItem.svelte`

- [ ] Replace the inline `LIBRARY_HANDBOOK_*` calls with `urlForReference()` against an `airboss-ref:` URI built from the row's fields plus the chapter / section.
- [ ] Cross-origin wrap: in the study / hangar / sim apps, wrap the path with `siblingOrigin(page.url, HOST_PREFIXES.FLIGHTBAG)`. In the flightbag app, use the path as-is (same-origin).

#### D.3 `build-handbook-tree.server.ts`

- [ ] Replace the three `LIBRARY_HANDBOOK_*` calls (lines 119, 120, 132) with `urlForReferenceRow()` (for the `LIBRARY_HANDBOOK` site) and `urlForReference()` (for the deeper chapter site) against URIs built from the row + segment.
- [ ] Confirm the emitted tree still renders correctly on `/study/library/handbooks` (or whichever consumer reads the tree).

#### D.4 Tests

- [ ] Component-level snapshot or shape tests for each migrated component. Assert the emitted `href` starts with `/handbook/`.

#### D.5 Browser walk

- [ ] `bun scripts/dev.ts study` (parent repo). Log in as Abby.
- [ ] Open `/library/handbooks`. Click a handbook card. Click a chapter list item. Click a section list item. Network tab confirms flightbag-direct URLs at every level; no 301s.
- [ ] Open the handbook tree wherever it surfaces. Walk one branch end to end.

#### D.6 Close Phase D

- [ ] `bun run check` clean.
- [ ] Commit (`feat(citation-urls): Phase D -- handbook svelte components + tree builder`).
- [ ] Open + merge PR.

### Phase E -- delete the six `LIBRARY_*` constants; close

The close-out signal. After every caller is migrated, the six constants are dead code in `libs/constants/src/routes.ts`. This phase deletes them.

PR title: `feat(citation-urls): Phase E -- retire LIBRARY_* constants`.

#### E.1 Pre-delete grep

- [ ] `grep -rn "LIBRARY_HANDBOOK\|LIBRARY_HANDBOOK_CHAPTER\|LIBRARY_HANDBOOK_SECTION\|LIBRARY_REGULATIONS_SECTION\|LIBRARY_AIRCRAFT\|LIBRARY[^_]" libs/ apps/`. Expected output: zero hits outside `libs/constants/src/routes.ts` itself.
- [ ] If any hit is found, return to the appropriate phase and migrate it. Do not proceed until grep is empty.

#### E.2 Delete

- [ ] In `libs/constants/src/routes.ts`, delete the six constants:
  - `LIBRARY` (line 395)
  - `LIBRARY_REGULATIONS_SECTION` (line 428)
  - `LIBRARY_HANDBOOK` (line 447)
  - `LIBRARY_HANDBOOK_CHAPTER` (line 451)
  - `LIBRARY_HANDBOOK_SECTION` (line 456)
  - `LIBRARY_AIRCRAFT` (line 474)
- [ ] Verify `LIBRARY_STATE` (line 86, a non-route enum constant) is untouched.
- [ ] Note: this WP scope is limited to the six constants with live callers. Other `@deprecated LIBRARY_*` constants in the file (cert / topic / testing / advisories / etc.) are out of scope; they are separately retired or live-callerless and not blocking this migration. Audit them in a follow-on if they remain.

#### E.3 Tests + lint

- [ ] `bun run check` clean.
- [ ] Re-run the route lint (`scripts/lint/check-routes.ts` or equivalent) -- no broken `ROUTES.*` references.
- [ ] Re-run all citation tests -- green.

#### E.4 Close

- [ ] Commit (`feat(citation-urls): Phase E -- retire LIBRARY_* constants`).
- [ ] Open + merge PR.
- [ ] Flip `agent_review_status: done` on every WP file (after a clean self-review pass; not before).
- [ ] Surface to the user that the WP is ready for `human_review_status` walk-through. Do not flip `human_review_status` -- that field is user-only.

## Cross-cutting

- After every phase: re-run `bun tools/md-format/bin.ts --check` on the WP docs. Re-format any files that drifted.
- After every phase: append a one-line entry to the WP's tasks.md "Status" section (e.g., "Phase B merged 2026-MM-DD in PR #NNN").
- Browser-load requirement: Phases B, D require a real-browser load before merge per CLAUDE.md "Critical Rules" (browser-only fixes -- the migrated paths touch runtime barrels of `libs/bc/study` and `libs/sources`).

## Status

(Updated as phases ship.)

- Phase A: not started
- Phase B: not started
- Phase C: not started
- Phase D: not started
- Phase E: not started
