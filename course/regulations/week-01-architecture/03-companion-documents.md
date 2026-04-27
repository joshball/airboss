---
title: Companion documents -- AIM, ACs, Chief Counsel, NTSB
week: 1
section_order: "03"
covers_regulations:
  - 91.13
ties_to_knowledge_nodes: []
---

# Companion documents

The CFR is not the only regulatory document a pilot needs to know. Title 14 sits inside an ecosystem of guidance, interpretation, and case law that defines what the regulations actually mean in practice. Pilots who only read the CFR will lose oral exams. Pilots who only read summaries (the *Pilot's Handbook*, ASA test prep guides) will misread the underlying regulations.

This lesson tours the ecosystem.

## What you'll be able to do

- Distinguish among regulation, guidance, expected knowledge, interpretation, and case law
- Locate the right document type for a given regulatory question
- Recognize when a document is enforceable vs. advisory
- Identify the AIM, the major ACs, and the famous Chief Counsel letters by name

## Why this matters

A surprisingly common pattern in oral exams: the examiner reads a regulation that has multiple plausible interpretations, then asks "which interpretation is correct?" The CFR text alone won't tell you. You have to know that the FAA Chief Counsel issued a letter resolving the ambiguity, or that an NTSB Board order set the precedent, or that an AC describes the standard practice.

Working pilots in real-world enforcement: you will hear "the AIM says..." and "the Chief Counsel held in..." cited in conversations. Knowing the difference is the difference between sounding like a CFI and sounding like a hangar lawyer.

## The discovery question

Suppose a regulation says "all available information." That phrase appears in §91.103(a). What does it actually require? Does the FAA expect you to call ATC for known traffic? Read every NOTAM in the surrounding 50 miles? Read TFRs for the entire route, or just relevant ones?

The CFR text gives no answer. The phrase "all available information" is intentionally elastic. So where does the actual standard come from?

Answer: from a Chief Counsel letter (the **Walker letter**, 2017) and from FAA case-law precedent in Administrator v. ___ enforcement actions, and from AC 91-92 ("Pilot's Guide to a Preflight Briefing") which describes recommended practice.

The CFR sets the legal frame. The companion documents fill in what compliance actually looks like.

## The five document types

| Type            | Source                  | Force                                          | When to consult |
| --------------- | ----------------------- | ---------------------------------------------- | --------------- |
| **Regulation**  | CFR (FAA + NTSB sections) | Binding law                                    | Always first    |
| **Guidance**    | Advisory Circulars       | Non-binding; describes one acceptable means    | When the regulation says "in a manner approved by the Administrator" or similar |
| **Expected**    | AIM                     | Non-regulatory; deviation can support a 91.13 charge | When ATC procedures, weather, or airspace operations are at issue |
| **Interpretive**| Chief Counsel letters    | Binds the FAA's enforcement position            | When a regulation's meaning is contested |
| **Case law**    | NTSB Board orders        | Binding precedent on FAA enforcement           | When defending or arguing an interpretation |

Each of these is a different kind of authority. Mistaking one for another is the most common technical mistake on oral exams.

## Regulations: 14 CFR (and 49 CFR)

The regulations themselves -- covered in lessons [01](01-title-14-shape.md) and [02](02-how-to-read-a-citation.md). They are written by the FAA (or NTSB for 49 CFR Part 830), they are codified, they have the force of law. When they conflict with anything else, they win.

**Where to read them:** [eCFR](https://www.ecfr.gov/current/title-14). The eCFR is updated daily; printed copies and PDF snapshots go stale.

## The AIM (Aeronautical Information Manual)

The AIM is the FAA's official guide to "basic flight information and ATC procedures." It is **not regulation** -- you cannot be cited for "violating the AIM." But:

- It is the FAA's official statement of what good practice looks like
- A pilot who deviates from AIM procedure is doing something the FAA has officially recommended against
- That deviation can support a §91.13 (careless or reckless) enforcement action *if* the deviation creates a safety hazard
- ATC controllers are trained to expect AIM-conforming behavior; non-AIM behavior generates ATC confusion which is itself unsafe

So the AIM is *practically* enforceable through 91.13, even if not directly enforceable on its own.

### AIM structure

The AIM is organized into chapters, sections, and paragraphs:

```text
AIM
+-- Chapter 1: Air Navigation
|   +-- Section 1: Navigation Aids
|   |   +-- 1-1-1, 1-1-2, ...
|   +-- Section 2: ...
+-- Chapter 2: Aeronautical Lighting and Other Airport Visual Aids
+-- Chapter 3: Airspace
+-- Chapter 4: Air Traffic Control
+-- Chapter 5: Air Traffic Procedures        <- IFR ops, holds, approaches
+-- Chapter 6: Emergency Procedures
+-- Chapter 7: Safety of Flight              <- weather, wake turbulence, bird hazards
+-- Chapter 8: Medical Facts for Pilots
+-- Chapter 9: Aeronautical Charts
+-- Chapter 10: Helicopter Operations
+-- Pilot/Controller Glossary                <- the canonical aviation dictionary
```

### Reading an AIM citation

`AIM 5-1-7` reads as "AIM chapter 5, section 1, paragraph 7" — the paragraph titled "Adherence to Clearance" within "Preflight" within "Air Traffic Procedures." The hyphens are separators; this is *not* a CFR citation despite the surface similarity.

### What lives in the AIM that you'll reference often

- **Chapter 4** — ATC procedures, services, contact procedures
- **Chapter 5, Section 1** — Preflight (including filing IFR, the 1-2-3 rule's procedural details)
- **Chapter 5, Section 4** — Approach procedures
- **Chapter 6** — Emergency procedures, two-way comm failure procedure, transponder codes
- **Chapter 7, Section 1** — Weather information sources
- **Pilot/Controller Glossary** — the dictionary, especially for terms used by ATC

### AIM revision

The AIM is published by the FAA and revised every six months (April and October usually). The version that matters is the current one — never use a snapshot from years ago. Currently published: [faa.gov/air_traffic/publications/atpubs/aim_html](https://www.faa.gov/air_traffic/publications/atpubs/aim_html).

## Advisory Circulars (ACs)

ACs are non-binding guidance. They describe the FAA's recommended way of complying with a regulation. They are numbered to mirror the CFR Part they address:

```text
AC NN-NN
   ^   ^
   |   +-- sequence number within that subject area
   +------ subject area, roughly mapping to a CFR Part
```

| AC number | Topic                                    |
| --------- | ---------------------------------------- |
| AC 00-NN  | General                                  |
| AC 20-NN  | Aircraft (Part 21+ subjects)              |
| AC 60-NN  | Airmen (Part 60+ subjects)                |
| AC 61-NN  | Pilots (Part 61 subjects specifically)    |
| AC 90-NN  | Air traffic / general operating          |
| AC 91-NN  | Part 91 subjects                          |
| AC 120-NN | Part 121 / 135 subjects                   |
| AC 145-NN | Part 145 (repair stations)                |

ACs get revised. The revision letter is appended: `AC 61-65J`, `AC 61-65K`, etc. The current revision is what counts; a CFI signing endorsements in 2026 needs AC 61-65 in its current revision (J or later, depending on FAA cadence).

### ACs you'll cite often

| AC          | Title                                                  | When you'll need it |
| ----------- | ------------------------------------------------------ | ------------------- |
| AC 00-6     | Aviation Weather                                        | Weather decision lessons |
| AC 60-22    | Aeronautical Decision Making                            | ADM-related sections |
| AC 61-65    | Certification of Pilots and Flight & Ground Instructors | Endorsement reference for CFIs |
| AC 61-83    | Nationally Scheduled FAA-Approved Industry-Conducted FIRC | Reference for FIRC mechanics |
| AC 61-98    | Currency Requirements and Guidance for the Flight Review and IPC | Currency lessons |
| AC 90-66    | Non-Towered Airport Flight Operations                    | Pattern operations |
| AC 91-79    | Mitigating the Risks of a Runway Overrun Upon Landing    | Landing technique |
| AC 91-92    | Pilot's Guide to a Preflight Briefing                    | What "all available information" means in 91.103 |
| AC 120-71   | Standard Operating Procedures and Pilot Monitoring Duties | 121/135 awareness |

### When an AC actually matters

The phrase to watch for in a regulation is "**in a manner approved by the Administrator**" or "**acceptable to the Administrator**." When you see that, the regulation is delegating its specifics to the FAA, and the AC describes what the FAA has approved or accepts. Compliance with the AC is one acceptable means; an alternative method is also legal if it actually meets the regulation, but the AC is the safe path.

## Chief Counsel interpretive letters

The FAA Chief Counsel periodically issues letters interpreting a regulation when its meaning is contested. These letters bind the FAA's enforcement position -- i.e. if a Chief Counsel letter says "the rule means X," the FAA will not later prosecute someone for following X.

Letters are public, indexed by recipient name and year:

| Letter                | Year | What it settled                                                              |
| --------------------- | ---- | ---------------------------------------------------------------------------- |
| **Mangiamele**        | 2009 | §61.113 cost-sharing -- "common purpose" requires the pilot have an actual independent reason to be at the destination, not just to share the trip |
| **Hicks**             | 2010 | §61.51 / "acting as PIC" -- a CFI manipulating the controls is acting as PIC; a private pilot rated and current can simultaneously log PIC time |
| **Walker**            | 2017 | §91.103 "all available information" -- includes information the pilot reasonably should have sought, not just information that arrived passively |
| **Murphy**            | 2014 | §61.51(e) PIC logging -- specifically when a CFI giving instruction may log PIC vs. when only "instruction given" is appropriate |

You can read these letters on the FAA's site. They're cited in oral exams the way case law is cited in legal exams: by the recipient's name.

### How to use a Chief Counsel letter

When a regulation is unclear and you need to know what compliance looks like:

1. Read the regulation literally
2. Search FAA Chief Counsel interpretations for that section
3. Find the letter that addresses the situation closest to yours
4. Note the date -- letters can be superseded by later letters or by NPRM rulemaking

Example: a private pilot wants to fly with a coworker and split fuel costs. Look up §61.113. The Chief Counsel's Mangiamele letter (2009) tells you that "common purpose" must be independent -- the trip needs to make sense for the pilot to make even without the passenger.

## NTSB Board orders (case law)

The NTSB hears appeals from FAA enforcement actions. Their decisions are precedent that binds the FAA. Cases are cited in the form `Administrator v. <name>` followed by the order number.

| Case                              | What it established                                 |
| --------------------------------- | --------------------------------------------------- |
| Administrator v. Merrell           | The §91.13 "careless or reckless" standard          |
| Administrator v. Lobeiko           | Refines the §91.13 careless standard                |
| Administrator v. Pirsch            | "Knowledge of weather" required by 91.103           |

Pilots don't usually cite NTSB orders in oral exams unless the examiner is specifically testing enforcement awareness (more in [Week 9 -- Enforcement](../week-09-enforcement/overview.md)).

## NTSB Part 830 -- the one regulation that's NOT in Title 14

Worth its own subsection because it's the most-missed regulation when pilots think only in Title 14.

**49 CFR Part 830** contains:

- §830.5 -- when to **immediately** notify the NTSB (accidents and serious incidents)
- §830.6 -- the information you must provide
- §830.10 -- preservation of wreckage
- §830.15 -- the written report (NTSB Form 6120.1)

This is the regulation that triggers when something goes wrong. Notice it lives in **Title 49**, not Title 14. The NTSB is institutionally distinct from the FAA; their rules live in their Title.

A pilot involved in any accident or one of the listed serious incidents has reporting obligations under 830, and those obligations exist whether or not the FAA is involved. Don't conflate "FAA enforcement" with "NTSB reporting" -- they are different processes triggered by different rules.

## TSA flight training rule (49 CFR Part 1552)

For CFIs only: if you provide flight training to a foreign student (someone who is not a U.S. citizen or permanent resident), the **Alien Flight Student Program** under 49 CFR Part 1552 requires you to verify their TSA approval before training. This is a category-specific rule; most flight training in the U.S. doesn't trigger it, but if a non-U.S.-citizen wants instruction, you have obligations.

## FAA Orders

FAA Orders are internal-agency documents that govern how the FAA operates -- how inspectors conduct ramp checks, how FSDOs handle enforcement, how DPEs administer practical tests. Pilots rarely cite them but should know they exist:

| Order        | What it covers                                       |
| ------------ | ---------------------------------------------------- |
| FAA Order 2150.3 | Compliance and enforcement program (the enforcement handbook) |
| FAA Order 8900.1 | Flight Standards Information Management System -- FSDO operations |
| FAA Order 8000.373 | Compliance philosophy -- the formal statement of when to use enforcement vs. compliance |

If you ever need to know how the FAA itself says it should investigate or prosecute, these orders are the source.

## Common misreadings

- **Thinking the AIM is regulation.** It is not. It is *expected practice* that becomes enforceable through 91.13 only when deviation creates a safety hazard. Telling an examiner "the AIM requires me to..." is technically wrong; "the AIM describes the procedure as..." is correct.
- **Thinking ACs are required.** ACs describe one acceptable means. Alternative compliance is legal if it actually meets the underlying regulation. An AC's force is "this is the FAA-blessed path" -- not "this is the only legal path."
- **Citing Chief Counsel letters as regulation.** They are *interpretation*. They tell you what the FAA enforces; they do not amend the rule. A new letter can supersede an old one.
- **Conflating NTSB Part 830 with the FAA.** Separate agency, different Title. When something goes wrong you have *both* an FAA dimension (enforcement, certificate action) *and* an NTSB dimension (reporting, investigation). Each is governed by its own regulation.
- **Using outdated AIM or AC.** Both are revised on rolling cadences. An out-of-date AC can have you signing an endorsement using language that no longer matches what the FAA expects.

## Drills

### Categorize each statement

For each, identify whether it's regulation, guidance (AC), expected practice (AIM), interpretation (Chief Counsel), or case law (NTSB):

| Statement                                                                     | Type |
| ----------------------------------------------------------------------------- | ---- |
| "The PIC must become familiar with all available information."                | Regulation (§91.103) |
| "Pilot self-briefing should include weather, NOTAMs, fuel, and alternates."   | Guidance (AC 91-92) |
| "ATC clearance readback must include the call sign and the clearance limit." | Expected (AIM 4-4-7) |
| "Common purpose under 61.113 requires an independent reason to fly."          | Interpretation (Mangiamele letter) |
| "Reckless operation requires a willful disregard for safety."                  | Case law (Administrator v. Lobeiko) |

### Locate the source

| Question                                                                       | Look in |
| ------------------------------------------------------------------------------ | ------- |
| What endorsement language do I use for a complex airplane signoff?              | AC 61-65 |
| When must I report an accident to the NTSB?                                    | 49 CFR 830.5 |
| What's the FAA's enforcement progression after a violation?                    | FAA Order 2150.3 |
| Is two-way ATC communication required for Class C?                             | §91.130 |
| What does "all available information" actually require?                        | §91.103 + Walker letter (2017) + AC 91-92 |
| Can I be cited for using non-standard ATC phraseology?                         | Indirectly via §91.13; AIM 4-2 describes standard phraseology |

## Where this lesson sits

Third of four foundation lessons in Week 1. After this you know: the structural map ([01](01-title-14-shape.md)), the citation syntax ([02](02-how-to-read-a-citation.md)), and the broader document ecosystem (this lesson). The fourth ([04-the-pilot-the-flight-the-operation.md](04-the-pilot-the-flight-the-operation.md)) is the framing that organizes the rest of the course.

## Related

- AIM live: [faa.gov/air_traffic/publications/atpubs/aim_html](https://www.faa.gov/air_traffic/publications/atpubs/aim_html)
- ACs live: [faa.gov/regulations_policies/advisory_circulars](https://www.faa.gov/regulations_policies/advisory_circulars/)
- Chief Counsel letters: [faa.gov/about/office_org/headquarters_offices/agc](https://www.faa.gov/about/office_org/headquarters_offices/agc/)
- NTSB Part 830: [ecfr.gov/current/title-49/subtitle-B/chapter-VIII/part-830](https://www.ecfr.gov/current/title-49/subtitle-B/chapter-VIII/part-830)
- [Week 8: Companion documents](../week-08-companion-documents/overview.md) -- this same material treated more deeply later
- [references/README.md](../references/README.md) -- the master index
