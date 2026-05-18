---
id: personal-minimums-as-typed-contract
title: 'User Stories: Personal Minimums as a Typed Contract'
product: study
category: feature
status: draft
agent_review_status: done
human_review_status: pending
created: 2026-05-13
owner: agent
depends_on: []
unblocks:
  - xc-viewer-personal-minimums-overlay
  - decision-debrief-replay
  - logbook-ingestion
tags:
  - personal-minimums
  - user-stories
legacy_fields:
  feature: personal-minimums-as-typed-contract
  type: user-stories
---

# User Stories: Personal Minimums as a Typed Contract

User-perspective narratives covering two primary roles -- pilots (recording their own minimums and viewing the implications) and future-consumer agents (binding to the lens contract). The library does not surface to instructors / CFIs directly in v1; CFI sharing is out of scope per [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

## Setting personal minimums (pilot, first time)

- As a 200-hour PPL who just finished the `wx-personal-minimums` knowledge node, I want to navigate from the node to a page where I can record my numbers right now, so the decision happens while the pedagogy is fresh and not days later when I've forgotten why I was setting a floor.
- As a pilot setting minimums for the first time, I want the form to come pre-seeded with the FAA P-8740-25 baseline (the same numbers the knowledge node showed me in its "Reveal" table) so I have a starting shape and only tune what I disagree with.
- As a pilot writing notes alongside my numbers, I want markdown formatting (lists, bold, headings) so I can record the rationale ("I'm tightening the night ceiling because I haven't flown after dark since November") with structure.
- As a pilot who finished the form, I want a single Save button rather than a confirmation flow, because the discipline is "write it down once when not under pressure" -- a multi-step save makes the deliberate decision feel like a transactional checkout.
- As a pilot who fat-fingered a value (entered crosswind 25 kt while wind total is 20 kt), I want the form to surface the inline error before submit so I don't have to refresh and start over.
- As a pilot who has just set my minimums for the first time, I want to immediately see "what these imply" -- a concrete list of weather scenarios where these floors would have meant a no-go -- so the abstract numbers feel real.

## Editing personal minimums (pilot, returning)

- As a pilot who's been flying for six more months and feels ready to loosen one floor, I want to navigate to `/personal-minimums`, see my current values, click Edit, change one number, and save -- without the platform asking me to justify the change in a free-text textbox I'd skip.
- As a pilot who just made a change I might regret, I want a visible history (the `/personal-minimums/history` view) so I can see exactly what I had before and revert if I change my mind by setting the prior numbers back manually.
- As a pilot who is intentionally retracting my minimums to recalibrate from scratch, I want a Deactivate affordance that returns me to the empty state without forcing me to set new numbers in the same moment.
- As a pilot editing in two browser tabs by accident, I want the platform to surface a clear "your minimums changed in another tab -- reload" message rather than silently overwriting one tab's edit with the other.
- As a pilot who sets the exact same values twice in a deliberate IPC-driven re-commitment, I want the history to record both events (with different timestamps) so my audit trail shows I deliberately re-affirmed my floors at the start of a new training block.

## Viewing implications (pilot, working through the surfaced consequences)

- As a pilot who saved a ceiling of 1500 ft, I want to see which wx-engine scenarios in the platform would have meant a no-go for me, so the floor isn't just a number -- it's a concrete decision applied to concrete weather.
- As a pilot reading the implications subpanel, I want each violation to name a specific station and the specific gap ("KMLI: ceiling 800 ft AGL below your 1500 ft floor") so the implication is grounded in a real reading, not in a vague "this scenario is hard."
- As a pilot whose floor is high enough that no scenario violates it, I want the subpanel to say "no scenarios violate your stated floor" rather than silently rendering nothing, so I know the panel is working.
- As a pilot looking at the night-currency placeholder, I want a clear "we can't check this yet -- once logbook ingestion ships, this will tell you" message so I understand the gap is in the platform's data, not in my personal-minimums setting.
- As a pilot who has not yet set any minimums, I want the implications subpanel to say "set your minimums to see implications" rather than running comparisons against the default-seeded values (which I haven't agreed to).

## Reviewing history (pilot, audit / debrief)

- As a pilot looking back six months at how my minimums have evolved, I want a chronological history view (`/personal-minimums/history`) with the effective window and the per-field values for each revision, so I can see whether I've been tightening or loosening over time.
- As a pilot reading the notes I wrote on a prior revision, I want them to render as formatted markdown so the rationale I captured back then is legible now.
- As a pilot who flipped Deactivate three months ago and then set new minimums later, I want the history view to show both events with the correct `effective_until` stamps so the gap is visible (a period where I had no active minimums on record).

## Knowledge-node connection (pilot, learning context)

- As a pilot who hasn't yet read the `wx-personal-minimums` knowledge node, I want the `/personal-minimums` page header to link to the node so I can read the why before I write the what.
- As a pilot reading the `wx-personal-minimums` node, I want a closing nudge ("now that you understand why -- record yours here") with a working link to `/personal-minimums` so the pedagogy hands me directly to the persistence surface.

## Future consumers binding to the lens (agent, building a follow-on WP)

- As an agent implementing the xc-viewer personal-minimums overlay, I want a single function `projectAgainstPersonalMinimums(minimums, observation)` to call from a `.svelte` file, so I don't have to reach into the DB or the BC from the browser.
- As an agent loading the active minimums in a server-side `+page.server.ts`, I want `getActivePersonalMinimums(userId)` as a one-line call that returns the full row or null, so my consumer is a thin pass-through to the BC.
- As an agent implementing the decision-debrief replay, I want `getPersonalMinimumsHistory(userId)` to return every revision ordered by `effective_from DESC` so I can find the revision that was active on a given flight date by walking the list.
- As an agent reading [CONSUMER-CONTRACT.md](./CONSUMER-CONTRACT.md), I want the doc to cover (a) what the BC functions return, (b) what the lens input / output shapes look like, (c) which existing consumers bind which surface, so I can write my consumer's data load and rendering without reading the spec.
- As an agent confident I've bound to the contract correctly, I want the lens to be a pure function so my consumer can call it inline in a `.svelte` component as the user pans / zooms / selects -- no IPC, no fetch, no server round-trip.

## Cross-cutting: integrity and trust

- As a pilot, I want the platform to remember my minimums across sessions so I don't have to re-enter them each time I log in.
- As a pilot using two devices, I want the active record to be the same on both (latest write wins via the partial unique index) so I can't accidentally have different "active" minimums in different places.
- As a pilot, I want my minimums to persist independently of any course / goal / cert progress, so if I drop a course or start a new one my floor doesn't reset.
- As a future agent reading the schema, I want the partial unique index to make the "at most one active per user" invariant a storage-layer guarantee rather than relying on the BC's transactional discipline alone, so accidental direct INSERTs from a one-shot script can't corrupt the active-record contract.
- As any agent on this project, I want `projectAgainstPersonalMinimums` to be pure (no DB, no fs, no node:*) so I can ship it to the browser without bundle-leak risk.
- As any agent on this project, I want every write to `personal_minimums` to emit an `audit_log` row so the change history is reconstructable from the audit trail even if the table is later truncated for some reason.

## Negative stories (out of scope, captured for reference)

These belong in [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md), included here so the reader can see the full shape:

- As a pilot, I want the platform to suggest minimums based on my hours and recency (AI-suggested floors) -- rejected per OUT-OF-SCOPE (outsourcing the deliberation defeats the pre-commitment pedagogy).
- As a pilot, I want different ceiling / visibility floors for day vs night -- deferred per OUT-OF-SCOPE (gated on user-zero documented friction with the single-floor + isNight observation pattern).
- As a pilot flying two different aircraft, I want different personal minimums per aircraft -- deferred per OUT-OF-SCOPE (gated on multi-aircraft logbook support).
- As a pilot, I want the platform to tighten my minimums automatically over time -- deferred per OUT-OF-SCOPE (auto-tightening is at odds with the deliberate pre-commitment discipline; if revisited it would need its own pedagogy).
- As a CFI, I want to see my student's personal minimums and comment on them -- deferred per OUT-OF-SCOPE (gated on the broader CFI-sharing / access-model work).
- As a pilot, I want the xc-viewer to overlay my minimums on the route map -- deferred per OUT-OF-SCOPE (handed off to the `xc-viewer-personal-minimums-overlay` follow-on WP per the consumer contract).
- As a pilot, I want a side-by-side comparison of "what I said vs what I flew" -- deferred per OUT-OF-SCOPE (handed off to the `decision-debrief-replay` follow-on WP).
- As a pilot, I want my last 5 logged flights overlaid on my stated minimums -- deferred per OUT-OF-SCOPE (handed off to the `logbook-ingestion` follow-on WP).
