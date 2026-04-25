/**
 * Pure audio-parameter mappings for the procedural engine sound. The
 * Web Audio graph itself lives in the `apps/sim` layer (it depends on a
 * DOM AudioContext); these helpers are the physics-facing math that
 * decides what parameters the graph should be set to. Keeping them here
 * lets them be unit tested without a browser.
 */

import { SIM_ENGINE_SOUND, SIM_GEAR_WARNING, SIM_SEA_LEVEL_DENSITY_KG_M3 } from '@ab/constants';

/** Fundamental oscillator frequency (Hz) given RPM and the airframe idle. */
export function engineFundamentalHz(rpm: number, idleRpm: number): number {
	if (idleRpm <= 0) return SIM_ENGINE_SOUND.BASE_FREQ_HZ;
	const ratio = Math.max(0.5, rpm / idleRpm);
	return SIM_ENGINE_SOUND.BASE_FREQ_HZ * ratio;
}

/**
 * 4-cylinder 4-stroke firing rate (Hz). Each cylinder fires once per
 * two crank revolutions, so an n-cylinder engine fires `n/2` times per
 * revolution -> firing rate = (RPM / 60) * (n/2) = RPM / 30 for a
 * 4-cylinder. This is the actual exhaust-pulse rate the ear hears as
 * the engine's "note", lower than the legacy `engineFundamentalHz`
 * which was tuned to a synth bass-note feel rather than the airplane.
 */
export function engineFiringHz(rpm: number): number {
	const safeRpm = Math.max(0, rpm);
	return safeRpm / 30;
}

/**
 * Propeller blade-pass frequency (Hz). The C172's two-blade prop
 * passes the listener twice per shaft revolution, so blade-pass =
 * 2 * RPM / 60 = RPM / 30 -- coincidentally the same as the
 * 4-cylinder firing rate. Kept as a separate function so a future
 * three-blade or constant-speed prop can override.
 */
export function propBladePassHz(rpm: number): number {
	const safeRpm = Math.max(0, rpm);
	return (2 * safeRpm) / 60;
}

/**
 * Tremolo / exhaust-burble rate (Hz). Real engines have a slow
 * envelope modulation from cylinder-to-cylinder timing variation,
 * around 5-12 Hz depending on RPM. We slope it linearly with RPM to
 * keep the cockpit feel "alive" at idle without becoming choppy at
 * full throttle.
 */
export function tremoloHz(rpm: number, idleRpm: number, maxRpm: number): number {
	if (maxRpm <= idleRpm) return 5;
	const t = Math.max(0, Math.min(1, (rpm - idleRpm) / (maxRpm - idleRpm)));
	return 5 + 7 * t;
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

/**
 * Gear-warning predicate. Fires when throttle is at/below the idle gate AND
 * IAS (knots) is below the low-speed gate AND gear is up. The C172 has fixed
 * gear so `gearDown` is hard-wired `true` by the airframe profile today,
 * which means the predicate never fires on C172. The follow-up retractable
 * airframe (PA28-R / C182RG) flips the input, and the predicate will fire
 * naturally.
 */
export function shouldSoundGearWarning(throttle: number, kias: number, gearDown: boolean): boolean {
	if (gearDown) return false;
	if (throttle > SIM_GEAR_WARNING.THROTTLE_MAX) return false;
	if (kias >= SIM_GEAR_WARNING.KIAS_MAX) return false;
	return true;
}

/**
 * Detect whether the commanded flap detent changed between two snapshots.
 * Phase 0.5 flaps are instantaneous-detent (no continuous motion model) so
 * each change pulses the motor cue; continuous-flap work will subsume this
 * with real travel-time detection.
 */
export function flapsChanged(prevDeg: number, currDeg: number): boolean {
	return prevDeg !== currDeg;
}

/**
 * True when altitude transitions across the alert threshold between two
 * snapshots. The threshold is `targetFt - leadFt`. Returns true if the
 * previous altitude was on one side and the current is on the other side
 * (strict inequality both sides) so a single-shot tone fires once per
 * crossing in either direction.
 */
export function altitudeAlertCrossed(prevFt: number, currFt: number, targetFt: number, leadFt: number): boolean {
	const threshold = targetFt - leadFt;
	return (prevFt < threshold && currFt >= threshold) || (prevFt > threshold && currFt <= threshold);
}
