/**
 * Hand-rolled FDM physics tests. Pure, DB-free, deterministic.
 *
 * Covers:
 * - Lift curve: linear below stall, peaks at alphaStall, drops smoothly above.
 * - Drag curve: induced drag grows with CL^2.
 * - 1G straight-and-level trim at cruise: net vertical acceleration ~0, AoA
 *   stays in a sensible band over a short integration window.
 * - Idle + nose-up elevator produces a stall (CL drops past crit AoA).
 * - Zero throttle at altitude produces a descent.
 * - Determinism: same inputs + initial state -> identical state trajectory.
 */

import { SIM_FDM_DT_SECONDS, SIM_GRAVITY_M_S2 } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import type { FdmInputs } from '../types';
import { C172_CONFIG } from './c172';
import { FdmEngine } from './engine';
import { dragCoefficient, liftCoefficient } from './physics';

const DEG = Math.PI / 180;

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
		// The linear-region slope should match cfg.liftSlope within a tight band.
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
		// Final floor must be at least clPostStall (monotonic-ish settling).
		expect(wellPast).toBeGreaterThanOrEqual(C172_CONFIG.clPostStall - 1e-6);
	});
});

describe('dragCoefficient', () => {
	it('is cd0 at zero lift', () => {
		expect(dragCoefficient(0, C172_CONFIG)).toBeCloseTo(C172_CONFIG.cd0, 6);
	});

	it('grows with CL^2', () => {
		const dragLow = dragCoefficient(0.4, C172_CONFIG);
		const dragHigh = dragCoefficient(1.2, C172_CONFIG);
		// Induced component should dominate the growth.
		expect(dragHigh).toBeGreaterThan(dragLow * 3);
	});
});

describe('1G trim at cruise', () => {
	it('holds roughly level over 5 seconds with trim elevator', () => {
		// Spawn at 2000 ft MSL, cruise speed, slight positive AoA near trim.
		const engine = new FdmEngine(C172_CONFIG, {
			altitude: 610,
			groundElevation: 0,
			u: 55, // ~107 KTAS
			w: 0,
			pitch: C172_CONFIG.trimAlpha,
			pitchRate: 0,
			throttle: 0.7,
			elevator: 0,
			onGround: false,
		});

		const initial = engine.snapshot();
		runFor(engine, 5);
		const final = engine.snapshot();

		// AoA stays in a normal cruise band (< stall, > negative).
		expect(final.alpha).toBeLessThan(C172_CONFIG.alphaStall);
		expect(final.alpha).toBeGreaterThan(-5 * DEG);

		// Load factor within a G of 1.0.
		expect(final.loadFactor).toBeGreaterThan(0.5);
		expect(final.loadFactor).toBeLessThan(1.6);

		// Vertical speed modest (no runaway climb or dive).
		expect(Math.abs(final.verticalSpeed)).toBeLessThan(10);

		// Altitude should stay in a 150 m band over 5 s with neutral elevator.
		expect(Math.abs(final.altitude - initial.altitude)).toBeLessThan(150);
	});

	it('produces lift ~= weight at trim AoA and cruise speed', () => {
		const engine = new FdmEngine(C172_CONFIG, {
			altitude: 610,
			groundElevation: 0,
			u: 55,
			w: 0,
			pitch: C172_CONFIG.trimAlpha,
			pitchRate: 0,
			throttle: 0.7,
			elevator: 0,
			onGround: false,
		});
		// Single-step so the state hasn't drifted.
		engine.step(SIM_FDM_DT_SECONDS);
		const snap = engine.snapshot();
		const weight = C172_CONFIG.mass * SIM_GRAVITY_M_S2;
		// Lift = cl * q * S, recover from loadFactor = lift/weight.
		const lift = snap.loadFactor * weight;
		// Within 40% of weight at trim AoA + cruise speed is acceptable for a
		// Phase 0 hand-rolled model; "perfect trim" would require a numeric
		// solver which we're not shipping.
		expect(lift).toBeGreaterThan(0.6 * weight);
		expect(lift).toBeLessThan(1.4 * weight);
	});
});

describe('stall onset', () => {
	it('idle + sustained nose-up elevator drives alpha past alphaStall', () => {
		const engine = new FdmEngine(C172_CONFIG, {
			altitude: 1000,
			groundElevation: 0,
			u: 32, // ~62 KIAS, already on the slow side
			w: 0,
			pitch: 5 * DEG,
			pitchRate: 0,
			throttle: 0.0,
			elevator: 1.0, // full back
			onGround: false,
		});

		runFor(engine, 6);
		const snap = engine.snapshot();
		expect(snap.stalled).toBe(true);
		// CL must be at or below clMax -- the whole point of the stall model.
		expect(snap.liftCoefficient).toBeLessThanOrEqual(C172_CONFIG.clMax + 1e-6);
	});
});

describe('idle cruise descends', () => {
	it('zero throttle at altitude yields negative vertical speed', () => {
		const engine = new FdmEngine(C172_CONFIG, {
			altitude: 1500,
			groundElevation: 0,
			u: 50,
			w: 0,
			pitch: C172_CONFIG.trimAlpha,
			pitchRate: 0,
			throttle: 0.0,
			elevator: 0,
			onGround: false,
		});
		runFor(engine, 10);
		const snap = engine.snapshot();
		expect(snap.verticalSpeed).toBeLessThan(0);
		// Not a brick: glide ratio should be reasonable -- losing altitude but
		// still flying.
		expect(snap.altitude).toBeGreaterThan(1000);
		expect(snap.stalled).toBe(false);
	});
});

describe('determinism', () => {
	it('produces identical trajectories for identical inputs', () => {
		function runSeq(): number[] {
			const engine = new FdmEngine(C172_CONFIG, {
				altitude: 500,
				groundElevation: 0,
				u: 40,
				w: 0,
				pitch: 5 * DEG,
				pitchRate: 0,
				throttle: 0.6,
				elevator: 0,
				onGround: false,
			});
			const samples: number[] = [];
			for (let i = 0; i < 600; i += 1) {
				// Scripted elevator sweep.
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
