---
title: 'Out of Scope: Sim-Scenario / Study-Card Mapping'
product: study
feature: sim-card-mapping
type: out-of-scope
status: unread
---

# Out of Scope: Sim-Scenario / Study-Card Mapping

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                                       | Status       | Trigger to revisit                                                                   |
| ---------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------ |
| Hangar-authored mapping table / hangar UI                  | Deferred     | When hangar exists and CFIs need to edit scenario / node links without a code change |
| Per-component sim signal (altitude vs heading vs stall)    | Deferred     | When >=10 active learners report that scenario-level lift is too coarse              |
| Reverse direction (study weakness -> sim queue suggestion) | Follow-on WP | When a "rehearsal queue" / sim-suggestion surface is authored                        |
| Tape-frame-level grading feedback                          | Rejected     | Never -- would require re-architecting `SIM_BIAS` and the sim BC `gradeTotal` shape  |
| Mappings to question-bank rows or scenario rows directly   | Rejected     | Never -- node is the canonical join target; bypassing it would fork the lift path    |

## Hangar-authored mapping table

Status: Deferred

What was deferred:
A DB-resident `study.sim_scenario_node_link` table that hangar CRUDs, replacing the code-resident `SIM_SCENARIO_NODE_MAPPINGS` constant in [libs/constants/src/sim.ts](../../../libs/constants/src/sim.ts).

Why:
Code-resident is correct for today's ~15 scenarios. PR review is the workflow; the engineer adding a sim scenario adds the mapping in the same PR. Compile-time exhaustiveness over `SimScenarioId` catches accidental orphans. Hangar does not yet exist as a content-authoring surface; building a CRUD table for a non-existent UI is premature.

Trigger to revisit:
When hangar exists and there is a desire to let CFIs edit scenario / node links without a code change. (Both prongs: hangar must be live, and the user value of CFI-driven edits must be real.)

Implementation pattern when triggered:
Migrate the constant to a `study.sim_scenario_node_link` table (mirror the shape of existing study schema rows; see [libs/bc/study/src/schema.ts](../../../libs/bc/study/src/schema.ts)). Port the seed script to populate from the table. Retire the constant. The hangar CRUD surface mirrors the `hangar-users-editing` pattern: form actions + audit emission + typed-confirmation modals where destructive.

References:

- [spec.md](./spec.md) -- "Out of Scope (resolved, not deferred)" originally listed this
- [design.md](./design.md) -- section 4 "Authoring workflow" + "When hangar lands" note
- [tasks.md](./tasks.md) -- "Out-of-scope (captured for later, do not start)" listed the same migration

## Per-component sim signal (altitude vs heading vs stall)

Status: Deferred

What was deferred:
Splitting `SimWeaknessSignal` into per-component channels (altitude, heading, stall, etc.) and extending the mapping with optional component qualifiers, so that "this learner busts altitude on every steep turn" lifts altitude-flavoured cards rather than the entire steep-turn node.

Why:
The grade total is a noisy enough signal at MVP; per-component fan-out is premature optimisation. The current scenario-level scoring through `SIM_BIAS` is the simplest thing that closes the sim-to-study feedback loop, and we want real observation before adding granularity.

Trigger to revisit:
When >=10 active learners report (or session-replay data shows) that scenario-level lift is too coarse -- i.e. the spaced-rep engine is lifting too many adjacent cards on a narrow failure mode.

Implementation pattern when triggered:
Extend `SimWeaknessSignal` in [libs/bc/sim/src/persistence.ts](../../../libs/bc/sim/src/persistence.ts) with a per-component breakdown. Extend `SimScenarioNodeLink` with an optional `component?: SimComponent` qualifier. Update `simWeaknessByNode` to fan out per-component (matching component-qualified mapping rows take that component's weight; unqualified rows take the aggregate weight). Add a new `ENGINE_SCORING.STRENGTHEN.SIM_COMPONENT_*` factor for the per-component lift.

References:

- [spec.md](./spec.md) -- "Out of Scope (resolved, not deferred)" originally listed this with explicit trigger
- [tasks.md](./tasks.md) -- "Out-of-scope" repeats the trigger
- [libs/constants/src/sim.ts](../../../libs/constants/src/sim.ts) -- `SIM_BIAS`

## Reverse direction (study weakness -> sim queue suggestion)

Status: Follow-on WP

What was deferred:
Using study weakness signals to suggest sim scenarios. "You keep getting `ils-approach-glide-slope-tracking` cards wrong; here are three sim scenarios that exercise that node."

Why:
Belongs to a future "rehearsal queue" product surface, not to this WP. This WP is the sim -> study direction only. The reverse direction is a different product question (when does the user see the suggestion? on the study dashboard? in a debrief? as a daily notification?) and needs its own framing.

Trigger to revisit:
When a "rehearsal queue" / sim-suggestion surface is authored as a product (likely as part of the sim surface roadmap once the study MVP proves the loop).

Implementation pattern when triggered:
Author a new WP under `docs/work-packages/sim-suggestion-from-study-weakness/`. Capture it as an idea in [docs/platform/IDEAS.md](../../platform/IDEAS.md) when the future product surface picks it up. The same `SIM_SCENARIO_NODE_MAPPINGS` constant powers both directions -- the reverse lookup is `Map<nodeId, SimScenarioId[]>` built from the inverse of the existing mapping.

References:

- [spec.md](./spec.md) -- "Out of Scope (resolved, not deferred)" originally listed this
- [tasks.md](./tasks.md) -- "Out-of-scope" calls it "out of this WP"
- [docs/platform/IDEAS.md](../../platform/IDEAS.md)

## Tape-frame-level grading feedback

Status: Rejected

What was rejected:
Per-frame ("at t=00:42 you busted altitude by 200ft") signal granularity feeding the mapping, rather than scenario-level `gradeTotal`.

Why:
Signal granularity follows what the sim BC already exposes. `SIM_BIAS` is structured around `gradeTotal`; going finer would require re-architecting both `SIM_BIAS` and the sim BC's persistence shape. The cost is large; the value is unclear (spaced-rep lift on per-frame events is not obviously the right pedagogy -- per-frame events probably belong to in-app sim debrief and immediate-feedback surfaces, not to next-session study card weighting).

Trigger to revisit:
Never via this WP. A tape-frame-level study-engine pressure model would require its own ADR and likely its own sim BC refactor. If frame-level feedback becomes desirable, the surface is sim debrief / replay, not spaced rep.

References:

- [spec.md](./spec.md) -- "Out of Scope (resolved, not deferred)" originally listed this
- [libs/constants/src/sim.ts](../../../libs/constants/src/sim.ts) -- `SIM_BIAS`
- [libs/bc/sim/src/persistence.ts](../../../libs/bc/sim/src/persistence.ts) -- `getRecentSimWeakness` shape
