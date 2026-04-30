---
title: Chief Counsel interpretations -- binding within their scope
week: 8
section_order: "03"
covers_regulations:
  - 61.51
  - 61.113
  - 61.193
  - 91.103
ties_to_knowledge_nodes:
  - reg-pilot-privileges-limitations
last_verified: 2026-04-29
---

# Chief Counsel interpretations

The FAA Office of Chief Counsel issues interpretive letters when a regulation's meaning is contested. The letters bind the FAA's enforcement position: if the Chief Counsel says "the rule means X," the FAA will not later prosecute someone for following X. Pilots who internalize this read the famous letters by name -- Mangiamele on cost-sharing, Hicks on logging, Murphy on instruction-time logging -- and use them to settle questions the CFR alone leaves open.

This is the document type pilots most commonly *don't* know exists. The CFR appears to be the final word; checkride examiners then ask a question whose actual answer lives in a Chief Counsel letter, and the pilot has nothing to say.

## What you'll be able to do

- Articulate the regulatory force of a Chief Counsel letter (binding on FAA enforcement, within the scope of the question presented)
- Cite the famous letters by recipient name and state what each one settled: Mangiamele (cost-sharing common purpose), Hicks (CFI logging PIC), Murphy (instruction time vs. PIC time)
- Find Chief Counsel letters at the FAA's chief-counsel-letters page and predict where new interpretations will appear
- Recognize when a CC letter overrides what looks like a plain reading of the FAR
- Know the limits of a CC letter -- one letter can be superseded by a later one, and a letter does not amend the regulation

## Why this matters

The CFR is written in general language. Specific applications routinely create ambiguity. When pilots and the FAA disagree about how a specific case maps to a general rule, the Chief Counsel office issues a letter resolving the question. The letter becomes the FAA's official enforcement position. A pilot who can cite the letter has functional certainty; a pilot relying on a plain reading of the regulation may operate with a wrong intuition for years and then discover, in an enforcement action, that the FAA reads the rule the other way.

For working CFIs, knowing the famous letters is part of professional fluency. Conversations among CFIs frequently reference letters by recipient name -- "yeah, but Hicks settled that" -- the same way a lawyer references case law. A CFI who doesn't know what Hicks settled cannot follow the conversation.

## The discovery question

A private pilot wants to fly a coworker from KPAO to a wedding in San Diego. The coworker offers to split the fuel costs pro-rata. §61.113(c) authorizes pro-rata cost-sharing for "a flight ... a common purpose." The pilot reads the rule and concludes: as long as the coworker doesn't pay more than half the fuel, this is fine.

Pause.

§61.113(c) reads:

> "A private pilot may not pay less than the pro rata share of the operating expenses of a flight with passengers, provided the expenses involve only fuel, oil, airport expenditures, or rental fees, and the pilot and the passengers have a common purpose for the flight."

"Common purpose for the flight." What does that phrase actually require?

The CFR doesn't say. The cost-sharing rule has been on the books since 1973. By 2009 the FAA had seen enough abuse cases to need a clean doctrinal statement. Enter the **Mangiamele letter (2009)**, in which the Chief Counsel held:

> "Common purpose" requires the pilot to have an actual independent reason for the flight that is not dependent on having a passenger pay. If the pilot would not have made the flight but for the passenger's contribution, "common purpose" is not satisfied -- the pilot is, in effect, being paid to provide transportation, even if the payment is structured as cost-sharing.

The Mangiamele test: would the pilot have made this flight without the passenger? If yes, common purpose is plausible. If no, it's transportation for hire and the cost-sharing safe harbor doesn't apply.

Apply this to the wedding scenario. Was the pilot going to San Diego anyway, and the coworker is along for the ride? Common purpose plausible. Did the pilot decide to go *because* the coworker asked and offered to split costs? Common purpose fails. The same surface fact pattern -- one pilot, one passenger, San Diego, pro-rata fuel split -- can be legal or illegal depending on which side of the Mangiamele test the pilot's actual motivation falls.

The CFR alone gave no way to draw the line. The CC letter drew it.

## The structure of a Chief Counsel letter

A typical FAA Chief Counsel interpretive letter has the following anatomy:

```text
Letterhead -- FAA Office of Chief Counsel
Date
Recipient (the pilot, attorney, or organization that asked)
Re: <CFR section being interpreted>

Dear <recipient>,

This responds to your <date> letter requesting an interpretation
of <section>.

You ask whether <specific question>.

[Background facts as the recipient stated them]

[Statement of the regulation]

[Analysis -- how the office reads the regulation, often with reference
to legislative history, prior interpretations, NTSB precedent, the
purpose of the rule]

[Conclusion -- the answer to the specific question, often with
caveats]

Sincerely,
<Chief Counsel attorney signature>
```

Letters are short -- usually 2-5 pages. Letters are *narrow* -- they answer the question presented, not every conceivable related question. A letter on cost-sharing for a single specific scenario does not necessarily settle every cost-sharing scenario, only the one analyzed. Reading the letter carefully includes reading what the letter does *not* answer.

## How to find Chief Counsel letters

The FAA publishes interpretive letters at the [FAA Office of Chief Counsel page](https://www.faa.gov/about/office_org/headquarters_offices/agc/practice_areas/regulations/interpretations). The page lets you:

- Search by year of issue
- Search by CFR section interpreted
- Search by recipient name (the most common form)
- Search by topic keywords

For airboss-internal references, letters are addressable through the reference system as `[@cite](airboss-ref:cc-letters/<recipient>?at=<date>)`.

A CFI building a personal reference shelf typically downloads the high-yield letters (a dozen or so) into a single folder and re-reads them annually. The letters are short enough that a re-read takes a couple of hours.

## The famous letters and what they settled

This is the canonical list. Working pilots and CFIs reference these by recipient name in conversation; oral exam answers cite them by recipient name and year.

### Mangiamele (2009) -- §61.113(c) cost-sharing common purpose

The letter analyzes when pro-rata cost-sharing under §61.113(c) is legal vs. when it crosses into prohibited compensation. Holdings:

- "Common purpose" requires the pilot have an independent reason to make the flight, beyond the passenger's contribution.
- If the pilot would not have flown without the passenger's payment, the flight is "for compensation" and §61.113(a) prohibits it.
- The cost-sharing safe harbor is narrow. Exotic structures (LLC arrangements, loose group dynamics where the pilot is "always the one flying") commonly fail the test.

Why this matters: every private pilot eventually wonders "can I split costs with this passenger?" The Mangiamele letter is the answer key.

### Hicks (2009 / 2010) -- §61.51 logging by an instructor

Two letters, sometimes both cited, on the question of when a CFI may log PIC time vs. instruction-given time. Holdings:

- A CFI providing flight instruction may log PIC time when *acting* as PIC of the flight (regulatory PIC under §1.1) under §61.51(e)(3).
- A CFI manipulating the controls may log PIC as sole manipulator under §61.51(e)(1)(i) if rated in the category and class.
- The student may *also* log PIC for the same flight if the student is *acting* as PIC (e.g., a private pilot rated and current taking instruction in the same airplane and being designated PIC for the flight) -- there can be two PIC-loggers on one flight.
- Logging "instruction given" is required for the CFI when conducting instruction (§61.51(d)(1)); whether the same flight also yields PIC for the CFI is a separate analysis.

Why this matters: the rated student under instruction question generates the most logbook confusion in CFI training. Hicks settles the canonical case.

### Murphy (2014) -- §61.51(e) PIC logging by a CFI

A more refined question: when a CFI provides instruction in a flight, when (specifically) may the CFI log PIC vs. only instruction given? Holdings:

- A CFI providing instruction *and* serving as the legal PIC of the flight (the only rated pilot, or specifically designated as PIC by the operator) logs PIC under §61.51(e)(3).
- A CFI giving instruction to a rated pilot who is acting as PIC -- the rated pilot logs PIC; the CFI logs only instruction given (unless the CFI is sole manipulator and rated in the category/class, in which case the CFI may also log PIC under (e)(1)(i)).
- The two-PIC-loggers scenario is real but narrow: it requires (a) the rated student is acting as PIC and (b) the CFI is sole manipulator at some point in the same flight.

Murphy refines Hicks. Together they're the working CFI's logbook bible.

### Walker (2017) -- §91.103 "all available information"

The cleanest interpretation of what 91.103 actually demands. The letter analyzes "all available information" in the context of pre-flight self-briefing. Holdings:

- "All available information" includes information the pilot reasonably should have sought. Active-effort obligation, not passive-receipt obligation.
- The pilot must affirmatively check NOTAMs, weather, fuel, alternates, and other safety-relevant information before flight.
- A pilot who failed to check available information -- e.g., didn't get a weather briefing -- and an accident occurred is in violation of 91.103, separate and apart from any 91.13 (careless or reckless) charge.
- AC 91-92 describes acceptable means; the regulation requires *the substance*, not the specific procedure.

Why this matters: 91.103 is the most-cited preflight regulation, and "all available information" is the phrase examiners ask about. Walker is the answer key.

### Carr / Lobeiko / Beard / Pirsch -- the supporting case law (NTSB)

Less well-known than the famous Chief Counsel letters but cited often in oral exams. These are NTSB Board orders rather than CC letters, but they appear in the same conversations:

- **Lobeiko** -- refines the §91.13 careless-or-reckless standard, particularly the "willful disregard" reading.
- **Pirsch** -- on the knowledge-of-weather requirement of §91.103.
- **Beard** -- on the duty of care for fuel exhaustion.

NTSB Board orders are technically appellate decisions on FAA enforcement actions; they bind the FAA in subsequent proceedings. CC letters are administrative interpretations; they bind the FAA's enforcement position. Both are first-class references.

## When a Chief Counsel letter overrides plain reading

Sometimes the regulation appears to say one thing and the CC letter says something else. The letter governs (within its scope) because the FAA will not enforce contrary to its own published interpretation. Examples:

### §61.51 logging -- the plain reading suggests one PIC per flight; Hicks says two are possible

Plain reading of §61.51(e): "A pilot may log pilot in command flight time" suggests singular. The Hicks/Murphy interpretation: the regulation is permissive, not exclusive. Two pilots can each log PIC if each independently meets a §61.51(e) criterion (one acting as PIC, the other sole manipulator and rated). The letter is the FAA's official position.

### §61.113(c) cost-sharing -- the plain reading admits any pro-rata; Mangiamele requires common-purpose substance

Plain reading: "the pilot and passengers have a common purpose for the flight" -- ambiguous. The Mangiamele interpretation: "common purpose" has substantive content (independent reason for the flight). The letter narrows the apparent breadth of the regulation.

### §91.103 -- the plain reading is procedural; Walker reads in an active-effort obligation

Plain reading: "shall, before beginning a flight, become familiar with all available information" -- could be read as "passively receive what's offered." The Walker interpretation: the pilot has a duty to *seek* information, including NOTAMs, weather, and fuel. The letter expands the apparent passivity of the regulation.

In each case the plain reading and the letter read differently. Working pilots and CFIs follow the letter, because the FAA enforces the letter.

## Limits of a Chief Counsel letter

CC letters are powerful but not all-powerful. Three important limits:

### 1. A letter does not amend the regulation

The regulation itself is unchanged by a CC letter. If the FAA undertakes a rulemaking that changes the regulation, the new regulation can supersede a prior letter. CC letters are *interpretive*; they read the existing regulation. Rulemaking is *legislative*; it changes the regulation.

### 2. A later letter can supersede an earlier letter

The FAA Chief Counsel can revise its position in a later letter. The most recent letter on a question is the controlling one. A 2009 letter may be modified by a 2018 letter. Always check for the most recent letter on a question before relying on an older one. The FAA's interpretive-letter index is dated; the dates matter.

### 3. A letter binds within the scope of the question presented

A letter answers the specific question the recipient asked. It does *not* settle every conceivable related question. A letter on cost-sharing in a flight to a wedding does not necessarily settle cost-sharing in a flight to a business meeting. The factual frame matters. CFIs reading a CC letter look carefully at the question presented and the analysis to see how broadly the holding extends.

## Common misreadings

- **"A Chief Counsel letter is regulation."** Wrong. A letter is *interpretation*. It binds the FAA's enforcement position but does not amend the rule. A new letter can change the FAA's reading; only rulemaking changes the rule.
- **"A Chief Counsel letter binds courts."** Mostly wrong. The letter binds FAA enforcement; the NTSB (which hears appeals from FAA enforcement) generally defers to the letter under *Auer / Skidmore / Chevron* deference doctrines, but the deference is not absolute. In practice, NTSB and federal courts almost always follow the letter, but technically they could decline.
- **"Mangiamele means I can never split fuel costs."** Wrong. Mangiamele applied the common-purpose test. If you genuinely have an independent reason for the flight and a passenger is along for the ride, pro-rata cost-sharing is legal. The test is substantive, not formalistic.
- **"Hicks lets me log PIC any time I'm in the airplane."** Wrong. Hicks/Murphy specifically govern the case where (a) the pilot is sole manipulator and rated in category/class, or (b) the pilot is acting as PIC of the flight. Sitting in the right seat without manipulating doesn't yield PIC.
- **"There's only one Chief Counsel letter on each topic."** Wrong. The FAA has issued many letters on cost-sharing, on logging, on currency. The famous letters (Mangiamele, Hicks, Murphy, Walker) are the high-yield ones, but there are others. Searching the FAA's interpretive letter index reveals the full set.
- **"If a letter doesn't match my situation exactly, it doesn't apply."** Half-true. The letter binds *the question presented*. But the analysis often extends by analogy to similar fact patterns. Working CFIs read the analysis section carefully -- not just the conclusion -- to understand how broadly the holding extends.
- **"I can't cite a letter in an oral exam."** Wrong. Citing a letter by recipient name and year is the *expected* way to demonstrate fluency. "Per Mangiamele, common purpose requires an independent reason for the flight." Examiners hear this and know they're talking to someone who has done the reading.

## Where this lesson sits

This is the third lesson of Week 8. Together with [01-aim-as-expected-knowledge.md](01-aim-as-expected-knowledge.md) (expected practice) and [02-advisory-circulars.md](02-advisory-circulars.md) (acceptable means), this lesson covers the *binding interpretation* layer. The remaining lessons cover other-title regulations (49 CFR) and the integration -- where the actual answer lives for any regulatory question.

## Related sections

- §61.51 -- pilot logbooks (the Hicks and Murphy turf)
- §61.113 -- private pilot privileges (the Mangiamele turf)
- §61.193 -- CFI privileges (cross-references the Hicks/Murphy logging analysis)
- §91.103 -- preflight action (the Walker turf)
- §91.13 -- careless or reckless (overlay for many CC letters)
- AC 91-92 -- preflight briefing (operationalizes the Walker reading)
- Week 1 [03-companion-documents.md](../week-01-architecture/03-companion-documents.md) -- the introduction
- Week 8 [01-aim-as-expected-knowledge.md](01-aim-as-expected-knowledge.md) -- AIM
- Week 8 [02-advisory-circulars.md](02-advisory-circulars.md) -- ACs
- Week 8 [05-where-the-real-answer-lives.md](05-where-the-real-answer-lives.md) -- the integration
- Week 2 [03-currency-vs-recency-vs-proficiency.md](../week-02-part-61-deep/03-currency-vs-recency-vs-proficiency.md) -- where currency questions intersect with logging interpretations
- Week 9 -- enforcement (where NTSB Board orders are deep-dived)

## Drills

| Question                                                                            | Letter / authority                                                                                 |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| What does "common purpose" require for §61.113(c) cost-sharing?                     | Mangiamele (2009)                                                                                  |
| When may a CFI log PIC time on a flight with a rated student?                       | Hicks (2009), Murphy (2014)                                                                        |
| What's the standard for "all available information" under §91.103?                  | Walker (2017) + AC 91-92                                                                           |
| Where does the FAA publish interpretive letters?                                    | faa.gov chief-counsel page                                                                         |
| What's the §91.13 "careless or reckless" standard precisely?                        | Lobeiko (NTSB) + 91.13 case law                                                                    |
| Does the NTSB defer to a Chief Counsel letter?                                      | Generally yes (Auer / Skidmore deference); rarely declines                                         |
| Can a later letter supersede an earlier letter on the same question?                | Yes -- always check the most recent letter                                                         |
| Can a Chief Counsel letter amend a regulation?                                      | No -- only rulemaking amends a regulation                                                          |
| Is "the Mangiamele test" the same in 2026 as in 2009?                               | Yes unless the FAA has issued a later letter; check the interpretive-letter index                  |
| When can two pilots both log PIC for the same flight?                               | When one is acting as PIC and the other is sole manipulator rated in category/class (Hicks/Murphy) |
| Where would I look for an interpretation of an unusual §61.31 endorsement scenario? | FAA chief-counsel-letters page, search by §61.31 or by topic                                       |

## Live source

- the Mangiamele letter -- Mangiamele letter (2009)
- the Hicks letter -- Hicks letter (2009)
- the Murphy letter -- Murphy letter (2014)
- the Walker letter -- Walker letter (2017)
- [@cite](airboss-ref:regs/cfr-14/61/51?at=2026) -- §61.51 logging
- [@cite](airboss-ref:regs/cfr-14/61/113?at=2026) -- §61.113 private pilot privileges
- [@cite](airboss-ref:regs/cfr-14/91/103?at=2026) -- §91.103 preflight action
- [@cite](airboss-ref:regs/cfr-14/91/13?at=2026) -- §91.13 careless or reckless
- AC 91-92 -- AC 91-92 preflight briefing
