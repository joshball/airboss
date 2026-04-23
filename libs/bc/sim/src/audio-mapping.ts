/**
 * Pure audio-parameter mappings for the procedural engine sound. The
 * Web Audio graph itself lives in the `apps/sim` layer (it depends on a
 * DOM AudioContext); these helpers are the physics-facing math that
 * decides what parameters the graph should be set to. Keeping them here
 * lets them be unit tested without a browser.
 */

import { SIM_ENGINE_SOUND, SIM_SEA_LEVEL_DENSITY_KG_M3 } from '@ab/constants';

/** Fundamental oscillator frequency (Hz) given RPM and the airframe idle. */
export function engineFundamentalHz(rpm: number, idleRpm: number): number {
	if (idleRpm <= 0) return SIM_ENGINE_SOUND.BASE_FREQ_HZ;
	const ratio = Math.max(0.5, rpm / idleRpm);
	return SIM_ENGINE_SOUND.BASE_FREQ_HZ * ratio;
}

/**
 * Strain factor in [0, 1] -- how much climb-strain wobble to apply to the
 * harmonic oscillator. Zero unless throttle is high AND AoA is above the
 * strain threshold; ramps linearly over 6 degrees of alpha past the threshold.
 */
export function strainFactor(alphaRad: number, throttle: number): number {
	if (throttle < SIM_ENGINE_SOUND.STRAIN_THROTTLE_MIN) return 0;
	const alphaDeg = (alphaRad * 180) / Math.PI;
	if (alphaDeg <= SIM_ENGINE_SOUND.STRAIN_ALPHA_DEG) return 0;
	const span = 6;
	return Math.min(1, (alphaDeg - SIM_ENGINE_SOUND.STRAIN_ALPHA_DEG) / span);
}

/** Dynamic pressure approximation at sea-level density (Pa). */
export function dynamicPressurePa(trueAirspeed: number): number {
	return 0.5 * SIM_SEA_LEVEL_DENSITY_KG_M3 * trueAirspeed * trueAirspeed;
}

/**
 * Throttle gain target combining the idle audibility floor with the
 * throttle-driven slope. Output in linear gain units.
 */
export function throttleGainTarget(throttle: number): number {
	return throttle * SIM_ENGINE_SOUND.THROTTLE_GAIN_SLOPE + SIM_ENGINE_SOUND.THROTTLE_GAIN_OFFSET;
}

/**
 * Noise level target driven by dynamic pressure, saturated at the reference
 * Q. Output in linear gain units (0..NOISE_GAIN).
 */
export function noiseGainTarget(trueAirspeed: number): number {
	const q = dynamicPressurePa(trueAirspeed);
	return Math.min(1, q / SIM_ENGINE_SOUND.NOISE_REFERENCE_Q_PA) * SIM_ENGINE_SOUND.NOISE_GAIN;
}

/** Detune target (cents) for the harmonic oscillator given alpha + throttle. */
export function strainDetuneCents(alphaRad: number, throttle: number): number {
	return strainFactor(alphaRad, throttle) * SIM_ENGINE_SOUND.STRAIN_DETUNE_CENTS;
}
