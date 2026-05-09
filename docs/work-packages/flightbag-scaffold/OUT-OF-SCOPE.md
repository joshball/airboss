---
title: 'Out of Scope: Flightbag Scaffold'
product: flightbag
feature: flightbag-scaffold
type: out-of-scope
status: unread
---

# Out of Scope: Flightbag Scaffold

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out of scope (captured here, not implemented)" section of [spec.md](./spec.md). The deeper rationale lives in [docs/platform/REFERENCES.md](../../platform/REFERENCES.md) "Future architecture" decision (2026-05-03) and [docs/products/flightbag/VISION.md](../../products/flightbag/VISION.md).

## Summary

| Item                                                  | Status       | Trigger to revisit                                                  |
| ----------------------------------------------------- | ------------ | ------------------------------------------------------------------- |
| Migrate study's `/library/...` routes to flightbag    | Follow-on WP | Once content rendering proves the flightbag pipe end-to-end         |
| Rewire study citation chips through `urlForReference` | Follow-on WP | `wp-citation-chips-to-flightbag` ships after content rendering      |
| Hangar references admin dashboard                     | Follow-on WP | `wp-hangar-references-dashboard` picks up the admin surface         |
| Auth gates on flightbag                               | Deferred     | When usage data shows public exposure of a reference is a problem   |
| Theme polish on placeholder pages                     | Deferred     | When real content rendering ships and the placeholders become pages |
| Playwright e2e suite for flightbag                    | Deferred     | When real reference content lands and there's a flow worth covering |

## Migrate study's `/library/...` routes to flightbag

Status: Follow-on WP

What was postponed:
Moving the existing `/library/...` reader routes out of `apps/study/` and into `apps/flightbag/`. The scaffold ships placeholder routes that prove the route + URL helper pipe works end-to-end with stub component bodies; the real content (handbook section markdown, CFR text, AC bodies, ACS task bodies) still renders via the study app today.

Why:
Per [spec.md](./spec.md) Non-goals: the scaffold is a structural change. Migrating the live reader at the same time would mix structural and behavioral changes in one PR, making review hard and risking a regression on the live `/library/...` URLs that other surfaces already deep-link to.

Trigger that fires the follow-on:
The follow-on is the `wp-flightbag-content-rendering` WP (or its successor) -- it picks up the flightbag placeholder routes and wires them to the real `@ab/sources` resolvers + `@ab/library` rendering primitives. Once flightbag actually renders content, the migration WP cuts the study `/library/...` routes over.

Implementation pattern when triggered:
Use the route constants and helpers shipped here. Each new flightbag page composes on `@ab/library`'s `<RenderedSection>` (which moves from stub to real). The study `/library/...` pages either redirect to the flightbag URL or are removed. Backward-compat is ensured by `urlForReference()` -- existing citation chips continue to resolve to a URL that works.

References:

- [spec.md](./spec.md) Non-goals + Out of scope
- [docs/work-packages/wp-flightbag-content-rendering/spec.md](../wp-flightbag-content-rendering/spec.md)
- [docs/work-packages/wp-flightbag-book-experience/spec.md](../wp-flightbag-book-experience/spec.md)
- [docs/platform/REFERENCES.md](../../platform/REFERENCES.md)

## Rewire study citation chips through `urlForReference()`

Status: Follow-on WP

What was postponed:
Switching every existing citation chip in `apps/study/` from the `LIBRARY_*` route constants to `urlForReference()` (which dispatches to `ROUTES.FLIGHTBAG_*`). The scaffold ships the helper, the route constants, and the `<CitationChip>` stub in `@ab/library`, but does not touch existing chip call sites in study.

Why:
Per [spec.md](./spec.md) Non-goals: rewiring chips before flightbag renders real content would deep-link learners into placeholder pages -- a regression. The chip rewire is gated on the content-rendering WP shipping.

Trigger that fires the follow-on:
The follow-on is the `wp-citation-chips-to-flightbag` WP (already authored in [docs/work-packages/wp-citation-chips-to-flightbag/spec.md](../wp-citation-chips-to-flightbag/spec.md)). It runs after flightbag renders real content.

Implementation pattern when triggered:
Find every `LIBRARY_*` reference in `apps/study/src/` (and any other app that emits chips). Replace with `urlForReference(uri)` calls that take the citation's `airboss-ref:` URI. Test the chip cross-app handoff: a chip rendered in study should jump to the flightbag URL on click.

References:

- [spec.md](./spec.md) Non-goals + Out of scope
- [docs/work-packages/wp-citation-chips-to-flightbag/spec.md](../wp-citation-chips-to-flightbag/spec.md)

## Hangar references admin dashboard

Status: Follow-on WP

What was postponed:
A hangar-app admin dashboard for browsing, ingesting, and managing reference publications (which manifests are cached, which have on-disk derivatives, which are seeded into the DB, etc.). Per [docs/platform/IDEAS.md](../../platform/IDEAS.md), this is a sibling concern to flightbag -- flightbag is the public reader, hangar is the operator surface.

Why:
Per [spec.md](./spec.md) Non-goals: the dashboard is its own scope with its own data shape (operator workflows around publication ingest, seed status, edition lifecycle) and its own access controls (hangar-only, not public). Bundling it into the public reader scaffold would mix concerns.

Trigger that fires the follow-on:
The follow-on is the `wp-hangar-references-dashboard` WP (already authored at [docs/work-packages/wp-hangar-references-dashboard/spec.md](../wp-hangar-references-dashboard/spec.md)). It picks up the admin surface independently of flightbag content rendering.

Implementation pattern when triggered:
Build the dashboard inside `apps/hangar/` per the existing hangar admin patterns. Compose on the same `@ab/sources` registry that flightbag reads. Surface ingest status, manifest counts, seed status, and edition links per publication.

References:

- [spec.md](./spec.md) Non-goals + Out of scope
- [docs/platform/IDEAS.md](../../platform/IDEAS.md) (apps/hangar references admin entry)
- [docs/work-packages/wp-hangar-references-dashboard/spec.md](../wp-hangar-references-dashboard/spec.md)

## Auth gates on flightbag

Status: Deferred

What was deferred:
Authentication or visibility rules on flightbag. Per [spec.md](./spec.md) Non-goals: "flightbag is a public reader for now."

Why:
The references flightbag serves are FAA publications (handbooks, CFR titles, AIM, ACs, ACS) that are public domain. Gating them serves no current purpose. Adding auth primitives now is speculative and creates friction for the cross-surface deep-link use case (a user pastes a flightbag URL into a chat -- adding auth would break that).

Trigger to revisit:
Either (a) flightbag adds non-public content (annotated commentary, course-author notes, anything proprietary), or (b) usage data shows a specific public exposure problem (e.g., scraping, abuse).

Implementation pattern when triggered:
The simplest pattern is per-route auth: most routes stay public; the auth-gated routes opt in via a `+layout.server.ts` that requires a session. Mirror the study app's `(app)` route group pattern. If finer-grained gating is needed (e.g., a single page is private), use page-level `load` guards.

References:

- [spec.md](./spec.md) Non-goals + Out of scope
- [docs/products/flightbag/VISION.md](../../products/flightbag/VISION.md)

## Theme polish on placeholder pages

Status: Deferred

What was deferred:
Visual design / theme work on the flightbag placeholder pages. The scaffold uses defaults; pages render with minimal layout and no design tokens.

Why:
Per [spec.md](./spec.md) Non-goals: design is downstream. Theming a placeholder page with no real content would either (a) anchor design choices to the wrong shape (placeholder body doesn't reflect real reference rendering) or (b) waste design work that gets thrown away once the real component bodies land.

Trigger to revisit:
Real reference content lands (the content-rendering follow-on WP ships) and the pages move from "stub proves the pipe" to "real surfaces a learner reads."

Implementation pattern when triggered:
Apply the existing platform theme tokens (`@ab/themes`) per the pattern established by `apps/study/`. The scaffold's `+layout.svelte` is intentionally minimal so theme polish slots in cleanly.

References:

- [spec.md](./spec.md) Non-goals + Out of scope
- `apps/study/src/routes/+layout.svelte` (theme integration pattern)

## Playwright e2e suite for flightbag

Status: Deferred

What was deferred:
End-to-end Playwright tests for flightbag user flows. The scaffold ships unit tests for the URL helper, the route constants, and the library lib smoke tests, but no Playwright spec.

Why:
Per [spec.md](./spec.md) Non-goals: "smoke build is the gate at scaffold; e2e ships with real content." A Playwright spec against placeholder pages would assert against stub markup that changes when real rendering lands -- the test churn outpaces the protection.

Trigger to revisit:
Real reference content lands AND there's a flow worth covering end-to-end (e.g., "user navigates from study chip to flightbag handbook section to deep-link copy").

Implementation pattern when triggered:
Mirror the existing Playwright pattern under `tests/e2e/`. Test the cross-app handoff (study citation -> flightbag URL -> rendered content) as the priority flow, since that's what the URL bridge exists for.

References:

- [spec.md](./spec.md) Non-goals + Out of scope
- `tests/e2e/` (existing Playwright suite for study)
