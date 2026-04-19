---
title: 'Design: Player UX Redesign'
product: sim
feature: player-ux-redesign
type: design
status: unread
---

# Design: Player UX Redesign

## Unified Player Layout

The player layout must be shared across tick scenarios AND instrument scan exercises. The instrument scan spec (course/L05-Implementation/features/instrument-scan/spec.md) defines the constraint: "the UI must be identical to every other scenario type."

```text
+------------------------------------------+---------------------+
|                                          |                     |
|          SITUATION AREA                  |   ACTION BAR        |
|          (slot -- varies by type)        |   (always same)     |
|                                          |                     |
|  Tick scenario:                          |   InterventionLadder|
|    scene text + student speech           |   with keyboard     |
|                                          |   shortcut hints    |
|  Instrument scan (future):               |                     |
|    animated six-pack panel               |   [A] Ask           |
|                                          |   [P] Prompt        |
|  Immersion phase:                        |   [C] Coach         |
|    scene + student + warmup question     |   [D] Direct        |
|    (ladder disabled)                     |   [T] Take Controls |
|                                          |                     |
+------------------------------------------+---------------------+
```

The left side is a **slot** that scenario types fill differently. The right side (action bar) is always the InterventionLadder.

## Component Architecture

### ScenarioPlayer.svelte (evolve, don't rewrite)

Current: renders tick scenario only.
New: renders three phases -- immersion, scored ticks, terminal.

```typescript
// State machine for player phase
type PlayerPhase = 'immersion' | 'playing' | 'terminal';
```

The component tracks which phase it's in:

1. **immersion:** Show immersion ticks one at a time with "Continue" button. Ladder visible but disabled.
2. **playing:** Show scored ticks with active ladder. Current behavior.
3. **terminal:** Show completion panel. Current behavior.

### Keyboard Handler

Global `keydown` listener scoped to the player. Only active during `playing` phase.

```typescript
const SHORTCUT_MAP: Record<string, InterventionLevel> = {
  a: 'ask',
  p: 'prompt',
  c: 'coach',
  d: 'direct',
  t: 'take_controls',
};
```

Listener: `$effect` that adds/removes the event listener based on phase. Ignores input when:
- Phase is not `playing`
- Ladder is disabled
- Tutorial overlay is active
- Focus is in a text input (future-proofing for note-taking)

### InterventionLadder.svelte (enhance)

Add `shortcutHint` display to each level button. The hint is the keyboard letter shown in a small badge on the button.

Add a `showShortcuts` prop (default `true` on desktop, `false` on mobile -- detected via media query or `matchMedia`).

### TutorialOverlay.svelte (new component)

A modal-like overlay that highlights one element at a time using a spotlight effect (darken everything except the highlighted element).

Props:
```typescript
{
  step: number;
  totalSteps: number;
  targetSelector: string;  // CSS selector for the element to highlight
  title: string;
  description: string;
  action?: string;  // "Click Ask to try it" -- if set, waits for user action instead of "Next"
  onNext: () => void;
  onDismiss: () => void;
}
```

The overlay renders:
- Full-screen semi-transparent backdrop
- A "window" cutout around the target element
- A tooltip positioned near the target with title, description, and Next/action button

Steps are defined in the parent page, not in the component. The component just renders one step at a time.

### ImmersionPanel.svelte (new component)

Renders a single immersion tick. Separate from the scored tick display because:
- It has a warmup question callout
- It has a "Continue" button instead of the ladder
- It has no student state badge

```svelte
<Panel title="Situation">
  <p class="scene-text">{tick.scene}</p>
</Panel>

<Panel title="Student">
  <p class="student-speech">"{tick.studentSpeech}"</p>
</Panel>

<div class="warmup-callout">
  <p class="warmup-label">Before you intervene, consider:</p>
  <p class="warmup-question">{tick.warmupQuestion}</p>
</div>

<Button onclick={onContinue}>Continue</Button>
```

## Engine Changes

### initRun extension

If `immersionTicks` exist, `initRun` sets `currentTickId` to the first immersion tick ID (prefixed `imm_` to distinguish from scored ticks). Add an `immersionIndex` to RunState:

```typescript
interface RunState {
  // ... existing fields
  immersionIndex: number;  // -1 = not in immersion, 0+ = current immersion tick
}
```

New function:

```typescript
export function advanceImmersion(state: RunState, script: TickScript): RunState {
  const nextIndex = state.immersionIndex + 1;
  const immersionTicks = script.immersionTicks ?? [];

  if (nextIndex >= immersionTicks.length) {
    // Transition to scored ticks
    return {
      ...state,
      immersionIndex: -1,
      currentTickId: script.ticks[0].id,
    };
  }

  return {
    ...state,
    immersionIndex: nextIndex,
    currentTickId: immersionTicks[nextIndex].id,
  };
}

export function isInImmersion(state: RunState): boolean {
  return state.immersionIndex >= 0;
}
```

### Backward compatibility

If `immersionTicks` is undefined or empty, `immersionIndex` starts at -1 and all existing behavior is unchanged.

## Schema Changes

### course.scenario (add columns)

All new columns are nullable text/integer -- no constraints, no indexes needed. Pure metadata for the SituationCard.

```typescript
// libs/bc/course/src/schema.ts -- add to scenario table
airport: text('airport'),
runwayHeading: integer('runway_heading'),
wind: text('wind'),
ceiling: text('ceiling'),
visibility: text('visibility'),
temperature: text('temperature'),
densityAltitude: integer('density_altitude'),
timeOfDay: text('time_of_day'),
studentHours: integer('student_hours'),
studentCertificate: text('student_certificate'),
aircraft: text('aircraft'),
studentNotes: text('student_notes'),
```

Same columns added to `published.scenario` (the published snapshot).

### Seed data

Update `seed-e2e-demo.ts` to include structured briefing fields and immersion ticks for the two demo scenarios.

## Key Decisions

**Why evolve ScenarioPlayer, not rewrite:** The component is 120 lines of working code. Adding phase tracking and keyboard shortcuts doesn't require starting over. A rewrite risks breaking the existing server-side completion flow.

**Why a slot-based layout:** The instrument scan spec demands the same action bar across all scenario types. A slot for the left panel means tick scenarios, instrument scans, and future types all share the same shell.

**Why disable the ladder during immersion (not hide it):** Hiding the ladder means the user doesn't know it exists until the scored phase starts. Showing it disabled teaches them where it is and what it looks like before they need it.

**Why keyboard shortcuts map to single letters:** The instrument scan spec already defines A/P/C/D/T as the intervention keys. We match that spec exactly.

**Why the tutorial is an overlay, not a separate route:** The tutorial teaches the real UI with real data. A separate tutorial page would teach an abstraction, not the thing itself.

**Why `immersionIndex` on RunState (not a separate state object):** Keeps the state machine in one place. The server-side `replayHistory` function needs to skip immersion ticks -- having the index on RunState makes that explicit.
