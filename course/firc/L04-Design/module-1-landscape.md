# Module 1 Landscape

Territory map for Module 1 -- Instructor Foundations & Modern Cockpit. What the full conceptual space looks like, how the 10 scenarios sample it, what's deliberately excluded, and what could be added.

For the lesson flow and time accounting, see [module-1-lesson-flow.md](module-1-lesson-flow.md).
For learning objectives, see [module-1-objectives.md](../L03-Objectives/module-1-objectives.md).
For the grouping rationale, see [COURSE_DESIGN.md](COURSE_DESIGN.md).

---

## A.1 Territory -- GPS, Automation & TAA

Source: [L02 A.1 research](../L02-Knowledge/A.1_GPS-Automation-TAA/)

The AC identifies six categories of automation hazard and three supporting sub-topics. The territory is wide.

### Conceptual sub-areas

| Sub-area | What it covers | AC basis |
| --- | --- | --- |
| Automation dependency | Inability to function when automation unavailable; lost pilotage/DR/VOR skills | A.1 main |
| Automation fixation | Attention captured by display; heads-down time | A.1 main |
| Mode confusion | Not understanding which mode is active/armed/capturing | A.1 main |
| Database currency | Stale nav data, expired charts, outdated procedures in the box | A.1 main |
| Automation complacency | Assuming the system is handling more than it is | A.1 main |
| System limits and procedures | What the manufacturer says; what NOTAMs override | A.1 main |
| Levels of automation | No single level appropriate for all situations; knowing when to disconnect | A.1 main |
| Manual proficiency | Hand-flying, non-GPS nav, recovery from automation loss | A.1 main |
| TAA definition and qualification | 14 CFR SS 61.1, SS 61.129(j); installed-component criteria | A.1.1 |
| ADS-B | Out vs In; regulatory basis (SS 91.225/227); FIS-B weather latency | A.1.2 |
| NextGen | PBN, ADS-B surveillance, modernized approach infrastructure | A.1.3 |
| Transition training | Make/model/equipment-specific training from qualified CFI | A.1 main |

### How the 10 scenarios cover A.1

| Scenario | Sub-areas covered | Angle |
| --- | --- | --- |
| SCN 1.1: GPS Database Expired | Database currency, system limits | Student has expired data; 100-ft altitude discrepancy on approach. Tests: does the CFI catch it? |
| SCN 1.2: Autopilot Mode Confusion | Mode confusion, levels of automation | Student in wrong vertical mode; crossing restriction bust. Tests: diagnosis under time pressure. |
| SCN 1.3: RAIM Integrity Issue | System limits, manual proficiency | GPS RAIM unavailable at minimums. Tests: does CFI know what RAIM is, what to do, and how to teach it? |
| SCN 1.4: Glass Cockpit Fixation | Automation fixation, automation dependency | Student heads-down on display, misses non-ADS-B traffic. Tests: recognizing over-reliance in a dynamic environment. |
| SCN 1.5: ADS-B Weather Delay | ADS-B (FIS-B latency), automation complacency | Student uses 18-min-old weather for tactical avoidance. Tests: strategic vs tactical distinction. |
| SCN 1.6: TAA Transition Briefing | TAA definition, transition training | Student confused by first TAA approach plate. Tests: teaching unfamiliar concepts by anchoring to known ones. |

**A.1 sub-areas with scenario coverage:** 8 of 12

**A.1 sub-areas without dedicated scenarios:**

| Sub-area | Coverage status | Notes |
| --- | --- | --- |
| Automation dependency (skill atrophy) | Partial -- SCN 1.4 touches it | No scenario tests the student who literally can't navigate without GPS |
| Levels of automation | Implicit in SCN 1.2 | No scenario explicitly teaches "when to disconnect" as a decision point |
| Manual proficiency | Implicit in SCN 1.3 | No scenario where the CFI must coach hand-flying after automation failure |
| NextGen | Knowledge check only (M1-06) | AC says "overview level" -- knowledge check is appropriate per gap analysis |

### Candidate scenarios for A.1 expansion

These are ideas, not commitments. Each fills a gap or deepens coverage.

**VOR/pilotage atrophy check.** Student on a VFR cross-country can't identify their position without GPS. The moving map fails (battery, signal, whatever). Student has no sectional skills, no VOR tuning proficiency, no dead reckoning sense. The CFI must diagnose whether this is a training gap or a proficiency gap and respond appropriately. Tests: AV-1 (automation dependency recognition), manual proficiency teaching.

**Wrong approach loaded.** Student loads the wrong GPS approach (RNAV 28 instead of RNAV 10). ATC clears them for the approach they requested, not the one in the box. The student doesn't notice the discrepancy. Tests: AV-2 (automation surprise), system limits (the box does what you told it, not what you meant).

**Disconnect decision.** Autopilot is making the situation worse -- trim runaway, oscillation, or simply adding workload during a hand-flyable situation. The student keeps trying to troubleshoot the automation instead of disconnecting. Tests: levels of automation (the right answer is less automation, not more).

**RNAV departure vs conventional.** Student is assigned an RNAV SID but the GPS is in a degraded state (expired database, partial signal). The CFI must decide: request a conventional departure, or coach the student through the RNAV with degraded tools? Tests: system limits, transition training, practical judgment.

**Moving map complacency.** Student on a VFR cross-country is following the magenta line and drifting into Class B airspace. The moving map shows the boundary, but the student isn't watching it -- they're watching the line, not the surrounding context. Tests: automation complacency, heads-up discipline.

**Terrain awareness complacency.** Student flying in mountainous terrain trusts the terrain display to keep them safe. The display shows green (terrain well below). But the student is in a valley and the escape route requires climbing -- the display doesn't show the terrain they'd hit if they needed to turn around. Tests: system limits, a display showing "safe" when the situation isn't.

---

## A.12 Territory -- Airman Certification Standards

Source: [L02 A.12 research](../L02-Knowledge/A.12_ACS/OVERVIEW.md)

The AC's scope is narrower than A.1 but conceptually deeper. ACS is both a document and a framework for thinking about instruction.

### Conceptual sub-areas

| Sub-area | What it covers | AC basis |
| --- | --- | --- |
| ACS vs PTS | What changed; three dimensions (knowledge, risk management, skill) vs two (knowledge, skill) | A.12 main |
| ACS as lesson planning tool | Using ACS to design instruction, not just prepare for checkrides | A.12 main |
| ACS as debrief framework | Tracing errors to knowledge/risk/skill dimensions | A.12 main |
| ACS as remediation tool | Designing targeted remediation based on which dimension is weak | A.12 main |
| SS 61.14 IBR | 2024 final rule; 30 documents incorporated by reference; source currency implications | A.12 main |
| Which ACS/PTS applies | Certificate/rating lookup; knowing where to find the current version | A.12 main |
| Risk management as first-class dimension | The big conceptual shift -- skill mastery without risk awareness is not "ready" | A.12 main |

### How the 10 scenarios cover A.12

| Scenario | Sub-areas covered | Angle |
| --- | --- | --- |
| SCN 1.6: TAA Transition Briefing | ACS as lesson planning tool | Bridge scenario: A.1 content, A.12 assessment. Does the CFI plan using knowledge/risk/skill dimensions? |
| SCN 1.7: Old Lesson Plan vs Current | ACS vs PTS, source currency | Peer teaching from PTS instead of ACS. How to intervene professionally. |
| SCN 1.10: ACS Risk Management Debrief | Risk management as first-class dimension, ACS as debrief framework | The signature scenario. Perfect approaches + no risk awareness = not ready under ACS. |

**A.12 sub-areas with scenario coverage:** 4 of 7

**A.12 sub-areas without dedicated scenarios:**

| Sub-area | Coverage status | Notes |
| --- | --- | --- |
| ACS as remediation tool | Not covered | No scenario where the CFI designs targeted remediation using ACS dimensions |
| SS 61.14 IBR | Micro lesson + knowledge check (M1-12) | Regulatory/factual -- knowledge check is appropriate |
| Which ACS/PTS applies | Knowledge check only (M1-13) | Lookup skill -- knowledge check is appropriate |
| ACS vs PTS (detailed comparison) | Implicit in SCN 1.7, 1.10 | No scenario that explicitly walks through the differences on a specific maneuver |

### Candidate scenarios for A.12 expansion

**ACS-based remediation planning.** A student has failed specific elements on a practice checkride. The CFI must design a remediation plan using ACS dimensions -- was the failure knowledge (the student doesn't know the procedure), risk management (the student knows but doesn't apply), or skill (the student understands but can't execute)? Each requires a different response. Tests: ACS as remediation tool, diagnostic depth.

**PTS-to-ACS comparison on a specific maneuver.** Take a single maneuver (e.g., steep turns) and walk through how it's evaluated under PTS vs ACS. Under PTS: did they hold altitude and bank? Under ACS: did they also assess risk (turbulence, traffic, terrain), manage workload, and explain their scan strategy? Tests: ACS vs PTS at a concrete level, not abstract.

**ACS special emphasis areas in lesson planning.** The CFI is planning a cross-country lesson. Using the ACS, identify which special emphasis areas apply (runway safety, wire strike avoidance, CFIT, etc.) and how they'd integrate those into the lesson beyond just the maneuver practice. Tests: ACS as lesson planning tool at a broader scope than SCN 1.6.

---

## A.8 Territory -- Regulatory Updates

Source: [L02 A.8 research](../L02-Knowledge/A.8_Regulatory-Updates/OVERVIEW.md)

A.8 is unique among the 13 topics: it's inherently dynamic. The content changes every time the FAA publishes a new rule, AC, or SAFO. Our approach designs around the *skill* of staying current, not the current state of regulations.

### Conceptual sub-areas

| Sub-area | What it covers | AC basis |
| --- | --- | --- |
| Why currency matters | Stale instruction is a safety problem, not just an administrative one | A.8 main |
| Where to check | Federal Register, FAA orders, ACs, SAFOs, InFOs, FAA website | A.8 main |
| How often to check | Continual monitoring vs occasional catch-up; triggered vs scheduled | A.8 main |
| Recognizing stale material | Catching yourself or others teaching outdated content | A.8 main |
| Source discrimination | Current primary guidance vs stale secondary summaries; official vs blog | A.8 main |
| Specific regulatory changes | BasicMed, NOTAM format changes, IBR, Part 107, SFARs | A.8 main (dynamic) |
| Provider update discipline | FIRC providers must update materials immediately when regulations change | A.8 main |

### How the 10 scenarios cover A.8

| Scenario | Sub-areas covered | Angle |
| --- | --- | --- |
| SCN 1.7: Old Lesson Plan vs Current | Recognizing stale material | Peer teaching from outdated PTS. Bridge with A.12. |
| SCN 1.8: BasicMed Confusion | Specific regulatory changes, source discrimination | Returning pilot with layered BasicMed misconceptions. Extended diagnostic (20 min). |
| SCN 1.9: NOTAM System Changes | Specific regulatory changes, how often to check | Student with outdated study guide. NOTAM format changes as specific content, but deeper lesson is source-currency discipline. |

**A.8 sub-areas with scenario coverage:** 4 of 7

**A.8 sub-areas without dedicated scenarios:**

| Sub-area | Coverage status | Notes |
| --- | --- | --- |
| Why currency matters | Micro lesson (M1-17) + knowledge check | Conceptual framing -- scenario not required |
| Where to check | Knowledge check (M1-18) | Factual/procedural -- knowledge check appropriate |
| Provider update discipline | Not covered and shouldn't be | This is about FIRC providers, not CFIs. Out of scope for learner-facing content. |

### Candidate scenarios for A.8 expansion

**Part 107 / Part 61 confusion.** A drone pilot asks the CFI about flying both manned and unmanned aircraft. The regulatory frameworks are different and the pilot is conflating them. Tests: source discrimination (which CFR applies?), specific regulatory knowledge, ability to say "I need to look that up."

**SFAR awareness.** The CFI is planning a lesson in an area covered by an active SFAR (e.g., volcanic activity, special flight rules area). The student's study materials don't mention it because they predate the SFAR. Tests: recognizing that regulations are layered (CFRs + SFARs + NOTAMs + TFRs), checking beyond the obvious sources.

**AC revision awareness.** The CFI is teaching stall recovery using an older technique (reduce AOA + full power immediately). The current AC and ACS emphasize reducing AOA as the priority, with power being situational. The CFI's lesson plan references an AC revision that's two versions behind. Tests: how often to check, recognizing stale material in your own practice.

**Handbook vs regulation conflict.** A student asks a question where the current Pilot's Handbook of Aeronautical Knowledge (PHAK) says one thing and the CFR says something slightly different (this happens with weather minimums, airspace, and certain definitions). The CFI must navigate the hierarchy: CFR > ACS > AC > handbook. Tests: source discrimination at a practical level.

---

## Cross-Topic Coverage

Some scenarios serve multiple topics. This is deliberate -- it mirrors reality, where a CFI encounter involves tools, standards, and currency simultaneously.

| Scenario | Primary topic | Secondary topics | Why multi-topic |
| --- | --- | --- | --- |
| SCN 1.6: TAA Transition Briefing | A.1 (TAA content) | A.12 (ACS lesson planning) | The content is avionics; the skill is standards-based instruction |
| SCN 1.7: Old Lesson Plan vs Current | A.8 (stale material) | A.12 (PTS vs ACS) | The stale material IS the old standard |
| SCN 1.4: Glass Cockpit Fixation | A.1 (automation fixation) | A.5 (safety trends -- near-miss data) | ADS-B blind spots are a current safety trend |

---

## What's Deliberately Excluded from Module 1

| Excluded area | Why | Where it lives instead |
| --- | --- | --- |
| Instrument approach procedures in detail | A.1 teaches automation hazards, not approach procedure knowledge. IPCs and approaches are Module 5 territory. | Module 5 (A.9) |
| Accident statistics and trends | A.5 data informs Module 2, not Module 1. Module 1 is about the current state of tools/standards/rules, not about what's going wrong. | Module 2 (A.5) |
| Ethics of teaching with outdated material | A.10 covers professional ethics. Module 1 treats currency as a technical discipline, not a moral one. | Module 2 (A.10) |
| Flight review procedures | A.9 covers evaluation events. Module 1's ACS content is about the framework, not the evaluation. | Module 5 (A.9) |
| Helicopter-specific automation | A.1's AC text mentions rotorcraft briefly. Our scenarios are fixed-wing GA. Rotorcraft scenarios would require different aircraft models and different failure modes. | Out of scope (GA fixed-wing focus) |
| Experimental/LSA avionics | The AC mentions "experimental aircraft" glass cockpits. Our scenarios assume certified avionics (G1000, GNS-series). Experimental avionics vary too widely to scenario-ize. | Out of scope |

---

## Coverage Summary

| Metric | A.1 | A.8 | A.12 | Total |
| --- | --- | --- | --- | --- |
| Conceptual sub-areas | 12 | 7 | 7 | 26 |
| Sub-areas with scenario coverage | 8 | 4 | 4 | 16 |
| Sub-areas knowledge-check only | 1 | 2 | 2 | 5 |
| Sub-areas uncovered | 3 | 1 | 1 | 5 |
| Existing scenarios | 6 primary | 3 primary | 3 primary | 10 (with overlaps) |
| Candidate expansion scenarios | 6 | 4 | 3 | 13 |
| Questions | 48 (4 files) | 16 (1 file) | 16 (1 file) | 80 |

The 5 uncovered sub-areas are:

1. **A.1 -- Automation dependency as skill atrophy** (partial coverage via SCN 1.4)
2. **A.1 -- Levels of automation / disconnect decision** (implicit in SCN 1.2)
3. **A.1 -- Manual proficiency coaching** (implicit in SCN 1.3)
4. **A.8 -- Provider update discipline** (out of scope for learner content)
5. **A.12 -- ACS as remediation tool** (genuine gap -- worth a scenario)

Of these, only #5 (ACS remediation) is a genuine gap that could strengthen the module. The others are either partially covered, implicit in existing scenarios, or out of scope.

---

## Cross-Module Connections

**Module 1 feeds forward to:**

- **Module 2:** CJ-2 (intervention ladder) introduced implicitly in Module 1 tutorial, becomes central in Module 2. ES-3 (ACS framework) from SCN 1.10 debrief skills feed Module 2's discussion activities.
- **Module 3:** AV-1/AV-2/AV-3 (automation skills) from Module 1 are prerequisites for Module 3's glass-cockpit LOC scenarios. A student fixated on automation in a base-to-final turn is a Module 1 problem in a Module 3 context.
- **Module 5:** ES-3 (ACS framework) from Module 1 is the foundation for Module 5's evaluation scenarios. RC-4 (regulatory currency) reinforced in Module 5 when evaluating whether a pilot's knowledge is current.

**Module 1 depends on:**

- Nothing. This is the opening module. It establishes the course mechanics and the technical baseline that everything else builds on.
