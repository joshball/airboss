# Instrument Scan Exercise

A continuous real-time activity type where the CFI monitors animated flight instruments while performing instructor tasks. Designed to demonstrate inattentional blindness, train scan discipline, and reinforce intervention ladder usage -- all through the same UI used in tick-engine scenarios.

**Status:** Design
**Module:** 1 (primary), 3 and 5 (variants)
**Dependencies:** Engine panel mode, intervention ladder UI, debrief replay

---

## Core Concept

The learner watches a six-pack (or G1000) instrument panel animate in real time. A student scan model highlights which instruments the student is looking at. The learner is given an instructor task that consumes attention (evaluate the scan, monitor altitude, count something). While task-loaded, a critical parameter degrades -- plainly visible, on instruments they're staring at.

The learner has the full intervention ladder available at all times. They CAN catch it. The exercise isn't rigged. It's cognitively loaded.

**The key constraint:** The UI must be identical to every other scenario type. Same intervention ladder, same note-taking keys, same layout. If the instrument scan exercise looks different, the learner knows something unusual is happening and the effect breaks.

---

## Screen Layout

```text
+------------------------------------------+---------------------+
|                                          |   ACTIVITY LOG      |
|          INSTRUMENT PANEL                |                     |
|                                          |  12:03 Noted: ASI   |
|     [ASI]    [ATT]    [ALT]             |  12:05 Noted: HI    |
|                                          |  12:08 Ask: "check  |
|     [TC]     [HI]     [VSI]             |    your airspeed"   |
|                                          |  12:10 Noted: ALT   |
|     (student scan highlights glow        |                     |
|      around instrument being scanned)    |                     |
|                                          |                     |
+------------------------------------------+---------------------+
|  NOTE: [1]ASI [2]ATT [3]ALT [4]TC [5]HI [6]VSI              |
|  ACT:  [A]sk  [P]rompt  [C]oach  [D]irect  [T]ake Controls  |
+--------------------------------------------------------------+
```

This is the standard scenario layout with a panel in the situation area and the intervention ladder in the action bar. Every scenario type uses this same action bar. The instrument panel replaces the situation card / narrative text area.

---

## Interaction Model

### Continuous Input

Unlike tick-engine scenarios (discrete decision points), instrument scan exercises accept input at any moment. Inputs are timestamped and logged.

**Note keys (1-6):** Tag which instrument you're paying attention to or concerned about. Creates a timestamped entry in the activity log. No prompt, no interruption. Just a tap. This builds a record of what the learner was tracking.

- `1` = Airspeed Indicator
- `2` = Attitude Indicator
- `3` = Altimeter
- `4` = Turn Coordinator
- `5` = Heading Indicator
- `6` = Vertical Speed Indicator

**Intervention keys (A/P/C/D):** Open a brief inline prompt, then return to the exercise. The instruments keep moving. Time doesn't stop.

- `A` (Ask) -> "What do you want to ask your student?" -> short free text or quick-pick
- `P` (Prompt) -> "What do you want to draw attention to?" -> quick-pick from instrument list
- `C` (Coach) -> "What guidance do you want to give?" -> quick-pick: "check [instrument]", "watch your [parameter]", "let's talk about [topic]"
- `D` (Direct) -> "What instruction?" -> quick-pick: "add power", "lower the nose", "level the wings", "turn to heading [X]"

**Student response model:** The simulated student responds to interventions based on their behavior profile (responsiveness, compliance, skill level). If you Ask about airspeed at 95 knots, a responsive student checks and corrects. A low-responsiveness student says "looks fine to me" and you have to escalate.

**Take Controls (T):** Last resort. Triggers the diagnostic capture flow (see below). The exercise pauses. This should feel like a significant action -- the UI should reflect weight (confirmation step, instruments freeze, modal shift).

### Time Pressure

The exercise runs for a fixed duration (60-120 seconds depending on scenario). The learner cannot pause. Instruments keep moving during Ask/Prompt/Coach/Direct interactions (only the prompt overlay appears -- the panel stays visible behind it). Only Take Controls stops the clock.

This is deliberate. Real cockpits don't pause while you think about what to say.

---

## The Take-Controls Diagnostic Flow

When the learner presses T, the exercise pauses and the instruments disappear. This is critical -- we capture what they know BEFORE showing them the answer.

### Step 1: Why?

```text
Why are you taking controls?

[ ] Safety concern -- something is becoming unsafe
[ ] Student overwhelmed -- they need a break
[ ] Need to demonstrate -- show them something
[ ] Exercise feels wrong -- something I can't identify
[ ] Other: [free text]
```

### Step 2: Branch by reason

**If "Safety concern":**

```text
What parameter concerned you?

[ ] Airspeed      [ ] Altitude
[ ] Heading       [ ] Bank angle
[ ] Pitch         [ ] Engine
[ ] Other: [free text]
```

Then:

```text
What was the approximate value when you noticed?
[slider or text input]

What was the trend?
[ ] Increasing    [ ] Decreasing
[ ] Oscillating   [ ] I didn't notice the trend
```

**If "Student overwhelmed":**

```text
What made you think the student was overwhelmed?

[ ] Scan stopped or froze
[ ] Responses became delayed
[ ] Corrections became erratic
[ ] They asked for help
[ ] Other: [free text]
```

**If "Exercise feels wrong":**

```text
Describe what you noticed:
[free text -- we NLP-parse this for keywords]
```

**If "Other":**

```text
Describe why you took controls:
[free text -- required, minimum 20 characters]
```

### Step 3: Confidence

```text
How confident are you in your reason?

[ ] Very -- I know exactly what was wrong
[ ] Somewhat -- I sensed something but I'm not sure
[ ] Low -- gut feeling, can't explain it
```

### Why the instruments disappear

This prevents the learner from looking at the frozen panel to construct a post-hoc explanation. We want what they were actually thinking, not what they can figure out from a still frame. The diagnostic captures genuine awareness.

---

## The Reveal and Debrief

After the exercise ends (either by timeout or take-controls), the reveal sequence plays.

### If they caught it (intervened on the correct parameter)

```text
"You noticed the airspeed decay at [time] and [asked/coached/directed]
your student at [airspeed value]. Your student was [X] knots above Vs1.

[Replay with their intervention point marked on the timeline]

Most CFIs in this exercise don't catch it until much later -- or at all.
You were scanning the instruments, not just evaluating the scan.
That's exactly the awareness we're building in this course."
```

Reward. Specific. Shows them what they did right and when.

### If they missed it (timeout, no intervention on the correct parameter)

```text
"Before the replay -- you identified that your student was skipping
[instrument]. That's correct.

While you were evaluating the scan, here's what happened to the
airspeed:"

[Replay with airspeed decay highlighted, their note timestamps overlaid]

"The airspeed decayed from 110 to [final value] over [duration].
It was visible on the ASI the entire time -- an instrument you
were watching.

This is inattentional blindness. Your attention was on the task
(evaluating the scan), and the instruments became background.

87% of CFIs in this exercise miss it the first time.

This is not a failure. This is how human attention works. Your
students experience this every flight -- especially in glass
cockpits with ten times more information competing for attention.

That's what Module 1 is about."
```

No score. No grade. A demonstration. The Greenie Board percentage normalizes it.

### If they took controls for the wrong reason

```text
"You took controls because [their stated reason]. Let's look at
what was actually happening:"

[Replay]

"The exercise was designed to test whether you'd notice the
airspeed decay while focused on a different task. You noticed
something was off -- that instinct is valuable -- but the
specific concern was [their stated concern], which was actually
[stable/normal]."
```

Still no shame. They sensed something, which is better than nothing.

---

## Script Format

Scenarios are authored as structured documents with instrument curves, student behavior, and task definition. The engine interpolates between keyframes.

### Example Script: ISE-1.1 (Airspeed Decay During Scan Evaluation)

```yaml
id: ISE-1.1
title: Instrument Scan Evaluation
module: 1
duration: 90s
tick_interval: 1s
difficulty: 0.5
panel_type: six_pack

# What the learner is told
task:
  instruction: >
    Your student is on a VFR cross-country at 4,500 feet.
    Watch their instrument scan and identify which instruments
    they're consistently skipping. Note instruments as you
    observe the pattern.
  success_criteria: "Identify the skipped instruments"

# Instrument initial state and curves
instruments:
  airspeed:
    initial: 110
    unit: knots
    keyframes:
      - { time: 0s,  value: 110 }
      - { time: 10s, value: 108 }  # normal fluctuation
      - { time: 30s, value: 102 }  # subtle decay begins
      - { time: 50s, value: 95  }  # should be noticeable
      - { time: 70s, value: 89  }  # approaching concern
      - { time: 90s, value: 84  }  # near Vs1
    noise: 1.5  # +/- random fluctuation in knots
    thresholds:
      caution: 95
      warning: 90
      critical: 85  # Vs1 + 5

  attitude:
    initial: { pitch: 2, bank: 0 }
    keyframes:
      - { time: 0s,  pitch: 2,  bank: 0 }
      - { time: 20s, pitch: 3,  bank: 0 }  # subtle nose-up
      - { time: 50s, pitch: 4,  bank: 0 }
      - { time: 90s, pitch: 5,  bank: 0 }
    noise: 0.5

  altimeter:
    initial: 4500
    keyframes:
      - { time: 0s,  value: 4500 }
      - { time: 45s, value: 4480 }
      - { time: 90s, value: 4450 }  # slight descent, consistent with nose-up + decaying speed
    noise: 10

  heading:
    initial: 270
    keyframes:
      - { time: 0s,  value: 270 }
      - { time: 90s, value: 272 }  # essentially stable
    noise: 2

  turn_coordinator:
    initial: coordinated
    keyframes:
      - { time: 0s,  value: 0 }
      - { time: 90s, value: 0 }
    noise: 0.3

  vsi:
    initial: 0
    follows: altitude  # derived from altimeter rate of change
    noise: 25

# Student scan behavior (which instruments get highlighted)
student_scan:
  pattern: [attitude, heading, altimeter, attitude, heading, altimeter]
  skips: [airspeed, vsi]  # the correct answer to the task
  interval: 2.5s
  variation: 0.5s  # +/- randomness in scan timing

# Student behavior model
student:
  responsiveness: 0.6
  compliance: 0.7
  verbal_cues: false  # student doesn't volunteer observations
  responses:
    ask_airspeed:
      above_95: "Looks about right to me."
      below_95: "Umm... maybe a little low?"
      below_90: "Oh, I didn't notice that."
    ask_heading: "Two-seven-zero, same as our course."
    ask_altitude: "Forty-five hundred, right where we should be."
    prompt_airspeed:
      above_95: "Hmm, let me check... [looks at ASI]... seems okay."
      below_95: "[looks at ASI]... oh, you're right. Adding power."
    coach_airspeed: "Got it. [adds power, airspeed begins recovering]"
    direct_add_power: "[adds power immediately, airspeed recovers]"

# What the gorilla is (for scoring/analytics)
gorilla:
  parameter: airspeed
  detection_window: { start: 30s, end: 90s }
  ideal_intervention: { time: 50s, type: ask }
  late_intervention: { time: 70s, type: coach_or_direct }
  critical: { time: 85s, type: take_controls }
```

### Difficulty Levers

Each scenario can be tuned across these dimensions:

| Lever | Easy | Medium | Hard |
| --- | --- | --- | --- |
| **Decay rate** | 2 kts/10s (obvious) | 1 kt/10s (gradual) | 0.5 kt/10s (glacial) |
| **Student verbal cues** | "Is my airspeed OK?" at 98 kts | None | Student says "everything's fine" at 92 kts |
| **Student responsiveness** | 0.9 (immediately corrects when asked) | 0.6 (needs prompting) | 0.3 (dismissive, needs directing) |
| **Task complexity** | "Watch the scan" (one job) | "Evaluate scan + note timing" (two jobs) | "Evaluate scan + plan next lesson segment + note timing" (three jobs) |
| **Distractors** | None | Radio calls in background | Radio calls requiring response + turbulence bumps |
| **Duration** | 60s (less time to decay) | 90s | 120s (very slow, very subtle) |
| **Number of gorillas** | 1 | 1 | 2 (airspeed + heading drift) |

---

## Engine Requirements: Panel Mode

The existing tick engine handles discrete decision points. Panel mode adds continuous instrument animation with real-time input.

### What Panel Mode Adds

| Capability | Tick Engine | Panel Mode |
| --- | --- | --- |
| Time model | Discrete ticks | Continuous (1s tick, visual interpolation) |
| Input timing | Per-tick choice | Any time (timestamped) |
| Visual | Situation card + text | Animated instrument panel |
| Student model | State machine per tick | Continuous scan + response model |
| Scoring | Per-tick intervention score | Timeline-based detection + intervention analysis |

### Panel Mode Architecture

```text
ScenarioScript (YAML)
    |
    v
PanelEngine
    |-- InstrumentState (current values, interpolated from keyframes)
    |-- StudentScanModel (current highlight, timing jitter)
    |-- StudentResponseModel (how student reacts to interventions)
    |-- InputBuffer (timestamped learner actions)
    |-- ThresholdMonitor (caution/warning/critical triggers)
    |-- TimelineRecorder (full replay data)
    |
    v
PanelRenderer (six-pack or G1000 component)
    |-- InstrumentFace (per-instrument SVG/canvas)
    |-- ScanHighlight (glow effect on scanned instrument)
    |-- ActionBar (same as tick engine -- note keys + intervention ladder)
    |-- ActivityLog (timestamped entries)
```

### Pure Computation

Like the tick engine, PanelEngine is pure computation in `libs/engine/`. It takes a script + input stream and produces state + timeline. No DOM, no Svelte, no side effects. The renderer is a thin Svelte component in `libs/ui/` that reads engine state.

```typescript
// libs/engine/src/panel/types.ts

interface PanelScenario {
  id: string;
  duration: number;          // seconds
  tickInterval: number;      // seconds
  panelType: 'six_pack' | 'g1000';
  task: TaskDefinition;
  instruments: InstrumentCurves;
  studentScan: ScanPattern;
  student: StudentBehavior;
  gorilla: GorillaDefinition;
}

interface PanelTick {
  time: number;
  instruments: InstrumentReadings;
  studentScanTarget: InstrumentId | null;
  pendingStudentResponse: string | null;
}

interface LearnerInput {
  time: number;
  type: 'note' | 'ask' | 'prompt' | 'coach' | 'direct' | 'take_controls';
  target?: InstrumentId;
  freeText?: string;
}

interface PanelTimeline {
  ticks: PanelTick[];
  inputs: LearnerInput[];
  gorillaDetected: boolean;
  detectionTime: number | null;
  detectionMethod: 'note' | 'ask' | 'prompt' | 'coach' | 'direct' | 'take_controls' | null;
}
```

### Six-Pack Rendering

The six-pack is an SVG component with six instrument faces. Each face:

- Reads from `InstrumentReadings` at render time
- Animates smoothly (CSS transitions or requestAnimationFrame)
- Supports a glow/highlight state (student scan indicator)
- Does NOT change appearance based on threshold crossings (no red borders, no warnings -- that would give away the gorilla)

The instruments must look normal. A real cockpit doesn't highlight the airspeed indicator when it gets low. The learner's scan is the only warning system.

### G1000 Rendering (Future)

Same engine, different renderer. The G1000 PFD is a single integrated display with:

- Airspeed tape (left)
- Attitude indicator (center)
- Altitude tape (right)
- HSI (bottom center)
- Engine instruments (MFD page, separate screen area)

The G1000 variants test different inattentional blindness patterns -- information is dense, everything is visible, but the scan pattern changes completely from steam gauges.

**Not in scope for initial implementation.** The panel engine should be panel-type-agnostic. Rendering is the only difference.

---

## Scoring and Analytics

Instrument scan exercises are **not graded** in the traditional sense. They produce insight data, not scores.

### What We Capture

| Data Point | Purpose |
| --- | --- |
| Note timestamps + targets | What they were paying attention to |
| Intervention timestamps + types | When and how they acted |
| Gorilla detection (yes/no) | Did they catch it |
| Detection time | How early |
| Detection method | Note, ask, coach, direct, or take-controls |
| Take-controls diagnostic | What they thought was wrong |
| Free text responses | NLP analysis for keywords |
| Task completion | Did they correctly identify the scan skip |

### What We Report

To the learner:

- Whether they caught the gorilla (and when)
- Replay with their actions overlaid
- Aggregate data ("87% miss this the first time")
- No numeric score

To the system (for adaptive behavior):

- Scan awareness index (how quickly they detect parameter changes)
- Attention distribution (which instruments they note most/least)
- Intervention ladder usage (do they escalate appropriately)
- These feed into competency scores for AV-1, AV-2, AV-3

### Keyword Analysis for Free Text

When the learner enters free text (take-controls "other" or post-exercise reflection), scan for:

**Airspeed-related:** stall, airspeed, slow, speed, knots, power, Vs, Vs1, Vso, energy, drag
**Altitude-related:** altitude, descending, descent, feet, climbing, sink
**Heading-related:** heading, course, drift, turn, track, off-course
**Attitude-related:** pitch, bank, nose, wings, level, attitude
**General awareness:** something wrong, feels off, not right, uncomfortable

Map matches to the gorilla parameter. If they mention the right family, credit partial awareness even if they couldn't articulate it precisely.

---

## Relationship to Tick Engine Scenarios

The intervention ladder (Ask -> Prompt -> Coach -> Direct -> Take Controls) is the same. The action bar is the same. The debrief structure is the same. The only differences:

1. **Time model** -- continuous vs discrete
2. **Visual** -- animated instruments vs situation card
3. **Input** -- any-time vs per-tick

From the learner's perspective, an instrument scan exercise should feel like "a scenario where I'm watching instruments" -- not a different kind of activity. This is essential for the gorilla effect and for UI consistency.

### Sequencing with Tick Scenarios

Instrument scan exercises should be interspersed with tick-engine scenarios, not grouped separately. If all the scan exercises are together, the learner expects a "scan exercise" and is primed to watch for problems. Placed between tick scenarios, they feel like another scenario with a different view.

---

## What This Feature Does NOT Include

- **Instrument failure simulation** (partial panel) -- that's a different feature. Scan exercises have working instruments; the failure is attentional, not mechanical.
- **Full flight simulation** -- we're not building a flight sim. The panel shows instruments; it doesn't simulate aerodynamics. Instrument values follow authored keyframe curves.
- **Voice interaction** -- student responses are text. Voice is a future enhancement.
- **Multi-panel views** -- one panel at a time. No split-screen instrument + map. G1000 MFD is a future variant.
