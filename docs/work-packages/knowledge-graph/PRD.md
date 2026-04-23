---
title: 'PRD: Knowledge Graph'
product: study
feature: knowledge-graph
type: prd
status: unread
---

# PRD: Knowledge Graph

> The territory, not just the tools. A curated graph of aviation knowledge units -- what there is to learn, what builds on what, at what cert level, at what depth. Courses are views on the graph. Tools deliver the content. The graph is the map.

## The Problem

The three learning tools (Memory Items, Decision Reps, Calibration) solve the mechanics of learning -- retention, judgment practice, self-awareness. They don't solve **what to learn**. Without structure:

- You create flashcards on whatever you happened to read today. Coverage is accidental.
- You can't see "what am I missing?" because there's no map of what exists.
- Mastery means "this specific card is due less often" -- not "I have working understanding of holding pattern entries."
- "I want to study" has no good answer. Review due cards? That's reactive. What about topics you haven't started?
- There's no way to say "I'm returning to instrument flying" and have the system know that you need VFR minimums as prerequisite knowledge before you dive into approach procedures.

Every existing aviation study tool either hands you someone else's rigid course (Sporty's, King) or gives you raw tools (Anki) without aviation structure. What's missing is a **third way**: a knowledge graph that knows aviation -- its domains, its prerequisites, its cert levels, its teaching models -- that you can navigate flexibly while still getting rigor.

## The Product

A directed graph of ~500 aviation knowledge units. Each unit ("node") is the smallest coherent chunk of aviation knowledge -- "Decoding METARs and TAFs" or "Crosswind component calculation" or "Holding pattern entries." Nodes have rich metadata. Typed edges connect them. Content is attached to them in seven learning phases.

The graph does four things:

1. **Maps the territory.** Answers "what is there to learn across all of aviation?" Groups knowledge by domain. Tags each node with cert relevance (PPL / IR / CPL / CFI) and Bloom level.

2. **Encodes dependencies.** `instrument approaches requires airspace classes` is a machine-readable prerequisite. The session engine uses this to ensure you don't dive into an approach procedure when your airspace knowledge is rusty.

3. **Hosts content.** Each node has seven content phases: Context, Problem, Discover, Reveal, Practice, Connect, Verify. Cards, reps, visualizations, reading assignments all attach to specific phases of specific nodes.

4. **Supports courses as views.** A "PPL ground course" is a filter on the graph: PPL-level nodes, core priority, suggested sequence, coverage requirement. The FIRC course (future) is a different filter. Joshua's "everything course" is the unfiltered graph.

## Who It's For

**Primary: Joshua (user zero).** Needs to see "where am I across PPL/IR/CPL/CFI?" Needs the system to know that `teach-common-student-errors-stalls` builds on `aero-angle-of-attack-and-stall`. Needs the map so his study isn't accidental.

**Secondary: content authors.** The ~500 nodes need metadata, prerequisites, and content. Every piece of FIRC course material migrating in needs to land on specific nodes. Authors need a clear template ("fill in these fields for every node") and visible gaps ("this node has no Discover phase yet").

**Secondary: course designers.** FIRC content lives in `apps/firc/`. BFR Sprint content lives in `apps/study/`. Both define their course as "this filter on the graph, these coverage requirements, these assessment gates." The graph is the shared source of content.

**Tertiary: other products.** Route Walkthrough needs to know that the Diversion Drill product exists and tags into the same nodes. The graph is the common vocabulary across the 53-product brainstorm.

## Core Experience

The knowledge graph is mostly **infrastructure** -- the user-visible surface is the Learning Dashboard (separate PRD), the Session Engine (separate PRD), and the Node Detail page (described here). This PRD focuses on the authoring/structural experience.

### What a node looks like (authored state)

```text
┌──────────────────────────────────────────────────────────────────┐
│  course/knowledge/airspace/vfr-weather-minimums/node.md           │
├──────────────────────────────────────────────────────────────────┤
│  ---                                                              │
│  id: airspace-vfr-weather-minimums                                │
│  title: VFR Weather Minimums by Airspace Class                    │
│  domain: airspace                                                 │
│  cross_domains: [regulations, weather]                            │
│                                                                   │
│  knowledge_types: [factual, conceptual, procedural, judgment]     │
│  technical_depth: working                                         │
│  stability: stable                                                │
│                                                                   │
│  relevance:                                                       │
│    - cert: PPL                                                    │
│      bloom: remember                                              │
│      priority: core                                               │
│    - cert: PPL                                                    │
│      bloom: apply                                                 │
│      priority: core                                               │
│    - cert: IR                                                     │
│      bloom: analyze                                               │
│      priority: supporting                                         │
│    - cert: CFI                                                    │
│      bloom: evaluate                                              │
│      priority: core                                               │
│                                                                   │
│  requires:                                                        │
│    - airspace-classes-and-dimensions                              │
│    - wx-visibility-and-ceiling-definitions                        │
│                                                                   │
│  applied_by:                                                      │
│    - plan-vfr-cross-country                                       │
│    - proc-scud-running-risks                                      │
│                                                                   │
│  taught_by:                                                       │
│    - teach-airspace-lesson-design                                 │
│                                                                   │
│  related:                                                         │
│    - wx-reading-metars                                            │
│    - safety-vfr-into-imc                                          │
│                                                                   │
│  modalities: [reading, cards, drill, visualization]               │
│  estimated_time_minutes: 60                                       │
│  review_time_minutes: 10                                          │
│                                                                   │
│  references:                                                      │
│    - source: PHAK                                                 │
│      edition: FAA-H-8083-25C                                      │
│      chapter: 15                                                  │
│      pages: "15-8 to 15-12"                                       │
│    - source: 14 CFR                                               │
│      section: "91.155"                                            │
│      title: "Basic VFR weather minimums"                          │
│                                                                   │
│  assessable: true                                                 │
│  assessment_methods: [recall, calculation, scenario]              │
│  ---                                                              │
│                                                                   │
│  # Content Phases                                                 │
│                                                                   │
│  ## Context                                                       │
│  You are an approach controller responsible for keeping aircraft  │
│  separated in Class C airspace around a busy regional airport...  │
│                                                                   │
│  ## Problem                                                       │
│  You can track IFR traffic perfectly. But VFR aircraft aren't     │
│  required to talk to you in all airspace. How do you keep them    │
│  safe?                                                            │
│                                                                   │
│  ## Discover                                                      │
│  ### Questions                                                    │
│  - If a VFR pilot is 500 feet below a cloud layer and an IFR      │
│    aircraft is descending through it, how much reaction time do   │
│    they have?                                                     │
│  - What rules would YOU write for VFR pilots to ensure adequate   │
│    see-and-avoid time?                                            │
│  ### Activities                                                   │
│  - activity: closure-rate-calculator                              │
│                                                                   │
│  ## Reveal                                                        │
│  14 CFR 91.155 -- Class C/D/E below 10,000: 3sm visibility,       │
│  500 below / 1,000 above / 2,000 horizontal from clouds.          │
│                                                                   │
│  ## Practice                                                      │
│  cards: [crd_01J5KQY...]                                          │
│  reps: [rep_01J5KR3...]                                           │
│  ### Back-of-envelope                                             │
│  - 500fpm descent, cloud base at 4,500 MSL, you're at 5,500.      │
│    How long until you're in the cloud? Now add a VFR aircraft     │
│    500 below that cloud...                                        │
│                                                                   │
│  ## Connect                                                       │
│  - How do these minimums change in Class A? Why?                  │
│  - How do these minimums change above 10,000? What's different?   │
│  - What's the difference between legal and safe here?             │
│                                                                   │
│  ## Verify                                                        │
│  scenarios: [rep_01J5KR7...]                                      │
└──────────────────────────────────────────────────────────────────┘
```

### Node detail page (learner view)

```text
┌───────────────────────────────────────────────────────────────────┐
│  VFR Weather Minimums by Airspace Class                           │
│  Domain: Airspace  •  Cross: Regulations, Weather                  │
│                                                                   │
│  Your progress on this node:  ▓▓▓▓▓▓░░░░  62% mastered             │
│                                                                   │
│  Cert relevance:                                                  │
│    PPL  core     (Remember, Apply)     ✓ appropriate depth        │
│    IR   support  (Analyze)              ○ 40% toward mastery       │
│    CFI  core     (Evaluate)             ○ not started              │
│                                                                   │
│  ─────────────────────────────────────────────────────────────    │
│                                                                   │
│  Prerequisites:                                                   │
│    ✓ Airspace Classes and Dimensions (mastered)                   │
│    ✓ Visibility and Ceiling Definitions (mastered)                │
│                                                                   │
│  Applies in:                                                      │
│    → VFR Cross-Country Planning                                    │
│    → Scud-Running Risks                                            │
│                                                                   │
│  Taught by (CFI-level):                                           │
│    → Teaching Airspace Lesson Design                               │
│                                                                   │
│  ─────────────────────────────────────────────────────────────    │
│                                                                   │
│  Content:                                                         │
│   ● Context      ✓ available                                      │
│   ● Problem      ✓ available                                      │
│   ● Discover     ✓ available  (2 questions, 1 activity)            │
│   ● Reveal       ✓ available                                      │
│   ● Practice     ✓ 8 cards, 3 reps, 2 calculations                 │
│   ● Connect      ✓ available                                      │
│   ○ Verify       gap -- no assessment scenarios yet                │
│                                                                   │
│  References:                                                      │
│    • PHAK Ch. 15, pp 15-8 to 15-12                                 │
│    • 14 CFR 91.155                                                 │
│    • AIM 3-1-4                                                     │
│                                                                   │
│  [ Start learning this node ]    [ Just review cards ]             │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### The learning experience (when you click "Start learning this node")

The seven-phase content model plays out as a guided lesson:

```text
┌───────────────────────────────────────────────────────────────────┐
│  VFR Weather Minimums                    Phase 1 of 7: Context    │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  You are an approach controller responsible for keeping aircraft  │
│  separated in Class C airspace around a busy regional airport...  │
│                                                                   │
│  [ Continue -> Problem ]                                          │
└───────────────────────────────────────────────────────────────────┘

                            ↓

┌───────────────────────────────────────────────────────────────────┐
│  VFR Weather Minimums                    Phase 2 of 7: Problem    │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  You can track IFR traffic perfectly. But VFR aircraft aren't     │
│  required to talk to you in all airspace. How do you keep them    │
│  safe?                                                            │
│                                                                   │
│  [ Continue -> Discover ]                                         │
└───────────────────────────────────────────────────────────────────┘

                            ↓

┌───────────────────────────────────────────────────────────────────┐
│  VFR Weather Minimums                   Phase 3 of 7: Discover    │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  If a VFR pilot is 500 feet below a cloud layer and an IFR        │
│  aircraft is descending through it at 500 fpm, how much reaction  │
│  time do they have?                                               │
│                                                                   │
│  [interactive closure-rate-calculator widget]                     │
│                                                                   │
│  What rules would YOU write for VFR pilots to ensure adequate     │
│  see-and-avoid time?                                              │
│                                                                   │
│  [ Your answer: ________________________________ ]                │
│                                                                   │
│  [ Continue -> Reveal ]                                           │
└───────────────────────────────────────────────────────────────────┘

                            ↓

┌───────────────────────────────────────────────────────────────────┐
│  VFR Weather Minimums                      Phase 4 of 7: Reveal   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Here's what the FAA wrote: 14 CFR 91.155 --                      │
│  Class C/D/E below 10,000:                                        │
│    3 statute miles visibility                                     │
│    500 feet below clouds                                          │
│    1,000 feet above clouds                                        │
│    2,000 feet horizontal from clouds                              │
│                                                                   │
│  Notice the numbers map to the reasoning you did in Discover --   │
│  the 500 ft buffer below clouds gives a VFR pilot reaction time   │
│  against an IFR aircraft descending through.                      │
│                                                                   │
│  Location skill: 14 CFR Part 91, Subpart B. Bookmark it.          │
│                                                                   │
│  [ Continue -> Practice ]                                         │
└───────────────────────────────────────────────────────────────────┘

              [Practice -> Connect -> Verify follow similarly]
```

The phases can be skipped (experienced pilot who just wants to review the reg jumps to Reveal) or reordered on repeat visits. On first encounter, the guided flow is the default.

## Design Principles

### The smallest coherent chunk

A node is a knowledge unit, not a chapter. "Weather" is too big (weeks of material). "The definition of METAR" is too small (no meaningful learning arc). "Decoding METARs and TAFs" is right -- one coherent concept, learnable in ~45 minutes, assessable independently.

Rule of thumb: if you can't write seven distinct content phases for a node, it's probably too small. If the phases would each be book chapters, it's too big. Split or merge.

### Typed edges, not generic links

"Related" is the weakest edge and should be used sparingly. `requires` (hard prerequisite), `deepens` (same concept, more detail), `applies` (cross-domain practical use), `teaches` (pedagogical version) -- these are semantically meaningful and load-bearing. The session engine and dashboards use them differently.

### Specific prerequisites

`requires` must point to a specific node, not a broad area. "Instrument approaches requires airspace classes" -- correct, actionable. "Instrument approaches requires VFR operations" -- too broad, not useful. If the prerequisite is more than one node, list multiple specific edges.

### Discovery-first pedagogy

Covered extensively in [ADR 011](../../decisions/011-knowledge-graph-learning-system/decision.md). Every node supports Context -> Problem -> Discover -> Reveal as a default sequence. The regulation is the confirmation, not the starting point. This is a content authoring rule, not just a UI suggestion.

### Ask the questions even when you can't answer

Every node's metadata template includes ALL fields: cert relevance, prerequisites, references, assessment methods. Empty fields are visible gaps, not absent data. Gaps drive future work. A node with five filled fields and ten empty ones is more useful than a node with five filled fields and the rest hidden.

### Markdown-first, DB-built

Authoring happens in markdown + YAML. No authoring UI initially -- the editor is VS Code. A build script (`bun run db build`) parses `course/knowledge/**/node.md`, validates graph integrity, and writes to the DB. Runtime queries hit the DB. This keeps authoring in version control and makes the graph grep-able.

### Separation of content and activities

Markdown content is one thing. Interactive components (wind triangles, VOR tracking, W&B arms) are another -- they're Svelte components in `libs/activities/`. Nodes reference them by ID. This keeps content authoring accessible (anyone who can write markdown can author nodes) and engineering-heavy components separate (built once, used across nodes and surface apps).

## Core Structures

### Node taxonomy (initial 30)

The MVP is 30 nodes chosen to stress-test the model across domains, knowledge types, and cert levels:

**Airspace & Weather (8):** Domain cluster for regulation-heavy knowledge, discovery-first content.

**Navigation & Approaches (6):** Visualization-heavy (VOR tracking, holding patterns, approach geometry), procedural knowledge.

**Aerodynamics & Performance (5):** Physics/math heavy, interactive widget candidates (wind triangle, W&B arms), multi-depth.

**Regulations & Procedures (5):** Pure factual + judgment, teaches the "where do I find this in the FARs?" skill.

**Teaching / CFI (4):** Tests the pedagogical axis. How does "teaching aerodynamics" relate to "aerodynamics"?

**Flight Planning (2):** Synthesis nodes that tie many other nodes together via `applies` edges.

Full list in [ADR 011 decision.md](../../decisions/011-knowledge-graph-learning-system/decision.md).

### Node lifecycle

```text
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Skeleton   │ ->  │   Started    │ ->  │   Complete   │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ • Title       │     │ • Skeleton + │     │ • All 7      │
│ • Domain      │     │   1+ content │     │   phases     │
│ • Relevance   │     │   phase      │     │ • Content    │
│ • Edges       │     │ • Cards/reps │     │   populated  │
│ • References  │     │   attached   │     │ • Asset      │
│               │     │              │     │   complete   │
└──────────────┘     └──────────────┘     └──────────────┘
      ↑                                                │
      │                                                │
      │    Skeleton only is fine for session engine    │
      │    to know "this territory exists" even        │
      │    before content is written                   │
```

A skeleton is useful. The session engine can see "you haven't started Weather yet" from metadata alone. Content is filled in as Joshua (and other authors) study.

### Build validation

The `bun run db build` script enforces:

- Every node has a valid `id`, `title`, `domain`
- All `requires` edges point to existing nodes
- No cycles in the `requires` DAG
- Every `cert` value in relevance is in {PPL, IR, CPL, CFI}
- Every `bloom` value is in {remember, understand, apply, analyze, evaluate, create}
- Every `priority` is in {core, supporting, elective}
- Referenced activities exist in `libs/activities/`
- Referenced cards/reps exist in the DB (once the graph is linked to the study data)

Invalid graphs fail the build. Validation is the cheapest way to keep the graph healthy at scale.

## Integration With Other Products

### Memory Items + Decision Reps (content attachment)

Cards and scenarios gain a `node_id` field. The seven-phase content model's Practice phase lists the card and rep IDs attached to the node. Mastery of a node is computed from card + rep performance on its attached content.

### Learning Dashboard (primary UI consumer)

The Learning Dashboard reads the graph to render the map view, domain breakdowns, weak areas, and "what to study today" recommendations. See [Learning Dashboard PRD](../learning-dashboard/PRD.md).

### Study Plan + Session Engine (primary UI consumer)

The Session Engine uses the graph to pick items. "Continue" uses recent node activity. "Strengthen" uses mastery dropoff. "Expand" uses prerequisites-met nodes. "Diversify" uses domain coverage. See [Study Plan + Session Engine PRD](../study-plan-and-session-engine/PRD.md).

### Courses (FIRC, BFR Sprint)

Courses define filters on the graph with coverage/sequence/assessment requirements. A course spec references node IDs; the course app renders the structured experience. Same nodes, different presentation.

### Future products

Route Walkthrough, Plate Drills, NTSB Story, Avionics Trainer -- any of these can generate content attached to graph nodes. The graph is the common vocabulary. A route walkthrough that teaches about KBJC Class D operations attaches to the `airspace-classes-and-dimensions` node.

## Success Criteria

### MVP (first ship: 30 nodes, skeleton + 3-5 deep)

- [ ] 30 node skeletons created with complete metadata (all fields populated)
- [ ] 3-5 nodes fully built: all seven content phases, attached cards/reps, references
- [ ] At least one node demonstrates interactive activity integration (e.g., `perf-crosswind-component` with wind triangle widget)
- [ ] Build script validates graph integrity (no broken edges, no cycles)
- [ ] Node detail page renders correctly with mastery state
- [ ] Graph can be queried by cert, domain, priority, completion state
- [ ] Cards and reps can be attached to nodes; mastery aggregates per node
- [ ] The 30-node experiment surfaces at least 3 model refinements (what to keep, what to change)

### Beyond MVP

- [ ] Scale to 100 nodes (full PPL + IR territory)
- [ ] Scale to 300 nodes (through CPL)
- [ ] Scale to 500 nodes (full through CFI + specialty)
- [ ] Authoring UI in hangar (when it exists)
- [ ] AI-assisted node drafting (skeleton generation from a topic prompt)
- [ ] Cross-edition PHAK/AIM reference tracking (when docs update, flag affected nodes)
- [ ] Node version history and deprecation

## What This Is NOT

- **Not a course.** Courses are views on the graph. The graph itself is neutral.
- **Not a wiki.** Every node has strict metadata and seven-phase structure. Free-form articles don't fit.
- **Not a replacement for textbooks.** The graph REFERENCES PHAK, AIM, FAR/AIM, etc. with exact page numbers. The authoritative sources remain authoritative.
- **Not a question bank.** The graph hosts cards and reps, but it's about structure and coverage, not assessment volume.
- **Not a syllabus.** Syllabi are time-bound and mandatory. The graph is content-bound and flexible.

## Open Questions

1. **Node count granularity at scale.** 500 is the target for "full aviation territory." Is that right? Too few nodes = each one is too big and coverage gaps are invisible. Too many = unmanageable graph with prerequisite noise. 30 nodes will tell us a lot.
2. **Authoring velocity.** Full node (all 7 phases, metadata, references, cards, reps, activity integration) is real work. Maybe 3-8 hours per node. 500 nodes is 1,500-4,000 hours of content work. Realistic timeline? Probably years, with partial nodes useful immediately.
3. **Node versioning.** When a regulation changes, node content goes stale. Do we version nodes (v1, v2) like software? Timestamp-only? Let the graph drift and fix on demand?
4. **Content contribution.** For Joshua's personal use, he authors everything. For a broader platform, who authors? Community contribution? AI-assisted drafting with human review? A "node draft" state distinct from "node published"?
5. **Cross-product content attribution.** If Route Walkthrough generates cards attached to a node, and then those cards prove valuable in general study, who "owns" them? Attribution chain.
6. **Graph visualization.** Is there a useful graph-as-graph UI (nodes + edges visualized)? Or is the map always domain-grouped tables? Graph visualization is hard to do well and easy to do poorly.
7. **Assessment/mastery model.** What combination of card accuracy, rep accuracy, calibration score, content phase completion constitutes "mastered" for a node? Per-node mastery criteria authored in the node YAML, or a platform default? See `mastery_criteria` field.

## References

- [ADR 011](../../decisions/011-knowledge-graph-learning-system/decision.md) -- the architectural decision this PRD implements
- [ADR 011 context.md](../../decisions/011-knowledge-graph-learning-system/context.md) -- conversation history behind the decision
- [Spaced Memory Items PRD](../spaced-memory-items/PRD.md) -- content consumer
- [Decision Reps PRD](../decision-reps/PRD.md) -- content consumer
- [Learning Dashboard PRD](../learning-dashboard/PRD.md) -- primary UI consumer
- [Study Plan + Session Engine PRD](../study-plan-and-session-engine/PRD.md) -- primary UI consumer
- [MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md) -- how the graph relates to other surface apps
- [Learning INDEX](../../vision/learning/INDEX.md) -- the 14-domain taxonomy the graph uses
- [PRODUCT_BRAINSTORM.md](../../platform/PRODUCT_BRAINSTORM.md) -- 53 products that will consume the graph
