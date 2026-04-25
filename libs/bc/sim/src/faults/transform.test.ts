/**
 * Pure tests for the fault model -- baseline identity, sticky activation
 * timing, alternator decay curve, and trigger-edge evaluation. Per-fault
 * rendering for the other instruments lands in the B5.* PRs which will
 * extend this file with their own per-fault tests.
 */

import { SIM_FAULT_KINDS, SIM_FAULT_TRIGGER_KINDS, SIM_FLAP_NOTCHES, SIM_METERS_PER_FOOT } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import type { FdmTruthState } from '../types';
import { activateFault, applyFaults } from './transform';
import { shouldTriggerFault } from './triggers';
import type { FaultActivation, ScenarioFault } from './types';

const NOMINAL_VOLTS = 28;

function makeTruth(overrides: Partial<FdmTruthState> = {}): FdmTruthState {
	return {
		t: 0,
		x: 0,
		altitude: 305,
		groundElevation: 305,
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
		loadFactor: 1,
		slipBall: 0,
		onGround: true,
		brakeOn: false,
		stallWarning: false,
		stalled: false,
		flapsDegrees: SIM_FLAP_NOTCHES[0],
		elevatorEffective: 0,
		engineRpm: 800,
		...overrides,
	};
}

describe('applyFaults -- baseline identity', () => {
	it('returns a truth-faithful display when no faults are active', () => {
		const truth = makeTruth({
			t: 5,
			altitude: 1000,
			indicatedAirspeed: 30,
			pitch: 0.1,
			roll: -0.05,
			heading: 1.5,
			engineRpm: 2200,
		});
		const display = applyFaults({ truth, activations: [], nominalBusVolts: NOMINAL_VOLTS });
		expect(display.altitudeMsl).toBe(1000);
		expect(display.indicatedAirspeed).toBe(30);
		expect(display.pitchIndicated).toBe(0.1);
		expect(display.rollIndicated).toBe(-0.05);
		expect(display.headingIndicated).toBe(1.5);
		expect(display.engineRpm).toBe(2200);
		expect(display.electricBusVolts).toBe(NOMINAL_VOLTS);
		expect(display.t).toBe(5);
	});
});

describe('activateFault -- defaults merging', () => {
	it('fills in vacuum drift default when not overridden', () => {
		const fault: ScenarioFault = {
			kind: SIM_FAULT_KINDS.VACUUM_FAILURE,
			trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 60 },
		};
		const activation = activateFault(fault, 60);
		expect(activation.params.vacuumDriftDegPerSec).toBe(1.0);
	});

	it('respects scenario override', () => {
		const fault: ScenarioFault = {
			kind: SIM_FAULT_KINDS.VACUUM_FAILURE,
			trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 60 },
			params: { vacuumDriftDegPerSec: 2.5 },
		};
		const activation = activateFault(fault, 60);
		expect(activation.params.vacuumDriftDegPerSec).toBe(2.5);
	});

	it('records the firedAt time for downstream drift math', () => {
		const fault: ScenarioFault = {
			kind: SIM_FAULT_KINDS.VACUUM_FAILURE,
			trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 60 },
		};
		const activation = activateFault(fault, 73.5);
		expect(activation.firedAtT).toBe(73.5);
	});
});

describe('alternator failure -- bus voltage decay', () => {
	const baseFault: ScenarioFault = {
		kind: SIM_FAULT_KINDS.ALTERNATOR_FAILURE,
		trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 0 },
	};

	function busAfter(elapsedSec: number, decaySec = 60): number {
		const activation: FaultActivation = activateFault(
			{ ...baseFault, params: { alternatorDecaySeconds: decaySec } },
			0,
		);
		const display = applyFaults({
			truth: makeTruth({ t: elapsedSec }),
			activations: [activation],
			nominalBusVolts: NOMINAL_VOLTS,
		});
		return display.electricBusVolts;
	}

	it('reads nominal voltage at the moment of activation', () => {
		expect(busAfter(0)).toBeCloseTo(NOMINAL_VOLTS, 5);
	});

	it('decays linearly across the configured window', () => {
		expect(busAfter(30)).toBeCloseTo(NOMINAL_VOLTS / 2, 5);
		expect(busAfter(45)).toBeCloseTo(NOMINAL_VOLTS / 4, 5);
	});

	it('clamps at zero past the decay window', () => {
		expect(busAfter(60)).toBe(0);
		expect(busAfter(120)).toBe(0);
	});

	it('respects per-fault decay overrides', () => {
		expect(busAfter(15, 30)).toBeCloseTo(NOMINAL_VOLTS / 2, 5);
	});
});

describe('static block -- altimeter freeze (B5.alt)', () => {
	function frozenDisplay(args: { freezeAltFt: number; truthAltMsl: number }) {
		const activation = activateFault(
			{
				kind: SIM_FAULT_KINDS.STATIC_BLOCK,
				trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 0 },
				params: { staticBlockFreezeAltFt: args.freezeAltFt },
			},
			0,
		);
		return applyFaults({
			truth: makeTruth({ t: 30, altitude: args.truthAltMsl, onGround: false }),
			activations: [activation],
			nominalBusVolts: NOMINAL_VOLTS,
		});
	}

	it('freezes altitude at the block altitude regardless of true altitude', () => {
		const display = frozenDisplay({ freezeAltFt: 3000, truthAltMsl: 2000 });
		expect(display.altitudeMsl).toBeCloseTo(3000 * SIM_METERS_PER_FOOT, 4);
	});

	it('keeps the same indicated altitude when truth climbs through it', () => {
		const climbing = frozenDisplay({ freezeAltFt: 3000, truthAltMsl: 4500 });
		expect(climbing.altitudeMsl).toBeCloseTo(3000 * SIM_METERS_PER_FOOT, 4);
	});

	it('keeps the same indicated altitude when truth descends through it', () => {
		const descending = frozenDisplay({ freezeAltFt: 3000, truthAltMsl: 1500 });
		expect(descending.altitudeMsl).toBeCloseTo(3000 * SIM_METERS_PER_FOOT, 4);
	});

	it('does not affect other display fields (pitch, roll, RPM, alpha)', () => {
		const activation = activateFault(
			{
				kind: SIM_FAULT_KINDS.STATIC_BLOCK,
				trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 0 },
				params: { staticBlockFreezeAltFt: 1000 },
			},
			0,
		);
		const display = applyFaults({
			truth: makeTruth({
				t: 30,
				altitude: 2000,
				pitch: 0.1,
				roll: -0.05,
				heading: 1.5,
				engineRpm: 2200,
				alpha: 0.08,
			}),
			activations: [activation],
			nominalBusVolts: NOMINAL_VOLTS,
		});
		expect(display.pitchIndicated).toBe(0.1);
		expect(display.rollIndicated).toBe(-0.05);
		expect(display.headingIndicated).toBe(1.5);
		expect(display.engineRpm).toBe(2200);
		expect(display.alpha).toBe(0.08);
	});

	it('uses default freeze altitude (0 ft MSL) when scenario does not override', () => {
		const activation = activateFault(
			{
				kind: SIM_FAULT_KINDS.STATIC_BLOCK,
				trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 0 },
			},
			0,
		);
		const display = applyFaults({
			truth: makeTruth({ t: 30, altitude: 1500, onGround: false }),
			activations: [activation],
			nominalBusVolts: NOMINAL_VOLTS,
		});
		expect(display.altitudeMsl).toBe(0);
	});
});

describe('static block -- VSI reads zero (B5.vsi)', () => {
	function vsiAfter(args: { truthVsiMs: number; truthAltMsl: number }): number {
		const activation = activateFault(
			{
				kind: SIM_FAULT_KINDS.STATIC_BLOCK,
				trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 0 },
				params: { staticBlockFreezeAltFt: 3000 },
			},
			0,
		);
		const display = applyFaults({
			truth: makeTruth({
				t: 30,
				altitude: args.truthAltMsl,
				verticalSpeed: args.truthVsiMs,
				onGround: false,
			}),
			activations: [activation],
			nominalBusVolts: NOMINAL_VOLTS,
		});
		return display.verticalSpeed;
	}

	it('reads zero in steady-level flight', () => {
		expect(vsiAfter({ truthVsiMs: 0, truthAltMsl: 914 })).toBe(0);
	});

	it('reads zero during climb (port saw no change)', () => {
		expect(vsiAfter({ truthVsiMs: 5, truthAltMsl: 1500 })).toBe(0);
	});

	it('reads zero during descent', () => {
		expect(vsiAfter({ truthVsiMs: -3, truthAltMsl: 600 })).toBe(0);
	});

	it('does not affect VSI when static block is not active', () => {
		const display = applyFaults({
			truth: makeTruth({ t: 30, altitude: 914, verticalSpeed: 5, onGround: false }),
			activations: [],
			nominalBusVolts: NOMINAL_VOLTS,
		});
		expect(display.verticalSpeed).toBe(5);
	});
});

describe('shouldTriggerFault -- time-based', () => {
	const fault: ScenarioFault = {
		kind: SIM_FAULT_KINDS.VACUUM_FAILURE,
		trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 60 },
	};

	it('does not fire before the time threshold', () => {
		const fired = shouldTriggerFault(fault, {
			prev: makeTruth({ t: 50 }),
			curr: makeTruth({ t: 55 }),
			prevStepId: null,
			currStepId: null,
		});
		expect(fired).toBe(false);
	});

	it('fires on the tick that crosses the threshold', () => {
		const fired = shouldTriggerFault(fault, {
			prev: makeTruth({ t: 59.9 }),
			curr: makeTruth({ t: 60.1 }),
			prevStepId: null,
			currStepId: null,
		});
		expect(fired).toBe(true);
	});

	it('does not re-fire on subsequent ticks', () => {
		const fired = shouldTriggerFault(fault, {
			prev: makeTruth({ t: 60.5 }),
			curr: makeTruth({ t: 60.6 }),
			prevStepId: null,
			currStepId: null,
		});
		expect(fired).toBe(false);
	});

	it('fires on the first tick when prev is null and threshold already passed', () => {
		const fired = shouldTriggerFault(fault, {
			prev: null,
			curr: makeTruth({ t: 65 }),
			prevStepId: null,
			currStepId: null,
		});
		expect(fired).toBe(true);
	});
});

describe('shouldTriggerFault -- altitude-based', () => {
	const fault: ScenarioFault = {
		kind: SIM_FAULT_KINDS.GYRO_TUMBLE,
		trigger: { kind: SIM_FAULT_TRIGGER_KINDS.ALTITUDE_AGL_METERS, above: 152 },
	};

	it('fires on the upward crossing', () => {
		const fired = shouldTriggerFault(fault, {
			prev: makeTruth({ altitude: 305 + 100, groundElevation: 305 }),
			curr: makeTruth({ altitude: 305 + 200, groundElevation: 305 }),
			prevStepId: null,
			currStepId: null,
		});
		expect(fired).toBe(true);
	});

	it('does not re-fire on later descent through the threshold', () => {
		const fired = shouldTriggerFault(fault, {
			prev: makeTruth({ altitude: 305 + 200, groundElevation: 305 }),
			curr: makeTruth({ altitude: 305 + 100, groundElevation: 305 }),
			prevStepId: null,
			currStepId: null,
		});
		expect(fired).toBe(false);
	});
});

describe('shouldTriggerFault -- step-based', () => {
	const fault: ScenarioFault = {
		kind: SIM_FAULT_KINDS.PITOT_BLOCK,
		trigger: { kind: SIM_FAULT_TRIGGER_KINDS.ON_STEP, stepId: 'climb-out' },
	};

	it('fires on the tick the runner advances onto the named step', () => {
		const fired = shouldTriggerFault(fault, {
			prev: makeTruth(),
			curr: makeTruth(),
			prevStepId: 'takeoff',
			currStepId: 'climb-out',
		});
		expect(fired).toBe(true);
	});

	it('does not fire while staying on the named step', () => {
		const fired = shouldTriggerFault(fault, {
			prev: makeTruth(),
			curr: makeTruth(),
			prevStepId: 'climb-out',
			currStepId: 'climb-out',
		});
		expect(fired).toBe(false);
	});
});

describe('applyFaults -- multi-fault composition', () => {
	it('composes alternator + vacuum without losing either', () => {
		const truth = makeTruth({ t: 30 });
		const alternator = activateFault(
			{
				kind: SIM_FAULT_KINDS.ALTERNATOR_FAILURE,
				trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 0 },
			},
			0,
		);
		const vacuum = activateFault(
			{
				kind: SIM_FAULT_KINDS.VACUUM_FAILURE,
				trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 0 },
			},
			0,
		);
		const display = applyFaults({
			truth,
			activations: [alternator, vacuum],
			nominalBusVolts: NOMINAL_VOLTS,
		});
		// Alternator decay is the only behavior wired in Phase 3; vacuum
		// is identity until B5.{ai,hi} fan-out. So the multi-fault
		// composition test verifies the alternator math survives the
		// presence of a vacuum activation.
		expect(display.electricBusVolts).toBeCloseTo(NOMINAL_VOLTS / 2, 5);
	});
});
