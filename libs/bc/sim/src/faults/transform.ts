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

function applyPitotBlock(
	display: DisplayState,
	_activation: FaultActivation,
	_input: FaultTransformInput,
): DisplayState {
	// B5.asi will compute: ASI reads like a second altimeter above the
	// block altitude, zero on descent. Until then, pass through.
	return display;
}

function applyStaticBlock(
	display: DisplayState,
	activation: FaultActivation,
	_input: FaultTransformInput,
): DisplayState {
	// Altimeter behavior: a blocked static port traps a single reference
	// pressure inside the case. The altimeter capsule no longer sees outside
	// pressure changes, so the indicated altitude freezes at whatever it was
	// reading the moment the block engaged. The B5.alt PR ships this layer.
	//
	// B5.{asi,vsi} extends this for the rest of the static system: VSI
	// drops to zero, ASI reverses sense on descent. Those branches stay
	// pass-through here until their PRs land.
	const frozenAltitudeMsl = activation.params.staticBlockFreezeAltFt * SIM_METERS_PER_FOOT;
	return { ...display, altitudeMsl: frozenAltitudeMsl };
}

function applyVacuumFailure(
	display: DisplayState,
	_activation: FaultActivation,
	_input: FaultTransformInput,
): DisplayState {
	// B5.{ai,hi} will compute: pitch/roll/heading drift at
	// activation.params.vacuumDriftDegPerSec since firedAtT. Until then, pass through.
	return display;
}

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

function applyGyroTumble(
	display: DisplayState,
	_activation: FaultActivation,
	_input: FaultTransformInput,
): DisplayState {
	// B5.{ai,hi} will compute: AI pitches/rolls to mechanical limits;
	// HI spins. Until then, pass through.
	return display;
}

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
