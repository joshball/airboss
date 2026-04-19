---
title: 'Spec: Player UX Redesign'
product: sim
feature: player-ux-redesign
type: spec
status: unread
---

# Spec: Player UX Redesign

Redesign the scenario player experience from briefing through debrief. Fix the action bar, add immersion phase, improve the briefing page, and add a first-time tutorial. The layout must be shared across tick scenarios and future instrument scan exercises.

## Data Model

### TickScript extension (already done)

`ImmersionTick` and `immersionTicks?: ImmersionTick[]` on `TickScript` already exist in `libs/types/src/engine-types.ts`. No schema changes needed.

### Scenario structured briefing (new, additive)

Add optional structured fields to the scenario table. The existing `briefing: string` field stays as a fallback.

```typescript
// course.scenario -- add columns (all nullable, additive)
airport: text('airport'),                    // "KXYZ"
runwayHeading: integer('runway_heading'),     // 270
wind: text('wind'),                          // "210 at 18 gusting 25"
ceiling: text('ceiling'),                    // "3500 BKN"
visibility: text('visibility'),              // "7 SM"
temperature: text('temperature'),            // "28C"
densityAltitude: integer('density_altitude'), // 3200
timeOfDay: text('time_of_day'),              // "16:40 local"
studentHours: integer('student_hours'),       // 62
studentCertificate: text('student_certificate'), // "Private candidate"
aircraft: text('aircraft'),                  // "C172S (G1000)"
studentNotes: text('student_notes'),         // "Confident, 3rd lesson"
```

Same columns added to `published.scenario` for the read-only published snapshot.

### Tutorial completion flag

Add `hasSeenTutorial: boolean` to the user profile. Stored in `identity.user_profile` (or `localStorage` if no profile table exists -- check schema). Default `false`. Set to `true` after completing the tutorial overlay.

## Behavior

### Phase 1: Action Bar

The right-side intervention ladder becomes the permanent action bar for all scenario types.

- **Keyboard shortcuts:** `A` = Ask, `P` = Prompt, `C` = Coach, `D` = Direct, `T` = Take Controls. Active only when the ladder is enabled (not during immersion, not after terminal).
- **Remove timer** from the status bar. If time is needed for evidence, track it internally but don't show it to the user.
- **Remove student state badge** ("Normal flight", "Performance declining"). The scene text should convey urgency. If it doesn't, the scene text is broken, not the badge.
- **Keyboard shortcut hints** shown on each ladder level button: `[A]`, `[P]`, `[C]`, `[D]`, `[T]`.

### Phase 2: Immersion Phase

When a `TickScript` has `immersionTicks`, the player renders them before scored ticks.

- During immersion: left panel shows `scene` + `studentSpeech` + `warmupQuestion`. The warmup question is shown in a distinct callout style (not the same as the scene text).
- The intervention ladder is visible but **disabled** during immersion. Visually grayed out. This teaches the user where the ladder is before they need it.
- User clicks a "Continue" button to advance through immersion ticks. No intervention choice, no scoring.
- After the last immersion tick, a transition message: "You are now instructing. Use the intervention ladder to respond." The ladder activates.
- Engine changes: `initRun()` must handle immersion ticks. The `RunState` tracks whether we're in immersion or scored phase. `currentTickId` for immersion ticks uses the immersion tick IDs.

### Phase 3: Briefing Page

The briefing page shows structured scenario data visually.

- If the scenario has structured fields (airport, wind, studentHours, etc.), render the `SituationCard` component with the visual airport diagram + data grid.
- If only `briefing: string` exists, fall back to text display (current behavior).
- **Remove "Call the Ball"** label. Replace with "Begin Flight" until the tutorial teaches what "Call the Ball" means. After tutorial completion, show "Call the Ball".
- Show module/lesson context: "Module 1, Lesson 3 -- Automation Awareness" above the title. Requires passing module context through the load function.
- Move topic badges and challenge level below the SituationCard, not in a separate meta section.

### Phase 4: Tutorial Overlay

On the user's first scenario (or a dedicated tutorial scenario):

- Step-by-step overlay that highlights one element at a time.
- Step 1: Highlight the situation panel. "This is the flight situation -- what's happening right now."
- Step 2: Highlight the student panel. "This is your student -- what they're saying and doing."
- Step 3: Highlight the intervention ladder. "These are your five options, from lightest to strongest. Use the least invasive action that keeps the student safe."
- Step 4: "Try clicking Ask to see what happens." User clicks, sees the result, brief explanation.
- Step 5: "Good. The situation will change. Watch for cues and choose your next action." Overlay disappears, scenario continues normally.
- The overlay only shows once. Completion is tracked by `hasSeenTutorial` flag.
- A "Review Tutorial" option in Settings re-triggers it.

## Validation

| Field | Rule |
| --- | --- |
| Keyboard shortcut input | Only A/P/C/D/T trigger interventions. All other keys ignored. No modifier keys (Ctrl/Cmd+key) captured. |
| Immersion tick advancement | "Continue" button only. Keyboard Enter also works. No intervention during immersion. |
| Tutorial step progression | Must complete each step in order. Cannot skip. Can dismiss entire tutorial (counts as seen). |
| Structured briefing fields | All optional. Missing fields are simply not rendered. No validation on content. |

## Edge Cases

- **No immersion ticks:** If `immersionTicks` is undefined or empty, skip straight to scored ticks. Current behavior preserved.
- **Browser refresh during immersion:** Run lost, returns to briefing. Same as current behavior during scored ticks.
- **Keyboard input while tutorial overlay is active:** Ignored. Only the tutorial's "Next" / "Try it" buttons work.
- **Keyboard input while InterventionLadder is disabled:** Ignored. The `disabled` prop gates both click and keyboard.
- **Scenario with only 1 scored tick:** Works. Immersion -> single tick -> terminal.
- **Tutorial already seen + "Review Tutorial" triggered:** Flag reset to false, overlay shows on next scenario.
- **Mobile:** No keyboard shortcuts. Touch-only interaction with the ladder buttons. Immersion "Continue" is a button tap.

## Out of Scope

- Instrument scan exercise UI (separate feature, being built in another worktree)
- Activity log / note-taking panel (instrument scan feature adds this)
- Debrief page redesign (separate concern)
- Scenario content authoring (adding immersion ticks to existing scenarios is content work, not player work)
- Structured briefing data migration for all 50 scenarios (only the seed demo scenarios get structured data in this feature)
