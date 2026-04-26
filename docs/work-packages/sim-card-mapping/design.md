---
title: 'Design: Sim-Scenario / Study-Card Mapping'
product: study
feature: sim-card-mapping
type: design
status: unread
---

# Design: Sim-Scenario / Study-Card Mapping

The five questions the spec needed answered, with rationale, then the integration surface and authored mapping.

## Decisions

### 1. Where does the mapping live?

**Decision:** Code-resident, in [libs/constants/src/sim.ts](../../../libs/constants/src/sim.ts), as a typed `Record<SimScenarioId, readonly SimScenarioNodeLink[]>`. Not a DB table, not a frontmatter field on scenario `.ts` files, not a hangar-authored row.

**Why:**

- We have ~15 scenarios. Putting them in DB adds a migration, a seed, an admin surface, and three new failure modes (drift between code and DB, missing-row-at-runtime, hangar permissions) for a pure lookup table that changes when an engineer adds a scenario.
- The author of a new scenario already touches code ([scenarios/foo.ts](../../../libs/bc/sim/src/scenarios/), the scenario id constant, the registry). Adding one more line in the same PR is the right friction.
- Knowledge node ids are stable kebab-case slugs (e.g. `nav-instrument-approach-structure`); they are already string-typed in `card.nodeId` and `scenario.nodeId`. Reusing the same slug surface keeps the mental model uniform.
- The spec's compile-time exhaustiveness check is only available with a typed `Record<SimScenarioId, ...>`. A DB row gives runtime errors at best.
- When hangar lands and we want learners or instructors to author mappings: migrate to a table at that point, with the existing constant becoming the seed source. That is a one-day port, not a foundational risk.

**Anti-pattern avoided:** declaring the mapping inside each scenario's `.ts` file (e.g. on `repMetadata`). That distributes the truth, makes "show me everything that touches this node" a cross-file grep, and breaks the exhaustiveness check.

### 2. Cardinality

**Decision:** Many-to-many. One scenario maps to N nodes; one node may be referenced by N scenarios. No uniqueness constraint either direction.

**Why:**

- A real ILS approach exercises localiser tracking, glide-slope pitch/power, and marker-beacon recognition. Forcing a 1:1 collapse loses the second and third.
- Conversely, both `efato` and `partial-panel` exercise emergency-procedures judgment. Forcing a node to attach to one and only one scenario starves the other.
- Authored weight is the dial that distinguishes "primary node for this scenario" (1.0) from "secondary, reinforces something else" (e.g. 0.4).

### 3. Weight propagation

**Decision:** Per-node aggregated weight is `clamp01(Sum(scenarioWeight * edgeWeight))` over all scenarios that flag weakness and link to that node.

```text
nodePressure(n) = min(1, Σ_{s ∈ weakScenarios, (s,n) ∈ mapping} signal(s).weight * mapping[s][n].weight)
```

Then engine strengthen-slice scores receive an additive lift of `nodePressure(card.nodeId) * ENGINE_SCORING.STRENGTHEN.SIM_PRESSURE_FACTOR`.

**Why:**

- Linear, transparent, easy to unit test, and order-independent.
- Sum-with-clamp lets a learner who is weak on multiple scenarios sharing a node feel more pressure on that node, but never more than the saturated maximum (1.0). Capping prevents one super-weak learner from drowning every other slice.
- Multiplicative aggregation (compounding) was considered and rejected: it is non-monotone in pathological cases and harder to reason about during tuning.
- Putting the lift into strengthen specifically (not continue, not expand) is deliberate -- sim weakness is a "fix what is broken" signal, not a "branch out" signal. ENGINE_SCORING gets a single new dial; the rest of the engine is unchanged.

**Numeric bound:** `signal.weight` is in `[SIM_BIAS.WEIGHT_FLOOR, 1]` and `edgeWeight` is in `(0, 1]`, so per-pair product is `(0, 1]`. The clamped sum is `[0, 1]`. Multiplied by `SIM_PRESSURE_FACTOR` it lands in the same magnitude as the existing strengthen weights (`RELEARNING: 0.9`, `RATED_AGAIN: 0.6`).

### 4. Authoring workflow

**Decision:** PR-driven. The engineer adding a new sim scenario adds the corresponding mapping entry in the same PR. CI runs `bun run check` (compile-time exhaustiveness) plus the seed validator (every node id resolves) plus the mapping unit tests.

**Why:**

- Same friction as adding the scenario constant or registry entry. No new tool to learn.
- A reviewer can see mapping intent in the diff alongside the scenario itself, where the grading definition lives.
- Hangar authoring is out of scope (no hangar yet). Until hangar lands, the mapping is engineering-owned territory.

**When hangar lands:** the constant becomes the seed source for a `study.sim_scenario_node_link` table; CRUD lives in hangar; engineers stop editing the constant directly. That migration is documented in tasks.md as a future trigger, not work in this WP.

### 5. Engine integration touchpoint

**Decision:** Extend [EnginePoolFilters](../../../libs/bc/study/src/engine.ts) with a `simNodePressure: Readonly<Record<string, number>>` field. The pool builders in [sessions.ts](../../../libs/bc/study/src/sessions.ts) populate it via the new `simWeaknessByNode(userId)` BC function. The strengthen-slice scorers (`scoreStrengthenCard`, `scoreStrengthenRep`) read `simNodePressure[candidate.nodeId ?? '']` and add `pressure * ENGINE_SCORING.STRENGTHEN.SIM_PRESSURE_FACTOR` to the base score.

**Why:**

- `EnginePoolFilters` is already the bag of "everything the engine reads at scoring time": recent domains, focus filter, frequency, etc. Sim pressure is one more axis of that same shape.
- Pool builders are the only existing site that crosses BC boundaries (study reads from sim via `getRecentSimWeakness`). Keeping the cross-BC call there preserves the engine's purity.
- The engine itself (engine.ts) stays a pure function over `EngineInputs`. Tests pass a fake `simNodePressure: {}` and the existing scoring continues to work.
- Tagging strengthen slots with `STRENGTHEN_SIM_WEAKNESS_CARD` / `STRENGTHEN_SIM_WEAKNESS_REP` reason codes lets the session-legibility surface ("why is this here?") cite the sim run rather than just "you got it wrong".

## Type Surface

```typescript
// libs/constants/src/sim.ts

import type { SimScenarioId } from './sim';

/** One scenario -> node link. Authored, not derived. */
export interface SimScenarioNodeLink {
	/** Knowledge graph node id (kebab-case slug, must resolve at seed time). */
	readonly nodeId: string;
	/** Edge weight in (0, 1]. Higher = this node is more central to the scenario. */
	readonly weight: number;
}

/**
 * Authored mapping from sim scenarios to the knowledge nodes they exercise.
 * Many-to-many. Empty array is illegal (validated by unit test).
 *
 * Excludes `playground` and `playground_pa28`: those are sandbox scenarios
 * with no grading and therefore no weakness signal to propagate.
 */
export const SIM_SCENARIO_NODE_MAPPINGS: Record<
	Exclude<SimScenarioId, 'playground' | 'playground-pa28'>,
	readonly SimScenarioNodeLink[]
> = {
	/* see "Authored Mapping" below for the table */
};
```

```typescript
// libs/bc/study/src/sim-bias.ts (new file)

/**
 * Aggregate the BC-sim weakness signal into per-node pressure that the
 * scheduler can read without knowing about scenarios at all. Sum-then-clamp
 * across the authored mapping; nodes with no weak parent return nothing.
 */
export async function simWeaknessByNode(
	userId: string,
	options?: GetRecentSimWeaknessOptions,
	db?: Db,
): Promise<Map<string, number>>;
```

```typescript
// libs/bc/study/src/engine.ts -- new field on EnginePoolFilters

export interface EnginePoolFilters {
	// ... existing fields ...

	/**
	 * Per-knowledge-node pressure in [0, 1] derived from recent sim weakness
	 * via `simWeaknessByNode`. Empty record when the user has no weak sim
	 * scenarios in the window. Read by strengthen-slice scoring only.
	 */
	readonly simNodePressure: Readonly<Record<string, number>>;
}
```

## Authored Mapping

The full table for the 13 graded scenarios. Knowledge node slugs follow the existing `<domain-prefix>-<topic>` convention used in seeded knowledge nodes ([course/knowledge/](../../../course/knowledge/); the FIRC-era research dossiers at [course/firc/L02-Knowledge/](../../../course/firc/L02-Knowledge/) are reference-only). Where a node does not yet exist, the seed validator will fail and the engineer either authors the node or removes the link before merge.

| Scenario                       | Node id                                       | Weight | Rationale                                                                |
| ------------------------------ | --------------------------------------------- | ------ | ------------------------------------------------------------------------ |
| `first-flight`                 | `aero-four-forces`                            | 0.6    | Pitch / power / coordination basics.                                     |
| `first-flight`                 | `proc-traffic-pattern`                        | 0.4    | Climb-out and pattern entry shape.                                       |
| `departure-stall`              | `aero-angle-of-attack-and-stall`              | 1.0    | Primary concept under test.                                              |
| `departure-stall`              | `proc-stall-recovery`                         | 0.6    | Recovery technique.                                                      |
| `efato`                        | `proc-engine-failure-after-takeoff`           | 1.0    | Direct match.                                                            |
| `efato`                        | `proc-emergency-authority`                    | 0.4    | Decision authority while diverting.                                      |
| `vacuum-failure`               | `nav-partial-panel`                           | 0.8    | Vacuum-driven instruments cross-checked.                                 |
| `vacuum-failure`               | `proc-instrument-cross-check`                 | 0.6    | Scan adjustments.                                                        |
| `pitot-block`                  | `proc-pitot-static-failures`                  | 1.0    | Direct match.                                                            |
| `pitot-block`                  | `proc-instrument-cross-check`                 | 0.4    | Cross-check from alternate sources.                                      |
| `static-block`                 | `proc-pitot-static-failures`                  | 1.0    | Direct match.                                                            |
| `static-block`                 | `proc-alternate-static-source`                | 0.6    | Specific procedure.                                                      |
| `partial-panel`                | `nav-partial-panel`                           | 1.0    | Direct match.                                                            |
| `partial-panel`                | `proc-instrument-cross-check`                 | 0.5    | Scan rebuild.                                                            |
| `unusual-attitudes-nose-hi`    | `proc-unusual-attitude-recovery`              | 1.0    | Direct match.                                                            |
| `unusual-attitudes-nose-hi`    | `aero-angle-of-attack-and-stall`              | 0.4    | Nose-high recovery is stall-margin sensitive.                            |
| `unusual-attitudes-nose-lo`    | `proc-unusual-attitude-recovery`              | 1.0    | Direct match.                                                            |
| `unusual-attitudes-nose-lo`    | `proc-overspeed-recovery`                     | 0.4    | Nose-low rolls into Vne territory.                                       |
| `aft-cg-slow-flight`           | `aero-cg-and-stability`                       | 0.8    | CG-driven handling.                                                      |
| `aft-cg-slow-flight`           | `aero-slow-flight`                            | 0.6    | Slow-flight regime.                                                      |
| `vmc-into-imc`                 | `proc-spatial-disorientation`                 | 1.0    | Headline failure mode.                                                   |
| `vmc-into-imc`                 | `proc-180-degree-turn`                        | 0.6    | The textbook escape.                                                     |
| `ils-approach`                 | `nav-instrument-approach-structure`           | 0.6    | Approach segments + minimums.                                            |
| `ils-approach`                 | `nav-localiser-and-glide-slope-tracking`      | 1.0    | Direct lateral / vertical guidance focus.                                |
| `ils-approach`                 | `nav-marker-beacon-recognition`               | 0.4    | New beacon cue.                                                          |
| `steep-turns`                  | `aero-load-factor-and-bank-angle`             | 1.0    | Headline concept.                                                        |
| `steep-turns`                  | `aero-coordination-rudder`                    | 0.5    | Slip-ball discipline.                                                    |

Two scenarios (`playground`, `playground-pa28`) are excluded from the typed `Record` via `Exclude<SimScenarioId, ...>`; adding a new playground-style ungraded scenario means extending that exclusion, surfacing the choice in code review.

## Why this isn't an ADR

The decisions are about an internal data shape and one engine-scoring weight. ADRs are reserved for cross-cutting architectural choices ([ADR 011 knowledge graph](../../decisions/011-knowledge-graph-learning-system/decision.md), [ADR 014 engine scoring](../../decisions/014-engine-scoring/)). This work package is the right depth: spec + design + tasks + tests, all collocated under [docs/work-packages/sim-card-mapping/](.).
