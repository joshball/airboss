# Learning Philosophy

How airboss thinks about aviation knowledge, certificates, and the learner. Source of truth for product shape; ADRs implement against this. If a feature contradicts something here, the feature is wrong, the philosophy gets updated explicitly, or both.

Companion: [ADR 016 -- Cert, Syllabus, Goal, and the Multi-Lens Learning Model](../decisions/016-cert-syllabus-goal-model/decision.md) implements this for the cert-syllabus-course composer work.

## The ten principles

### 1. Knowledge is a graph, not a tree

A concept like "angle of attack" is one thing in the world. It shows up in PPL stalls, IR unusual-attitude recovery, CPL chandelles, CFI teaching, multi-engine VMC, and aerobatics. A tree forces duplication or false hierarchy. The right primitive is a directed graph with typed edges (`requires`, `deepens`, `applies`, `teaches`, `related`). One node, many contexts.

### 2. A cert is a constraint set over the graph, not a container of content

A certificate is a legal artifact. The FAA defines it via the ACS or PTS: Areas of Operation -> Tasks -> Elements, each with required depth, references, and standards. A **syllabus** is a separately authored object whose leaves point at graph nodes with `{required_depth, required_bloom, references}`. The graph is the truth; the syllabus is the rubric. Courses, certificates, ratings, endorsements -- all syllabi.

### 3. Certs compose, they don't nest

PPL+IR+CPL+CFI+CFII+MEI+MEII+ME isn't a line. It's a DAG of certificates and ratings: pilot certs (Student, Sport, Rec, Private, Commercial, ATP), instructor certs (CFI, CFII, MEI, GI variants), ratings (Instrument, Multi-engine, type ratings, ASES), endorsements (complex, high-perf, tailwheel, high-altitude, spin). Each is its own object with its own ACS/PTS or 61.31 endorsement requirement. "What do I need to study" composes across whichever set the learner is pursuing.

### 4. Personal learning is orthogonal to certificates

A returning CFI who hasn't flown in thirty years doesn't have a cert-shaped need. He has a **goal**: be ready to instruct PPL students again, plus get current on IR, plus add Commercial/Multi/CFII/MEI. The right primitive is a learner-owned **Goal** that references zero or more syllabi (with optional weights and sequencing) plus ad-hoc graph nodes plus user-authored material. The system schedules against the union. Goals can be cert-agnostic (BFR prep, "stay sharp") or multi-cert. A goal is what the learner needs; a course is what someone teaches. Conflating them is the standard LMS mistake.

### 5. Progress rolls up at every level the learner thinks at

The learner thinks: "How am I doing on PPL? On the IR? On Area V Task B specifically? On angle-of-attack across all my certs?" These are different rollups. Mastery is computed at the **graph node** -- the unit of evidence (cards, reps, accuracy, stability) -- and projected upward through whatever structure asks: Element -> Task -> Area -> Cert (syllabus rollup), Domain (graph rollup), Goal (user rollup), Bloom level (depth rollup), phase-of-flight (operational rollup). All projections of the same underlying node-mastery state.

### 6. Multiple lenses are a primary feature, not a setting

The ACS structure is one valid lens. A pilot brain doesn't actually work that way -- we think by phase of flight, by aircraft system, by failure mode, by weather scenario, by what we just got wrong. The system never picks a primary structure. The graph is structureless (nodes + edges); every named structure (ACS, domain taxonomy, phase-of-flight, instructor lens, weakness map, handbook chapter) is a view on top. Same content, many entry points, one state.

### 7. Sequencing is an opinion, not a constraint

The FAA does not say "learn airspace before weather." Real instruction interleaves. The graph's `requires` edges encode genuine prerequisites (you can't do unusual-attitude recovery without first knowing what a stall is); everything else is **suggested order**, owned by syllabi or goals. Most ordering is advisory. "You cannot start X until Y" is rare and earned.

### 8. References are first-class

Every claim ties back to a source: a CFR section, an AC, a chapter of the PHAK, a paragraph of the AIM. References are their own object (cite once, link many times), versioned (Part 61 changes), and surfaced at the point of learning. The ACS lists references per task; that is the spine of legitimacy. Every syllabus leaf, every node, every card, every scenario carries citations that resolve to the same reference object.

### 9. Evidence of mastery has to match the kind of knowledge

You cannot multiple-choice your way to "demonstrate steep turns." Each node declares what evidence counts (recall card, calculation, scenario decision, simulator demonstration, oral exam answer, teaching exercise). Mastery rolls up only from matching evidence. A CFI candidate has to *teach* a topic, not just answer a card about it. Recall is one signal; judgment, performance, and instruction are the others.

### 10. The system is the learner's, not the course author's

The product centers the learner's state -- what I know, what I'm forgetting, what I haven't seen, what's coming due, what's blocking what -- not the course's content. A course-shaped UI puts content first; a learner-shaped UI puts the next-best action first. Both views can exist; the learner-shaped one is primary.

## What this implies for the model

Five objects, layered:

| Layer | Object | Owner | Purpose |
| ---------- | ----------------------- | ------ | ------------------------------------------------------------------ |
| Truth | Knowledge graph (nodes) | System | The aviation concepts themselves; one node per concept |
| Truth | References | System | Cited sources; CFR/AC/handbook/AIM, versioned |
| Structure | Syllabus | System | Authored projection (ACS/PTS/endorsement) onto the graph |
| Structure | Cert / Rating | System | Regulatory artifact; composes via prerequisite DAG |
| Learner | Goal | User | What this learner is pursuing; multi-syllabus, possibly cert-agnostic |

Sessions, cards, reps, mastery, dashboards -- all derive from these.

## Handbook integration

The FAA handbooks (PHAK, AFH, Aviation Weather Handbook, Instrument Flying Handbook, Instrument Procedures Handbook, IFH, helicopter and balloon and glider handbooks, AC 00-6, AC 00-45, etc.) are **reference material**, not curriculum. They explain concepts; the ACS tests them; our graph teaches them.

The relationship:

- **Handbooks are reference objects.** Each handbook is a versioned reference (FAA-H-8083-25C is a specific edition of the PHAK). Sub-references resolve to chapter, section, page, or paragraph.
- **Handbooks overlap deliberately.** The PHAK covers weather at survey depth; the Aviation Weather Handbook covers it operationally; the IFH covers icing again with an instrument-flying focus. Each is a *lens* on weather knowledge, written for different stages and missions. The graph mirrors this: one set of weather nodes, multiple handbook references per node, with the *handbook's framing* recorded so we can show "PHAK introduces this; AvWX deepens it; IFH applies it to IFR."
- **Handbooks are not 1:1 with the ACS.** ACS Area V Task A ("Pilotage and Dead Reckoning") references PHAK Ch 16, AFH Ch 4, and AIM 5-1 -- three handbooks for one task. Conversely, PHAK Ch 12 (Weather Theory) supplies content for several ACS tasks across multiple certs. The graph is the only place that resolves this many-to-many.
- **Handbooks become navigable lenses.** "Browse by handbook" is a peer to "browse by ACS" and "browse by domain." Open the PHAK, see its chapters, drill into a chapter, see the graph nodes that reference it, see your mastery on those nodes, jump into learning. Same content, handbook-shaped entry.
- **Authored content is *not* a copy of the handbooks.** The graph teaches concepts the way a good instructor teaches them -- discovery-first, reasoning-from-physics, with the regulation revealed as confirmation. Handbooks are cited as the authoritative source; we never substitute paraphrase for the source. When a learner wants the FAA's wording, we link to the chapter.
- **Handbook editions are versioned.** Part 61 changes; the PHAK gets revised; the ACS publishes new editions. References carry an edition identifier so a citation that says "PHAK Ch 12 §3" resolves to the edition the node was authored against, with a "newer edition available" surface when the FAA publishes a revision.

The shape of a reference, abstractly:

```text
Reference
  kind         CFR | AC | HANDBOOK | ACS | PTS | AIM | NTSB | OTHER
  document     PHAK | AFH | AvWX | IFH | IPH | 14 CFR Part 61 | AC 61-65 | ...
  edition      FAA-H-8083-25C | 2024 update | revision date
  locator      chapter / section / paragraph / page / task code / §
  url          official FAA link if public
  framing      survey | operational | procedural | regulatory | examiner
```

A node has many references. A syllabus leaf has many references (often the same ones). A card or scenario inherits its node's references and may add its own.

The learner sees handbook citations the way the FAA writes them ("PHAK Ch 12, p. 12-7"), with a click-through to the locator. The system tracks which references the learner has actually opened, which is a signal for the dashboard ("you've never read the PHAK weather chapter").

## On caching the relevance arrays

Today, knowledge nodes carry an authored relevance array: `[{cert: PPL, bloom: apply, priority: core}, {cert: CFI, bloom: evaluate, priority: core}, ...]`. This array currently does two jobs at once -- it asserts "this node is on the PPL ACS at the apply level" *and* it's the storage for that fact.

Once syllabi exist as first-class objects, the assertion lives in the syllabus (the PPL ACS leaf says "this element is taught by node X at apply level"). The node's relevance array becomes derived: an inverse index of "every syllabus leaf that points at me, with the depth they require." It's still on the node for fast reads (browse filters, dashboards), but it's a **cache**, not a source. Authoring moves to the syllabus. If the cache and the syllabi disagree, the syllabi win and the cache rebuilds.

This matters for two reasons:

1. **No drift.** Today, adding a cert to a node means editing the node's frontmatter. With many nodes and many certs, those edits drift. With syllabi as the source, you author the syllabus once and the node's relevance picture updates wherever it's referenced.
2. **Multiple syllabi can claim the same node at different depths.** The PPL ACS wants angle-of-attack at "apply." The CFI PTS wants it at "evaluate." The Aerobatic Course Syllabus (a third-party doc) wants it at "create." All three project onto the same node. The cache shows all three; the source for each lives in its own syllabus.

Until syllabi exist, the relevance array is the source. The migration is a cutover, not a redesign.

## Non-goals

- **A general-purpose LMS.** Airboss is not Canvas. We are not building "create a course, enroll students, grade quizzes." We are building a learner's instrument panel for becoming and staying a competent pilot.
- **A regulation interpreter.** We surface CFRs as references and explain them at the level a CFI would. We do not substitute for legal advice or aircraft-specific guidance from the POH.
- **A test bank.** Knowledge tests are a side effect of mastery, not the goal. Checkride prep is one surface among many.
- **Commercial handbook ingestion.** Only FAA-published works (public domain under 17 USC § 105). No Jeppesen, ASA, Sporty's, King, or Gleim content.

## Glossary

| Term | Meaning |
| ----------- | ------- |
| Node | One concept in the knowledge graph |
| Edge | Typed relationship between nodes (`requires`, `deepens`, `applies`, `teaches`, `related`) |
| Domain | High-level grouping for browse (Weather, Airspace, IFR Procedures, ...) |
| Syllabus | Authored projection (ACS, PTS, endorsement, custom) onto the graph |
| Area / Task / Element | The FAA's ACS structure; the shape of most syllabi |
| Cert | Pilot certificate (PPL, CPL, ATP, ...) |
| Rating | Add-on capability (Instrument, Multi-engine, type rating, ...) |
| Endorsement | 61.31 endorsement (complex, high-perf, tailwheel, ...) |
| Goal | Learner-owned object; what this learner is pursuing |
| Reference | Cited source (CFR, AC, handbook, AIM, ACS, NTSB, ...) versioned by edition |
| Lens | Named view over the graph (ACS, domain, phase-of-flight, handbook, weakness, custom) |
| Mastery | Per-node state; rolls up to every structure that projects onto the graph |
