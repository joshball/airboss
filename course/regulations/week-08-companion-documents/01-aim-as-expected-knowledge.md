---
title: The AIM as expected knowledge -- non-regulatory but enforceable
week: 8
section_order: "01"
covers_regulations:
  - 91.13
  - 91.103
ties_to_knowledge_nodes: []
last_verified: 2026-04-29
---

# The AIM as expected knowledge

The Aeronautical Information Manual is the FAA's official statement of how flight is supposed to work in practice. It is *not* regulation. You cannot be cited for "violating the AIM." But every checkride examiner expects AIM material on every oral, and every FAA enforcement attorney knows how to use the AIM to support a §91.13 careless-or-reckless charge when a pilot deviates from AIM-described procedure and creates a hazard.

This is the document a pilot reads least and gets quizzed on most.

## What you'll be able to do

- State the AIM's regulatory status precisely (non-regulatory + enforceable via 91.13)
- Name the AIM's chapter structure cold, including which chapter owns airspace, ATC, weather, and emergency procedures
- Read an AIM citation (`AIM 5-1-7`) without confusion
- Predict, given a checkride question, which AIM chapter the examiner will cite
- Articulate to a student why the AIM matters even though "you can't be cited for the AIM"

## Why this matters

AIM-derived knowledge shows up in oral exams every time. Two-way comm failure procedure, transponder codes, hold entries, position reporting, runway incursion mitigation, wake turbulence avoidance, lost communications, special use airspace boundaries -- the *procedure* lives in the AIM, not in 14 CFR. The CFR says "comply with ATC instructions" and "exercise vigilance." The AIM says "after lost comm, fly the route assigned, expected, or filed; squawk 7600; descend per the clearance limit and the EFC." When an examiner asks "what do you do at lost comm?" the answer they expect comes from AIM 6-4, not from §91.185 alone.

The trap is that pilots who only studied for the knowledge test treat the AIM as optional reading. Then they sit a checkride and discover the examiner expects fluency they never built. The AIM is required reading the same way the FAR is required reading -- just for a different reason.

## The discovery question

Suppose you're flying VFR into Class C airspace. Your radio fails halfway to the airport. The CFR is short on this: §91.129 says you must establish two-way radio communication. You can't. Now what?

Pause.

The CFR doesn't tell you. The CFR doesn't say what frequency to monitor, what transponder code to squawk, what light gun signals mean, where to enter the pattern, or how to indicate to the tower that you've lost comm. Every one of those answers lives in the AIM:

- AIM 4-1-13 -- pilot/controller roles, including lost-comm responsibilities
- AIM 4-2-13 -- IFR communications failures (relevant for IFR; VFR pilots cross-reference)
- AIM 6-4 -- two-way radio communications failure
- AIM 4-3-13 -- traffic patterns and how to enter when lost comm
- Pilot/Controller Glossary -- light gun signals (steady green, flashing green, etc.)

When the examiner says "your radio just failed -- now what?" the model answer integrates the CFR (§91.129, §91.185) with the AIM (procedure, light guns, pattern entry). A pilot who quotes only the CFR misses 70% of the answer.

## The regulatory status of the AIM, precisely

The FAA has been clear in writing about what the AIM is and is not. From the AIM's own preamble:

> "This manual is designed to provide the aviation community with basic flight information and ATC procedures for use in the National Airspace System (NAS) of the United States. It also contains items of interest to pilots concerning health and medical facts, factors affecting flight safety, a pilot/controller glossary of terms used in the ATC System, and information on safety, accident, and hazard reporting."

The AIM is **not regulation**. It is the FAA's official guidance on procedure. But the AIM is enforceable indirectly through three pathways:

```text
AIM enforceability pathways

1. §91.13 Careless or reckless operation
   A pilot who deviates from AIM procedure in a way that creates a
   hazard can be cited under §91.13. The AIM is admissible evidence
   of what reasonable practice looks like.

2. ATC instructions (§91.123)
   Many AIM procedures are operationalized as ATC clearances. When
   ATC issues an instruction the AIM has trained the controller to
   issue, deviating from the instruction violates §91.123.

3. Implied incorporation
   Some FARs reference AIM procedures by silent expectation. §91.103
   "all available information" -- the Walker letter (2017) and
   AC 91-92 read this to incorporate the briefing standards in
   AIM 7-1, including DUATS / EFB use.
```

Saying "the AIM requires X" in an oral exam is technically wrong (it's not regulation). Saying "the AIM describes the procedure as X, and deviation could support a §91.13 charge if the deviation creates a hazard" is correct and is what examiners expect from a CFI-track candidate.

## The structure of the AIM

The AIM is organized into ten chapters plus the Pilot/Controller Glossary. Each chapter divides into sections; each section divides into paragraphs. The citation format is `AIM <chapter>-<section>-<paragraph>`.

```text
AIM
+-- Chapter 1: Air Navigation                     <- VOR, GPS, RNAV, area nav
|   1-1: Navigation Aids
|   1-2: Performance-Based Navigation (PBN) and RNAV
+-- Chapter 2: Aeronautical Lighting and Other Airport Visual Aids
|   2-1: Airport Lighting
|   2-2: Air Navigation and Obstruction Lighting
|   2-3: Airport Marking Aids and Signs
+-- Chapter 3: Airspace                            <- Class A through G
|   3-1: General
|   3-2: Controlled Airspace
|   3-3: Class G Airspace
|   3-4: Special Use Airspace
|   3-5: Other Airspace Areas
+-- Chapter 4: Air Traffic Control                 <- services, clearances, comms
|   4-1: Services Available to Pilots
|   4-2: Radio Communications Phraseology and Techniques
|   4-3: Airport Operations                        <- pattern, runway use
|   4-4: ATC Clearances and Aircraft Separation
|   4-5: Surveillance Systems
+-- Chapter 5: Air Traffic Procedures              <- flight plans, IFR, holds
|   5-1: Preflight                                 <- briefing, filing
|   5-2: Departure Procedures
|   5-3: En Route Procedures
|   5-4: Arrival Procedures                        <- approaches, holds
|   5-5: Pilot/Controller Roles and Responsibilities
+-- Chapter 6: Emergency Procedures                <- lost comm, hijack, ELT
|   6-1: General
|   6-2: Emergency Services Available to Pilots
|   6-3: Distress and Urgency Procedures
|   6-4: Two-way Radio Communications Failure
|   6-5: Emergency Frequencies and Squawk Codes
+-- Chapter 7: Safety of Flight                    <- weather, hazards, wake
|   7-1: Meteorology
|   7-2: Altimeter Setting Procedures
|   7-3: Wake Turbulence
|   7-4: Bird Hazards and Flight Over National Refuges
|   7-5: Potential Flight Hazards
|   7-6: Safety, Accident, and Hazard Reports
+-- Chapter 8: Medical Facts for Pilots            <- hypoxia, fatigue, vision
+-- Chapter 9: Aeronautical Charts and Related Publications
+-- Chapter 10: Helicopter Operations

Pilot/Controller Glossary  <- the canonical aviation dictionary
```

The chapter pattern repeats: navigation -> lighting -> airspace -> ATC -> procedures -> emergencies -> safety -> medical -> charts -> helicopters. Most pilot-day questions live in chapters 3 (airspace), 4 (ATC), 5 (procedures), and 6 (emergencies). Most weather questions live in chapter 7. Almost no question lives in chapters 8-10 unless it's specifically about that topic.

## How to read an AIM citation

`AIM 5-1-7` parses as:

- **5** -- chapter 5 (Air Traffic Procedures)
- **1** -- section 1 (Preflight)
- **7** -- paragraph 7 (Adherence to Clearance)

The hyphens are separators. This is *not* a CFR citation despite surface similarity. A CFR citation uses §, like §91.129 (Part 91, section 129). An AIM citation uses Chapter-Section-Paragraph and never uses §.

`AIM 4-3-3` -- chapter 4, section 3 (Airport Operations), paragraph 3 (Traffic Patterns).
`AIM 6-4-1` -- chapter 6, section 4 (Two-way Radio Communications Failure), paragraph 1 (general policy).
`AIM 7-1-2` -- chapter 7, section 1 (Meteorology), paragraph 2 (FAA Weather Services).

## What lives where -- the pilot's reference map

If you build a mental map of which AIM chapter owns which question, you can find the answer in 30 seconds during a checkride. The map:

| Question type                                      | Chapter / section         |
| -------------------------------------------------- | ------------------------- |
| Class B/C/D entry requirements (procedural detail) | AIM 3-2                   |
| VFR cloud clearances by airspace                   | AIM 3-1, 3-2, 3-3         |
| Special use airspace (MOA, restricted, prohibited) | AIM 3-4                   |
| TFRs                                               | AIM 3-5                   |
| ATC services available (flight following, etc.)    | AIM 4-1                   |
| Radio phraseology and readback                     | AIM 4-2                   |
| Traffic patterns and runway use                    | AIM 4-3                   |
| Position reporting                                 | AIM 4-2-3, 4-2-4          |
| Holding entries and procedures                     | AIM 5-3-7                 |
| Approach procedures and circling                   | AIM 5-4                   |
| Lost communications procedure                      | AIM 6-4 + §91.185 IFR     |
| Transponder emergency codes (7500/7600/7700)       | AIM 6-3, 6-5              |
| Light gun signals                                  | Pilot/Controller Glossary |
| ELT procedures and false alarms                    | AIM 6-2                   |
| Weather services and self-briefing                 | AIM 7-1                   |
| Wake turbulence avoidance                          | AIM 7-3                   |
| Mountain flying and density altitude               | AIM 7-5                   |
| Hypoxia, dehydration, fatigue                      | AIM 8-1                   |
| Sectional chart legend                             | AIM 9-1                   |

A working CFI checks the AIM weekly. A working pilot reads the AIM through at least once a year. A returning pilot rebuilding skills often reads chapters 4-7 cover to cover before their flight review.

## AIM revision and currency

The AIM is published by the FAA and revised on a roughly six-month cadence -- updates typically post in April and October. The current edition is dated and labeled. You can read the live AIM at the AIM, and the FAA also publishes the change-summary document so you can see what moved version-to-version.

A snapshot from 2018 will be outdated in dozens of ways by 2026. Always check the current edition. Outdated AIM material that conflicts with current procedure can be cited *against* the pilot in an enforcement action -- the FAA's position is "the current AIM is what governs."

The trap: ASA test prep books and many third-party study guides quote AIM material that may be one or two revisions stale. The book's version of the procedure may have been correct when published and incorrect now. Verify against the live AIM before relying on a paraphrase.

## What the AIM is not

The AIM is not the source for:

- **Regulatory minimum requirements.** Those live in 14 CFR. The AIM tells you procedure; the FAR tells you the legal floor.
- **Aircraft operating limitations.** Those live in the POH/AFM.
- **Currency requirements for pilots.** Those live in 14 CFR Part 61.
- **Weather minimum standards.** §91.155 sets the legal minimums; the AIM describes how to comply with them.
- **Equipment requirements.** §91.205, §91.207, §91.213 set those; the AIM doesn't.

When the regulation and the AIM appear to disagree, the regulation governs as a matter of law. (The AIM rarely disagrees with the regulation; usually the AIM elaborates *how* to comply.)

## Common misreadings

- **"The AIM is regulation."** Wrong. The AIM is *expected practice*. Saying "the AIM requires me to..." is technically incorrect and an examiner will mark it. Say "the AIM describes the procedure as..." or "the FAA's expected practice per AIM is..."
- **"You can't be cited for violating the AIM."** Half-true. You can't be cited *directly* under "the AIM." You *can* be cited under §91.13 (careless or reckless) when an AIM deviation creates a hazard, or under §91.123 (compliance with ATC instructions) when ATC issued an AIM-conforming instruction you didn't follow.
- **"The AIM is the only place ATC procedure lives."** Wrong. ATC procedure also lives in 14 CFR Part 91 subparts B and C, in 7110.65 (the Air Traffic Controller's Handbook -- the controller's bible, available to pilots), and in the various TERPs and IAP procedures publications.
- **"Reading the AIM is for checkride prep only."** Wrong. The AIM is the working pilot's procedural reference. CFIs cite it weekly; cross-country pilots reference Chapter 5 and 7 routinely.
- **"AIM revisions don't really change anything."** Wrong. AIM revisions in 2020-2024 covered substantive procedural changes including PBN updates, ADS-B operations, runway incursion procedures, and weather-products consolidation. A pilot relying on a 2018 AIM snapshot is operating on stale procedure.
- **"The Pilot/Controller Glossary is just a dictionary."** Half-true. It's the canonical FAA vocabulary, and many oral-exam questions are testing whether the pilot uses the canonical terminology vs. a folk paraphrase. "Cleared for the option" has a specific PCG meaning; "with the numbers" has a specific PCG meaning. Saying it any other way risks miscommunication and an examiner mark.

## Where this lesson sits

This is the first lesson of Week 8. It positions the AIM as the second pillar of the regulatory ecosystem -- the one that's expected even though it's not law. The next lesson treats Advisory Circulars; the third treats Chief Counsel interpretations; the fourth covers other titles (49 CFR); the fifth integrates them all.

## Related sections

- §91.13 -- careless or reckless (the indirect enforcement path for AIM deviations)
- §91.123 -- compliance with ATC instructions
- §91.103 -- "all available information" (interpreted by the Walker letter and AC 91-92)
- §91.185 -- IFR operations: two-way radio communications failure (read alongside AIM 6-4)
- AC 91-92 -- Pilot's Guide to a Preflight Briefing (the AC that operationalizes 91.103 alongside the AIM)
- Week 1 [03-companion-documents.md](../week-01-architecture/03-companion-documents.md) -- the introduction this lesson goes deeper than
- Week 8 [02-advisory-circulars.md](02-advisory-circulars.md) -- the Advisory Circulars
- Week 8 [05-where-the-real-answer-lives.md](05-where-the-real-answer-lives.md) -- the integration

## Drills

| Question                                                            | Where to look                                           |
| ------------------------------------------------------------------- | ------------------------------------------------------- |
| What's the procedure for two-way radio comm failure VFR?            | AIM 6-4 + light gun signals (Pilot/Controller Glossary) |
| What hold entry do I use for a hold at the IAF?                     | AIM 5-3-7                                               |
| What's the standard pattern altitude at a non-towered airport?      | AIM 4-3-3 + AC 90-66                                    |
| What does "cleared for the option" mean precisely?                  | Pilot/Controller Glossary                               |
| What transponder code do I squawk for hijack? Lost comm? Emergency? | AIM 6-3, 6-5                                            |
| What's the wake turbulence separation behind a heavy on takeoff?    | AIM 7-3                                                 |
| What's the recommended pre-takeoff brief?                           | AIM 4-3-10 + AC 91-92                                   |
| What VFR weather minimums apply in Class E below 10,000?            | §91.155 (regulation) + AIM 3-2 (procedural detail)      |
| What's "ATC services available" mean for VFR pilots?                | AIM 4-1                                                 |
| What does the AIM say about scud running and VFR-into-IMC?          | AIM 7-5                                                 |

## Live source

- the AIM -- the AIM, current edition
- AIM Chapter 1 -- Chapter 1 (Air Navigation)
- AIM Chapter 4 -- Chapter 4 (Air Traffic Control)
- AIM Chapter 5 -- Chapter 5 (Air Traffic Procedures)
- AIM Chapter 6 -- Chapter 6 (Emergency Procedures)
- AIM Chapter 7 -- Chapter 7 (Safety of Flight)
- [@cite](airboss-ref:regs/cfr-14/91/13?at=2026) -- §91.13 careless or reckless
- [@cite](airboss-ref:regs/cfr-14/91/103?at=2026) -- §91.103 preflight action
