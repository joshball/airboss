# Information Architecture

How knowledge, course design, and implementation relate to each other in this project. This is the conceptual model -- not a file structure, but the entities, relationships, and layers that everything else is built on.

## The Problem This Solves

We have regulatory requirements, domain knowledge, learning objectives, instructional design, and code implementation all mixed together in docs/. As the project grows, we lose track of what depends on what. If we change a learning objective, what downstream things break? If the FAA updates a regulation, what content needs updating? If we redesign the delivery mechanism, what stays the same?

This document defines the layers so changes propagate correctly.

---

## Five Layers

```text
L01-FAA: Regulatory Foundation
  "What the FAA requires"
       |
       v
L02-Knowledge: Knowledge Domain
  "What a CFI needs to know and do"
       |
       v
L03-Objectives: Learning Objectives
  "What we will teach, specifically"
       |
       v
L04-Design: Instructional Design
  "How we will teach it"
       |
       v
L05-Implementation: Course Implementation
  "The specs, content, and features that deliver the course"
```

Changes flow downward. A change at L01 may require changes at all layers below it. A change at L04 (switching from reading to scenario) should NOT require changes at L03 (the objective stays the same). If it does, our layers are coupled wrong.

**Note:** L05 is course-specific implementation -- scenario player spec, debrief spec, tick scripts, questions. Platform infrastructure (auth, themes, deployment, DB design) is NOT part of the course layers. It lives separately in docs/.

---

## L01-FAA: Regulatory Foundation

**What it is:** The legal and advisory framework that defines what a FIRC must contain. This is external to us -- we don't control it, we comply with it.

**Sources:**

- AC 61-83K (Advisory Circular -- the "soft law" governing FIRC design)
- 14 CFR Part 61 (the regulation -- the "hard law")
- 49 CFR Part 1552 (TSA flight training security)

**What it defines:**

- 13 core topic areas (A.1-A.13) that must be covered
- Time requirements (16 hours total, 45 min per core topic, 30 min per elective)
- Testing requirements (60+ questions, 70% pass, no true/false)
- Record retention (24 months FAA, 5 years TSA)
- Internet delivery requirements (12 hours content, identity verification, LMS controls)

**How AC numbers work:** Advisory Circular 61-83K means: related to Part 61 (pilot certification), number 83, revision K. ACs provide guidance on how to comply with CFRs. They're "soft law" -- not legally binding, but the FAA expects compliance and uses them as the standard during review.

**What lives here:** The AC text itself, CFR references, FAA submission templates. This is reference material -- we read it, we don't write it.

**When it changes:** When the FAA issues a new revision (61-83L would replace 61-83K). We would need to diff the changes and propagate them through all lower layers.

---

## L02-Knowledge: Knowledge Domain

**What it is:** The professional knowledge and skills a CFI actually needs. This is broader than what the FAA requires -- the FAA defines topics, not depth. A CFI needs to know enough to teach, which means knowing more than the minimum.

**Entities:**

- **Topic Area** -- a broad subject (GPS/Automation/TAA, LOC Prevention, etc.)
- **Sub-topic** -- a specific knowledge area within a topic (ADS-B Out vs In, base-to-final stall chain, etc.)
- **Concept** -- a single teachable idea ("FIS-B weather data can be 15-20 minutes old")
- **Skill** -- something the CFI must be able to do ("Recognize automation fixation in a student")
- **Reference** -- authoritative source material (ACs, handbooks, AIM, NTSB reports)

**Two kinds of knowledge per topic:**

1. **Domain knowledge** -- what the CFI must understand (the subject matter itself)
2. **Instructional knowledge** -- how the CFI teaches it to students (technique, pedagogy, common misconceptions)

Your NextGen example illustrates this perfectly:

- Domain: "What is NextGen? PBN, Data Comm, VOR decommissioning, how it changes approaches"
- Instructional: "How do you teach a private pilot student what NextGen means for them? What's the overview? What misconceptions will they have?"

Both are necessary. The AC says "fully understand" (domain) and "teach an overview" (instructional). Different knowledge, different depth.

**What lives here:** Course research docs. The sub-topic breakdowns. Reference material analysis. This layer answers "what does a CFI need to know about X?" without saying how we'll teach it.

**When it changes:** When aviation technology, regulations, or best practices change. ADS-B requirements expand, a new LOC study is published, ACS is updated. Changes here may or may not require Layer 1 changes (the FAA requirement might stay the same even as the knowledge evolves).

---

## L03-Objectives: Learning Objectives

**What it is:** Specific, testable statements of what our course will teach. Derived from Layer 2, constrained by Layer 1. This is where we make decisions about scope and depth.

**Terminology:**

- **Learning Objective** -- "The CFI will be able to [verb] [specific thing]." Testable, observable, unambiguous.
- **Prerequisite** -- an objective that must be met before another can be attempted
- **Competency** -- a cluster of related objectives that together demonstrate a skill (our 23 competencies)
- **Assessment Criteria** -- how we determine if the objective is met

**Example for A.1.3 NextGen:**

- LO-1: "The CFI will be able to describe the five areas of NextGen modernization (communications, navigation, surveillance, automation, information management)."
- LO-2: "The CFI will be able to explain how PBN procedures differ from conventional approaches and why this matters for student training."
- LO-3: "The CFI will be able to identify which NextGen changes affect their students at each certificate level."

Each objective is:

- Derived from a Layer 2 knowledge area
- Traceable to a Layer 1 FAA requirement
- Independent of Layer 4 delivery method

**The key principle:** If you can't state the objective without naming the delivery method, the objective is coupled to the design. "The CFI will complete a NextGen scenario" is NOT an objective -- it's a delivery spec. "The CFI will be able to explain PBN to a private pilot student" IS an objective -- it doesn't care whether we teach it via scenario, reading, or discussion.

**What lives here:** Learning objective documents per topic. Competency definitions. Assessment criteria. Prerequisite maps.

**When it changes:** When we decide to teach more or less depth, add or remove scope, or restructure competencies. Changes here require re-evaluating Layer 4 (does our delivery still cover the objective?) and Layer 5 (does our content still match?).

---

## L04-Design: Instructional Design

**What it is:** How we teach each objective. The methods, sequence, activities, and structure of the course experience.

**Terminology:**

- **Module** -- a group of related objectives taught together (our 6 modules)
- **Lesson** -- a focused learning experience targeting one or more objectives
- **Activity** -- a specific thing the learner does (scenario, reading, question, discussion, analysis)
- **Sequence** -- the order activities happen within a lesson or module
- **Assessment** -- how we verify the objective was met (knowledge check, scenario scoring, debrief quality)

**Activity types (our delivery mechanisms):**

| Activity            | What the learner does                                           | Best for                                   |
| ------------------- | --------------------------------------------------------------- | ------------------------------------------ |
| Scenario            | Makes real-time CFI decisions in a simulation                   | Judgment, timing, recognition              |
| Micro lesson        | Reads or watches a short focused teaching moment                | Knowledge building before practice         |
| Knowledge check     | Answers questions                                               | Factual recall, regulatory knowledge       |
| Reference study     | Reads source material (handbook, AC, AIM) at their own pace     | Deep domain knowledge, self-directed       |
| Discussion/analysis | Analyzes a recorded conversation, NTSB report, or case study    | Instructional technique, critical thinking |
| Journal             | Reflects on reading, notes questions, tracks learning over time | Long-term retention, personalization       |

**The key principle:** The same objective can be taught multiple ways. Changing the delivery method (Layer 4) should NOT change the objective (Layer 3). If a learner masters an objective through reading and journaling, they don't also need to do the scenario -- they've met the objective.

**What lives here:** Module design docs. Lesson plans. Activity specifications. Sequence decisions. The "how" of the course.

**When it changes:** When we add new activity types (MSFS integration, voice recording), redesign the scenario player, change the module sequence, or add personalization. Changes here should NOT require changes at Layer 3 (objectives stay the same) but DO require changes at Layer 5 (implementation must match the design).

---

## L05-Implementation: Course Implementation

**What it is:** The actual code, content, and data that delivers the course.

**Entities:**

- **App code** -- SvelteKit routes, components, engine
- **Tick scripts** -- scenario decision trees (the authored content)
- **Question bank** -- 503 questions in markdown files
- **Student models** -- behavioral profiles for scenario variation
- **UI components** -- InterventionLadder, SituationCard, ScoreDisplay, etc.
- **DB schema** -- course, published, enrollment, evidence tables
- **Seed data** -- demo scenarios, test accounts

**What lives here:** apps/, libs/, scripts/, data/. The code.

**When it changes:** Constantly. Implementation changes should be driven by Layer 4 decisions, not the reverse. If we find ourselves changing objectives to match what the code can do, we have the dependency backwards.

---

## How Changes Propagate

| Something changes at...            | What needs updating below it                                                                                    |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Layer 1 (FAA updates AC)           | Review L2 knowledge areas -> update L3 objectives if scope changed -> update L4 activities -> update L5 content |
| Layer 2 (new NTSB study on LOC)    | Review affected L3 objectives -> may add new objectives -> update L4 to cover them -> build L5 content          |
| Layer 3 (add a learning objective) | Design L4 activity to teach it -> build L5 content                                                              |
| Layer 4 (redesign scenario player) | Rebuild L5 components and content. L3 objectives unchanged.                                                     |
| Layer 5 (fix a bug in scoring)     | Nothing above changes.                                                                                          |

The critical test: **can I change the delivery method without changing the objective?** If yes, the layers are clean. If no, we have coupling.

---

## Current State vs Target

### What we have now (mixed)

```text
docs/
  firc/                  -- Layers 1, 2, 3, 4 all mixed together
    references/          -- Layer 1 (good, isolated)
    course-research/     -- Layer 2 (new, starting to separate)
    COURSE_STRUCTURE.md  -- Layer 3 + 4 mixed
    COMPETENCY_GRAPH.md  -- Layer 3
    TCO.md               -- Layer 1 + 3 + 4 mixed (FAA-facing)
    scenarios/           -- Layer 5 content (tick scripts)
    question-bank/       -- Layer 5 content (questions)
  platform/              -- Layer 4 + 5 mixed
  products/              -- Layer 5
```

### What we need (separated)

The course itself lives in `course/` off the project root -- separate from app docs.

```text
firc-boss/
  apps/                              -- platform code
  libs/                              -- shared code libraries

  course/                            -- THE COURSE (all 5 layers)
    L01-FAA/                         -- Regulatory Foundation
      references/                    -- AC 61-83K, CFRs (source PDFs/text)
      submission/                    -- TCO, FAA submission package

    L02-Knowledge/                   -- Knowledge Domain
      A.1_GPS-Automation-TAA/        -- Per-topic research, sub-topics, refs
      A.2_SUA-Airspace-Security/
      ...A.13/

    L03-Objectives/                  -- Learning Objectives
      competencies.md                -- Competency framework (23 competencies)
      per-module/                    -- Learning objectives by module
      prerequisites.md               -- Dependency map

    L04-Design/                      -- Instructional Design
      course-structure.md            -- Module sequence, lesson plans
      activity-types.md              -- How each activity type works
      scenario-design/               -- How to author scenarios
      assessment-design/             -- How testing/grading works

    L05-Implementation/              -- Course-specific implementation
      scenarios/                     -- Tick scripts (the authored content)
      question-bank/                 -- 503 questions in section files
      features/                      -- Feature specs that DELIVER course content
        scenario-player/             -- spec, design, tasks, test-plan
        debrief/
        knowledge-checks/
        scenario-immersion/
        discovery/
        progress-tracking/

  docs/                              -- PLATFORM (not course)
    platform/                        -- Architecture, design principles, vision
    decisions/                       -- ADRs
    devops/                          -- Deployment, infrastructure
    products/                        -- App-specific docs (hangar CRUD, ops workflows)
      sim/features/sim-shell/        -- Platform features (not course delivery)
      hangar/features/               -- Content authoring features
      ops/features/                  -- Operations features
      runway/features/               -- Public site features
    work/                            -- Session todos, plans, reviews
```

**The key distinction:** If a spec exists to deliver a course objective (scenario player, debrief, knowledge checks), it goes in `course/L05-Implementation/`. If it exists because the app needs infrastructure (auth, themes, DB schema, task board), it stays in `docs/`.

This means:

- A CFI reviewer can read `course/` top to bottom without seeing deployment docs
- An engineer working on auth doesn't need the competency graph
- Course content changes don't touch `docs/` at all
- Platform changes don't touch `course/` at all

This is a proposal, not a mandate. The exact structure matters less than the principle: **each document should live at one layer, not span multiple.**

---

## Terminology Summary

| Term                    | Layer | Definition                                                          |
| ----------------------- | ----- | ------------------------------------------------------------------- |
| Regulation / CFR        | L01   | Federal law. Non-negotiable.                                        |
| Advisory Circular (AC)  | L01   | FAA guidance on how to comply with CFRs. Soft law.                  |
| Core Topic              | L01   | One of 13 required FAA subject areas (A.1-A.13).                    |
| Elective Topic          | L01   | Optional additional subject area. FAA-approved.                     |
| Topic Area              | L02   | A broad subject within a core topic.                                |
| Sub-topic               | L02   | A specific knowledge area within a topic.                           |
| Concept                 | L02   | A single teachable idea.                                            |
| Domain Knowledge        | L02   | What the CFI must understand (subject matter).                      |
| Instructional Knowledge | L02   | How the CFI teaches it (technique, pedagogy).                       |
| Learning Objective      | L03   | Specific, testable statement of what we teach.                      |
| Competency              | L03   | Cluster of objectives that demonstrate a skill.                     |
| Prerequisite            | L03   | Objective that must be met before another.                          |
| Module                  | L04   | Group of related objectives taught together.                        |
| Lesson                  | L04   | Focused learning experience targeting objectives.                   |
| Activity                | L04   | Specific thing the learner does (scenario, reading, etc.).          |
| Sequence                | L04   | Order of activities within a lesson or module.                      |
| Scenario                | L05   | Interactive tick-driven simulation (an activity type, implemented). |
| Question                | L05   | Knowledge check item (an activity type, implemented).               |
| Micro Lesson            | L05   | Short teaching content (an activity type, implemented).             |

---

## The Analogy to Code

You asked about interfaces and propagation. The layers work like a dependency graph:

- **Layer 1 is the external API** -- we don't control it, we implement against it
- **Layer 2 is the domain model** -- the real-world entities and knowledge
- **Layer 3 is the interface/contract** -- what we promise to deliver
- **Layer 4 is the architecture** -- how we structure the delivery
- **Layer 5 is the implementation** -- the actual code

Just like in code: if you change an interface (Layer 3), all implementations (Layer 5) must update. If you change an implementation detail, the interface stays the same. And if the external API changes (Layer 1), you propagate through the interface and down to implementation.

The difference from code: educational content can't be automatically tested for compliance. If we change a learning objective, we need a human to verify that the scenario still teaches it. This is why traceability matters -- every scenario must trace back to objectives, which trace back to knowledge areas, which trace back to FAA requirements. When something changes, we follow the trace to find what's affected.

---

## Next Steps

1. **Don't reorganize files yet.** This model needs to be reviewed and agreed on first.
2. **Use this as a lens** when creating new content. Ask: "What layer is this? Does it belong with the other things at that layer?"
3. **When the model feels right,** plan the file reorganization as a single deliberate move, not gradual drift.
