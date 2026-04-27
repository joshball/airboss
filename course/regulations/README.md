---
name: FAR Navigation Course
status: in-development
authoring-started: 2026-04-26
target-audience: pilots from PPL through CFI; primary user is a returning CFI rebuilding regulatory knowledge
sources-of-truth: 14 CFR (Title 14, Code of Federal Regulations), AIM, Advisory Circulars, FAA Chief Counsel interpretations
---

# Federal Aviation Regulations -- a navigation course

A quarter-length college-style course on Title 14, organized so a pilot can navigate the regulatory system, not just memorize rules. The course teaches **how to find the rule** as a first-class skill, alongside **what the rule actually requires** for the parts that matter most to a working pilot.

This is the kind of course we'd have taken in college -- a full quarter on FARs the way we had a full quarter on weather, engines and systems, or aerodynamics. Not a checklist of rules. A treatment of regulation as a system you learn to live inside.

## Status

Authoring. The structure (this README, the [SYLLABUS](SYLLABUS.md), the [DESIGN](DESIGN.md), the [capstone oral](orals/night-ifr-passenger.md)) is being captured first. Per-week lesson content is mostly skeleton -- one lesson is fleshed out as the model. Filling in the remaining weeks is the next pull.

## What this course is

A 10-week course (mappable to longer or shorter) that walks 14 CFR end-to-end with focus calibrated to importance:

| Part            | Treatment      | Why                                                                                  |
| --------------- | -------------- | ------------------------------------------------------------------------------------ |
| Title 14 architecture | Foundation     | You can't navigate a system you don't understand the shape of. Week 1 is non-negotiable. |
| Part 1          | Brisk overview | Definitions. You'll come back to it constantly; learn how to use it.                 |
| Part 61         | Deep           | The pilot. Certificates, ratings, currency, endorsements, CFI rules. Heaviest single block after 91. |
| Part 91         | Very deep      | The flight. Where pilots live. Subpart-by-subpart with checkride-style integration orals. |
| Part 141        | Cursory + literacy | "When does this affect me as a CFI?" + know your way around it.                  |
| Part 135        | Cursory + literacy | Same. Your future commercial students will go there.                              |
| AIM, ACs, Chief Counsel | Companion-document literacy | Where the real interpretation happens.                                  |
| Enforcement system | One week       | Compliance program, certificate action, NTSB Part 830, Pilot's Bill of Rights.    |

## The three pedagogical pillars

This course is built on three approaches that reinforce each other. None alone is sufficient; together they teach navigation, recall, and judgment at the same time.

### 1. Discovery-first pedagogy

Lead with WHY. Let the learner derive the answer. Reveal the regulation as confirmation of reasoning, not as an arbitrary rule. See [ADR 011](../../docs/decisions/011-knowledge-graph-learning-system/decision.md).

> Why do you think the FAA requires an alternate when the destination forecast is marginal?
>
> -> learner reasons: "If the weather closes in I need somewhere to go that I'm not surprised by"
>
> -> reveal 91.169(c) as confirmation: 1-2-3 rule, alternate forecast minimums

The regulation is the punchline, not the premise. This is how the FARs ought to feel: codified versions of what a careful pilot would do anyway.

### 2. Front-to-back reading

For each substantively-treated part (61, 91), the course walks the part **start to finish, in order**, skipping unimportant subparts but always saying *why* we're skipping them and *where* they live. This is how you internalize the structural map. Memorizing "91.103 = preflight" as a fact is brittle. Knowing "subpart B of 91 is Flight Rules - General, and preflight obviously lives there" is durable.

The reading is heavily commented:

- Why this section is here, structurally
- What it solves (what was the problem the FAA was responding to?)
- How it cross-references other parts
- What it actually means in practice (because the literal text is often dense and the practical meaning lives in case law and AC commentary)
- Common misreadings and where pilots get tripped up

The act of reading 91 in order, with running commentary, is the single most reliable way to remember where things live.

### 3. Integration orals (every week, capstone-style)

Every week ends with a checkride-style oral exam segment. Real questions from a real CFI's perspective:

> You're flying tomorrow at night, IFR, with a passenger. Walk me through every regulatory check.

A single question like this pulls from preflight (91.103), currency (61.57), inspections (91.409, 91.411, 91.413), equipment (91.205), oxygen (91.211), fuel (91.167), filing (91.169), alternates (91.169 again). This is how the FARs actually get used.

The orals build week over week. By Week 10 a learner can answer a complex multi-part question pulling from 6+ regulations without notes. See [orals/](orals/) for the bank.

## Course outline -- "the pilot, the flight, the operation"

This framing is the spine. Once you see it, everything fits:

| Phase  | Subject       | Where it lives                              |
| ------ | ------------- | ------------------------------------------- |
| **1. The pilot** | Who is allowed to fly and how they stay allowed | **Part 61** -- certificates, ratings, currency, endorsements, instructor authority |
| **2. The flight** | What rules apply to any individual flight   | **Part 91** -- the operating rules, the equipment rules, the maintenance rules, the airspace rules |
| **3. The operation** | What rules apply to organized commercial / training operations | **Part 141** (training schools), **Part 135** (on-demand commercial), **Part 121** (airline), **Part 145** (repair stations) |

Week 1 establishes this framing. Every subsequent week refers back to it. The architecture week is the load-bearing piece -- skip it and the rest decays into memorization.

## Structure of the repo

```text
regulations/
  README.md            this file
  SYLLABUS.md          week-by-week course layout
  DESIGN.md            authoring rules and pedagogical detail
  week-01-architecture/
    overview.md          what this week teaches and why it must come first
    01-title-14-shape.md the structural map
    02-how-to-read-a-citation.md
    03-companion-documents.md
    04-the-pilot-the-flight-the-operation.md
    drills.md            "find the rule in 60 seconds" timed exercises
    oral.md              week-1 oral
  week-02-part-61-deep/
    overview.md
    01-subpart-walk.md    the front-to-back reading of 61
    02-aeronautical-experience.md
    03-currency-vs-recency-vs-proficiency.md
    04-endorsements.md
    drills.md
    oral.md
  ... etc.
  orals/               full bank of oral questions, indexed by topic and week
  drills/              timed navigation drills, indexed by skill
  references/          links to authoritative sources, AIM, ACs, NTSB cases, Chief Counsel letters
```

## Relationship to course/knowledge/

`course/knowledge/` (the ADR-011 graph) holds atomic regulatory facts -- one node per concept. Examples already there: [reg-currency-vs-proficiency](../knowledge/regulations/currency-vs-proficiency/node.md), [reg-pilot-privileges-limitations](../knowledge/regulations/pilot-privileges-limitations/node.md).

The regulations course **uses** the knowledge graph but is not the graph. Difference:

- **Graph node** = one fact, atomic, for spaced rep ("what does 61.57(c) require?")
- **Course lesson** = the structural walk through where that fact lives, why it's there, and what other facts it sits next to

When a course lesson references a fact that should be a graph node, the lesson links to the node (or flags one to be authored). The graph stays the source of truth for the fact; the lesson stays the source of truth for the *navigation*.

## Authoring posture

- We are not the FAA. We don't write regulations. We help pilots navigate them.
- Quote the actual CFR text. Don't paraphrase regulations into our own words and then rely on the paraphrase. Pilots need to be comfortable with the actual statutory voice.
- Cite authoritative interpretation (Chief Counsel letters, NTSB Board orders) when meaning is contested.
- Keep AC and AIM references current; both are revised often.
- Date every claim that depends on a regulation as of a given date. Regs change; our content has to be auditable.
- See [DESIGN.md](DESIGN.md) for the full authoring rules.
