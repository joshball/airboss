/**
 * Scenario runner + registry tests. Deterministic, DB-free.
 */

import { SIM_SCENARIO_IDS, SIM_SCENARIO_OUTCOMES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import type { FdmTruthState } from '../types';
import { getScenario, listScenarios } from './registry';
import { ScenarioRunner } from './runner';

function sampleTruth(partial: Partial<FdmTruthState>): FdmTruthState {
	return {
		t: 0,
		x: 0,
		altitude: 0,
		groundElevation: 0,
		u: 0,
		w: 0,
		pitch: 0,
		pitchRate: 0,
		alpha: 0,
		trueAirspeed: 0,
		indicatedAirspeed: 0,
		verticalSpeed: 0,
		liftCoefficient: 0,
		dragCoefficient: 0,
		loadFactor: 0,
		onGround: false,
		stalled: false,
		...partial,
	};
}

describe('scenario registry', () => {
	it('returns the departure-stall scenario by id', () => {
		const s = getScenario(SIM_SCENARIO_IDS.DEPARTURE_STALL);
		expect(s.id).toBe(SIM_SCENARIO_IDS.DEPARTURE_STALL);
		expect(s.title).toBeTruthy();
		expect(s.criteria.timeoutSeconds).toBeGreaterThan(0);
	});

	it('lists at least one scenario', () => {
		expect(listScenarios().length).toBeGreaterThanOrEqual(1);
	});
});

describe('ScenarioRunner', () => {
	it('reports success when altitude target is hit without stalling', () => {
		const def = getScenario(SIM_SCENARIO_IDS.DEPARTURE_STALL);
		const runner = new ScenarioRunner(def);

		const target = def.criteria.successAltitudeAglMeters;
		if (typeof target !== 'number') throw new Error('expected success criterion');
		const ground = def.initial.groundElevation;
		const verdict = runner.evaluate(
			sampleTruth({ t: 5, altitude: ground + target + 1, groundElevation: ground, trueAirspeed: 30 }),
		);
		expect(verdict.outcome).toBe(SIM_SCENARIO_OUTCOMES.SUCCESS);
	});

	it('reports failure after sustained stall', () => {
		const def = getScenario(SIM_SCENARIO_IDS.DEPARTURE_STALL);
		const runner = new ScenarioRunner(def);
		const ground = def.initial.groundElevation;

		// Hold stall = true for 1.5 s of sim time in 0.5 s increments. None of
		// these are ground-contact (altitude well above ground), so the only
		// failure path is the sustained stall criterion.
		const first = runner.evaluate(
			sampleTruth({ t: 0.3, altitude: ground + 30, groundElevation: ground, stalled: true }),
		);
		expect(first.outcome).toBe(SIM_SCENARIO_OUTCOMES.RUNNING);

		const second = runner.evaluate(
			sampleTruth({ t: 0.9, altitude: ground + 30, groundElevation: ground, stalled: true }),
		);
		expect(second.outcome).toBe(SIM_SCENARIO_OUTCOMES.RUNNING);

		const third = runner.evaluate(
			sampleTruth({ t: 1.5, altitude: ground + 30, groundElevation: ground, stalled: true }),
		);
		expect(third.outcome).toBe(SIM_SCENARIO_OUTCOMES.FAILURE);
	});

	it('reports failure on ground contact', () => {
		const def = getScenario(SIM_SCENARIO_IDS.DEPARTURE_STALL);
		const runner = new ScenarioRunner(def);
		const ground = def.initial.groundElevation;
		const verdict = runner.evaluate(sampleTruth({ t: 2, altitude: ground, groundElevation: ground, onGround: true }));
		expect(verdict.outcome).toBe(SIM_SCENARIO_OUTCOMES.FAILURE);
	});

	it('reports failure on timeout', () => {
		const def = getScenario(SIM_SCENARIO_IDS.DEPARTURE_STALL);
		const runner = new ScenarioRunner(def);
		const ground = def.initial.groundElevation;
		const verdict = runner.evaluate(
			sampleTruth({ t: def.criteria.timeoutSeconds + 0.1, altitude: ground + 20, groundElevation: ground }),
		);
		expect(verdict.outcome).toBe(SIM_SCENARIO_OUTCOMES.FAILURE);
	});
});
