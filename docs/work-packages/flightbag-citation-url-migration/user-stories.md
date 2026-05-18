---
id: flightbag-citation-url-migration
title: 'User Stories: Flightbag citation URL migration'
product: study
category: platform
status: draft
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
  - user-stories
legacy_fields:
  feature: flightbag-citation-url-migration
  type: user-stories
---

# User Stories: Flightbag citation URL migration

User-perspective narratives. Two primary roles: **pilots** (clicking citation chips and library cards during study and reading sessions) and **agents** (building new surfaces that emit reference URLs and binding to the helper contract). The flightbag librarian / content author surface does not change visibly in this WP -- it is a URL emit-shape change.

## Citation click latency (pilot, reading a card)

- As a pilot reading a flashcard with a structured handbook citation, I want the citation chip to navigate directly to the flightbag handbook reader without a visible interstitial / spinner, so the chip feels like a button instead of a fetch.
- As a pilot reading the same card in low-bandwidth conditions (LTE in flight, cabin Wi-Fi on the ground at a small airport), I want the chip click to be one HTTP request instead of two, so the redirect doesn't compound the latency.
- As a pilot in a tab-heavy review session, I want a middle-click on a citation chip to open the flightbag URL directly in a new tab, so I can keep my place in the rep while the reader loads in the background.
- As a pilot, I want the citation chip's `href` (visible on hover in the browser's status bar) to be a real flightbag URL I can read at a glance, so I can decide whether to click without a mystery `/library/...` destination.

## Library card navigation (pilot, browsing references)

- As a pilot browsing the library landing, I want clicking a handbook card to take me directly to the flightbag reader, so I don't see the URL change after I land.
- As a pilot copying a library card's URL to share with a CFI, I want the URL to be the flightbag URL (the canonical reader location), so the link I paste is the final shape my CFI's browser will resolve to.
- As a pilot bookmarking a handbook chapter, I want the bookmark to capture the flightbag URL directly, so my bookmark is the canonical reader location -- the redirect is not in the bookmark.

## POH card chrome-only (pilot, browsing POH cards)

- As a pilot looking at the POH card for my aircraft (Cessna 172N, Piper Archer, etc.), I want the card to display the manufacturer / model / edition / description / topics and the manufacturer's external link, so the card is still informationally useful even though the in-app reader isn't built yet.
- As a pilot, I do NOT want the POH card body to look like a link that goes nowhere -- the platform should not promise navigation it can't deliver. The chrome-only shape makes the affordance honest.
- As a pilot looking for the POH content, I want a clear path to the manufacturer's official PDF via the `external` link on the card, so I can still get to the content without the in-app reader.
- As a pilot who notices the POH card is chrome-only, I want the affordance to be clearly different from a handbook card (visually obvious that this card does not navigate), so I don't waste a click trying to open it.

## Help search results (pilot, looking up a regulation)

- As a pilot using the help drawer or search palette to look up "91.103," I want clicking the result to open the CFR section on flightbag directly, so the result lands me on the reader without an interstitial.
- As a pilot doing full-text search across the reference corpus, I want every search result to navigate directly to the flightbag origin, so my search session is one round-trip per click instead of two.
- As a pilot doing back-to-back lookups during a flight planning session, I want every navigation to be direct so the cumulative time on the search-and-open loop stays small.

## Cross-origin URL stability (pilot, deep-linking across surfaces)

- As a pilot who has the flightbag open on one device and the study app on another, I want a citation URL copied from one to work in the other, because both surfaces emit the same flightbag URL.
- As a pilot whose flightbag origin changes (dev vs. preview vs. prod), I want the platform to derive the origin from the current request, not from a hardcoded constant, so the URL is always correct for my environment.
- As a pilot in a multi-tenant future where two flightbag instances exist (e.g. school + personal), I want each instance to emit its own origin URLs, so the cross-origin wrap respects the surface I am on.

## Future per-aircraft reader (pilot, after flightbag POH surface lands)

- As a pilot, when the flightbag per-aircraft reader ships, I want the POH cards to immediately re-acquire their `href` attribute and navigate to the new reader -- the link comes back the same week the reader ships.
- As a pilot, I do NOT want a multi-PR migration to re-add the POH link; the design captures the one-line projection-shape revert in [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md) so the re-add is a single change.

## Agents binding to the helper (agent, building a follow-on consumer)

- As an agent building a new content surface that needs a flightbag URL, I want to call `urlForReference(uri)` from `@ab/sources` and get back a path, so my surface joins the same canonical pipeline as every existing citation chip.
- As an agent rendering a reference card in a non-flightbag app, I want to wrap the helper's path with `siblingOrigin(url, HOST_PREFIXES.FLIGHTBAG)` so my surface naturally crosses origins.
- As an agent rendering the same reference card inside the flightbag app, I want the path to be used as-is (no wrap), so my surface is same-origin and the URL stays simple.
- As an agent adding a new corpus to the platform (a new SAFO live route, a new per-aircraft reader, an NTSB-ALJ ruling page), I want to add one branch in `urlForReference()` and have every existing consumer pick up the new URL automatically, so the migration cost is one helper change, not N call-site fixes.
- As an agent reading the [CONSUMER-CONTRACT.md](./CONSUMER-CONTRACT.md), I want a clear description of (a) the helper's input shape, (b) its output shape, (c) the cross-origin wrap pattern, so I can write my consumer without reading the spec.

## Cross-cutting: integrity and trust

- As a pilot, I want my citation history (clicks on chips, library cards visited) to behave the same after the migration as before -- the chip's visible label, badge, and locator text are unchanged; only the underlying URL changes.
- As a pilot, I want the dev environment's preview / prod URLs to use the right cross-origin prefix derived from the current request, so a dev-mode test exercises the same wrap pattern as a prod-mode click.
- As any agent on this project, I want the six retired `LIBRARY_*` constants to be removed from `libs/constants/src/routes.ts` after the migration so future agents cannot reach for them, and the deprecation comment is replaced by deletion (the strongest form of "don't use this anymore").
- As any agent on this project, I want `urlForReference()` to be a pure helper (no DB, no fs, no `node:*`) so my consumer can call it inline in a `.svelte` component as the user pans / zooms / types -- no fetch, no server round-trip.
- As any agent on this project, I want the migration's success criterion to be measurable in the browser ("no 301 in the network tab on the migrated surfaces") rather than via a synthetic benchmark, so the close-out is an observation, not a number.

## Manual reader (user, walking the test plan)

- As the user walking the manual test plan, I want every migrated surface (memory, reps, library, help, handbook tree) to land its URL on flightbag directly so I can verify the migration with my own eyes.
- As the user walking the test plan, I want the POH card to display the manufacturer link but no in-app `href`, so the chrome-only shape is observable.
- As the user signing off, I want the close-out checklist (FCUM-21 through FCUM-26) to read top-to-bottom green before I flip `human_review_status: signed-off`.
