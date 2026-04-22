import { SIM_ENGINE_SOUND, SIM_SEA_LEVEL_DENSITY_KG_M3 } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import {
	dynamicPressurePa,
	engineFundamentalHz,
	noiseGainTarget,
	strainDetuneCents,
	strainFactor,
	throttleGainTarget,
} from './audio-mapping';

describe('engineFundamentalHz', () => {
	it('returns base frequency at idle RPM', () => {
		const idleRpm = 700;
		expect(engineFundamentalHz(idleRpm, idleRpm)).toBeCloseTo(SIM_ENGINE_SOUND.BASE_FREQ_HZ, 5);
	});

	it('scales with RPM ratio above idle', () => {
		const idleRpm = 700;
		const max = 2400;
		const f = engineFundamentalHz(max, idleRpm);
		expect(f).toBeCloseTo(SIM_ENGINE_SOUND.BASE_FREQ_HZ * (max / idleRpm), 3);
	});

	it('clamps to a minimum ratio of 0.5 below half-idle', () => {
		const idleRpm = 700;
		const f = engineFundamentalHz(100, idleRpm);
		expect(f).toBeCloseTo(SIM_ENGINE_SOUND.BASE_FREQ_HZ * 0.5, 3);
	});

	it('falls back to base frequency when idle is zero', () => {
		expect(engineFundamentalHz(2400, 0)).toBe(SIM_ENGINE_SOUND.BASE_FREQ_HZ);
	});
});

describe('strainFactor', () => {
	const throttleHi = SIM_ENGINE_SOUND.STRAIN_THROTTLE_MIN + 0.1;
	const alphaBelow = ((SIM_ENGINE_SOUND.STRAIN_ALPHA_DEG - 1) * Math.PI) / 180;
	const alphaMid = ((SIM_ENGINE_SOUND.STRAIN_ALPHA_DEG + 3) * Math.PI) / 180;
	const alphaTop = ((SIM_ENGINE_SOUND.STRAIN_ALPHA_DEG + 6) * Math.PI) / 180;
	const alphaOver = ((SIM_ENGINE_SOUND.STRAIN_ALPHA_DEG + 10) * Math.PI) / 180;

	it('returns zero below the throttle threshold regardless of AoA', () => {
		expect(strainFactor(alphaTop, SIM_ENGINE_SOUND.STRAIN_THROTTLE_MIN - 0.01)).toBe(0);
	});

	it('returns zero below the AoA threshold', () => {
		expect(strainFactor(alphaBelow, throttleHi)).toBe(0);
	});

	it('ramps linearly between threshold and +6 degrees', () => {
		expect(strainFactor(alphaMid, throttleHi)).toBeCloseTo(0.5, 3);
	});

	it('caps at 1 at or above the top of the ramp', () => {
		expect(strainFactor(alphaTop, throttleHi)).toBe(1);
		expect(strainFactor(alphaOver, throttleHi)).toBe(1);
	});
});

describe('dynamicPressurePa', () => {
	it('returns 0 at rest', () => {
		expect(dynamicPressurePa(0)).toBe(0);
	});

	it('computes 0.5 * rho * v^2 at sea-level density', () => {
		const v = 45;
		expect(dynamicPressurePa(v)).toBeCloseTo(0.5 * SIM_SEA_LEVEL_DENSITY_KG_M3 * v * v, 5);
	});

	it('grows quadratically with true airspeed', () => {
		const q1 = dynamicPressurePa(30);
		const q2 = dynamicPressurePa(60);
		expect(q2 / q1).toBeCloseTo(4, 2);
	});
});

describe('throttleGainTarget', () => {
	it('returns the offset floor at zero throttle', () => {
		expect(throttleGainTarget(0)).toBeCloseTo(SIM_ENGINE_SOUND.THROTTLE_GAIN_OFFSET, 5);
	});

	it('returns offset + slope at full throttle', () => {
		expect(throttleGainTarget(1)).toBeCloseTo(
			SIM_ENGINE_SOUND.THROTTLE_GAIN_OFFSET + SIM_ENGINE_SOUND.THROTTLE_GAIN_SLOPE,
			5,
		);
	});
});

describe('noiseGainTarget', () => {
	it('is zero at rest', () => {
		expect(noiseGainTarget(0)).toBe(0);
	});

	it('saturates at NOISE_GAIN once dynamic pressure exceeds the reference', () => {
		// Find a TAS that guarantees q > NOISE_REFERENCE_Q_PA.
		const vFast = 100;
		expect(noiseGainTarget(vFast)).toBeCloseTo(SIM_ENGINE_SOUND.NOISE_GAIN, 5);
	});
});

describe('strainDetuneCents', () => {
	it('is zero at low throttle', () => {
		expect(strainDetuneCents(Math.PI / 6, 0.3)).toBe(0);
	});

	it('scales strain factor by STRAIN_DETUNE_CENTS', () => {
		const alphaMid = ((SIM_ENGINE_SOUND.STRAIN_ALPHA_DEG + 3) * Math.PI) / 180;
		const throttleHi = SIM_ENGINE_SOUND.STRAIN_THROTTLE_MIN + 0.1;
		expect(strainDetuneCents(alphaMid, throttleHi)).toBeCloseTo(0.5 * SIM_ENGINE_SOUND.STRAIN_DETUNE_CENTS, 3);
	});
});
