# Vocabulary

Aviation terminology used throughout FIRC Boss. Feature specs, UI copy, and internal naming should draw from this vocabulary. The carrier metaphor is core to the project identity.

Source: [APP_NAMING.md](../.archive/work/research/APP_NAMING.md)

## App Names

| App               | Name       | Metaphor                                        |
| ----------------- | ---------- | ----------------------------------------------- |
| Content authoring | **hangar** | Where aircraft are built, maintained, inspected |
| Public site       | **runway** | Entry point. Where you arrive and launch.       |
| Operations        | **ops**    | Managing the flight schedule, people, records   |
| Training          | **sim**    | The simulator. Where you train.                 |

## Feature Names

These are internal names used in code, docs, and UI. Not all are implemented yet -- see [IDEAS.md](IDEAS.md) for tracking.

| Feature              | Term                  | Origin                                           | Status  |
| -------------------- | --------------------- | ------------------------------------------------ | ------- |
| Scenario replay      | **Tape**              | PLAT camera records every carrier approach       | Planned |
| Post-scenario review | **Debrief**           | Military post-mission review                     | Planned |
| Performance history  | **Greenie Board**     | LSO grading board, public, anonymous             | Planned |
| Starting a scenario  | **Cat shot**          | Catapult launch                                  | Idea    |
| Passing a scenario   | **Trap**              | Successful arrested landing                      | Planned |
| Failing / replaying  | **Bolter**            | Missed the wires, go around                      | Planned |
| Course curriculum    | **Air Plan**          | Daily flight schedule                            | Idea    |
| FAA compliance docs  | **NATOPS**            | THE procedures book                              | Idea    |
| Scoring system       | **LSO**               | Landing Signal Officer grades every approach     | Planned |
| Difficulty levels    | **Case I / II / III** | Carrier landing categories by weather visibility | Idea    |

## Engine & System Terms

Core concepts from the scenario engine and platform. These are internal terms -- never used in FAA-facing documents.

| Term                    | Definition                                                                                                                                                                      | Where used                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Tick**                | The fundamental time unit (1 sec or 0.5 sec). Each tick updates aircraft state, student state, and cue visibility. The engine is a tick loop.                                   | `libs/engine/`, SCENARIO_ENGINE_SPEC   |
| **Discovery phase**     | Entry experience that builds a `LearnerProfile`. Soft knowledge probing, interest mapping, confidence mapping, scenario reflection. Not a test -- calibration.                  | `apps/sim/`, VISION.md                 |
| **Evidence packet**     | The complete record of a scenario run: every tick decision, timing, scoring breakdown, student behavior, outcome. Stored in `evidence.*` schema. Audit-grade proof of learning. | `libs/bc/evidence/`, ADR 004           |
| **Intervention ladder** | The five-level escalation model: Ask -> Prompt -> Coach -> Direct -> Take Controls. Same options every tick -- no giveaway UI cues.                                             | SCENARIO_ENGINE_SPEC, VISION.md        |
| **Student model**       | Behavioral profile for simulated students: skill level, compliance tendency, freeze tendency, overconfidence, startle delay. Drives scenario variation and replay value.        | `libs/engine/`, `course.student_model` |
| **Release**             | A versioned, atomic snapshot of all authored content published from hangar to sim. Keyed by `release_id`. All releases retained, not just latest.                               | ADR 005, ADR 006                       |
| **Module**              | A grouping of scenarios, lessons, and assessments organized around an experience (not a topic). The canonical term for course units.                                            | `course.module`, COURSE_STRUCTURE      |
| **Competency**          | A measurable skill or knowledge area. 8 domains, 22 competencies. Each scenario maps to competencies, and competencies map to FAA topics.                                       | `course.competency`, COMPETENCY_GRAPH  |

## Carrier Operations Terms

Reference for naming features, UI elements, and internal concepts.

| Term              | Meaning                                           | Potential use               |
| ----------------- | ------------------------------------------------- | --------------------------- |
| **Pri-Fly**       | Primary Flight Control. Air Boss sits here.       | Platform name or admin view |
| **LSO**           | Landing Signal Officer. Grades every landing.     | Scoring/grading system      |
| **CAG**           | Commander Air Group. Runs the air wing.           | Admin role                  |
| **CIC**           | Combat Information Center. Tactical nerve center. | Analytics                   |
| **The Ball**      | Fresnel lens landing system. "Call the ball."     | Committing to a scenario    |
| **Paddles**       | Nickname for LSO. Your coach on approach.         | The instructor AI/system    |
| **Marshal**       | Holding pattern stack before approach.            | Queue/scheduling            |
| **Handler**       | Manages aircraft positions. Moves chess pieces.   | Content arrangement         |
| **Vulture's Row** | Observation deck. Watch the action.               | Analytics/spectator mode    |
| **Deck**          | The flight deck. Where action happens.            | Training environment        |
| **Island**        | Carrier superstructure. Command.                  | Operations                  |
| **Ready Room**    | Squadron briefing/debrief room. Personal.         | Training environment        |
| **Sortie**        | A single training mission.                        | A training session          |

## Internal vs FAA-Facing Naming

The two-systems principle (see [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md)) applies to naming too. The FAA sees conservative terminology; users and code use the real names.

| Internal term        | FAA-facing equivalent                  |
| -------------------- | -------------------------------------- |
| Game mode            | Scenario-based interactive instruction |
| Tick engine          | Adaptive assessment engine             |
| Student model        | Learner behavior simulation            |
| Bolter (fail/replay) | Additional practice opportunity        |
| Trap (pass)          | Successful completion                  |
| Debrief              | Post-scenario performance review       |
| Greenie Board        | Aggregate performance analytics        |
| Scenario             | Scenario-based training exercise       |
| Discovery phase      | Initial learner assessment             |
| Intervention ladder  | Graduated instructional response model |

**Rule:** Never use internal/carrier terms in TCO, traceability matrix, FAA submission package, or any document that could be reviewed by the FAA. See CLAUDE.md FAA rules.

## Adoption Audit

Which terms are actually used in code/UI vs aspirational (named but not yet built)?

| Term                     | Status           | Notes                                                                    |
| ------------------------ | ---------------- | ------------------------------------------------------------------------ |
| hangar, sim, ops, runway | **Adopted**      | App names, routes, directories                                           |
| Module                   | **Adopted**      | `course.module` table, hangar CRUD, COURSE_STRUCTURE                     |
| Competency               | **Adopted**      | `course.competency` table, seed data, hangar view                        |
| Release                  | **Adopted**      | `published.*` schema, publish pipeline, ADR 005/006                      |
| Evidence packet          | **Adopted**      | `evidence.*` schema exists, not yet populated by sim                     |
| Tick                     | **Aspirational** | Defined in SCENARIO_ENGINE_SPEC, not yet in code                         |
| Discovery phase          | **Aspirational** | Route exists (`/discovery`), no engine logic yet                         |
| Intervention ladder      | **Aspirational** | Defined in VISION/ENGINE_SPEC, not yet in code                           |
| Student model            | **Partial**      | `course.student_model` table + CRUD exists, engine integration not built |
| Debrief                  | **Aspirational** | Route exists (`/debrief/[runId]`), no engine logic yet                   |
| Tape                     | **Aspirational** | Named, no implementation                                                 |
| Greenie Board            | **Aspirational** | Named, no implementation                                                 |
| Cat shot                 | **Aspirational** | Named, no implementation                                                 |
| Trap / Bolter            | **Aspirational** | Named, no implementation                                                 |
| Air Plan                 | **Aspirational** | Named, no implementation                                                 |
| NATOPS                   | **Aspirational** | Named, no implementation                                                 |
| LSO (scoring)            | **Aspirational** | Named, no implementation                                                 |
| Case I/II/III            | **Aspirational** | Named, no implementation                                                 |

## Usage Guidelines

- Draw from this vocabulary when naming features, routes, UI elements, and internal concepts.
- Not every term needs to be user-facing. Some are internal-only (code, docs). Some are UI copy.
- When adding a new term, add it here first. Name things before building them.
- Never use carrier/military terminology in FAA-facing documents. See CLAUDE.md FAA rules.
