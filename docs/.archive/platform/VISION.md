# Archived: FIRC Boss Product Vision (2026-04-26)

> **Archived 2026-04-26.** Superseded by [PIVOT.md](../../platform/PIVOT.md) (2026-04-14) and [docs/platform/VISION.md](../../platform/VISION.md) (the post-pivot replacement). FIRC is no longer the headline product; airboss is a pilot performance and rehearsal platform with FIRC as one possible content module if a partner instructor adopts it.
>
> The tick engine, scenario model, intervention ladder, student behavior simulation, and emotional-safety design described below all transfer to the new framing. The "two systems, layered" / FAA-wrapper concept does NOT survive the pivot.
>
> **Current source of truth:** [docs/platform/VISION.md](../../platform/VISION.md), [docs/platform/PIVOT.md](../../platform/PIVOT.md), [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md).
>
> Kept for historical context only.

---

## Original document

The pre-pivot vision for FIRC Boss as a scenario-based decision-training platform for flight instructors. Headings preserved at H2 from the original to keep the doc readable.

## The Problem

The FAA requires Flight Instructor Refresher Courses (FIRCs) to be 16 hours of content. Current FIRC courses are:

- **Time-gated** - sit and wait for timers to tick down
- **Passive** - slides and text with minimal interaction
- **Checkbox-driven** - pass a 70% quiz, move on
- **Divorced from real cockpit pressure** - knowledge without decision-making

The result: instructors endure compliance training that teaches knowledge but fails to develop the judgment, timing, and intervention skills that actually prevent accidents.

## The Vision

**Replace compliance training with a mastery engine pilots actually want to live in.**

FIRC Boss is a scenario-based, adaptive decision-training platform for flight instructors. Think:

> Microsoft Flight Simulator x Into the Breach x Case Study Engine x CRM Trainer

You are not "taking lessons." You are a CFI operating in a dynamic world -- managing students, flights, risk, weather, and decisions -- being evaluated constantly but invisibly.

### Core Promise

- FAA says 16 hours? We satisfy that (and more).
- But pilots **want** to spend 100+ hours because scenarios evolve, outcomes differ, and mastery matters.
- Every interaction maps invisibly to FAA requirements while feeling like real instructional practice.

## What Makes This Different

### Two Systems, Layered

1. **FAA System (visible)** - Structured curriculum, traceability matrix, compliance mapping. On paper, it looks completely traditional.
2. **Real System (invisible)** - Adaptive engine, spaced repetition, scenario mastery, personalization. This is what users actually experience.

The FAA approves #1. Users love #2.

### Real Instructor Skills, Not Trivia

Traditional FIRC fails because it teaches knowledge, but flying requires decision-making under pressure.

Our system trains:

- **Pattern recognition** - detect weak signals early
- **Timing** - when to ask, prompt, coach, direct, or take controls
- **Judgment** - choose the least invasive effective intervention
- **Intervention skill** - rescue safely when needed
- **Debrief quality** - teach causes, not just outcomes

### The Addictive Loop

1. Fly scenario
2. Make decisions
3. Outcome plays out (sometimes crash, sometimes success)
4. Debrief (this is GOLD - what you did, what you missed, what FAA expects)
5. Replay with new strategy

### Never a Trick

The engine rewards:

- Noticing earlier
- Asking better
- Coaching earlier
- Salvaging safer
- Debriefing honestly

It does NOT reward: psychic guessing, menu gaming, or memorizing scripts.

## The Tick Engine (Core Mechanic)

The fundamental game primitive is the **Instructional Intervention Simulator**:

Each second (or half-second) is a "tick." At every tick:

- Aircraft state updates (instruments, position, energy)
- Student internal state updates (confusion, compliance, workload)
- Instructor can observe, pause, or intervene

### Intervention Ladder (same everywhere, no giveaways)

| Level             | Examples                                                   |
| ----------------- | ---------------------------------------------------------- |
| **Ask**           | "What is your airspeed?" / "Talk me through what you see." |
| **Prompt**        | "Correct to target speed." / "Reduce bank."                |
| **Coach**         | "Pitch for speed." / "Add power smoothly."                 |
| **Direct**        | "I want you to do X now."                                  |
| **Take Controls** | Positive exchange procedure (three-step verbal handoff)    |

### Student Behavior Model

Students are not scripted puppets. They have:

- Skill level, compliance tendency, communication quality
- Freeze tendency, overconfidence tendency
- Instrument interpretation accuracy
- Startle delay, fatigue/distraction modifier

One student says the right thing and does the wrong thing. Another freezes. Another overbanks. That is where replay value comes from.

## The Learning Stack (4 Layers)

### 1. Scenario Learning (Primary)

Realistic situations requiring real-time decision-making.

### 2. Micro-Learning (Just-in-time)

Definitions, regulations, concepts -- appearing when needed, not as slides.

- "RAIM failure detected" -> clickable -> micro-lesson (10-20 sec)

### 3. Rote System (Reinforcement)

Flash challenges, recall drills, timed responses.

- "RAIM failure before FAF -- what now?" (3-second answer)
- Spaced repetition: weak areas shown more often, strong areas spaced out.

### 4. Replay System

Try again. Improve. Different student, different weather, different outcome.
This is what gets people from 16 -> 100 hours.

## Personalization

### Discovery Phase (Entry Experience)

Not a test. "We're building your training profile."

- **Soft knowledge probing** - FAA-style questions (hidden calibration), no pass/fail
- **Interest mapping** - areas to improve, aircraft flown, airports, goals
- **Scenario reflection** - "Tell us about a scary moment" (reveals real gaps, creates emotional engagement, seeds custom scenarios)
- **Confidence mapping** - "How confident are you teaching GPS approaches?"

Output: A `LearnerProfile` that drives the entire adaptive experience.

### Contextual Scenarios

Instead of "You are at an airport..." -> "You are departing KAPA..."

- Local airports, terrain, airspace
- Their aircraft type (G1000 vs steam, turbine vs piston)
- Their goals ("transition to jets", "improve IFR instruction")

### Adaptive Inside Constraints

All required FAA topics must be completed. But order, emphasis, airport, aircraft, and review spacing all adapt to the learner.

## Emotional Safety

- **No permanent penalties** - everything replayable
- **Celebrate failure** - "This is where learning happens"
- **Debrief > Score** - Instead of "65%", show "You missed early stall indicators" and "You delayed intervention by 4 seconds"
- **Trust and honesty are crucial** - "no" and "I don't know" are fine, logged for improvement tracking

## Game Modes

### 1. Career Mode (Primary)

You are a CFI. Build reputation. Handle students. Progress through campaigns.

### 2. Free Play Scenarios

"Give me a GPS failure in IMC." "Give me a student who panics."

### 3. Drill Mode (Rote Learning)

Timed challenges, spaced repetition, flash scenarios (not flashcards).

### 4. Multiplayer (Future)

One plays student, one plays instructor. Or: ATC + pilot + instructor roles.

## The Big Vision (Beyond FIRC)

This becomes the "Factorio" of pilot training -- deep, replayable, skill-based, endlessly engaging.

Eventually, not just FIRC but:

- Private pilot training
- IFR training
- Airline CRM
- Any scenario-based aviation training

## Technology

See [ARCHITECTURE.md](ARCHITECTURE.md) for the current tech stack and monorepo structure.

## Strategic Framing

### To the FAA

- Never say "game" -- say "adaptive, scenario-based, interactive instruction system aligned with FAA SBT principles"
- Never say "fun" -- say "individualized learning paths with continuous assessment"
- Conservative framing, perfect traceability, strong assessment

### To Users

- This is the training you wish existed
- Every minute matters, nothing is wasted
- You'll actually be a better instructor after this

### Competitive Moat

What we protect (never fully expose):

1. Competency model design
2. Tick-based scenario engine
3. Student behavior simulation
4. Adaptive + spaced repetition algorithms
5. Assessment/scoring logic
