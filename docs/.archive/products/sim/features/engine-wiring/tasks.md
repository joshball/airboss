---
title: "Tasks: Engine Wiring"
product: sim
feature: engine-wiring
type: tasks
status: unread
---

# Tasks: Engine Wiring

The engine is already wired. This task list is about seeding data, publishing a release, and verifying the full flow.

## Pre-flight

- [ ] Read `apps/sim/src/routes/(app)/scenario/[id]/+page.server.ts` -- understand the complete action
- [ ] Read `apps/sim/src/routes/(app)/scenario/[id]/+page.svelte` -- understand the player UI
- [ ] Read `apps/sim/src/routes/(app)/debrief/[runId]/+page.svelte` -- understand the debrief
- [ ] Verify DB is running (OrbStack)
- [ ] Verify sim app starts: `bun run dev` from apps/sim

## Implementation

### 1. Seed All Content

- [ ] Run `bun run db seed` -- seeds competencies, modules, dev users
- [ ] Run `bun run db seed-scenarios` -- seeds 43 scenarios + 26 student models
- [ ] Run `bun run db seed-questions` -- seeds 67 questions
- [ ] Verify in hangar: navigate to /scenarios, confirm 43 scenarios visible
- [ ] Verify in hangar: navigate to /questions, confirm 67 questions visible

### 2. Publish a Release

- [ ] In hangar, navigate to /publish
- [ ] Create a new release (or verify the publish pipeline works with seeded content)
- [ ] Verify release appears in published schema
- [ ] If publish pipeline has issues, document and fix

### 3. Verify Sim Flow

- [ ] Navigate to sim /course -- scenarios should appear
- [ ] Click a scenario -- brief page loads with briefing text
- [ ] Click "Call the Ball" -- player loads with first tick
- [ ] Verify 5 intervention buttons are visible and clickable
- [ ] Play through a scenario making interventions at each tick
- [ ] Verify terminal state shows "Scenario Complete"
- [ ] Verify form submits and redirects to debrief
- [ ] Verify debrief shows: outcome, 4 dimension scores, timeline, key misses

### 4. Verify Free-Play Flow

- [ ] Navigate to /free-play -- scenario cards should appear
- [ ] Play through a scenario via free-play
- [ ] Verify debrief shows correctly with "Back to Free Play" link

### 5. Fix Any Issues Found

- [ ] Document issues in this file as they're found
- [ ] Fix and commit each issue

## Post-implementation

- [ ] Full manual test per test-plan.md
- [ ] Update NOW.md -- sim engine is verified and working
