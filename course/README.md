# course/

Aviation course content. Surface-agnostic -- a knowledge node here may render as a study card, a reflection prompt, or a regulation lookup depending on the surface that consumes it.

## Layout

```text
course/
  knowledge/    Post-pivot knowledge graph -- atomic ADR-011 nodes, live in apps/study/
  regulations/  FAR navigation course -- structured walk through 14 CFR Parts 1, 61, 91, 141, 135
  firc/         Dormant FIRC-era 5-layer corpus (see firc/README.md)
```

## What goes where

- **A new aviation concept** that's specific and atomic (one POH limitation, one regulation interpretation, one airspace rule, one weather phenomenon) -> `course/knowledge/<domain>/<slug>/node.md`. See [knowledge/graph-index.md](knowledge/graph-index.md) for the existing graph and [ADR 011](../docs/decisions/011-knowledge-graph-learning-system/) for the model.
- **Regulatory navigation content** (subparts, oral exam scenarios, "find the rule in 60 seconds" drills, citation drills) -> `course/regulations/`. See [regulations/README.md](regulations/README.md).
- **FIRC-specific content** (AC 61-83K topic dossiers, FIRC scenarios, the 503-question bank) -> dormant. See [firc/README.md](firc/README.md). Do not author new FIRC content without a reawakening ADR.

## What does NOT go here

- Product PRDs -> `docs/vision/products/`
- Implementation specs -> `docs/work-packages/`
- Architecture / ADRs / agent guides -> `docs/`
- Code -> `apps/`, `libs/`

## Why this split exists

`course/knowledge/` is the live post-pivot graph that `apps/study/` consumes today (sim-card mappings, spaced rep, calibration). `course/firc/` was the entire pre-pivot course but is now paused. `course/regulations/` is the first piece of post-pivot course-level material with structure (lessons, orals, capstone), as opposed to atomic graph nodes.

Future post-pivot courses (e.g., `course/weather/`, `course/airspace/`) would slot in as peers of `regulations/`. Atomic facts inside any of them still belong in `course/knowledge/` -- the topical course dirs are for the lesson scaffolding, the structural walk, and the multi-node integrative material.
