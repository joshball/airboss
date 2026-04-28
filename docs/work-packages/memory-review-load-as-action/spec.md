---
status: deferred
trigger: when the next memory-review UX overhaul lands, OR if production traces show ABANDONED session rows growing from prefetch traffic
source: 2026-04-27 correctness review
---

# Memory review: load -> action conversion

## Problem

`apps/study/src/routes/(app)/memory/review/+page.server.ts` `load` performs writes:

- `abandonStaleSessions(user.id)` (always runs)
- `startReviewSession(...)` on the no-`?deck` path
- `startReviewSession(...)` on the `?deck=` path when no resumable session exists

SvelteKit prefetch on hover, link previews (Slack/LinkedIn), virus scanners, and bot crawls all walk the load function. Each prefetch creates a fresh `memory_review_session` row, freezes a card list, and the row eventually becomes ABANDONED. The user's history accumulates rows they never used.

## Why this isn't fixed in PR-2026-04-27

Every nav/CTA in the app (`+layout.svelte`, dashboard panels, memory page, calibration buckets, knowledge node detail, BC navigation cards) links to `/memory/review` as a plain `<a href>`. Converting the route to a form-action-only entry point requires rewriting every CTA. That's a UX surface change too wide for the review-fix PR.

## Scope

1. Convert the route to a `+page.svelte` that POSTs to a `start` action when no `?deck` is provided. The page renders an empty CTA "Start review" button that immediately submits via JS or shows the user a one-click affirmation.
2. Update every `<a href={ROUTES.MEMORY_REVIEW}>` to a `<form method="post" action={ROUTES.MEMORY_REVIEW}>` button (or wrap an existing button to submit).
3. Move `abandonStaleSessions` behind the same action so it doesn't fire on prefetch.
4. Tests: e2e prefetch test asserting no session row was created.

## Trigger

- Next memory-review UX overhaul (already on backlog).
- OR observed: ABANDONED rows growing faster than user activity warrants.
