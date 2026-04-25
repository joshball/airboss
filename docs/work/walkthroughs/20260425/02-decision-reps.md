---
title: 'Walkthrough #2 -- Decision Reps (2026-04-25)'
date: 2026-04-25
status: in-progress
walker: user
captured-by: agent
---

# Walkthrough #2 -- Decision Reps

## Process gap (must fix in this doc going forward)

- **A1.** When surfacing walkthrough steps, give the FULL example text the user should paste in (not "fill the situation paragraph" -- the actual paragraph). The test plan has it; the walkthrough steps must include it verbatim.
  - **Why:** the user is doing the click-through; surfacing partial details breaks flow and forces the user to invent test data.
  - **How to apply:** every step that says "fill in X" must include the literal X to use.

## DR-1 -- Create scenario

### Bugs

- **B1. (form layout)** "Phase of flight (optional)" label wraps to two lines on `/reps/new`, breaking horizontal alignment with Domain and Difficulty selectors. Result: the Phase dropdown sits lower than the others.
  - **Fix options:** shorten label to `Phase of flight (opt)`, or move `(optional)` under the label as small subtext, or put Phase on its own row.
  - **Severity:** minor visual.

### Confirmed working

- Form saves a new scenario.
- Toast confirmation: "Scenario \"Engine rough at 800 AGL\" saved." appears on `/reps/browse`.

## DR-5 / DR-12 -- Browse layout + seed gap

### Bugs

- **B2. (filter row layout)** On `/reps/browse`, the Status / Active / Apply / Reset controls overflow the filter card, sitting outside the bounding box.
  - **Fix:** restructure filter row so Apply/Reset live inside the card, or wrap onto a second row at narrow widths.
  - **Severity:** minor visual / responsive.

### Seed gap

- **S1. No seeded decision-rep scenarios in the dev DB.** `bun run db reset` (or `bun run db seed`) should ship with example scenarios -- empty state on a fresh DB makes #2 (and #5) impossible to walk without manual data creation.
  - **Required:** add seed scenarios alongside the seeded cards (Phase F1 added 24 cards; reps need parity).
  - **Open question:** how many, what domains, who authors them? Likely 5-10 across Emergency / Weather / Regulations / Airspace covering Beginner / Intermediate / Advanced.

## /session/start -- Quick reps & Private Pilot overview presets

### Bugs

- **B3. (CRITICAL) Private Pilot overview preset crashes on Start.** ZodError: focusDomains array `too_big` (max 5, got 7).
  - Stack: `libs/bc/study/src/plans.ts:57` -> `apps/study/src/routes/(app)/session/start/+page.server.ts:107`.
  - The preset configures 7 focus domains (Regulations, Weather, Airspace, VFR Operations, Aerodynamics, ADM / Human Factors, Flight Planning, Aircraft Systems) but the `createPlan` schema caps the array at 5.
  - **Decision required:** raise the cap (probably right -- a "Private Pilot overview" wants broad coverage), or trim the preset to 5.
  - **Recommend:** raise the cap; the preset's intent is breadth.

- **B4. (CRITICAL) Submitting a rep attempt fails with DB error.** Error: "Could not save rep attempt".
  - Stack: `libs/bc/study/src/sessions.ts:458` -> `submitRep` at `apps/study/src/routes/(app)/sessions/[id]/+page.server.ts:221`.
  - The insert into `study.session_item_result` is rejected at the DB layer (no specific PG error in the captured log -- need to reproduce with verbose logs to see the real cause: FK? check constraint? not-null? unique conflict path mismatch?).
  - Insert payload visible in log: `item_kind=rep`, `slice=strengthen`, `reason_code=strengthen_low_rep_accuracy`, `scenario_id=rep_01kq2hdwczvgeqvhx6esf89sqc`, `chosen_option=opt0`, `is_correct=false`, `confidence=2`. ON CONFLICT path: `(session_id, slot_index)`.
  - **Hypothesis:** the FK on `scenario_id` references a table the seeded scenario isn't in (rep ID prefix is `rep_*` -- the column may expect `scn_*` IDs, OR the constraint targets a table that's been renamed).
  - **Action:** root-cause and fix; this blocks the entire session-engine walkthrough (#5) and DR-13 dashboard.

- **B5. (layout)** `/session/start` Quick reps + Private Pilot overview tiles overlap each other in the expanded state. Empty space on the left of the grid. Cards below are different sizes.
  - **Fix:** the expanded preview shouldn't push siblings; either render the expanded preset in a modal/drawer, or use a grid with stable cells (each tile reserves the same expanded height, or expansion happens in-place without affecting siblings).
  - **Severity:** major visual / interaction; presets are the primary entry point so this is high-traffic.

### Confirmed working

- `/session/start` page renders presets; Quick reps + Private Pilot overview + Safety procedures + BFR prep tiles visible.

## Triage summary

| Item | Severity | Class | Owner |
|------|----------|-------|-------|
| A1 (process: full step text) | low | process | agent (this doc going forward) |
| B1 (Phase label two-line) | minor | UI | small fix |
| B2 (browse filter overflow) | minor | UI | small fix |
| B3 (preset focusDomains cap) | critical | logic | small fix (raise cap or split schema) |
| B4 (submitRep DB error) | critical | data layer | needs investigation |
| B5 (preset tile overlap + grid) | major | UI | layout rework |
| S1 (no seeded scenarios) | major | content | new seed file + script entry |

## Walkthrough completion

- DR-1: walked, B1 surfaced.
- DR-2 / DR-3 / DR-4: NOT walked (form-validation steps).
- DR-5: walked, B2 surfaced.
- DR-12: implicit (no scenarios -> S1 surfaced).
- DR-13: BLOCKED on B4.
