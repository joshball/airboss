/**
 * Scenario runner + registry tests. Deterministic, DB-free.
 */

import {
	SIM_FAULT_KINDS,
	SIM_FAULT_TRIGGER_KINDS,
	SIM_FLAP_NOTCHES,
	SIM_SCENARIO_IDS,
	SIM_SCENARIO_OUTCOMES,
} from '@ab/constants';
import { describe, expect, it } from 'vitest';
import type { FdmInputs, FdmTruthState, ScenarioDefinition } from '../types';
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
		oilPressurePsi: 30,
		oilTempCelsius: 95,
		fuelLeftGallons: 26,
		fuelRightGallons: 26,
		ammeterAmps: 3,
		vacuumInHg: 5,
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

	it('lists every registered scenario in recommended order', () => {
		const list = listScenarios();
		expect(list.length).toBe(15);
		expect(list[0].id).toBe(SIM_SCENARIO_IDS.PLAYGROUND);
		expect(list[1].id).toBe(SIM_SCENARIO_IDS.FIRST_FLIGHT);
		expect(list[2].id).toBe(SIM_SCENARIO_IDS.DEPARTURE_STALL);
		expect(list[3].id).toBe(SIM_SCENARIO_IDS.EFATO);
		expect(list[4].id).toBe(SIM_SCENARIO_IDS.VACUUM_FAILURE);
		expect(list[5].id).toBe(SIM_SCENARIO_IDS.PITOT_BLOCK);
		expect(list[6].id).toBe(SIM_SCENARIO_IDS.STATIC_BLOCK);
		expect(list[7].id).toBe(SIM_SCENARIO_IDS.PARTIAL_PANEL);
		expect(list[8].id).toBe(SIM_SCENARIO_IDS.UNUSUAL_ATTITUDES_NOSE_HI);
		expect(list[9].id).toBe(SIM_SCENARIO_IDS.AFT_CG_SLOW_FLIGHT);
		expect(list[10].id).toBe(SIM_SCENARIO_IDS.UNUSUAL_ATTITUDES_NOSE_LO);
		expect(list[11].id).toBe(SIM_SCENARIO_IDS.VMC_INTO_IMC);
		expect(list[12].id).toBe(SIM_SCENARIO_IDS.PLAYGROUND_PA28);
		expect(list[13].id).toBe(SIM_SCENARIO_IDS.ILS_APPROACH);
		expect(list[14].id).toBe(SIM_SCENARIO_IDS.STEEP_TURNS);
	});

	it('returns every scenario from the id registry', () => {
		expect(getScenario(SIM_SCENARIO_IDS.PLAYGROUND).id).toBe(SIM_SCENARIO_IDS.PLAYGROUND);
		expect(getScenario(SIM_SCENARIO_IDS.FIRST_FLIGHT).id).toBe(SIM_SCENARIO_IDS.FIRST_FLIGHT);
		expect(getScenario(SIM_SCENARIO_IDS.DEPARTURE_STALL).id).toBe(SIM_SCENARIO_IDS.DEPARTURE_STALL);
		expect(getScenario(SIM_SCENARIO_IDS.EFATO).id).toBe(SIM_SCENARIO_IDS.EFATO);
		expect(getScenario(SIM_SCENARIO_IDS.VACUUM_FAILURE).id).toBe(SIM_SCENARIO_IDS.VACUUM_FAILURE);
		expect(getScenario(SIM_SCENARIO_IDS.PITOT_BLOCK).id).toBe(SIM_SCENARIO_IDS.PITOT_BLOCK);
		expect(getScenario(SIM_SCENARIO_IDS.STATIC_BLOCK).id).toBe(SIM_SCENARIO_IDS.STATIC_BLOCK);
		expect(getScenario(SIM_SCENARIO_IDS.PARTIAL_PANEL).id).toBe(SIM_SCENARIO_IDS.PARTIAL_PANEL);
		expect(getScenario(SIM_SCENARIO_IDS.UNUSUAL_ATTITUDES_NOSE_HI).id).toBe(SIM_SCENARIO_IDS.UNUSUAL_ATTITUDES_NOSE_HI);
		expect(getScenario(SIM_SCENARIO_IDS.UNUSUAL_ATTITUDES_NOSE_LO).id).toBe(SIM_SCENARIO_IDS.UNUSUAL_ATTITUDES_NOSE_LO);
		expect(getScenario(SIM_SCENARIO_IDS.AFT_CG_SLOW_FLIGHT).id).toBe(SIM_SCENARIO_IDS.AFT_CG_SLOW_FLIGHT);
		expect(getScenario(SIM_SCENARIO_IDS.VMC_INTO_IMC).id).toBe(SIM_SCENARIO_IDS.VMC_INTO_IMC);
		expect(getScenario(SIM_SCENARIO_IDS.PLAYGROUND_PA28).id).toBe(SIM_SCENARIO_IDS.PLAYGROUND_PA28);
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
	it('never ends on its own', () => {
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

describe('ScenarioRunner -- crash detection', () => {
	function playgroundRunner(): ScenarioRunner {
		return new ScenarioRunner(getScenario(SIM_SCENARIO_IDS.PLAYGROUND));
	}

	it('flags hard-impact crash on playground (endless scenario)', () => {
		const runner = playgroundRunner();
		const ground = 305;
		// First tick: airborne climbing.
		runner.evaluate(
			sampleTruth({ t: 5, altitude: ground + 30, groundElevation: ground, verticalSpeed: 5 }),
			defaultInputs(),
		);
		// Second tick: slammed into the ground at 700 fpm sink.
		const verdict = runner.evaluate(
			sampleTruth({
				t: 10,
				altitude: ground,
				groundElevation: ground,
				verticalSpeed: -3.6, // ~700 fpm descent
				onGround: true,
			}),
			defaultInputs(),
		);
		expect(verdict.outcome).toBe(SIM_SCENARIO_OUTCOMES.FAILURE);
		expect(verdict.reason).toMatch(/Hard impact/);
	});

	it('does not crash-fire on parked scenario start', () => {
		const runner = playgroundRunner();
		const def = getScenario(SIM_SCENARIO_IDS.PLAYGROUND);
		const ground = def.initial.groundElevation;
		const verdict = runner.evaluate(
			sampleTruth({
				t: 0,
				altitude: ground,
				groundElevation: ground,
				verticalSpeed: 0,
				onGround: true,
			}),
			defaultInputs({ brake: true }),
		);
		expect(verdict.outcome).toBe(SIM_SCENARIO_OUTCOMES.RUNNING);
	});

	it('flags wing strike on touchdown above 30 deg bank', () => {
		const runner = playgroundRunner();
		const ground = 305;
		runner.evaluate(
			sampleTruth({ t: 5, altitude: ground + 20, groundElevation: ground, verticalSpeed: -1 }),
			defaultInputs(),
		);
		const verdict = runner.evaluate(
			sampleTruth({
				t: 10,
				altitude: ground,
				groundElevation: ground,
				verticalSpeed: -1, // soft sink, but banked
				roll: 45 * (Math.PI / 180),
				onGround: true,
			}),
			defaultInputs(),
		);
		expect(verdict.outcome).toBe(SIM_SCENARIO_OUTCOMES.FAILURE);
		expect(verdict.reason).toMatch(/Wing strike/);
	});

	it('flags structural failure on G overstress in flight', () => {
		const runner = playgroundRunner();
		const ground = 305;
		const verdict = runner.evaluate(
			sampleTruth({ t: 5, altitude: ground + 500, groundElevation: ground, loadFactor: 5.2 }),
			defaultInputs(),
		);
		expect(verdict.outcome).toBe(SIM_SCENARIO_OUTCOMES.FAILURE);
		expect(verdict.reason).toMatch(/G overstress/);
	});

	it('passes a soft touchdown within envelope', () => {
		const runner = playgroundRunner();
		const ground = 305;
		runner.evaluate(
			sampleTruth({ t: 5, altitude: ground + 20, groundElevation: ground, verticalSpeed: -1 }),
			defaultInputs(),
		);
		const verdict = runner.evaluate(
			sampleTruth({
				t: 10,
				altitude: ground,
				groundElevation: ground,
				verticalSpeed: -1.5, // ~300 fpm sink, within envelope
				pitch: 5 * (Math.PI / 180),
				roll: 0,
				onGround: true,
			}),
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

describe('ScenarioRunner -- fault firing from def.faults', () => {
	function playgroundWithFaults(faults: ScenarioDefinition['faults']): ScenarioRunner {
		const base = getScenario(SIM_SCENARIO_IDS.PLAYGROUND);
		const def: ScenarioDefinition = { ...base, faults };
		return new ScenarioRunner(def);
	}

	it('returns empty activations when the scenario declares no faults', () => {
		const runner = playgroundWithFaults(undefined);
		const verdict = runner.evaluate(sampleTruth({ t: 5 }), defaultInputs());
		expect(verdict.activations).toEqual([]);
		expect(verdict.firedThisTick).toEqual([]);
	});

	it('fires a time-based fault on the first tick past the threshold', () => {
		const runner = playgroundWithFaults([
			{
				kind: SIM_FAULT_KINDS.VACUUM_FAILURE,
				trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 30 },
			},
		]);
		// Before the threshold: no fire.
		const before = runner.evaluate(sampleTruth({ t: 29 }), defaultInputs());
		expect(before.firedThisTick).toEqual([]);
		// Edge tick: fires.
		const at = runner.evaluate(sampleTruth({ t: 30 }), defaultInputs());
		expect(at.firedThisTick).toEqual([SIM_FAULT_KINDS.VACUUM_FAILURE]);
		expect(at.activations.length).toBe(1);
		expect(at.activations[0].kind).toBe(SIM_FAULT_KINDS.VACUUM_FAILURE);
		expect(at.activations[0].firedAtT).toBe(30);
		// Subsequent tick: still active but firedThisTick is empty.
		const after = runner.evaluate(sampleTruth({ t: 31 }), defaultInputs());
		expect(after.firedThisTick).toEqual([]);
		expect(after.activations.length).toBe(1);
	});

	it('fires an altitude-AGL fault on upward crossing', () => {
		const runner = playgroundWithFaults([
			{
				kind: SIM_FAULT_KINDS.PITOT_BLOCK,
				trigger: { kind: SIM_FAULT_TRIGGER_KINDS.ALTITUDE_AGL_METERS, above: 500 },
			},
		]);
		const ground = getScenario(SIM_SCENARIO_IDS.PLAYGROUND).initial.groundElevation;
		// Below: no fire.
		const below = runner.evaluate(
			sampleTruth({ t: 5, altitude: ground + 200, groundElevation: ground }),
			defaultInputs(),
		);
		expect(below.firedThisTick).toEqual([]);
		// Crossing tick: fires.
		const cross = runner.evaluate(
			sampleTruth({ t: 10, altitude: ground + 600, groundElevation: ground }),
			defaultInputs(),
		);
		expect(cross.firedThisTick).toEqual([SIM_FAULT_KINDS.PITOT_BLOCK]);
		// Descending below 500 again: does not re-fire (faults are sticky).
		const back = runner.evaluate(
			sampleTruth({ t: 15, altitude: ground + 100, groundElevation: ground }),
			defaultInputs(),
		);
		expect(back.firedThisTick).toEqual([]);
		expect(back.activations.length).toBe(1);
	});

	it('fires multiple faults independently within the same tick', () => {
		const runner = playgroundWithFaults([
			{
				kind: SIM_FAULT_KINDS.VACUUM_FAILURE,
				trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 10 },
			},
			{
				kind: SIM_FAULT_KINDS.ALTERNATOR_FAILURE,
				trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 10 },
			},
		]);
		const at = runner.evaluate(sampleTruth({ t: 10 }), defaultInputs());
		expect(at.firedThisTick).toContain(SIM_FAULT_KINDS.VACUUM_FAILURE);
		expect(at.firedThisTick).toContain(SIM_FAULT_KINDS.ALTERNATOR_FAILURE);
		expect(at.activations.length).toBe(2);
	});

	it('exposes activations via getActivations() for the worker', () => {
		const runner = playgroundWithFaults([
			{
				kind: SIM_FAULT_KINDS.VACUUM_FAILURE,
				trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 5 },
			},
		]);
		runner.evaluate(sampleTruth({ t: 5 }), defaultInputs());
		expect(runner.getActivations().length).toBe(1);
		expect(runner.getActivations()[0].kind).toBe(SIM_FAULT_KINDS.VACUUM_FAILURE);
	});
});
