---
id: flightbag-citation-url-migration
title: 'Design: Flightbag citation URL migration'
product: study
category: platform
status: in-flight
agent_review_status: pending
human_review_status: pending
created: 2026-05-14
owner: agent
tags:
  - design
  - citations
  - urls
  - flightbag
  - cross-origin
legacy_fields:
  feature: flightbag-citation-url-migration
  type: design
---

# Design: Flightbag citation URL migration

WP-specific design notes. The architectural foundation is [`urlForReference()`](../../../libs/sources/src/url-for-reference.ts) and the [`docs/ingestion-pipeline/reference-citations-pattern.md`](../../ingestion-pipeline/reference-citations-pattern.md) pattern doc. Read those first; this doc adds the choices specific to this WP.

## The load-bearing decision: one URL helper, not N call-site fixes

Twenty-three call sites across nine files emit a `/library/*` URL today. A mechanical migration would rewrite each call site to call the corresponding `ROUTES.FLIGHTBAG_*` directly. That would compound three problems:

- Every call site would need to grow `edition` and (sometimes) `flightbagOrigin` arguments. The projection contract for `library-card-projection.ts` would expand. Caller types would balloon.
- Each call site would re-derive its own corpus-kind switch. Handbook -> `FLIGHTBAG_HANDBOOK_*`; CFR -> `FLIGHTBAG_CFR_*`; AIM -> `FLIGHTBAG_AIM_*`. The same switch logic would land in `references.ts`, in `library-card-projection.ts`, and in each of four help loaders. Five copies of the same kind-switch logic is exactly the problem `urlForReference()` already solves.
- The next time a new corpus lands (per-aircraft surface, SAFO live route, NTSB-ALJ live route), N call sites would need updating instead of one helper.

The single-helper choice collapses all three problems. The call site produces an `airboss-ref:` URI (or hands the helper a `ReferenceRow` via the new `urlForReferenceRow()` shim); the helper handles every kind-switch, every edition-resolution, every fallback. Adding a new corpus is one branch in one file.

This is the same pattern shipped by `summarizeDeckSpec` / `getCalibration` (per CLAUDE.md "Critical Rules") -- pure helpers ship through the runtime barrel; DB-touching helpers ship through `/server`. `urlForReference()` is a pure helper today; this WP makes it the only URL helper for citations.

## Why `urlForReferenceRow()` is a thin shim, not a redesign

The browser-reachable callers (`library-card-projection.ts`, the three `Handbook*ListItem.svelte` components, `HandbookCard.svelte`) have a `ReferenceRow` in hand, not an `airboss-ref:` URI. Two paths were considered:

- **A.** Change those callers to construct an `airboss-ref:` URI inline before calling `urlForReference()`.
- **B.** Add a sibling helper `urlForReferenceRow(row: ReferenceRow): string` that builds the URI internally.

The WP picks **B**. Rationale:

- The URI construction is non-trivial in places (handbook URIs need `<slug>/<edition>`; AC URIs need `<docNumber>/<revision>`; ACS URIs need `<slug>`). Pushing that construction to every call site duplicates a fragment of the locator-parser logic that already lives in `libs/sources`.
- The helper lives next to `urlForReference()` -- in the same file, sharing the same imports and tests. Callers see one place to maintain.
- Tests are easier to write against a row shape than against a string-with-many-escapes URI. The row shape is the platform's canonical reference shape (`ReferenceRow` from `@ab/bc-study`).

The shim is roughly twenty lines of code -- a switch on `row.kind`, a per-kind URI builder, a delegating call to `urlForReference()`. The kind-switch overlaps with `urlForReference()`'s own kind-switch, but that's deliberate: the shim's job is "row -> URI"; `urlForReference()`'s job is "URI -> URL." The two switches are about different vocabularies (Drizzle row kinds vs. corpus URI prefixes).

## Why the citation resolver in `references.ts` uses `urlForReference()` directly

The structured citation in `references.ts` already carries an `airboss-ref:` URI -- that's the canonical shape per ADR + content-citations work, and the citation schema enforces the prefix via a `CHECK` constraint. So the resolver does not need the row shim; it just passes the URI to `urlForReference()` and gets back a path.

The current code in `resolveHandbookCitationUrl` and `buildHandbookUrlFallback` builds the URL by hand from `documentSlug` + chapter + section. After this WP, it forwards the URI it already has. The result is the same URL for the same citation; the difference is the maintenance surface.

## Why POH cards go chrome-only

The POH card href today points at `LIBRARY_AIRCRAFT(slug)`, which corresponds to a study route that was retired in WP-FLIGHTBAG-READER-UX. The route returns 410 Gone. The flightbag app has no per-aircraft reader; that's its own surface-shape decision waiting for product clarity.

Three options were considered (see [spec.md](./spec.md) Decision 2). The chosen path is **chrome-only**: the `PohCard` variant emits `href: null` and the renderer omits the link wrapper. The card body still renders -- manufacturer / model / edition / description / topics -- and the `external` link to the manufacturer site is preserved.

The rationale comes from two sources:

- **Zero tolerance for known issues** (CLAUDE.md prime directive). Shipping a 410-Gone URL on purpose is a known issue. Removing the link is the simplest fix that closes the issue without inventing content.
- **Existing chrome-only card patterns.** The `AimCorpusCard`, `AcsCard`, and `PtsCard` variants in `library-card-projection.ts` today already render without an in-app `href` -- they have only an `external` link. The POH chrome-only shape matches that pattern; the renderer's affordance for "card without primary link" already exists.

The trigger to re-add the `href` is documented in [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md): when a flightbag `/aircraft/<slug>` reader ships, the POH card becomes a link again. The change at that point is a one-line projection-shape edit ("emit `urlForReferenceRow(ref)` instead of `null`") plus a renderer revert. Future agents do not need to re-derive the decision.

## Edition resolution flow

The flightbag handbook routes (`FLIGHTBAG_HANDBOOK`, `FLIGHTBAG_HANDBOOK_CHAPTER`, `FLIGHTBAG_HANDBOOK_SECTION`) require an `edition` argument. The study-local routes did not. Three sources of the edition are available:

- The `ReferenceRow.edition` field -- present on every reference row in `study.reference`. The canonical source.
- The `airboss-ref:` URI's pinned edition (`?at=<edition>` query, or the `<edition>` segment in the URI path).
- The platform's default-edition resolver (registry lookup; falls back to "current" if no row found).

`urlForReference()` handles the URI path; `urlForReferenceRow()` handles the row path. Both ultimately route through `parseHandbooksLocator()` which validates the edition segment. Empty / missing edition falls back to `ROUTES.FLIGHTBAG_HOME` (the locator parser flags it and the helper returns the safe fallback).

The citation chip case is the one with the most edition complexity: a citation may pin an explicit edition via `redirected_from: airboss-ref:handbooks/afh/FAA-H-8083-3B/4`. The current `references.ts` resolver already handles this; it consumes the edition from the URI's `<edition>` segment when present and from the registry row otherwise. The post-migration shape preserves the same logic via `urlForReference()`'s built-in edition handling.

## Browser-safety constraints

The migration touches `libs/sources` (the location of `urlForReference()` and the new `urlForReferenceRow()` shim). `libs/sources` is browser-bundled (per CLAUDE.md "Critical Rules"). The constraints:

- `libs/sources/src/url-for-reference.ts` must not statically import `node:*`. It currently does not.
- The new `urlForReferenceRow()` shim must not statically import `@ab/db/connection` or `@ab/bc-study/server`. The row type comes from `@ab/bc-study` (the runtime barrel) via a type-only import; values come from the row argument the caller passes, not from a DB call inside the helper.
- Tests live next to the source (`url-for-reference.test.ts`). Vitest runs in happy-dom mode; the tests pass implicitly through the same browser-safety lens.

The PhaseB / PhaseD browser-load requirement in CLAUDE.md applies: any PR touching `libs/sources` or `libs/bc/study`'s runtime barrel must be loaded in a real browser before merge. The migration's hot paths (citation chips, library cards) are exactly the surfaces that would crash at hydration if a regression leaks `node:*` into the bundle. The dispatcher walks `/memory`, `/library`, and `/reps` after each Phase B / D merge.

## Cross-origin wrap pattern

Citations rendered in the study / hangar / sim apps need the flightbag origin prepended to the path that `urlForReference()` returns. The pattern is documented at `libs/constants/src/routes.ts` line 389:

```typescript
import { siblingOrigin, HOST_PREFIXES } from '@ab/constants';

const path = urlForReference(uri);
const href = `${siblingOrigin(url, HOST_PREFIXES.FLIGHTBAG)}${path}`;
```

The wrap happens at the call site (the svelte component or the `+page.server.ts`), not inside `urlForReference()`. Reason: the helper is pure and has no `url` access; the call site is the only layer that knows whether it is rendering in study (needs the prefix) or in flightbag (does not).

The flightbag app itself uses the path verbatim -- same-origin, no prefix.

## Open questions resolved during spec authoring

- **Q: Should `urlForReference()` produce a full URL (origin + path) instead of just a path?**
  A: No. The helper is pure; it has no `url` access. The call site holds the `url` and applies `siblingOrigin()`. Coupling the helper to a specific origin pattern would force every test to thread an origin and would break the same-origin (flightbag) case.

- **Q: Should the projection in `library-card-projection.ts` accept a `flightbagOrigin` argument and emit fully-qualified URLs?**
  A: No. The projection emits paths; the consumer's svelte renderer wraps with `siblingOrigin()`. Matches the rule above and keeps the BC pure.

- **Q: Should the migration retire the 301-redirect layer in `apps/study/src/hooks.server.ts`?**
  A: No -- out of scope for this WP. Legacy bookmarks and content authored before WP-FLIGHTBAG-READER-UX still rely on the redirect. Retiring it is a separate decision with user-facing impact (broken bookmarks). Captured in [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

- **Q: Should the migration introduce a biome rule blocking new uses of `LIBRARY_*` constants?**
  A: No. The constants are getting deleted in Phase E; after deletion the names are no longer importable, and a biome rule would be redundant. The deletion itself is the enforcement.

- **Q: Should the POH card show a "coming soon" affordance instead of going chrome-only?**
  A: No. The card already shows manufacturer + model + edition + topics + external link; a "coming soon" placeholder would add a content claim the platform can't deliver on a known schedule. Chrome-only is the minimal honest shape: the card displays everything it has and stays out of the way until the flightbag reader ships.

- **Q: What about the other `@deprecated LIBRARY_*` constants in `routes.ts` (cert / topic / testing / advisories)?**
  A: Out of scope for this WP. This WP names the six constants with live callers; the other `@deprecated LIBRARY_*` names are either live-callerless or covered by separate retirement work. A follow-on audit can sweep them in one pass.

- **Q: Should the migration introduce URL telemetry to measure the 301-reduction impact?**
  A: No. The measurement is direct: open the network tab on a migrated surface and confirm zero 301s. Adding telemetry would build a measurement system around a one-time migration whose success criterion is "no 301 in the network tab on the migrated surfaces." Captured in [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

## Phasing rationale

The phasing in [tasks.md](./tasks.md) (A / B / C / D / E) is not arbitrary. Three forces shape it:

1. **A is foundational** -- `urlForReferenceRow()` must land before any caller can use it. Adding the helper alone is safe (additive, no behaviour change) and gives subsequent phases a stable contract.
2. **B is the hot path** -- the BC projection and the citation resolver in `references.ts` together cover the highest-traffic surfaces (every memory page, every reps page, every library card). Landing B early proves the migration mechanically and lets phases C / D land against an already-validated helper.
3. **E is the close-out signal** -- the deletion of the six constants is the only way to enforce "no new code can use `LIBRARY_*`." It can only run after every caller is migrated; running it earlier would break the build. So it lands last.

C and D are independent (server-side help loaders vs. svelte components + tree builder) and could run in parallel if multiple agents are available; sequential ordering is the safe default. The browser-load requirement on D (per CLAUDE.md "Critical Rules") makes it the natural penultimate step.
