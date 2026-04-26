---
title: Information Architecture
type: platform-reference
status: current
date: 2026-04-26
---

# Information Architecture

How regulatory foundation, knowledge, course design, and implementation relate to each other in airboss. This is the conceptual model -- the entities, relationships, and layers that everything else is built on.

## The problem this solves

We have regulatory requirements, domain knowledge, learning objectives, instructional design, and code implementation all mixed together in `docs/` and `course/`. As the platform grows, we lose track of what depends on what. If we change a learning objective, what downstream things break? If the FAA updates a regulation, what content needs updating? If we redesign the delivery mechanism, what stays the same?

This document defines the layers so changes propagate correctly.

## Five layers

```text
L01-FAA: Regulatory Foundation
  "What the FAA + ACS / PTS / FIRC docs require"
       |
       v
L02-Knowledge: Knowledge Domain
  "What a pilot at this cert + syllabus needs to know and do"
       |
       v
L03-Objectives: Learning Objectives + Goals
  "What we will teach, specifically, for this cert/syllabus/goal"
       |
       v
L04-Design: Instructional Design
  "How we will teach it, through which lens"
       |
       v
L05-Implementation: Course Implementation
  "The specs, content, and features that deliver it"
```

Changes flow downward. A change at L01 may require changes at all layers below it. A change at L04 (switching from reading to scenario) should NOT require changes at L03 (the objective stays the same). If it does, our layers are coupled wrong.

**Note:** L05 is course-specific implementation -- scenario player spec, debrief spec, tick scripts, questions. Platform infrastructure (auth, themes, deployment, DB design) is **not** part of these course layers. It lives separately in `docs/platform/`, `docs/products/`, `docs/decisions/`.

**Cert/syllabus/goal/lens model** ([ADR 016](../decisions/016-cert-syllabus-goal-model/decision.md)) sits across L01-L03: a learner has a current cert (PPL/IR/CPL/CFI), is operating against a current syllabus version, has an active goal (passing a checkride, recurrent currency, transition prep), and views the syllabus through a lens (skill / knowledge / risk-management triad from the ACS, or experiential lens from a partner CFI).

## L01: Regulatory Foundation

**What it is:** The legal and advisory framework that defines what each cert requires. External -- we don't control it, we comply with it.

**Sources:**

- 14 CFR Part 61 / Part 91 / Part 141 (the regulations)
- ACS / PTS for each cert (Airman Certification Standards / Practical Test Standards -- the "soft law" governing what's tested)
- AC 61-83K (FIRC-specific Advisory Circular)
- 49 CFR Part 1552 (TSA flight training security)
- AIM, Pilot's Handbook of Aeronautical Knowledge, Airplane Flying Handbook (FAA references)

**What it defines:**

- For each cert: required knowledge areas, skill tasks, risk-management considerations.
- For FIRC specifically: 13 core topic areas (A.1-A.13), 16-hour minimum, 60+ questions, no true/false, 2-year renewal cadence.
- Record retention rules.
- Examination requirements (oral + practical, written knowledge test).
- Currency requirements (BFR, IPC, etc).

**What lives here:** ACS / PTS text, CFR references, FAA submission templates (FIRC-specific). Reference material -- we read it, we don't write it.

**When it changes:** When the FAA issues a new revision (a new ACS edition, a new AC). We diff the changes and propagate them through all lower layers. The cert/syllabus/goal/lens model means a syllabus carries an explicit FAA version; learners can opt in to the new version per [ADR 016](../decisions/016-cert-syllabus-goal-model/decision.md).

## L02: Knowledge Domain

**What it is:** The professional knowledge and skills a pilot at a given cert level actually needs. This is broader than what the FAA requires -- the FAA defines topics, not depth. A pilot needs to know enough to operate safely, which usually means knowing more than the minimum.

**Entities:**

- **Topic Area** -- a broad subject (Airspace, Weather, Navigation, Aerodynamics, Procedures, Loss-of-Control Prevention, etc.)
- **Sub-topic** -- a specific knowledge area within a topic (Class B operations, microbursts, GPS RAIM, base-to-final stall chain, etc.)
- **Knowledge Node** -- a single teachable idea, structured per [ADR 011](../decisions/011-knowledge-graph-learning-system/decision.md) (e.g. "FIS-B weather data can be 15-20 minutes old"). Nodes carry teach/apply/related/requires edges.
- **Skill** -- something the pilot must be able to do ("Recognize wind-shear cues in a final-approach traffic call")
- **Reference** -- authoritative source material (ACs, handbooks, AIM, NTSB reports, manufacturer documents)

**Two flavors of knowledge per topic, when authoring for instructors:**

1. **Domain knowledge** -- what the pilot/instructor must understand (the subject matter itself)
2. **Instructional knowledge** -- how the instructor teaches it (technique, pedagogy, common student misconceptions). Only relevant for cert tracks that include teaching (CFI, CFII, MEI).

**What lives here:** Per-topic research docs (`course/L02-Knowledge/`), reference-material analysis. Answers "what does a pilot at this cert need to know about X?" without saying how we'll teach it.

**When it changes:** When aviation technology, regulations, or best practices evolve. ADS-B requirements expand, a new LOC study is published, an aircraft manufacturer issues a service letter. Changes here may or may not require L01 changes (the regulation might stay the same even as the knowledge evolves).

## L03: Objectives + Goals

**What it is:** Specific, testable statements of what airboss will teach a learner working a given syllabus. Derived from L02, constrained by L01. Where we make decisions about scope and depth.

**Terminology:**

- **Learning Objective** -- "The pilot will be able to [verb] [specific thing]." Testable, observable, unambiguous.
- **Goal** -- a learner-facing wrapper around objectives ("Pass the IR checkride", "Stay current on emergency procedures"). Goals can be cert-aligned or self-directed. See [ADR 016](../decisions/016-cert-syllabus-goal-model/decision.md).
- **Prerequisite** -- an objective that must be met before another can be attempted.
- **Competency** -- a cluster of related objectives that together demonstrate a skill (FIRC has 23 competencies; PPL/IR/CPL have their own per-ACS).
- **Assessment Criteria** -- how we determine if the objective is met.

**Example for an IR learner working "Approaches" within the IR ACS syllabus:**

- LO-1: "The pilot will identify the chart symbology for an ILS approach including DA, MDA, missed approach point."
- LO-2: "The pilot will brief the approach including frequencies, altitudes, missed approach procedure."
- LO-3: "The pilot will fly an ILS to DA holding ±100 ft and ±10 KIAS."

Each objective is:

- Derived from L02 (the underlying knowledge / skill).
- Traceable to L01 (the ACS / PTS task it satisfies).
- Independent of L04 (the delivery method).

**The key principle:** If you can't state the objective without naming the delivery method, the objective is coupled to the design. "Pilot will complete the IR-Approach scenario in `apps/sim/`" is **not** an objective -- it's a delivery spec. "Pilot will fly an ILS to DA holding ±100 ft and ±10 KIAS" **is** an objective -- it doesn't care whether we deliver it via sim, oral drill, or real flight.

**What lives here:** Learning objective documents per cert / topic. Competency definitions. Assessment criteria. Prerequisite maps. Goal definitions per syllabus.

**When it changes:** When we decide to teach more or less depth, add or remove scope, restructure competencies, or wire a new goal type. Changes here require re-evaluating L04 and L05.

## L04: Instructional Design

**What it is:** How we teach each objective. The methods, sequence, activities, and structure of the airboss experience.

**Terminology:**

- **Module** -- a group of related objectives taught together.
- **Lesson** -- a focused learning experience targeting one or more objectives.
- **Activity** -- a specific thing the learner does (scenario, reading, card review, drill, journal entry, debrief).
- **Sequence** -- the order activities happen within a lesson or module.
- **Lens** -- the framing through which the syllabus is taught. The ACS triad (skill / knowledge / risk-management) is one lens; an experiential lens (a CFI's curated scenario walk) is another. See [ADR 016](../decisions/016-cert-syllabus-goal-model/decision.md).
- **Assessment** -- how we verify the objective was met (knowledge check, scenario scoring, calibration confidence, debrief quality).

**Activity types (delivery mechanisms across surfaces):**

| Activity            | Surface          | What the learner does                         | Best for                              |
| ------------------- | ---------------- | --------------------------------------------- | ------------------------------------- |
| Scenario (sim)      | sim              | Real-time control + decision inputs in FDM    | Judgment, motor skills, recognition   |
| Scenario (FIRC)     | firc (future)    | Real-time intervention on a student model     | Instructor judgment, timing           |
| Card review         | study            | Answers a spaced-rep card                     | Factual recall, regulations           |
| Decision rep        | study            | Picks the best response to a brief prompt     | Mental rehearsal, pattern recognition |
| Reference study     | study / hangar   | Reads source material at their own pace       | Deep domain knowledge, self-directed  |
| Knowledge node      | study            | Discovery-first walk through a knowledge node | Understanding before recall           |
| Discussion/analysis | reflect (future) | Analyzes an NTSB report or case study         | Critical thinking                     |
| Journal             | reflect (future) | Reflects on a flight or session               | Long-term retention, decision diary   |
| Audio drill         | audio (future)   | Listens + responds to a brief drill           | Hands-busy practice                   |
| Route rehearsal     | spatial (future) | Walks through a planned route                 | Pre-flight mental rehearsal           |

**The key principle:** The same objective can be taught multiple ways. Changing the delivery method (L04) should NOT change the objective (L03). A pilot mastering an objective through reading + journaling + decision reps doesn't also need a sim scenario -- they've met the objective.

**What lives here:** Module design docs. Lesson plans. Activity specifications. Sequence decisions. Per-cert syllabus + lens definitions. The "how" of the platform.

**When it changes:** When we add new activity types, redesign a surface, change module sequence, add a new lens, or wire personalization. Changes here should NOT require changes at L03 but DO require changes at L05.

## L05: Course Implementation

**What it is:** The actual code, content, and data that delivers each cert / syllabus.

**Entities:**

- **App code** -- SvelteKit routes, components, BC engine in `apps/` + `libs/`.
- **Tick scripts** -- scenario decision trees (the authored content) for sim and future firc.
- **Card decks** -- per-syllabus card content for study.
- **Question bank** -- 503 FIRC questions in markdown (preserved); other-cert banks built as needed.
- **Student models** -- behavioral profiles for FIRC scenarios (future, when firc migrates).
- **Aircraft profiles** -- C172, PA-28, etc. for sim.
- **UI components** -- Svelte components in `libs/ui/` and per-app `lib/components/`.
- **DB schema** -- `study`, `audit`, `identity`, `hangar`, `published`, `sim` schemas in Drizzle.
- **Seed data** -- demo scenarios, Abby (the dev-seed test user).

**What lives here:** `apps/`, `libs/`, `course/L05-Implementation/`, `data/`. The code.

**When it changes:** Constantly. Implementation changes should be driven by L04 decisions, not the reverse. If we find ourselves changing objectives to match what the code can do, we have the dependency backwards.

## How changes propagate

| Something changes at...                | What needs updating below it                                                                              |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| L01 (FAA updates an ACS revision)      | Review L2 knowledge -> update L3 objectives if scope changed -> update L4 activities -> update L5 content |
| L02 (new NTSB study on LOC)            | Review affected L3 objectives -> may add new objectives -> update L4 to cover them -> build L5 content    |
| L03 (add a learning objective)         | Design L4 activity to teach it -> build L5 content                                                        |
| L04 (redesign the sim scenario player) | Rebuild L5 components and content. L3 objectives unchanged.                                               |
| L05 (fix a bug in scoring)             | Nothing above changes.                                                                                    |

The critical test: **can I change the delivery method without changing the objective?** If yes, the layers are clean. If no, we have coupling.

## Where the layers live in the repo

```text
course/                            COURSE CONTENT (all 5 layers, organized by cert)
  L01-FAA/                         Regulatory foundation (AC 61-83K, CFRs, ACS / PTS docs)
  L02-Knowledge/                   Per-topic research, sub-topics, refs, knowledge nodes
  L03-Objectives/                  Learning objectives, competencies, goals, prerequisites
  L04-Design/                      Module structure, activity design, scenario authoring rules
  L05-Implementation/              Per-cert scenarios, question banks, feature specs

docs/                              PLATFORM (not course-specific)
  platform/                        Architecture, design principles, vision, roadmap
  products/                        Per-app docs (study, sim, hangar, runway)
  decisions/                       ADRs
  agents/                          Agent instructions, pattern references
  business/                        Market research, business context
  devops/                          Deployment, infrastructure
  work/                            Session todos, plans, reviews (session-scoped)
  work-packages/                   Per-feature spec / tasks / test-plan / design / user-stories
```

**The key distinction:** If a spec exists to deliver course content (scenario player, debrief, knowledge checks), it goes in `course/L05-Implementation/`. If it exists because the platform needs infrastructure (auth, themes, DB schema, hangar admin), it goes in `docs/work-packages/` or `docs/products/{app}/`.

This means:

- A pilot reviewer can read `course/` top to bottom without seeing deployment docs.
- A platform engineer working on auth doesn't need the IR competency graph.
- Course content changes don't touch `docs/`.
- Platform changes don't touch `course/`.

## Terminology summary

| Term                    | Layer | Definition                                                                      |
| ----------------------- | ----- | ------------------------------------------------------------------------------- |
| Regulation / CFR        | L01   | Federal law. Non-negotiable.                                                    |
| Advisory Circular (AC)  | L01   | FAA guidance on how to comply with CFRs. Soft law.                              |
| ACS / PTS               | L01   | Airman Certification Standards / Practical Test Standards -- the cert standard. |
| Cert                    | L01   | A pilot certificate or rating (PPL, IR, CPL, CFI, etc.). See ADR 016.           |
| Core Topic              | L01   | One of 13 required FAA subject areas in FIRC (A.1-A.13). FIRC-specific.         |
| Topic Area              | L02   | A broad subject within a cert.                                                  |
| Sub-topic               | L02   | A specific knowledge area within a topic.                                       |
| Knowledge Node          | L02   | A single teachable idea with edges to related nodes. See ADR 011.               |
| Domain Knowledge        | L02   | What the pilot must understand.                                                 |
| Instructional Knowledge | L02   | How the instructor teaches it (CFI tracks only).                                |
| Learning Objective      | L03   | Specific, testable statement of what we teach.                                  |
| Goal                    | L03   | A learner-facing wrapper around objectives. See ADR 016.                        |
| Syllabus                | L03   | A versioned plan that maps cert requirements to objectives. See ADR 016.        |
| Lens                    | L04   | The framing through which the syllabus is taught. See ADR 016.                  |
| Competency              | L03   | Cluster of objectives that demonstrate a skill.                                 |
| Prerequisite            | L03   | Objective that must be met before another.                                      |
| Module                  | L04   | Group of related objectives taught together.                                    |
| Lesson                  | L04   | Focused learning experience targeting objectives.                               |
| Activity                | L04   | Specific thing the learner does (scenario, card, decision rep, etc.).           |
| Sequence                | L04   | Order of activities within a lesson or module.                                  |
| Scenario (sim)          | L05   | Interactive flight-dynamics simulation with control inputs and a debrief.       |
| Scenario (FIRC)         | L05   | Interactive tick-driven instructor-intervention simulation. Future.             |
| Card                    | L05   | Spaced-repetition memory item.                                                  |
| Decision Rep            | L05   | A short decision prompt with feedback.                                          |
| Question                | L05   | Knowledge check item.                                                           |

## The analogy to code

The layers work like a dependency graph:

- **L01 is the external API** -- we don't control it, we implement against it.
- **L02 is the domain model** -- the real-world entities and knowledge.
- **L03 is the interface/contract** -- what we promise to deliver.
- **L04 is the architecture** -- how we structure the delivery.
- **L05 is the implementation** -- the actual code.

Just like in code: if you change an interface (L03), all implementations (L05) must update. If you change an implementation detail, the interface stays the same. If the external API changes (L01), you propagate through the interface and down to implementation.

The difference from code: educational content can't be automatically tested for compliance. If we change a learning objective, we need a human to verify that the activity still teaches it. This is why traceability matters -- every scenario / card / rep traces back to objectives, which trace back to knowledge areas, which trace back to ACS / PTS / regulation. When something changes, we follow the trace.

## References

- [VISION.md](VISION.md) -- airboss platform vision
- [LEARNING_PHILOSOPHY.md](LEARNING_PHILOSOPHY.md) -- discovery-first pedagogy
- [ADR 011 -- Knowledge graph learning system](../decisions/011-knowledge-graph-learning-system/decision.md)
- [ADR 016 -- Cert / syllabus / goal / lens model](../decisions/016-cert-syllabus-goal-model/decision.md)
- [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md)
