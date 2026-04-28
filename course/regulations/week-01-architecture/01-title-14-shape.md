---
title: The structural map of Title 14
week: 1
section_order: "01"
covers_regulations: []
ties_to_knowledge_nodes: []
---

# The structural map of Title 14

This is the foundational lesson of the course. Everything downstream rests on it. We are *not* learning rules yet. We are learning the shape of the document those rules live in.

A pilot who has the structural map can find any rule in 60 seconds. A pilot without it has to memorize. Memorization is brittle; the map is durable.

## What you'll be able to do

- Name the parts of Title 14 that affect pilots without notes
- Explain the difference between a chapter, a part, a subpart, and a section
- Predict where a rule lives based on the kind of question being asked
- Identify when a rule lives outside Title 14 (49 CFR, 49 USC, etc.) and where to look

## Why this matters

The FARs are not memorized in isolation by working pilots. They are *located*. A CFI on a checkride doesn't recite 91.213 from memory; they know that "inoperative equipment" lives in subpart C of Part 91 and they look it up to read carefully. The skill is the lookup, not the recall. This week builds the index.

## The discovery question

Before we name anything: think about the FAA as an institution that has accumulated rules over a century. Different rules apply to different things — pilots, aircraft, schools, airlines, repair stations, medical examiners, drone operators, foreign carriers. If you were organizing those rules into a single book, how would you split them?

Pause. Think about it.

A reasonable answer:

- One section per *kind of regulated thing* (pilots / aircraft / training schools / airlines / repair shops)
- Each kind broken into smaller groups by *what aspect of the thing* (eligibility, operations, equipment, maintenance, special cases)
- Each group broken into individual rules
- Cross-references where rules touch each other

That's exactly the structure. Now let's reveal it.

## The hierarchy

Title 14 is one of fifty Titles in the Code of Federal Regulations (CFR). The CFR is the codification of every federal regulation in the United States. Title 14 is *Aeronautics and Space*.

```text
United States Code of Federal Regulations
+-- Title 14: Aeronautics and Space
    +-- Chapter I: Federal Aviation Administration, DOT
    |   +-- Subchapter A: Definitions and General Requirements
    |   +-- Subchapter B: Procedural Rules
    |   +-- Subchapter C: Aircraft (Parts 21-49)
    |   +-- Subchapter D: Airmen (Parts 60-68)        <- "the pilot"
    |   +-- Subchapter E: Airspace (Parts 71-77)
    |   +-- Subchapter F: Air Traffic and General Operating Rules (Parts 91-105)  <- "the flight"
    |   +-- Subchapter G: Air Carriers and Operators for Compensation or Hire (Parts 110-139)  <- "the operation"
    |   +-- Subchapter H: Schools and Other Certificated Agencies (Parts 140-147)  <- "the operation"
    |   +-- Subchapter I: Airports (Parts 150-169)
    |   +-- Subchapter J: Navigational Facilities (Parts 170-171)
    |   +-- Subchapter K: Administrative Regulations (Parts 183-185)
    |   +-- Subchapter L: Reserved
    |   +-- Subchapter M: Reserved
    |   +-- Subchapter N: War Risk Insurance (Parts 198-199)
    +-- Chapter II: Office of the Secretary, DOT (Aviation Proceedings)
    +-- Chapter III: Commercial Space Transportation, FAA, DOT
    +-- Chapter V: National Aeronautics and Space Administration
    +-- Chapter VI: Air Transportation System Stabilization (historical)
```

You will live in **Chapter I, Subchapters D, F, G, and H** for the rest of your flying career. The other chapters and subchapters either don't apply to you (NASA, commercial space, war risk insurance) or apply rarely (airports, navaids, administrative).

### The granularity below Subchapter

```text
Subchapter F (Air Traffic and General Operating Rules)
+-- Part 91: General Operating and Flight Rules
|   +-- Subpart A: General                                    <- 91.1 to 91.25
|   +-- Subpart B: Flight Rules                               <- 91.101 to 91.193
|   |   +-- Section 91.103: Preflight action
|   |       +-- (a) For a flight under IFR or a flight not in the vicinity ...
|   |           +-- (1) weather reports and forecasts...
|   |           +-- (2) [...]
|   +-- Subpart C: Equipment, Instrument, and Certificate Requirements
|   +-- Subpart D: Special Flight Operations
|   +-- Subpart E: Maintenance, Preventive Maintenance, and Alterations
|   +-- Subpart F: Large and Turbine-Powered Multiengine Airplanes
|   +-- Subpart G through N: progressively more specialized
+-- Part 97: Standard Instrument Procedures
+-- Part 101: Moored Balloons, Kites, Amateur Rockets, Unmanned Free Balloons
+-- Part 103: Ultralight Vehicles
+-- Part 105: Parachute Operations
```

Each level is named, not numbered the same way:

| Level       | Example        | What it is                                            |
| ----------- | -------------- | ----------------------------------------------------- |
| Title       | Title 14       | The whole subject (aeronautics and space)             |
| Chapter     | Chapter I      | Which agency wrote it (the FAA)                       |
| Subchapter  | Subchapter F   | Which broad category (air traffic / general operating)|
| Part        | Part 91        | A specific regulatory regime                          |
| Subpart     | Subpart B      | A topical group within the Part                       |
| Section     | §91.103        | One specific rule                                     |
| Paragraph   | (a)(1)         | Sub-clauses of the section                            |

You read a citation as `Part.Section(paragraph)(sub)(item)`. We cover that mechanically in [02-how-to-read-a-citation.md](02-how-to-read-a-citation.md).

## The parts that matter to you

Out of ~270 distinct parts in Title 14, only about 15 affect a working pilot directly. The rest exist for airlines, manufacturers, repair stations, NASA, drone operators, etc.

| Part      | Title                                                              | Why it matters to you                            |
| --------- | ------------------------------------------------------------------ | ------------------------------------------------ |
| **1**     | Definitions and abbreviations                                       | The FAA's dictionary. You will reference it constantly |
| 21        | Certification procedures for products and articles                  | Aircraft certification (rare CFI need)           |
| 23 / 25 / 27 / 29 | Airworthiness standards (small / large / rotorcraft normal / transport) | Background; you don't memorize these |
| 39        | Airworthiness directives                                            | ADs apply to you if you fly an airplane          |
| 43        | Maintenance, preventive maintenance, rebuilding, alteration         | What pilots can and can't do to airplanes        |
| **61**    | Certification: pilots, flight instructors, ground instructors       | **The pilot.** Most-used part you'll ever read   |
| 65        | Certification: airmen other than flight crewmembers                 | Mechanics, dispatchers, ATC                      |
| **67**    | Medical standards and certification                                 | Where your medical lives                         |
| 71        | Designation of class A, B, C, D, E airspace                         | Airspace classification                          |
| 77        | Safe, efficient use, and preservation of navigable airspace         | Obstruction standards                            |
| **91**    | General operating and flight rules                                  | **The flight.** Even more-used than 61          |
| 97        | Standard instrument procedures                                      | The legal home of every published approach       |
| 119       | Certification: air carriers and commercial operators                | Sets up Parts 121 / 125 / 135                    |
| 121       | Operating requirements: domestic, flag, supplemental ops            | Airline ops                                      |
| 125       | Certification and operations: airplanes 6,000+ lbs                  | Niche                                            |
| 135       | Operating requirements: commuter and on-demand ops                  | On-demand commercial                             |
| **141**   | Pilot schools                                                       | **The operation.** Structured training          |
| 142       | Training centers                                                    | Type-rating training centers                     |
| 145       | Repair stations                                                     | Where overhauls live                             |
| 183       | Representatives of the Administrator                                | DPEs, CFIs as designees                          |

Read the bold ones in their entirety eventually. Read the others when a specific question demands it.

## What's NOT in Title 14 but you'll touch anyway

A surprising amount of pilot-relevant law lives outside Title 14. Knowing where to look is half the skill:

| Source                        | What it covers                                                         | Where it lives                  |
| ----------------------------- | ---------------------------------------------------------------------- | ------------------------------- |
| **49 CFR 830**                | NTSB accident / incident reporting                                      | Title 49, NOT 14                |
| **49 CFR 1552**               | TSA flight training rule (foreign students)                            | Title 49                        |
| **49 USC 44703**              | BasicMed statutory basis (the underlying authority for 14 CFR 61.113(i)) | The U.S. Code, not the CFR    |
| **AIM**                       | Aeronautical Information Manual -- procedural guidance                  | FAA-published, NOT a regulation but enforceable indirectly via 91.13 |
| **ACs**                       | Advisory Circulars -- non-binding guidance                              | FAA-published                   |
| **Chief Counsel letters**     | Authoritative interpretation when regulation is ambiguous              | FAA-published                   |
| **NTSB Board orders**         | Case-law-equivalent enforcement precedent                               | NTSB-published                  |
| **FAA Order 2150.3**          | FAA enforcement handbook                                                | FAA-published                   |
| **FAA Order 8900.1**          | Flight Standards Information Management System (FSDO operations)        | FAA-published                   |

We treat these as **companion documents** -- next lesson, [03-companion-documents.md](03-companion-documents.md).

## Where the rules live -- a quick mental model

When you encounter a question, ask yourself: *what kind of thing is the question about?*

| Kind of question                                       | Where to look first |
| ------------------------------------------------------ | ------------------- |
| "Can this person legally do X?" (cert / currency / endorsement) | Part 61             |
| "Is this person medically allowed to fly?"             | Part 67 (or BasicMed via 61.113(i)) |
| "Is this *flight* allowed under these conditions?"     | Part 91             |
| "Does this aircraft have the required equipment?"      | Part 91 subpart C   |
| "When is the next inspection due?"                     | Part 91 subpart E (or Part 43) |
| "What can I as a pilot do to the airplane myself?"     | Part 43 appendix A  |
| "Is this approach legal?"                              | Part 97 + Part 91 (91.175) |
| "Is this airspace this class?"                         | Part 71             |
| "Does this AD apply?"                                  | Part 39             |
| "Is this a 91, 135, 141, or 121 operation?"            | Part 119 + the relevant operating part |
| "Does my school need to be 141?"                       | Part 141 (vs Part 61)|
| "Did something happen that I have to report?"          | 49 CFR 830 (NTSB)   |

We refine this map all course. By Week 10 you'll do it without the table.

## Common misreadings

- **"Part 91 is for non-commercial flying."** Wrong. Part 91 applies to *every* civil flight in U.S. airspace, including 135 and 141 operations. Part 135 / 141 / 121 *add* requirements on top of 91; they don't replace it. A 135 charter still has to comply with 91.103 preflight action; it just has 135.213 preflight requirements as well. **Mental model:** 91 is the floor; 135 / 141 / 121 sit on top.
- **"Subchapter D is only Part 61."** Wrong. Subchapter D (Airmen) contains Parts 60 (training devices), 61 (pilot cert), 63 (flight crew other than pilots), 65 (mechanics, dispatchers, ATC), 67 (medical), 68 (BasicMed). When a question is about pilot certification you're in 61. When it's about your medical you're in 67. Both are in subchapter D.
- **"Airspace lives in Part 91."** Partially. Part 71 *defines* airspace classes (Class B, C, D, E, G dimensions and where each one applies). Part 91 *governs operations within* airspace (VFR weather minimums, equipment, communications). When you want to know whether a specific airport has Class D, look at Part 71 (and the chart). When you want to know what you need to operate in Class D, look at Part 91.
- **"NTSB rules are in Title 14."** Wrong. The NTSB is a separate agency; their rules live in **Title 49** (Transportation). Specifically, accident and incident reporting is **49 CFR 830**. People miss this because the FAA and NTSB feel related; they're institutionally distinct.

## Drills (paper, before flash cards)

Cover the answers and try these from memory:

1. Which part contains pilot certification and currency? **Part 61**
2. Which part contains the rules that apply to every civil flight in U.S. airspace? **Part 91**
3. Which part defines the airspace classes (B, C, D, E)? **Part 71**
4. Which part governs structured pilot schools? **Part 141**
5. Which part covers on-demand commercial operations? **Part 135**
6. Where do NTSB accident/incident reporting requirements live? **49 CFR 830** (not Title 14)
7. Where does BasicMed live in the CFR? **14 CFR 68**, with statutory basis in 49 USC 44703
8. Which part covers what a pilot can do to an airplane themselves (preventive maintenance)? **Part 43, appendix A**
9. Which part contains the standard instrument procedures (the published approaches)? **Part 97**
10. Where do you look for an Advisory Circular's regulatory force? **Trick. ACs are guidance, not regulation. Their force comes from being incorporated by 91.13 (careless or reckless) when an FAA enforcement action argues the AC sets the standard of care.**

## Where this lesson sits

This is the only lesson in the course that doesn't dive into a specific regulation. It's the map. The next three lessons in this week build on it: citation parsing ([02](02-how-to-read-a-citation.md)), companion documents ([03](03-companion-documents.md)), and the framing we'll use for the rest of the course ([04](04-the-pilot-the-flight-the-operation.md)).

After this week, every regulation we look at will have a structural address you already know. When a Week 4 lesson says "this is in 91 subpart B," you should already feel where that is in the map without thinking.

## Related

- Knowledge graph (TBD when authored): `reg-title-14-architecture` -- proposed node capturing the structural hierarchy
- Live source: [14 CFR (eCFR)](https://www.ecfr.gov/current/title-14)
- Live source: [Part 91](airboss-ref:regs/cfr-14/91?at=2026)
