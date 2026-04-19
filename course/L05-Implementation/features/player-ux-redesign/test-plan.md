---
title: 'Test Plan: Player UX Redesign'
product: sim
feature: player-ux-redesign
type: test-plan
status: unread
---

# Test Plan: Player UX Redesign

## Setup

1. Reset DB and run seed: `bun run db reset --force && bun scripts/db/seed-e2e-demo.ts`
2. Start dev servers: `bun run start`
3. Login as abby@test.com / Pa33word!
4. Clear localStorage (to reset tutorial flag): DevTools -> Application -> Local Storage -> clear `firc_tutorial_seen`

---

## PUX-1: Keyboard shortcuts trigger interventions

1. Navigate to Course, click a scenario, click "Begin Flight"
2. Wait for the first scored tick to appear
3. Press `A` on keyboard
4. **Expected:** The "Ask" intervention fires. Scene advances to next tick. Activity is recorded.
5. Press `P` on keyboard
6. **Expected:** The "Prompt" intervention fires.
7. Press a non-mapped key (e.g., `X`, `Space`, `Enter`)
8. **Expected:** Nothing happens. No intervention, no error.

## PUX-2: Keyboard shortcuts disabled during immersion

1. Start a scenario that has immersion ticks
2. During the immersion phase (warmup question visible, ladder grayed out)
3. Press `A` on keyboard
4. **Expected:** Nothing happens. Ladder remains disabled. No intervention recorded.
5. Click "Continue" to advance through immersion
6. **Expected:** Warmup questions advance. After last immersion tick, transition message appears.
7. After transition, press `A`
8. **Expected:** Ask intervention fires. Ladder is now active.

## PUX-3: Timer and student state badge removed

1. Start any scenario
2. Look at the status bar area
3. **Expected:** No timer display. No "Normal flight" / "Performance declining" badge. The status bar is minimal or absent.

## PUX-4: Immersion phase renders correctly

1. Start a scenario with immersion ticks (the seed demo scenarios should have them after task 4)
2. **Expected:** First screen shows scene text, student speech, and a warmup question in a distinct callout style
3. **Expected:** Intervention ladder is visible on the right side but all buttons are grayed/disabled
4. Click "Continue"
5. **Expected:** Next immersion tick renders. New scene, new warmup question.
6. Click "Continue" on the last immersion tick
7. **Expected:** Transition message: "You are now instructing." Ladder activates (buttons gain color, keyboard works).
8. **Expected:** First scored tick renders normally.

## PUX-5: Scenario without immersion ticks works normally

1. Navigate to a scenario that has NO immersion ticks (e.g., if a non-seed scenario exists)
2. Click "Begin Flight"
3. **Expected:** Goes directly to the first scored tick. No immersion phase. No "Continue" button. Ladder active immediately.

## PUX-6: Briefing page shows SituationCard with structured data

1. Navigate to Course, click a scenario that has structured briefing data (seed demo scenarios)
2. **Expected:** Briefing page shows the SituationCard with:
   - Airport diagram (SVG with runway at correct heading)
   - Wind arrow
   - Weather data grid (wind, ceiling, visibility, temp, DA)
   - Student profile (hours, certificate, aircraft, notes)
3. **Expected:** Button text is "Begin Flight" (not "Call the Ball")

## PUX-7: Briefing page falls back to text

1. Navigate to a scenario that only has `briefing: string` (no structured data)
2. **Expected:** Briefing page shows the text in a simple card. No airport diagram. No data grid.
3. **Expected:** Button text is still "Begin Flight"

## PUX-8: Tutorial overlay appears on first visit

1. Clear `firc_tutorial_seen` from localStorage
2. Navigate to a scenario and click "Begin Flight"
3. **Expected:** Tutorial overlay appears immediately. Background is dimmed. One element is highlighted.
4. **Expected:** Step 1 highlights the situation panel with explanation text
5. Click "Next"
6. **Expected:** Step 2 highlights the student panel
7. Click "Next"
8. **Expected:** Step 3 highlights the intervention ladder with explanation
9. Follow the action prompt (e.g., "Try clicking Ask")
10. **Expected:** The Ask intervention fires. Tutorial advances.
11. **Expected:** Final step confirms, overlay disappears, scenario continues normally.

## PUX-9: Tutorial does not appear on second visit

1. After completing PUX-8, navigate to another scenario
2. Click "Begin Flight"
3. **Expected:** No tutorial overlay. Goes directly to immersion or scored ticks.

## PUX-10: Tutorial can be re-triggered from Settings

1. Navigate to Settings
2. Find "Review Tutorial" option
3. Click it
4. **Expected:** Confirmation that tutorial will show on next scenario
5. Navigate to a scenario and click "Begin Flight"
6. **Expected:** Tutorial overlay appears again

## PUX-11: Tutorial can be dismissed

1. Clear `firc_tutorial_seen` from localStorage
2. Start a scenario
3. **Expected:** Tutorial overlay appears
4. Click "Skip Tutorial" (or dismiss X)
5. **Expected:** Overlay disappears. Scenario continues. Tutorial is marked as seen (won't reappear).

## PUX-12: Mobile -- no keyboard shortcuts

1. Open the sim on a mobile viewport (or resize browser to < 768px)
2. Start a scenario
3. **Expected:** No keyboard shortcut hints shown on ladder buttons
4. **Expected:** Tapping ladder buttons works normally
5. **Expected:** No JS errors from keyboard listener

## PUX-13: Intervention ladder shows shortcut hints on desktop

1. On desktop viewport, start a scenario
2. Look at the intervention ladder buttons
3. **Expected:** Each button shows a shortcut hint: `[A]` Ask, `[P]` Prompt, `[C]` Coach, `[D]` Direct, `[T]` Take Controls
4. **Expected:** Hints are small, subtle, and don't interfere with the label or description text
