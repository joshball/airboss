# Module 1 Lesson Flow

Instructor Foundations & Modern Cockpit. 2h 45m (165 min).

**Prerequisites:** None (this is the opening module).
**Learning objectives:** [module-1-objectives.md](../L03-Objectives/module-1-objectives.md)
**Existing content:** 10 scenarios (125 min), 48 questions (16 per topic)

---

## Narrative Arc

The module tells one story in three acts:

1. **The cockpit changed** (A.1) -- GPS, glass, automation transformed what CFIs teach
2. **The standards changed** (A.12) -- ACS replaced PTS, integrated knowledge + risk + skill
3. **Change is constant** (A.8) -- Staying current is an ongoing professional discipline

These aren't three isolated topics. They're one argument: *the modern CFI operates in a world of continuous change, and the tools, standards, and regulations all require active maintenance, not passive familiarity.*

The scenarios reinforce this by crossing topic boundaries. SCN 1.6 (TAA transition briefing) bridges A.1 and A.12. SCN 1.7 (old lesson plan) bridges A.8 and A.12. This is deliberate -- it mirrors reality.

---

## Time Budget

| Category | Minutes | Notes |
| --- | --- | --- |
| Tutorial (TUT-1) | 8 | Guided (5 min) + unguided replay (3 min) |
| Scan exercises + debriefs | 12 | ISE-1.1 (3+3 min) + ISE-1.2/1.3 later (3+3 min) |
| Tick scenarios (core) | 55 | 5 scenarios everyone plays |
| Tick scenarios (adaptive) | 25-35 | System selects 2-3 based on performance |
| Micro lessons | 13 | Short teaching content between scenarios |
| Knowledge checks | 20 | 15-18 questions across 3 checks |
| Transitions/debriefs | 7 | Scenario debriefs, bridges |
| Module close | 8 | Journal reflection + competency summary |
| **Total** | **~165** | |

---

## Scenario Classification

Not every learner plays every scenario. The system selects based on performance and learning needs.

### Core (everyone plays, 55 min)

These are the minimum path through Module 1. Each one introduces a key concept or competency that later content depends on.

| Scenario | Duration | Why core |
| --- | --- | --- |
| SCN 1.1: GPS Database Expired | 10 min | First scenario in the course. Establishes automation-as-hazard frame. Canonical AV-3. |
| SCN 1.2: Autopilot Mode Confusion | 12 min | The only AV-2 scenario in Module 1. Mode confusion is irreducible. |
| SCN 1.6: TAA Transition Briefing | 10 min | Bridges A.1 and A.12. First ACS application. |
| SCN 1.7: Old Lesson Plan vs Current | 8 min | Bridges A.8 and A.12. Peer intervention. |
| SCN 1.10: ACS Risk Management Debrief | 15 min | The deepest A.12 scenario. Skill-vs-judgment distinction. |

### Reinforcement (system selects 2-3, ~25 min)

These deepen A.1 competencies. Selected when the learner needs more practice on specific automation hazards.

| Scenario | Duration | When selected |
| --- | --- | --- |
| SCN 1.3: RAIM/GPS Approach | 10 min | Weak on GPS limitations (AV-3 low in SCN 1.1) |
| SCN 1.4: Busy Pattern Non-Towered | 12 min | Weak on heads-up teaching (AV-1 low in SCN 1.6) |
| SCN 1.5: XC Planning with Cockpit Weather | 8 min | Weak on FIS-B limitations or risk identification |

### Deep Practice (system selects 0-1, ~20 min)

Longer diagnostic scenarios for learners who demonstrate strong A.1 skills but need currency discipline practice.

| Scenario | Duration | When selected |
| --- | --- | --- |
| SCN 1.8: Returning Instrument Pilot | 20 min | Needs deeper RC-4 practice (regulatory source use) |
| SCN 1.9: XC Planning Before Checkride | 20 min | Needs deeper RC-4 + ES-3 integration |

---

## Three Lessons

### Lesson 1A: Automation Hazards

**Focus:** A.1 primary. "The cockpit changed -- here's what that means for you as an instructor."
**Time:** ~60 min
**Competencies:** AV-1, AV-2, AV-3

```text
Activity                              Type              Time    Objectives
----------------------------------------------------------------------
TUT-1: Wrong-Way Turn (guided)        tutorial          5 min   (onboarding)
  THE ACTUAL FIRST THING IN THE COURSE.
  Guided walkthrough of a simple, obvious scenario.
  ATC says turn left to 180, student turns right.
  System pauses at each phase, highlights the
  instruments, explains the intervention ladder:
  - Phase 1: Ask (student self-corrects heading)
  - Phase 2: Coach (student losing altitude in turn)
  - Phase 3: Take Controls (student overcorrects,
    60-degree bank, frozen)
  Each level teaches why it's the right call here.
  Take-controls is framed as correct, not failure.
  See: features/instrument-scan/tutorial.md

TUT-1: Wrong-Way Turn (replay)        tutorial          3 min   (practice)
  Same scenario, unguided. Minor variations (turn
  direction, severity). Learner practices the UI
  at full speed with a scenario they understand.
  No surprises. Just mechanical fluency.

ISE-1.1: Instrument Scan Evaluation   scan exercise     3 min   (framing)
  THE GORILLA MOMENT.
  Animated six-pack, VFR cruise. Task: evaluate your
  student's instrument scan, identify which instruments
  they're skipping. Note keys (1-6) + intervention ladder
  available. Airspeed decays from 110 to 84 over 90s.
  Most CFIs miss it.

  This teaches the UI (note keys, intervention ladder,
  activity log) while delivering a genuine cognitive
  demonstration. The learner thinks they're learning
  how the course works. They are -- and they're also
  learning about their own attention limits.

  See: course/firc/L05-Implementation/features/instrument-scan/

ISE-1.1 reveal + framing              debrief           3 min   M1-01
  "You correctly identified the scan skip. You also let
  your student get 7 knots above Vs1."
  Replay with timeline. Greenie Board stat. Frame the
  three automation hazards: dependency, fixation, mode
  confusion. "That's what this module is about."

SCN 1.1: GPS Database Expired         scenario          10 min  M1-02, M1-10
  First TICK-ENGINE scenario. Different feel from the
  scan exercise -- discrete decisions, situation card.
  Same intervention ladder. GPS database currency
  content. Lower difficulty -- eases them into tick
  mechanics after the scan exercise shook them up.

Debrief + bridge                      transition        2 min
  "That was data integrity. What about when the automation
  itself surprises you?"

SCN 1.2: Autopilot Mode Confusion     scenario          12 min  M1-08
  Harder. The student did the right thing but the system
  didn't do what they expected. Diagnosis under time
  pressure.

Micro lesson: TAA & ADS-B             micro lesson      5 min   M1-03, M1-04
  TAA definition (14 CFR SS 61.1 and SS 61.129(j)).
  ADS-B Out vs In. FIS-B latency.
  Short, factual, prepares next scenarios.

SCN 1.5: XC Planning with Weather     scenario          8 min   M1-04, M1-07
  (Reinforcement -- system may skip if learner is strong)
  Cockpit weather display trust. FIS-B latency in practice.

SCN 1.3: RAIM/GPS Approach            scenario          10 min  M1-05, M1-10
  (Reinforcement -- system may skip if learner is strong)
  GPS integrity failure during approach. What do you do?

Knowledge check A                     knowledge check   8 min   M1-01, 02, 03, 04, 05, 06
  6-8 questions from A.1 pool. Covers domain knowledge
  objectives. Mix of GPS, TAA, ADS-B, NextGen.
```

**What this lesson accomplishes:**

- Establishes the course's interaction model (tick engine, intervention ladder, debrief)
- Covers all A.1 domain knowledge objectives (M1-01 through M1-06)
- Practices AV-1, AV-2, AV-3 through scenarios
- The adaptive scenarios (1.3, 1.5) mean a strong learner finishes in ~42 min, a struggling learner uses the full ~60 min

---

### Lesson 1B: Teaching to Standards

**Focus:** A.12 primary, bridging A.1. "The standards changed -- are you teaching to the current framework?"
**Time:** ~55 min
**Competencies:** ES-3, RC-4 (introduced), AV-1 (reinforced)

```text
Activity                              Type              Time    Objectives
----------------------------------------------------------------------
Micro lesson: ACS framework           micro lesson      5 min   M1-11, M1-13
  What changed from PTS to ACS. The three dimensions:
  knowledge, risk management, skill. Not a history
  lesson -- a "here's the tool you should be using."
  Show a concrete example: approach briefing as risk
  management artifact.

SCN 1.6: TAA Transition Briefing      scenario          10 min  M1-09, M1-14
  Bridge scenario. The content is A.1 (TAA transition)
  but the assessment is A.12 (does the learner use ACS
  framework in lesson planning?). This is the first time
  they're asked to think about HOW they teach, not just
  WHAT they know.

Bridge: "What you just did"           transition        2 min
  "You planned a lesson. Did you think about knowledge,
  risk management, and skill separately? That's the ACS
  framework in action."

SCN 1.7: Old Lesson Plan vs Current   scenario          8 min   M1-19, M1-21
  A colleague is teaching from outdated PTS standards.
  Do you notice? Do you say something? How?
  Bridges A.8 and A.12 -- stale standards are the problem.

SCN 1.10: ACS Risk Management Debrief scenario          15 min  M1-14, M1-15, M1-16
  The signature A.12 scenario. Student flew the approach
  perfectly but has no idea why the briefing matters.
  Skill mastery + risk management gap = not ready.
  This is the hardest concept in Module 1.

Debrief reflection                    transition        3 min
  "The student could fly the approach. The student
  couldn't explain why the briefing mattered. Under
  ACS, that's not ready. Under PTS, it might have
  passed."

Knowledge check B                     knowledge check   7 min   M1-11, 12, 13, 17
  5-6 questions. Mix of ACS framework and regulatory
  currency intro. The A.8 questions here seed the
  next lesson.

Micro lesson: SS 61.14 IBR            micro lesson      3 min   M1-12
  The 2024 final rule. 30 incorporated documents.
  Why "check the current version" isn't optional
  anymore -- it's how the CFRs work now.
```

**What this lesson accomplishes:**

- Introduces ACS as a working tool, not a trivia topic
- SCN 1.6 bridges from A.1 to A.12 (the learner is already thinking about avionics, now they're thinking about how to teach them)
- SCN 1.10 is the module's deepest learning moment: perfect skill + poor judgment = not ready
- Seeds A.8 concepts (currency, outdated material) for Lesson 1C
- RC-4 first appears here via SCN 1.7 -- regulatory source use

---

### Lesson 1C: The Currency Discipline

**Focus:** A.8 primary, integration. "Change is constant -- here's how you stay current."
**Time:** ~50 min
**Competencies:** RC-4 (primary), ES-3 (reinforced), AV-1/AV-3 (integrated)

```text
Activity                              Type              Time    Objectives
----------------------------------------------------------------------
Micro lesson: Why currency matters    micro lesson      5 min   M1-17, M1-18
  Not "here are the latest changes" (that's a snapshot
  that goes stale). Instead: why stale instruction is a
  safety problem, where to check, what triggers an update.
  Frame it as a professional workflow, not a homework
  assignment.

ISE-1.2 or ISE-1.3                    scan exercise     3 min   M1-01, M1-07
  Second scan exercise. Different gorilla than ISE-1.1
  (heading drift or pitch-up). Different task. The
  learner now knows scan exercises exist -- but the
  gorilla is different, so memorization doesn't help.
  Reinforces: "this keeps happening because attention
  is finite, not because you weren't warned."

ISE reveal                            debrief           3 min
  Brief. "Different flight, different problem, same
  human limitation."

SCN 1.4: Busy Pattern Non-Towered     scenario          12 min  M1-07
  (Reinforcement -- may appear here or in 1A)
  Integration scenario. Automation awareness (AV-1)
  in a dynamic environment. Heads-down glass cockpit
  student in a busy traffic pattern.
  If already played in 1A, system selects 1.8 instead.

SCN 1.8: Returning Instrument Pilot   scenario          20 min  M1-19
  (Deep practice -- system selects this OR 1.9)
  Extended diagnostic. The returning pilot has stale
  knowledge. The CFI must identify what's outdated,
  assess current competence, and plan a catch-up path.
  Heavily exercises RC-4.

  OR

SCN 1.9: XC Planning Before Checkride scenario          20 min  M1-20
  The student is about to take a checkride. The CFI
  must verify they're teaching from current sources.
  What's the current ACS? Are the sectionals current?
  Is the regulatory knowledge up to date?

Knowledge check C                     knowledge check   5 min   M1-17, 18, 20
  4-5 questions from A.8 pool. Focus on process, not
  snapshot content. "Where do you check?" not "What
  changed last year?"

Module 1 reflection                   journal           5 min
  "What's one thing you were teaching that might be
  outdated? What will you check when you get home?"
  Not scored. Not assessed. Just a moment to connect
  the module to real practice.

Module 1 close                        transition        3 min
  Performance summary across all three topic areas.
  Competency radar showing AV-1, AV-2, AV-3, RC-4, ES-3.
  Preview Module 2 (shifts from technical to interpersonal).
```

**What this lesson accomplishes:**

- A.8 is taught as a discipline, not a content dump
- The adaptive path means every learner gets different scenarios based on where they're weak
- The journal prompt connects the module to the learner's actual practice
- The close provides a competency snapshot that the system uses for adaptive behavior in later modules

---

## Cross-Lesson Flow Diagram

```text
Lesson 1A                  Lesson 1B                  Lesson 1C
(A.1: Tools)               (A.12: Standards)          (A.8: Currency)

TUT-1 guided              ACS micro lesson           Currency micro lesson
  |                          |                          |
TUT-1 replay (unguided)   SCN 1.6 (TAA brief)        ISE-1.2/1.3 (scan #2)
  |                          |                          |
ISE-1.1 (the gorilla)    SCN 1.7 (old plan)          ISE reveal
  |                          |                          |
ISE-1.1 reveal + frame   SCN 1.10 (ACS debrief)     SCN 1.4 or 1.8 or 1.9
  |                          |                          (adaptive)
SCN 1.1 (GPS db)         Knowledge check B              |
  |                          |                        Knowledge check C
SCN 1.2 (mode confusion) SS 61.14 micro lesson          |
  |                                                   Journal reflection
TAA/ADS-B micro lesson                                   |
  |                                                   Module close
[SCN 1.5] (adaptive)
  |
[SCN 1.3] (adaptive)
  |
Knowledge check A
```

---

## FAA Time Accounting

Each topic must accumulate >= 45 min. Time from scenarios, micro lessons, and knowledge checks all count.

| Topic | Scenarios | Micro Lessons | Knowledge Checks | Total (min path) | Total (max path) |
| --- | --- | --- | --- | --- | --- |
| A.1 | 1.1 (10) + 1.2 (12) + 1.6 (10, shared) | TUT-1 (8) + TAA/ADS-B (5) + ISE-1.1 (6) | check A (8) | 59 min | 89 min |
| A.8 | 1.7 (8, shared) + 1.8 or 1.9 (20) | currency (5) | check B (partial, 3) + check C (5) | 41 min | 56 min |
| A.12 | 1.6 (10, shared) + 1.7 (8, shared) + 1.10 (15) | ACS (5) + IBR (3) | check B (partial, 4) | 45 min | 45 min |

**A.8 minimum path concern:** 41 min is below the 45 min target. This is resolved by:

- The adaptive selection in Lesson 1C -- if the system picks SCN 1.9 (20 min) instead of SCN 1.4 (12 min), A.8 time increases
- Several A.1 scenarios touch regulatory currency tangentially (database currency IS a regulatory issue)
- The FAA time tracking system accumulates time across the whole course -- A.8 also appears in Module 5 (SCN 5.8) and Module 6 capstone scenarios

If we want to guarantee 45 min within Module 1 alone: ensure the adaptive path always includes at least one of SCN 1.8 or 1.9 (not 1.4 alone). This is a simple engine rule.

---

## What Comes Before Module 1

Nothing. This is the opening module. But the learner has already:

- Created an account and logged in
- Seen the course overview / table of contents
- Possibly completed an optional "how this course works" orientation

The Module 1 intro (5 min micro lesson) must do double duty: introduce both the module's content AND the course's interaction model (tick engine, intervention ladder, debrief cycle). SCN 1.1 is deliberately simple for this reason -- it teaches the mechanics while teaching GPS database currency.

## What Comes After Module 1

**Module 2: Instructional Effectiveness & Safety Culture** (A.4, A.10, A.5)

Module 1 established the *technical* baseline (tools, standards, currency). Module 2 shifts to the *interpersonal* baseline (teaching judgment, ethics, safety culture). The transition is natural: "You know the tools and standards. Now: can you teach another human being to use them well?"

Competencies from Module 1 that carry forward:

- **CJ-2** (intervention ladder) -- introduced implicitly in Module 1 scenarios, becomes the central focus in Module 2
- **ES-3** (ACS framework) -- the debrief skills from 1.10 feed directly into Module 2's discussion/analysis activities
- **RC-4** (source currency) -- reinforced in Module 2 when discussing current safety data and trends

---

## Design Decisions and Rationale

**Why three lessons, not one per FAA topic?**
The topics interleave naturally. Separating them into "the A.1 lesson" + "the A.8 lesson" + "the A.12 lesson" is what existing FIRCs do, and it's boring. Our grouping tells a story: tools -> standards -> currency. The bridge scenarios (1.6, 1.7) make the connections explicit.

**Why adaptive scenario selection?**
A strong learner doesn't need 125 min of scenarios to demonstrate five competencies. The core path (55 min of scenarios + 18 min micro lessons + 20 min knowledge checks + 12 min transitions = 105 min) is sufficient. The adaptive scenarios add depth where needed, bringing weaker learners up to the full 165 min.

**Why is SCN 1.10 the hardest scenario in the module?**
Because it tests the most nuanced concept: the difference between skill mastery and judgment mastery. A student who flies perfectly but can't explain why the briefing matters is the exact CFI failure mode ACS was designed to fix. Placing it at the end of Lesson 1B gives the learner time to build up to it.

**Why is the journal activity not scored?**
Per Design Principle 6 (Emotional Safety). The journal is a moment of honest self-reflection. Scoring it would make it performative. The question ("what are you teaching that might be outdated?") is designed to create a real moment of discomfort that motivates the learner to actually check their materials when they get home.
