/**
 * Pure-aggregation unit tests for `aggregateSimNodePressure`. The DB-side
 * `simWeaknessByNode` is a thin compose of `getRecentSimWeakness` and this
 * helper; once the helper's invariants are pinned, the integration is
 * covered by the engine + manual test plan.
 */

import type { SimWeaknessSignal } from '@ab/bc-sim/persistence';
import { SIM_SCENARIO_IDS, type SimScenarioNodeLink } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { aggregateSimNodePressure, type SimScenarioNodeMappings } from './sim-bias';

function signal(scenarioId: string, weight: number, attempts = 3, avgGradeTotal = 0.4): SimWeaknessSignal {
	return { scenarioId, attempts, avgGradeTotal, weight };
}

const STUB_MAPPINGS: SimScenarioNodeMappings = {
	[SIM_SCENARIO_IDS.EFATO]: [
		{ nodeId: 'node-a', weight: 1.0 },
		{ nodeId: 'node-b', weight: 0.5 },
	] satisfies readonly SimScenarioNodeLink[],
	[SIM_SCENARIO_IDS.PARTIAL_PANEL]: [
		{ nodeId: 'node-b', weight: 1.0 },
		{ nodeId: 'node-c', weight: 0.4 },
	] satisfies readonly SimScenarioNodeLink[],
	[SIM_SCENARIO_IDS.ILS_APPROACH]: [{ nodeId: 'node-d', weight: 1.0 }] satisfies readonly SimScenarioNodeLink[],
};

describe('aggregateSimNodePressure', () => {
	it('returns an empty map when there are no signals', () => {
		const result = aggregateSimNodePressure([], STUB_MAPPINGS);
		expect(result.size).toBe(0);
	});

	it('fans one weak scenario across its mapped nodes at signal.weight * edge.weight', () => {
		const signals = [signal(SIM_SCENARIO_IDS.EFATO, 0.4)];
		const result = aggregateSimNodePressure(signals, STUB_MAPPINGS);
		expect(result.get('node-a')).toBeCloseTo(0.4, 10);
		expect(result.get('node-b')).toBeCloseTo(0.2, 10);
		expect(result.size).toBe(2);
	});

	it('sums contributions when two weak scenarios share a node', () => {
		// efato hits node-b at 0.5, partial-panel hits node-b at 1.0.
		// Both signals at weight 0.3 -> node-b accumulates 0.15 + 0.30 = 0.45.
		const signals = [signal(SIM_SCENARIO_IDS.EFATO, 0.3), signal(SIM_SCENARIO_IDS.PARTIAL_PANEL, 0.3)];
		const result = aggregateSimNodePressure(signals, STUB_MAPPINGS);
		expect(result.get('node-b')).toBeCloseTo(0.45, 10);
	});

	it('clamps the per-node sum at 1.0', () => {
		// Both scenarios at weight 1.0 -> node-b accumulates 0.5 + 1.0 = 1.5
		// before clamping, then clamps to exactly 1.0.
		const signals = [signal(SIM_SCENARIO_IDS.EFATO, 1.0), signal(SIM_SCENARIO_IDS.PARTIAL_PANEL, 1.0)];
		const result = aggregateSimNodePressure(signals, STUB_MAPPINGS);
		expect(result.get('node-b')).toBe(1);
	});

	it('ignores scenarios that have no mapping row, without throwing', () => {
		// playground is intentionally absent from the mapping (ungraded).
		const signals = [
			signal(SIM_SCENARIO_IDS.PLAYGROUND, 1.0),
			signal('totally-made-up-scenario', 1.0),
			signal(SIM_SCENARIO_IDS.ILS_APPROACH, 0.5),
		];
		const result = aggregateSimNodePressure(signals, STUB_MAPPINGS);
		expect(result.get('node-d')).toBeCloseTo(0.5, 10);
		expect(result.size).toBe(1);
	});

	it('produces deterministic key iteration for the same input', () => {
		const signals = [signal(SIM_SCENARIO_IDS.EFATO, 0.4), signal(SIM_SCENARIO_IDS.PARTIAL_PANEL, 0.4)];
		const a = Array.from(aggregateSimNodePressure(signals, STUB_MAPPINGS).keys());
		const b = Array.from(aggregateSimNodePressure(signals, STUB_MAPPINGS).keys());
		expect(a).toEqual(b);
	});

	it('defaults to the production SIM_SCENARIO_NODE_MAPPINGS when no override is supplied', () => {
		// efato -> proc-engine-failure-after-takeoff (1.0) and proc-emergency-authority (0.4)
		// in the authored mapping. Verifies the helper composes with the real table.
		const signals = [signal(SIM_SCENARIO_IDS.EFATO, 1.0)];
		const result = aggregateSimNodePressure(signals);
		expect(result.get('proc-engine-failure-after-takeoff')).toBe(1);
		expect(result.get('proc-emergency-authority')).toBeCloseTo(0.4, 10);
	});
});
