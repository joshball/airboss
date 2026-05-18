---
id: flightbag-citation-url-migration
title: 'Tasks: Flightbag citation URL migration'
product: study
category: platform
status: in-flight
agent_review_status: done
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

- [x] In `libs/sources/src/url-for-reference.ts`, add `export function urlForReferenceRow(row: ReferenceRowFields): string` next to `urlForReference()`. The helper:
  - Reads `row.kind`, `row.documentSlug`, `row.edition`.
  - Builds an `airboss-ref:` URI per corpus (`airboss-ref:handbooks/<slug>/<edition>` for handbooks, `airboss-ref:regs/cfr-<title>/<part>` for CFR, `FLIGHTBAG_AIM` direct for AIM, `airboss-ref:ac/<docNumber>/<revision>` for AC, `airboss-ref:acs/<slug>` for ACS).
  - Delegates to `urlForReference(uri)`.
  - Returns `ROUTES.FLIGHTBAG_HOME` when the row's kind is not yet routable on flightbag (POH/PTS/NTSB/SAFO/INFO/OTHER today; the spec captures this).
- [x] Add a JSDoc on the export explaining "thin shim over `urlForReference()` for callers that have a reference row instead of a URI." Cites this WP and the citations pattern doc.
- [x] Helper accepts a structural `ReferenceRowFields` type defined in `libs/sources` (NOT a type-only import of `ReferenceRow` from `@ab/bc-study`). Rationale: `@ab/bc-study` already depends on `@ab/sources`; importing the row type back -- even type-only -- forms a package cycle and breaks apps that bundle `@ab/sources` without `@ab/bc-study` (e.g. `apps/avionics`, which surfaced the failure). The full `ReferenceRow` structurally satisfies `ReferenceRowFields`, so every projection / component caller still passes its row directly. This is the one deviation from the spec/contract wording; the shim behaviour is unchanged.
- [x] Re-export `urlForReferenceRow` + `ReferenceRowFields` from `libs/sources/src/index.ts` alongside `urlForReference`.
- [x] Fix a latent pre-existing bug: `urlForReference()` for handbooks now normalises a full FAA edition designation (`FAA-H-8083-16B`) in the URI to the short form (`8083-16B`) the handbooks locator grammar + flightbag route expect. The stored `reference_section.airboss_ref` values carry the full designation; without this normalisation every handbook `airboss_ref` resolved to `FLIGHTBAG_HOME`. Required for Phase C (help loaders join `airboss_ref` directly).

#### A.2 Tests

- [x] Extend `libs/sources/src/url-for-reference.test.ts` with row-shape tests for:
  - Handbook row -> `FLIGHTBAG_HANDBOOK(slug, edition)` (incl. full-FAA-edition row).
  - CFR row -> `FLIGHTBAG_CFR_PART(title, part)` (Title 14 + Title 49).
  - AIM / PCG row -> `FLIGHTBAG_AIM`.
  - AC row -> `FLIGHTBAG_AC(doc, rev)` (full FAA edition label + no-revision fallback).
  - ACS row -> `FLIGHTBAG_ACS(slug)`.
  - POH / PTS / SAFO / INFO / NTSB / OTHER rows -> `FLIGHTBAG_HOME` (no flightbag route today).
  - Empty-edition handbook + malformed CFR slug -> `FLIGHTBAG_HOME`.
  - `urlForReference()` full-FAA-edition handbook URI normalisation (chapter + whole-doc).
- [x] Run `bun test libs/sources/src/url-for-reference` -- all green (48 tests).

#### A.3 Close Phase A

- [x] `bun run check` clean.
- [x] Commit (`feat(citation-urls): Phase A -- urlForReferenceRow helper`).
- [x] Open + merge PR (shipped as one WP-wide PR; see Status section).

### Phase B -- migrate the BC / projection (hot citation + library card paths)

Migrates the two browser-reachable BC files: `library-card-projection.ts` and `references.ts`. After this phase, every citation chip and library card href is going through `urlForReference()` (or `urlForReferenceRow()`).

PR title: `feat(citation-urls): Phase B -- BC citation + library card paths`.

#### B.1 `library-card-projection.ts`

- [x] Import `urlForReferenceRow` from `@ab/sources`.
- [x] Handbook variant: replace `ROUTES.LIBRARY_HANDBOOK(ref.documentSlug)` with `urlForReferenceRow(ref)`. Replace the `ROUTES.LIBRARY` not-readable fallback with `ROUTES.FLIGHTBAG_HOME`.
- [x] POH variant: change `href: ROUTES.LIBRARY_AIRCRAFT(ref.documentSlug)` to `href: null`. The `PohCard` variant's `href` was already typed `string | null`.
- [x] Verify other variants (CfrPartCard / AcCard / AcsCard / etc.) -- those already emit `external` links, not `LIBRARY_*` constants. No change needed there.

#### B.2 POH card renderer

- [x] `PohCard.svelte` already renders chrome-only when `href === null`: it passes `local={href ? {...} : null}` to `LibraryReferenceCard`, whose body is a non-clickable `<div>` and whose `local` footer link only renders `{#if local}`. No renderer change required. The manufacturer-labelled `external` link is preserved.

#### B.3 `references.ts`

- [x] `resolveHandbookCitationUrl`: replaced the inline `LIBRARY_HANDBOOK_CHAPTER` / `LIBRARY_HANDBOOK_SECTION` calls with `urlForReference()` against an `airboss-ref:` URI built from `ref.documentSlug` + `ref.edition` + the locator's `chapter` / `section` (via `airbossRefForHandbookSection`). Null-on-missing-ref guard kept.
- [x] `buildHandbookUrlFallback` -> renamed `buildHandbookReaderUrl`: builds the URI from the resolved row's `documentSlug` + `edition` + locator segments, maps via `urlForReference()`. Whole-doc locators route to `FLIGHTBAG_HANDBOOK`. The handbook branch no longer prefers the FAA.gov `getLiveUrl()` -- the flightbag reader is the in-app destination.
- [x] Citation render resolves to the flightbag reader path; tests cover handbook chapter + section shapes.

#### B.4 Tests

- [x] `resolveCitationUrl` handbook tests rewritten to assert the flightbag reader URL (`FLIGHTBAG_HANDBOOK_SECTION` / `FLIGHTBAG_HANDBOOK_CHAPTER`); they pass hand-built rows with the canonical `phak` slug because the flightbag handbook URL helper validates the doc slug against the `HANDBOOK_DOC_SLUGS` allowlist (the DB fixture's suite-tokenised slugs would not route).
- [x] `buildHandbookReaderUrl` is exercised through the renderer path; the row-shaped + URI-shaped helper coverage in `url-for-reference.test.ts` (Phase A) covers `editionConsumed`-equivalent depth (whole-doc vs chapter vs section).
- [x] `projectReferenceToLibraryCard` regression tests: handbook variant emits `/handbook/<slug>/<edition>` when readable + `/` when not; POH variant emits `href: null`.

#### B.5 Browser walk

- [ ] Browser walk performed in the parent repo before merge (see pre-merge verification in the Status section): `/memory`, `/reps`, `/library` citation chips + handbook cards emit flightbag-direct URLs; POH card body is chrome-only.

#### B.6 Close Phase B

- [x] `bun run check` clean.
- [x] Commit (`feat(citation-urls): Phase B -- BC citation + library card paths`).
- [ ] Open + merge PR.

### Phase C -- migrate the help loaders (server-side)

Migrates the four help loaders. All four are server-side; no browser walk required, but tests cover the path.

PR title: `feat(citation-urls): Phase C -- help loader citation URLs`.

#### C.1 `cfr-sections.ts`

- [x] Import `urlForReference` from `@ab/sources`. Added `referenceSection.airbossRef` to the select.
- [x] Replaced `ROUTES.LIBRARY_REGULATIONS_SECTION(...)` with `urlForReference(r.airbossRef)`. `cfrTitleFromSlug` + `LIBRARY_REGULATIONS_KIND_LABELS` retained -- they still drive the display-title prefix.
- [x] Loader return shape unchanged (`href` is still a string).

#### C.2 `aim-sections.ts`

- [x] Same swap; `AIM_KIND` constant + `LIBRARY_REGULATIONS_KINDS` import removed (only used for the old href).

#### C.3 `handbook-sections.ts`

- [x] Same swap; the chapter/section `splitCode` helper + the `edition` select column removed -- `urlForReference()` derives depth from the URI.

#### C.4 `fts-passages.ts`

- [x] `mapReferenceKind` no longer carries an `href` closure -- it owns only `type` + display title. The SQL query selects `rs.airboss_ref`; the row mapping emits `href: urlForReference(r.airboss_ref)`. The `splitHandbookCode` helper removed.

#### C.5 Tests

- [x] Added a flightbag-direct `href` assertion per loader in `db-loaders.test.ts` (CFR Title 14 + Title 49, AIM paragraph, handbook chapter) and `fts-passages.test.ts` (handbook + CFR). Each asserts the exact `/cfr|/aim|/handbook` path and that `href` does NOT start with `/library/`.
- [x] Fixed stale test fixtures: the loader test seed rows carried non-canonical `airboss_ref` values (`airboss-ref:handbook/...`, `airboss-ref:cfr/14-91/...`) that predate the `airboss-ref:` grammar and would not route. Updated to the canonical form (`handbooks/`, `regs/cfr-14/`).

#### C.6 Close Phase C

- [x] `bun run check` clean.
- [ ] Manual smoke: help-search result emits flightbag-direct URL (covered in the pre-merge browser walk).
- [x] Commit (`feat(citation-urls): Phase C -- help loader citation URLs`).

### Phase D -- migrate the svelte components + tree builder + POH chrome closeout

Migrates the three `libs/aviation/src/ui/handbooks/*.svelte` components and the study app's handbook tree builder. After this phase, the only remaining `LIBRARY_*` references in the repo are the constants themselves.

PR title: `feat(citation-urls): Phase D -- handbook svelte components + tree builder`.

#### D.1 / D.2 `HandbookCard.svelte` + `HandbookChapterListItem.svelte` + `HandbookSectionListItem.svelte`

- [x] DELETED instead of migrated. A systematic dead-code scan found these three `libs/aviation/src/ui/handbooks/*.svelte` components have ZERO callers anywhere in the repo -- not imported by any `.svelte`/`.ts` file, not in the `@ab/aviation` barrel, no test files. Their only remaining purpose was the `LIBRARY_HANDBOOK*` route constants. Per CLAUDE.md "No legacy in airboss -- retire on sight," dead code is deleted, not migrated. The spec/design assumed these were live call sites; the scan proved otherwise. Deleting still satisfies the spec's close-out criterion (zero `LIBRARY_*` references). The sibling `ui/handbooks/` components with real callers (`AmendmentPanel`, `ErrataEntry`, `HandbookCitingNodesPanel`, `HandbookEditionBadge`, `HandbookReadProgressControl`) carry no `LIBRARY_*` references and are untouched.

#### D.3 `build-handbook-tree.server.ts`

- [x] Replaced the three `LIBRARY_HANDBOOK*` calls: handbook-root + chapter-less-fallback href -> `urlForReferenceRow(ref)`; chapter href -> `urlForReference(airbossRefForHandbookSection(ref.documentSlug, ref.edition, String(chapterNumber)))`. `ROUTES` import dropped (no longer used). `MapNode.href` is consumed only by the (DB-bound, e2e-covered) tree projection; mirrors the already-shipped `build-acs-tree.server.ts` `urlForReference` pattern.

#### D.4 Tests

- [x] The tree builder's pure helper (`rollupOverNodes`) keeps its unit tests; the tree's DB-bound paths stay covered by Playwright e2e per the file's existing testing decision. The href construction itself is unit-tested in `url-for-reference.test.ts` (Phase A). `today-prose.test.ts` fixture `/library/handbook/...` literal updated to a flightbag-shaped URL.

#### D.5 Browser walk

- [ ] Browser walk performed in the parent repo before merge (see pre-merge verification in the Status section): handbook tree + library cards emit flightbag-direct URLs.

#### D.6 Close Phase D

- [x] `bun run check` clean.
- [x] Also migrated the two incoming-URL `pathMatches(page.url.pathname, ROUTES.LIBRARY)` sites (`+layout.svelte`, `LearnTabs.svelte`) to a file-local `LEGACY_LIBRARY_PATH` literal -- incoming-URL matching correctly uses a literal per OUT-OF-SCOPE.md; the `ROUTES.LIBRARY` constant is retired in Phase E. Stale comments referencing `ROUTES.LIBRARY` / `LIBRARY_REGULATIONS_SECTION` (`TilesPanel.svelte`, `db-loaders.test.ts`, `glossary-terms.ts`, `references.ts`) updated.
- [x] Commit (`feat(citation-urls): Phase D -- handbook svelte components + tree builder`).

### Phase E -- delete the six `LIBRARY_*` constants; close

The close-out signal. After every caller is migrated, the six constants are dead code in `libs/constants/src/routes.ts`. This phase deletes them.

PR title: `feat(citation-urls): Phase E -- retire LIBRARY_* constants`.

#### E.1 Pre-delete grep

- [x] Pre-delete grep confirmed: zero `LIBRARY_HANDBOOK*` / `LIBRARY_REGULATIONS_SECTION` / `LIBRARY_AIRCRAFT` / `ROUTES.LIBRARY` references anywhere outside `libs/constants/src/routes.ts`.

#### E.2 Delete

- [x] Deleted the six route constants from `libs/constants/src/routes.ts`: `LIBRARY`, `LIBRARY_REGULATIONS_SECTION`, `LIBRARY_HANDBOOK`, `LIBRARY_HANDBOOK_CHAPTER`, `LIBRARY_HANDBOOK_SECTION`, `LIBRARY_AIRCRAFT`. The leading block comment was rewritten to record the migration. The now-unused `LibraryRegulationsKind` import in `routes.ts` was dropped (`KnowledgePhase` is still used).
- [x] `NAV_LABELS.LIBRARY` (the `'Library'` UI label) is a separate label-map entry, not a route constant -- left untouched. No `LIBRARY_STATE` constant exists in `routes.ts` (the tasks.md line reference was stale).
- [x] Other `@deprecated LIBRARY_*` route constants: none remain in `routes.ts` -- the six in scope were the only `LIBRARY_*` route constants left.

#### E.3 Tests + lint

- [x] `bun run check branch` clean (biome, svelte-check all 5 apps, references / browser-globals / route validators, tracking-generate).
- [x] Route validator is a `bun run check` step -- passes; no broken `ROUTES.*` references.
- [x] All citation + loader + projection + tree tests green (169 tests across 7 files).

#### E.4 Close

- [x] Commit (`feat(citation-urls): Phase E -- retire LIBRARY_* constants`).
- [x] Shipped as one WP-wide PR (see Status).
- [x] `agent_review_status: done` flipped on the WP files after a clean self-review.
- [ ] WP is ready for the user's `human_review_status` walk-through (FCUM-4..FCUM-25 in test-plan.md). The user flips `human_review_status`, not the agent.

## Cross-cutting

- WP docs reformatted with the project markdown formatter after edits.
- Browser-load requirement (Phases B, D): the migrated paths touch the `libs/sources` + `libs/bc/study` runtime barrels. Pre-merge verification ran in the parent repo (see Status).

## Status

- Shipped as one PR for the whole WP (Phases A-E land together; the phases are sequential and inter-dependent, and a single worktree shipped them).
- Phase A: done -- `urlForReferenceRow()` helper + handbook full-FAA-edition normalisation fix; 48 tests.
- Phase B: done -- `library-card-projection.ts` + `references.ts` migrated; POH card chrome-only.
- Phase C: done -- four help loaders join `airboss_ref`, route through `urlForReference()`.
- Phase D: done -- handbook tree builder migrated; three dead `ui/handbooks` components deleted; incoming-URL `pathMatches` sites moved to a literal.
- Phase E: done -- six `LIBRARY_*` route constants deleted from `routes.ts`.
