---
title: 'Decision Context: Knowledge Graph Learning System'
date: 2026-04-17
status: in-progress
participants: Joshua Ball, Claude
triggered_by: "Can you create work packages for the study app plan?"
session_context: Post-pivot. Building first app in airboss repo. Joshua is user zero -- returning CFI who needs to rebuild knowledge and judgment across PPL/IR/CPL/CFI.
---

# Context: Knowledge Graph Learning System

How the study app design evolved from "three tools with schemas" to a knowledge-graph-based learning system with discovery-first pedagogy.

## R1: Tool-Level Specs

**Input:** Joshua asked for work packages based on [20260415-study-app-plan.md](../../work/plans/20260415-study-app-plan.md). The plan described three products: Spaced Memory Items (FSRS-5 flashcards), Decision Reps (micro-scenarios), and Calibration Tracker (confidence vs. accuracy). An agent was simultaneously scaffolding the airboss repo with the study app shell.

**What we produced:** Three work packages in `airboss/docs/work-packages/` with specs, tasks, test plans, design docs. Heavy on schema columns, FSRS parameters, Drizzle ORM code, route tables, and form actions.

**Course integration consideration:** Before writing specs, we analyzed how the study app should relate to future courses. Key addition: `source_type` (personal/course/product/imported) + `source_ref` + `is_editable` on cards and scenarios, so courses and other products can publish content into the study system without schema changes. Domain taxonomy defined in constants, not DB enums. Read interfaces exported from the study BC for cross-product consumption.

**What was missing:** The specs described plumbing (how to store and retrieve cards) without explaining what the system IS, why a pilot would use it, or how it connects to actual learning goals. You could build exactly what the spec says and still not know what to study.

## R1 Feedback

> "I don't understand any of these apps. Please build out a proper PRD for each and include diagrams and mockups. I don't even know why we are building them from reading the spec."

The specs answered "how does the database work?" but not "what problem does this solve for me?" The tools were described in isolation with no connection to the learning journey.

---

## R2: Product Framing

**What changed:** Added a framing layer explaining WHY these three tools and how they connect:

| Tool | What it does | The question it answers |
| --- | --- | --- |
| Spaced Memory Items | Smart flashcard scheduling | "Do I actually remember this?" |
| Decision Reps | Quick scenario judgment practice | "Can I make the right call under pressure?" |
| Calibration Tracker | Confidence vs. accuracy tracking | "Do I know what I don't know?" |

Described the learning cycle: study (cards) -> practice (reps) -> self-awareness (calibration) -> study smarter. Explained how the personal learning dashboard and product progress dashboard fit in.

## R2 Feedback

> "It doesn't address what I need to study. The 'course' as it were. Which in my case is everything for a private, commercial, instrument, and instructor: regs, wx, approaches, teaching, etc... In the right groupings and order. Especially being able to bounce around."

The framing explained the tools but not the curriculum. Three tools without a map of "what to learn" is like having a hammer, saw, and level but no blueprints. Joshua needs:

- A map of all aviation knowledge organized by domain and level
- The ability to say "I want to study" and get 10 things (recent, weak, diverse)
- The ability to focus ("weather this morning") or skip ("come back to W&B later")
- Tracking across the whole territory, not just individual cards
- Understanding of depth by cert level (PPL basic, IR intermediate, CFI teaching level)

---

## R3: Knowledge Map Architecture

**What changed:** Introduced a four-layer architecture:

```text
Session Engine    -- "I want to study" -> picks 10 items
Study Plan        -- your goals, preferences, skip/focus choices
Knowledge Map     -- the full territory of aviation knowledge
Learning Tools    -- cards, reps, calibration (the mechanisms)
```

The Knowledge Map is the missing layer. Not a rigid course but a graph of aviation knowledge organized by domain > topic > subtopic, each node tagged with cert level and depth. Proposed a tree structure with 14 domains and example topics.

**Courses as views:** A PPL course is a filter on the map (PPL-level nodes, recommended sequence, coverage requirements). An IR course is a different filter. Joshua's "everything course" is the unfiltered map. The FIRC content slots in as content attached to specific nodes.

Proposed ~200-500 nodes as the right granularity, with dashboards showing progress across the map.

## R3 Feedback

> "The map is great. But there may be 1000 of these maps with different organization."

Several critical pushbacks:

**1. Graph, not tree.** Airspace isn't "under" navigation or regs or weather. It's its own concept used by all of them differently. The map must be a directed graph with typed edges, not a hierarchy.

**2. Metadata is too thin.** "Cert level + depth" isn't enough. What does "depth" mean? Is it a scalar? An enum? "Teaching aerodynamics" isn't "deeper aerodynamics" -- it's a different KIND of knowledge. The metadata needs to be rich enough that a course engine can make smart decisions.

**3. Depth is multidimensional.** At minimum: technical depth (how much detail about the thing) and cognitive depth (Bloom's taxonomy -- remember through create). A CFI teaching basic aerodynamics needs LOW technical depth but HIGH cognitive depth.

**4. Dependencies must be specific.** "Instrument approaches require VFR minimums and airspace classes" is useful. "Instrument approaches require VFR Operations" is too broad and not actionable.

**5. Content and containers must be tagged fully.** Everything referenceable, everything discoverable. The graph metadata should be the standard we ask on every node and edge, even if we don't fill it all in immediately.

---

## R4: Discovery-First Pedagogy + Rich Node Model

**What changed:** Fundamental rethinking of what a knowledge node IS.

### The airspace example (Joshua's)

Joshua described a teaching sequence for VFR weather minimums that starts with WHY, not WHAT:

> "You are in charge of keeping this airspace safe. You can track all the IFR people well, but what about these VFR people? Do they even know the regs? Are they talking to us? Do they have to? Why? Why is it optional? Now knowing this, let's assume they are great pilots and it is a clear day. Great! But what if there are clouds around? What could happen? What should we require of them to stay safe? Put it to them to figure it out!"

The student derives the regulation themselves before seeing it. The regulation becomes a confirmation of their reasoning, not an arbitrary rule to memorize.

### Seven-phase content model

Every knowledge node supports this learning sequence:

| Phase | What the learner does | Content type |
| --- | --- | --- |
| **Context** | Understands why this matters | Scenario setup, real-world framing |
| **Problem** | Faces a concrete situation | Question, thought experiment |
| **Discover** | Reasons toward the answer | Guided questions, exercises, "what would you design?" |
| **Reveal** | Sees the authoritative answer | Regulation text, formula, exact reference location |
| **Practice** | Exercises the knowledge | Cards, drills, reps, calculations |
| **Connect** | Sees relationships to other knowledge | Prerequisite/dependent links, "now what changes if..." |
| **Verify** | Applies in a novel situation | Assessment scenario, teaching exercise |

Not every node needs all seven phases on day one. But the structure expects them. Empty phases are visible gaps, not failures.

### Rich node metadata

Metadata must be comprehensive enough that a course engine can decide what to teach, when, at what depth, using which tools:

**Knowledge types** (what kind of knowing):

- Factual (discrete facts, numbers, definitions)
- Conceptual (understanding how/why)
- Procedural (step-by-step processes)
- Judgment (decisions with incomplete info)
- Perceptual (pattern recognition, reading instruments)
- Pedagogical (how to teach something)

A single topic spans multiple types. "Crosswind landings" is factual (max demonstrated), conceptual (how crosswind affects the aircraft), procedural (crab-to-slip), judgment (when to divert), and pedagogical (how to teach a scared student).

**Cert relevance is multi-dimensional.** Not `cert_level: PPL` but an array of `{ cert, bloom_level, priority }`. Airspace classes: PPL/remember/core + IR/apply/core + CFI/evaluate/core. The same topic at different Bloom levels for different certs.

**Technical depth** (surface / working / deep) is separate from **cognitive depth** (Bloom's remember through create). A CFI teaching basic aerodynamics needs low technical + high cognitive.

**Typed graph edges:**

- `requires` -- must understand X before Y (the prerequisite DAG)
- `deepens` -- more advanced treatment of same concept
- `applies` -- uses this knowledge in practice
- `teaches` -- the pedagogical version of a technical topic
- `related` -- loosely connected, good for cross-reference

**Other metadata:** stability (how often knowledge changes), modalities (what content delivery works well), references (exact authoritative sources with page numbers), estimated time, assessability.

### The 30-node experiment

Agreement to start with ~30 well-developed nodes (30/500ths of full scope) across diverse areas to test the model, not 30 thin nodes covering everything:

- 8 Airspace & Weather nodes
- 6 Navigation & Approaches nodes (visualization candidates)
- 5 Aerodynamics & Performance nodes (physics/calculation candidates)
- 5 Regulations & Procedures nodes (discovery-rich)
- 4 Teaching/CFI nodes (the pedagogical axis)
- 2 Flight Planning nodes (tie many others together)

## R4 Feedback -- Content Curation and Presentation

> "How do we curate these courses and lessons? How do I put all this together?"

Several additional dimensions surfaced:

**1. Content isn't just flashcards.** A lesson might include: reading assignments (specific PHAK pages with guided questions), flashcards (retention), decision reps (judgment), interactive visualizations (wind triangles, VOR tracking, W&B arms -- maybe with physics libs), calculations (back-of-envelope), and teaching exercises.

**2. Discovery pedagogy applied to regulations.** Regulations shouldn't be presented as "memorize 14 CFR 91.155." They should be presented as problems: "You're keeping this airspace safe. What rules would YOU write?" The regulation becomes the reveal, not the starting point. Back-of-envelope calculations reinforce understanding: "If you are descending at 500fpm and are asked to change, how will this impact your approach?"

**3. Interactive content needs a home.** Wind triangle visualizations, VOR tracking drills, W&B arm calculators -- these are real engineering (Svelte components, possibly physics libs, canvas/SVG). They need to live in `libs/activities/` as self-contained components with READMEs, referenceable from knowledge nodes.

**4. Everything referenceable.** Images, activities, scripts, calculations -- all need precise location and description. If we deep-dive and create a JS rendering of aircraft tracking in wind, we need a script/explanation for that asset, and the knowledge node references it by ID.

**5. Begin by asking the questions.** Although the full metadata set seems overwhelming, we should set the standard and ask the questions on every node/edge from the start. We'll find some that make sense, others that don't, and discover new ones. But we have to begin by expecting rigor.

**Decision to capture this conversation** before proceeding to PRDs. The evolution of thinking IS the decision context.

---

## Key Agreements So Far

1. **Knowledge graph, not knowledge tree.** Directed graph with typed edges. Topics relate to many other topics across domains.
2. **Rich metadata on every node.** Knowledge types, multi-dimensional cert relevance (cert + Bloom + priority), technical depth, graph edges, content phases, references. Ask the questions even when you can't answer them yet.
3. **Seven-phase content model.** Context -> Problem -> Discover -> Reveal -> Practice -> Connect -> Verify. Not all phases required, but the structure expects them.
4. **Discovery-first pedagogy.** Lead with WHY, let the learner derive the rule, THEN reveal the authoritative answer.
5. **Start with 30 nodes, not 500.** Diverse sample across domains. Build deep, test the model, iterate.
6. **Markdown-first with DB build step.** Knowledge graph authored as markdown + YAML in `course/knowledge/`. Build script loads into DB for session engine queries.
7. **Interactive content in `libs/activities/`.** Svelte components, each self-contained with README. Referenced from knowledge nodes by ID.
8. **Courses are views on the graph.** PPL course = filter to PPL nodes. Joshua's "everything course" = unfiltered map. FIRC = filter to CFI nodes matching AC 61-83K topics.
9. **The three tools (cards, reps, calibration) are mechanisms.** The knowledge graph is the product. Tools deliver content and track mastery. The graph decides what to deliver.

## Open Questions

1. **Session engine priority algorithm.** How exactly does "I want to study" pick 10 items? What weights for recent, weak, diverse, user preference? This needs design.
2. **How does a node "graduate" from skeleton to fully built?** What's the minimum viable node? Just title + prerequisites + cert relevance? Or does it need at least one content phase to be useful?
3. **Who builds lessons for nodes Joshua doesn't personally study?** For now, he's user zero -- every node he touches gets content. But what about the 470 nodes he doesn't get to?
4. **How do formal courses (FIRC, BFR Sprint) define their requirements on top of the graph?** Coverage requirements, sequence mandates, assessment gates.
5. **How does the graph evolve?** When a node gets split, merged, or reclassified, what happens to content and progress attached to it?
6. **Assessment model.** How do we determine "mastery" of a node? Card accuracy? Rep accuracy? Calibration score? Teaching exercise completion? Some combination?
