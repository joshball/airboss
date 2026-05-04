---
title: 'Spec: Study home'
product: study
feature: study-home
type: spec
status: draft
review_status: pending
created: 2026-05-04
---

A new home surface at `/study` that orients a returning CFI rebuilding PPL knowledge. Friction near zero: progress context up top, a plain-English "Today" briefing in the middle, five equal-weight entry tiles (Read · Cards · Scenarios · Sim · Flight), and a hierarchical map of the cert with three switchable projections (ACS / Handbook / Course).

This is WP 1 of a three-WP arc. WP 2 is [flight-evidence-and-cfi-feedback](../flight-evidence-and-cfi-feedback/spec.md). WP 3 is [node-render-modes](../node-render-modes/spec.md).

## Why this WP exists

The current dashboard at `/dashboard` leads with a "Start review" CTA. That's the language-app failure mode -- a flashcard queue greeting you on day one. Returning to study should feel like opening a textbook plus a course, with a clear "where am I, what's next" briefing. Spaced repetition is critical, but secondary -- one of several ways to engage, never the entry point.

The substrate to do this right is already shipped:

- Cert / syllabus / goal model from ADR 016 (`getCredentialMastery`, areas + leaves)
- Evidence-kind data layer (per-leaf U/M/P state via `getNodeEvidenceState`)
- Knowledge graph + citations into flightbag (stage-5 deep-linking landed 2026-05-04)
- Weak-areas lens (`getWeakAreas`)
- Rep backlog (`getRepBacklog`)
- Reverse-citation lookup (`getNodesCitingSection`, `getNodesCitingSectionsBatch`)

What's missing is one beautiful surface that composes them.

## Anchors

- [decision-016](../../decisions/016-cert-syllabus-goal-model/decision.md) -- cert / syllabus / goal data backbone
- [decision-011](../../decisions/011-knowledge-graph-learning-system/decision.md) -- discovery-first pedagogy (informs Today prose + citation order)
- `apps/study/src/routes/(app)/credentials/[slug]/+page.svelte` -- the existing area-tree page; the ACS map projection is an evolution of this layout
- `apps/study/src/routes/(app)/dashboard/+page.svelte` -- the current dashboard (kept as the "Stats" power-user view per Decision Q1)
- `libs/bc/study/src/credentials.ts` -- `getCredentialMastery`, `getCredentialPrimarySyllabus`
- `libs/bc/study/src/mastery.ts` -- `getNodeEvidenceState`, `getNodeEvidenceStateMap`
- `libs/bc/study/src/dashboard.ts` -- `getWeakAreas`, `getRepBacklog`
- `libs/bc/study/src/references.ts` -- `getNodesCitingSection`, `getNodesCitingSectionsBatch`
- `course/regulations/` -- FAR navigation course, 10 weeks already authored; seeds the Course projection in v1

## In scope

### Surfaces

1. **`/study` page** (new). The post-login home for the study app. Lays out the three-section composition: Progress + Today + Map.
2. **Placeholder `/flight` page** (new). A one-screen banner explaining that the Flight tile lands in WP 2, with a link back to `/study` and to the WP 2 spec. No data, no form.
3. **Navigation update.** "Study" appears in the primary nav as the post-login default; existing `/dashboard` stays at its URL and is renamed "Stats" in the nav (preserves calibration / activity / matrix panels as a power-user view). Brand link in study app routes to `/study`.
4. **`study.user_pref` table** (new, minimal). Server-side persistence for the active map tab and the citation order toggle. See design.md "User preferences storage."
5. **Drizzle migration** that adds `study.user_pref` and the `audit.audit_log.target_type` widening for `'study.user_pref'`.

### Data composition (mostly read-only over existing BC)

Server load reads:

- `getCredentialPrimarySyllabus(userId)` -> the user's primary-goal credential.
- `getCredentialMastery(userId, credentialId)` -> the rollup with `byEvidenceKind` (drives the three-number progress strip and area-level rollups).
- `getWeakAreas(userId, limit, db, now)` -> picks the focus for "Today" prose.
- `getRepBacklog(userId)` -> the badge count on the Scenarios tile.
- For the Today focus node: `getNodeEvidenceState(userId, nodeId)` -> per-leaf U/M/P state.
- For the visible map area's leaves: `getNodeEvidenceStateMap(userId, leafIds)` -> batched per-leaf state.
- For Handbook projection: `getNodesCitingSectionsBatch({referenceId, sections})` -> nodes citing each section, then `getNodeEvidenceStateMap` over the union.
- For Today day-count: new helper `getFirstTouchDate(userId, nodeId)` -> earliest evidence touch on the focus node.
- For user prefs: new BC `getUserPrefs(userId, keys)` and `setUserPref(userId, key, value)` against `study.user_pref`.

### The three-number progress strip

Three independent percentages, each with absolute counts:

| Pill         | Source                                             | Pill on a leaf |
| ------------ | -------------------------------------------------- | -------------- |
| Understood   | `mastery.byEvidenceKind.recall.passing / required` | U              |
| Memorized    | `mastery.byEvidenceKind.calculation.passing / required` | M           |
| Practiced    | `mastery.byEvidenceKind.scenario.passing / required` (today; widens to scenario + demonstration once WP 2 lands) | P |

No composite "mastery %". Three numbers tell three different stories, and a single number hides where the gap is.

### Today briefing

A single paragraph generated from existing weakness signals.

- If `getWeakAreas` returns at least one area, drill to the weakest leaf in that area via `getNodeEvidenceStateMap` and produce a deterministic templated paragraph (see design.md "Today prose template").
- If no weak signal (caught up, brand new, or no evidence yet), show a "you're caught up" message + the unfilled tiles + the map below.
- The paragraph is followed by a "today's focus topic" link to the leaf's knowledge node page.

Plain English, no jargon, deterministic templates -- no LLM in the loop. See design.md for the template grammar.

### The five tiles

Equal weight, equal size, no pre-selected primary CTA.

| Tile          | Label              | Badge                                | Target                                                                                 |
| ------------- | ------------------ | ------------------------------------ | -------------------------------------------------------------------------------------- |
| Read          | Open handbook      | "PHAK ch. N" (today's section if present) | `ROUTES.LIBRARY` (filtered to the focus topic when present, otherwise the index)  |
| Cards         | Start review       | "N due / M new"                      | `ROUTES.MEMORY_REVIEW` (or `MEMORY_REVIEW_FOR_NODE(focusNodeId)` if a focus exists)    |
| Scenarios     | Run a scenario     | "N ready"                            | `ROUTES.REPS`                                                                          |
| Sim           | Practice in sim    | "Available"                          | sim app origin (cross-app link)                                                        |
| Flight        | Log a flight       | "WP 2"                               | `/flight` placeholder route (real surface lands in WP 2)                               |

The user picks. The system **never** auto-routes from `/study` into any tile target.

### Map of the cert

A hierarchical view of the cert content. Three switchable projections via tab-strip at the top of the map: `[ACS] [Handbook] [Course]`. Tab choice persists per user via `study.user_pref` key `study.home.map_tab`.

#### Projection 1: ACS (default)

- Top level: areas (e.g., "I. Preflight Preparation"). Roman numeral + title.
- Second level: tasks (e.g., "A. Pilot Qualifications"). Letter + title.
- Third level: leaves (the things mastery is gated on). Element-coded if the syllabus has element rows; otherwise the task itself acts as leaf.
- Per-area row: cumulative mastery bar (10 dots, filled by `masteredLeaves / totalLeaves`) + percentage.
- Per-leaf row: status glyph + title + three pills (U / M / P, each `●` mastered / `○` covered-not-mastered / `--` not applicable for this leaf) + a folded citation row (open on click).
- Auto-expand: the area containing the current weak focus (from `getWeakAreas`). All other areas collapsed.
- One "expand all" affordance at the top of the map.

Status glyph mapping:

| Glyph | State                                                                      |
| ----- | -------------------------------------------------------------------------- |
| `✓`   | All required pills `●` (mastered)                                          |
| `⊙`   | At least one required pill is `●` or non-zero attempts                     |
| `○`   | No attempts on any required pill                                           |

#### Projection 2: Handbook

- Top level: handbook (PHAK / AFH / AvWX / 14 CFR / AIM).
- Second level: chapter (or part for CFR).
- Third level: section. Optional in v1 -- the "view this chapter's nodes" link drills into the existing flightbag reader.
- Per-chapter row: a mastery bar over `getNodesCitingSection({referenceId, chapter})` -- the union of knowledge nodes that cite anything in this chapter, mastery rolled up via `getNodeEvidenceStateMap`. Chapters with no citing nodes show "no nodes yet" rather than 0%.
- The list is the union of cached references that have at least one citing node. Empty references are hidden.
- Auto-expand: the handbook + chapter that holds the focus node's primary handbook citation, if any.

#### Projection 3: Course

- Seeded in v1 by the FAR navigation course at `course/regulations/`. 10 weeks, each with lessons + drills + an oral exam.
- Top level: week (e.g., "Week 1: Architecture").
- Second level: lesson within the week.
- Per-lesson row: mastery rolled up over the ACS leaves and / or knowledge nodes the lesson cites (each lesson's frontmatter lists `cites:` -- see design.md).
- Lessons that cite only `handbook_sections` (no `knowledge_nodes` or `acs_leaves`) show a "(reading)" badge in place of a mastery bar -- they are read-and-move-on lessons that contribute to coverage but not to mastery rollup.
- "Course" is forward-compatible with WP 2's CFI teaching syllabus: a CFI's syllabus would seed this projection from a `syllabus` row instead of from `course/regulations/` files. WP 2 does the swap; this WP just files-only seed.
- **Frontmatter contract:** every lesson in `course/regulations/` carries an authored `cites:` block with three explicit lists -- `knowledge_nodes`, `acs_leaves`, `handbook_sections`. See design.md "Course frontmatter contract" for the schema. **All 10 weeks are backfilled as part of this WP** (tasks step 7); no lesson ships in `reading-only` state. Where the right citation is ambiguous or counter-productive (e.g., a lesson genuinely covers no ACS leaf), the lesson is paused and surfaced for review rather than silently shipped.

### Citation handling on a leaf

When a user expands a leaf row in the ACS map, the citation panel opens with:

- Two stacks side by side (or stacked vertically on narrow screens):
  - **Handbook** (PHAK / AFH / AvWX / AIM / AC). Default expanded.
  - **Regulation** (14 CFR sections). Default collapsed but visible.
- Both stacks render as `CitationChip` rows linking to flightbag sections via `urlForReference()`.
- A `[hb][reg]` toggle at the top right of the panel flips which stack is open. State persists **server-side per user** in a new `study.user_pref` table (see design.md "User preferences storage").

Per ADR 011 + user discussion: handbook-first default, configurable, transparent escape hatch. Both fully accessible.

## Behavior

### Loading

- `+page.server.ts` resolves the user's primary goal credential. If the user has no primary goal, the page shows a banner "Set a primary goal to personalize your study home" with a link to `ROUTES.GOALS_NEW`, then renders the page in cert-agnostic mode (no progress strip, no map, generic tiles).
- All BC reads in parallel via `Promise.all`. Total target: under 200 ms server-side for a seeded user with a primary goal.
- Map projections lazy-load: only the active tab fetches its data. Switching tabs triggers a `fetch('/study?tab=handbook')` via `invalidateAll()` or a client-side refresh of the just that section's data.

### Today prose

Computed server-side in the load function:

1. Call `getWeakAreas(userId, 1, db, now)`. If the result is empty, return `kind: 'caught_up'`.
2. Take the top weak area, then call `getNodeEvidenceStateMap` for its leaves, pick the leaf with the deepest gap (most missingKinds, then lowest accuracy).
3. Build a `TodayBriefing` value object (see design.md): `{ kind, areaTitle, leafTitle, leafSlug, signals: WeaknessReason[], dayCount }`.
4. The page component renders that into the templated paragraph.

The "dayCount" -- "you've been working on this for N days" -- comes from a small new helper `getFirstTouchDate(userId, nodeId)` that returns `min(card_state.lastReviewedAt, session_item_result.startedAt, flight_maneuver.created_at)` for any evidence tied to the focus node. Lives in `libs/bc/study/src/dashboard.ts` alongside `getWeakAreas`. (This is the one explicit exception to the "no new BC" guard rail in this WP -- a tiny helper, not a new domain function.)

### Tile click

Each tile is a `<a>` to its target route. No JS in the click path. Cards opens with `?nodeId={focusNodeId}` if a focus exists, so the review queue prioritizes that leaf -- this is already supported by `MEMORY_REVIEW_FOR_NODE`.

### Map tab switch

Tabs are buttons that swap a `tab` query param. Each tab loads its own data via the `+page.server.ts` `tab` discriminator. No client-side fetch -- a full page navigation is fine and keeps the Network tab honest.

### Map row expand

Areas are `<details><summary>` pairs. JS-free expand. The auto-expanded area uses `open` attribute set server-side based on the focus leaf's area. Per-leaf citation row is a second `<details>` nested inside the leaf row.

## Validation

| Field                                | Rule                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `tab` query param                    | Must be `'acs' \| 'handbook' \| 'course'`. Default `'acs'`. Invalid -> redirect to `/study` (no tab param). |
| `cert` query param (post-MVP)        | If present, must match a credential the user has access to. v1: ignored.       |
| Citation toggle preference           | Server-side `study.user_pref` row, key `study.home.citation_order`, value `'hb' \| 'reg'`. Default `'hb'`. Invalid value rejected by Zod; falls back to default. |
| Map tab preference                   | Server-side `study.user_pref` row, key `study.home.map_tab`, value `'acs' \| 'handbook' \| 'course'`. Default `'acs'`. Invalid -> default. |

One form action: `?/setPref` (POST, threaded through SvelteKit form actions) writes a single key/value to `study.user_pref`. No other writes.

## Edge cases

| Trigger                                                                                          | What happens                                                                                                                                             |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User has no primary goal                                                                         | Banner "Set a primary goal" + link to `/goals/new`. Cert-agnostic page renders below: tiles still work, no progress strip, no cert map.                  |
| Primary goal credential has no primary syllabus authored                                         | Empty-state on the map: "Syllabus not yet authored." Progress strip shows 0/0 (renders as `--%`). Today prose falls through to "you're caught up."        |
| `getWeakAreas` returns empty                                                                     | Today prose: "You're caught up. Pick a topic from the map to dig in." Tiles render with neutral badges ("0 due", "0 ready").                              |
| User has primary goal but it's not PPL (e.g. CFI)                                                | Page works. ACS projection uses whatever syllabus is primary. Handbook projection works. Course projection shows "no course content seeded for this cert" with a link to `course/regulations/` for the FAR nav reference. |
| Handbook projection: no citing nodes for a given handbook                                        | The handbook row hides. If all handbooks are empty: "No knowledge nodes have citations yet." Empty-state.                                                |
| Course projection: a lesson cites a knowledge node that's been deleted or renamed                | The lesson renders, the broken cite is omitted from the rollup, dev-mode shows a console warning.                                                         |
| Tile target route is gone (e.g. sim app down)                                                    | The tile still renders. Click leads to a 404; no special handling at the tile level.                                                                       |
| Map row has 200+ leaves (CFI ACS)                                                                | Per-area cap at v1: render the first 50 leaves expanded, "show all 200" affordance to expand the rest. ACS / PPL has < 50 per area so this is a CFI guard. |
| User toggles citation order in the panel                                                         | Form-action POST writes the new value to `study.user_pref`; subsequent panels open in the new order. Optimistic UI; rollback on error.                   |
| Mobile screen (< 700 px)                                                                         | Page renders but explicitly degrades. Pills stack vertically, tiles wrap to 2 per row, map collapses to ACS-only with a notice "Switch to desktop for full map." Desktop is the canonical experience; mobile is best-effort. |
| Network failure on tab switch                                                                    | Standard SvelteKit error page. The page is read-only so retry is safe.                                                                                    |

## Decisions (formerly open questions, ratified 2026-05-04)

| # | Question                              | Decision                                                                                                                          |
| - | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1 | `/study` vs `/dashboard`              | `/study` becomes the post-login default. `/dashboard` keeps its URL; renamed "Stats" in nav. Power-user view stays alive.          |
| 2 | Credential dropdown                   | v1 renders the user's primary-goal credential as static text in the page header, with a "(switch)" link to `/goals`. No dropdown. |
| 3a| Course projection seed                | FAR navigation course at `course/regulations/`. Only seed in v1.                                                                  |
| 3b| `cites:` frontmatter shape            | Heavy: explicit `knowledge_nodes`, `acs_leaves`, `handbook_sections` arrays. Author each correctly; pause and surface the ambiguous. |
| 3c| Backfill scope                        | All 10 weeks backfilled in this WP. No `reading-only` lessons at ship.                                                            |
| 4 | Mobile                                | Desktop-first canonical. Mobile (< 700 px) renders, explicitly degrades: stacked pills, wrapped tiles, ACS-only map with a notice. |
| 5 | Today prose                           | Deterministic templates. No LLM in v1.                                                                                            |
| 6 | Day-count signal                      | Add `getFirstTouchDate(userId, nodeId)` helper to `dashboard.ts`. Day-count appears in the prose.                                  |
| 7 | Persistence                           | Server-side `study.user_pref` table. Two keys this WP: `study.home.citation_order`, `study.home.map_tab`.                          |

These are no longer open. The text above (Anchors / In scope / Behavior / Validation / Edge cases) reflects each decision.

## Out of scope

- **No flight log / GPS ingest / CFI feedback.** That's [WP 2: flight-evidence-and-cfi-feedback](../flight-evidence-and-cfi-feedback/spec.md). The Flight tile here is a stub linking to a placeholder route.
- **No knowledge node body re-render** -- discovery vs. memorize render-mode toggle is [WP 3: node-render-modes](../node-render-modes/spec.md). Knowledge node detail pages render as they do today.
- **Minimal new BC + schema.** One new table (`study.user_pref`) and three small helpers (`getFirstTouchDate`, `getUserPrefs`, `setUserPref`). Everything else is surface composition over existing BC.
- **No content authoring.** The page works against whatever knowledge graph + syllabus content exists today; gaps are visible (empty area rollups), not papered over.
- **No kanban board.** Decided against in conversation: kanban fights spaced rep, and the engine already orders for you. The "what's next" stream is the briefing + tiles + the map's auto-expanded area. The map itself is a status-at-a-glance view of the *content*, not a queue of cards.
- **No multi-credential master view.** Post-MVP.
- **No FAA logbook integration.** Logbook ingest would be its own corpus + ingest pipeline, far beyond this arc.
- **No client-side-only state.** `study.user_pref` is the canonical store; nothing meaningful lives only in localStorage.
- **No real-time progress updates.** Page is a snapshot at load; the user navigates, completes work, comes back, sees fresh numbers. No websocket / poll.

## What "done" looks like

A user lands at `/study`, sees their PPL progress (three pills), reads a one-paragraph plain-English briefing about today's focus including the day count, picks one of five tiles, and navigates. They scroll down to a hierarchical ACS map with the today-focus area auto-expanded; they switch to Handbook view (PHAK / AFH chapters with mastery rolled up over citing nodes) or Course view (FAR nav course, all 10 weeks fully cited). Per-leaf rows show U/M/P pills + citations stacked handbook-first / reg-collapsed; the citation order toggle persists per user in `study.user_pref`. The map tab choice persists the same way. `bun run check` clean, vitest + Playwright green.
