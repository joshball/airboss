---
title: 'Spec: WP-CITE-FLIGHTBAG -- migrate citation chips to flightbag URLs'
product: study
feature: wp-citation-chips-to-flightbag
type: spec
status: draft
review_status: pending
---

# WP-CITE-FLIGHTBAG: migrate citation chips from study `/library/...` to flightbag URLs

After `apps/flightbag/` is scaffolded (separate WP), study's existing citation chips that link to in-app `/library/...` need to be rewired to use `urlForReference(uri)` from `@ab/sources` so they produce flightbag URLs.

This is the migration that makes flightbag actually be the canonical reader.

## Why

Today, citation chips in study link to study's own `/library/...` routes. After flightbag exists:

- Sim should link to flightbag (not study) for the same content
- FIRC should link to flightbag (when it's built)
- A user copying a citation URL from study and pasting it into a sim debrief should land at the same canonical URL — that's flightbag

The migration is mechanical: every place that generates a `/library/...` URL today calls `urlForReference()` instead.

## Scope

Search for every URL generation site:

```bash
rg "ROUTES.LIBRARY_" apps/study libs/ --type=ts --type=svelte
rg "/library/" apps/study libs/ --type=ts --type=svelte
```

Categorize each:

- (a) Citation chip / pill component renders → use `urlForReference(uri)`
- (b) Library page navigation links → stay in study (admin browsing IS in study; users still land on flightbag for content)
- (c) Mid-content "see also" cross-refs in markdown → use `urlForReference(uri)` if they're authored as `airboss-ref:` URIs

Note: study's `/library/...` routes themselves stay alive during the transition. They become DEPRECATED, not deleted, until all citations migrate. After all citations migrate AND flightbag has feature parity, study's `/library/...` routes can be dropped.

## Phases

### Phase 1: Audit + categorize

Repo-wide grep for all citation-rendering sites. Build a list per file. Decide per-call: keep in-study link, or rewrite to flightbag?

### Phase 2: Rewire citation chip components

Components in `libs/ui/` that render citation chips (CitationChip, etc.) call `urlForReference(reference.id)` instead of in-app routing.

### Phase 3: Rewire markdown content

Knowledge nodes, scenario debriefs, etc. that contain `airboss-ref:` URIs (per ADR 019) get their links via `urlForReference()` at render time. No change to authored content; rendering layer change only.

### Phase 4: Tests

- Unit tests confirm `urlForReference()` outputs flightbag URLs
- E2E test: clicking a citation chip in study lands at flightbag
- E2E test: a copied URL from study (citation) opens correctly in flightbag (cross-app link integrity)

### Phase 5: Deprecate study /library/ routes

Add deprecation warnings (route load function logs to audit "user reached study /library/ route — should be redirecting to flightbag"). Plan deletion for follow-up WP after a soak period.

### Phase 6: Doc updates

REFERENCES.md, status.md, study-app docs.

## Risks

- **Cross-domain links:** if flightbag deploys at a different hostname, citation links from study now leave the SPA. May need a router-level redirect if SPA continuity matters.
- **Authentication:** flightbag is public; study citations may be made by logged-in users. The flightbag URL doesn't carry auth state. If a citation surface assumes user identity, this needs design.
- **Breakage during migration:** if citation chips are migrated before flightbag has the route, they 404. Sequencing matters.

## Out of scope

- Building the flightbag routes (separate scaffold WP)
- The hangar admin dashboard (separate WP)
- New reference content

## Sequencing

This WP runs AFTER:

1. Flightbag scaffold lands
2. Section-tree promotions complete (so flightbag has rich content to render)
3. Hangar admin dashboard exists (so admin actions can audit URL changes if they happen)

Estimated: ~1-2 weeks of work, dependent on flightbag being feature-complete enough to host all citation targets.

## Anchors

- [docs/platform/REFERENCES.md](../../platform/REFERENCES.md) — architecture
- [PR #508](https://github.com/joshball/airboss/pull/508) — routing-layer decision (URL helpers in `libs/constants/`, bridge in `libs/sources/`)
- [docs/work-packages/flightbag-scaffold/](../flightbag-scaffold/) — scaffold WP (in flight as of 2026-05-03)
