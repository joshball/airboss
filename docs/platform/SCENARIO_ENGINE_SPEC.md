# Scenario Engine Specification

> **Scope note (2026-04-26):** This spec describes the FIRC instructor-intervention engine -- pilot observes a student model, intervenes via Ask / Prompt / Coach / Direct / Take Controls. It's the engine that lives in `airboss-firc/libs/engine/` and migrates to `airboss/libs/engine/` when `apps/firc/` lands per [MULTI_PRODUCT_ARCHITECTURE.md](MULTI_PRODUCT_ARCHITECTURE.md).
>
> The flight-dynamics engine in `apps/sim/` (post-pivot, hand-rolled C172 FDM) reuses the tick / world-state / scoring concepts but has different decision affordances (control inputs, configuration, divert/continue). See [docs/work-packages/flight-dynamics-sim/spec.md](../work-packages/flight-dynamics-sim/spec.md) and [ADR 015](../decisions/015-sim-surface-loose-coupling.md) for the sim engine.
>
> The rest of this doc retains FIRC-era framing (CFI / FAA / instructor) for accuracy of the engine it describes.

## Core Design Goal

The engine adapts difficulty, context, and reinforcement without changing the compliance skeleton. Every learner still covers all required core topics, but scenarios, airports, aircraft, emphasis, and review spacing all adapt.

## The Tick Engine

### Concept

Each second (or half-second) is a "tick." The engine is a time-based instructional judgment simulator:

- Perceive weak signals
- Decide whether to wait, coach, or take over
- Shape student thinking early
- Debrief the chain, not just the outcome

### World State (per tick)

```typescript
type WorldState = {
  time: number;
  aircraft: AircraftState;
  student: StudentState;
  environment: EnvironmentState;
  cuesVisible: Cue[];
  hiddenRisks: Risk[];
};
```

Each tick updates:

- Aircraft state (instruments, position, energy, configuration)
- Student internal state (confusion, compliance, workload, attention)
- Environment state (weather, traffic, lighting)
- Visible cues (what the instructor can observe)
- Hidden risks (what hasn't manifested yet)

### Instructor Actions

The instructor can: continue, pause, rewind (in replay), act, or annotate.

**Standard intervention families** (same everywhere so the menu doesn't give away the problem):

| Level             | Action Family         | Examples                                                                                   |
| ----------------- | --------------------- | ------------------------------------------------------------------------------------------ |
| **Ask**           | Information gathering | "What is your airspeed?" / "Talk me through what you see." / "What's your plan from here?" |
| **Prompt**        | Directed correction   | "Correct to target speed." / "Reduce bank." / "Go around."                                 |
| **Coach**         | Guided instruction    | "Pitch for speed." / "Add power smoothly." / "Roll wings level first."                     |
| **Direct**        | Explicit command      | "I want you to do X now."                                                                  |
| **Take Controls** | Positive exchange     | Three-step verbal handoff procedure                                                        |

Actions have:

- Timing (when in the scenario)
- Tone (calm, urgent)
- Specificity (general vs targeted)
- Instructional level (ask/prompt/coach/direct/take)

### Student Behavior Model

Students are NOT scripted puppets. Each student has:

| Parameter                          | Description                            |
| ---------------------------------- | -------------------------------------- |
| `skillLevel`                       | Overall flying competence              |
| `complianceTendency`               | How likely to follow instructions      |
| `communicationQuality`             | Accuracy of verbal reports             |
| `freezeTendency`                   | Likelihood of freezing under stress    |
| `overconfidenceTendency`           | Likelihood of dismissing problems      |
| `instrumentInterpretationAccuracy` | Can they read instruments correctly?   |
| `startleDelay`                     | Recovery time from surprise            |
| `fatigueModifier`                  | Degradation from tiredness/distraction |

Student response depends on:

- Skill level
- Current confusion state
- Compliance tendency
- Workload saturation
- Prior instructor wording (cumulative effect)

**Key behaviors:**

- One student says the right thing but does the wrong thing
- Another freezes
- Another chases altitude
- Another overbanks to save the overshoot
- Another complies perfectly (baseline comparison)

### Randomness and Variation

Same scenario template, different seeds -> different student behaviors. This prevents memorization exploits and creates replay value.

---

## Scenario Loop

### 1. Pre-Brief (Context Setup)

Before the run, the user gets:

- Aircraft type and configuration
- Flap policy and target speeds
- W&B and CG condition
- Runway and pattern direction
- Wind and crosswind
- Lighting and night factors
- Traffic pattern congestion
- Student profile (experience, recent history, fatigue cues)
- Mission context

This is important: the FAA explicitly expects instructors to build context before instruction. Pre-brief is part of the learning.

Allow time to study. All speeds, flap settings, fuel, weather, familiarity, traffic. It takes a few minutes to get into context. They deserve that.

### 2. Reference Pass (Golden Run)

Show one clean execution first:

- A clean pattern
- Correct speeds
- Stable base
- Proper turn to final
- Good scan discipline

This gives the instructor a mental model before the problem run. It also allows reuse of the same airport/aircraft package across many scenarios.

The user can pause, check instruments, interact with the reference pass.

### 3. Live Run (The Core)

Each tick:

1. World state updates
2. Student state updates
3. Instructor can observe or intervene
4. Student responds to intervention (or doesn't)
5. Outcome branches based on combined state

**Time dilation:** Give ~5 seconds of real time per tick for the CFI to think. It is harder without visual references, peripheral cues, etc.

### 4. Student Response

The student reacts based on their model:

- May comply immediately
- May comply with delay
- May say the right thing but do wrong
- May freeze
- May do something unexpected
- May overreact

### 5. Outcome Branch

Based on cumulative state:

- Safe resolution (good intervention, student learns)
- Near-miss (late intervention but recoverable)
- Incident (CFI takes controls, debrief needed)
- Accident (failure to intervene -- learning moment)

### 6. Debrief

NOT "wrong/right" but:

- "What did you notice?"
- "When did you intervene?"
- "What safer path existed?"
- What you did vs what you missed vs what FAA expects

**Debrief components:**

- Instructor Playback (your actions on timeline)
- Performance Breakdown (SA %, intervention timing, automation management)
- FAA Guidance (show actual FAA content -- now it matters because there's context)
- Improvement Suggestions

### 7. Replay with Variation

Not just "retry" but:

- Retry with different student personality
- Retry focusing on missed cues
- Retry with less time pressure
- Retry with additional complications

---

## Main Entities

```typescript
type LearnerProfile = {
  certificates: string[];
  ratings: string[];
  aircraftFlown: string[];
  preferredAirports: string[];
  goals: string[];
  interests: string[];
  selfReportedConfidence: Record<string, number>;
  discoveryResponses: DiscoveryResponse[];
};

type Competency = {
  id: string; // e.g., "CJ-1", "AC-2"
  faaTopic: string; // e.g., "A.11 LOC"
  skill: string; // human-readable skill name
  measurableBehaviors: string[];
  required: boolean;
};

type MasteryState = {
  competencyId: string;
  knowledgeScore: number;
  judgmentScore: number;
  interventionScore: number;
  recency: string; // ISO date
  stability: number; // consistency across attempts
  failureModesSeen: string[];
};

type ScenarioTemplate = {
  id: string; // e.g., "SCN-LOC-01"
  faaTopics: string[];
  competencies: string[];
  environmentSlots: string[]; // configurable: airport, weather, time
  studentModelId: string;
  briefingPackageId: string;
  tickScriptId: string;
  assessmentPlanId: string;
};

type ScenarioRun = {
  scenarioId: string;
  seed: string; // randomization seed
  learnerActions: Action[];
  observedStates: Snapshot[];
  outcome: Outcome;
  evidence: EvidencePacket;
};
```

---

## Scoring Model

Not just "correct answer." Score these separately:

| Dimension                           | What It Measures                            |
| ----------------------------------- | ------------------------------------------- |
| **Cue Detection**                   | Did they notice the problem? When?          |
| **Timing of Intervention**          | Too early, too late, just right             |
| **Appropriateness of Intervention** | Right level (ask/prompt/coach/direct/take)? |
| **Instructional Quality**           | Was the coaching effective?                 |
| **Safety Margin Preserved**         | How much margin remained?                   |
| **Debrief Quality**                 | Root cause vs symptom? Chain explained?     |
| **Replay Improvement**              | Did they get better on retry?               |

---

## Spaced Repetition Integration

Every competency gets a review state.

**Trigger more review when:**

- Missed cue
- Late intervention
- Unsafe choice
- Shallow debrief
- Low confidence

**Review objects:**

- 20-second recall prompts
- 60-second mini decision branches
- Short "what do you notice?" films
- Compare-two-approaches tasks

**Reappearance logic:**

- Weak areas -> show more often
- Strong areas -> spaced out
- Difficulty scales with mastery

---

## Evidence Packet

Every run emits:

```typescript
type EvidencePacket = {
  topicsCovered: string[];
  competenciesExercised: string[];
  timeSpent: number;
  actionsTaken: Action[];
  scoreDimensions: Record<string, number>;
  remediationAssigned: string[];
  replayDelta: number | null; // improvement from last attempt
};
```

This becomes the auditable record for the FAA-facing side.

---

## Discovery Phase

At course start:

1. **Low-pressure knowledge probes** (hidden calibration, no pass/fail)
2. **Confidence questions** ("How confident are you teaching GPS approaches?")
3. **Interest probes** (areas to improve, aircraft, airports)
4. **Free-text reflection** ("Tell us about a scary moment")
5. **Preferred airport/aircraft selection**

**Outputs:**

- Initial mastery estimate per competency
- Interest tags
- Recommended scenario priorities
- Personalized elective suggestions

---

## Scheduling Algorithm

**Hard rule:** All required FAA topics must be completed within the approved program structure.

**Soft rule:** Order and emphasis can adapt.

**Logic:**

1. Weak required competencies first
2. Personalize airport/aircraft context where possible
3. Insert spaced repetition after misses
4. Use electives to reward curiosity
5. Ensure each core topic accumulates >= ~45 min

---

## Curriculum Guardrails

Even with personalization:

- Must still cover all FAA topics
- Must still hit time requirements per topic
- Must still pass assessment thresholds

Think: "adaptive inside constraints"

---

## Example: Base-to-Final Stall Scenario

### Pre-Brief

- C172, night, after long XC
- Student tired, hungry, has a cold
- KAPA, Runway 17L, winds 190/12G18
- Traffic pattern congestion moderate
- Target speeds documented, W&B computed

### Reference Pass

Watch a perfect pattern: clean takeoff, crosswind, downwind, base, final, full stop. See it on the six pack. Pause, check things.

### Live Run (abbreviated tick sequence)

```text
Tick 4: Airspeed reading: 71 (target 76). Bank: 15 deg. Student quiet.
Tick 5: Airspeed: 69. Student hasn't noticed.
Tick 6: Student says "everything looks good"
  -> CFI option: Ask "What's your airspeed?" / Prompt "Check your airspeed" / Continue
Tick 7: If asked, student: "76 knots... wait, 67?"
Tick 8: Speed now 65 (10 over stall). Student says "I'll pull up"
  -> CFI option: Coach "pulling up will slow you further" / Direct pitch+power
Tick 10: Student pushes down, adds throttle. Speed recovering.
Tick 14: Student overshoots final turn, entering 60-deg bank, pulling hard
Tick 15: -> CFI must act: Coach go-around? Take controls?
```

### What This Teaches

- Build the right context before flight
- Detect weak signals early (airspeed trend at tick 4-5)
- Keep student cognitively engaged
- Choose least invasive effective intervention
- Rescue safely when needed
- Debrief causes, not just symptoms

### What This Proves to the FAA (One Scenario, Multiple Topics)

- LOC instruction (A.11)
- Effective teaching (A.4)
- Safety culture (A.4)
- Current safety trends (A.5)
- Pilot deviations (A.6)
- ACS-based training (A.12)
- Ethics/professionalism (A.10, with pressure variant)

---

## Critical Design Rules

1. **Never let the scenario feel like a trick.** Reward noticing earlier, asking better, coaching earlier, salvaging safer, debriefing honestly.
2. **Same intervention menu everywhere.** Don't give away the problem through available options.
3. **Golden run + problem run + replay with variation.** The antidote to memorization.
4. **Failure is required.** Design scenarios that are hard to "pass." Punish overconfidence. This is where learning happens.
5. **5-second think time per tick.** It's harder without visual references.
6. **Student diversity creates replay value.** Same scenario, different student personality = different challenge.
