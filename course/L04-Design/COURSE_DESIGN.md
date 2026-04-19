# Course Design Philosophy

Why the course is structured the way it is. This document explains the grouping logic, sequencing rationale, and design decisions that shape the six-module structure.

For the module-level view (time, topics, scenarios, game modes), see [COURSE_STRUCTURE.md](COURSE_STRUCTURE.md).
For per-module detail, see the `module-{N}-*` docs in this directory and in [L03-Objectives/](../L03-Objectives/).

---

## Why Not 13 Lessons?

The FAA defines 13 core topic areas (A.1-A.13). Every existing FIRC maps these 1:1 into 13 lessons. That's the path of least resistance, and it produces a predictable result: 13 disconnected lectures that feel like reading the AC appendix in order.

The FAA does not mandate lesson count, lesson boundaries, or sequence. What they require:

- All 13 topics covered
- Each topic >= 45 minutes cumulative
- Total >= 16 hours
- Assessment demonstrates learning

A single scenario can count toward multiple topics simultaneously. Topics can be interleaved and revisited. This flexibility is explicit in AC 61-83K.

We use that flexibility to group topics by **instructional theme** rather than by FAA numbering. The result is 6 modules that tell a coherent story instead of 13 isolated lectures.

---

## The Grouping Principle

**Topics are grouped by what they ask of the instructor, not by what they're about.**

Every FAA topic makes a demand on the CFI. Some demand technical knowledge (A.1 GPS/TAA). Some demand interpersonal judgment (A.4 Teaching). Some demand physical intervention skills (A.11 LOC). Some demand administrative discipline (A.3 TSA). The grouping puts topics together when they make the **same kind of demand** on the instructor.

This matters because the learning mode is different for each kind of demand:

| Demand type | Learning mode | Modules |
| --- | --- | --- |
| Technical currency | "The world changed -- get current" | 1 |
| Interpersonal judgment | "Read the human, not the instrument" | 2 |
| Physical intervention | "See the threat, act in time" | 3 |
| Administrative compliance | "Know the rules, follow the process" | 4 |
| Evaluation skill | "Assess meaningfully, not minimally" | 5 |
| Integration | "Put it all together under pressure" | 6 |

A module that mixes technical currency with interpersonal judgment (say, A.1 + A.4) would require the learner to context-switch between completely different cognitive modes within one session. Keeping the demand type consistent lets the module build skill within a coherent frame.

---

## The Six Modules

### Module 1 -- Instructor Foundations & Modern Cockpit

**Topics:** A.1 (GPS/TAA/Automation), A.8 (Regulatory Updates), A.12 (ACS)

**Thesis:** The world changed while you weren't looking -- the cockpit, the standards, and the rules.

**Why these three together:** All three are about **currency**. A CFI who hasn't been active is out of date in three ways simultaneously: the cockpit evolved (glass, GPS, ADS-B), the evaluation framework changed (PTS -> ACS with risk management as a first-class dimension), and the regulatory landscape shifted (BasicMed, NOTAM formats, SS 61.14 IBR). These aren't three separate problems -- they're one problem with three faces. A CFI who is current on one but stale on the others is still teaching from an outdated mental model.

**Why not also A.5 (Safety Trends)?** A.5 is also "what's changed," but it's about accident patterns and safety culture, not cockpit/standards/rules. It pairs better with A.4 (Teaching) and A.10 (Ethics) in Module 2 because the response to safety trends is interpersonal -- how you teach, what you emphasize, how you build safety culture -- not technical.

**Why not also A.9 (Flight Reviews)?** A.9 could pair with A.12/ACS since both involve evaluation standards. But the core of A.9 is the *evaluation event* (conducting a review, diagnosing a pilot, tailoring the experience). That's evaluation skill, not technical currency. It belongs in Module 5.

**Detailed design:** [module-1-objectives.md](../L03-Objectives/module-1-objectives.md), [module-1-lesson-flow.md](module-1-lesson-flow.md), [module-1-landscape.md](module-1-landscape.md)

---

### Module 2 -- Instructional Effectiveness & Safety Culture

**Topics:** A.4 (Teaching & Safety Culture), A.10 (Ethics & Professionalism), A.5 (Safety Trends)

**Thesis:** You know the tools and standards. Can you teach another human being to use them well -- and resist pressure when they push back?

**Why these three together:** All three are about **judgment in the presence of another person**. A.4 is about reading students, adapting instruction, and building safety culture. A.10 is about what the CFI does when nobody's watching -- resisting shortcuts, maintaining standards under social and commercial pressure. A.5 provides the data that makes A.4 and A.10 concrete: *these* are the accidents happening, *these* are the trends, and *this* is what your teaching should emphasize in response.

The common thread is that none of these can be reduced to procedure. They require the CFI to read a situation, exercise judgment, and act on values -- not follow a checklist.

**Why not A.4 in Module 3 (LOC)?** A.4 does appear in Module 3 as reinforcement (positive exchange of controls is a teaching skill). But A.4's core -- how to teach effectively, how to build safety culture -- is interpersonal, not physical. The LOC lab is about recognizing threats and intervening in time. Teaching and culture-building are different cognitive work.

**Detailed design:** Not yet written. See [task spec below](#modules-2-6-work-remaining).

---

### Module 3 -- Loss of Control Lab

**Topics:** A.11 (LOC), A.6 (Pilot Deviations), A.4 (Teaching -- reinforced via positive exchange of controls)

**Thesis:** See the threat developing. Act before it's too late. This is the most dangerous thing your student will face.

**Why these three together:** A.11 and A.6 share a common failure mode: the pilot (or instructor) doesn't recognize the developing situation until it's too late. LOC is the extreme case (stall/spin), and pilot deviations are the everyday case (runway incursion, airspace bust, readback error). Both demand the same skill from the CFI: **pattern recognition under time pressure** followed by **calibrated intervention**. A.4 appears here only as the exchange-of-controls procedure -- a critical teaching skill that's tested under LOC pressure.

This is the most "game-like" module. The tick engine is the primary mechanic. Time pressure is real. The scenarios are designed to create the exact cognitive load that makes LOC intervention hard in real life.

**Why is this Module 3 and not Module 1?** Because the learner needs foundation first. Module 1 establishes the course mechanics (tick engine, intervention ladder, debrief cycle) with lower-stakes scenarios. Module 2 builds interpersonal judgment. Module 3 demands both -- the learner must read instrument cues AND read the student AND act under time pressure. Placing LOC first would overwhelm before the foundations are set.

**Why not A.6 in Module 4 (Compliance)?** Pilot deviations could be framed as a compliance topic (you deviated from a clearance). But the AC is clear: deviations happen because of **human factors** -- fixation, poor scan, distraction, unfamiliarity. The prevention is instructional (teach better habits), not administrative (know the rules). Deviations share more DNA with LOC than with TSA paperwork.

**Detailed design:** Not yet written. See [task spec below](#modules-2-6-work-remaining).

---

### Module 4 -- Airspace, Security, and Compliance

**Topics:** A.2 (Special Use Airspace), A.3 (TSA Requirements), A.13 (Student/Remote Pilot Applications)

**Thesis:** Important, consequential, and boring if you teach it wrong. These are the rules you must follow correctly.

**Why these three together:** All three are about **administrative and operational compliance** where getting it wrong has serious legal consequences. A.2 is about security-driven airspace (TFRs, intercepts, the DC SFRA). A.3 is about TSA requirements for flight training (citizenship verification, FTSP, record-keeping). A.13 is about properly accepting certificate applications. The common demand: the CFI must know a process, follow it correctly, and refuse to proceed when the process says stop.

These topics are traditionally the "dead lecture" portion of a FIRC. Our approach (scenario-based, distributed instruction, spaced reinforcement) is designed to make them feel like 10 minutes while accumulating 45+ minutes of genuine engagement per topic.

**Why the shortest module (2.0 hours)?** Because the conceptual depth is shallower than the other modules. The content is procedural -- there aren't layers of judgment to build. The scenarios are about decision accuracy (did you follow the process correctly?) not decision quality (did you choose the right intervention level?). More time would mean more repetition, not deeper learning.

**Detailed design:** Not yet written. See [task spec below](#modules-2-6-work-remaining).

---

### Module 5 -- Meaningful Evaluations

**Topics:** A.9 (Flight Reviews & IPCs), A.7 (FAASTeam & WINGS)

**Thesis:** You evaluate pilots. Are you doing it meaningfully, or are you just signing them off?

**Why these two together:** Both are about **post-certificate proficiency** -- what happens after the student gets their certificate. A.9 is the evaluation event itself (conducting a flight review or IPC). A.7 is the ongoing proficiency framework (WINGS, FAASTeam resources). Together they form a complete picture: the CFI conducts meaningful evaluations AND connects pilots to ongoing proficiency resources.

The AC is emphatic that flight reviews should not be checkbox exercises. The regulatory minimum (1 hour ground, 1 hour flight) rarely equals the time actually needed. A.7's WINGS program provides the framework for structured ongoing proficiency that goes beyond the biennial review cycle. These topics demand the same skill: **diagnostic evaluation** -- reading a pilot, finding the real weakness, and designing a response.

**Why is this Module 5 and not earlier?** Because meaningful evaluation requires all the skills built in Modules 1-4. You need technical currency (Module 1) to know what to evaluate against. You need interpersonal judgment (Module 2) to read the pilot being evaluated. You need threat recognition (Module 3) to spot the hidden weakness. You need administrative knowledge (Module 4) to handle the paperwork correctly. Module 5 is where those skills converge into the evaluation context.

**Detailed design:** Not yet written. See [task spec below](#modules-2-6-work-remaining).

---

### Module 6 -- Integrated Capstone

**Topics:** All 13 topics integrated. Replay, spaced repetition, improvement delta.

**Thesis:** Prove it. Everything at once, under pressure, with variation.

**Why a capstone?** Two reasons.

First, **integration testing**. Modules 1-5 each build skills in isolation. Real instructing requires all skills simultaneously -- you're reading instruments AND reading the student AND applying current standards AND resisting pressure AND making an evaluation call. The capstone scenarios are multi-topic, multi-competency, and multi-decision-point.

Second, **improvement measurement**. The capstone includes replays of earlier scenario types. The system compares initial performance (Modules 1-3) with capstone performance to calculate an improvement delta. This serves both the learner (concrete evidence of growth) and the FAA compliance layer (documented evidence of learning).

**Why 2.5 hours and not more?** The capstone is assessment-focused, not instruction-focused. By this point the learner has 13.5 hours of instruction behind them. The capstone validates, it doesn't teach. More time would dilute the signal.

---

## Sequencing Rationale

The six modules follow a deliberate progression:

```text
Module 1: Technical foundations    "Get current"
Module 2: Interpersonal skills    "Read the human"
Module 3: Physical intervention   "Act under pressure"
Module 4: Administrative duties   "Follow the process"
Module 5: Evaluation practice     "Assess meaningfully"
Module 6: Integration             "Everything at once"
```

**The logic:** Each module requires skills from the previous ones.

- **1 -> 2:** You need to know the current tools and standards (M1) before you can teach them to someone effectively (M2).
- **2 -> 3:** You need interpersonal judgment (M2) to handle the student interaction during LOC intervention (M3). Module 3 tests both cue recognition AND student management simultaneously.
- **3 -> 4:** Module 4 is a cognitive palette cleanser. After the intense, time-pressured LOC lab, the shift to administrative/compliance content is a deliberate change of pace. This also serves a pedagogical purpose: spaced practice. By the time learners return to judgment-heavy scenarios in Module 5, time has passed since Module 3 -- creating natural spaced repetition.
- **4 -> 5:** Administrative knowledge (M4) feeds into evaluations (M5). A CFI conducting a flight review needs to know current application processes, airspace rules, and regulatory currency. Module 4's compliance knowledge becomes background for Module 5's evaluation scenarios.
- **5 -> 6:** The capstone requires everything. Modules 1-5 are prerequisites.

**Cross-module reinforcement:** Some competencies appear in multiple modules at increasing difficulty:

| Competency | First appears | Reinforced in | Assessed in capstone |
| --- | --- | --- | --- |
| CJ-2 (intervention ladder) | M1 (implicitly, via tutorial) | M2 (interpersonal), M3 (time-pressure) | M6 |
| ES-3 (ACS framework) | M1 (explicitly) | M5 (evaluation context) | M6 |
| RC-4 (regulatory currency) | M1 (explicitly) | M4 (compliance context), M5 (evaluation prep) | M6 |
| RM-1 (risk identification) | M2 (explicitly) | M3 (dynamic, in-flight) | M6 |

---

## The Adaptive Model

Not every learner plays every scenario. Within each module, scenarios are classified:

| Classification | Who plays it | Purpose |
| --- | --- | --- |
| **Core** | Everyone | Introduces key concepts. Cannot be skipped. |
| **Reinforcement** | System selects based on performance | Deepens practice on specific competencies where the learner is weak. |
| **Deep Practice** | System selects for strong learners needing depth | Longer, more complex scenarios for learners who have demonstrated foundational competency. |

This means:

- A strong learner's path through the course is shorter per module but hits all core scenarios
- A struggling learner gets more scenarios (reinforcement) that target their specific weaknesses
- Total course time is always >= 16 hours regardless of path (the adaptive model adjusts depth, not coverage)

Module 1's [lesson flow](module-1-lesson-flow.md) documents this classification in detail. Modules 2-6 need the same treatment (see task spec below).

---

## Topic-to-Module Assignment (Complete)

| FAA Topic | Module | Role in module |
| --- | --- | --- |
| A.1 GPS/TAA/Automation | 1 | Primary |
| A.2 Special Use Airspace | 4 | Primary |
| A.3 TSA Requirements | 4 | Primary |
| A.4 Teaching & Safety Culture | 2 | Primary |
| A.4 (exchange of controls) | 3 | Reinforcement only |
| A.5 GA Safety Trends | 2 | Primary |
| A.6 Pilot Deviations | 3 | Primary |
| A.7 FAASTeam / WINGS | 5 | Primary |
| A.8 Regulatory Updates | 1 | Primary |
| A.9 Flight Reviews & IPCs | 5 | Primary |
| A.10 Ethics & Professionalism | 2 | Primary |
| A.11 LOC Prevention | 3 | Primary |
| A.12 ACS | 1 | Primary |
| A.13 Student/Remote Pilot Apps | 4 | Primary |

---

## Modules 2-6 Work Remaining

Module 1 has full design documentation:

- [module-1-objectives.md](../L03-Objectives/module-1-objectives.md) -- 21 learning objectives with scenario traceability
- [module-1-lesson-flow.md](module-1-lesson-flow.md) -- 3-lesson structure, adaptive selection, FAA time accounting
- [module-1-landscape.md](module-1-landscape.md) -- territory map, coverage analysis, candidate scenarios

Modules 2-6 need the same treatment. Each module needs three documents:

### Per-module deliverables

**L03: `module-{N}-objectives.md`** -- Learning objectives derived from L02 research and competency graph.

- Domain knowledge objectives (factual/regulatory -- assessed by knowledge check)
- Instructional knowledge objectives (judgment/teaching -- assessed by scenario)
- Objective-to-scenario traceability table
- Gap analysis (what objectives lack scenario coverage, and is that OK?)

**L04: `module-{N}-lesson-flow.md`** -- Lesson structure, adaptive selection, time accounting.

- Narrative arc (the story the module tells)
- Time budget
- Scenario classification (core / reinforcement / deep practice)
- Lesson-by-lesson activity sequence with objectives mapped
- Cross-lesson flow diagram
- FAA time accounting per topic (min path vs max path)
- Design decisions and rationale

**L04: `module-{N}-landscape.md`** -- Territory map, coverage analysis, candidate scenarios.

- Full conceptual territory for each FAA topic in the module
- What the current scenarios cover (and what angle each takes)
- What's deliberately excluded and why
- Candidate scenarios for expansion (ideas, not commitments)
- Cross-module connections (where this module feeds or depends on others)

### Module-specific notes for future sessions

**Module 2 (Instructional Effectiveness & Safety Culture)**

- Topics: A.4, A.10, A.5
- 8 existing scenarios in [course/L05-Implementation/scenarios/module-2/](../L05-Implementation/scenarios/module-2/)
- L02 research: [A.4](../L02-Knowledge/A.4_Teaching-Safety-Culture/OVERVIEW.md), [A.10](../L02-Knowledge/A.10_Ethics-Professionalism/OVERVIEW.md), [A.5](../L02-Knowledge/A.5_GA-Safety-Trends/OVERVIEW.md)
- Key challenge: A.4 is vast -- the FOI alone is a textbook. Scope to what the AC asks (build on FOI, don't repeat it). Focus on the interpersonal: reading students, adapting instruction, resisting pressure.
- A.10 risks becoming a sermon. The scenarios must create genuine ethical dilemmas, not obvious right/wrong choices.
- A.5's accident data will go stale. Design objectives around the *skill* of using trend data, not the data itself.
- Competencies: CJ-1, CJ-2, CJ-3, PS-1, PS-2, RM-1, RM-3

**Module 3 (Loss of Control Lab)**

- Topics: A.11, A.6, A.4 (reinforcement)
- 8 existing scenarios in [course/L05-Implementation/scenarios/module-3/](../L05-Implementation/scenarios/module-3/)
- L02 research: [A.11](../L02-Knowledge/A.11_LOC-Prevention/OVERVIEW.md), [A.6](../L02-Knowledge/A.6_Pilot-Deviations/OVERVIEW.md)
- Key challenge: This is the flagship tick-engine module. The base-to-final stall-spin scenario is the most mechanically complex scenario in the course. The lesson flow needs to build toward it -- simpler scenarios first, then the high-stakes ones.
- A.6 has 95 questions across 9 files and 8 scenarios -- the deepest content of any topic. The lesson flow must manage this volume without overwhelming.
- A.11's 7 sub-sections (A.11.1-A.11.7) each deserve at least one scenario. Check that the 8 existing scenarios cover all 7.
- Exchange of controls (A.4 reinforcement) should be a specific, brief teaching moment, not a separate lesson.
- Competencies: AC-1, AC-2, AC-3, OD-1, OD-2, CJ-1, CJ-2, CJ-3, RM-2

**Module 4 (Airspace, Security, and Compliance)**

- Topics: A.2, A.3, A.13
- 9+ existing scenarios in [course/L05-Implementation/scenarios/module-4/](../L05-Implementation/scenarios/module-4/)
- L02 research: [A.2](../L02-Knowledge/A.2_SUA-Airspace-Security/OVERVIEW.md), [A.3](../L02-Knowledge/A.3_TSA-Requirements/OVERVIEW.md), [A.13](../L02-Knowledge/A.13_Student-Remote-Cert/OVERVIEW.md)
- Key challenge: Making compliance content engaging. The distributed instruction model (COURSE_STRUCTURE.md Module 4 section) is the design innovation here -- 45 min of TSA instruction that "feels like 10 min."
- A.3 (TSA) changes frequently. Design objectives around the process of checking requirements, not the current requirements themselves.
- A.13 is procedural. The scenarios are about edge cases (incomplete apps, eligibility questions), not conceptual depth.
- Competencies: OD-3, RC-1, RC-2, RC-3

**Module 5 (Meaningful Evaluations)**

- Topics: A.9, A.7
- 8 existing scenarios in [course/L05-Implementation/scenarios/module-5/](../L05-Implementation/scenarios/module-5/)
- L02 research: [A.9](../L02-Knowledge/A.9_IPC-Flight-Review/OVERVIEW.md), [A.7](../L02-Knowledge/A.7_FAASTeam-WINGS/OVERVIEW.md)
- Key challenge: A.9 has rich sub-structure (IPC vs flight review vs considerations). The lesson flow needs to distinguish the evaluation types while showing that the diagnostic skill is the same.
- A.7 risks being a FAASTeam advertisement. The scenarios should make WINGS useful (build a proficiency plan that uses WINGS), not just explain what WINGS is.
- The "quick signoff" scenario appears in both Module 2 (ethics angle: friend asks for shortcut) and Module 5 (evaluation angle: how to say no professionally). Check for redundancy vs deliberate reinforcement.
- Competencies: ES-1, ES-2, ES-3, PS-2

**Module 6 (Integrated Capstone)**

- Topics: All 13 integrated
- 5 existing scenarios in [course/L05-Implementation/scenarios/module-6/](../L05-Implementation/scenarios/module-6/)
- No L02 research needed (integration, not new content)
- Key challenge: The capstone must feel different from Modules 1-5. Multi-topic scenarios, "day in the life" format, replay with variation. The improvement delta measurement requires careful scenario selection -- the replayed scenarios must test the same competencies as earlier modules to make comparison valid.
- The 5 existing scenarios may need expansion. A 2.5-hour module with only 5 scenarios means long scenarios (~30 min each) or significant non-scenario time. Verify the time budget works.
- Competencies: All domains
