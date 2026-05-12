---
title: 'Out of Scope: Study home'
product: study
feature: study-home
type: out-of-scope
status: unread
---

# Out of Scope: Study home

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                                 | Status       | Trigger to revisit                                                          |
| ---------------------------------------------------- | ------------ | --------------------------------------------------------------------------- |
| Flight log / GPS ingest / CFI feedback               | Follow-on WP | WP 2 (flight-evidence-and-cfi-feedback) is the owner                        |
| Knowledge-node body render mode toggle               | Follow-on WP | WP 3 (node-render-modes) is the owner                                       |
| New BC + schema beyond the minimal set               | Rejected     | Never -- see detail below                                                   |
| Content authoring (graph / syllabus authoring tools) | Deferred     | When content gaps surface as a recurring user friction at /study            |
| Kanban board "what's next" surface                   | Rejected     | Never -- see detail below                                                   |
| Multi-credential master view                         | Deferred     | When users hold more than one active goal credential and need a meta-view   |
| FAA logbook integration                              | Deferred     | When ingesting FAA airman / logbook records becomes a roadmap priority      |
| Client-side-only state                               | Rejected     | Never -- see detail below                                                   |
| Real-time progress updates (websocket / poll)        | Deferred     | When stale-at-load progress causes confusion in a multi-tab / pair-study UX |

## Flight log / GPS ingest / CFI feedback

Status: Follow-on WP

What was deferred:
The Flight tile's destination surface: pilot self-report of completed flights, GPS-track / logbook ingest, and CFI feedback capture. This WP ships only the Flight tile pointing at a `/flight` placeholder route that explains the deferral.

Why:
The cert-mastery substrate (ADR 016) makes flight evidence a first-class evidence kind alongside recall / calculation / scenario; building the ingest + feedback surface is large enough to be its own WP. Splitting keeps `/study` shippable on its own.

Trigger to revisit:
WP 2 -- [flight-evidence-and-cfi-feedback](../flight-evidence-and-cfi-feedback/spec.md) -- is the named follow-on; it ships immediately after this WP.

Implementation pattern when triggered:
Follow the spec at [docs/work-packages/flight-evidence-and-cfi-feedback/spec.md](../flight-evidence-and-cfi-feedback/spec.md). The Flight tile in `apps/study/src/routes/(app)/study/_panels/TilesPanel.svelte` already points at `ROUTES.FLIGHT`; the WP swaps the placeholder route for the real surface without `/study` changes.

References:

- [spec.md "Out of scope"](./spec.md)
- [spec.md "Why this WP exists"](./spec.md)
- [WP 2 spec](../flight-evidence-and-cfi-feedback/spec.md)

## Knowledge-node body render mode toggle

Status: Follow-on WP

What was deferred:
The discovery vs memorize render-mode toggle on knowledge-node detail pages. Today the body renders one way; the toggle that switches between pedagogy modes is out of scope for `/study`.

Why:
Render-mode work touches every knowledge-node detail surface plus the underlying body data shape. It is large enough to be its own WP and orthogonal to the home-page composition this WP ships.

Trigger to revisit:
WP 3 -- [node-render-modes](../node-render-modes/spec.md) -- is the named follow-on; it ships after WP 2.

Implementation pattern when triggered:
Follow the spec at [docs/work-packages/node-render-modes/spec.md](../node-render-modes/spec.md). The `USER_PREF_KEYS` constant added by this WP is shared infrastructure; WP 3 adds its mode key to the same constant and reuses `getUserPrefs` / `setUserPref` from `libs/bc/study/src/user-prefs.ts`.

References:

- [spec.md "Out of scope"](./spec.md)
- [WP 3 spec](../node-render-modes/spec.md)
- [ADR 011 -- knowledge graph learning system](../../decisions/011-knowledge-graph-learning-system/decision.md)

## New BC + schema beyond the minimal set

Status: Rejected

What was rejected:
Adding additional BC functions, tables, or schema beyond the strictly necessary set for this WP. The only new artifacts this WP ships are:

- One new table: `study.user_pref`.
- Three small helpers: `getFirstTouchDate`, `getUserPrefs`, `setUserPref`.

Why:
The substrate to compose `/study` already exists (ADR 016 cert / syllabus / goal model, evidence-kind data layer, knowledge graph + citations, weak-areas lens, rep backlog, reverse-citation lookup). Scope discipline -- this WP is surface composition, not data-model expansion. A re-decision would require an actual `/study` composition that demonstrably cannot be expressed over the existing BC.

References:

- [spec.md "Out of scope"](./spec.md)
- [spec.md "Why this WP exists" (substrate list)](./spec.md)

## Content authoring (graph / syllabus authoring tools)

Status: Deferred

What was deferred:
Authoring affordances for the knowledge graph, syllabus content, and ACS leaves. This WP ships with no authoring -- gaps in content are visible on the page (empty area rollups, "no nodes yet" messages) rather than papered over.

Why:
The composition layer should work over whatever content exists. Authoring is a separate concern, likely living in the hangar app, with its own authoring patterns and review surfaces.

Trigger to revisit:
When gaps in graph / syllabus / ACS content surface as recurring friction on `/study` (e.g. users repeatedly hitting "no nodes yet" empty states in areas they want to study), OR when a content-authoring WP launches and needs surface affordances on `/study` for content gaps.

Implementation pattern when triggered:
Surface affordances on `/study` would link out to a hangar authoring surface, not embed authoring into the study app. Mirror the existing hangar admin job-status pattern -- gap visibility on study, authoring controls in hangar.

References:

- [spec.md "Out of scope"](./spec.md)

## Kanban board "what's next" surface

Status: Rejected

What was rejected:
A kanban-style task board (e.g. "Backlog | In progress | Done") on `/study`, where the user moves cards through columns to track progress.

Why:
Decided against in spec conversation: kanban fights spaced rep, and the engine already orders for you. The "what's next" stream is the Today briefing + tiles + the map's auto-expanded area. The map itself is a status-at-a-glance view of the content, not a queue of cards. A re-decision would require a study workflow where the engine's ordering demonstrably fails the learner.

References:

- [spec.md "Out of scope"](./spec.md)

## Multi-credential master view

Status: Deferred

What was deferred:
A meta-surface that shows progress across multiple credentials (e.g. PPL + IR + CFI side by side). This WP renders one credential -- the user's primary goal -- with a "(switch)" link to `/goals` per Decision 2.

Why:
Joshua is rebuilding PPL knowledge now; multi-credential progress is post-MVP. Building the meta-view before there are users actively pursuing multiple credentials in parallel is overhead with no payoff.

Trigger to revisit:
When users hold more than one active goal credential simultaneously AND need to compare progress across them, OR when the cert-syllabus-and-goal-composer flow surfaces multi-credential as a first-class concept.

Implementation pattern when triggered:
Spawn a follow-on WP. Likely a new route (e.g. `/study/credentials`) that lists each credential with its three-number progress strip side-by-side. Reuses `getCredentialMastery` per credential plus a new BC that lists all credentials a user has goals against.

References:

- [spec.md "Out of scope"](./spec.md)
- [spec.md Decision 2 -- credential dropdown](./spec.md)

## FAA logbook integration

Status: Deferred

What was deferred:
Ingestion of FAA airman records, electronic logbooks (ForeFlight, MyFlightbook, Garmin Pilot), or paper-logbook OCR into the airboss evidence layer. Flight evidence flows in via WP 2's self-report path, not via external logbook ingest.

Why:
Logbook ingest is its own corpus + ingest pipeline (parser per format, identity reconciliation, dedup), far beyond the home-surface scope of this WP and well beyond WP 2's self-report scope.

Trigger to revisit:
When ingesting external logbook data becomes a stated roadmap priority, OR when manual flight self-report friction (in WP 2) drives a request for automated import.

Implementation pattern when triggered:
Spawn a dedicated WP. Likely lives behind the source-ingestion pipeline pattern (see [docs/ingestion-pipeline/](../../ingestion-pipeline/)) with per-format parsers, a normalized intermediate representation, and emission into the same `flight_maneuver` / flight-evidence shape that WP 2 lands.

References:

- [spec.md "Out of scope"](./spec.md)

## Client-side-only state

Status: Rejected

What was rejected:
Storing meaningful user state (citation-order toggle, map-tab choice, etc.) only in localStorage or other client-side stores. `study.user_pref` is the canonical store; nothing meaningful lives only in the browser.

Why:
Persistence across devices, sessions, and clean-browser scenarios is a usability requirement. Client-only state fails silently on a new device / cleared storage. A re-decision would require a pref so transient it doesn't deserve a server round-trip -- which the current pref set does not include.

References:

- [spec.md "Out of scope"](./spec.md)
- [spec.md Decision 7 -- Persistence](./spec.md)

## Real-time progress updates (websocket / poll)

Status: Deferred

What was deferred:
Server-push updates to the progress strip / map / today briefing while the user has `/study` open. Today the page is a snapshot at load; the user navigates, completes work, comes back, and sees fresh numbers.

Why:
The snapshot model matches the use case -- study is bursty (work in one surface, come back), not steady-state monitoring. Real-time plumbing (websocket or poll) is infrastructure with no proven user need.

Trigger to revisit:
When a multi-tab or pair-study workflow surfaces stale-at-load progress as confusing (e.g. user reviews cards in another tab, returns to /study, expects the strip to already reflect the new numbers without a refresh).

Implementation pattern when triggered:
Most likely a lightweight SvelteKit invalidate-on-visibility-change hook before reaching for websockets. If real-time push is needed, mirror the existing scheduled-jobs pattern -- a server-side change feed plus EventSource on the client.

References:

- [spec.md "Out of scope"](./spec.md)
