---
title: "Tasks: Debrief"
product: sim
feature: debrief
type: tasks
status: done
---

# Tasks: Debrief

**Design review required before starting implementation.** Create `review.md` after design review completes.

## Pre-flight

- [x] Read `docs/agents/best-practices.md` -- Svelte 5, form patterns
- [x] Read `docs/platform/DESIGN_PRINCIPLES.md` -- Debrief Culture, Emotional Safety
- [x] Review `libs/bc/evidence/src/schema.ts` -- understand run, packet, dimensions structure
- [x] Review `libs/bc/evidence/src/manage.ts` -- understand current read functions
- [x] Review scenario-player design -- understand `actionsTaken` format stored in evidence_packet
- [x] Complete design review (write findings in `review.md`)

## Implementation

### 1. Evidence read BC

- [x] Create `libs/bc/evidence/src/read.ts` with user-scoped read functions:
  - `getOwnRun(runId, userId)` -- returns run if userId matches, null otherwise
  - `getOwnEvidencePacket(runId, userId)` -- returns packet for user's run
  - `getOwnScoreDimensions(runId, userId)` -- returns dimension rows for user's run
- [x] Export from `libs/bc/evidence/src/index.ts`
- [x] Run `bun run check` -- 0 errors, commit

### 2. Route setup

- [x] Add `ROUTES.SIM_DEBRIEF` to `libs/constants/src/routes.ts` if not already added
- [x] Create `apps/sim/src/routes/debrief/[runId]/+page.server.ts` -- load function
  - Load run (verify userId), packet, dimensions, scenario from published content
  - Error 404 if not found, 403 if wrong user
- [x] Run `bun run check` -- 0 errors, commit

### 3. Timeline builder

- [x] Create `apps/sim/src/$lib/debrief.ts` -- pure timeline builder functions:
  - `buildTimeline(run, packet, scenario)` -> `TimelineEntry[]`
  - `extractKeyMisses(timeline)` -> top 3 negative entries
  - `getBestIntervention(tick)` -> best available intervention for a tick
- [x] Run `bun run check` -- 0 errors, commit

### 4. Debrief page

- [x] Create `apps/sim/src/routes/debrief/[runId]/+page.svelte`:
  - [x] Outcome banner (SAFE / UNSAFE / INCOMPLETE with NTSB-style language)
  - [x] Score bars (4 dimensions, labeled)
  - [x] Key misses section (top 3 annotated callouts)
  - [x] Timeline (tick list, collapsible for runs > 6 ticks)
  - [x] Competency + FAA topic chips
  - [x] Action buttons: Try Again | Replay (disabled "Coming soon") | Continue
- [x] "Scenario content unavailable" graceful state for missing scenario
- [x] "Detailed breakdown unavailable" graceful state for missing packet
- [x] Run `bun run check` -- 0 errors, commit

### 5. Linking from scenario player

- [x] Verify scenario player `complete` action redirects to `/debrief/:runId` (should already be in player tasks)
- [x] Verify "Try Again" links back to `/scenario/:id/brief`
- [x] Verify "Continue" links to `/course`
- [x] Run `bun run check` -- 0 errors, commit

## Post-implementation

- [ ] Full manual test per `test-plan.md`
- [ ] Request implementation review
- [x] Update TASKS.md (mark debrief complete)
- [x] Commit docs updates
