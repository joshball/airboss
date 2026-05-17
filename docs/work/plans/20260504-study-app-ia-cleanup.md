# Study app IA cleanup -- proposal (v2)

**Date:** 2026-05-04
**Trigger:** Joshua walked through creating his first PPL goal as a brand-new user. The walkthrough surfaced a tangle of overlapping top-level concepts (Study, Plans, Goals, Dashboard, Stats, Quals, Memory, Reps, Lens, Knowledge, Glossary, Calibration, Flight, Library) with inconsistent navigation and no obvious "now what?" Joshua also asked: every term in the product needs an explanation surface; every number needs a why; we should not assume the learner knows what we mean.
**Source notes:** [docs/work/todos/20260504-03-goal-detail-walkthrough-TODO.md](../todos/20260504-03-goal-detail-walkthrough-TODO.md)

This is a proposal. Nothing has been changed yet. v2 adds: a glossary, an "explain everything" principle, BC-level depth on Goal vs Plan, and pros/cons/recommendation on every open question.

## Glossary of terms used in this document

These are the abbreviations and product terms used below. They also need to live in the in-app glossary surface (and surface as hover tooltips on the page elements that use them -- see "Explain everything" below).

| Term               | Stands for / means                                                                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CTA**            | Call-To-Action -- a button or link that's the obvious next thing to click on a page. The "primary CTA" is the one big button; "secondary CTAs" are smaller follow-ups. |
| **IA**             | Information Architecture -- how the product is organized into pages and sections. The map. What's a top-level tab vs what's nested under one.                          |
| **BC**             | Bounded Context (DDD) -- a backend module that owns one model and its rules. `bc/study` owns goals, plans, sessions, etc. as separate sub-aggregates.                  |
| **Qual**           | A user-facing word for "credential" -- PPL, IR, CPL, CFI. The label the learner sees. The DB table is still `credential`; the UI says **Quals**.                       |
| **Goal**           | The slice of study the learner is focused on, e.g. "Pass PPL written by July." A learner-defined bundle of one or more syllabi plus ad-hoc nodes.                      |
| **Plan**           | The schedule + session shape attached to a goal -- session length, default mode, focus/skip domains. Drives `/session/start`.                                          |
| **Syllabus**       | An ACS or PTS document -- a structured list of areas/tasks/elements published by the FAA, per certificate.                                                             |
| **Knowledge node** | One atomic teachable concept in the airboss knowledge graph (ADR 011). Linked to syllabus tasks, FAA references, and review cards.                                     |
| **Cards**          | Memory review (spaced repetition) -- short-form recall.                                                                                                                |
| **Reps**           | Scenario reps -- decision-making mini-scenarios.                                                                                                                       |
| **Session**        | One contiguous study sitting. The session engine picks the slices (cards, reps, reading) based on the active plan.                                                     |
| **Domain**         | One of the FAA knowledge areas (e.g. Weather, Aerodynamics, Navigation). Used to focus or skip whole categories.                                                       |
| **Lens**           | A reading mode that overlays the handbook with study annotations/citations.                                                                                            |
| **Calibration**    | Confidence calibration -- how well the learner's "I know this" matches their actual hit rate.                                                                          |
| **First-run**      | A user with no goal, no plan, no decks, no history. The very first visit.                                                                                              |
| **E2E**            | End-to-end test -- a Playwright test that drives a real browser through real pages.                                                                                    |
| **testid**         | `data-testid="..."` -- a stable hook for tests, separate from CSS classes and visible text. Doesn't break when copy or styling changes.                                |
| **Page anchor**    | The single `data-testid="page-anchor"` element on each page. The flow test uses it as proof that the page rendered.                                                    |

## "Explain everything" -- a product principle

Joshua's note: *"Everything requires explanation here. All numbers. All terms. All views. Why am I seeing this? Why is this different than this?"*

Capture this as a principle, not just a fix list. Three layers:

### 1. Hover tooltip -- one-line definition

Every term that appears in the nav, every metric on a dashboard tile, every section header -- has a hover tooltip that gives a one-line plain-English definition.

Examples:

- Hover **Quals** -> "Qualifications -- the certificates you're working toward (PPL, IR, CPL, CFI)."
- Hover **Goal** -> "What slice of study you're focused on right now."
- Hover **Plan** -> "The schedule and session shape for your goal -- how long, how often, what to focus on."
- Hover the number **`12 due`** -> "12 review cards are scheduled to come back today, based on spaced repetition."
- Hover the number **`6 ready`** -> "6 scenario reps you haven't attempted yet."

### 2. Page-level explainer -- "Why am I here?"

Every page that introduces a new concept opens with a small "Why am I here?" block: 2-3 sentences explaining what this page is, who it's for, and what to do. Collapsible, dismissable, but on by default until the user has visited the page N times.

Examples:

- `/quals/ppl` -> "This is where Private Pilot lives. Below you'll see the syllabus (ACS), your coverage by area, and links to the goals you've attached to PPL. To start studying for PPL, set a primary goal."
- `/program` -> "Your program is what you're working on -- one Qual you're chasing, one Goal that scopes it, one Plan that schedules it."

### 3. In-app glossary -- searchable, deep

The glossary surface gets every term used in the product, including platform terms (CTA, IA, BC) when they appear in tooltips or admin views. Each entry has: term, one-line definition, longer explanation, links to where the term is used, related terms.

This is `/reference/glossary` in the proposed IA. Add **CTA** and **IA** to the seed list -- they show up in admin/settings copy.

### Implementation note

The in-app glossary already exists at `/glossary`. The hover-tooltip and page-explainer surfaces are new. Both can be powered by one shared content source (a `glossary.md` index in `course/` or `libs/help/`) so we don't have term definitions drifting between hover tips, page explainers, and the glossary page.

## Naming -- now with Quals

Joshua: *"Remember Credentials are now Quals."* Confirmed in code -- [libs/constants/src/routes.ts:647](../../../libs/constants/src/routes.ts#L647) maps `CREDENTIALS: 'Quals'` and [libs/constants/src/help-tags.ts:49](../../../libs/constants/src/help-tags.ts#L49) does the same. The DB table stays `credential` (BC term); the UI label is **Quals**. Treat the BC name as the implementation detail and the user word as the canonical product term.

While we're here -- "toward" vs "towards"? Both are correct English. American English prefers "toward"; British prefers "towards." Airboss is American. **Use "toward."** Update all UI copy.

## The audience

The user on `/study` (or wherever the home becomes) is **a working CFI / student pilot rebuilding or maintaining knowledge.** Joshua is user zero. The audience falls into one of three modes on every visit:

1. **First-run.** Just signed up. Has no goal, no plan, no decks, no history. Needs to be told what to do, in one obvious next step.
2. **Today.** Has an active goal/plan. Returning for a daily session. Wants the shortest path to "do today's work" -- review due cards, do scheduled reps, read assigned material.
3. **Wandering.** Has time, wants to explore. Browse the handbook, drill a weak area, look up a regulation, glance at progress.

**Optimize for "Today."** First-run is once. Wandering is rare. Today is every visit. The home page should answer "what should I do right now?" in one glance and one click.

## What the BC actually says about Goal vs Plan

Earlier I waved at "Goal vs Plan." The BC has more to say. Reading [libs/bc/study/src/goals.ts](../../../libs/bc/study/src/goals.ts) and [libs/bc/study/src/plans.ts](../../../libs/bc/study/src/plans.ts):

### Goal (BC)

- **Aggregate root:** `goal` table, owned by user.
- **Composes:** `goal_syllabus` (many syllabi with weights), `goal_node` (ad-hoc knowledge nodes with weights).
- **Invariant:** at most one `is_primary=true` goal per user, enforced by partial UNIQUE index. `setPrimaryGoal` does a transactional swap.
- **Status:** `active | paused | completed | archived`.
- **Purpose:** answers *"what intent do I have?"* Bundles cert intent (which Quals you're chasing, via syllabi) and personal intent (weak areas, exam prep gaps, via ad-hoc nodes).
- **A learner can have many goals.** Only one is primary. Non-primary goals can be active (a side-quest) or paused.

### Plan (BC)

- **Aggregate root:** `study_plan` table, owned by user.
- **Composes:** focus_domains, skip_domains, skip_nodes, depth_preference, session_length, default_mode.
- **Invariant:** at most one `status='active'` plan per user, enforced by partial UNIQUE index. Creating a new active plan archives any previous active plan in the same transaction.
- **Status:** `active | archived`.
- **Purpose:** answers *"what shape should sessions take?"* It's the session-engine config: how long, how deep, which domains to favor or avoid, what mode (cards / reps / mixed).
- **Cert intent has been removed from plan.** `study_plan.cert_goals` is deprecated; `PlanCertGoalsDeprecatedError` throws if a writer supplies it. Cert intent now lives on the goal. The engine reads cert intent from the user's *primary goal* via `getDerivedCertGoals`. See engine-goal-cutover WP and ADR 016 phase 6.

### So the BC story is

```text
QUAL (= credential)
  "What FAA cert is this about?"
  ↓ owns syllabi (ACS/PTS)

GOAL
  "What's the intent? Which Quals + which weak nodes?"
  one is primary
  ↓ implies cert intent for the engine

PLAN
  "How are sessions shaped? Length, mode, focus/skip domains."
  one is active
  ↓ drives session/start
```

A goal does **not** automatically produce a plan. The user creates a goal, then either creates a plan or accepts a default. That's the gap Joshua hit: he created a goal, but no plan, so the dashboard's plan-aware CTA panel said "Create a study plan" -- and that flow doesn't reference the goal he just made.

### Why are Goal and Plan separate at the BC level?

Three reasons stand out from the code:

1. **They change at different rates.** A goal is a stable intent ("PPL by July"). A plan is a config you tweak ("today I want shorter sessions; focus weather"). Mixing them would mean every config tweak rewrites your intent.
2. **One-active vs one-primary.** Both have their own uniqueness invariant, enforced separately at the DB level. The aggregates are protecting different things.
3. **Engine input.** The session engine reads two things: cert intent (from the primary goal) and session shape (from the active plan). Keeping them separate means the engine signature stays clean.

The user-facing surface does not have to mirror the BC structure. We can keep the BCs separate and still present "Goal" and "Plan" as one composite surface in the UI.

## What's actually wrong (from the walkthrough)

### The five overlapping top-level concepts

| Surface                | What it is (today)                                                 | First-time user reaction               |
| ---------------------- | ------------------------------------------------------------------ | -------------------------------------- |
| `/study`               | Five-tile entry row (Read / Cards / Sim / Scenarios / Flight).     | "Now what?"                            |
| `/dashboard` (Stats)   | Stats panels + the CTA panel ("Create a plan" or "Start session"). | "Why am I here, not on /study?"        |
| `/plans`               | Study plans -- BC entity that drives session selection.            | "I made a goal. Why is plan separate?" |
| `/goals`               | Goals -- BC entity that bundles syllabi + nodes.                   | "Why does goal exist if plan exists?"  |
| `/credentials` (Quals) | Quals (PPL/IR/CPL/...) that own syllabi.                           | "Is this the same as goal?"            |

These are not five different things to a returning CFI. They are one thing: **"my study program."**

### The dropdowns that aren't dropdowns

[apps/study/src/routes/(app)/+layout.svelte:224-285](../../../apps/study/src/routes/(app)/+layout.svelte#L224-L285):

- Top-level: Study, Stats, Plans, Quals, Lens, Goals, Reps, Flight, Knowledge, Glossary, Calibration
- Dropdowns: Memory (Home / Browse / Review / New), Help (Index / Concepts / ...)

Memory has 4 children and lives in a dropdown. Knowledge has at least as many sub-surfaces and doesn't. There's no rule.

### The numbers don't agree

`/study`'s Cards tile shows `6 due`. `/dashboard`'s CTA panel shows `Review (12)`. Same user, same moment, two different numbers. (And neither says *why* it's the count it is -- the "explain every number" principle applies.)

### Two Helps, missing explainers

Global Help in [AppHeader.svelte:297](../../../libs/ui/src/components/AppHeader.svelte#L297). Local Help dropdown in study layout at [(app)/+layout.svelte:269](../../../apps/study/src/routes/(app)/+layout.svelte#L269). Drop the local.

Also: nothing in the product explains what Quals/Goal/Plan/Cards/Reps mean. The names are the only documentation.

### Errors hide

`/memory/review` 500s with nothing in bun's stderr. Dev surface for errors needs to be loud and detailed on `localhost` / `*.test`. (Captured separately in the walkthrough todo.)

## Proposed IA -- Today-first

### One home, one CTA

`/study` becomes the home. **First panel is the daily CTA.** Plan-aware:

- **No goal:** "Set your first goal" -> goal-create wizard. Single button. Everything else hidden or muted.
- **Goal but no plan:** "Build a plan for {goal title}" -> plan-create, contextually scoped.
- **Goal + plan:** **"Start today's session"** -> the plan-driven session entry. Below it, secondary CTAs for any pressure (review backlog, due reps, unread reading).

Each state explains itself. The CTA never appears alone -- there's a one-line "why this is the next step" under it.

### Five sections, not twelve

```text
HOME       /study           -- daily CTA + at-a-glance status
LEARN      /study/...       -- the four study modes:
                                 Cards (memory)
                                 Reps (scenarios)
                                 Read (handbook / library, scoped to goal)
                                 Sim (cross-app)
PROGRAM    /program         -- Quals + Goal + Plan rolled into one surface
                                 with sub-tabs (Quals, Goal, Plan, Coverage)
INSIGHTS   /insights        -- stats + calibration + lens + weak areas
                                 (renamed from /dashboard, fold in /calibration, /lens)
REFERENCE  /reference       -- knowledge graph + glossary + library
                                 (and link to flightbag for raw FAA refs)
```

Help stays in the right cluster (global header). Glossary placement -- see open question 6.

### What goes where

| Today (top-level)   | Becomes                                                     |
| ------------------- | ----------------------------------------------------------- |
| Study               | **Home** (= `/study`, daily CTA)                            |
| Stats (Dashboard)   | Insights                                                    |
| Plans               | folded into Program (sub-tab)                               |
| Quals (Credentials) | folded into Program (sub-tab)                               |
| Lens                | folded into Insights                                        |
| Goals               | folded into Program (sub-tab)                               |
| Memory              | Learn -> Cards (children stay as sub-routes, not nav items) |
| Reps                | Learn -> Reps                                               |
| Flight              | Learn -> (placeholder until WP 2)                           |
| Knowledge           | Reference -> Knowledge graph                                |
| Glossary            | Reference -> Glossary (or right cluster -- see Q6)          |
| Calibration         | Insights -> Calibration                                     |

### First-run lands here

```text
[ HOME ]                                   active
"Welcome. Set your first goal."
[ Set your goal ]   <-- single big button

> Why a goal? A goal is the slice of study you're focused on
  -- e.g. "Pass PPL written by July." We'll attach syllabi and a
  schedule to it next.
```

Everything else is disabled or hidden. The micro-explainer under the button is the "explain everything" principle in action.

### "I have a goal -- now what?" gets answered

At the bottom of the goal-detail page (or inside the new Program surface), a single primary CTA: **"Build my plan"** if no plan, otherwise **"Start studying."** Returns the user to Home with the new plan active.

## Open questions -- expanded

For each: **context** (what the BC says, what the code does), **pros** of the proposal, **cons**, **recommendation**.

### Q1. Goal vs Plan -- merge or keep separate?

**Context.** Two BCs, two aggregates, two uniqueness invariants. Goal carries cert intent + ad-hoc nodes; plan carries session shape (focus/skip/length/mode). Cert intent was *removed* from plan in the engine-goal-cutover work. They genuinely model different things. Goal can be paused/completed/archived; plan is just active or archived. A user can have multiple goals (paused side-quests); only one active plan at a time.

**Option A. Keep both. Surface as "Program" with sub-tabs.**

- Pros:
  - BC stays clean. Engine signature stays clean.
  - Power users get both knobs.
  - Multi-goal future (PPL + IR side-quest) stays viable.
  - The "intent vs schedule" split is a real distinction good for thinking.
- Cons:
  - Two concepts to teach the first-run user. ~~Even with explanations, more friction.~~

**Option B. Merge in the UI. One "Goal" page that shows everything.**

- Pros:
  - One concept for the user.
  - First-run is faster.
- Cons:
  - When you tweak session length, you're "editing your goal." That feels wrong -- the goal didn't change, only the schedule did.
  - Multi-goal future awkward: each goal would need its own embedded plan, but the BC enforces one active plan globally. Either unify or surface the global plan inside the primary goal -- back to A.
  - The "edit my goal" page becomes huge and conflates intent vs config.

**Option C. Keep both BCs. UI shows one "Program" page with **collapsible** sections for Goal and Plan, plus a Quals tab.**

- Pros:
  - User sees one surface, "my program."
  - Each section can be explained inline ("Goal = what you're chasing. Plan = how you're chasing it.").
  - BCs stay clean.
  - Plan tweaks don't visually mutate the goal; they live in a separate panel on the same page.
- Cons:
  - Slightly more chrome than Option B.
  - We have to design a Program page that doesn't become a kitchen sink.

**Recommendation: Option C.** Keep the BCs. Present them on one Program page with sectioned, explained panels. This honors the model and gives the user one mental destination ("my program is here").

### Q2. Five sections (Home / Learn / Program / Insights / Reference) -- right grouping?

**Context.** Today there are 12 top-level entries. The brain handles 5-7 at a glance; 12 is past that.

**Option A. Five sections, as proposed.**

- Pros:
  - Fits in working memory.
  - Each section has a clear role and a clear "why this section exists" tagline.
  - Maps cleanly to the three audience modes (Today -> Home; Wandering -> Reference; First-run -> Home + Program).
- Cons:
  - "Insights" can feel like a dumping ground (stats + calibration + lens + weak areas is heterogeneous).
  - "Program" lumps three things that took us a section to explain.

**Option B. Three sections (Home / Program / Reference). Stats and learn surfaces are revealed contextually from Home.**

- Pros:
  - Even tighter.
  - The home page becomes the dispatch point.
- Cons:
  - Hides Cards/Reps/Sim under Home, making them harder to discover when wandering.
  - Over-rotates on Today; punishes Wandering.

**Option C. Six sections -- split Insights into Stats and Calibration.**

- Pros:
  - Calibration is conceptually distinct from "stats."
- Cons:
  - One more tab. Every additional tab raises the overhead the user pays daily.

**Recommendation: Option A (five sections),** with explicit "why this section" text under each section header so Insights doesn't feel like a junk drawer. Revisit if Insights grows past 4 children.

### Q3. What happens to existing routes during transition? Hard rename, or keep aliases?

**Context.** The routes are linked from emails, bookmarks, internal docs, ADRs, and from cross-app surfaces (e.g. flightbag links to library). A breaking rename invalidates all of them.

**Option A. Hard rename. `/dashboard` -> `/insights`, etc.**

- Pros:
  - Clean URL space.
  - No tech debt to maintain.
- Cons:
  - Every existing link breaks.
  - Any docs or ADRs that reference old paths must be hunted down.

**Option B. Keep new + old, both routes return same content.**

- Pros:
  - No broken links.
- Cons:
  - Duplicate routes muddy `ROUTES` constant. Two URLs for one page is its own confusion.

**Option C. Hard rename + 301 redirects from old paths.**

- Pros:
  - Clean URL space (only the new ones are canonical).
  - Old links keep working transparently.
  - SEO/share-link friendly.
- Cons:
  - Have to remember to drop the redirects later (or keep them indefinitely).

**Recommendation: Option C.** SvelteKit supports 301s cleanly via a hooks redirect. Rename hard, add redirects, mark them for removal in 6 months.

### Q4. First-run gating -- hard or soft?

**Context.** Today there's no gating; a brand-new user sees every surface and lands on five blank tiles. Joshua's reaction was "now what?" The IA proposal says first-run should see almost nothing except "Set your first goal."

**Option A. Hard gate -- hide the entire section nav until a goal exists.**

- Pros:
  - Zero confusion. One thing to do.
- Cons:
  - User can't browse the glossary, library, or knowledge graph before committing to a goal. Some users want to look around first.
  - Feels like a wizard prison.

**Option B. Soft gate -- nav visible but disabled with hover tooltips ("Set a goal to unlock").**

- Pros:
  - Visible structure (the user sees where they're going).
  - Reference surfaces (glossary, library, knowledge) stay browsable -- those don't need a goal.
- Cons:
  - More work to implement (per-link enabled state).
  - Disabled-but-visible nav can be frustrating.

**Option C. No gating. Home shows "Set your goal" as the only CTA, but everything else is reachable.**

- Pros:
  - Cheapest to build.
  - User can wander.
- Cons:
  - Wandering brand-new users see empty Cards/Reps/Insights pages with their own "no data" empty states. Multiplies the "now what?" problem.

**Recommendation: Option B (soft gate),** but only gate the *Learn* and *Insights* sections. *Reference* (glossary, knowledge, library) is always available -- those are read-only and useful pre-goal. *Program* is always available because it's where you set the goal.

### Q5. Is "Today" the right framing for Home? Or "Now / Soon / Someday"?

**Context.** A daily-return CFI mostly wants "what should I do right now?" -- one CTA. But there's also a longer cadence: review due today, finish this week's reading, prep for next month's checkride.

**Option A. Pure "Today" -- one CTA, secondary pressures ("12 due / 4 reps ready"), nothing else.**

- Pros:
  - Fastest path to action.
  - Cognitively easy.
- Cons:
  - Hides medium-horizon work. User has to navigate elsewhere to see "what's coming up."

**Option B. Three columns -- Now (today's session) / Soon (this week's reading, upcoming reps) / Someday (long-term cert progress).**

- Pros:
  - Mirrors how pilots actually plan (immediate vs upcoming vs eventual).
  - Adds pressure visibility without burying it.
- Cons:
  - More complex page. Higher build cost.
  - Tension between "fastest path to action" and "more to look at."

**Option C. Today + a discreet "What's next" rail at the bottom (collapsed by default).**

- Pros:
  - Default view is Today; rail is opt-in for users who want the longer horizon.
  - Keeps the page calm.
- Cons:
  - Easy to leave the rail empty / unmaintained ("phantom feature").

**Recommendation: Option A for v1, Option C as a fast follow.** Ship the simplest thing that resolves the "now what?" complaint. Add the horizon rail once we've watched real usage and know what to put on it.

### Q6. The dropdown rule -- pick one

**Context.** Today Memory and Help are dropdowns; nothing else is, even when it has children.

**Option A. Every section is a dropdown listing its sub-pages.**

- Pros:
  - Discoverable -- user sees the sub-pages without clicking through.
- Cons:
  - Heavier nav. Every hover opens a tray.
  - On mobile, dropdowns either need a click-to-open pattern or vanish.

**Option B. No dropdowns. Section header click goes to the section's index page; sub-nav lives on that page (tab strip or sidebar).**

- Pros:
  - Cleaner top nav.
  - Section index page can carry "explain this section" content.
  - Mobile-friendly.
- Cons:
  - One extra click to reach a sub-page.

**Option C. Dropdowns only for sections with 5+ children; tab strip otherwise.**

- Pros:
  - Pragmatic.
- Cons:
  - Inconsistent rule. Threshold is arbitrary. Adding a sub-page can flip a section into a dropdown.

**Recommendation: Option B.** With five top-level sections, each section's index page has plenty of room for sub-nav (and the "Why am I here?" explainer block). Skip the dropdowns. Memory and Help dropdowns get unbuilt.

### Q7. Naming the new sections -- "Program" / "Insights" / "Reference"?

**Context.** Joshua's [VOCABULARY.md](../../platform/VOCABULARY.md) is the authority. The terms above are placeholders.

**Option A. Program / Insights / Reference (proposed).**

- Pros:
  - Standard product nouns. Pilots will understand.
- Cons:
  - "Program" overlaps with "training program" (FAA term). Could confuse.
  - "Insights" is generic SaaS-speak.

**Option B. My Plan / Progress / Library.**

- Pros:
  - Plainer English.
  - "My Plan" hints at ownership.
- Cons:
  - "Plan" clashes with the BC term `plan` (the schedule). Same word, two meanings.
  - "Library" already means flightbag. Cross-app collision.

**Option C. Training / Progress / Reference.**

- Pros:
  - "Training" is the pilot word (you train for a checkride).
  - "Progress" replaces the SaaS "Insights."
- Cons:
  - "Training" can conflate with apps/firc (FIRC is a training course).

**Option D. Quest / Trail / Reference.** (Vibe naming.)

- Pros:
  - Distinctive, sticky.
- Cons:
  - Clever-not-clear. Risks confusion.

**Recommendation: Option C (Training / Progress / Reference)** subject to VOCABULARY.md review. "Training" is the pilot word; "Progress" is plain; "Reference" is unambiguous. Add definitions to the glossary and tooltip. If "Training" collides with apps/firc, fall back to Option A.

### Q8. Glossary placement -- right cluster (next to Flightbag), or under Reference?

**Context.** Joshua's instinct was "near Flightbag." Flightbag is a cross-app reference link in the right cluster of [AppHeader.svelte:304-306](../../../libs/ui/src/components/AppHeader.svelte#L304-L306).

**Option A. Right cluster, next to Flightbag.**

- Pros:
  - Always one click away from any page.
  - Reflects how often the user hits it during early learning.
- Cons:
  - Right cluster is for cross-app jumps. Glossary is in-app reference. Mixing them muddles the cluster's role.

**Option B. Under Reference (left/main nav).**

- Pros:
  - Conceptually consistent (in-app reference lives under Reference).
  - Cleaner cross-app cluster.
- Cons:
  - More clicks during early learning.

**Option C. Both -- a tiny "?" glossary link in the right cluster opens a glossary drawer overlay; full glossary lives under Reference.**

- Pros:
  - Fast access from any page (drawer) and a deep destination (page).
  - Drawer can be the same surface that powers hover tooltips.
- Cons:
  - Two glossary affordances. Pick one source of truth for content.

**Recommendation: Option C.** The drawer is the daily glossary; the page is the canonical home. Drives the "explain everything" principle without bloating the cluster.

### Q9. How do explainers expire? On by default, off forever, or returning?

**Context.** "Why am I here?" blocks help first-run users; they annoy returning users.

**Option A. On forever (always shown, can be dismissed per-page).**

- Pros:
  - First-run users helped indefinitely.
- Cons:
  - Returning users see noise. Dismissals don't propagate (per-page = N dismissals).

**Option B. On for first N visits, then auto-collapse.**

- Pros:
  - Self-fades.
- Cons:
  - "N" is a magic number. User who returns after a long break may need it again.

**Option C. On by default. User can collapse globally with a setting ("hide page explainers"). Always re-openable via a small "?" button on the page.**

- Pros:
  - Power user collapses once and is done.
  - First-run keeps the help.
  - Help is reachable when the user wants it.
- Cons:
  - Need a settings hook + per-page "?" button.

**Recommendation: Option C.** One setting, one re-open affordance. Treat it as part of the explain-everything surface, not bespoke.

### Q10. Where do "Why am I seeing this number?" explainers live?

**Context.** Numbers like `12 due` or `streak: 7 days` need a "what does this mean and how is it computed" surface.

**Option A. Hover tooltip only.**

- Pros: cheap.
- Cons: not discoverable on touch devices; not crawlable.

**Option B. Tooltip on hover + "?" mark click opens a small popover with formula and link to glossary.**

- Pros: progressive disclosure. Hover for one-liner, click for depth.
- Cons: every number needs the affordance designed.

**Option C. All numbers link to a `/insights/explain/{metric}` deep-link page.**

- Pros: rich explanations, comparisons, history.
- Cons: heavyweight; users want a one-liner most of the time.

**Recommendation: Option B,** with deep-link out to a glossary entry for the truly complex metrics (calibration, due-now formula). One pattern across the app.

### Q11. Explainer content -- where does it live in the codebase?

**Context.** Tooltips, page explainers, glossary entries, and "?" popovers all need content. We could scatter copy through Svelte components (fast, but ungovernable) or centralize.

**Option A. Inline in components (status quo for the few tooltips that exist).**

- Pros: easy.
- Cons: copy drift, no single source of truth, no glossary index.

**Option B. Centralize in `libs/help/` -- one entry per term with all surfaces (tooltip, page, glossary, "?" popover) reading from it.**

- Pros: single source of truth. Glossary page is just a render of the index.
- Cons: more setup.

**Option C. Markdown files under `course/glossary/` -- each term is a `term.md` with frontmatter for short/long forms.**

- Pros: course-team can author without touching code.
- Cons: needs a build/load story.

**Recommendation: Option B,** loading from a typed map for tooltips and a markdown corpus for long-form. Existing `libs/help/` already handles the markdown side.

## E2E coverage -- "no holes" sweep

You asked: *"add e2e tests to test the flow. Use data item tags rather than css. For now just that the pages exist and work. one fast flow that hits ten pages over ten focused tests."* Treating this as a real part of the plan.

### Pushback (small, then I'll do it your way)

A single fast flow that hits ten pages is **not** the standard "best practice" line, which prefers small isolated tests. Standard worry: when the flow fails on page 3, you don't get clean signal on pages 4-10; the failure cascades; the report says "checkout broke" when the actual fault was a header link.

**Why I think it's fine here, with caveats:**

- The goal of this suite is **existence + 200 + key element rendered**, not deep behavior. That's exactly what flow tests are good at -- "every page is reachable and not blank."
- Playwright reports the exact step that fails, so a flow test isn't a black box. You get the line number, screenshot, trace.
- Coverage gain per minute is high. Ten focused tests with auth/seed/load each cost more in fixture setup time than they save in isolation value.

**Caveats to keep me honest:**

- Keep the flow **narrow** -- just navigate, assert one anchor element per page, move on. No form fills, no state mutation. A flow that reads is fine. A flow that writes will turn into a bug magnet.
- Where a page has *load-bearing* state (`/memory/review` after a session start, the goal-create POST), keep a dedicated focused test alongside the flow. The flow proves the door opens; the focused test proves the room works.
- The flow gets one **error budget**: fail on the first 4xx/5xx, do not let later steps mask earlier failures.

Net: ship the flow as the wide-coverage net, keep ~3 focused tests (auth, goal-create, session start) as the safety harness for the load-bearing transitions. That's the shape below.

### Test strategy

- **Selector strategy:** **`data-testid`** (Playwright's `getByTestId`). Not CSS classes, not text-only, not aria roles for nav anchors. This survives copy churn (Quals/Goal/Plan rename, "Start studying" -> "Start today's session", etc.) and survives the IA reorg without rewriting tests every phase.
- **Naming convention:** `data-testid="{section}-{element}"`, all lowercase, kebab-cased. Examples:
  - `data-testid="nav-home"`, `data-testid="nav-program"`, `data-testid="nav-insights"`, `data-testid="nav-reference"`
  - `data-testid="home-cta-primary"`, `data-testid="home-cta-secondary"`
  - `data-testid="program-tab-quals"`, `data-testid="program-tab-goal"`, `data-testid="program-tab-plan"`, `data-testid="program-tab-coverage"`
  - `data-testid="page-anchor"` -- one per route, used by the flow as the "page rendered" sentinel.
- **Page anchor pattern.** Every top-level route gets a single `data-testid="page-anchor"` on its `<h1>` or its primary section header. The flow test asserts visibility of that anchor after each navigation. One convention; the flow stays a tight loop.
- **Auth.** Reuse the existing global setup ([tests/e2e/global.setup.ts](../../../tests/e2e/global.setup.ts)) so the flow runs as Abby with seeded data.
- **Routes through `ROUTES`.** The flow imports from `@ab/constants` -- never inlines path strings. When a route renames, one constant changes and the flow follows.
- **Console errors.** The flow listens for `pageerror` and `console.error` and fails the test on any error. This is the cheapest way to catch the masked 500s that bit the walkthrough.

### What to add

**Files to create (in `tests/e2e/`):**

| File                         | What it does                                                                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ia-flow.spec.ts`            | The wide-coverage flow. Walks every top-level route + every section sub-tab in one test, asserts page-anchor visibility, fails on any console/page error. |
| `ia-first-run.spec.ts`       | Focused: brand-new user (no goal, no plan) sees the "Set your first goal" CTA on Home and nothing else dangerous.                                         |
| `ia-goal-to-session.spec.ts` | Focused: from a populated goal, "Start studying" reaches the session entry. (The load-bearing transition.)                                                |

**Components to instrument (add `data-testid`):**

- Section nav links (`nav-{home|learn|program|insights|reference}`), in the new layout.
- Each section's index-page header (`page-anchor`) for: Home, Learn (and each Learn sub-page), Program (and each tab), Insights (and each child), Reference (and each child).
- Home's primary CTA (`home-cta-primary`) and secondary CTAs (`home-cta-secondary` -- can repeat).
- Program tabs (`program-tab-{quals|goal|plan|coverage}`).
- The goal-detail "Start studying" / "Build my plan" CTA (`goal-detail-start-cta`).
- The first-run gate banner if Q4 lands on Option B (`first-run-set-goal-cta`).

### Sketch -- `ia-flow.spec.ts`

```typescript
import { expect, test, type Page } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';

interface Stop {
  label: string;
  path: string;
  // Optional sub-anchors to verify on the same page (e.g., Program sub-tabs).
  subAnchors?: ReadonlyArray<string>;
}

const FLOW: ReadonlyArray<Stop> = [
  { label: 'home', path: ROUTES.STUDY },
  { label: 'learn-cards', path: ROUTES.MEMORY },
  { label: 'learn-cards-browse', path: ROUTES.MEMORY_BROWSE },
  { label: 'learn-cards-new', path: ROUTES.MEMORY_NEW },
  { label: 'learn-reps', path: ROUTES.REPS },
  { label: 'learn-reps-browse', path: ROUTES.REPS_BROWSE },
  { label: 'learn-read', path: ROUTES.LIBRARY },
  // Program sub-tabs share the /program route + ?tab= query (or sub-routes,
  // depending on Q1's resolution). Assert each tab anchor is reachable.
  { label: 'program', path: ROUTES.PROGRAM,
    subAnchors: ['program-tab-quals', 'program-tab-goal', 'program-tab-plan', 'program-tab-coverage'] },
  { label: 'insights', path: ROUTES.INSIGHTS },
  { label: 'insights-calibration', path: ROUTES.CALIBRATION },
  { label: 'insights-lens', path: ROUTES.LENS_HANDBOOK },
  { label: 'reference-knowledge', path: ROUTES.KNOWLEDGE },
  { label: 'reference-glossary', path: ROUTES.GLOSSARY },
];

function attachErrorTrap(page: Page): { errors: string[] } {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  return { errors };
}

test.describe('IA flow -- existence sweep', () => {
  test('every top-level route renders without errors', async ({ page }) => {
    const { errors } = attachErrorTrap(page);
    for (const stop of FLOW) {
      const res = await page.goto(stop.path);
      expect(res?.status(), `expected 2xx for ${stop.path}`).toBeLessThan(400);
      await expect(page.getByTestId('page-anchor'), `page-anchor missing on ${stop.label}`).toBeVisible();
      for (const sub of stop.subAnchors ?? []) {
        await expect(page.getByTestId(sub), `sub-anchor ${sub} missing on ${stop.label}`).toBeVisible();
      }
    }
    expect(errors, `runtime errors during flow:\n${errors.join('\n')}`).toEqual([]);
  });
});
```

That's the entire wide-coverage net: one test, one loop, one assertion shape. Adds ~12 routes of coverage in ~5s.

### Where this fits in the build phases

- **Phase 1 (Home + first-run + explainers):** add `data-testid="page-anchor"` to the new Home, ship `ia-first-run.spec.ts` alongside the home work. Stub out `ia-flow.spec.ts` with just `STUDY` -- it grows as routes get added.
- **Phase 2 (Program consolidation):** add Program tabs + their testids; expand the flow.
- **Phase 3 (Insights + Reference rename, redirects):** add the renamed routes' anchors; expand the flow; add a separate redirect spec that asserts old paths 301 to new paths.
- **Phase 4 (drop dropdowns, finalize nav):** lock the flow as the canonical existence proof. CI fails if any route ships without a `page-anchor`.

### Convention to write down

Capture the testid conventions in [docs/agents/best-practices.md](../../agents/best-practices.md) under a new "E2E selectors" section so future agents don't reach for CSS class selectors. Specifically:

- Top-level route: `data-testid="page-anchor"` on the page's `<h1>`.
- Sub-tab/sub-section: `data-testid="{section}-tab-{name}"` on the tab/sub-anchor.
- Primary CTA: `data-testid="{page}-cta-primary"`.
- Nav: `data-testid="nav-{section}"`.
- Never repurpose a testid; if it changes meaning, rename it.

## Suggested next move

Don't touch code yet. Three-step:

1. **Joshua reads this doc, answers Q1-Q11.** Naming gets settled (Quals; Today; Training/Progress/Reference or other; toward).
2. **Update VOCABULARY.md and seed the in-app glossary** with the canonical entries (CTA, IA, BC, Qual, Goal, Plan, Syllabus, Knowledge node, Cards, Reps, Session, Domain, Lens, Calibration). This is the foundation everything else reads from.
3. **Author a work package** (`/ball-wp-spec`) for "Study app IA cleanup" with the agreed scope. Ship in phases:
   - Phase 1: Home + first-run + explain-everything plumbing (`libs/help/` + tooltip primitive + glossary drawer).
   - Phase 2: Program consolidation (Quals + Goal + Plan on one surface).
   - Phase 3: Insights + Reference rename and route redirects.
   - Phase 4: Drop the local Help dropdown, drop the Memory dropdown, finalize section nav.

Walkthrough notes ([docs/work/todos/20260504-03-goal-detail-walkthrough-TODO.md](../todos/20260504-03-goal-detail-walkthrough-TODO.md)) carry all the small fixes (Archive button color, dropdown offset, link styling, error visibility, etc.). Most resolve naturally inside this larger reorganization, so don't fix them in isolation -- batch them with the section they live in.
