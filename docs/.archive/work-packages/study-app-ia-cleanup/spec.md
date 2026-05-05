---
title: 'Spec: Study App IA Cleanup'
product: study
feature: study-app-ia-cleanup
type: spec
status: done
review_status: done
created: 2026-05-04
shipped: 2026-05-05
---

# Spec: Study App IA Cleanup

Collapse the study app's twelve top-level entries into five sections (Home / Learn / Program / Insights / Reference), make the daily CTA the centerpiece of Home, and ship the "explain everything" plumbing (hover tooltips, page explainers, glossary drawer, `?` popovers for numbers) so every term and number in the product has an explanation surface. Pure UX/IA cleanup -- no BC changes, no new schema.

## Anchors

- [Source plan -- 2026-05-04 study app IA cleanup proposal](../../work/plans/20260504-study-app-ia-cleanup.md). Spec source. All Q1-Q11 trade-offs live there.
- [Goal-detail walkthrough todo](../../work/todos/20260504-03-goal-detail-walkthrough-TODO.md). The walkthrough that triggered this WP. Small fixes captured there resolve naturally inside this reorg.
- [VOCABULARY.md](../../platform/VOCABULARY.md). Adds Quals / Plan / CTA / IA / BC entries. Update as part of Phase 1.
- [DESIGN_PRINCIPLES.md](../../platform/DESIGN_PRINCIPLES.md). "Explain everything" elevates to a stated principle.
- [ADR 016 -- Cert / Syllabus / Goal model](../../decisions/016-cert-syllabus-goal-model/decision.md). Goal BC behavior; one primary per user.
- [libs/bc/study/src/goals.ts](../../../libs/bc/study/src/goals.ts) and [libs/bc/study/src/plans.ts](../../../libs/bc/study/src/plans.ts). Goal vs Plan invariants the UI must respect.
- [libs/help/](../../../libs/help/). Existing help corpus the glossary surfaces feed from.
- [docs/agents/best-practices.md](../../agents/best-practices.md). Gets a new "E2E selectors" section as part of this WP.

## Goals

- One home, one CTA. The user lands and answers "what should I do right now?" in one glance and one click.
- Five top-level sections, each with a one-line tagline so it does not become a junk drawer.
- Every term used in the nav and on dashboard tiles has a hover tooltip. Every number has a `?` popover. Every page that introduces a new concept opens with a "Why am I here?" explainer.
- Old paths keep working via 301 redirects. No broken bookmarks, emails, or doc links.
- Brand-new (first-run) users see one obvious next step ("Set your first goal") and are not punished for browsing the Reference section.
- The wide e2e flow (`ia-flow.spec.ts`) proves every top-level route renders without console errors.

## Non-goals

- Goal vs Plan BC merge. The BCs stay separate (Q1 -> Option C). UI is a single Program surface; backend stays as is.
- Multi-goal authoring UI. Multi-goal is a future feature; this WP only respects the existing "at most one primary" invariant.
- Cross-app reorganisation (flightbag, hangar). Right cluster keeps Flightbag as is; the new glossary drawer is the only addition.
- New BC functions or new DB tables. Pure UI/route work.
- Engine scoring tweaks, calibration math, knowledge-graph authoring. Those surfaces move under Insights / Reference but their internals do not change.
- Mobile-specific layouts. Desktop-first per the rest of the study app.

## Audience model

The user lands on the home in one of three modes. Optimize for **Today** (every visit). First-run is once. Wandering is rare.

| Mode      | Profile                                                                                  | What they need                                                                  |
| --------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| First-run | Just signed up. No goal, no plan, no decks, no history.                                  | One obvious next step. Everything else hidden or muted.                         |
| Today     | Has an active goal + plan. Returning for a daily session.                                | Shortest path to "do today's work" (review due cards, do scheduled reps, read). |
| Wandering | Has time, wants to explore. Browse handbook, drill a weak area, look up a regulation.    | Reference is reachable from anywhere; nothing is gated unnecessarily.           |

## Glossary (in-spec)

Every term used in this WP. These also seed the in-app glossary surface and the hover tooltip corpus.

| Term            | One-line definition                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CTA**         | Call-To-Action. The button or link that's the obvious next thing to click. Primary CTA = the one big button; secondary CTAs = smaller follow-ups.    |
| **IA**          | Information Architecture. How the product is organized into pages and sections. The map. What's a top-level tab vs what's nested.                    |
| **BC**          | Bounded Context (DDD). A backend module that owns one model and its rules. `bc/study` owns goals, plans, sessions as separate sub-aggregates.        |
| **Qual**        | UI label for "credential" -- PPL, IR, CPL, CFI. The DB table is `credential`; the user word is **Quals**. Treat the BC name as implementation detail. |
| **Goal**        | The slice of study the learner is focused on (e.g. "Pass PPL written by July"). Bundles syllabi + ad-hoc nodes. One primary per user.                |
| **Plan**        | The schedule and session shape attached to the user (length, default mode, focus/skip domains). One active per user. Drives `/session/start`.        |
| **Syllabus**    | An ACS or PTS document. Structured list of areas/tasks/elements published by the FAA, per certificate.                                               |
| **Knowledge node** | One atomic teachable concept in the airboss knowledge graph (ADR 011). Linked to syllabus tasks, FAA references, and review cards.                |
| **Cards**       | Memory review (spaced repetition). Short-form recall.                                                                                                |
| **Reps**        | Scenario reps. Decision-making mini-scenarios.                                                                                                       |
| **Session**     | One contiguous study sitting. The session engine picks slices (cards, reps, reading) based on the active plan.                                       |
| **Domain**      | One of the FAA knowledge areas (Weather, Aerodynamics, Navigation, ...). Used to focus or skip categories.                                           |
| **Lens**        | A reading mode that overlays the handbook with study annotations / citations.                                                                        |
| **Calibration** | Confidence calibration. How well the learner's "I know this" matches their actual hit rate.                                                          |
| **First-run**   | A user with no goal, no plan, no decks, no history.                                                                                                  |
| **E2E**         | End-to-end test. A Playwright test that drives a real browser through real pages.                                                                    |
| **testid**      | `data-testid="..."`. A stable hook for tests, separate from CSS classes and visible text.                                                            |
| **Page anchor** | The single `data-testid="page-anchor"` element on each page. The flow test uses it as proof the page rendered.                                       |
| **Explainer**   | The collapsible "Why am I here?" block at the top of a page. Opens by default; user can dismiss per-page or globally.                                |
| **Glossary drawer** | A right-cluster `?` button that opens the glossary as an overlay. Same content source as the `/reference/glossary` page.                         |

## Information architecture

### Five sections

```text
HOME       /study           -- daily CTA + at-a-glance status
LEARN      /study/...       -- the four study modes:
                                Cards (memory), Reps (scenarios), Read (handbook/library), Sim
PROGRAM    /program         -- Quals + Goal + Plan rolled into one surface
                                with sub-tabs (Quals, Goal, Plan, Coverage)
INSIGHTS   /insights        -- stats + calibration + lens + weak areas
                                (renamed from /dashboard, fold in /calibration, /lens)
REFERENCE  /reference       -- knowledge graph + glossary + library
                                (and link to flightbag for raw FAA refs)
```

### Section taglines

Every section's index page opens with a one-line "why this section exists":

| Section   | Tagline                                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------------------------- |
| Home      | "What should I do right now? Today's session and any pressure points."                                                 |
| Learn     | "The four study modes -- cards, reps, reading, sim. Pick a mode or let your plan pick for you."                        |
| Program   | "What you're chasing (Quals), why (Goal), and how sessions are shaped (Plan)."                                         |
| Insights  | "How you're doing -- stats, calibration, weak areas, lens views."                                                      |
| Reference | "Look things up -- the knowledge graph, the glossary, the FAA library."                                                |

### Migration table

| Today (top-level)         | Becomes                                                                  | Old route             | New route                 |
| ------------------------- | ------------------------------------------------------------------------ | --------------------- | ------------------------- |
| Study                     | **Home** (= `/study`, daily CTA)                                         | `/study`              | `/study` (kept)           |
| Stats (Dashboard)         | Insights index                                                            | `/dashboard`          | `/insights`               |
| Plans                     | folded into Program (sub-tab)                                             | `/plans`              | `/program?tab=plan`       |
| Plan detail               | folded into Program -> Plan tab                                           | `/plans/[id]`         | `/program/plans/[id]`     |
| Quals (Credentials)       | folded into Program (sub-tab)                                             | `/credentials`        | `/program?tab=quals`      |
| Cred detail               | nested under Program -> Quals                                             | `/credentials/[slug]` | `/program/quals/[slug]`   |
| Lens                      | folded into Insights                                                      | `/lens/...`           | `/insights/lens/...`      |
| Goals                     | folded into Program (sub-tab)                                             | `/goals`              | `/program?tab=goal`       |
| Goal detail               | nested under Program -> Goal                                              | `/goals/[id]`         | `/program/goals/[id]`     |
| Memory (dropdown)         | Learn -> Cards. Children stay as sub-routes, not nav items.               | `/memory/*`           | `/memory/*` (kept)        |
| Reps                      | Learn -> Reps                                                             | `/reps/*`             | `/reps/*` (kept)          |
| Flight                    | Learn -> Flight (placeholder)                                             | `/flight`             | `/flight` (kept)          |
| Knowledge                 | Reference -> Knowledge graph                                              | `/knowledge`          | `/reference/knowledge`    |
| Glossary                  | Reference -> Glossary + drawer in right cluster                           | `/glossary`           | `/reference/glossary`     |
| Calibration               | Insights -> Calibration                                                   | `/calibration`        | `/insights/calibration`   |
| Help (local dropdown)     | **Removed.** Global Help in right cluster is the only Help.               | `/help/*`             | `/help/*` (kept; just no nav surface) |

Every "old route" gets a 301 redirect to its new home. See [design.md](./design.md) "Routes table" for the canonical list.

## Behavior, per phase

### Phase 1 -- Home + first-run + explain-everything plumbing

- `/study` rebuilt as the daily-CTA home. Three states: no goal, goal + no plan, goal + plan.
- `libs/help/` gains a typed entry map for tooltip definitions and a markdown corpus for long-form glossary entries. Single source of truth for the four explanation surfaces.
- New tooltip primitive in `libs/ui/`. Hover/focus parity, touch fallback to tap-to-show, dismissable.
- New glossary drawer in the right cluster (`?` button). Opens as overlay, reads the same content source.
- Page explainer component. Collapsible, dismissable per-page, with global "hide all explainers" setting.
- `data-testid="page-anchor"` convention applied to Home (and authoring convention written into [docs/agents/best-practices.md](../../agents/best-practices.md)).
- `ia-first-run.spec.ts` and a stubbed `ia-flow.spec.ts` (Home only) ship with this phase.

### Phase 2 -- Program consolidation

- New `/program` surface with sub-tabs: Quals, Goal, Plan, Coverage.
- Each tab renders the existing surface inline; per-tab explainer block.
- Sub-routes (`/program/quals/[slug]`, `/program/goals/[id]`, `/program/plans/[id]`) for detail pages.
- Goal detail page's primary CTA: "Build my plan" (when no plan) -> "Start studying" (when plan exists).
- Page anchors + tab testids on every Program surface. Flow test expanded.

### Phase 3 -- Insights + Reference rename, redirects

- `/dashboard` -> `/insights`. Calibration and Lens fold under `/insights/...`.
- `/knowledge` and `/glossary` move under `/reference/...`.
- Glossary drawer ships its full content (Phase 1 stub becomes the real corpus).
- 301 redirect rule for every old path. Implemented in SvelteKit hooks.
- `ia-redirect.spec.ts`: every old path 301s to its new home.

### Phase 4 -- Drop dropdowns, finalize section nav

- Remove Memory dropdown. Memory children become sub-pages under Learn -> Cards' index page (tab strip), not nav items.
- Remove local Help dropdown. Global Help in right cluster is the only Help.
- Section nav is the final five entries. Lock the testid contract.
- Flow test asserts no route ships without `page-anchor`. CI fails the build otherwise.

## "Explain everything" surfaces

Four surfaces, one content source. All four read from `libs/help/`.

| Surface              | Trigger                                       | Content shape                                              | Dismissal                                                   |
| -------------------- | --------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| **Hover tooltip**    | Mouse hover / keyboard focus on a term        | One-line plain-English definition                          | Auto -- closes on blur. No persistent state.                 |
| **Page explainer**   | Top of a page that introduces a concept       | 2-3 sentences: what is this page, who is it for, what to do | Collapsible per-page. Global "hide all" setting.            |
| **Glossary drawer**  | `?` button in right cluster                   | Searchable list of all terms; click for long-form entry    | Auto -- closes on overlay click or Esc.                      |
| **Number `?` popover** | `?` icon next to a number on a dashboard tile | Formula + explanation + link to glossary entry             | Auto -- closes on outside click.                             |

## Validation

- **Tooltip**: definition is required (non-empty string). Term is unique per language.
- **Page explainer**: 2-3 sentences (50-300 chars). Lint warns if longer.
- **Glossary entry**: term, short (one line), long (markdown), related terms (term keys).
- **Dismissal state**: per-page dismissals stored in user prefs (or local storage if no user prefs schema). Global "hide all" stored in user prefs.
- **Search**: glossary drawer search matches term key + short + long (case-insensitive substring).

## Edge cases

| Case                                                    | Behavior                                                                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| User has no goal                                        | Home shows "Set your first goal" CTA. Learn + Insights nav links soft-disabled with tooltip "Set a goal to unlock." Reference + Program always available. |
| User has goal but no plan                               | Home shows "Build a plan for {goal title}" CTA. Goal-detail page's primary CTA mirrors this.                    |
| User has paused goal (no active goal)                   | Home shows "Resume {goal} or set a new primary goal." Two CTAs.                                                |
| User has multiple active goals (one primary, others side-quests) | Program > Goal tab lists all; primary marked. Home daily CTA only references the primary goal.       |
| User dismissed all page explainers globally             | Each page still shows a small `?` button to re-open the explainer. Global setting flips back via Settings.     |
| Number explainer can't compute (data not loaded yet)    | Tooltip shows "Loading..." and the `?` popover shows the term definition only, no formula.                     |
| 500 error on a child page                               | Section index still renders; the child page shows the dev-loud error per `/memory/review` 500 fix in walkthrough. |
| Old bookmark hits a renamed route                       | 301 redirects to the new path. URL bar updates.                                                                |
| User has no primary goal but visits `/program`          | Program is always reachable. Goal tab shows "Set a goal to begin." CTA -> goal-create wizard.                  |
| First-run user clicks Reference -> Glossary             | Page renders normally. No goal required.                                                                       |

## Out of scope

- New BC functions or schema changes.
- Goal/Plan merge (Q1 lands on "keep both, single Program surface" -- Option C).
- Multi-goal authoring (just respect the existing primary invariant).
- Mobile-specific layouts.
- Stats / chart redesign. Insights renames the destination; chart code is unchanged.
- Knowledge graph authoring UI -- moves under Reference but internals unchanged.
- Course / firc / hangar surfaces. Cross-app right-cluster links unchanged.
- Pricing / settings page redesign. Settings gains one new toggle ("Hide page explainers") and that's it.

## Decisions to confirm

The plan's working recommendations. Joshua flips any of these before `/ball-wp-build`. Full pros/cons live in the source plan.

| #   | Question                                                              | Working answer                                                                          | One-liner                                                                                                              |
| --- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Q1  | Goal vs Plan -- merge or keep separate?                                | **C: keep both BCs, one Program surface with sectioned panels**                          | Honors the model; learner sees one mental destination.                                                                 |
| Q2  | Five sections (Home / Learn / Program / Insights / Reference)?         | **A: five sections as proposed**                                                         | Fits in working memory; maps to the three audience modes.                                                              |
| Q3  | Hard rename, keep aliases, or rename + redirect?                       | **C: hard rename + 301 redirects**                                                       | Clean URL space; old links keep working.                                                                               |
| Q4  | First-run gating -- hard, soft, or none?                               | **B: soft gate, only on Learn + Insights**                                               | Reference + Program stay reachable; nav structure visible.                                                             |
| Q5  | Home framing -- "Today" or "Now/Soon/Someday"?                         | **A for v1, C as fast follow**                                                           | Ship the simplest thing; add the horizon rail once we know what to put on it.                                          |
| Q6  | Dropdown rule -- where do they live?                                   | **B: no dropdowns, section index pages carry sub-nav**                                   | Five top sections leave plenty of room. Mobile-friendly.                                                               |
| Q7  | Section names -- Program/Insights/Reference vs Training/Progress/Reference vs other? | **C: Training / Progress / Reference (subject to VOCABULARY review)**     | "Training" is the pilot word; "Progress" is plain; "Reference" is unambiguous. Falls back to Option A if "Training" collides with apps/firc. |
| Q8  | Glossary placement -- right cluster, under Reference, or both?         | **C: drawer in right cluster + page under Reference**                                    | Daily access via drawer; canonical home is the page.                                                                   |
| Q9  | Page explainer expiry -- forever, N visits, or settings + per-page?    | **C: on by default, settings to hide globally, per-page `?` to re-open**                  | One toggle, one re-open affordance. No magic numbers.                                                                  |
| Q10 | Number explainers -- tooltip, popover, or deep page?                   | **B: hover tooltip + `?` popover (with deep link to glossary for complex metrics)**       | Progressive disclosure; one pattern across the app.                                                                    |
| Q11 | Explainer content -- inline, `libs/help/`, or markdown corpus?         | **B: centralize in `libs/help/`, typed map for tooltips + markdown corpus for long-form** | Single source of truth; existing `libs/help/` already handles markdown.                                                |

If any decision flips, the impact is captured in [design.md](./design.md) "Key decisions table" -- updating that table is the first step of the build.

## Acceptance

- All five top-level sections render with the section tagline + `data-testid="page-anchor"` on the page header.
- All explanation surfaces (tooltip, page explainer, glossary drawer, number `?` popover) read from `libs/help/`.
- Every old path 301 redirects to its new home (verified by `ia-redirect.spec.ts`).
- `ia-flow.spec.ts` walks every top-level route + every Program tab and fails on any console / page error.
- `ia-first-run.spec.ts` proves a brand-new user sees only the "Set your first goal" CTA on Home.
- `ia-goal-to-session.spec.ts` proves the load-bearing transition (Goal detail -> Start studying -> session entry) works.
- `bun run check` clean. Manual test plan in [test-plan.md](./test-plan.md) walked end-to-end by Joshua.
- VOCABULARY.md gains entries for Quals, Plan, CTA, IA, BC. DESIGN_PRINCIPLES.md gains "Explain everything" as a stated principle. [docs/agents/best-practices.md](../../agents/best-practices.md) gains an "E2E selectors" section per [design.md](./design.md).
