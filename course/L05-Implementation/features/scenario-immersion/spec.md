---
title: "Spec: Scenario Immersion"
product: sim
feature: scenario-immersion
type: spec
status: draft
---

# Spec: Scenario Immersion

Redesign the scenario briefing and player to build situational awareness before the crisis develops. Addresses content review violations V5, V6, V7, V12.

## Problem

The current flow is: read briefing paragraph -> hit "Call the Ball" -> make decisions. This has four problems:

1. **No visual context** (V5, R6) -- the briefing is text-only. No airport diagram, no wind arrows, no student profile card.
2. **No warmup** (V6, R5) -- the user is dropped into the crisis cold. No time to build SA.
3. **No intervention definitions** (V7, R3) -- five buttons with labels and no explanations.
4. **Dead-end references** (V12, R9) -- topic and competency badges link nowhere.

## Design

### 1. Situation Card (replaces text-only briefing)

A visual panel shown before and during the scenario:

```text
+--------------------------------------------------+
|  KXYZ Rwy 27        Wind: 210 @ 18G25            |
|  [Airport diagram]   Ceiling: 3500 BKN            |
|   \                  Vis: 7 SM                     |
|    \  <- plane       Temp: 28C / DA: 3200          |
|     \                Time: 16:40L (late afternoon) |
|      ====[27]=====                                 |
|                                                    |
|  Student: 62 hrs, Private candidate                |
|  Aircraft: C172S (G1000)                           |
|  Notes: Confident, 3rd lesson in pattern work      |
+--------------------------------------------------+
```

Data sources: scenario metadata already has airport, wind, student model, duration. This card renders that data visually instead of burying it in a paragraph.

**Implementation:** New `SituationCard.svelte` component in `libs/ui/`. Takes scenario metadata props. The airport diagram is a simplified SVG -- runway with heading, pattern legs, wind arrow, plane position marker. Not a real sectional chart.

### 2. Immersion Approach (new pre-crisis ticks)

Instead of starting at the crisis, the tick script starts 2-3 ticks earlier in normal flight. The purpose is explicitly stated to the user: "You're starting from the downwind entry so you can build your picture before anything happens."

Example for base-to-final scenario:

```text
Tick 0 (new): Entering downwind. ATIS plays. Student reads back.
  -> No intervention needed. CFI warmup question appears.
  -> "What do you notice about the winds relative to the runway?"

Tick 1 (new): Abeam the numbers. Student reduces power.
  -> CFI warmup question: "How does this student's experience
     level affect your scan priorities?"

Tick 2 (existing tick_1): Base turn. Student begins turn to final.
  -> First real decision point.
```

**Implementation:** Add `immersionTicks` to `TickScript` type. These ticks have no `safeWindow` -- they're context-building only. The engine skips scoring for them. Each immersion tick includes a `warmupQuestion` field shown to the user.

```typescript
interface ImmersionTick {
  id: string;
  scene: string;
  studentSpeech: string;
  warmupQuestion: string; // open-ended, no correct answer
}

interface TickScript {
  immersionTicks?: ImmersionTick[]; // played before scored ticks
  ticks: Tick[];
}
```

### 3. Intervention Ladder Sidebar

Always visible during scored ticks. Shows all five levels with definition and example from `INTERVENTION_INFO`:

```text
+---------------------------+
| INTERVENTION LADDER       |
|                           |
| [Ask]                     |
| Open-ended question that  |
| makes the student think.  |
| "What do you notice about |
|  your airspeed right now?"|
|                           |
| [Prompt]                  |
| Focused hint that draws   |
| attention to something.   |
| "Check your bank angle."  |
|                           |
| [Coach]                   |
| ... (collapsed by default)|
| [Direct]                  |
| ...                       |
| [Take Controls]           |
| ...                       |
+---------------------------+
```

**Implementation:** New `InterventionLadder.svelte` in `libs/ui/`. Uses `INTERVENTION_INFO` from constants. Each level is a button + expandable description. Top two expanded by default, rest collapsed. Replaces the current bare button list in `ScenarioPlayer.svelte`.

### 4. Clickable References

Topic and competency badges become links or expandable tooltips:

- **FAA topic badge** ("LOC Prevention (A.11)") -- links to `/glossary?topic=A.11` or shows a tooltip with the topic description from `FAA_TOPIC_REGISTRY[code].faaDescription`.
- **Competency badge** ("Critical Judgment") -- shows tooltip with the competency definition.

**Implementation:** New `TopicBadge.svelte` and `CompetencyBadge.svelte` in `libs/ui/`. These wrap `Badge` with a tooltip or popover showing the definition. Used everywhere badges currently appear (briefing, debrief, progress, free-play cards).

## Data Model Changes

### TickScript extension

```typescript
// libs/types/src/engine-types.ts
interface ImmersionTick {
  id: string;
  scene: string;
  studentSpeech: string;
  warmupQuestion: string;
}

interface TickScript {
  immersionTicks?: ImmersionTick[];
  ticks: Tick[];
}
```

### Scenario metadata extension

Scenario briefing text is replaced by structured metadata:

```typescript
interface ScenarioBriefing {
  setting: string; // "Non-towered airport, afternoon"
  airport?: string; // "KXYZ"
  runwayHeading?: number; // 270
  wind?: string; // "210 at 18 gusting 25"
  ceiling?: string; // "3500 BKN"
  visibility?: string; // "7 SM"
  temperature?: string; // "28C"
  densityAltitude?: number; // 3200
  timeOfDay?: string; // "16:40 local"
  studentHours?: number; // 62
  studentCertificate?: string; // "Private candidate"
  aircraft?: string; // "C172S (G1000)"
  studentNotes?: string; // "Confident, 3rd lesson in pattern work"
}
```

This is additive -- old `briefing: string` still works. New scenarios can use structured data for the situation card.

## Phases

1. **InterventionLadder component** -- replace bare buttons with definitions. Smallest lift, biggest immediate impact.
2. **TopicBadge / CompetencyBadge** -- clickable references everywhere.
3. **SituationCard component** -- visual briefing panel.
4. **Immersion ticks** -- engine + tick script changes for pre-crisis warmup.
5. **Structured briefing migration** -- convert existing scenarios to structured metadata.

## Design Principles Applied

- **R3:** Intervention ladder defined on screen.
- **R5:** Context built before crisis.
- **R6:** Visual situation card replaces text.
- **R9:** Clickable references go somewhere useful.
- **Decisions Under Pressure (#3):** Immersion ticks activate judgment before the first decision point.
- **Never a Trick (#4):** Warmup questions have no correct answer -- they prime thinking, not test knowledge.
