---
name: Avionics Trainer
id: prd:prof:avionics-trainer
tagline: Learn the workflow, not the button positions
status: idea
priority: 1
prd_depth: full
category: proficiency
platform_mode:
  - daily-desk
  - pre-flight
audience:
  - student-pilot
  - private-pilot
  - instrument-pilot
  - cfi
  - returning-pilot
complexity: high
personal_need: 5
depends_on: []
surfaces:
  - web
content_reuse:
  - approach-plates
  - avionics-workflows
last_worked: null
---

# Avionics Trainer

## What it does

Browser-based schematic avionics trainer. Not a pixel-perfect G1000 clone -- a stylized, non-trademarked representation that teaches the WORKFLOW of modern integrated flight decks. "Load the RNAV 24, vectors to TIPRE" -> tap through the sequence -> wrong paths annotated with why. The sequences transfer across avionics boxes because the mental model is what matters, not specific button locations.

## What it looks like

A schematic panel with labeled buttons and knobs in approximately-real positions. Clean, diagrammatic -- not photorealistic. A scenario banner gives the task. User taps controls in sequence. Correct taps advance the workflow. Wrong taps show an annotation explaining why that's not the right next step and what it would have done. A workflow tracker on the side shows progress through the sequence.

Key screens:

- **Trainer panel** -- schematic avionics display with interactive controls, scenario task banner, workflow progress indicator
- **Workflow library** -- browse available tasks by category (approaches, flight plans, holds, navaids, MFD)
- **Replay** -- step through a completed attempt, see where you went wrong, compare to correct sequence
- **Progress dashboard** -- workflows mastered, time trends, error patterns by category

## Who it's for

- **Returning pilots (primary)** -- avionics have changed dramatically. A pilot who flew with steam gauges needs to learn glass cockpit workflows from scratch, and rental aircraft don't come with training time.
- **Instrument pilots** -- approach loading, hold entries, procedure turns, missed approach activation. These workflows are complex and infrequently practiced.
- **Student pilots** -- learning avionics workflows before getting in the plane saves expensive flight time.
- **CFIs** -- demonstrating workflows to students, staying current on avionics they teach but don't fly daily.

## Core features

- Schematic avionics panel with interactive buttons, knobs, and soft keys
- Scenario-driven tasks: "Load and activate the ILS 28R," "Enter a hold at FIXXX," "Set up the missed approach"
- Wrong-path annotations explaining what each incorrect action would do
- Workflow sequence tracking with step-by-step progress
- PFD rendering: attitude, airspeed, altitude, CDI/HSI, bearing pointers (schematic, not sim-grade)
- MFD rendering: moving map, flight plan display, terrain awareness (schematic)
- Multiple avionics "families" sharing the same underlying workflow model but with different control layouts
- Time tracking per workflow (speed improves with practice)
- Replay mode for reviewing attempts
- Pre-flight mode: practice the specific approach/procedure you'll fly today

## Technical challenges

- **Avionics state machine is complex.** Even a simplified model has dozens of states, menu hierarchies, and mode interactions. The FPL page alone has sub-menus for waypoint editing, procedure selection, activation, and direct-to. Building this correctly is the core engineering challenge.
- **CDI/HSI rendering.** Even schematic, the course deviation indicator and heading situation indicator need to respond correctly to simulated navigation state. This requires a basic navigation model underneath.
- **IP considerations.** Cannot use Garmin/Avidyne trademarks, trade dress, or distinctive visual elements. Must use own visual style with generic naming. Nominative references ("compatible with G1000-family workflows") are permissible. See avionics strategy in `docs/platform/PRODUCT_BRAINSTORM.md`.
- **Scope creep.** "Just add one more feature" will turn this into a full desktop sim. Strict scoping to WORKFLOWS, not simulation, is essential.
- **Touch targets on mobile.** Avionics panels are dense. Schematic design helps but web-based panel interaction on a phone may not be viable -- web-only initially.

## Audience challenges

- Garmin has its own PC trainer (free download). The pitch is browser-based, no-install, workflow-focused rather than button-memorization. Also: Garmin's trainer is only for Garmin units.
- Pilots may expect photorealistic fidelity and be disappointed by schematic design. Need to frame the schematic approach as a feature ("learn the mental model") not a limitation.
- Each avionics family has different enough workflows that "generic" training may feel too abstract. Need enough specificity to be useful without crossing IP lines.
- CFIs may want to assign specific workflows to students -- needs a sharing/assignment mechanism.

## MVP

- Single avionics family (generic integrated flight deck, G1000-workflow-compatible)
- 5 workflows: load approach, activate approach, direct-to waypoint, enter hold, set up missed approach
- Schematic panel with interactive soft keys, FPL knob, CDI knob, direct-to button
- Wrong-path annotations on every incorrect step
- Workflow completion tracking

## Ideal launch

- Multiple avionics families (integrated flight deck, touchscreen navigator, legacy GPS)
- 20+ workflows covering full IFR operations
- Schematic PFD and MFD with responsive navigation state
- Pre-flight mode: practice today's specific approach
- CFI assignment and student progress tracking
- Replay and error-pattern analysis
- Integration with Spaced Memory Items for avionics-related recall (frequencies, waypoint naming, procedure codes)

## Content dependencies

- Avionics workflow sequences (must be authored from public knowledge, POH supplements, and direct experience -- not copied from manufacturer materials)
- Approach procedure data for realistic scenario setup
- Navigation concepts (CDI behavior, HSI interpretation, GPS vs. VLOC modes)

## Builds on / feeds into

- **Feeds into** [Spaced Memory Items](../spaced-memory-items/) (prd:prof:spaced-memory-items) -- avionics-specific recall items (soft key labels, mode meanings, page sequences)
- **Feeds into** [Decision Reps](../decision-reps/) (prd:prof:decision-reps) -- avionics failure and mode-confusion scenarios as decision reps
- **Receives from** [Route Walkthrough](../../pre-flight/route-walkthrough/) (prd:pre:route-walkthrough) -- practice the specific approach you'll fly today
