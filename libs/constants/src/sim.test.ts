/**
 * Constant-level invariants for the sim-scenario / study-card mapping.
 *
 * The compile-time exhaustiveness check (typed `Record<SimScenarioIdGraded, ...>`)
 * already prevents adding a graded scenario without a mapping. These tests
 * cover the structural rules the type system can't see -- non-empty arrays,
 * weight ranges, slug shape, no stray keys -- and the engine-side magnitude
 * dial.
 */

import { describe, expect, it } from 'vitest';
import { ENGINE_SCORING } from './engine';
import { SIM_SCENARIO_ID_VALUES, SIM_SCENARIO_IDS, SIM_SCENARIO_NODE_MAPPINGS, type SimScenarioId } from './sim';

const NODE_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const UNGRADED: ReadonlySet<SimScenarioId> = new Set([SIM_SCENARIO_IDS.PLAYGROUND, SIM_SCENARIO_IDS.PLAYGROUND_PA28]);

describe('SIM_SCENARIO_NODE_MAPPINGS', () => {
	it('every key is a current SimScenarioId', () => {
		for (const key of Object.keys(SIM_SCENARIO_NODE_MAPPINGS)) {
			expect(SIM_SCENARIO_ID_VALUES).toContain(key as SimScenarioId);
		}
	});

	it('covers every graded scenario in SIM_SCENARIO_ID_VALUES', () => {
		const mapped = new Set(Object.keys(SIM_SCENARIO_NODE_MAPPINGS));
		const missing = SIM_SCENARIO_ID_VALUES.filter((id) => !UNGRADED.has(id) && !mapped.has(id));
		expect(missing).toEqual([]);
	});

	it('excludes ungraded sandbox scenarios (playground, playground-pa28)', () => {
		for (const ungraded of UNGRADED) {
			expect(Object.hasOwn(SIM_SCENARIO_NODE_MAPPINGS, ungraded)).toBe(false);
		}
	});

	it('every value array is non-empty', () => {
		for (const [scenarioId, links] of Object.entries(SIM_SCENARIO_NODE_MAPPINGS)) {
			expect(links.length, `scenario '${scenarioId}' has no node links`).toBeGreaterThan(0);
		}
	});

	it('every weight is in (0, 1]', () => {
		for (const [scenarioId, links] of Object.entries(SIM_SCENARIO_NODE_MAPPINGS)) {
			for (const link of links) {
				expect(
					link.weight > 0 && link.weight <= 1,
					`scenario '${scenarioId}' -> '${link.nodeId}' weight ${link.weight} not in (0, 1]`,
				).toBe(true);
			}
		}
	});

	it('every nodeId is a kebab-case slug', () => {
		for (const [scenarioId, links] of Object.entries(SIM_SCENARIO_NODE_MAPPINGS)) {
			for (const link of links) {
				expect(
					NODE_ID_PATTERN.test(link.nodeId),
					`scenario '${scenarioId}' nodeId '${link.nodeId}' is not kebab-case`,
				).toBe(true);
			}
		}
	});

	it('within a scenario, nodeIds are unique (no duplicate edges)', () => {
		for (const [scenarioId, links] of Object.entries(SIM_SCENARIO_NODE_MAPPINGS)) {
			const ids = links.map((l) => l.nodeId);
			expect(new Set(ids).size, `scenario '${scenarioId}' has duplicate nodeId edges`).toBe(ids.length);
		}
	});
});

describe('ENGINE_SCORING.STRENGTHEN.SIM_PRESSURE_FACTOR', () => {
	it('is in (0, 1]', () => {
		const factor = ENGINE_SCORING.STRENGTHEN.SIM_PRESSURE_FACTOR;
		expect(factor > 0 && factor <= 1).toBe(true);
	});
});
