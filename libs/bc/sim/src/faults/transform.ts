/**
 * Pure `applyFaults(input) -> DisplayState` transform.
 *
 * Each active fault rewrites a specific subset of truth fields; orthogonal
 * faults compose by chaining transforms. The order is deterministic:
 *
 *   1. Start from a truth-faithful baseline DisplayState.
 *   2. Apply pitot-block (ASI only).
 *   3. Apply static-block (ASI + altimeter + VSI).
 *   4. Apply vacuum-failure (AI + HI gyros).
 *   5. Apply alternator-failure (electric instruments scale by bus volts).
 *   6. Apply gyro-tumble (AI + HI peg / cycle to mechanical limits).
 *
 * A scenario may have multiple faults active simultaneously; each step is a
 * pure function on the partially-faulted display, so order matters but the
 * outcome is reproducible.
 *
 * Phase 3 ships the contract + identity transform when no faults are
 * active. Per-fault rendering for each instrument lands in the B5 fan-out
 * PRs; until then, every fault kind is wired through but the per-fault
 * branch is intentionally a no-op pass-through. The B5.* PRs flip each
 * branch from no-op to the real transform without changing this file's
 * surface or any caller.
 */

import {
	SIM_FAULT_DEFAULTS,
	SIM_FAULT_KINDS,
	SIM_FEET_PER_METER,
	SIM_KNOTS_PER_METER_PER_SECOND,
	SIM_METERS_PER_FOOT,
} from '@ab/constants';
import type { DisplayState, FaultActivation, FaultParams, FaultTransformInput, ScenarioFault } from './types';

/** Build an activation for a scenario-declared fault firing now (sim time t).
 *  Merges defaults with scenario overrides so downstream code can rely on
 *  every field being present. */
export function activateFault(fault: ScenarioFault, t: number): FaultActivation {
	const merged: Required<FaultParams> = {
		vacuumDriftDegPerSec: fault.params?.vacuumDriftDegPerSec ?? SIM_FAULT_DEFAULTS.VACUUM_DRIFT_DEG_PER_SEC,
		alternatorDecaySeconds: fault.params?.alternatorDecaySeconds ?? SIM_FAULT_DEFAULTS.ALTERNATOR_DECAY_SECONDS,
		gyroTumbleContinues: fault.params?.gyroTumbleContinues ?? SIM_FAULT_DEFAULTS.GYRO_TUMBLE_CONTINUES,
		staticBlockFreezeAltFt: fault.params?.staticBlockFreezeAltFt ?? SIM_FAULT_DEFAULTS.STATIC_BLOCK_FREEZE_ALT_FT,
		pitotBlockFreezeKias: fault.params?.pitotBlockFreezeKias ?? SIM_FAULT_DEFAULTS.PITOT_BLOCK_FREEZE_KIAS,
	};
	return { kind: fault.kind, firedAtT: t, params: merged };
}

/** Truth-faithful baseline. The starting point before any fault layers. */
function baseline(input: FaultTransformInput): DisplayState {
	const { truth, nominalBusVolts } = input;
	return {
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
		electricBusVolts: nominalBusVolts,
		onGround: truth.onGround,
		t: truth.t,
	};
}

/**
 * Find the activation matching a kind, if any. Faults are sticky so at
 * most one activation per kind is in the array.
 */
function find(activations: readonly FaultActivation[], kind: FaultActivation['kind']): FaultActivation | null {
	for (const a of activations) {
		if (a.kind === kind) return a;
	}
	return null;
}

// --- Per-fault layers --------------------------------------------------
// Each layer is a pure function `(display, activation, input) -> display`.
// Phase 3 ships these as identity. B5.* fan-out PRs replace each body with
// the real transform without changing the signature.

function applyPitotBlock(display: DisplayState, activation: FaultActivation, input: FaultTransformInput): DisplayState {
	// A blocked pitot tube traps total pressure at the block-time value.
	// As the airplane climbs, static drops, and the trapped-vs-current
	// differential grows -- so the ASI reads HIGHER as altitude
	// increases. On descent, static rises, the differential shrinks,
	// and the ASI reads LOWER (eventually zero or negative-clamped).
	// POH characterises this as "the ASI behaves like an altimeter."
	//
	// We use a linear approximation tuned to the documented C172
	// behavior: ~2 KIAS per 100 ft of altitude change above the block
	// point. That matches the FSX/X-Plane training scenarios. A
	// fully-compressible IAS-from-pressure recompute is post-MVP.
	const blockedKias = activation.params.pitotBlockFreezeKias;
	const altitudeFt = input.truth.altitude * SIM_FEET_PER_METER;
	// `staticBlockFreezeAltFt` doubles as the block-time altitude when
	// authors want to override; otherwise default 0 -- which is the
	// freeze-at-MSL-zero case the static-block default used.
	const blockAltitudeFt = activation.params.staticBlockFreezeAltFt;
	const altitudeDeltaFt = altitudeFt - blockAltitudeFt;
	const indicatedKias = Math.max(0, blockedKias + altitudeDeltaFt * PITOT_BLOCK_KIAS_PER_FOOT);
	const indicatedMs = indicatedKias / SIM_KNOTS_PER_METER_PER_SECOND;
	return { ...display, indicatedAirspeed: indicatedMs };
}

/**
 * Linear proxy for the pitot-block "ASI behaves like an altimeter" effect.
 * 2 KIAS per 100 ft of altitude change. Source: FSX/X-Plane training
 * tuning, matches POH "altimeter-style" qualitative description.
 */
const PITOT_BLOCK_KIAS_PER_FOOT = 0.02;

function applyStaticBlock(
	display: DisplayState,
	activation: FaultActivation,
	input: FaultTransformInput,
): DisplayState {
	// A blocked static port traps a single reference pressure inside the
	// case shared by the altimeter, VSI, and ASI:
	//
	//   - Altimeter: capsule no longer sees outside pressure changes,
	//     freezes at whatever it was reading when the block engaged
	//     (B5.alt #142).
	//   - VSI: with no pressure differential to integrate, the diaphragm
	//     reads zero -- the airplane appears to be in steady level flight
	//     even when climbing or descending (B5.vsi #144).
	//   - ASI: pitot keeps live total but static is trapped at the block
	//     altitude. Descent through the block altitude raises P_total
	//     vs trapped P_static, so IAS reads higher than truth. Climb
	//     does the opposite, IAS reads lower. The effect inverts the
	//     pitot-block sense (this PR, B5.asi).
	const frozenAltitudeMsl = activation.params.staticBlockFreezeAltFt * SIM_METERS_PER_FOOT;
	const altitudeFt = input.truth.altitude * SIM_FEET_PER_METER;
	const altitudeBelowBlockFt = activation.params.staticBlockFreezeAltFt - altitudeFt;
	const truthKias = input.truth.indicatedAirspeed * SIM_KNOTS_PER_METER_PER_SECOND;
	const indicatedKias = Math.max(0, truthKias + altitudeBelowBlockFt * STATIC_BLOCK_ASI_KIAS_PER_FOOT);
	const indicatedAirspeed = indicatedKias / SIM_KNOTS_PER_METER_PER_SECOND;
	return {
		...display,
		altitudeMsl: frozenAltitudeMsl,
		verticalSpeed: 0,
		indicatedAirspeed,
	};
}

/**
 * Linear proxy for the static-block ASI effect. Same magnitude as the
 * pitot-block model (~2 KIAS per 100 ft) because the underlying
 * pressure delta is the same; only the sign relative to altitude
 * changes inverts.
 */
const STATIC_BLOCK_ASI_KIAS_PER_FOOT = 0.02;

function applyVacuumFailure(
	display: DisplayState,
	activation: FaultActivation,
	input: FaultTransformInput,
): DisplayState {
	// Vacuum-driven gyros (AI + HI on the C172) lose erection slowly as
	// the gyro spools down. The pilot sees gradual drift -- typically
	// pitch creeps in one direction and roll/heading drift in the
	// opposite. The drift rate is the activation's
	// `vacuumDriftDegPerSec`.
	//
	// B5.ai (this PR) drifts pitch + roll on the AI. B5.hi extends the
	// same activation to the heading indicator. The drift accumulates
	// from firedAtT, so the longer the failure goes unnoticed the
	// further from truth the gauge reads.
	const elapsedSec = Math.max(0, input.truth.t - activation.firedAtT);
	const driftRad = activation.params.vacuumDriftDegPerSec * (Math.PI / 180) * elapsedSec;
	// AI pitch drifts nose-up (positive); AI roll drifts right wing down
	// (positive). Pilots train to recognise the drift signature.
	const pitchIndicated = display.pitchIndicated + driftRad;
	const rollIndicated = display.rollIndicated + driftRad * VACUUM_ROLL_DRIFT_RATIO;
	// HI heading drifts at the same rate as pitch but in the opposite
	// direction (left in the northern hemisphere) -- the directional
	// gyro precesses as it spools down. Pilots cross-check against the
	// magnetic compass to recognise the drift.
	const headingIndicated = display.headingIndicated - driftRad;
	return { ...display, pitchIndicated, rollIndicated, headingIndicated };
}

/**
 * Roll drift develops more slowly than pitch on a real failing AI
 * because the roll erection mechanism has more inertia. A 0.5 ratio
 * gives a recognisable but not-overwhelming roll bias.
 */
const VACUUM_ROLL_DRIFT_RATIO = 0.5;

function applyAlternatorFailure(
	display: DisplayState,
	activation: FaultActivation,
	input: FaultTransformInput,
): DisplayState {
	// Bus voltage decay is the load-bearing behavior every electric instrument
	// reads from. Implement it now so B5.tc and the engine-cluster ammeter
	// can rely on it without another round-trip.
	const elapsed = Math.max(0, input.truth.t - activation.firedAtT);
	const decayFraction = Math.min(1, elapsed / activation.params.alternatorDecaySeconds);
	const volts = input.nominalBusVolts * (1 - decayFraction);
	return { ...display, electricBusVolts: volts };
}

function applyGyroTumble(display: DisplayState, activation: FaultActivation, input: FaultTransformInput): DisplayState {
	// Gyro tumble: when the AI's gimbal limits are exceeded (real-world
	// trigger: aerobatic attitudes, severe turbulence, or post-failure
	// mechanical damage), the gyro pegs at its mechanical limits. If
	// `gyroTumbleContinues`, the gimbal continues cycling through the
	// limits at a slow rate. If false, it freezes at the first limit
	// it hits.
	//
	// B5.ai (this PR) tumbles the AI. B5.hi will extend to the heading
	// indicator. The tumble visually pegs pitch and roll at the
	// mechanical limits regardless of truth.
	const elapsedSec = Math.max(0, input.truth.t - activation.firedAtT);
	if (activation.params.gyroTumbleContinues) {
		// Slow cycle: 1 full tumble per TUMBLE_PERIOD_SEC. Pitch and
		// roll oscillate ±90 deg out of phase so the AI looks broken,
		// not just stuck. The HI spins continuously through 0..2pi at
		// the same period -- a tumbled directional gyro is the textbook
		// "compass card going around the dial."
		const phase = (elapsedSec / GYRO_TUMBLE_PERIOD_SEC) * Math.PI * 2;
		const pitchIndicated = Math.sin(phase) * GYRO_TUMBLE_LIMIT_RAD;
		const rollIndicated = Math.cos(phase) * GYRO_TUMBLE_LIMIT_RAD;
		const headingIndicated = phase % (Math.PI * 2);
		return { ...display, pitchIndicated, rollIndicated, headingIndicated };
	}
	// Freeze at the limit on the first tick. HI freezes at whatever
	// heading was indicated when the tumble started (truth-state
	// snapshot, not zero).
	return {
		...display,
		pitchIndicated: GYRO_TUMBLE_LIMIT_RAD,
		rollIndicated: -GYRO_TUMBLE_LIMIT_RAD,
		headingIndicated: display.headingIndicated,
	};
}

/** AI mechanical gimbal limit. ~90 deg corresponds to a fully tumbled
 *  gyro pegged against the case. */
const GYRO_TUMBLE_LIMIT_RAD = (90 * Math.PI) / 180;
/** Continuous-tumble cycle period (sec). Matches a real failing gyro
 *  -- slow enough to read as broken, fast enough to be visibly
 *  unsettled. */
const GYRO_TUMBLE_PERIOD_SEC = 6;

/**
 * Compose the fault layers in deterministic order.
 *
 * No active faults -> identity transform: returns the truth-faithful
 * baseline. The cockpit can render off `DisplayState` from day one without
 * waiting for the per-fault PRs to land.
 */
export function applyFaults(input: FaultTransformInput): DisplayState {
	let display = baseline(input);

	const pitot = find(input.activations, SIM_FAULT_KINDS.PITOT_BLOCK);
	if (pitot) display = applyPitotBlock(display, pitot, input);

	const staticBlock = find(input.activations, SIM_FAULT_KINDS.STATIC_BLOCK);
	if (staticBlock) display = applyStaticBlock(display, staticBlock, input);

	const vacuum = find(input.activations, SIM_FAULT_KINDS.VACUUM_FAILURE);
	if (vacuum) display = applyVacuumFailure(display, vacuum, input);

	const alternator = find(input.activations, SIM_FAULT_KINDS.ALTERNATOR_FAILURE);
	if (alternator) display = applyAlternatorFailure(display, alternator, input);

	const tumble = find(input.activations, SIM_FAULT_KINDS.GYRO_TUMBLE);
	if (tumble) display = applyGyroTumble(display, tumble, input);

	return display;
}

/**
 * Convenience for callers that want airspeed in knots without re-importing
 * the unit constant. Display airspeed reflects whatever the active faults
 * have done to the ASI; this just unit-converts.
 */
export function indicatedAirspeedKnots(display: DisplayState): number {
	return display.indicatedAirspeed * SIM_KNOTS_PER_METER_PER_SECOND;
}
