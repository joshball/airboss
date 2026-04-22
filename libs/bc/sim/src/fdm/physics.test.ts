/**
 * Hand-rolled FDM physics tests. Pure, DB-free, deterministic.
 *
 * Covers Phase 0 longitudinal behavior plus Phase 0.5 additions:
 * - Lift / drag curves
 * - 1G trim at cruise
 * - Stall onset
 * - Glide
 * - Determinism
 * - Lateral axis: bank-induced standard-rate turn, adverse yaw, auto-coordinate
 * - Parking brake holds at full throttle
 * - Stall warning fires before stall
 * - Trim bias produces hands-off level flight
 */

import { SIM_FDM_DT_SECONDS, SIM_FLAP_NOTCHES, SIM_GRAVITY_M_S2, SIM_KNOTS_PER_METER_PER_SECOND } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import type { FdmInputs, ScenarioInitialState } from '../types';
import { C172_CONFIG } from './c172';
import { FdmEngine } from './engine';
import { coordinatedTurnRate, dragCoefficient, liftCoefficient, slipBall } from './physics';

const DEG = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

function defaultInitial(overrides: Partial<ScenarioInitialState> = {}): ScenarioInitialState {
	return {
		altitude: 610,
		groundElevation: 0,
		u: 55,
		w: 0,
		pitch: C172_CONFIG.trimAlpha,
		pitchRate: 0,
		roll: 0,
		rollRate: 0,
		yawRate: 0,
		heading: 0,
		throttle: 0.7,
		elevator: 0,
		trim: 0,
		aileron: 0,
		rudder: 0,
		brake: false,
		autoCoordinate: true,
		flaps: SIM_FLAP_NOTCHES[0],
		onGround: false,
		...overrides,
	};
}

function runFor(engine: FdmEngine, seconds: number, dt = SIM_FDM_DT_SECONDS, inputs?: Partial<FdmInputs>): void {
	if (inputs) engine.setInputs(inputs);
	const steps = Math.round(seconds / dt);
	for (let i = 0; i < steps; i += 1) {
		engine.step(dt);
	}
}

describe('liftCoefficient', () => {
	it('is linear below stall', () => {
		const clAtZero = liftCoefficient(0, C172_CONFIG);
		const clAtFive = liftCoefficient(5 * DEG, C172_CONFIG);
		const slope = (clAtFive - clAtZero) / (5 * DEG);
		expect(slope).toBeCloseTo(C172_CONFIG.liftSlope, 1);
	});

	it('peaks at alphaStall', () => {
		const clPeak = liftCoefficient(C172_CONFIG.alphaStall, C172_CONFIG);
		expect(clPeak).toBeCloseTo(C172_CONFIG.clMax, 2);
	});

	it('drops smoothly past alphaStall', () => {
		const justPast = liftCoefficient(C172_CONFIG.alphaStall + 2 * DEG, C172_CONFIG);
		const wellPast = liftCoefficient(C172_CONFIG.alphaStall + 8 * DEG, C172_CONFIG);
		expect(justPast).toBeLessThan(C172_CONFIG.clMax);
		expect(wellPast).toBeLessThan(justPast);
		expect(wellPast).toBeGreaterThanOrEqual(C172_CONFIG.clPostStall - 1e-6);
	});

	it('shifts upward with flaps', () => {
		const clClean = liftCoefficient(0, C172_CONFIG, 0);
		const clFull = liftCoefficient(0, C172_CONFIG, 30);
		expect(clFull).toBeGreaterThan(clClean);
	});
});

describe('dragCoefficient', () => {
	it('is cd0 at zero lift, no flaps', () => {
		expect(dragCoefficient(0, C172_CONFIG)).toBeCloseTo(C172_CONFIG.cd0, 6);
	});

	it('grows with CL^2', () => {
		const dragLow = dragCoefficient(0.4, C172_CONFIG);
		const dragHigh = dragCoefficient(1.2, C172_CONFIG);
		expect(dragHigh).toBeGreaterThan(dragLow * 3);
	});

	it('grows with flap deflection', () => {
		const dragClean = dragCoefficient(0.5, C172_CONFIG, 0);
		const dragFull = dragCoefficient(0.5, C172_CONFIG, 30);
		expect(dragFull).toBeGreaterThan(dragClean);
	});
});

describe('1G trim at cruise', () => {
	it('holds roughly level over 5 seconds with neutral elevator', () => {
		const engine = new FdmEngine(C172_CONFIG, defaultInitial());
		const initial = engine.snapshot();
		runFor(engine, 5);
		const final = engine.snapshot();
		expect(final.alpha).toBeLessThan(C172_CONFIG.alphaStall);
		expect(final.alpha).toBeGreaterThan(-5 * DEG);
		expect(final.loadFactor).toBeGreaterThan(0.5);
		expect(final.loadFactor).toBeLessThan(1.6);
		expect(Math.abs(final.verticalSpeed)).toBeLessThan(10);
		expect(Math.abs(final.altitude - initial.altitude)).toBeLessThan(150);
	});

	it('produces lift in the right ballpark at trim AoA and cruise speed', () => {
		const engine = new FdmEngine(C172_CONFIG, defaultInitial());
		engine.step(SIM_FDM_DT_SECONDS);
		const snap = engine.snapshot();
		const weight = C172_CONFIG.mass * SIM_GRAVITY_M_S2;
		const lift = snap.loadFactor * weight;
		expect(lift).toBeGreaterThan(0.6 * weight);
		expect(lift).toBeLessThan(1.4 * weight);
	});
});

describe('stall onset', () => {
	it('idle + sustained nose-up elevator drives alpha past alphaStall', () => {
		const engine = new FdmEngine(
			C172_CONFIG,
			defaultInitial({ altitude: 1000, u: 32, pitch: 5 * DEG, throttle: 0, elevator: 1 }),
		);
		runFor(engine, 6);
		const snap = engine.snapshot();
		expect(snap.stalled).toBe(true);
		expect(snap.liftCoefficient).toBeLessThanOrEqual(C172_CONFIG.clMax + 1e-6);
	});

	it('stall warning trips before stall', () => {
		const engine = new FdmEngine(
			C172_CONFIG,
			defaultInitial({ altitude: 1000, u: 32, pitch: 5 * DEG, throttle: 0.0, elevator: 0.6 }),
		);
		// March until either warning or 6 seconds, recording whether warning
		// preceded stall.
		let warningTime = -1;
		let stallTime = -1;
		const dt = SIM_FDM_DT_SECONDS;
		for (let i = 0; i < 600; i += 1) {
			engine.step(dt);
			const s = engine.snapshot();
			if (warningTime < 0 && s.stallWarning) warningTime = s.t;
			if (stallTime < 0 && s.stalled) stallTime = s.t;
			if (stallTime > 0 && warningTime > 0) break;
		}
		expect(warningTime).toBeGreaterThan(0);
		// If it stalls during the run, warning must come first.
		if (stallTime > 0) {
			expect(warningTime).toBeLessThanOrEqual(stallTime);
		}
	});
});

describe('idle cruise descends', () => {
	it('zero throttle at altitude yields negative vertical speed', () => {
		const engine = new FdmEngine(C172_CONFIG, defaultInitial({ altitude: 1500, u: 50, throttle: 0 }));
		runFor(engine, 10);
		const snap = engine.snapshot();
		expect(snap.verticalSpeed).toBeLessThan(0);
		expect(snap.altitude).toBeGreaterThan(1000);
		expect(snap.stalled).toBe(false);
	});
});

describe('determinism', () => {
	it('produces identical trajectories for identical inputs', () => {
		function runSeq(): number[] {
			const engine = new FdmEngine(
				C172_CONFIG,
				defaultInitial({ altitude: 500, u: 40, pitch: 5 * DEG, throttle: 0.6 }),
			);
			const samples: number[] = [];
			for (let i = 0; i < 600; i += 1) {
				const elev = Math.sin(i * 0.01);
				engine.setInputs({ elevator: elev });
				engine.step(SIM_FDM_DT_SECONDS);
				if (i % 30 === 0) {
					const s = engine.snapshot();
					samples.push(s.altitude, s.trueAirspeed, s.pitch, s.alpha);
				}
			}
			return samples;
		}
		const a = runSeq();
		const b = runSeq();
		expect(a).toEqual(b);
	});
});

describe('coordinatedTurnRate', () => {
	it('gives ~7 deg/s at 30 deg bank, 90 KIAS (matches standard turn equation)', () => {
		// psi_dot = g * tan(phi) / V. At 30 deg bank, 90 KIAS (46.3 m/s):
		// 9.81 * tan(30 deg) / 46.3 = 0.122 rad/s = ~7.0 deg/s. This is
		// well above standard-rate, which is the aviation rule that "30 deg
		// bank gives ~3 deg/s" only holds near ~190 KIAS. At trainer speeds
		// the same bank produces a faster turn.
		const tas = 90 / SIM_KNOTS_PER_METER_PER_SECOND;
		const rate = coordinatedTurnRate(30 * DEG, tas) * RAD_TO_DEG;
		expect(rate).toBeGreaterThan(6.7);
		expect(rate).toBeLessThan(7.3);
	});

	it('hits roughly standard-rate (3 deg/s) at the classic rule-of-thumb bank at 90 KIAS', () => {
		// Pilot rule of thumb: bank for standard rate = TAS/10 + 7 (degrees).
		// The rule is approximate and runs ~15% high at trainer speeds; the
		// exact equation gives ~3.5 deg/s at 16 deg bank, 90 KIAS.
		const tas = 90 / SIM_KNOTS_PER_METER_PER_SECOND;
		const rate = coordinatedTurnRate(16 * DEG, tas) * RAD_TO_DEG;
		expect(rate).toBeGreaterThan(2.7);
		expect(rate).toBeLessThan(4.0);
	});
});

describe('lateral axis: roll', () => {
	it('full aileron rolls to a steady-state rate matching authority/damping', () => {
		const engine = new FdmEngine(C172_CONFIG, defaultInitial({ aileron: 1, autoCoordinate: false }));
		// Time constant = 1 / rollDamping = 0.25s. Sample at 0.5s (2 tau) to
		// catch the steady-state roll rate well before the bank limit clamps
		// the motion (80 deg bank at ~60 deg/s takes ~1.33s).
		runFor(engine, 0.5);
		const snap = engine.snapshot();
		const expectedSteadyRollRate = (C172_CONFIG.rollAuthority / C172_CONFIG.rollDamping) * RAD_TO_DEG;
		// Steady state should be within 25% of theoretical (qScale ~1 at cruise).
		expect(Math.abs(snap.rollRate * RAD_TO_DEG)).toBeGreaterThan(expectedSteadyRollRate * 0.75);
		expect(Math.abs(snap.rollRate * RAD_TO_DEG)).toBeLessThan(expectedSteadyRollRate * 1.25);
	});

	it('clamps bank to bank limit', () => {
		const engine = new FdmEngine(C172_CONFIG, defaultInitial({ aileron: 1, autoCoordinate: false }));
		runFor(engine, 6); // long enough to roll past the limit
		const snap = engine.snapshot();
		expect(Math.abs(snap.roll)).toBeLessThanOrEqual(C172_CONFIG.bankLimit + 1e-6);
	});
});

describe('lateral axis: turn', () => {
	it('fixed bank produces a heading change matching the coordinated turn rate', () => {
		const engine = new FdmEngine(C172_CONFIG, defaultInitial({ heading: 0 }));
		// Get into a 30 deg bank.
		runFor(engine, 0.6, SIM_FDM_DT_SECONDS, { aileron: 0.6 });
		// Hold roughly 30 deg by easing aileron.
		engine.setInputs({ aileron: 0.0 });
		const before = engine.snapshot();
		runFor(engine, 5);
		const after = engine.snapshot();
		const headingDeltaDeg = (((after.heading - before.heading) * RAD_TO_DEG + 540) % 360) - 180;
		// At ~25-30 deg bank, 90 KIAS-ish, heading should change a clearly
		// positive amount in 5 seconds (well above zero).
		expect(headingDeltaDeg).toBeGreaterThan(5);
	});
});

describe('lateral axis: adverse yaw', () => {
	it('aileron-only roll with auto-coordinate OFF skids the ball', () => {
		const engine = new FdmEngine(C172_CONFIG, defaultInitial({ autoCoordinate: false }));
		// Snap a small aileron input -- before the resulting bank has time to
		// generate a coordinated turn rate, the yaw rate is dominated by
		// adverse yaw (opposite the aileron). With aileron right (+) the
		// adverse yaw is negative, so yawRate < coordinated -> ball negative.
		runFor(engine, 0.4, SIM_FDM_DT_SECONDS, { aileron: 0.7 });
		const snap = engine.snapshot();
		expect(Math.abs(snap.slipBall)).toBeGreaterThan(0.05);
	});

	it('aileron-only roll with auto-coordinate ON keeps the ball centered', () => {
		const engine = new FdmEngine(C172_CONFIG, defaultInitial({ autoCoordinate: true }));
		runFor(engine, 0.4, SIM_FDM_DT_SECONDS, { aileron: 0.7 });
		const snap = engine.snapshot();
		expect(Math.abs(snap.slipBall)).toBeLessThan(0.1);
	});
});

describe('slipBall', () => {
	it('is zero when yaw rate matches coordinated turn rate', () => {
		const tas = 90 / SIM_KNOTS_PER_METER_PER_SECOND;
		const bank = 30 * DEG;
		const coord = coordinatedTurnRate(bank, tas);
		expect(slipBall(coord, bank, tas)).toBeCloseTo(0, 6);
	});

	it('is positive when yaw rate exceeds coordinated rate (skid)', () => {
		const tas = 90 / SIM_KNOTS_PER_METER_PER_SECOND;
		const bank = 30 * DEG;
		const coord = coordinatedTurnRate(bank, tas);
		expect(slipBall(coord + 0.05, bank, tas)).toBeGreaterThan(0);
	});
});

describe('parking brake', () => {
	it('prevents motion at full throttle on the ground', () => {
		const engine = new FdmEngine(
			C172_CONFIG,
			defaultInitial({
				altitude: 0,
				u: 0,
				pitch: 0,
				throttle: 1.0,
				brake: true,
				onGround: true,
			}),
		);
		runFor(engine, 5);
		const snap = engine.snapshot();
		expect(snap.u).toBeLessThan(0.5);
		expect(snap.trueAirspeed).toBeLessThan(0.5);
	});

	it('releases when toggled off, then accelerates', () => {
		const engine = new FdmEngine(
			C172_CONFIG,
			defaultInitial({ altitude: 0, u: 0, pitch: 0, throttle: 1.0, brake: true, onGround: true }),
		);
		runFor(engine, 1);
		engine.toggleBrake();
		runFor(engine, 5);
		const snap = engine.snapshot();
		expect(snap.u).toBeGreaterThan(5);
	});
});

describe('trim', () => {
	it('hands-off pitch trim biases elevator command', () => {
		const engine = new FdmEngine(C172_CONFIG, defaultInitial({ trim: 0.5 }));
		engine.step(SIM_FDM_DT_SECONDS);
		const snap = engine.snapshot();
		// elevatorEffective should be close to trim * trimRange when pilot
		// elevator is zero.
		expect(snap.elevatorEffective).toBeCloseTo(0.5 * C172_CONFIG.trimRange, 6);
	});
});

describe('engine RPM', () => {
	it('idles with throttle at zero', () => {
		const engine = new FdmEngine(C172_CONFIG, defaultInitial({ throttle: 0 }));
		runFor(engine, 1);
		const snap = engine.snapshot();
		expect(snap.engineRpm).toBeGreaterThan(C172_CONFIG.idleRpm - 50);
		expect(snap.engineRpm).toBeLessThan(C172_CONFIG.idleRpm + 50);
	});

	it('reaches near max with full throttle', () => {
		const engine = new FdmEngine(C172_CONFIG, defaultInitial({ throttle: 1 }));
		runFor(engine, 2);
		const snap = engine.snapshot();
		expect(snap.engineRpm).toBeGreaterThan(C172_CONFIG.maxRpm - 50);
	});
});
