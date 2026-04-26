/**
 * Shape tests for the four VFR scenarios introduced in
 * `feat(sim): four VFR scenarios`. Each test verifies that the scenario:
 *   - is registered in SCENARIO_REGISTRY and resolvable via getScenario
 *   - has a unique recommendedOrder (no collision with siblings)
 *   - declares grading weights that sum to ~1.0
 *   - grades a synthetic single-frame tape without throwing
 *
 * The grading evaluator already has thorough unit coverage in
 * `grading.test.ts`; this file is a smoke test that catches authoring
 * mistakes (missing params, malformed weights, mis-registered ids).
 */

import { SIM_FLAP_NOTCHES, SIM_GRADING, SIM_SCENARIO_IDS, SIM_SCENARIO_OUTCOMES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import type { FaultActivation } from '../faults/types';
import type { ReplayFrame, ReplayTape } from '../replay/types';
import type { FdmInputs, FdmTruthState, ScenarioDefinition } from '../types';
import { evaluateGrading } from './grading';
import { getScenario, listScenarios, SCENARIO_REGISTRY } from './registry';

const NEW_SCENARIO_IDS = [
	SIM_SCENARIO_IDS.GROUND_REFERENCE_TURNS_AROUND_POINT,
	SIM_SCENARIO_IDS.SHORT_FIELD_LANDING,
	SIM_SCENARIO_IDS.SLOW_FLIGHT,
	SIM_SCENARIO_IDS.CROSSWIND_LANDING,
] as const;

function makeTruth(scenario: ScenarioDefinition, t: number): FdmTruthState {
	const init = scenario.initial;
	return {
		t,
		x: 0,
		altitude: init.altitude,
		groundElevation: init.groundElevation,
		u: init.u,
		w: init.w,
		pitch: init.pitch,
		pitchRate: init.pitchRate,
		roll: init.roll,
		rollRate: init.rollRate,
		yawRate: init.yawRate,
		heading: init.heading,
		alpha: 0.05,
		trueAirspeed: init.u,
		indicatedAirspeed: init.u,
		groundSpeed: init.u,
		verticalSpeed: init.w,
		liftCoefficient: 0.5,
		dragCoefficient: 0.05,
		loadFactor: 1,
		slipBall: 0,
		onGround: init.onGround,
		brakeOn: init.brake,
		stallWarning: false,
		stalled: false,
		flapsDegrees: init.flaps,
		elevatorEffective: 0,
		engineRpm: 2300,
		oilPressurePsi: 50,
		oilTempCelsius: 90,
		fuelLeftGallons: 26,
		fuelRightGallons: 26,
		ammeterAmps: 3,
		vacuumInHg: 5,
	};
}

function makeInputs(scenario: ScenarioDefinition): FdmInputs {
	const init = scenario.initial;
	return {
		throttle: init.throttle,
		elevator: init.elevator,
		trim: init.trim,
		aileron: init.aileron,
		rudder: init.rudder,
		brake: init.brake,
		autoCoordinate: init.autoCoordinate,
		flaps: init.flaps,
	};
}

function makeFrame(scenario: ScenarioDefinition, t: number): ReplayFrame {
	const truth = makeTruth(scenario, t);
	const activations: readonly FaultActivation[] = [];
	return {
		t,
		truth,
		display: {
			indicatedAirspeed: truth.indicatedAirspeed,
			altitudeMsl: truth.altitude,
			verticalSpeed: truth.verticalSpeed,
			pitchIndicated: truth.pitch,
			rollIndicated: truth.roll,
			headingIndicated: truth.heading,
			yawRateIndicated: truth.yawRate,
			slipBall: truth.slipBall,
			alpha: truth.alpha,
			stallWarning: truth.stallWarning,
			stalled: truth.stalled,
			engineRpm: truth.engineRpm,
			flapsDegrees: truth.flapsDegrees,
			electricBusVolts: 28,
			onGround: truth.onGround,
			t: truth.t,
			oilPressurePsi: truth.oilPressurePsi,
			oilTempCelsius: truth.oilTempCelsius,
			fuelLeftGallons: truth.fuelLeftGallons,
			fuelRightGallons: truth.fuelRightGallons,
			ammeterAmps: truth.ammeterAmps,
			vacuumInHg: truth.vacuumInHg,
		},
		inputs: makeInputs(scenario),
		activations,
		firedThisTick: [],
	};
}

function makeTape(scenario: ScenarioDefinition, frameCount = 5): ReplayTape {
	const frames: ReplayFrame[] = [];
	for (let i = 0; i < frameCount; i += 1) {
		frames.push(makeFrame(scenario, i));
	}
	return {
		scenarioId: scenario.id,
		scenarioHash: 'test-hash',
		seed: 0,
		initial: {
			altitude: scenario.initial.altitude,
			groundElevation: scenario.initial.groundElevation,
			u: scenario.initial.u,
			w: scenario.initial.w,
			pitch: scenario.initial.pitch,
			pitchRate: scenario.initial.pitchRate,
			roll: scenario.initial.roll,
			rollRate: scenario.initial.rollRate,
			yawRate: scenario.initial.yawRate,
			heading: scenario.initial.heading,
			throttle: scenario.initial.throttle,
			elevator: scenario.initial.elevator,
			trim: scenario.initial.trim,
			aileron: scenario.initial.aileron,
			rudder: scenario.initial.rudder,
			brake: scenario.initial.brake,
			autoCoordinate: scenario.initial.autoCoordinate,
			flaps: scenario.initial.flaps,
			onGround: scenario.initial.onGround,
		},
		frames,
		result: {
			scenarioId: scenario.id,
			outcome: SIM_SCENARIO_OUTCOMES.SUCCESS,
			elapsedSeconds: frames[frames.length - 1]?.t ?? 0,
			peakAltitudeAgl: 100,
			maxAlpha: 0.1,
			reason: 'test',
		},
		formatVersion: 1,
	};
}

describe('VFR scenarios -- registration and shape', () => {
	it.each(NEW_SCENARIO_IDS)('%s is resolvable via getScenario', (id) => {
		const scenario = getScenario(id);
		expect(scenario.id).toBe(id);
		expect(scenario.title).toBeTruthy();
		expect(scenario.briefing).toBeTruthy();
		expect(scenario.objective).toBeTruthy();
	});

	it.each(NEW_SCENARIO_IDS)('%s carries a flap detent in SIM_FLAP_NOTCHES', (id) => {
		const scenario = getScenario(id);
		expect(SIM_FLAP_NOTCHES).toContain(scenario.initial.flaps);
	});

	it('all four scenarios appear in SCENARIO_REGISTRY', () => {
		for (const id of NEW_SCENARIO_IDS) {
			expect(SCENARIO_REGISTRY[id]).toBeDefined();
		}
	});

	it('the four scenarios have unique recommendedOrder values', () => {
		const orders = NEW_SCENARIO_IDS.map((id) => getScenario(id).recommendedOrder);
		expect(new Set(orders).size).toBe(orders.length);
	});

	it('no recommendedOrder collisions across the entire registry', () => {
		const orders = listScenarios().map((s) => s.recommendedOrder);
		expect(new Set(orders).size).toBe(orders.length);
	});
});

describe('VFR scenarios -- grading authoring', () => {
	it.each(NEW_SCENARIO_IDS)('%s has grading weights summing to ~1.0', (id) => {
		const scenario = getScenario(id);
		expect(scenario.grading).toBeDefined();
		const grading = scenario.grading;
		if (!grading) throw new Error('grading missing');
		const sum = grading.components.reduce((acc, c) => acc + c.weight, 0);
		expect(Math.abs(sum - 1)).toBeLessThan(SIM_GRADING.WEIGHT_SUM_EPSILON);
	});

	it.each(NEW_SCENARIO_IDS)('%s grades a synthetic tape without throwing', (id) => {
		const scenario = getScenario(id);
		const grading = scenario.grading;
		if (!grading) throw new Error('grading missing');
		const tape = makeTape(scenario, 5);
		const report = evaluateGrading(grading, tape, { idealPath: scenario.idealPath });
		expect(report.total).toBeGreaterThanOrEqual(0);
		expect(report.total).toBeLessThanOrEqual(1);
		expect(report.components.length).toBe(grading.components.length);
	});
});
