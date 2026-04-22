/**
 * Scenario runner + registry tests. Deterministic, DB-free.
 */

import { SIM_FLAP_NOTCHES, SIM_SCENARIO_IDS, SIM_SCENARIO_OUTCOMES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import type { FdmInputs, FdmTruthState } from '../types';
import { getScenario, listScenarios } from './registry';
import { ScenarioRunner } from './runner';

function sampleTruth(partial: Partial<FdmTruthState> = {}): FdmTruthState {
	return {
		t: 0,
		x: 0,
		altitude: 0,
		groundElevation: 0,
		u: 0,
		w: 0,
		pitch: 0,
		pitchRate: 0,
		roll: 0,
		rollRate: 0,
		yawRate: 0,
		heading: 0,
		alpha: 0,
		trueAirspeed: 0,
		indicatedAirspeed: 0,
		groundSpeed: 0,
		verticalSpeed: 0,
		liftCoefficient: 0,
		dragCoefficient: 0,
		loadFactor: 0,
		slipBall: 0,
		onGround: false,
		brakeOn: false,
		stallWarning: false,
		stalled: false,
		flapsDegrees: SIM_FLAP_NOTCHES[0],
		elevatorEffective: 0,
		engineRpm: 800,
		...partial,
	};
}

function defaultInputs(partial: Partial<FdmInputs> = {}): FdmInputs {
	return {
		throttle: 0,
		elevator: 0,
		trim: 0,
		aileron: 0,
		rudder: 0,
		brake: false,
		autoCoordinate: true,
		flaps: SIM_FLAP_NOTCHES[0],
		...partial,
	};
}

describe('scenario registry', () => {
	it('returns the departure-stall scenario by id', () => {
		const s = getScenario(SIM_SCENARIO_IDS.DEPARTURE_STALL);
		expect(s.id).toBe(SIM_SCENARIO_IDS.DEPARTURE_STALL);
		expect(s.title).toBeTruthy();
	});

	it('lists three scenarios in recommended order', () => {
		const list = listScenarios();
		expect(list.length).toBe(3);
		expect(list[0].id).toBe(SIM_SCENARIO_IDS.PLAYGROUND);
		expect(list[1].id).toBe(SIM_SCENARIO_IDS.FIRST_FLIGHT);
		expect(list[2].id).toBe(SIM_SCENARIO_IDS.DEPARTURE_STALL);
	});

	it('returns all three scenarios from the id registry', () => {
		expect(getScenario(SIM_SCENARIO_IDS.PLAYGROUND).id).toBe(SIM_SCENARIO_IDS.PLAYGROUND);
		expect(getScenario(SIM_SCENARIO_IDS.FIRST_FLIGHT).id).toBe(SIM_SCENARIO_IDS.FIRST_FLIGHT);
		expect(getScenario(SIM_SCENARIO_IDS.DEPARTURE_STALL).id).toBe(SIM_SCENARIO_IDS.DEPARTURE_STALL);
	});
});

describe('ScenarioRunner -- departure stall', () => {
	it('reports success when altitude target is hit without stalling', () => {
		const def = getScenario(SIM_SCENARIO_IDS.DEPARTURE_STALL);
		const runner = new ScenarioRunner(def);
		const target = def.criteria.successAltitudeAglMeters;
		if (typeof target !== 'number') throw new Error('expected success criterion');
		const ground = def.initial.groundElevation;
		// Run for a tick to leave ground (peak AGL > 1).
		runner.evaluate(
			sampleTruth({ t: 0.1, altitude: ground + 50, groundElevation: ground, trueAirspeed: 25 }),
			defaultInputs(),
		);
		const verdict = runner.evaluate(
			sampleTruth({ t: 5, altitude: ground + target + 1, groundElevation: ground, trueAirspeed: 30 }),
			defaultInputs(),
		);
		expect(verdict.outcome).toBe(SIM_SCENARIO_OUTCOMES.SUCCESS);
	});

	it('reports failure after sustained stall', () => {
		const def = getScenario(SIM_SCENARIO_IDS.DEPARTURE_STALL);
		const runner = new ScenarioRunner(def);
		const ground = def.initial.groundElevation;

		const first = runner.evaluate(
			sampleTruth({ t: 0.3, altitude: ground + 30, groundElevation: ground, stalled: true }),
			defaultInputs(),
		);
		expect(first.outcome).toBe(SIM_SCENARIO_OUTCOMES.RUNNING);

		const second = runner.evaluate(
			sampleTruth({ t: 0.9, altitude: ground + 30, groundElevation: ground, stalled: true }),
			defaultInputs(),
		);
		expect(second.outcome).toBe(SIM_SCENARIO_OUTCOMES.RUNNING);

		const third = runner.evaluate(
			sampleTruth({ t: 1.5, altitude: ground + 30, groundElevation: ground, stalled: true }),
			defaultInputs(),
		);
		expect(third.outcome).toBe(SIM_SCENARIO_OUTCOMES.FAILURE);
	});

	it('reports failure on ground contact AFTER departure', () => {
		const def = getScenario(SIM_SCENARIO_IDS.DEPARTURE_STALL);
		const runner = new ScenarioRunner(def);
		const ground = def.initial.groundElevation;
		// Get airborne first.
		runner.evaluate(sampleTruth({ t: 1, altitude: ground + 50, groundElevation: ground }), defaultInputs());
		const verdict = runner.evaluate(
			sampleTruth({ t: 2, altitude: ground, groundElevation: ground, onGround: true }),
			defaultInputs(),
		);
		expect(verdict.outcome).toBe(SIM_SCENARIO_OUTCOMES.FAILURE);
	});

	it('does not fail on start-of-scenario ground contact', () => {
		const def = getScenario(SIM_SCENARIO_IDS.DEPARTURE_STALL);
		const runner = new ScenarioRunner(def);
		const ground = def.initial.groundElevation;
		const verdict = runner.evaluate(
			sampleTruth({ t: 2, altitude: ground, groundElevation: ground, onGround: true }),
			defaultInputs({ brake: true }),
		);
		expect(verdict.outcome).toBe(SIM_SCENARIO_OUTCOMES.RUNNING);
	});

	it('reports failure on timeout', () => {
		const def = getScenario(SIM_SCENARIO_IDS.DEPARTURE_STALL);
		const runner = new ScenarioRunner(def);
		const ground = def.initial.groundElevation;
		const timeout = def.criteria.timeoutSeconds;
		if (typeof timeout !== 'number') throw new Error('expected timeout');
		const verdict = runner.evaluate(
			sampleTruth({ t: timeout + 0.1, altitude: ground + 20, groundElevation: ground }),
			defaultInputs(),
		);
		expect(verdict.outcome).toBe(SIM_SCENARIO_OUTCOMES.FAILURE);
	});
});

describe('ScenarioRunner -- playground', () => {
	it('never ends', () => {
		const def = getScenario(SIM_SCENARIO_IDS.PLAYGROUND);
		const runner = new ScenarioRunner(def);
		const ground = def.initial.groundElevation;
		const verdict = runner.evaluate(
			sampleTruth({ t: 10000, altitude: ground + 10000, groundElevation: ground }),
			defaultInputs(),
		);
		expect(verdict.outcome).toBe(SIM_SCENARIO_OUTCOMES.RUNNING);
	});
});

describe('ScenarioRunner -- first-flight steps', () => {
	it('emits step state for tutorial scenarios', () => {
		const def = getScenario(SIM_SCENARIO_IDS.FIRST_FLIGHT);
		const runner = new ScenarioRunner(def);
		const ground = def.initial.groundElevation;
		const verdict = runner.evaluate(
			sampleTruth({ t: 0.1, altitude: ground, groundElevation: ground, onGround: true, brakeOn: true }),
			defaultInputs({ brake: true }),
		);
		expect(verdict.stepState).toBeDefined();
		if (!verdict.stepState) throw new Error('expected step state');
		expect(verdict.stepState.currentStepIndex).toBe(0);
		expect(verdict.stepState.totalSteps).toBeGreaterThan(5);
		expect(verdict.stepState.currentStepId).toBe('release-brake');
	});

	it('advances when brake is released', () => {
		const def = getScenario(SIM_SCENARIO_IDS.FIRST_FLIGHT);
		const runner = new ScenarioRunner(def);
		const ground = def.initial.groundElevation;
		// First tick: brake on.
		runner.evaluate(
			sampleTruth({ t: 0.1, altitude: ground, groundElevation: ground, onGround: true, brakeOn: true }),
			defaultInputs({ brake: true }),
		);
		// Brake released -- should advance immediately (step has no hold time).
		const after = runner.evaluate(
			sampleTruth({ t: 0.2, altitude: ground, groundElevation: ground, onGround: true }),
			defaultInputs({ brake: false }),
		);
		expect(after.stepState?.currentStepId).toBe('full-throttle');
	});
});
