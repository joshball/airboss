---
title: Advisory Circulars -- numbering, currency, when an AC is the answer
week: 8
section_order: "02"
covers_regulations:
  - 61.31
  - 61.56
  - 61.57
  - 61.113
  - 91.103
  - 91.126
  - 91.155
ties_to_knowledge_nodes: []
last_verified: 2026-04-29
---

# Advisory Circulars

Advisory Circulars (ACs) are the FAA's way of saying "here is one acceptable means of complying with this regulation." They are not binding; an alternative method that meets the underlying CFR is also legal. But for many regulations the AC is the *only* practical guide to what compliance looks like, and FSDOs treat AC content as the de facto standard. CFIs sign endorsements using AC 61-65 wording even though no regulation requires that exact wording, because the alternative -- writing your own endorsement language and defending it -- is harder than reading the AC.

This lesson is the deeper treatment promised in Week 1's [03-companion-documents.md](../week-01-architecture/03-companion-documents.md). We unpack the AC numbering scheme, the revision-tracking conventions, where to find the current version, and the high-yield ACs every working pilot or CFI references.

## What you'll be able to do

- Decode an AC number to predict the CFR Part it covers and the topic
- Find the current revision of any AC and recognize when a stale revision is being cited
- Recognize the trigger phrases in CFR text that delegate specifics to an AC ("in a manner approved by the Administrator")
- Cite the high-yield ACs by number and topic: AC 00-6 (weather), AC 60-22 (ADM), AC 61-65 (endorsements), AC 61-98 (flight review/IPC), AC 90-66 (non-towered ops), AC 91-79 (runway overrun), AC 91-92 (preflight briefing), AC 120-71 (SOPs)
- Articulate the difference between "AC compliance" and "regulatory compliance" without confusing them

## Why this matters

If you only read the FAR, you cannot answer many of the working questions a pilot asks every week: how do I sign a high-performance endorsement? what does "all available information" mean for a preflight briefing? what's the recommended pattern entry at a non-towered airport? when does runway overrun risk justify a balked-landing? what does the flight review actually cover? Each answer routes through an AC.

ACs also matter for *enforcement*. The FAA's compliance philosophy (FAA Order 8000.373) prefers compliance action over enforcement action when the pilot's deviation can be traced to an honest misunderstanding of guidance. A pilot who can show they relied on AC 91-92 in good faith -- and the deviation came from a misreading -- is in a different position than a pilot who can't articulate any framework at all. The AC is part of how a pilot demonstrates a reasonable practice.

## The discovery question

You've just earned your CFI. A friend asks you to sign them off for a high-performance airplane (their first, a Bonanza A36). What language goes in the endorsement?

Pause.

§61.31(f) requires the endorsement, but does not specify the wording. The CFR text:

> No person may act as pilot in command of a high-performance airplane ... unless the person has -- (1) Received and logged ground and flight training from an authorized instructor in a high-performance airplane ... and has been found proficient in the operation and systems of the airplane; and (2) Received a one-time endorsement in the pilot's logbook from an authorized instructor who certifies the person is proficient to operate a high-performance airplane.

"Received a one-time endorsement" -- that's the requirement. The wording? Not in the regulation. The wording is in **AC 61-65 (current revision)**, which publishes the canonical endorsement language. Endorsement A.4 (in current revisions) reads, in full:

> "I certify that [First name, MI, Last name], [pilot certificate], [certificate number], has received the required training of §61.31(f) in a [make and model of high-performance airplane]. I have determined that [he/she] is proficient in the operation of a high-performance airplane."

(Followed by signature, date, CFI certificate number, and CFI expiration.)

If you write your own wording, the endorsement is *legal* as long as it satisfies §61.31(f)(2) -- "an endorsement ... certifying proficient." But every FSDO, every examiner, every renewing CFI uses the AC 61-65 language. Deviating creates work and risk for no upside.

This is what an AC actually does: it converts a regulatory abstraction ("an endorsement") into a usable artifact (the exact words to put in the logbook).

## What an AC is, structurally

An AC is a document published by the FAA that:

- Has an AC number (subject prefix + sequence number, with revision letter appended)
- Has a date of issue
- Has a title and a stated subject
- Has a section called "Purpose and Cancellation" -- often a short paragraph explaining what regulation the AC supports and which prior revision it supersedes
- Has the substantive content -- usually structured by topic, with diagrams, tables, and example language
- Sometimes has appendices with checklists, forms, or templates

The AC is *not* a regulation. The AC's force is "the FAA accepts compliance with this AC as compliance with the underlying regulation." Alternative compliance methods are legal if they actually meet the regulation, but the AC is the safe and FAA-vetted path.

## The numbering scheme

The AC number tells you the subject area and the sequence within that area. The format:

```text
AC XX-YY[Z]
   |   |  |
   |   |  +-- Revision letter (no letter on first issue, then A, B, C ...)
   |   +----- Sequence number within the subject area
   +--------- Subject area, mapping roughly to a CFR Part
```

The subject-area prefix:

| Prefix | Subject area                                   | Notes                                                |
| ------ | ---------------------------------------------- | ---------------------------------------------------- |
| 00-    | General -- weather, decision-making, airspace  | AC 00-6 weather, AC 00-2 advisory circular checklist |
| 20-    | Aircraft (Part 21+ subjects, airworthiness)    | Aircraft cert, equipment, mods                       |
| 21-    | Type certification                             | Specific to certification process                    |
| 23-    | Small airplanes (Part 23 aircraft)             | Small-airplane design and certification              |
| 25-    | Transport airplanes (Part 25 aircraft)         | Large transport-category design                      |
| 39-    | Airworthiness directives                       | The AD process                                       |
| 43-    | Maintenance (Part 43 subjects)                 | Maintenance and inspection                           |
| 60-    | Airmen / training devices (Part 60 simulators) | AC 60-22 ADM, training-device standards              |
| 61-    | Pilots (Part 61 subjects specifically)         | AC 61-65 endorsements, AC 61-98 flight review        |
| 65-    | Airmen other than pilots                       | Mechanics, dispatchers, parachute riggers            |
| 67-    | Medical (Part 67)                              | Medical certification process                        |
| 68-    | BasicMed                                       | AC 68-1 BasicMed guidance                            |
| 90-    | Air Traffic Control / general operating        | AC 90-66 non-towered ops, AC 90-100 PBN              |
| 91-    | Part 91 subjects                               | AC 91-79 runway overrun, AC 91-92 preflight briefing |
| 117-   | Flight and duty (Part 117 -- airline crew)     | Crew rest, duty time                                 |
| 120-   | Air carriers (Part 121 subjects)               | AC 120-71 SOPs, AC 120-92 SMS                        |
| 135-   | On-demand commercial (Part 135 subjects)       | AC 135-X series                                      |
| 141-   | Pilot schools                                  | AC 141-1, 141-2 school certification                 |
| 145-   | Repair stations                                | AC 145-X series                                      |
| 150-   | Airports                                       | Airport design, lighting, markings                   |

The pattern: most ACs are numbered to mirror their CFR Part. AC 61-anything is about Part 61. AC 91-anything is about Part 91. AC 120-anything is about Part 121. The exceptions: AC 00-X is general (cross-cutting), AC 90-X is air traffic / general operating (cross-cutting on operations), and a few subject areas (60-, 150-, 91.21-) cover topics broader than a single Part.

## Decoding an AC number, examples

- **AC 00-6** -- general subject area, sequence 6. This is "Aviation Weather." The general prefix means it's a cross-cutting reference, not specific to any one Part.
- **AC 61-65** -- pilot subject area (Part 61), sequence 65. This is "Certification of Pilots and Flight & Ground Instructors" -- the endorsement bible.
- **AC 61-98** -- pilot subject area, sequence 98. This is "Currency Requirements and Guidance for the Flight Review and Instrument Proficiency Check."
- **AC 90-66** -- air traffic / general operating, sequence 66. This is "Non-Towered Airport Flight Operations."
- **AC 91-79** -- Part 91 subject area, sequence 79. This is "Mitigating the Risks of a Runway Overrun Upon Landing."
- **AC 120-71** -- air carrier subject area (Part 121), sequence 71. This is "Standard Operating Procedures and Pilot Monitoring Duties."

## Revision tracking

ACs revise. The revision letter appends to the number. AC 61-65A was the first revision of AC 61-65. AC 61-65K is the eleventh. Each revision supersedes the prior. The current revision is the only one in force; older revisions are historical reference.

The revision header on the AC's first page tells you the prior revision it supersedes and the substantive changes. Always check the current revision when citing an AC. Common mistakes:

- A book published in 2018 cites AC 61-65G (current then). By 2026 we're at AC 61-65K or later. The endorsement language may have changed.
- A pilot relies on AC 90-66B (a prior revision) without realizing AC 90-66C added new pattern-entry guidance for Class E pattern altitudes.
- A CFI signs endorsements using language from AC 61-65H without realizing AC 61-65J (and J revisions) added new endorsement categories the CFI's student needs.

The FAA publishes the AC change-summary as part of the new revision. Reading the change summary takes 5 minutes and protects against signing stale wording.

### Where to find the current revision

The FAA publishes ACs at [faa.gov/regulations_policies/advisory_circulars](https://www.faa.gov/regulations_policies/advisory_circulars/). Search by number or by subject. The page shows the current revision, the date of issue, and (for revisions) a link to the change summary.

For airboss-internal references: AC 00-6 and similar resolvers point at the current edition.

## When an AC actually matters -- the trigger phrases

Most CFRs are self-contained: "you must do X." Some CFRs delegate the specifics: "do X **in a manner approved by the Administrator**" or "X **acceptable to the Administrator**" or "X **as the Administrator finds appropriate**." When you see these phrases, the regulation is pointing you at an AC.

| Trigger phrase                               | What it means                         | Where to find the answer     |
| -------------------------------------------- | ------------------------------------- | ---------------------------- |
| "in a manner approved by the Administrator"  | The AC describes what's approved      | The matching AC for the Part |
| "acceptable to the Administrator"            | The AC describes what's acceptable    | The matching AC              |
| "in accordance with FAA-approved procedures" | The AC describes the procedures       | The matching AC              |
| "as published by the Administrator"          | The AC publishes the official version | The matching AC              |

Examples:

- §61.56(a) -- "the review must include ... a review of those maneuvers and procedures that ... are necessary." The CFR doesn't say which maneuvers. AC 61-98 (current revision) describes the recommended scope.
- §61.31(f) -- "received a one-time endorsement ... certifying ... proficient." The CFR doesn't specify the language. AC 61-65 publishes Endorsement A.4 with the canonical wording.
- §91.103 -- "shall, before beginning a flight, become familiar with all available information." "All available information" is undefined in the CFR. AC 91-92 describes what self-briefing should include.

## The high-yield AC table

These are the ACs every working pilot or CFI references. Memorize the number-to-topic mapping; you'll cite them weekly.

| AC        | Title                                                                            | Subject area                        | When you reach for it                                                   |
| --------- | -------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------- |
| AC 00-2   | Advisory Circular Checklist                                                      | The list of all ACs                 | When you need to find an AC and don't know its number                   |
| AC 00-6   | Aviation Weather                                                                 | Weather fundamentals                | Briefing-related questions, weather decision-making                     |
| AC 00-45  | Aviation Weather Services                                                        | Weather products and services       | Reading METAR/TAF, weather charts, FA/AIRMET/SIGMET                     |
| AC 60-22  | Aeronautical Decision Making                                                     | ADM model, risk management          | ADM-related lessons, the I'M SAFE checklist origin                      |
| AC 60-28  | English Language Skill Standards                                                 | English fluency for pilots          | When training non-native-English speakers                               |
| AC 61-65  | Certification of Pilots and Flight & Ground Instructors                          | Endorsements (the bible)            | Every endorsement a CFI signs                                           |
| AC 61-83  | Nationally Scheduled FAA-Approved Industry-Conducted FIRC                        | FIRC mechanics                      | Reference for FIRC course mechanics (mostly CFI renewal)                |
| AC 61-98  | Currency Requirements and Guidance for the Flight Review and IPC                 | §61.56 / §61.57(c) content          | Flight review structure, IPC content, WINGS phase mapping               |
| AC 68-1   | BasicMed                                                                         | Part 68 / 49 USC 44703(j)           | BasicMed eligibility, exam requirements, online course tracking         |
| AC 90-66  | Non-Towered Airport Flight Operations                                            | Pattern, comms, traffic             | Non-towered ops -- pattern entry, CTAF, no-radio operations             |
| AC 90-100 | U.S. Terminal and En Route Area Navigation (RNAV) Operations                     | PBN / RNAV                          | RNAV departures, arrivals, approaches; en route RNAV                    |
| AC 91-21  | Use of Portable Electronic Devices Aboard Aircraft                               | EFB, tablets                        | When pilots use iPads in flight; the FAA position                       |
| AC 91-67  | Minimum Equipment Requirements for General Aviation Operations Under FAR Part 91 | MEL / equipment lists               | When equipment is inop and a MEL/non-MEL approach is in play            |
| AC 91-79  | Mitigating the Risks of a Runway Overrun Upon Landing                            | Landing technique                   | Landing speed, energy management, balked-landing decisions              |
| AC 91-92  | Pilot's Guide to a Preflight Briefing                                            | §91.103 "all available information" | Defining what self-briefing should cover                                |
| AC 120-71 | Standard Operating Procedures and Pilot Monitoring Duties                        | SOPs in 121/135                     | When working in or transitioning to a Part 121/135 environment          |
| AC 120-92 | Safety Management Systems for Aviation Service Providers                         | SMS                                 | When SMS comes up (mostly Part 121, increasingly Part 135 and Part 145) |

## The AC structure in practice -- AC 61-65 as the working example

AC 61-65 is the single most-referenced AC for working CFIs. Its structure illustrates how an AC delivers operational guidance.

```text
AC 61-65 (current revision)
+-- Cover page (number, date, subject)
+-- Purpose and Cancellation (what reg this supports, what it supersedes)
+-- Definitions (specific to the AC)
+-- Chapter 1 -- Endorsements for student pilots
+-- Chapter 2 -- Endorsements for sport pilots
+-- Chapter 3 -- Endorsements for recreational pilots
+-- Chapter 4 -- Endorsements for private and commercial pilots
+-- Chapter 5 -- Endorsements for the airline transport pilot
+-- Chapter 6 -- Endorsements for instructors (CFI / CFI-G / CFI-S)
+-- Chapter 7 -- Endorsements for type ratings
+-- Chapter 8 -- Special endorsements (high-altitude, complex, etc.)
+-- Appendix A -- Sample endorsement language (the famous list)
+-- Appendix B -- Practical-test prerequisite endorsements
```

Appendix A is the operating tool. It lists endorsements A.1 through A.something-letter (60+ endorsements in current revisions). Each endorsement has:

- The §(citation) it supports
- The exact recommended wording
- A note on when to use it
- The information the CFI must include (date, name, certificate, expiration)

A working CFI bookmarks Appendix A and consults it before signing. The endorsement number in Appendix A is informally cited in conversation: "I'll sign A.1 (the flight review) when we're done today."

### How CFIs cite an AC endorsement

In oral exams or in writing, the canonical citation looks like:

> "I'll sign the high-performance endorsement using AC 61-65 Endorsement A.4."

This says: the *requirement* lives in §61.31(f); the *wording* I'll use is the AC 61-65 Appendix A entry A.4. Examiners hearing this from a CFI candidate know they understand the regulatory architecture.

## Common misreadings

- **"ACs are required."** Wrong. ACs describe one acceptable means. Alternative compliance is legal if it actually meets the regulation. AC compliance is the FAA-vetted path; alternative compliance is harder to defend but legal.
- **"If I don't follow the AC, I'm in violation."** Wrong. You're in violation when you violate the *regulation*. The AC is one path to compliance, not the only path. A CFI who writes a custom endorsement that meets §61.31(f) is compliant even though they didn't quote AC 61-65.
- **"AC 61-65 has the regulatory force of law."** Wrong. AC 61-65 publishes recommended endorsement language. The regulatory requirement (the existence of the endorsement) lives in §61.31, §61.87, §61.93, §61.56, etc. The AC is the convenient template; the regulation is the law.
- **"Once you cite an AC, you're stuck with it."** Wrong. The current revision is what's in force. If you cite AC 61-65G in a discussion, the FSDO will ask "do you mean the current revision (K)?" The number-without-letter form is shorthand for "whatever is current"; the explicit revision letter pins to a specific historical document.
- **"I can rely on a stale AC."** Wrong. The current revision supersedes prior revisions. A CFI signing an endorsement using superseded language has signed a deficient endorsement. The CFI's responsibility is to know the current revision.
- **"The AC checklist (AC 00-2) lists everything."** Mostly right. AC 00-2 is the master index. It catches new ACs as they're issued. If you can't find an AC by number, search AC 00-2.
- **"AC 60-22's I'M SAFE checklist is regulation."** Wrong. AC 60-22 documents the I'M SAFE pneumonic and the ADM model. Neither is regulation; both are part of the FAA's recommended pilot self-assessment. The pilot's responsibility to self-assess flows from §91.13 (careless or reckless) and §61.53 (medical fitness for flight) -- the AC tells you what self-assessment looks like.
- **"AC 91-79 means I can't land long."** Wrong. AC 91-79 doesn't prohibit anything. It describes the runway overrun risks and the recommended techniques to mitigate. Pilots learn from AC 91-79 the energy-management principles and the balked-landing decision rule -- the technique is recommended, the underlying obligation comes from §91.13.

## Where this lesson sits

This is the second lesson of Week 8. It positions Advisory Circulars as the *guidance* layer of the regulatory ecosystem: not law, not expected practice, but FAA-vetted methods of complying with the law. The next lesson treats Chief Counsel interpretations -- which *are* binding on FAA enforcement.

## Related sections

- §61.31 -- the endorsement section that AC 61-65 templates
- §61.56 -- flight review (AC 61-98)
- §91.103 -- "all available information" (AC 91-92, with the Walker letter overlay)
- §91.155 -- VFR weather minimums (cross-references AC 00-6 for fundamentals, AC 00-45 for products)
- Week 1 [03-companion-documents.md](../week-01-architecture/03-companion-documents.md) -- the introduction
- Week 8 [01-aim-as-expected-knowledge.md](01-aim-as-expected-knowledge.md) -- the AIM
- Week 8 [03-chief-counsel-interpretations.md](03-chief-counsel-interpretations.md) -- the binding interpretation layer
- Week 2 [04-flight-review-and-equivalents.md](../week-02-part-61-deep/04-flight-review-and-equivalents.md) -- where AC 61-98 was first deep-cited
- Week 3 [01-subpart-h-walk.md](../week-03-part-61-cfi/01-subpart-h-walk.md) -- where AC 61-65 lives in working CFI practice

## Drills

| Question                                                       | AC and section                                                  |
| -------------------------------------------------------------- | --------------------------------------------------------------- |
| What's the canonical wording for a flight review endorsement?  | AC 61-65 Endorsement A.1                                        |
| What's the recommended scope of a flight review?               | AC 61-98 (current revision)                                     |
| Where is the I'M SAFE checklist documented?                    | AC 60-22                                                        |
| What's the recommended pattern entry at a non-towered airport? | AC 90-66 (current revision) + AIM 4-3-3                         |
| What are the BasicMed eligibility requirements?                | AC 68-1                                                         |
| What's the FAA's guidance on iPad use in flight?               | AC 91-21                                                        |
| What does "all available information" require for preflight?   | AC 91-92 (with Walker letter overlay)                           |
| Where is the official guide to weather products and services?  | AC 00-45                                                        |
| Where is the AC for runway overrun risk?                       | AC 91-79                                                        |
| What's the AC index?                                           | AC 00-2                                                         |
| What's the SOP guidance for Part 121/135 pilots?               | AC 120-71                                                       |
| Where is RNAV operational guidance?                            | AC 90-100                                                       |
| Where is the FIRC mechanics reference?                         | AC 61-83                                                        |
| What's the AC for high-altitude endorsement?                   | AC 61-65 (Endorsement A.7 or as renumbered in current revision) |

## Live source

- AC 00-6 -- Aviation Weather
- AC 61-65 -- Endorsements (the bible)
- AC 61-98 -- Flight review and IPC content
- AC 90-66 -- Non-towered airport ops
- AC 91-79 -- Runway overrun mitigation
- AC 91-92 -- Preflight briefing
- AC 120-71 -- SOPs and pilot monitoring
- [@cite](airboss-ref:regs/cfr-14/61/31?at=2026) -- §61.31 endorsements (the regulation that AC 61-65 templates)
- [@cite](airboss-ref:regs/cfr-14/91/103?at=2026) -- §91.103 preflight action
