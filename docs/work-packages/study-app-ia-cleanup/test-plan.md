---
title: 'Test Plan: Study App IA Cleanup'
product: study
feature: study-app-ia-cleanup
type: test-plan
status: unread
review_status: pending
created: 2026-05-04
---

# Test Plan: Study App IA Cleanup

Manual walkthrough. Joshua runs every step before flipping `status: done`. Per CLAUDE.md "nothing merges without a manual test plan."

Scenario IDs use the prefix **IAC** (IA Cleanup). Automated coverage notes call out which Playwright spec also exercises the scenario.

## Setup

| Step    | Action                                                                                                | Pass criteria                                                  |
| ------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| IAC-0.1 | `bun run db:seed` -- baseline. Sign in as Abby (`abby@airboss.test`).                                  | Lands on `/study`. Header shows Abby.                          |
| IAC-0.2 | Confirm Abby has a primary goal + an active plan in the seeded state.                                  | `/program` -> Goal tab shows the goal as primary; Plan tab populated. |
| IAC-0.3 | For first-run scenarios: prepare a fresh user (no goal, no plan, no decks). Use `bun run db:reset --user new@airboss.test`. | The new user signs in to an empty Home.                         |

## First-run scenarios

Covered automatically by `tests/e2e/ia-first-run.spec.ts` for IAC-1.1 and IAC-1.2.

| Step    | Action                                                                            | Pass criteria                                                                                                |
| ------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| IAC-1.1 | New user signs in. Lands on `/study`.                                             | Home shows ONE primary CTA: "Set your first goal". One-line explainer below: "Why a goal? ..."               |
| IAC-1.2 | Hover the Learn nav link.                                                          | Soft-disabled visually. Tooltip: "Set a goal to unlock."                                                     |
| IAC-1.3 | Hover the Insights nav link.                                                       | Soft-disabled. Tooltip: "Set a goal to unlock."                                                              |
| IAC-1.4 | Click the Reference nav link.                                                      | Lands on `/reference`. Glossary + Knowledge readable. No goal required.                                      |
| IAC-1.5 | Click the Program nav link.                                                        | Lands on `/program`. Goal tab default-active. Goal tab shows "Set a goal to begin." CTA -> goal-create wizard. |
| IAC-1.6 | Click "Set your first goal" CTA on Home.                                           | Lands on goal-create wizard. After completing the wizard, returns to Home.                                   |
| IAC-1.7 | After creating a goal but no plan, return to Home.                                 | Primary CTA flips to "Build a plan for {goal title}".                                                        |

## Today / daily CTA scenarios

| Step    | Action                                                                            | Pass criteria                                                                                                |
| ------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| IAC-2.1 | Abby (goal + plan) lands on `/study`.                                             | Primary CTA: "Start today's session". Pressure CTAs visible: "Review {n} due", "Run {n} reps".               |
| IAC-2.2 | Click "Start today's session".                                                    | Lands on the session entry (existing session-start behavior, unchanged).                                     |
| IAC-2.3 | Click "Review {n} due" pressure CTA.                                              | Lands on `/memory/review`.                                                                                   |
| IAC-2.4 | A user with a paused goal (no active goal) lands on `/study`.                     | Home shows two CTAs: "Resume {goal}" and "Set a new primary goal".                                           |
| IAC-2.5 | A user with a goal but no plan lands on `/study`.                                 | Primary CTA: "Build a plan for {goal}". No "Start today's session" until plan exists.                        |

## Explainer scenarios (page explainers + tooltips)

| Step    | Action                                                                            | Pass criteria                                                                                                |
| ------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| IAC-3.1 | Visit any page with a `PageExplainer`. The explainer is open by default.          | Top of page shows "Why am I here?" block with 2-3 sentences.                                                 |
| IAC-3.2 | Click the explainer's collapse button.                                            | Block collapses. A small `?` button remains visible to re-open it.                                           |
| IAC-3.3 | Reload the page.                                                                  | Explainer stays collapsed (per-page dismissal persisted).                                                    |
| IAC-3.4 | Open Settings -> "Hide page explainers" -> on. Re-open the page.                  | All page explainers default-collapsed. Each page still shows its `?` to re-open individually.                |
| IAC-3.5 | Toggle "Hide page explainers" off again.                                          | Page explainers are open by default again on pages that haven't been individually dismissed.                 |
| IAC-3.6 | Hover the **Quals** label in the Program tab strip.                                | Tooltip: "Qualifications -- the certificates you're working toward (PPL, IR, CPL, CFI)."                     |
| IAC-3.7 | Hover the **Goal** label.                                                          | Tooltip: "What slice of study you're focused on right now."                                                  |
| IAC-3.8 | Hover the **Plan** label.                                                          | Tooltip: "The schedule and session shape for your goal -- how long, how often, what to focus on."           |
| IAC-3.9 | Tab-focus the Quals label via keyboard.                                            | Tooltip appears (focus parity). Blur dismisses it.                                                           |
| IAC-3.10 | On a touch device (or DevTools mobile), tap the Quals label.                     | Tooltip appears. Tap outside dismisses it.                                                                   |

## Glossary surface scenarios

| Step    | Action                                                                            | Pass criteria                                                                                                |
| ------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| IAC-4.1 | Click the right-cluster `?` button.                                                | Glossary drawer slides in from the right. Search field focused.                                              |
| IAC-4.2 | Type "qual" in the drawer search.                                                  | List filters to terms matching "qual" (Qual + any related).                                                  |
| IAC-4.3 | Click a term in the drawer list.                                                   | Drawer expands the term's long-form entry inline.                                                            |
| IAC-4.4 | Press Esc in the drawer.                                                           | Drawer closes. Focus returns to the `?` button.                                                              |
| IAC-4.5 | Visit `/reference/glossary` directly.                                              | Page renders the canonical glossary list. Same content as the drawer.                                        |
| IAC-4.6 | Click a term on `/reference/glossary`.                                             | Lands on the term's detail page (or in-page anchor) with long-form content.                                  |

## Program section scenarios

| Step    | Action                                                                            | Pass criteria                                                                                                |
| ------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| IAC-5.1 | Click Program in the nav.                                                          | Lands on `/program`. Default tab = Goal (if user has a goal) else Quals.                                     |
| IAC-5.2 | Click each tab: Quals / Goal / Plan / Coverage.                                   | Each tab renders its content inline. URL updates to `?tab=...`.                                              |
| IAC-5.3 | On the Goal tab, click into a goal's detail.                                       | Lands on `/program/goals/[id]`. Breadcrumb back to Program.                                                  |
| IAC-5.4 | On Goal detail with no plan, click "Build my plan".                                | Lands on plan-create flow scoped to the goal.                                                                |
| IAC-5.5 | On Goal detail with a plan, click "Start studying".                                | Lands on session entry.                                                                                      |
| IAC-5.6 | Each Program tab opens with its own page explainer.                                | Explainer text describes that tab's role (Quals / Goal / Plan / Coverage).                                   |

## Insights scenarios

| Step    | Action                                                                            | Pass criteria                                                                                                |
| ------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| IAC-6.1 | Click Insights in the nav.                                                         | Lands on `/insights` (renamed from `/dashboard`). Section tagline shown.                                     |
| IAC-6.2 | Visit `/insights/calibration`.                                                     | Calibration page renders unchanged (just at a new URL).                                                      |
| IAC-6.3 | Visit `/insights/lens/handbook`.                                                   | Lens handbook view renders unchanged (just at a new URL).                                                    |

## Reference scenarios

| Step    | Action                                                                            | Pass criteria                                                                                                |
| ------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| IAC-7.1 | Click Reference in the nav.                                                        | Lands on `/reference`. Tagline + sub-nav (Knowledge graph, Glossary, link to Flightbag).                     |
| IAC-7.2 | Click "Knowledge graph".                                                           | Lands on `/reference/knowledge`. Existing knowledge graph content.                                           |
| IAC-7.3 | Click "Glossary".                                                                  | Lands on `/reference/glossary`. Same as IAC-4.5.                                                             |
| IAC-7.4 | Click "Flightbag" link in Reference.                                               | Cross-app jump to Flightbag (existing behavior, unchanged).                                                  |

## Redirect scenarios

Covered automatically by `tests/e2e/ia-redirect.spec.ts`. Manual smoke: try a handful in a real browser.

| Step     | Old path                          | New path                              | Pass criteria                                            |
| -------- | --------------------------------- | ------------------------------------- | -------------------------------------------------------- |
| IAC-8.1  | `/dashboard`                      | `/insights`                           | 301 redirect. Browser URL bar updates.                   |
| IAC-8.2  | `/credentials`                    | `/program?tab=quals`                  | 301 redirect.                                            |
| IAC-8.3  | `/credentials/ppl`                | `/program/quals/ppl`                  | 301 redirect.                                            |
| IAC-8.4  | `/goals`                          | `/program?tab=goal`                   | 301 redirect.                                            |
| IAC-8.5  | `/goals/{id}`                     | `/program/goals/{id}`                 | 301 redirect.                                            |
| IAC-8.6  | `/plans`                          | `/program?tab=plan`                   | 301 redirect.                                            |
| IAC-8.7  | `/plans/{id}`                     | `/program/plans/{id}`                 | 301 redirect.                                            |
| IAC-8.8  | `/calibration`                    | `/insights/calibration`               | 301 redirect.                                            |
| IAC-8.9  | `/lens/handbook`                  | `/insights/lens/handbook`             | 301 redirect.                                            |
| IAC-8.10 | `/lens/weakness`                  | `/insights/lens/weakness`             | 301 redirect.                                            |
| IAC-8.11 | `/knowledge`                      | `/reference/knowledge`                | 301 redirect.                                            |
| IAC-8.12 | `/glossary`                       | `/reference/glossary`                 | 301 redirect.                                            |

## Nav consistency

| Step    | Action                                                                            | Pass criteria                                                                                                |
| ------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| IAC-9.1 | Inspect the top nav after Phase 4.                                                 | Five entries: Home, Learn, Program, Insights, Reference. No dropdowns. Each has `data-testid="nav-{section}"`. |
| IAC-9.2 | DevTools -> Elements -> search `data-testid="page-anchor"`.                        | Every page in the app has exactly one `page-anchor` element on its `<h1>` or primary section header.        |
| IAC-9.3 | Click each top-level nav entry.                                                    | Each lands on its section index page. Section index page renders the tagline + sub-nav.                      |
| IAC-9.4 | Run `tests/e2e/ia-flow.spec.ts`.                                                   | Test passes. No console errors during the flow.                                                              |
| IAC-9.5 | Confirm the global Help link in the right cluster is the only Help affordance.     | No local Help dropdown anywhere in the study app.                                                            |

## Number explainer scenarios

| Step     | Action                                                                            | Pass criteria                                                                                                |
| -------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| IAC-10.1 | Hover the "12 due" number on Home.                                                 | Tooltip: "12 review cards are scheduled to come back today, based on spaced repetition."                     |
| IAC-10.2 | Click the `?` icon next to "12 due".                                               | Popover with formula + link to glossary entry "Cards / spaced repetition".                                   |
| IAC-10.3 | Hover the "6 ready" reps number.                                                   | Tooltip: "6 scenario reps you haven't attempted yet."                                                        |
| IAC-10.4 | Click `?` next to a calibration metric on `/insights/calibration`.                 | Popover with formula + link to glossary entry "Calibration".                                                 |
| IAC-10.5 | Click outside an open `?` popover.                                                 | Popover closes.                                                                                              |

## Negative / edge cases

| Step     | Action                                                                            | Pass criteria                                                                                                |
| -------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| IAC-11.1 | Hit a renamed route directly from a stale bookmark.                                | 301 redirects transparently. No 404. URL bar updates.                                                        |
| IAC-11.2 | Trigger a 500 on a child page (e.g. force `/memory/review` to error in dev).       | Section index still renders. Error surface is loud and detailed on `localhost`/`*.test`.                     |
| IAC-11.3 | First-run user clicks a soft-disabled Learn link.                                  | Click is intercepted; tooltip prompts "Set a goal to unlock." User does not land on a blank Learn page.      |
| IAC-11.4 | User who came back after a long break and forgot what Quals means hovers Quals.    | Tooltip definition. Click drawer `?` for deep dive.                                                           |
| IAC-11.5 | User has multiple active goals (one primary, others side-quests).                  | Program -> Goal tab lists all; primary marked. Home daily CTA references only the primary.                   |

## Sign-off

- [ ] Every IAC-N.M scenario above passes.
- [ ] `bun run check` clean.
- [ ] All Playwright specs pass: `ia-flow.spec.ts`, `ia-first-run.spec.ts`, `ia-goal-to-session.spec.ts`, `ia-redirect.spec.ts`.
- [ ] No new console errors in any flow.
- [ ] Joshua flips `status: done` on [spec.md](./spec.md).
