/**
 * Instrument-fault model types.
 *
 * The FDM produces `FdmTruthState` (what the airplane is actually doing).
 * Each instrument reads a `DisplayState` derived from truth via a pure
 * transform `applyFaults(truth, activations)`. Faults lie about specific
 * truth fields; everything else passes through untouched.
 *
 * Scenarios declare faults via `ScenarioFault[]` on the scenario definition.
 * The runner watches triggers and emits `FaultActivation[]` when they fire;
 * the worker records both `truth` and `display` in the replay tape so the
 * debrief can show "what the gauges showed me" alongside "what was true."
 *
 * Phase 3 ships the interface + a no-op transform (identity when no faults
 * active). Per-instrument fault rendering fans out across B5.* PRs once
 * this contract is locked.
 */

import type { SimFaultKind, SimFaultTriggerKind } from '@ab/constants';
import type { FdmTruthState } from '../types';

/**
 * How a fault becomes active during a scenario run.
 * - `time_seconds`: fires on the first tick where `truth.t >= at`.
 * - `altitude_agl_meters`: fires on the first tick where AGL crosses
 *   `above` upward through it. (Latching: a later descent does not
 *   re-fire; faults are sticky.)
 * - `on_step`: fires when the scenario step ladder advances onto
 *   `stepId`.
 */
export type ScenarioFaultTrigger =
	| { kind: typeof SIM_FAULT_TRIGGER_KIND_TIME; at: number }
	| { kind: typeof SIM_FAULT_TRIGGER_KIND_ALT; above: number }
	| { kind: typeof SIM_FAULT_TRIGGER_KIND_STEP; stepId: string };

// Re-export the constant values as type-level singletons so the union above
// stays tight without importing the runtime constants module from every
// caller. These mirror SIM_FAULT_TRIGGER_KINDS in @ab/constants.
const SIM_FAULT_TRIGGER_KIND_TIME = 'time_seconds';
const SIM_FAULT_TRIGGER_KIND_ALT = 'altitude_agl_meters';
const SIM_FAULT_TRIGGER_KIND_STEP = 'on_step';

/**
 * Per-fault parameter overrides. Each kind picks the fields it cares about.
 * Defaults live in `SIM_FAULT_DEFAULTS` (in @ab/constants) and apply when
 * the scenario does not override.
 */
export interface FaultParams {
	/** Vacuum: AI/HI drift rate, deg/sec. Default 1.0. */
	vacuumDriftDegPerSec?: number;
	/** Alternator: seconds from trigger until bus is fully discharged. */
	alternatorDecaySeconds?: number;
	/** Gyro tumble: whether tumble cycles continue, or freeze at limit. */
	gyroTumbleContinues?: boolean;
	/** Static block: altitude at which the port froze, in feet MSL. */
	staticBlockFreezeAltFt?: number;
	/** Pitot block: KIAS at which the pitot tube froze. */
	pitotBlockFreezeKias?: number;
}

/**
 * Authored declaration of a fault on a scenario. The runner reads
 * `def.faults` and decides per tick whether to flip a fault to active.
 */
export interface ScenarioFault {
	kind: SimFaultKind;
	trigger: ScenarioFaultTrigger;
	params?: FaultParams;
}

/**
 * Runtime activation: emitted by the runner the first tick a trigger
 * fires, then carried forward (faults are sticky). The display transform
 * reads `activations` per tick.
 */
export interface FaultActivation {
	kind: SimFaultKind;
	/** Sim time the fault first fired (sec since scenario start). */
	firedAtT: number;
	/** Resolved params after merging defaults with scenario overrides. */
	params: Required<FaultParams>;
}

/**
 * What the cockpit reads. Mirrors `FdmTruthState` for the fields that
 * instruments actually display; non-display fields (forces, derivative
 * state) are intentionally absent so the transform stays cheap and the
 * surface area for "the instruments lie" is bounded.
 *
 * Indicated airspeed, altitude, vertical speed, pitch, roll, heading,
 * yawRate, slipBall, alpha, RPM, flaps, AoA-derived warnings -- all the
 * fields a six-pack + tach + annunciator strip can actually show.
 *
 * `electricBusVolts` is new for Phase 3: alternator-failure transforms
 * it down to zero across `alternatorDecaySeconds`, and electric-driven
 * instruments (turn coordinator, electric AI in complex airframes,
 * radios, panel lights, alternator annunciator) read from it.
 */
export interface DisplayState {
	/** Indicated airspeed shown on the ASI (m/s). May lag, lead, or
	 *  reverse vs truth under pitot/static fault. */
	indicatedAirspeed: number;
	/** Altitude shown on the altimeter (m MSL). Frozen under static block. */
	altitudeMsl: number;
	/** Vertical speed shown on the VSI (m/s positive up). Zero under
	 *  static block. */
	verticalSpeed: number;
	/** Pitch shown on the AI (rad). Drifts under vacuum failure;
	 *  pegs at limits under gyro tumble. */
	pitchIndicated: number;
	/** Roll shown on the AI (rad). Drifts / tumbles same as pitch. */
	rollIndicated: number;
	/** Heading shown on the HI (rad). Drifts under vacuum / tumbles
	 *  under gyro tumble. */
	headingIndicated: number;
	/** Yaw rate shown on the turn coordinator (rad/s). Goes to zero
	 *  under alternator failure (TC is electric in C172). */
	yawRateIndicated: number;
	/** Slip ball position (-1..+1). Driven by the inclinometer ball,
	 *  which is mechanical (not affected by alternator). */
	slipBall: number;
	/** True alpha for stall annunciation (rad). Always truth -- the
	 *  stall vane is independent of the pitot/static system. */
	alpha: number;
	/** Stall warning annunciator state. Always truth (driven by the
	 *  alpha vane on the wing leading edge). */
	stallWarning: boolean;
	stalled: boolean;
	/** Engine RPM shown on the tach (rev/min). Always truth (mechanical
	 *  cable on a fixed-pitch prop airframe). */
	engineRpm: number;
	/** Flap detent shown on the flap indicator (deg). Always truth. */
	flapsDegrees: number;
	/** Effective bus voltage feeding electric instruments (volts). 28V
	 *  nominal on a C172 with the alternator online; decays to 0 under
	 *  alternator failure. */
	electricBusVolts: number;
	/** Whether the cockpit considers the airplane on the ground. Always
	 *  truth (gear-squat switch is independent of every modeled fault). */
	onGround: boolean;
	/** Sim time forwarded for debrief alignment. Always truth. */
	t: number;
	/** Engine cluster gauges shown opposite the tach. Pass-through truth
	 *  for now; the fault model owns the layers that lie -- alternator
	 *  zeros the ammeter, vacuum-failure zeros the vacuum gauge. */
	oilPressurePsi: number;
	oilTempCelsius: number;
	fuelLeftGallons: number;
	fuelRightGallons: number;
	ammeterAmps: number;
	vacuumInHg: number;
}

/** Identifier for a fault kind, re-exported from @ab/constants for ergonomic
 *  imports inside the BC. */
export type FaultKind = SimFaultKind;
export type FaultTriggerKind = SimFaultTriggerKind;

/**
 * Transform input. Bundling the inputs lets us add fields (electrical
 * bus state, fuel-tank state) without rippling signature changes through
 * every caller.
 */
export interface FaultTransformInput {
	truth: FdmTruthState;
	activations: readonly FaultActivation[];
	/** Nominal bus voltage when the alternator is healthy (volts).
	 *  C172 = 28; PA28 = 14 in older Warriors, 28 in Archer III. */
	nominalBusVolts: number;
}
