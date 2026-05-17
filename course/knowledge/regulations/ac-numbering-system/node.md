---
# === Identity ===
id: reg-ac-numbering-system
title: The AC Numbering System
domain: regulations
cross_domains: []

# === Knowledge character ===
knowledge_types: [procedural, conceptual]
technical_depth: working
stability: stable

# === Cert + study priority ===
# minimum_cert: lowest cert that requires this topic. Higher certs inherit.
minimum_cert: private
# study_priority: critical (safety/checkride hot) | standard (default) | stretch (adjacent).
study_priority: standard
requires:
  - reg-faa-document-ecosystem
deepens: []
applied_by:
  - reg-faa-cross-reference-triangulation
taught_by: []
related:
  - reg-faa-citation-anatomy

# === Content & delivery ===
modalities: [reading, cards]
estimated_time_minutes: 25
review_time_minutes: 5

# === References ===
references:
  - source: AC 00-2
    detail: Advisory Circular Checklist, Appendix 1 -- the Advisory Circular Numbering System
    note: The authoritative source for the AC subject-series prefixes. The document itself is cancelled, but Appendix 1 is the historical record of how the numbering was designed to mirror the 14 CFR subchapter structure.
  - source: 14 CFR
    detail: Title 14 part structure -- Parts 1, 21, 23, 43, 61, 91, 121, 135, 141, 150, and others
    note: The AC subject series mirror the CFR part numbers. Part 61 maps to the 61-series ACs; Part 91 is covered by the 90-series, where an individual AC carries the part number it supports (AC 91-73 supports Part 91); Part 150 maps to the 150-series. The mirror is the whole point of the scheme.
  - source: drs.faa.gov
    detail: Dynamic Regulatory System -- AC search by number
    note: Where you confirm a specific AC number, its title, and its current revision letter today. AC 00-2 no longer browses; DRS is the live lookup.

# === Assessment ===
assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >-
  Given an Advisory Circular number, learner can predict its subject area from
  the subject-series prefix (00 general, 20 aircraft, 60 airmen, 61
  certification and ratings, 90 air traffic and general operating rules, 150
  airports) and can explain that the prefix mirrors the matching 14 CFR part.
  Given a subject area, learner can name the series prefix. Learner can state
  why the numbering is a deliberate mirror of the CFR subchapter structure and
  not an arbitrary catalog number.
---

# The AC Numbering System

:::phase name="context"

You are reading along and you hit "AC 61-65" or "AC 91-73" or "AC 150-5300-13." If the numbers mean nothing to you, every AC reference is an opaque catalog code: you cannot guess whether it is about your pilot certificate, your airplane, or an airport runway, without going and looking it up.

But the numbers are not arbitrary. The Advisory Circular numbering system was designed to be readable. Once you see the pattern, an AC number tells you its subject area before you ever open the document. "AC 61-65" announces itself: it is about the same thing 14 CFR Part 61 is about.

This node builds that skill: predicting an AC's subject from its number. It is a small skill, but it changes how the whole ecosystem feels. A wall of catalog codes becomes a map you can read at a glance.

:::
:::phase name="problem"

Here are five real Advisory Circular numbers. Their subjects are hidden.

| AC number      | Subject |
| -------------- | ------- |
| AC 61-65       | ?       |
| AC 91-73       | ?       |
| AC 20-138      | ?       |
| AC 150-5300-13 | ?       |
| AC 00-46       | ?       |

Before you read anything else: write down your best guess for what each one is about. You will not get them all. That is the point. Notice which numbers feel like they should mean something and which feel completely opaque. Hold those guesses; you will check them against the scheme in a moment.

:::
:::phase name="discover"

Do not skip ahead to the table. Work the arc.

1. **One anchor.** Here is the first answer, and only the first. **AC 61-65** is titled "Certification: Pilots and Flight and Ground Instructors." Now recall something you already know: which part of 14 CFR governs the certification of pilots and instructors? It is Part 61. Look at the AC number again. The first segment is 61. Notice the match. Is that a coincidence?

2. **Test the anchor.** If "61" in the AC number is the same 61 as "14 CFR Part 61," then the AC numbering is not a catalog; it is a mirror of the CFR part structure. Test that idea against the second number. **AC 91-73** begins with 91. What does 14 CFR Part 91 govern? If your model is right, AC 91-73 should be about that subject. Predict it before you confirm. (AC 91-73 is in fact "Parts 91 and 135 Single-Pilot, Flight School Procedures During Taxi Operations." Part 91 is the general operating and flight rules. The 91 matches.)

3. **Generalize.** You now have a working rule: the leading number of an AC mirrors a 14 CFR part. So reason forward. **AC 150-5300-13** begins with 150. 14 CFR Part 150 is about airport noise compatibility planning, and the 150-series of regulations and ACs covers airports generally. Without looking it up, what subject would you expect AC 150-5300-13 to cover? (It is "Airport Design.") What about a number beginning with 20, or 23? Part 23 is airworthiness standards for normal-category airplanes; Part 20 does not exist as a CFR part, which raises a question: what happens when an AC subject does not map cleanly to one numbered CFR part?

4. **The general bucket.** Look at the last problem number: **AC 00-46**. There is no 14 CFR "Part 00." So what is the 00-series for? Reason it out: if the numbered series mirror specific CFR parts, the 00-series must be the catch-all for material that is not tied to one part. AC 00-46 is in fact "Aviation Safety Reporting Program," a general-program document that no single CFR part owns. Likewise the 20-series covers aircraft and airworthiness topics broadly, sitting near the airworthiness parts (21, 23, 25, 43) without being a one-to-one copy of any of them.

5. **State the scheme in your own words.** Before you read the Reveal, write a single sentence: what does the leading number of an AC tell you, and where did the FAA get those numbers from?

:::
:::phase name="reveal"

### The scheme

The leading number of an Advisory Circular is a **subject-series prefix.** It mirrors the subchapter and part structure of 14 CFR. The AC is guidance ABOUT the regulations in the matching series, so the FAA gave it the matching number.

| Prefix | Subject series                          | Mirrors                                        |
| ------ | --------------------------------------- | ---------------------------------------------- |
| 00     | General                                 | No single CFR part -- the catch-all series.    |
| 20     | Aircraft                                | The airworthiness parts (21, 23, 25, 43, ...). |
| 60     | Airmen                                  | The airman parts broadly.                      |
| 61     | Certification: pilots and instructors   | 14 CFR Part 61.                                |
| 90     | Air traffic and general operating rules | 14 CFR Part 91 and the air-traffic parts.      |
| 150    | Airports                                | 14 CFR Part 150 and the airports parts.        |

The full scheme has more series (70 for airspace, 120 for air carrier operations, 140 for schools and agencies, and others), but the six above are the ones a private, instrument, or CFI pilot meets most. The authoritative list is **AC 00-2, Appendix 1**, "Advisory Circular Numbering System" -- the appendix of the old Advisory Circular Checklist. AC 00-2 itself is cancelled, but Appendix 1 remains the historical record of how the numbering was designed.

### The five numbers, decoded

| AC number      | Prefix | Subject area            | Title                                                                          |
| -------------- | ------ | ----------------------- | ------------------------------------------------------------------------------ |
| AC 61-65       | 61     | Airman certification    | Certification: Pilots and Flight and Ground Instructors                        |
| AC 91-73       | 90     | General operating rules | Parts 91 and 135 Single-Pilot, Flight School Procedures During Taxi Operations |
| AC 20-138      | 20     | Aircraft                | Airworthiness Approval of Positioning and Navigation Systems                   |
| AC 150-5300-13 | 150    | Airports                | Airport Design                                                                 |
| AC 00-46       | 00     | General                 | Aviation Safety Reporting Program                                              |

Note AC 91-73: its prefix is `90`, the air-traffic and general-operating-rules series. There is no separate `91` series. The individual AC carries the number `91` because it supports 14 CFR Part 91, even though the broad series label is "90, air traffic and general operating rules." The series numbers are families; specific ACs take the part number they most directly support.

### Why it is a mirror, not a catalog

The numbering is a **deliberate mirror** of the 14 CFR structure. The FAA did not assign AC numbers sequentially as a librarian would. It built the AC number to point back at the regulation the AC supports, so that a reader who knows the CFR part structure can navigate the AC system for free. The numbering scheme IS the cross-reference: AC 61-anything is guidance for the world of Part 61. That is the whole skill of this node: read the prefix, know the subject.

:::
:::phase name="practice"

### Recall prompts (the same five-number set)

1. **Predict from number.** Given each number cold, name the subject area: AC 61-65, AC 91-73, AC 20-138, AC 150-5300-13, AC 00-46.

2. **Name the prefix.** Given a subject, name the series prefix: airman certification; airports; a general aviation program; aircraft and airworthiness; air traffic and general operating rules.

3. **Explain the mirror.** Why does AC 61-65 begin with 61? Answer in one sentence that mentions 14 CFR.

4. **The 00 question.** Why is AC 00-46 in the 00-series and not in some numbered series? What does the 00-series hold?

5. **New number.** You encounter "AC 90-66," a number you have never seen. From the prefix alone, what general territory is it in? (Air traffic and general operating rules -- it is in fact about non-towered airport operations.)

### Cards

- `card:reg-ac-prefix-00` -- the 00-series: general, the catch-all (recall).
- `card:reg-ac-prefix-20` -- the 20-series: aircraft and airworthiness (recall).
- `card:reg-ac-prefix-60-61` -- the 60/61-series: airmen and certification (recall).
- `card:reg-ac-prefix-90` -- the 90-series: air traffic and general operating rules (recall).
- `card:reg-ac-prefix-150` -- the 150-series: airports (recall).
- `card:reg-ac-numbering-mirrors-cfr` -- the AC number mirrors the 14 CFR part structure (conceptual recall).

:::
:::phase name="connect"

### What changes if...

- **...the AC number has extra segments, like AC 150-5300-13?** The leading segment is still the subject series; the rest is a finer index within the airports series. The prefix-reading skill still works on the first number.
- **...you need to pull the whole identifier apart, revision letter and all?** Predicting the subject is one skill; parsing the full identifier (type prefix, number, revision letter, title) is the next. Link: `reg-faa-citation-anatomy`.
- **...the prefix is one you have not memorized?** drs.faa.gov resolves any AC number to its title and current revision. The prefix gets you the neighborhood; DRS gets you the exact house.
- **...you are answering a real question?** Knowing AC 61-anything is Part-61 territory lets you jump straight from a Part 61 regulation to its supporting AC. That jump is one leg of cross-reference triangulation. Link: `reg-faa-cross-reference-triangulation`.

### Links

- `reg-faa-document-ecosystem` -- the binding/advisory split that makes the AC a family worth numbering.
- `reg-faa-citation-anatomy` -- parsing the full AC identifier, including the revision letter.
- `reg-faa-cross-reference-triangulation` -- using the prefix to jump from a CFR part to its AC.

:::
:::phase name="verify"

### Novel scenario

You are researching a question about runway markings and you find a reference to "AC 150-5340-1."

1. From the prefix alone, before looking the document up, what subject area is this AC in? How confident are you, and why?
2. A second reference points you to "AC 61-98." Predict its subject area from the prefix.
3. You also see "AC 00-7." The prefix is 00. What does that tell you, and what does it NOT tell you, about the subject?
4. Explain to a fellow pilot why the prefix of an AC is worth reading even when you are going to look the full document up anyway.

### Teaching exercise (CFI)

A student asks why the FAA could not just number Advisory Circulars 1, 2, 3, 4 in the order they were written, which would be simpler.

1. Answer the student. What does the subject-series numbering buy a reader that a sequential catalog number would not?
2. Build a two-minute exercise that has the student predict three AC subjects from their prefixes, then check. Choose three of the five worked numbers from this node so the exercise stays anchored to one consistent set.
3. The student then asks: "If AC 00-2 told us the scheme and it is cancelled, how do I trust the scheme today?" Give an answer that distinguishes the cancelled document from the still-valid numbering convention it described.

:::
