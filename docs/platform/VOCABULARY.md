# Vocabulary

Aviation terminology used throughout airboss. Feature specs, UI copy, and internal naming should draw from this vocabulary.

The carrier-operations metaphor was central pre-pivot ("FIRC Boss" sat in Pri-Fly above the deck). Post-pivot, airboss is broader than carrier ops -- the metaphor is one source among several. Pick what fits the surface; don't force-cram carrier terms onto general-aviation features.

See also: [VISION.md](VISION.md), [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md), [LEARNING_PHILOSOPHY.md](LEARNING_PHILOSOPHY.md).

## App names

| App          | Status | Metaphor                                                |
| ------------ | ------ | ------------------------------------------------------- |
| **study**    | Active | Where you sit and study -- cards, reps, knowledge graph |
| **sim**      | Active | The simulator. Hand-rolled FDM, scenarios, debrief.     |
| **hangar**   | Active | Where aircraft are built, maintained, inspected (admin) |
| **spatial**  | Future | Maps and route work                                     |
| **audio**    | Future | Listening + voice drills                                |
| **reflect**  | Future | Journals, heatmaps, decision diary                      |
| **avionics** | Future | Glass cockpit trainer                                   |
| **firc**     | Future | FIRC course (migrated from airboss-firc)                |
| **runway**   | Future | Public-facing entry. Where you arrive and launch.       |

The pre-pivot `ops` app is gone (folded into hangar's People + System areas).

## Engine and system terms

Core concepts from the scenario engines and platform infrastructure.

| Term                    | Definition                                                                                                                                                           | Where used                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Tick**                | The fundamental time unit (1 sec or 0.5 sec). Each tick updates aircraft state, decision affordances, scoring inputs.                                                | sim engine, future firc engine                            |
| **Evidence packet**     | The complete record of a scenario run: every tick decision, timing, scoring breakdown, outcome.                                                                      | sim BC, future firc BC                                    |
| **Intervention ladder** | The five-level FIRC escalation model: Ask -> Prompt -> Coach -> Direct -> Take Controls. Same options every tick.                                                    | Future firc engine, SCENARIO_ENGINE_SPEC                  |
| **Student model**       | Behavioral profile for simulated students in instructor-track scenarios: skill, compliance, freeze tendency, overconfidence, startle delay.                          | Future firc engine                                        |
| **Aircraft profile**    | Flight-dynamics parameters for a specific airplane (C172, PA-28, etc.). Drives sim scenario behavior.                                                                | sim engine                                                |
| **Cert**                | A pilot certificate or rating (PPL, IR, CPL, CFI). See [ADR 016](../decisions/016-cert-syllabus-goal-model/decision.md).                                             | study, hangar (content authoring)                         |
| **Syllabus**            | A versioned plan that maps cert requirements to objectives. See ADR 016.                                                                                             | study                                                     |
| **Goal**                | A learner-facing wrapper around objectives ("Pass IR checkride", "Stay current"). See ADR 016.                                                                       | study                                                     |
| **Lens**                | The framing through which the syllabus is taught (ACS triad, experiential, etc.). See ADR 016.                                                                       | study, hangar                                             |
| **Knowledge node**      | A single teachable idea with edges to related nodes. See [ADR 011](../decisions/011-knowledge-graph-learning-system/decision.md).                                    | study (knowledge graph)                                   |
| **Card**                | A spaced-rep memory item. Has a state (new / learning / review / relearning) per FSRS-5.                                                                             | study                                                     |
| **Decision rep**        | A short decision prompt with feedback. Mental rehearsal under spaced repetition.                                                                                     | study                                                     |
| **Calibration**         | The learner's confidence-vs-correctness gap. The platform tracks it explicitly per [docs/work-packages/calibration-tracker/](../work-packages/calibration-tracker/). | study                                                     |
| **Release**             | A versioned, atomic snapshot of authored content published from hangar to learner surfaces.                                                                          | [ADR 005](../decisions/005-PUBLISHED_CONTENT.md)          |
| **Reference**           | Authoritative source material (CFR, AC, AIM, handbook, NTSB report). Citations from content link to references.                                                      | hangar, [REFERENCE_SYSTEM_FLOW](REFERENCE_SYSTEM_FLOW.md) |
| **Glossary term**       | A defined aviation term cited from prose via wiki-link. Backed by a reference, rendered in the glossary surface.                                                     | hangar, study                                             |

## Carrier operations terms

The carrier metaphor is **partially adopted**. Use these for FIRC-era surfaces (instructor flow, scoring) where the metaphor fits cleanly. Don't force-cram them onto pilot-performance features that have nothing to do with carrier ops.

| Term              | Meaning                                              | Where it fits today                          |
| ----------------- | ---------------------------------------------------- | -------------------------------------------- |
| **LSO**           | Landing Signal Officer. Grades every landing.        | Future firc scoring system                   |
| **Greenie Board** | LSO's grading board. Public, anonymous, comparative. | Future firc aggregate performance view       |
| **Trap**          | Successful arrested landing.                         | Future firc -- passing a scenario            |
| **Bolter**        | Missed the wires, go around.                         | Future firc -- failing / replaying           |
| **Cat shot**      | Catapult launch.                                     | Future firc -- starting a scenario           |
| **Tape**          | PLAT camera record of every approach.                | Future firc -- scenario replay               |
| **Pri-Fly**       | Primary Flight Control. Where the Air Boss sits.     | Reserved -- hangar admin name candidate      |
| **Air Plan**      | Daily flight schedule.                               | Reserved -- session plan candidate           |
| **NATOPS**        | THE procedures book for naval aviators.              | Reserved -- procedures library candidate     |
| **Sortie**        | A single training mission.                           | Reserved -- a single study session candidate |

Reserved means: named for future use, not adopted. Don't introduce a new carrier term in code without a real surface that benefits from the metaphor.

## Pilot-training terms (non-carrier)

For the broader pilot performance platform, plain-aviation terminology fits better than carrier metaphor.

| Term                    | Meaning                                                                       |
| ----------------------- | ----------------------------------------------------------------------------- |
| **Brief**               | Pre-flight discussion; what we'll do, what to watch for.                      |
| **Debrief**             | Post-flight discussion; what happened, what we learned.                       |
| **Maneuver**            | A specific airwork or procedure (steep turns, slow flight, stall recovery).   |
| **Approach**            | A type of instrument arrival (ILS, RNAV, VOR, LOC, circling).                 |
| **Pattern**             | The traffic pattern; downwind, base, final.                                   |
| **Procedure**           | A standardized sequence (engine start, before takeoff, missed approach).      |
| **Profile**             | A standardized maneuver shape (visual approach profile, instrument profile).  |
| **Currency**            | Legal recency-of-experience (90-day, BFR, IPC).                               |
| **Proficiency**         | Actual skill level (distinct from currency, often higher bar).                |
| **Endorsement**         | A logged CFI sign-off authorizing privilege (high-performance, complex, etc). |
| **Checkride**           | The practical test for a cert / rating.                                       |
| **BFR / Flight Review** | The biennial recurrent-training requirement.                                  |
| **IPC**                 | Instrument Proficiency Check.                                                 |
| **Recurrent**           | Periodic re-training (currency or beyond).                                    |
| **Type**                | A specific aircraft model requiring a type rating (>12,500 lbs or turbojet).  |
| **Transition**          | Moving to a new aircraft, avionics suite, or operating environment.           |

These terms are user-facing. Use them in UI copy and content authoring.

## Naming guidelines

- **Draw from this vocabulary** when naming features, routes, UI elements, and internal concepts.
- **Match the metaphor to the surface.** Carrier terms for FIRC-flavored work, plain-aviation terms for general pilot work, plain-engineering terms for platform infrastructure.
- **Not every term needs to be user-facing.** Some are internal-only (code, docs). Some are UI copy. The carrier terms in particular should rarely surface to a non-naval-aviation user.
- **Name things before building them.** When adding a new term, add it here first.
- **Code uses real names.** Database tables, route paths, function names use the real domain term, not a marketing name.

## What's gone

These terms appeared in the pre-pivot vocabulary and don't fit airboss anymore:

- "**FIRC Boss**" -- the project name. Replaced by airboss.
- "**Internal vs FAA-facing naming** / Two-systems principle" -- the FAA-wrapper layer is dormant per [PIVOT.md](PIVOT.md) and [ADR 017](../decisions/017-firc-compliance-dormant.md). When a FIRC pack ships, this distinction comes back.
- "**ops**" -- the standalone admin app. Folded into hangar's People + System areas.
- "**Adoption Audit** as a section" -- replaced by per-term "where used" notes inline.
