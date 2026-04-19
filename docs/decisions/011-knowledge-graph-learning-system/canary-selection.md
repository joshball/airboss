---
title: 'Canary Selection for the 30-Node Experiment'
date: 2026-04-19
status: accepted
participants: Joshua Ball, Claude
parent: ./decision.md
---

# Canary Selection for the 30-Node Experiment

This doc refines the "Build order for the 30" section of [ADR 011](./decision.md). The ADR said "build 3-5 nodes fully, skeleton 25." This doc picks the specific canaries, reframes "how many" as an axis-coverage question instead of a node-count question, and records what we are explicitly deferring.

## Decision

Build **3 nodes** fully before skeletoning the remaining 27:

1. `airspace-vfr-weather-minimums`
2. `proc-engine-failure-after-takeoff`
3. `perf-crosswind-component`

These three cover the loudest axes that could break the seven-phase + metadata template. The other seven axes are deferred and will get tested lazily as Joshua hits them during real study.

## Reframing: Axes, Not Node Count

The starting question was "why 5? why not 7 or 10?" The answer: "5" was anchoring on the ADR's suggestion. The right framing is not a node count at all. It is **axis coverage** -- how many independent dimensions does the seven-phase + metadata template need to survive before we trust it?

Each axis is a way the template could fail. A canary set needs to exercise the axes we care most about catching early.

## The 10 Axes That Could Break the Template

| #   | Axis                               | Where it stresses the template                           | Example contrast                                                   |
| --- | ---------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | Reg-heavy vs. reg-absent           | Reveal phase -- does it gracefully have no regulation?   | 91.155 citation vs. pure judgment call                             |
| 2   | Calculation vs. narrative          | Practice phase -- formula vs. decision tree              | Crosswind component vs. go/no-go reasoning                         |
| 3   | Perceptual vs. symbolic            | Discover + Verify -- "look at this" vs. "state the def"  | Sight picture reading vs. definition recall                        |
| 4   | Procedural vs. conceptual          | Verify -- demonstrate steps vs. explain mechanism        | Holding entry vs. why lift decreases at high AoA                   |
| 5   | Technical vs. pedagogical          | The `teaches` edge -- is the CFI node load-bearing?      | Stall aerodynamics vs. common student errors teaching stalls       |
| 6   | Time-pressured vs. analytic        | Drill infrastructure -- 3-sec EFATO vs. 20-min wx review | EFATO muscle memory vs. weather go/no-go                           |
| 7   | Atomic vs. compound                | Node boundary -- does "plan an IFR XC" even fit as one?  | "What is Class B?" vs. "Plan an IFR XC"                            |
| 8   | Single-cert vs. multi-cert         | `relevance[]` array -- one node across PPL and CFI       | PPL-only reg vs. airspace at PPL-remember AND CFI-evaluate         |
| 9   | Stable vs. volatile                | Versioning -- fixed reg vs. "current ADs" moving source  | 14 CFR Part 91 vs. active NOTAMs/ADs                               |
| 10  | Interactive vs. textual            | `libs/activities/` contract -- Svelte slot-in modality   | Reading a chart vs. interactive wind triangle component            |

## Options Considered

| Option | Nodes                                                                                                                              | Axes covered | Content cost  | Risk                                                                      |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------- | ------------------------------------------------------------------------- |
| A      | 5 (ADR original): vfr-wx-mins, crosswind-component, holding-entries, efato, cfi-student-errors-stalls                              | ~6 of 10     | ~20-40 hours  | Mid -- misses volatile, compound, multi-cert                              |
| B      | 9 for full coverage: option A plus wx-go-nogo-decision, plan-ifr-cross-country, reg-currency-vs-proficiency, nav-gps-rnav-concepts | 10 of 10     | ~40-70 hours  | Low on template coverage; high on upfront cost before a single card ships |
| **C**  | **3 canaries: vfr-weather-minimums, engine-failure-after-takeoff, crosswind-component**                                            | ~5 of 10     | ~12-24 hours  | Accepted -- may discover node-boundary issues at node 200, not node 7     |

## Why 3 Won

- Each fully-built node is roughly 4-8 hours of content work. Option B is a week of content before any real-use signal.
- The deferred axes get tested against **actual study load**, not hypothetical load. A template that survives hypothetical variety but breaks on real use is worse than one we stress-test incrementally.
- Skeleton-only nodes still exercise the metadata and edge model for all 30 before we commit to scaling to 500. We lose content validation on the deferred axes, not structural validation.
- Risk is bounded: finding a compound-node problem at node 200 costs a refactor. Paying a week upfront to maybe avoid that refactor is the wrong trade when Joshua is user zero and needs cards in hand to study from.

## Build Order for the 3

| Order | Node                                | Why this one, in this slot                                                                |
| ----- | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| 1     | `airspace-vfr-weather-minimums`     | Cheapest. Proves discovery-first pedagogy against a real regulation. No new infra.        |
| 2     | `proc-engine-failure-after-takeoff` | Proves scenarios + judgment phases. Reg-absent, time-pressured. Still no new infra.       |
| 3     | `perf-crosswind-component`          | First `libs/activities/` component. Forces the Svelte activity contract to exist.         |

Sequence matters: infra cost rises across the three. If the template breaks on node 1 or 2, we catch it before paying for the activity contract on node 3.

## What We Are Explicitly Deferring

Each of the seven un-tested axes is listed with the node that will trigger the test and the event we expect to trigger it.

| Axis | Deferred until                     | Trigger node                         | Expected trigger event                                            |
| ---- | ---------------------------------- | ------------------------------------ | ----------------------------------------------------------------- |
| 3    | Perceptual vs. symbolic            | `nav-holding-pattern-entries`        | Joshua hits holding pattern review; sight-picture content needed  |
| 4    | Procedural vs. conceptual          | `nav-holding-pattern-entries`        | Same -- step-by-step entry procedure stress-tests Verify phase    |
| 5    | Technical vs. pedagogical          | `teach-common-student-errors-stalls` | Joshua starts CFI prep; `teaches` edge must carry real load       |
| 6    | Time-pressured vs. analytic (long) | `wx-go-nogo-decision`                | Joshua does a real weather-brief scenario; 20-min analytic rep    |
| 7    | Atomic vs. compound                | `plan-ifr-cross-country`             | Joshua starts IFR XC planning; "is this a node or a course?"      |
| 8    | Single-cert vs. multi-cert         | `airspace-classes-and-dimensions`    | Joshua studies airspace at PPL, then CFI -- same node, two blooms |
| 9    | Stable vs. volatile                | (no clean canary yet)                | First time we author a node citing current NOTAMs/ADs             |

Axes 1, 2, and 10 are covered by the three canaries.

## Success Criteria

After the 3 canaries are built, we will know things we do not know now:

- **Does discovery-first pedagogy actually work in markdown?** The vfr-wx-mins node will tell us whether the Context -> Problem -> Discover sequence reads naturally, or feels forced.
- **Is the seven-phase model the right shape?** If one node skips three phases, that is fine. If every node skips the same three, the model is wrong.
- **Is the metadata schema sufficient?** We will see which fields get filled in meaningfully vs. which are ceremonial. Empty fields are data.
- **Does `libs/activities/` have the right contract?** The crosswind component will force the first interactive content boundary. Whatever parameters, slots, and README shape it needs becomes the template.
- **How long does a fully-built node actually take?** The 4-8 hour estimate is a guess. After three nodes we have a real number, which changes the economics of scaling to 500.
- **Do the typed edges work as metadata or as navigation?** With three nodes and the skeleton 27 around them, we will see whether `requires` / `deepens` / `applies` feel useful in practice or just bureaucratic.

If any of these come back negative, we revise the template before the skeleton 27 get serious content. That is the point of canaries.
