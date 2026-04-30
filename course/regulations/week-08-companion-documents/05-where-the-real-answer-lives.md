---
title: Where the real answer lives -- the source escalation path
week: 8
section_order: "05"
covers_regulations:
  - 61.51
  - 61.113
  - 91.3
  - 91.13
  - 91.103
  - 91.123
  - 91.185
ties_to_knowledge_nodes: []
last_verified: 2026-04-29
---

# Where the real answer lives

The previous four lessons mapped the document types: AIM, AC, Chief Counsel letters, 49 CFR. This lesson is the integration. It teaches a single skill: given a regulatory question, walk up the source hierarchy until you find the document that actually settles it.

The skill is most of the value of Week 8. Working pilots and CFIs don't memorize the entire ecosystem -- they internalize a *routing* discipline. They hear a question and immediately know "that's an AIM question" or "that's a Chief Counsel question" and walk to the right document in seconds. The escalation path is the routing map.

## What you'll be able to do

- Triage any regulatory question by document type within 30 seconds
- Walk a question up the source hierarchy: FAR -> CFR cross-reference -> AIM -> AC -> Chief Counsel letter -> FAA Order -> NTSB / 49 CFR
- Recognize the signal phrases in a question that point at each document type
- Articulate the *why* behind each layer -- why guidance exists, why interpretive letters exist, why some rules cross titles
- Defend a regulatory answer by citing the actual binding source, not just the FAR

## Why this matters

Most regulatory questions have answers in multiple layers, and the *practical* answer often lives in a non-CFR document. A pilot who routes the question correctly answers in seconds. A pilot who only knows "the FAR" reads the FAR, finds it ambiguous, and freezes.

The skill matters operationally during checkrides (oral exam questions consistently route through non-CFR sources), during enforcement actions (pilots who can defend their actions with the actual interpretive source rather than a plain reading of the FAR fare better), and during day-to-day flying (the question "is this OK?" usually has its real answer in an AC or a Chief Counsel letter, not in the FAR alone).

## The discovery question

You're a CFI signing off a private pilot for a flight review. Mid-review, the student asks: "If I'm flying with my friend tomorrow and we split fuel costs pro-rata, am I legal under 61.113? She's coming because she wants to visit her family in Tahoe; I'm flying anyway because I love that flight."

Pause. What's the answer?

Plain reading of §61.113(c): "...provided ... the pilot and the passengers have a common purpose for the flight." The student says "my reason is I love the flight; her reason is to visit family." Different reasons. Plain reading suggests "no common purpose -> doesn't qualify."

But the FAA's actual position is the **Mangiamele letter (2009)**: "common purpose" requires the pilot have an *independent* reason for the flight, not a *shared* destination motive. The pilot's "I'm flying anyway because I love that flight" is exactly the kind of independent reason the Mangiamele test calls for. The friend's destination motive is irrelevant -- what matters is whether the pilot would have flown without her. If yes, common purpose is satisfied. If no, it's transportation for hire.

So the practical answer to the student: yes, this is fine, *if* you would actually have made this flight without your friend's contribution. Otherwise it's transportation for hire and §61.113(a) prohibits it.

The CFR alone gave a misleading answer. The Chief Counsel letter gave the right one.

## The five-layer source hierarchy

Pilot-relevant regulatory authority lives in five layers. The layers are not parallel -- they're hierarchical in a specific sense: each layer fills in what the prior layer leaves open.

```text
Layer 1: 14 CFR (the FAR)
  Binding regulation. The legal floor. Where the rule lives.

Layer 2: Cross-title CFR (49 CFR primarily)
  Same regulatory force as Layer 1, different agency. Often the
  pilot doesn't notice the title until they need it. NTSB Part 830,
  TSA Part 1552, BasicMed statutory authority in 49 USC 44703.

Layer 3: AIM (expected practice)
  Procedural guidance. Not regulation, but the FAA's official
  description of how flight is supposed to work. Enforceable
  indirectly through §91.13.

Layer 4: Advisory Circulars (acceptable means)
  Guidance on how to comply. One acceptable method; alternative
  methods that meet the underlying regulation are also legal.
  AC 61-65 endorsements, AC 91-92 preflight, AC 91-79 runway
  overrun, etc.

Layer 5: Chief Counsel letters and NTSB Board orders (binding interpretation)
  How the regulation is read in contested cases. Binds the FAA's
  enforcement position. Cited by recipient name and year.

Plus: FAA Orders (internal procedure)
  How the agency operates. Enforces, inspects, certificates. Order
  2150.3 (enforcement), 8900.1 (FSDO operations), 8000.373
  (compliance philosophy). Pilots cite when relevant; not the
  primary source for most pilot questions.
```

Most regulatory questions resolve in Layer 1 or Layer 3. Many resolve at Layer 4. A few -- the famous ones -- need Layer 5. The pilot's job is to know which.

## The triage discipline -- routing a question in 30 seconds

The discipline is signal recognition. Each question has signals telling you which layer it lives in.

### Signal: a numeric standard or specific requirement

If the question is "what's the minimum X for Y?" the answer is in the FAR. Examples:

- "What's the minimum visibility for VFR Class E below 10,000?" -> §91.155
- "What's the recurring flight review interval?" -> §61.56
- "What's the minimum total time for the commercial certificate?" -> §61.129

These are Layer 1 questions. Look in the FAR.

### Signal: a procedure or how-to

If the question is "what's the procedure for X?" the answer is in the AIM (Layer 3). Examples:

- "What's the procedure for two-way radio communications failure?" -> AIM 6-4 + §91.185
- "What's the recommended pattern entry at a non-towered airport?" -> AIM 4-3-3 + AC 90-66
- "What does 'cleared for the option' mean?" -> Pilot/Controller Glossary
- "How do I enter a hold?" -> AIM 5-3-7

The FAR sets the legal frame; the AIM tells you how to do it. Procedural questions are AIM questions.

### Signal: an "in a manner approved by the Administrator" type phrase

If the regulation contains a delegation phrase ("in a manner approved by the Administrator", "acceptable to the Administrator"), the answer is in an Advisory Circular (Layer 4). Examples:

- "What does the flight review actually cover?" -> §61.56 + AC 61-98
- "What endorsement language do I use for high-performance?" -> §61.31(f) + AC 61-65 Endorsement A.4
- "What does 'all available information' mean in §91.103?" -> AC 91-92 + Walker letter (Layer 5)
- "What's the recommended SOP for a Part 121 crew?" -> AC 120-71

The FAR says the *what*; the AC says the *how*.

### Signal: ambiguity or a contested fact pattern

If the question is "what's the FAA's actual position on this contested case?" the answer is a Chief Counsel letter (Layer 5). Examples:

- "Common purpose for cost-sharing -- what does it really require?" -> Mangiamele letter
- "Can a CFI log PIC and the rated student also log PIC?" -> Hicks / Murphy letters
- "What does 'all available information' really require for preflight?" -> Walker letter
- "What's the standard for §91.13 careless or reckless?" -> NTSB orders (Lobeiko et al.)

Contested cases are Layer 5 questions. The FAR is silent or ambiguous; the FAA's official position is in the letter.

### Signal: the question crosses agencies

If the question is about *security* (TSA), *accident reporting* (NTSB), or *medical statutory authority* (BasicMed), the answer is in 49 CFR (Layer 2). Examples:

- "Does this student need TSA approval before training?" -> 49 CFR Part 1552
- "When must I report this incident to the NTSB?" -> 49 CFR 830.5
- "What's the BasicMed statutory floor?" -> 49 USC 44703(j)
- "What's PHMSA's rule on shipping batteries?" -> 49 CFR Part 175

Cross-agency questions live outside Title 14.

### Signal: how the FAA itself operates

If the question is "how does the FAA enforce this?" or "what does an inspector look at?" the answer is in an FAA Order. Examples:

- "What's the FAA's enforcement progression?" -> FAA Order 2150.3
- "What does a FSDO inspector check during a ramp inspection?" -> FAA Order 8900.1
- "When does the FAA prefer compliance vs. enforcement?" -> FAA Order 8000.373

Pilots rarely cite Orders, but knowing they exist matters during investigations or when working with a FSDO.

## The escalation path -- step by step

The full triage routine for an unfamiliar regulatory question:

```text
Step 1: Read the question. Identify the topic.

Step 2: Find the FAR.
  - Look in the most likely Part (61 for pilot questions, 91 for
    flight questions, 141 for school questions, etc.)
  - Read the section text.
  - If the FAR clearly answers, stop here.

Step 3: Read the FAR's neighborhood.
  - Adjacent sections often clarify (61.56 alongside 61.57; 91.103
    alongside 91.13).
  - Cross-references in the FAR text point at related sections.

Step 4: Check the AIM.
  - Is there a procedural component? AIM Chapter 4 or 5 likely.
  - Is there an emergency or weather component? AIM 6 or 7.
  - Many FARs have an AIM partner.

Step 5: Check for an AC.
  - Look for the AC number matching the Part. Is there an AC 61-X
    for this Part-61 question?
  - Read the AC for the operationalization. The AC tells you what
    compliance looks like.

Step 6: Check for a Chief Counsel letter.
  - If the regulation's meaning is ambiguous or the question is
    contested, search the FAA chief-counsel-letters page.
  - Search by section number ("61.113") or by topic.
  - The most recent letter on the question controls.

Step 7: Check 49 CFR if the question crosses agencies.
  - Security questions -> 49 CFR Chapter XII (TSA).
  - Reporting/investigation -> 49 CFR Chapter VIII (NTSB).
  - Medical statutory -> 49 USC 44703.

Step 8: Check FAA Orders if the question is about agency procedure.
  - Order 2150.3 for enforcement.
  - Order 8900.1 for FSDO operations.
  - Order 8000.373 for compliance philosophy.

Step 9: Synthesize.
  - The full answer cites the FAR (the legal frame), the relevant
    procedural guidance (AIM or AC), and the relevant interpretation
    (Chief Counsel) if the case is contested.
  - The synthesis is what the examiner expects from a CFI candidate.
```

The first three steps take about 60 seconds. Steps 4-8 each take another minute or two of source-checking. A complete answer to a non-trivial regulatory question takes about 5-10 minutes if you don't already know the answer cold.

In oral exams, you don't have 10 minutes per question. The examiner expects you to *know* the routing for common questions and to articulate the answer fluidly. The triage discipline is what installs that fluency: by routing dozens of questions through the hierarchy in study, you build instinct about where each question's real answer lives.

## Worked example 1 -- a CFI signing a high-performance endorsement

Question: A friend asks me to sign them off for a high-performance airplane. What goes in the endorsement?

```text
Step 1: Topic -- endorsement language for §61.31(f).

Step 2: FAR -- §61.31(f). Reads: "Received a one-time endorsement
        in the pilot's logbook from an authorized instructor who
        certifies the person is proficient ..."

  The FAR says THERE IS an endorsement; doesn't specify wording.

Step 3: Neighborhood -- §61.31(e), §61.31(g), §61.31(i) cover other
        endorsements. None specify wording either.

Step 4: AIM -- not a procedural question. Skip.

Step 5: AC -- AC 61-65 (Pilot and Instructor Certification). The
        endorsement bible. Appendix A lists canonical endorsements
        by number. Endorsement A.4 (or current numbering) is the
        high-performance endorsement.

  The AC gives the wording. This is the answer.

Step 6: Chief Counsel -- not contested. No specific letter required.

Step 7: 49 CFR -- not relevant.

Step 8: FAA Order -- not relevant.

Step 9: Synthesize. The endorsement is required by §61.31(f); the
        canonical wording is AC 61-65 Endorsement A.4 (current
        revision). I'll use that wording, signed and dated, with my
        certificate number and expiration.
```

## Worked example 2 -- preflight briefing scope

Question: My student wants to know what 91.103's "all available information" actually requires.

```text
Step 1: Topic -- §91.103 preflight action.

Step 2: FAR -- §91.103. Reads: "Each pilot in command shall, before
        beginning a flight, become familiar with all available
        information concerning that flight. This information must
        include ... [specific items listed]."

  The FAR lists specific items but uses the phrase "all available
  information" which is broader than the list.

Step 3: Neighborhood -- §91.13 (careless or reckless) overlays;
        §91.155 weather minimums.

Step 4: AIM -- AIM Chapter 5, Section 1 covers preflight. AIM 7-1
        covers weather information sources.

Step 5: AC -- AC 91-92 (Pilot's Guide to a Preflight Briefing).
        Operationalizes the briefing in detail.

Step 6: Chief Counsel -- the Walker letter (2017). Holds that "all
        available information" includes information the pilot
        reasonably should have sought, not just what arrived
        passively. Active-effort obligation.

Step 7: 49 CFR -- not relevant.

Step 8: FAA Order -- not relevant.

Step 9: Synthesize. §91.103 is the legal floor (specific items plus
        the general phrase). AC 91-92 describes acceptable means.
        AIM 5-1 and 7-1 give the procedural detail. Walker (2017)
        clarifies that the pilot has an active-effort obligation
        to seek information, not just receive it. The full answer:
        check weather, NOTAMs, fuel, alternates, runway lengths,
        and available information from any reasonable source. The
        standard is what a careful pilot should know, not what the
        pilot happened to encounter.
```

## Worked example 3 -- a CFI training a non-citizen

Question: I have a new student who is a Brazilian national here on a B-1 visa. He wants primary training. May I begin?

```text
Step 1: Topic -- CFI training a non-citizen.

Step 2: FAR -- §61.183 lists CFI eligibility. §61.193 lists
        privileges. Neither addresses citizenship.

Step 3: Neighborhood -- silent on this question.

Step 4: AIM -- not procedural for this question. Skip.

Step 5: AC -- AC 61-65 covers endorsements but not security
        vetting. Skip.

Step 6: Chief Counsel -- not relevant.

Step 7: 49 CFR -- 49 CFR Part 1552. The TSA's Alien Flight Student
        Program. Yes, the student must be vetted before training
        begins.

  This is the answer. The CFI must verify TSA approval before
  training.

Step 8: FAA Order -- not relevant.

Step 9: Synthesize. Under 49 CFR Part 1552, the Brazilian student
        is an "alien flight student" and must be vetted by TSA
        before training begins. As CFI, I cannot start instruction
        until I have AFSP approval in hand. The school's AFSP
        coordinator (or I, as the responsible party) initiates the
        TSA application; training waits for approval.
```

The question's answer was nowhere in 14 CFR. The triage discipline routed it correctly to 49 CFR.

## Common misreadings

- **"The CFR has the answer to every question."** Wrong. The CFR sets the legal frame. Specific applications, contested cases, and procedural detail often live in AIM, AC, or Chief Counsel letters. A pilot who only consults the FAR misses most of the regulatory ecosystem.
- **"AIM and AC are interchangeable."** Wrong. The AIM is *expected practice* (procedural guidance, enforceable through §91.13). An AC is *one acceptable means* of compliance with a specific regulation. They serve different functions and are different document types.
- **"A Chief Counsel letter only matters if you're already in trouble."** Wrong. CC letters are working references for daily flying. Mangiamele governs every cost-sharing question; Hicks/Murphy governs every CFI logbook question; Walker governs every preflight briefing. Pilots reference these letters during planning, not only during enforcement.
- **"FAA Orders are pilot reading."** Mostly wrong. Orders govern *the FAA*, not the pilot. They're useful for understanding what an inspector checks or how the FAA enforces, but pilots rarely cite them in primary planning.
- **"49 CFR is for big airlines."** Wrong. 49 CFR Part 830 (NTSB reporting) applies to every pilot. 49 CFR Part 1552 (TSA AFSP) applies to every CFI training a non-citizen. 49 USC 44703 (BasicMed statutory) applies to every BasicMed pilot.
- **"If the FAR says it, the AIM/AC/Chief Counsel doesn't matter."** Wrong. The FAR establishes the legal frame; the other layers fill in what the FAR leaves open. A pilot who can quote the FAR but not the operationalizing AC or the controlling Chief Counsel letter is half-answered.
- **"Triage takes too long for a checkride."** Wrong. Triage takes about 30 seconds for a familiar question and a couple of minutes for an unfamiliar one. Checkride examiners give time for thinking; what they don't give time for is fishing for an answer that's nowhere to be found because you're looking in the wrong document.

## Where this lesson sits

This is the fifth and final lesson of Week 8. It integrates everything: the FAR (Layer 1), 49 CFR (Layer 2), the AIM (Layer 3), Advisory Circulars (Layer 4), Chief Counsel letters (Layer 5), and FAA Orders. The triage discipline is the operating skill the rest of the week installs.

The week's drill set ([drills.md](drills.md)) exercises the triage discipline on 22 prompts. The week's oral ([oral.md](oral.md)) is a checkride-style integration question that walks through finding the authoritative interpretation for a regulatory question with multiple plausible readings.

## Related sections

- §91.13 -- careless or reckless (the indirect enforcement path for AIM/AC deviations)
- §91.103 -- preflight (the canonical example of FAR + AIM + AC + Chief Counsel synthesis)
- §61.113 -- private pilot privileges (the canonical example of FAR + Chief Counsel synthesis)
- §61.31 -- endorsements (the canonical example of FAR + AC synthesis)
- §91.185 -- IFR comm failure (the canonical example of FAR + AIM synthesis)
- 49 CFR Part 1552 -- TSA AFSP
- 49 CFR Part 830 -- NTSB reporting
- AC 61-65, AC 91-92, AC 61-98, AC 90-66 -- the high-yield ACs
- Mangiamele, Hicks, Murphy, Walker -- the famous Chief Counsel letters
- Week 1 [03-companion-documents.md](../week-01-architecture/03-companion-documents.md) -- the introduction
- Week 8 [01-aim-as-expected-knowledge.md](01-aim-as-expected-knowledge.md), [02-advisory-circulars.md](02-advisory-circulars.md), [03-chief-counsel-interpretations.md](03-chief-counsel-interpretations.md), [04-other-titles-and-49-cfr.md](04-other-titles-and-49-cfr.md) -- the per-document deep-dives

## Drills

| Question                                                       | Routing                                       |
| -------------------------------------------------------------- | --------------------------------------------- |
| "What's the minimum visibility for VFR Class E below 10,000?"  | FAR (§91.155)                                 |
| "What's the lost-comm procedure?"                              | FAR (§91.185 IFR) + AIM 6-4 (procedure)       |
| "What endorsement language do I use for tailwheel?"            | FAR (§61.31(i)) + AC 61-65 wording            |
| "Can I split fuel costs with my passenger?"                    | FAR (§61.113(c)) + Mangiamele (CC)            |
| "What's required for me to act as PIC for hire as a private?"  | FAR (§61.113(a)) -- generally no compensation |
| "When must I notify the NTSB?"                                 | 49 CFR 830.5                                  |
| "May I train this Brazilian student?"                          | 49 CFR Part 1552 (TSA AFSP)                   |
| "What does 'all available information' require for preflight?" | FAR (§91.103) + AC 91-92 + Walker (CC)        |
| "What's the recommended pattern entry at a non-towered field?" | AIM 4-3-3 + AC 90-66                          |
| "What's the FAA's enforcement progression?"                    | FAA Order 2150.3                              |
| "When can a CFI log PIC and the student also log PIC?"         | FAR (§61.51(e)) + Hicks / Murphy (CC)         |
| "What does 'cleared for the option' mean precisely?"           | Pilot/Controller Glossary (AIM)               |
| "How long is BasicMed valid?"                                  | FAR (§61.23(c)) + AC 68-1 + 49 USC 44703(j)   |
| "May I move the wreckage to a hangar after a hard landing?"    | 49 CFR 830.10 (generally no)                  |

## Live source

- [@cite](airboss-ref:regs/cfr-14/91/13?at=2026) -- §91.13
- [@cite](airboss-ref:regs/cfr-14/91/103?at=2026) -- §91.103
- [@cite](airboss-ref:regs/cfr-14/91/185?at=2026) -- §91.185 IFR comm failure
- [@cite](airboss-ref:regs/cfr-14/61/31?at=2026) -- §61.31 endorsements
- [@cite](airboss-ref:regs/cfr-14/61/51?at=2026) -- §61.51 logging
- [@cite](airboss-ref:regs/cfr-14/61/113?at=2026) -- §61.113 private privileges
- [@cite](airboss-ref:regs/cfr-49/1552?at=2026) -- 49 CFR Part 1552 TSA AFSP
- [@cite](airboss-ref:regs/cfr-49/830?at=2026) -- 49 CFR Part 830 NTSB
- the AIM -- AIM
- AC 61-65 -- AC 61-65 endorsements
- AC 91-92 -- AC 91-92 preflight briefing
- the Mangiamele letter -- Mangiamele
- the Walker letter -- Walker
- the Hicks letter -- Hicks
- the Murphy letter -- Murphy
