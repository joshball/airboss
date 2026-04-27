# Authoring rules

This document is for anyone (the user, an agent, a future contributor) writing course material in [course/regulations/](README.md). The rules exist because regulatory content is uniquely easy to author wrong. Follow them.

## Voice and accuracy

- **Quote the actual CFR text.** Don't paraphrase regulations into our own words and rely on the paraphrase. The pilot needs to be comfortable with the actual statutory voice -- they will read it again on a checkride and at every flight review for the rest of their career.
- **When you paraphrase for explanation, mark it.** Use a "**Plain reading:**" prefix or set the paraphrase apart from quoted material. Never let our paraphrase look like the regulation.
- **Cite by section, not by name.** "61.57(c)" not "the IFR currency rule." Build the citation muscle.
- **Date every claim.** Regulations change. Every lesson should have a `last_verified` date in the frontmatter. If the lesson references a version of a regulation, name the date the regulation was last revised.
- **When meaning is contested, cite the interpretation.** Chief Counsel letters, NTSB Board orders, and on-point ACs are first-class references. The Mangiamele, Hicks, Murphy, and Walker letters are famous because they decided things the regulation alone left unclear.
- **Never invent rules.** If you can't cite it, it's not in the course.

## Structure of a lesson

Each lesson file is a single markdown document with the following sections, in order:

```markdown
---
title: <short title>
week: <1-10>
section_order: <01, 02, 03 ...>
covers_regulations: [<list of CFR sections referenced>]
ties_to_knowledge_nodes: [<list of course/knowledge/ slugs>]
last_verified: YYYY-MM-DD
---

# <title>

## What you'll be able to do

<observable, testable competencies. 2-4 bullets.>

## Why this matters

<the WHY. Lead here, not with the rule.>

## The discovery question

<the scenario or question that the learner reasons about before seeing the regulation>

## What the regulation actually says

<the quoted CFR text, with citation. No paraphrase yet.>

## What it actually means

<plain reading + the practical implications + the case-law / Chief Counsel context>

## Where it sits

<structural map: this is in Part X, subpart Y, between section Z-1 and section Z+1, and its neighbors are about ___.>

## Common misreadings

<the trap. The thing pilots think it says vs. what it actually says.>

## Related sections

<links to other lessons + knowledge graph nodes + AIM references>

## Drills

<2-5 short drills the learner can do. Either tied to flash-card surfaces in apps/study/ or paper drills.>
```

Use this template. Don't deviate without a reason.

## Front-to-back reading

For each part we treat substantively (61, 91, 141 subpart A), there is a `01-subpart-walk.md` file that is the front-to-back commentary. This file:

- Walks every section in order
- For each section: one to four lines of commentary on what it does, why it's there, what its neighbors are
- Names sections explicitly even when we're skipping them ("subpart F applies to large turbine multi-engine -- skip for now, but know it's here")
- Refers out to the deep-dive lesson files for the sections that get full treatment

The walk is not a substitute for the deep lessons -- it's the connective tissue. Reading the walk gives you the structural map; reading the deep lessons gives you the substance.

## Discovery-first

Per [ADR 011](../../docs/decisions/011-knowledge-graph-learning-system/decision.md). Lead with the scenario, let the learner reason, then reveal the regulation. The flow is:

1. Scenario or question (1-3 sentences)
2. Pause -- "what would you require?"
3. Reveal the regulation
4. Frame: "the FAA codified what a careful pilot would do anyway"
5. Show the surprises (where the codification differs from intuition, or where the codification has gaps)

The scenario should be specific and concrete. Generic scenarios ("a pilot wants to fly") teach nothing. Specific scenarios ("a 200-hour private pilot wants to fly KPAO -> KSBA at night with three friends in a 172, broken layer at 8000, forecast holding") force engagement.

## Common misreadings

Every lesson surfaces at least one common misreading. The trap. The thing students get wrong in oral exams. Examples:

- 91.103 -- pilots think they have to "review" weather. The reg says "become familiar with all available information." Different bar.
- 61.57(c) -- the six-six-HIT rule. Pilots conflate "current" (legal to fly IFR PIC) with "proficient" (actually safe to fly IFR PIC). The rule is the floor, not the standard.
- 91.205 -- ATOMATOFLAMES is for VFR day. Pilots add the FLAPS items thinking they need them for VFR day. They don't.
- 91.213 -- pilots think a placard alone is enough. It's the *third* step in the no-MEL pathway, after determining the equipment isn't required and isn't placarded as required.

If the lesson doesn't have a Common Misreadings section with at least one specific trap, the lesson isn't done.

## Drills

Two flavors of drill in this course:

### "Find the rule in 60 seconds"

Given a question, point at the part / subpart / section. Timed. The drill is *not* answering the question -- it's locating the regulation. Examples:

| Prompt                                                           | Answer                          | Time |
| ---------------------------------------------------------------- | ------------------------------- | ---- |
| Where is the rule about supplemental oxygen for crew?            | 91.211                          | 60s  |
| Where is the rule about flight review currency?                  | 61.56                           | 60s  |
| Where is the rule about ELT battery replacement intervals?       | 91.207                          | 60s  |
| Where do you find the syllabus for a Part 141 private pilot course? | Part 141 Appendix B           | 60s  |

These translate directly to flash cards in `apps/study/`. The card type is "navigation prompt" -- you're not asked to recall the rule's content, just its location.

### Scenario drills

Given a multi-condition scenario, what regulations apply? Examples:

> A 250-hour private pilot, 12 calendar months since flight review, wants to take a friend tomorrow on a VFR cross-country in a club 172 that had its annual 11 calendar months ago. What regulations are you checking?

The drill produces a list of regulations and the answer to each. These translate to scenario cards in `apps/study/`.

## Oral exam segments

Each week has an oral file at `week-NN-.../oral.md` with at least one full integration question and the model answer. These are the spine of the integration pillar.

The bank in `orals/` collects all orals and indexes them by topic + week + difficulty.

The format of an oral file:

```markdown
---
title: <one-line scenario>
week: <NN>
difficulty: foundation | working | challenge | capstone
pulls_from_regulations: [<list>]
duration_minutes: <typical oral length>
---

# <Scenario>

## The question

<the prompt, exactly as a CFI examiner would deliver it>

## What this is testing

<short list of knowledge / navigation skills the question exercises>

## Model answer (full walkthrough)

<a complete, numbered walkthrough showing the correct answer with commentary on why each step matters>

## What goes wrong (failure modes)

<3-5 common errors in answering this oral, with diagnosis>

## Variant prompts

<related questions that exercise the same content from different angles>
```

The capstone oral at [orals/night-ifr-passenger.md](orals/night-ifr-passenger.md) is the canonical example.

## Knowledge-graph integration

When a lesson surfaces an atomic fact that should live in `course/knowledge/`:

1. Check if a node already exists. If yes, link to it.
2. If no, flag it in the lesson's frontmatter as `ties_to_knowledge_nodes: [<proposed-slug>]` and note in the frontmatter `node_status: proposed`.
3. Author the node when you author the lesson, not later. The lesson and the node ship together.

Existing regulatory nodes:

- [reg-currency-vs-proficiency](../knowledge/regulations/currency-vs-proficiency/node.md)
- [reg-pilot-privileges-limitations](../knowledge/regulations/pilot-privileges-limitations/node.md)

The course will produce many more.

## What we don't do

- We don't write the regulations. The CFR is authoritative. We refer to it.
- We don't replace the AIM. The AIM is authoritative for procedure. We refer to it.
- We don't replace ACs. We point at them and explain when each applies.
- We don't moralize. The regulations are not a values statement. Where they intersect with values (medical fraud, fitness for duty), we cite the rule and state the consequence; we don't sermonize.
- We don't memorize for memorization's sake. If a fact has no operational consequence, we skip it. Knowing that 91.318 exists is enough; reading it cover to cover is not the goal.
