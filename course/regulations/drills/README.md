# Drills -- the navigation skill

The drill bank is the navigation pillar of the course. The skill is not "answer the question." The skill is **locate the regulation in 60 seconds**.

## Why timed location

Pilots don't use the FARs by reciting them. They use them by knowing where to look and looking up the answer. A pilot who can find 61.57 in 30 seconds and read it carefully will out-perform a pilot who has 61.57 memorized but can't find adjacent regulations. The drill builds the index in your head.

## Drill formats

### "Find the rule in 60 seconds"

Given a prompt, name the part / subpart / section. Don't answer the question -- just locate.

| Prompt | Answer | Time |
| --- | --- | --- |
| Where are supplemental oxygen requirements? | 91.211 | 60s |
| Where is flight review currency? | 61.56 | 60s |
| Where is night currency for passengers? | 61.57(b) | 60s |
| Where is the IFR alternate weather forecast standard? | 91.169(c) | 60s |
| Where is the no-MEL pathway for inop equipment? | 91.213(d) | 60s |
| Where is the 24-month transponder check? | 91.413 | 60s |
| Where is the 24-month altimeter/static check? | 91.411 | 60s |
| Where are VFR night equipment additions? | 91.205(c) | 60s |
| Where is the rule about ELT battery replacement? | 91.207(c)/(d) | 60s |
| Where is PIC authority to deviate from rules in an emergency? | 91.3(b) | 60s |

These map directly to flash cards in `apps/study/`. The card type is **navigation prompt** -- the front shows the prompt, the back shows the citation. Spaced rep schedule per the existing study engine.

### Scenario decomposition

Given a multi-condition scenario, list the regulations that apply. Examples:

> A 250-hour private pilot, 12 calendar months since flight review, takes a friend tomorrow on a VFR cross-country in a club 172 with an annual 11 calendar months ago. Forecast is calling for marginal VFR. List every regulation you'd check.

Expected list:

- 61.56 -- flight review (about to expire; might be why the question is asked)
- 61.57(a) -- 90-day passenger currency (3 takeoffs and landings)
- 91.103 -- preflight action (especially "all available information" and weather)
- 91.155 -- VFR weather minimums (marginal forecast)
- 91.167 (only if filing IFR; not here)
- 91.205(b)(c) -- VFR equipment (day or night per ETA)
- 91.213 -- if anything is broken
- 91.409(a) -- annual current
- 91.409(b) -- 100-hour, only if club rents for hire or is used for instruction for hire
- 91.207 -- ELT current
- 91.215 -- transponder, depending on airspace

These map to scenario cards in `apps/study/`. Card type is **regulatory inventory** -- the front shows the scenario, the back shows the inventory.

### Citation parsing

Given a citation, parse it correctly. Example prompts:

| Prompt | Answer |
| --- | --- |
| Read aloud: 91.169(c)(1)(i) | Title 14, Part 91, Section 169, paragraph (c), sub-paragraph (1), item (i) |
| What's the difference between 91.103 and 91.13? | 91.103 is preflight action; 91.13 is careless or reckless. Different sections, different subjects. |
| What's the difference between Part 91, Subpart B and Part 91, Section B? | Subparts are sub-divisions of a Part. There's no "Section B" -- sections are numbered. |

Parsing drills exist because pilots read citations sloppily and miss paragraph-level distinctions that change meaning.

## How the drill bank grows

Authoring posture: every regulatory section that gets a deep lesson should have at least three drills:

1. One "find the rule in 60 seconds" prompt
2. One scenario where that rule is one of several to check
3. One citation parsing prompt (where applicable)

When a lesson is authored, the drills land in this directory at the same time. The drills are the connective tissue between the lessons and `apps/study/`.

## Index (will populate as lessons are authored)

| Drill set | Source lesson | Card count |
| --- | --- | --- |
| Title 14 architecture | week-01-architecture/ | TBD |
| Part 61 navigation | week-02-part-61-deep/ | TBD |
| Part 61 CFI | week-03-part-61-cfi/ | TBD |
| Part 91 general | week-04-part-91-general-and-flight-rules/ | TBD |
| Part 91 equipment / maintenance | week-05-part-91-equipment-and-maintenance/ | TBD |
| Part 91 special ops | week-06-part-91-special-ops/ | TBD |
| Parts 141 / 135 | week-07-parts-141-and-135/ | TBD |
| Companion documents | week-08-companion-documents/ | TBD |
| Enforcement | week-09-enforcement/ | TBD |
