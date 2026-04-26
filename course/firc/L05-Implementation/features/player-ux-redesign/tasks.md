---
title: 'Tasks: Player UX Redesign'
product: sim
feature: player-ux-redesign
type: tasks
status: unread
---

# Tasks: Player UX Redesign

## Pre-flight

- [ ] Read `apps/sim/src/lib/components/ScenarioPlayer.svelte` -- understand current state machine
- [ ] Read `libs/engine/src/tick.ts` -- understand initRun, applyIntervention, isTerminal
- [ ] Read `libs/types/src/engine-types.ts` -- understand ImmersionTick, TickScript, RunState
- [ ] Read `libs/ui/src/components/InterventionLadder.svelte` -- understand current ladder UI
- [ ] Read `libs/ui/src/components/SituationCard.svelte` -- understand current briefing card
- [ ] Read `course/firc/L05-Implementation/features/instrument-scan/spec.md` -- understand layout constraint
- [ ] Read `scripts/db/seed-e2e-demo.ts` -- understand seed data shape

## Implementation

### 1. Engine: immersion support

- [ ] Add `immersionIndex: number` to `RunState` in `libs/types/src/engine-types.ts`
- [ ] Update `initRun()` in `libs/engine/src/tick.ts`: if `immersionTicks` exist and are non-empty, set `immersionIndex: 0` and `currentTickId` to first immersion tick ID. Otherwise set `immersionIndex: -1`.
- [ ] Add `advanceImmersion(state, script)` function: increments `immersionIndex`, transitions to scored ticks when immersion is exhausted
- [ ] Add `isInImmersion(state)` function: returns `state.immersionIndex >= 0`
- [ ] Update `replayHistory()` to skip immersion ticks (they have no intervention)
- [ ] Add tests in `libs/engine/src/tick.test.ts` for immersion: init with immersion ticks, advance through them, transition to scored, init without immersion ticks (backward compat)
- [ ] Run `bun run check` -- 0 errors
- [ ] Commit: "feat(engine): immersion tick support"

### 2. Action bar: keyboard shortcuts + cleanup

- [ ] Add keyboard shortcut map constant to `libs/constants/src/engine.ts`: `INTERVENTION_SHORTCUTS: Record<string, InterventionLevel>`
- [ ] Export from `libs/constants/src/index.ts`
- [ ] Update `InterventionLadder.svelte`: add shortcut hint badges `[A]`, `[P]`, `[C]`, `[D]`, `[T]` on each level header
- [ ] Update `ScenarioPlayer.svelte`: add `$effect` with `keydown` listener that calls `intervene()` for matching keys. Gate on: not disabled, not in immersion, not terminal, no active text input focus.
- [ ] Remove timer display from ScenarioPlayer status bar (keep elapsed tracking internal for evidence)
- [ ] Remove student state badge from ScenarioPlayer status bar
- [ ] Run `bun run check` -- 0 errors
- [ ] Commit: "feat(sim): keyboard shortcuts on intervention ladder, remove timer/badge"

### 3. Player: immersion phase rendering

- [ ] Create `ImmersionPanel.svelte` in `apps/sim/src/lib/components/`: renders scene, student speech, warmup question callout, and "Continue" button
- [ ] Update `ScenarioPlayer.svelte`: add `PlayerPhase` state (`'immersion' | 'playing' | 'terminal'`). Derive phase from `isInImmersion()` and `isTerminal()`.
- [ ] Render `ImmersionPanel` when phase is `immersion`. Ladder visible but `disabled={true}`.
- [ ] "Continue" button calls `advanceImmersion()`. When immersion exhausted, phase transitions to `playing`.
- [ ] Add transition message between immersion and playing: "You are now instructing."
- [ ] Test: scenario with immersion ticks shows immersion phase first, then scored ticks. Scenario without immersion ticks goes straight to scored.
- [ ] Run `bun run check` -- 0 errors
- [ ] Commit: "feat(sim): immersion phase in scenario player"

### 4. Schema: structured briefing fields

- [ ] Add nullable columns to `course.scenario` in `libs/bc/course/src/schema.ts`: airport, runwayHeading, wind, ceiling, visibility, temperature, densityAltitude, timeOfDay, studentHours, studentCertificate, aircraft, studentNotes
- [ ] Add same columns to `published.scenario` in the same file
- [ ] Run `bun run db push` to apply schema changes
- [ ] Update seed data in `scripts/db/seed-e2e-demo.ts`: add structured fields + immersion ticks to both demo scenarios
- [ ] Run `bun run check` -- 0 errors
- [ ] Commit: "feat(db): structured briefing fields on scenario"

### 5. Briefing page: SituationCard with structured data

- [ ] Update briefing page server load (`apps/sim/src/routes/(app)/scenario/[id]/brief/+page.server.ts`): pass structured fields through to the page
- [ ] Update briefing page (`brief/+page.svelte`): pass structured fields to `SituationCard` as props (airport, wind, etc.). Falls back to `briefingText` if no structured data.
- [ ] Change "Call the Ball" button text to "Begin Flight" (per spec: rename until tutorial teaches the term)
- [ ] Do the same for `free-play/[id]/brief/+page.svelte`
- [ ] Run `bun run check` -- 0 errors
- [ ] Commit: "feat(sim): structured briefing data on SituationCard"

### 6. Tutorial overlay

- [ ] Create `TutorialOverlay.svelte` in `libs/ui/src/components/`: spotlight effect, step rendering, Next/action buttons
- [ ] Export from `libs/ui/src/index.ts`
- [ ] Define tutorial steps in `apps/sim/src/lib/tutorial-steps.ts`: 5 steps targeting situation panel, student panel, ladder, "try Ask" action, completion
- [ ] Wire into scenario page (`/scenario/[id]/+page.svelte`): show overlay if `!hasSeenTutorial`. After completion, set flag.
- [ ] Tutorial flag: use `localStorage` key `firc_tutorial_seen`. Check on mount, set on completion.
- [ ] Add "Review Tutorial" button to Settings page that clears the flag
- [ ] Run `bun run check` -- 0 errors
- [ ] Commit: "feat(sim): first-time tutorial overlay"

### 7. Visual polish

- [ ] Review all changes in the browser. Reset DB and run seed.
- [ ] Test keyboard shortcuts (A/P/C/D/T) during scored ticks
- [ ] Test immersion phase advances correctly
- [ ] Test SituationCard renders with structured data
- [ ] Test SituationCard falls back to text when no structured data
- [ ] Test tutorial overlay appears on first visit, not on second
- [ ] Test tutorial "Review" from settings
- [ ] Fix any visual issues found
- [ ] Run `bun run check` -- 0 errors
- [ ] Commit: "fix(sim): player UX visual polish"

## Post-implementation

- [ ] Full manual test per test-plan.md
- [ ] Launch review agents (correctness, svelte, UX, a11y)
- [ ] Fix any issues found by reviewers
- [ ] Final commit and push
- [ ] Create PR for main
