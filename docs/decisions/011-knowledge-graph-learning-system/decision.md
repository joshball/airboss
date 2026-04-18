---
title: 'ADR 011: Knowledge Graph Learning System'
date: 2026-04-17
status: proposed
participants: Joshua Ball, Claude
context: ./context.md
supersedes: null
---

# ADR 011: Knowledge Graph Learning System

## Decision

The study app is built on a **knowledge graph** -- a directed graph of aviation knowledge units with rich metadata, typed edges, and a seven-phase content model. The graph is the curriculum. Tools (cards, reps, calibration) are delivery mechanisms. Courses are filtered views on the graph.

## Architecture

```text
┌──────────────────────────────────────────────────┐
│  Session Engine                                   │
│  "I want to study" -> picks items from graph      │
│  Weights: recent, weak, diverse, user preference  │
├──────────────────────────────────────────────────┤
│  Study Plan                                       │
│  User goals (PPL + IR + CPL + CFI)                │
│  Focus/skip preferences, depth per domain         │
├──────────────────────────────────────────────────┤
│  Knowledge Graph                                  │
│  ~500 nodes, typed edges, 7-phase content         │
│  Authored as markdown, built into DB              │
├──────────────────────────────────────────────────┤
│  Learning Tools                                   │
│  Cards (FSRS-5) | Reps (scenarios) | Calibration  │
│  The mechanisms that deliver content + track data  │
├──────────────────────────────────────────────────┤
│  Dashboards                                       │
│  Learning: bird's-eye mastery across the graph    │
│  Session: what to study today, where you left off │
└──────────────────────────────────────────────────┘
```

## The Knowledge Graph

### Nodes

A **knowledge unit** is the smallest coherent chunk of aviation knowledge. Not "Weather" (too big). Not "the definition of METAR" (too small). Right size: "Decoding METARs and TAFs", "Crosswind component calculation", "Holding pattern entries."

Target: ~500 nodes across all domains and cert levels. Start with 30 well-developed nodes to test the model.

### Typed edges

| Edge type | Meaning | Constraint |
| --- | --- | --- |
| `requires` | Must understand X before Y | Forms a DAG. No cycles. Specific, not broad. |
| `deepens` | More advanced treatment of same concept | Same domain, different depth |
| `applies` | Uses this knowledge in practice | Cross-domain practical connection |
| `teaches` | Pedagogical version of a technical topic | CFI nodes pointing to the topic they teach |
| `related` | Loosely connected, useful for cross-reference | Bidirectional, not load-bearing |

**Discipline rule:** `requires` edges must be specific. "Instrument approaches `requires` airspace classes" is good. "Instrument approaches `requires` VFR operations" is too broad. If an edge points to something larger than a single node, it's pointing to the wrong thing.

### Node metadata

```yaml
# === Identity ===
id: string                        # kebab-case, unique
title: string                     # human-readable name
domain: string                    # primary domain (from DOMAINS constant)
cross_domains: string[]           # also relevant in these domains

# === Knowledge character ===
knowledge_types: string[]         # factual, conceptual, procedural,
                                  # judgment, perceptual, pedagogical
technical_depth: string           # surface, working, deep
stability: string                 # stable, evolving, volatile

# === Cert relevance (multi-dimensional) ===
relevance:                        # array of:
  - cert: string                  #   PPL, IR, CPL, CFI
    bloom: string                 #   remember, understand, apply,
                                  #   analyze, evaluate, create
    priority: string              #   core, supporting, elective

# === Graph edges ===
requires: string[]                # node IDs
deepens: string[]                 # node IDs
applied_by: string[]              # node IDs
taught_by: string[]               # node IDs
related: string[]                 # node IDs

# === Content & delivery ===
modalities: string[]              # reading, cards, reps, drill,
                                  # visualization, audio, video,
                                  # calculation, teaching-exercise
estimated_time_minutes: number    # full learning experience
review_time_minutes: number       # refresher if previously mastered

# === References ===
references:                       # array of:
  - source: string                #   PHAK, AIM, 14 CFR, AC, etc.
    detail: string                #   chapter, section, pages
    note: string                  #   why this reference matters

# === Assessment ===
assessable: boolean
assessment_methods: string[]      # recall, calculation, scenario,
                                  # demonstration, teaching
mastery_criteria: string          # what "mastered" means for this node
```

**Principle:** Ask the questions on every node, even when you can't answer them yet. Empty fields are visible gaps. The template sets the standard.

### Seven-phase content model

Every node supports this learning sequence:

| Phase | Purpose | Content type |
| --- | --- | --- |
| **Context** | Why this matters, real-world framing | Scenario setup, narrative |
| **Problem** | Concrete situation requiring this knowledge | Question, thought experiment |
| **Discover** | Learner reasons toward the answer | Guided questions, exercises, "what would you design?" |
| **Reveal** | Authoritative answer with exact source | Regulation text, formula, reference location |
| **Practice** | Exercise the knowledge | Cards, drills, reps, back-of-envelope calculations |
| **Connect** | Relationships to other knowledge | Links to prerequisites/dependents, "what changes if..." |
| **Verify** | Apply in a novel situation | Assessment scenario, teaching exercise |

**Pedagogy rule:** Discovery first, regulation last. Lead with WHY. Let the learner derive the answer before revealing the authoritative source. The regulation confirms reasoning, not replaces it.

Not all phases required for a node to be useful. Minimum viable: title + metadata + at least one content phase. But the structure expects all seven. Empty phases are prompts for future work.

### Content phases in detail

```yaml
content:
  context: string                   # markdown -- why this matters
  problem: string                   # markdown -- the driving question
  discover:
    questions: string[]             # guided discovery questions
    activities: string[]            # activity IDs from libs/activities/
    exercises: string[]             # markdown exercises
  reveal:
    regulation: string              # exact reg citation if applicable
    summary: string                 # markdown -- the authoritative answer
    location_skill: string          # how to find this in references
  practice:
    cards: string[]                 # card IDs (populated as cards created)
    reps: string[]                  # scenario IDs
    drills: string[]                # drill IDs
    calculations: string[]         # markdown -- back-of-envelope problems
  connect:
    prompts: string[]               # "what changes if..." questions
    links: string[]                 # node IDs for related exploration
  verify:
    scenarios: string[]             # assessment scenario IDs
    teaching_exercises: string[]    # CFI-level exercises
```

## File Structure

### Knowledge graph (markdown-first)

```text
course/
  knowledge/
    domains.md                      # domain taxonomy + descriptions
    graph-index.md                  # all nodes listed, build status
    airspace/
      vfr-weather-minimums/
        node.md                     # YAML frontmatter + content phases
        assets/                     # images, diagrams for this node
          cloud-clearance.svg
          airspace-chart.png
      classes-and-dimensions/
        node.md
    weather/
      reading-metars-tafs/
        node.md
      thunderstorm-hazards/
        node.md
    navigation/
      vor-tracking/
        node.md
    ...
```

Each node is a directory. `node.md` has YAML frontmatter (metadata) + markdown body (content phases). Assets live alongside.

### Interactive content

```text
libs/
  activities/
    wind-triangle/
      WindTriangle.svelte           # the interactive component
      README.md                     # what it teaches, parameters, script
      preview.png                   # static preview
    vor-tracking/
      VorTracking.svelte
      README.md
      preview.png
    wb-calculator/
      WbCalculator.svelte
      README.md
      preview.png
```

Activities are Svelte components in `libs/activities/`, each self-contained with a README. Knowledge nodes reference them by ID. The study app renders them. Other surface apps can too.

### Build step

A `scripts/build-knowledge-index.ts` script:

1. Globs `course/knowledge/**/node.md`
2. Parses YAML frontmatter
3. Validates graph integrity (no broken edges, no cycles in `requires`)
4. Writes to DB tables (or a JSON index for dev)
5. Reports: node count, edge count, content coverage (% of phases filled), orphan nodes

Runs on demand (`bun run build-knowledge`) and as a pre-build step.

## Courses as Views

A "course" is a filtered view on the knowledge graph:

```yaml
# course/courses/ppl-ground.md
id: ppl-ground
title: Private Pilot Ground School
cert_filter: PPL
priority_filter: core
bloom_filter: [remember, understand, apply]
sequence: suggested             # suggested order, not enforced
coverage_requirement: 100%      # all matching nodes must be mastered
assessment_gates:
  - after: [airspace-*, wx-*]   # after these node groups
    type: quiz
    passing: 80%
time_requirement: null          # no FAA time requirement for ground
```

Joshua's "everything course" is the unfiltered graph -- all certs, all priorities, learner-directed sequence.

The FIRC content slots in as a course that filters to CFI-level nodes matching AC 61-83K's 13 topic areas, with FAA-mandated time and assessment requirements.

## Study Plan (Per-User)

Each user has a study plan that configures how the session engine picks items:

```yaml
goals: [PPL, IR, CPL, CFI]     # which cert levels to include
focus_domains: [weather]         # emphasis for current period
skip_domains: [flight-planning]  # come back later
depth_preference: working        # how deep to go by default
session_length: 10               # items per session
```

The study plan is stored in the DB, editable from the study app. The session engine respects it.

## Session Engine

When the user says "I want to study," the engine picks items:

1. **Continue** (30%) -- items from domains studied in the last 2 sessions
2. **Strengthen** (30%) -- items where mastery is dropping (SRS due, low accuracy)
3. **Expand** (20%) -- items in untouched areas, prioritized by prerequisites-met
4. **Diversify** (20%) -- items outside current focus, preventing tunnel vision

User can override: "just weather today" -> 100% from weather nodes. "Skip W&B" -> exclude those nodes. Weights are starting points, not sacred.

## The 30-Node Experiment

Start with 30 well-developed nodes to test the model before scaling to 500.

**Airspace & Weather (8):** `airspace-classes-and-dimensions`, `airspace-vfr-weather-minimums`, `wx-reading-metars-tafs`, `wx-thunderstorm-hazards`, `wx-icing-types-and-avoidance`, `wx-go-nogo-decision`, `airspace-special-use`, `wx-density-altitude`

**Navigation & Approaches (6):** `nav-vor-tracking`, `nav-holding-pattern-entries`, `nav-instrument-approach-structure`, `nav-gps-rnav-concepts`, `nav-missed-approach-procedure`, `nav-circling-approach`

**Aerodynamics & Performance (5):** `aero-four-forces`, `aero-angle-of-attack-and-stall`, `perf-crosswind-component`, `perf-weight-and-balance`, `perf-takeoff-landing-distance`

**Regulations & Procedures (5):** `reg-pilot-privileges-limitations`, `reg-currency-vs-proficiency`, `proc-engine-failure-after-takeoff`, `proc-emergency-authority`, `proc-adm-hazardous-attitudes`

**Teaching / CFI (4):** `teach-the-learning-process`, `teach-lesson-planning`, `teach-common-student-errors-stalls`, `teach-evaluating-student-judgment`

**Flight Planning (2):** `plan-vfr-cross-country`, `plan-ifr-cross-country`

### Build order for the 30

1. Build 3-5 nodes fully (all 7 phases, all metadata) across diverse types to validate the model.
2. Skeleton the remaining 25 (title, metadata, edges, references -- no content).
3. Build the graph index and validate integrity.
4. Fill in content on remaining nodes as Joshua studies.

### Candidate deep-dive nodes (fully built first)

- `airspace-vfr-weather-minimums` -- the discovery-first regulation example
- `perf-crosswind-component` -- interactive visualization candidate
- `nav-holding-pattern-entries` -- procedural + perceptual + visualization
- `proc-engine-failure-after-takeoff` -- judgment + scenario-rich
- `teach-common-student-errors-stalls` -- the pedagogical axis

## Dependencies on Existing Work Packages

The three tool-level work packages already written (`spaced-memory-items`, `decision-reps`, `calibration-tracker` in `airboss/docs/work-packages/`) remain valid as the mechanism layer. They need updates:

1. **Cards and scenarios reference knowledge nodes.** Add `node_id` field to `study.card` and `study.scenario` schemas -- links content to the graph.
2. **Domain values come from the graph.** The `DOMAINS` constant in the spec should align with the graph's domain taxonomy.
3. **Mastery data flows back to nodes.** The study BC's read interfaces (`getCardMastery`, `getRepAccuracy`, `getCalibration`) are already designed for this -- they aggregate by domain. Extend to aggregate by node_id.

## Open Questions

1. **Session engine weights.** The 30/30/20/20 split is a guess. Needs testing with real usage.
2. **Minimum viable node.** Title + metadata + one content phase? Or is metadata-only useful for the session engine to know "this territory exists but has no content yet"?
3. **Content authoring at scale.** Joshua is user zero. What about the other 470 nodes? Community contribution? AI-assisted generation with human review?
4. **Course requirements on top of the graph.** Coverage %, sequence, assessment gates -- how exactly are these specified and enforced?
5. **Graph evolution.** When a node splits, merges, or moves, what happens to attached content and user progress?
6. **Assessment/mastery model.** What combination of signals (card accuracy, rep accuracy, calibration score, completion of content phases) constitutes "mastery" of a node?
7. **Visualization/activity engineering.** Interactive components (wind triangle, VOR tracking, W&B calculator) are real engineering work. Priority? Build during the 30-node experiment or defer?

## Consequences

- The study app is more than three tools. It's a learning environment with a knowledge graph at its core.
- Content authoring is a continuous activity, not a one-time setup. Every study session potentially creates content.
- The markdown-first approach means the knowledge graph is version-controlled, grep-able, and authorable without a UI.
- The seven-phase content model sets a high bar for content quality. Most nodes will be partially complete. That's OK -- visible gaps drive improvement.
- Courses, dashboards, and recommendations all derive from the same graph. One source of truth for "what is there to learn."
