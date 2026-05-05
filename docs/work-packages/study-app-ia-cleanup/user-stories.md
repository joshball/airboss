---
title: 'User Stories: Study App IA Cleanup'
product: study
feature: study-app-ia-cleanup
type: user-stories
status: unread
review_status: pending
created: 2026-05-04
---

# User Stories: Study App IA Cleanup

Persona context: returning CFI rebuilding PPL/IR/CPL/CFI knowledge after a long hiatus (user zero). Stories grouped by audience mode (First-run / Today / Wandering / Power) plus a negative bucket. Each story names the IAC test plan scenario(s) that exercise its acceptance.

## First-run user

The just-signed-up user. No goal, no plan, no history. Lands on Home in confusion or curiosity.

### US-FR-1 -- One obvious next step

**As a** brand-new user signing in for the first time,
**I want** the home page to show me exactly one thing to do,
**so that** I do not have to decode twelve nav entries before I can start.

Acceptance:

- `/study` shows a single big primary CTA: "Set your first goal".
- A one-line explainer below the button: "A goal is the slice of study you're focused on -- e.g. 'Pass PPL written by July.'"
- No other CTAs, tiles, or panels demand attention.

Tested by: IAC-1.1.

### US-FR-2 -- I can browse before I commit

**As a** new user who wants to see what the product offers before setting a goal,
**I want** to be able to open the glossary, knowledge graph, and library without first creating a goal,
**so that** I can decide whether this is for me.

Acceptance:

- Reference nav link is enabled and reachable from any page.
- `/reference/glossary`, `/reference/knowledge`, and library routes all render with no goal.
- Program nav is reachable too (so the user can read the Goal tab's "Set a goal to begin" copy).

Tested by: IAC-1.4, IAC-1.5.

### US-FR-3 -- The locked nav explains itself

**As a** new user who hovers a Learn nav link,
**I want** the tooltip to tell me how to unlock it,
**so that** I know what's gated and why.

Acceptance:

- Learn and Insights nav links render visually muted with `aria-disabled`.
- Hover (or focus) shows a tooltip: "Set a goal to unlock."
- Click is intercepted; the user does not land on a blank Learn page.

Tested by: IAC-1.2, IAC-1.3, IAC-11.3.

### US-FR-4 -- Setting a goal flips the home

**As a** new user who just completed the goal-create wizard,
**I want** Home to immediately reflect my goal,
**so that** the product confirms my action and tells me the next step.

Acceptance:

- After completing the goal-create wizard, the user is returned to Home.
- Home's primary CTA flips from "Set your first goal" to "Build a plan for {goal title}".
- Learn and Insights nav links are no longer soft-disabled.

Tested by: IAC-1.6, IAC-1.7.

### US-FR-5 -- I can read the term definitions inline

**As a** new user who does not yet know what "Quals" or "Plan" means,
**I want** every term in the nav and tabs to have a hover tooltip,
**so that** I do not have to leave the page to look up vocabulary.

Acceptance:

- Hovering "Quals" shows the one-line definition.
- Same for Goal and Plan.
- Tooltips show on keyboard focus too (not mouse-only).

Tested by: IAC-3.6, IAC-3.7, IAC-3.8, IAC-3.9.

### US-FR-6 -- The page explainer tells me where I am

**As a** new user landing on Program for the first time,
**I want** the page to explain in 2-3 sentences what Program is and what to do,
**so that** I'm not staring at four tabs with no context.

Acceptance:

- `/program` opens with the page explainer expanded by default.
- Explainer text is 2-3 sentences. The Program tagline and per-tab explainers cover Quals, Goal, Plan, Coverage.

Tested by: IAC-3.1, IAC-5.6.

### US-FR-7 -- The glossary is one click from anywhere

**As a** new user who wants a deeper definition than the tooltip gives,
**I want** a `?` button in the right cluster that opens a glossary drawer,
**so that** I can search and read entries without leaving my current page.

Acceptance:

- The right-cluster `?` button is visible on every page (including Home with no goal).
- Clicking opens the glossary drawer with a search field auto-focused.
- The drawer shares its content source with `/reference/glossary`.

Tested by: IAC-4.1, IAC-4.2, IAC-4.3, IAC-4.4.

## Today user

The returning daily-session user. Has an active goal + plan. Wants the shortest path to "do today's work."

### US-T-1 -- One click to start

**As a** returning user with a goal and a plan,
**I want** Home to show "Start today's session" as the single primary CTA,
**so that** I can launch into work without thinking.

Acceptance:

- Home's primary CTA is "Start today's session" when goal + plan exist.
- Clicking it lands on the session entry path.

Tested by: IAC-2.1, IAC-2.2.

### US-T-2 -- Pressure points are visible without being noisy

**As a** returning user who also wants to see what's piling up,
**I want** secondary CTAs for review backlog and due reps below the primary CTA,
**so that** I can choose to detour without losing the main path.

Acceptance:

- "Review {n} due" and "Run {n} reps" appear as secondary CTAs only when those counts > 0.
- Each secondary CTA has its own tooltip + `?` popover explaining the number.

Tested by: IAC-2.3, IAC-10.1, IAC-10.2, IAC-10.3.

### US-T-3 -- Numbers explain themselves

**As a** returning user who sees "12 due" on Home,
**I want** to hover for a one-liner and click `?` for the formula,
**so that** I trust the number and know what it counts.

Acceptance:

- Hover on "12 due" shows the one-line definition.
- Clicking `?` opens a popover with the formula and a link to the glossary entry.
- Click outside the popover dismisses it.

Tested by: IAC-10.1, IAC-10.2, IAC-10.5.

### US-T-4 -- Stats live in Insights now

**As a** returning user who used to bookmark `/dashboard`,
**I want** my old bookmark to still work,
**so that** I do not have to re-find the page.

Acceptance:

- Hitting `/dashboard` 301-redirects to `/insights`.
- The new URL appears in the address bar after redirect.
- The Insights index page renders the same stats content as the old dashboard.

Tested by: IAC-6.1, IAC-8.1, IAC-11.1.

### US-T-5 -- Five sections, no dropdowns

**As a** returning user who lost a click navigating the Memory dropdown,
**I want** the top nav to have no dropdowns,
**so that** every nav target is one click away.

Acceptance:

- Top nav has exactly five entries: Home, Learn, Program, Insights, Reference.
- No `<details>` or hover trays.
- Memory's children are reachable via the Learn -> Cards index page (tab strip).

Tested by: IAC-9.1, IAC-9.5.

### US-T-6 -- I have already dismissed the explainer

**As a** returning user who has already read the Home explainer,
**I want** my dismissal to persist,
**so that** the explainer does not pop back open every visit.

Acceptance:

- After collapsing the page explainer, reload preserves the collapsed state.
- A small `?` button remains to re-open it on demand.

Tested by: IAC-3.2, IAC-3.3.

### US-T-7 -- Hide all the explainers

**As a** returning user who knows the product cold,
**I want** a Settings toggle to hide all page explainers globally,
**so that** I do not have to dismiss them per-page.

Acceptance:

- Settings has a "Hide page explainers" boolean toggle.
- Toggle on -> all page explainers default-collapsed.
- Each page still has a `?` to re-open individually.
- Toggle off -> explainers return to their per-page dismissal state.

Tested by: IAC-3.4, IAC-3.5.

## Wandering user

Has time, wants to explore. Does not need a CTA; needs the product to be navigable.

### US-W-1 -- I can read the FAA library without a goal

**As a** user with time to browse handbook chapters,
**I want** the library reachable from Reference,
**so that** I can read material without committing to a study session.

Acceptance:

- Reference index links to the library / handbook.
- Library pages render unchanged (URL paths preserved).

Tested by: IAC-7.1, IAC-7.4.

### US-W-2 -- The knowledge graph is one click in from Reference

**As a** wandering user curious about the knowledge graph,
**I want** the graph reachable from `/reference/knowledge`,
**so that** I can explore atomic concepts without going through a goal.

Acceptance:

- Reference -> Knowledge graph lands on `/reference/knowledge`.
- Old `/knowledge` URL 301s here.

Tested by: IAC-7.2, IAC-8.11.

### US-W-3 -- The glossary page is canonical

**As a** wandering user who wants to read every term in the product,
**I want** `/reference/glossary` to list everything alphabetized,
**so that** I have a single canonical home for terminology.

Acceptance:

- `/reference/glossary` renders all terms.
- Page and drawer share the same content source.

Tested by: IAC-4.5, IAC-4.6, IAC-7.3.

### US-W-4 -- The Program section explains the BC distinction

**As a** wandering user who wants to understand what Goal and Plan are,
**I want** the Program tabs to each carry their own explainer,
**so that** I learn the BC vocabulary by reading the page.

Acceptance:

- Program -> Goal tab explainer: "Goal = what you're chasing. One primary at a time."
- Program -> Plan tab explainer: "Plan = how sessions are shaped. One active at a time."
- Tooltips on the tab labels echo the same definitions.

Tested by: IAC-5.6, IAC-3.7, IAC-3.8.

## Power user

Has multiple active goals, paused side-quests, deep familiarity with the product.

### US-P-1 -- Multiple active goals, one primary

**As a** power user pursuing PPL while also keeping IR fresh,
**I want** the Goal tab to list all active goals with the primary marked,
**so that** I can see my whole program at a glance.

Acceptance:

- Program -> Goal tab lists every goal with `status='active'`.
- The primary goal is visually marked.
- Home's daily CTA references only the primary goal.

Tested by: IAC-11.5.

### US-P-2 -- Paused side-quest stays accessible

**As a** power user who paused an IR side-quest,
**I want** the paused goal to remain visible in the Goal tab,
**so that** I can resume it later without re-creating it.

Acceptance:

- Goal tab includes paused goals (clearly labeled "Paused").
- Resuming a paused goal sets it back to `active` (existing BC behavior).

Tested by: IAC-2.4 covers the no-active-goal case; resume flow is the existing goal BC.

### US-P-3 -- Plan tweaks do not rewrite my goal

**As a** power user who just shortened my session length to 20 minutes,
**I want** that change to live on the Plan, not the Goal,
**so that** my intent ("Pass PPL written by July") stays untouched.

Acceptance:

- Plan tab is the only place session length / focus domains / skip domains are editable.
- Goal tab edit form has no session-shape fields.
- The two edit paths are clearly separated visually and in the URL.

Tested by: IAC-5.1, IAC-5.2.

### US-P-4 -- I land where I expect from any old bookmark

**As a** power user with twenty bookmarks across the old IA,
**I want** every old path to redirect to its new home,
**so that** my workflow does not break overnight.

Acceptance:

- Every redirect rule in [design.md](./design.md) "Redirect rules" works.
- The browser URL bar updates to the new path.

Tested by: IAC-8.1 through IAC-8.12.

### US-P-5 -- The flow test catches blank pages

**As a** power user who hates "the page rendered but actually 500'd",
**I want** the flow e2e to assert no console errors during the wide sweep,
**so that** silent failures fail the build.

Acceptance:

- `ia-flow.spec.ts` listens for `pageerror` and `console.error`.
- The test fails if any error fires during the flow.
- A masked 500 (like the walkthrough's `/memory/review`) cannot ship past CI.

Tested by: IAC-9.4, IAC-11.2.

## Negative stories

What goes wrong, and what should happen.

### US-N-1 -- Came back after a long break

**As a** user who has not signed in for six months and forgot what "Quals" means,
**I want** every term to have a hover definition and a glossary deep-link,
**so that** I can re-orient without reading docs.

Acceptance:

- Hovering Quals (or any glossary term) shows the definition.
- Clicking the right-cluster `?` opens the drawer for a deeper read.

Tested by: IAC-11.4, IAC-3.6, IAC-4.1.

### US-N-2 -- Page 500s

**As a** user who hits a 500 on a child page,
**I want** the section index to still render and the error surface to be loud,
**so that** I'm not stuck on a blank page wondering what happened.

Acceptance:

- The section's index page is not affected by a child route's 500.
- On `localhost` / `*.test`, the error surface shows the full stack and request context.
- (Production error UX is out of scope for this WP; tracked separately.)

Tested by: IAC-11.2.

### US-N-3 -- I cannot remember what Quals means

**As a** user who saw "Quals" once in the nav and forgot,
**I want** the in-app glossary to surface "Quals" with both its UI label and its DB term,
**so that** I learn the alias and can map UI to BC vocabulary.

Acceptance:

- Glossary entry for "Qual" lists "credential" as the underlying DB term and notes "the user word is Quals."
- The entry is reachable from the drawer and from `/reference/glossary`.

Tested by: IAC-4.2, IAC-4.5.

### US-N-4 -- Soft-disabled link is still a link

**As a** first-run user who tabs into a Learn nav link with the keyboard,
**I want** the link to communicate `aria-disabled="true"` to assistive tech,
**so that** screen-reader users know the link is gated.

Acceptance:

- `aria-disabled="true"` on every soft-disabled nav link.
- The unlock condition is in an accessible-name source (tooltip via `aria-describedby`).
- Click is intercepted; navigation does not occur.

Tested by: IAC-1.2, IAC-1.3, IAC-11.3, IAC-9.2.

### US-N-5 -- Old URL pasted in chat

**As a** user pasted an old `/credentials/ppl` link by a coworker still on bookmarks,
**I want** the link to land me on the new path,
**so that** I do not have to translate URLs in my head.

Acceptance:

- `/credentials/ppl` 301s to `/program/quals/ppl`.
- The browser URL bar shows the new path after redirect.

Tested by: IAC-8.3, IAC-11.1.
