---
title: 'Test Plan: Sim-Scenario / Study-Card Mapping'
product: study
feature: sim-card-mapping
type: test-plan
status: unread
---

# Test Plan: Sim-Scenario / Study-Card Mapping

Two layers: automated tests live alongside the code and run in CI; manual tests confirm the integration end-to-end on a seeded local DB before the WP merges.

## Automated

### Unit -- constants ([libs/constants/src/sim.test.ts](../../../libs/constants/src/sim.test.ts))

| Case                                                                  | Expected                                       |
| --------------------------------------------------------------------- | ---------------------------------------------- |
| Every key in `SIM_SCENARIO_NODE_MAPPINGS` is a current `SimScenarioId`| `SIM_SCENARIO_ID_VALUES.includes(key)` for all |
| `playground` and `playground-pa28` are the only excluded scenarios    | Exhaustiveness check via `Exclude<...>`        |
| Every value array length >= 1                                         | Pass                                           |
| Every `weight` in `(0, 1]`                                            | Pass                                           |
| Every `nodeId` matches `/^[a-z0-9]+(-[a-z0-9]+)*$/`                   | Pass                                           |
| `ENGINE_SCORING.STRENGTHEN.SIM_PRESSURE_FACTOR` is in `(0, 1]`        | Pass                                           |

### Unit -- aggregation ([libs/bc/study/src/sim-bias.test.ts](../../../libs/bc/study/src/sim-bias.test.ts))

`aggregateSimNodePressure` is a pure function over signals + mappings. Tests use hand-built signals and a stub mapping.

| Case                                                                                  | Expected                                                |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Empty signals                                                                         | Empty map                                               |
| One scenario at weight 0.4, mapped to two nodes at edge weights 1.0 and 0.5           | `{ nodeA: 0.4, nodeB: 0.2 }`                            |
| Two scenarios sharing one node, summed pressure exceeds 1.0                           | Clamped to exactly 1.0                                  |
| Scenario weakness signal that has no mapping row (defensive)                          | Ignored, no throw, other nodes unaffected               |
| Stable insertion order                                                                | Map iteration deterministic across runs (seed-friendly) |

### Unit -- engine ([libs/bc/study/src/engine.test.ts](../../../libs/bc/study/src/engine.test.ts))

| Case                                                                                                  | Expected                                                          |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `simNodePressure: {}` for all existing scenarios                                                      | Existing engine tests pass unchanged                              |
| Two cards otherwise identical, one with `simNodePressure[nodeId] = 0.8`                               | Pressured card scored higher, picked first into strengthen slice  |
| Card with `nodeId: null`                                                                              | Sim pressure contributes 0; never throws                          |
| Card whose nodeId is in pressure map but not in pool filter focus                                     | Still receives lift; not gated on focus                           |
| Lift magnitude check: `pressure * SIM_PRESSURE_FACTOR` matches expected delta                         | Exact arithmetic                                                  |
| Reason code attribution: when sim pressure dominates, slot row has `STRENGTHEN_SIM_WEAKNESS_CARD`     | Pass                                                              |
| Rep candidate path: `simNodePressure` lifts strengthen rep score, sets `STRENGTHEN_SIM_WEAKNESS_REP`  | Pass                                                              |

### Seed validation

Run by `bun run db:seed:check` (or the existing seed validator).

| Case                                                                              | Expected                                |
| --------------------------------------------------------------------------------- | --------------------------------------- |
| Every `nodeId` in `SIM_SCENARIO_NODE_MAPPINGS` resolves to a `knowledge_node` row | Exit 0                                  |
| Deliberately mistyped `nodeId` (e.g. `nav-localizer-glideslope`)                  | Exit non-zero, lists offending pair(s)  |

## Manual

Pre-conditions:

- Local OrbStack DB up, schema migrated, knowledge graph seeded.
- Abby (`abby@airboss.test`) signed in.
- Abby has at least one card and one rep attached to each of: `proc-engine-failure-after-takeoff`, `nav-localiser-and-glide-slope-tracking`, `aero-load-factor-and-bank-angle`. Use `db:seed --abby --extras` if available, otherwise hand-create.

### MT-1: Single weak scenario lifts the right cards

1. Open the sim, fly `efato` three times deliberately poorly (delay reaction, blow airspeed).
2. Confirm grade totals all <= 0.6 (visible in debrief).
3. As Abby, navigate to the study app, request a session.
4. Inspect the strengthen slice. Cards / reps attached to `proc-engine-failure-after-takeoff` and `proc-emergency-authority` appear with reason "Strengthening: recent sim weakness".
5. Cards attached to other emergency-procedures nodes that are NOT linked to `efato` do not get the lift.

### MT-2: Multiple weak scenarios share a node, pressure caps at 1.0

1. Fly `partial-panel` and `vacuum-failure` poorly (>= 2 attempts each, grade total <= 0.6).
2. Request a study session.
3. Cards attached to `proc-instrument-cross-check` (linked from both scenarios) appear in strengthen with the sim-weakness reason.
4. The card placement order is consistent with a clamped `[0, 1]` pressure: a card whose node only links from one weak scenario does not out-rank one whose node links from both, with one exception -- two weak parents producing a clamped 1.0 pressure should still rank ahead.

### MT-3: No recent sim attempts -> no behaviour change

1. Reset Abby's `sim_attempt` history (or use a clean user).
2. Request a study session.
3. Slot composition matches the same-state baseline session: existing strengthen reasons (rated again, relearning, low rep accuracy) only. No `STRENGTHEN_SIM_WEAKNESS_*` reasons appear.

### MT-4: Card without a node is ignored

1. Confirm Abby owns at least one personal card with `nodeId: null` in the same domain as a weak scenario's nodes.
2. Request a session.
3. The personal card may still appear via existing scoring paths (rated again, due, etc.) but never with a `STRENGTHEN_SIM_WEAKNESS_*` reason.

### MT-5: Mapping survives a missing node fail-loud

1. In a feature branch, deliberately edit one mapping row to point at a non-existent slug (e.g. `nav-localiser-and-glide-slope-trackzz`).
2. Run `bun run db:seed:check`.
3. Validator exits non-zero and names the bad pair. Revert.

## Coverage map

| Spec section                              | Where verified                          |
| ----------------------------------------- | --------------------------------------- |
| Authored mapping covers every graded id   | Constants unit test                     |
| `weight` in `(0, 1]`                      | Constants unit test                     |
| Node ids resolve in DB                    | Seed validator + MT-5                   |
| `simWeaknessByNode` aggregation rule      | sim-bias unit test (sum-then-clamp)     |
| Engine strengthen lift                    | Engine unit test + MT-1, MT-2           |
| `null nodeId` card ignored                | Engine unit test + MT-4                 |
| No regression when no signal              | Engine unit test + MT-3                 |
| Reason-code attribution                   | Engine unit test + MT-1                 |
