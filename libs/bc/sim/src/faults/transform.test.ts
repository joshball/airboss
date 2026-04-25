/**
 * Pure tests for the fault model -- baseline identity, sticky activation
 * timing, alternator decay curve, and trigger-edge evaluation. Per-fault
 * rendering for the other instruments lands in the B5.* PRs which will
 * extend this file with their own per-fault tests.
 */

import {
	SIM_FAULT_KINDS,
	SIM_FAULT_TRIGGER_KINDS,
	SIM_FEET_PER_METER,
	SIM_FLAP_NOTCHES,
	SIM_KNOTS_PER_METER_PER_SECOND,
	SIM_METERS_PER_FOOT,
} from '@ab/constants';
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

describe('pitot block -- ASI behaves like an altimeter (B5.asi)', () => {
	function asiKiasAt(args: { blockedKias: number; blockAltFt: number; truthAltMsl: number }): number {
		const activation = activateFault(
			{
				kind: SIM_FAULT_KINDS.PITOT_BLOCK,
				trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 0 },
				params: {
					pitotBlockFreezeKias: args.blockedKias,
					staticBlockFreezeAltFt: args.blockAltFt,
				},
			},
			0,
		);
		const display = applyFaults({
			truth: makeTruth({ t: 30, altitude: args.truthAltMsl, onGround: false }),
			activations: [activation],
			nominalBusVolts: NOMINAL_VOLTS,
		});
		return display.indicatedAirspeed * SIM_KNOTS_PER_METER_PER_SECOND;
	}

	it('reads the block-time IAS at the block altitude', () => {
		const blockAltMsl = 3000 / SIM_FEET_PER_METER; // 3000 ft as meters
		expect(asiKiasAt({ blockedKias: 90, blockAltFt: 3000, truthAltMsl: blockAltMsl })).toBeCloseTo(90, 1);
	});

	it('reads HIGHER as the airplane climbs through the block', () => {
		// 1000 ft above block -> +20 KIAS at 0.02 KIAS/ft
		const truthAltMsl = 4000 / SIM_FEET_PER_METER;
		expect(asiKiasAt({ blockedKias: 90, blockAltFt: 3000, truthAltMsl })).toBeCloseTo(110, 0);
	});

	it('reads LOWER as the airplane descends through the block', () => {
		// 500 ft below block -> -10 KIAS
		const truthAltMsl = 2500 / SIM_FEET_PER_METER;
		expect(asiKiasAt({ blockedKias: 90, blockAltFt: 3000, truthAltMsl })).toBeCloseTo(80, 0);
	});

	it('clamps at zero rather than going negative on deep descent', () => {
		// Massive descent: -10000 ft delta -> -200 KIAS, clamped to 0.
		const truthAltMsl = -7000 / SIM_FEET_PER_METER;
		expect(asiKiasAt({ blockedKias: 90, blockAltFt: 3000, truthAltMsl })).toBe(0);
	});
});

describe('static block -- ASI sense reverses (B5.asi)', () => {
	function asiKiasAt(args: { truthKias: number; blockAltFt: number; truthAltMsl: number }): number {
		const activation = activateFault(
			{
				kind: SIM_FAULT_KINDS.STATIC_BLOCK,
				trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 0 },
				params: { staticBlockFreezeAltFt: args.blockAltFt },
			},
			0,
		);
		const truthMs = args.truthKias / SIM_KNOTS_PER_METER_PER_SECOND;
		const display = applyFaults({
			truth: makeTruth({
				t: 30,
				altitude: args.truthAltMsl,
				indicatedAirspeed: truthMs,
				onGround: false,
			}),
			activations: [activation],
			nominalBusVolts: NOMINAL_VOLTS,
		});
		return display.indicatedAirspeed * SIM_KNOTS_PER_METER_PER_SECOND;
	}

	it('reads truth IAS at the block altitude', () => {
		const blockAltMsl = 3000 / SIM_FEET_PER_METER;
		expect(asiKiasAt({ truthKias: 95, blockAltFt: 3000, truthAltMsl: blockAltMsl })).toBeCloseTo(95, 1);
	});

	it('reads HIGHER than truth on descent (sense reversed vs pitot)', () => {
		// 500 ft below block, truth 95 -> indicated 95 + 0.02*500 = 105
		const truthAltMsl = 2500 / SIM_FEET_PER_METER;
		expect(asiKiasAt({ truthKias: 95, blockAltFt: 3000, truthAltMsl })).toBeCloseTo(105, 0);
	});

	it('reads LOWER than truth on climb', () => {
		// 1000 ft above block -> 95 - 20 = 75
		const truthAltMsl = 4000 / SIM_FEET_PER_METER;
		expect(asiKiasAt({ truthKias: 95, blockAltFt: 3000, truthAltMsl })).toBeCloseTo(75, 0);
	});

	it('clamps at zero on extreme climb', () => {
		const truthAltMsl = 10000 / SIM_FEET_PER_METER;
		expect(asiKiasAt({ truthKias: 95, blockAltFt: 3000, truthAltMsl })).toBe(0);
	});
});

describe('vacuum failure -- AI pitch + roll drift (B5.ai)', () => {
	function aiAfter(args: { driftDegPerSec?: number; elapsedSec: number }) {
		const activation = activateFault(
			{
				kind: SIM_FAULT_KINDS.VACUUM_FAILURE,
				trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 0 },
				params: args.driftDegPerSec === undefined ? undefined : { vacuumDriftDegPerSec: args.driftDegPerSec },
			},
			0,
		);
		return applyFaults({
			truth: makeTruth({ t: args.elapsedSec, pitch: 0, roll: 0, onGround: false }),
			activations: [activation],
			nominalBusVolts: NOMINAL_VOLTS,
		});
	}

	it('reads truth at the moment of activation', () => {
		const display = aiAfter({ elapsedSec: 0 });
		expect(display.pitchIndicated).toBeCloseTo(0, 5);
		expect(display.rollIndicated).toBeCloseTo(0, 5);
	});

	it('drifts pitch nose-up at the configured rate', () => {
		// 30 sec at 1 deg/sec -> 30 deg
		const display = aiAfter({ elapsedSec: 30 });
		expect((display.pitchIndicated * 180) / Math.PI).toBeCloseTo(30, 1);
	});

	it('drifts roll at half the pitch rate', () => {
		const display = aiAfter({ elapsedSec: 30 });
		expect((display.rollIndicated * 180) / Math.PI).toBeCloseTo(15, 1);
	});

	it('respects scenario-overridden drift rate', () => {
		const display = aiAfter({ driftDegPerSec: 2.5, elapsedSec: 10 });
		expect((display.pitchIndicated * 180) / Math.PI).toBeCloseTo(25, 1);
	});

	it('adds the drift on top of truth pitch (does not zero it)', () => {
		const activation = activateFault(
			{
				kind: SIM_FAULT_KINDS.VACUUM_FAILURE,
				trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 0 },
			},
			0,
		);
		const display = applyFaults({
			truth: makeTruth({ t: 10, pitch: 0.1, roll: -0.05, onGround: false }),
			activations: [activation],
			nominalBusVolts: NOMINAL_VOLTS,
		});
		// 10 sec at 1 deg/sec = 0.1745 rad pitch drift; roll drift = 0.0873 rad.
		expect(display.pitchIndicated).toBeCloseTo(0.1 + (10 * Math.PI) / 180, 3);
		expect(display.rollIndicated).toBeCloseTo(-0.05 + (5 * Math.PI) / 180, 3);
	});
});

describe('gyro tumble -- AI pegs/cycles to limits (B5.ai)', () => {
	it('cycles pitch + roll out of phase when gyroTumbleContinues = true', () => {
		const activation = activateFault(
			{
				kind: SIM_FAULT_KINDS.GYRO_TUMBLE,
				trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 0 },
				params: { gyroTumbleContinues: true },
			},
			0,
		);
		// At t=0: phase=0 -> pitch=sin(0)=0, roll=cos(0)=1 (full deflection)
		const t0 = applyFaults({
			truth: makeTruth({ t: 0, onGround: false }),
			activations: [activation],
			nominalBusVolts: NOMINAL_VOLTS,
		});
		expect(t0.pitchIndicated).toBeCloseTo(0, 5);
		expect((t0.rollIndicated * 180) / Math.PI).toBeCloseTo(90, 1);

		// At t=1.5 (quarter period): phase=pi/2 -> pitch=1, roll=0
		const t1 = applyFaults({
			truth: makeTruth({ t: 1.5, onGround: false }),
			activations: [activation],
			nominalBusVolts: NOMINAL_VOLTS,
		});
		expect((t1.pitchIndicated * 180) / Math.PI).toBeCloseTo(90, 1);
		expect(t1.rollIndicated).toBeCloseTo(0, 2);
	});

	it('freezes at limits when gyroTumbleContinues = false', () => {
		const activation = activateFault(
			{
				kind: SIM_FAULT_KINDS.GYRO_TUMBLE,
				trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 0 },
				params: { gyroTumbleContinues: false },
			},
			0,
		);
		const display = applyFaults({
			truth: makeTruth({ t: 30, pitch: 0.5, roll: -0.3, onGround: false }),
			activations: [activation],
			nominalBusVolts: NOMINAL_VOLTS,
		});
		expect((display.pitchIndicated * 180) / Math.PI).toBeCloseTo(90, 1);
		expect((display.rollIndicated * 180) / Math.PI).toBeCloseTo(-90, 1);
	});

	it('overrides truth attitude entirely once tumbled', () => {
		const activation = activateFault(
			{
				kind: SIM_FAULT_KINDS.GYRO_TUMBLE,
				trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 0 },
				params: { gyroTumbleContinues: false },
			},
			0,
		);
		// Truth shows level flight; tumble pegs anyway.
		const display = applyFaults({
			truth: makeTruth({ t: 5, pitch: 0, roll: 0, onGround: false }),
			activations: [activation],
			nominalBusVolts: NOMINAL_VOLTS,
		});
		expect(Math.abs(display.pitchIndicated)).toBeGreaterThan(1);
		expect(Math.abs(display.rollIndicated)).toBeGreaterThan(1);
	});
});

describe('vacuum failure -- HI heading drift (B5.hi)', () => {
	function hiAfter(args: { driftDegPerSec?: number; elapsedSec: number; truthHeadingRad?: number }) {
		const activation = activateFault(
			{
				kind: SIM_FAULT_KINDS.VACUUM_FAILURE,
				trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 0 },
				params: args.driftDegPerSec === undefined ? undefined : { vacuumDriftDegPerSec: args.driftDegPerSec },
			},
			0,
		);
		return applyFaults({
			truth: makeTruth({
				t: args.elapsedSec,
				heading: args.truthHeadingRad ?? 0,
				onGround: false,
			}),
			activations: [activation],
			nominalBusVolts: NOMINAL_VOLTS,
		});
	}

	it('reads truth heading at activation', () => {
		const display = hiAfter({ elapsedSec: 0, truthHeadingRad: 1.5 });
		expect(display.headingIndicated).toBeCloseTo(1.5, 5);
	});

	it('drifts heading left (negative) as the gyro spools down', () => {
		// 30 sec at 1 deg/sec -> -30 deg from truth
		const display = hiAfter({ elapsedSec: 30 });
		expect((display.headingIndicated * 180) / Math.PI).toBeCloseTo(-30, 1);
	});

	it('drifts at the same rate as pitch (gyro is shared spool)', () => {
		const display = hiAfter({ elapsedSec: 20 });
		const pitchDeg = (display.pitchIndicated * 180) / Math.PI;
		const headingDriftDeg = -((display.headingIndicated * 180) / Math.PI);
		expect(pitchDeg).toBeCloseTo(headingDriftDeg, 1);
	});

	it('respects scenario-overridden drift rate', () => {
		const display = hiAfter({ driftDegPerSec: 2.5, elapsedSec: 10 });
		expect((display.headingIndicated * 180) / Math.PI).toBeCloseTo(-25, 1);
	});
});

describe('gyro tumble -- HI spins or freezes (B5.hi)', () => {
	it('spins heading through 0..2pi when gyroTumbleContinues = true', () => {
		const activation = activateFault(
			{
				kind: SIM_FAULT_KINDS.GYRO_TUMBLE,
				trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 0 },
				params: { gyroTumbleContinues: true },
			},
			0,
		);
		// At t=0 phase=0 -> heading=0
		const t0 = applyFaults({
			truth: makeTruth({ t: 0, heading: 1.5, onGround: false }),
			activations: [activation],
			nominalBusVolts: NOMINAL_VOLTS,
		});
		expect(t0.headingIndicated).toBeCloseTo(0, 5);

		// At t=3 (half period): phase=pi -> heading=pi
		const t1 = applyFaults({
			truth: makeTruth({ t: 3, heading: 1.5, onGround: false }),
			activations: [activation],
			nominalBusVolts: NOMINAL_VOLTS,
		});
		expect(t1.headingIndicated).toBeCloseTo(Math.PI, 3);
	});

	it('freezes HI at last-indicated heading when gyroTumbleContinues = false', () => {
		const activation = activateFault(
			{
				kind: SIM_FAULT_KINDS.GYRO_TUMBLE,
				trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 0 },
				params: { gyroTumbleContinues: false },
			},
			0,
		);
		const display = applyFaults({
			truth: makeTruth({ t: 30, heading: 2.0, onGround: false }),
			activations: [activation],
			nominalBusVolts: NOMINAL_VOLTS,
		});
		// Heading is whatever the prior layers wrote; vacuum is not active
		// here so it's truth (2.0) propagated through the baseline.
		expect(display.headingIndicated).toBeCloseTo(2.0, 5);
	});
});

describe('applyFaults -- multi-fault composition', () => {
	it('composes alternator + vacuum: bus volts decay AND AI drifts', () => {
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
		// Both effects survive -- alternator decays bus volts to half,
		// vacuum drifts pitch by 30 deg after 30 sec at default 1 deg/sec.
		expect(display.electricBusVolts).toBeCloseTo(NOMINAL_VOLTS / 2, 5);
		expect((display.pitchIndicated * 180) / Math.PI).toBeCloseTo(30, 1);
	});
});
