/**
 * Shared Sim BC types. Plain data only -- no classes, no behaviour. The
 * FDM, worker, scenario runner, and instrument components all cross
 * worker/main-thread boundaries, so every value on these types must be
 * structured-clone-safe (no functions, no symbols).
 */

import type { SimAircraftId, SimScenarioId, SimScenarioOutcome } from '@ab/constants';

/**
 * Full "truth" state the FDM produces each tick. This is what the
 * aeroplane is actually doing, before any instrument fault model is
 * applied. Phase 0 is 3-DoF (x, altitude, pitch) so roll and yaw are
 * absent; they'll join in Phase 2 when the real FDM lands.
 */
export interface FdmTruthState {
	/** Simulation time in seconds since scenario start. */
	t: number;
	/** Horizontal position along runway heading (m). */
	x: number;
	/** Altitude MSL (m). */
	altitude: number;
	/** Ground elevation beneath the aircraft (m MSL). Phase 0 = flat. */
	groundElevation: number;
	/** Horizontal velocity along body-x (m/s). */
	u: number;
	/** Vertical velocity, positive up (m/s). */
	w: number;
	/** Pitch angle theta, radians (nose-up positive). */
	pitch: number;
	/** Pitch rate q, rad/s. */
	pitchRate: number;
	/** Angle of attack (rad). */
	alpha: number;
	/** True airspeed magnitude (m/s). */
	trueAirspeed: number;
	/** Indicated airspeed (m/s) -- Phase 0 equals TAS (no density correction). */
	indicatedAirspeed: number;
	/** Vertical speed (m/s), positive up. Derived from w for instruments. */
	verticalSpeed: number;
	/** Lift coefficient at the current AoA (dimensionless). */
	liftCoefficient: number;
	/** Drag coefficient at the current AoA (dimensionless). */
	dragCoefficient: number;
	/** Load factor (n) -- lift / weight. */
	loadFactor: number;
	/** True when the aircraft is on (or below) the ground. */
	onGround: boolean;
	/** True when alpha is above the critical AoA for this airframe. */
	stalled: boolean;
}

/** Pilot-commanded inputs sent from the main thread into the FDM worker. */
export interface FdmInputs {
	/** Throttle lever position, 0..1 (0 = idle, 1 = full). */
	throttle: number;
	/** Elevator command, -1..+1 (-1 = full nose-down, +1 = full nose-up). */
	elevator: number;
}

/**
 * Static aircraft configuration -- mass, geometry, engine, and aero model.
 * Values are the airframe's physical properties; the FDM reads these
 * without mutating them.
 */
export interface AircraftConfig {
	id: SimAircraftId;
	displayName: string;
	/** All-up mass (kg). */
	mass: number;
	/** Wing reference area (m^2). */
	wingArea: number;
	/** Lift-curve slope in the linear region (per radian). */
	liftSlope: number;
	/** Maximum lift coefficient before stall break. */
	clMax: number;
	/** Zero-lift angle of attack (rad). */
	alphaZeroLift: number;
	/** Critical AoA -- the peak of the CL curve (rad). */
	alphaStall: number;
	/** Post-stall CL floor (lift does not fall below this). */
	clPostStall: number;
	/** Zero-lift drag coefficient. */
	cd0: number;
	/** Oswald efficiency for induced drag. */
	oswald: number;
	/** Effective aspect ratio. */
	aspectRatio: number;
	/** Max thrust at sea level, full throttle (N). */
	maxThrustSeaLevel: number;
	/** Pitch authority -- elevator command to pitching acceleration (rad/s^2 per unit elevator at 1 G). */
	pitchAuthority: number;
	/** Pitch damping coefficient -- opposes pitch rate. */
	pitchDamping: number;
	/** Natural pitch-stability gradient: restoring moment per radian of AoA deviation from trim. */
	pitchStability: number;
	/** Trim angle of attack the airframe wants to fly at with neutral elevator (rad). */
	trimAlpha: number;
	/** Stall speed clean (m/s IAS) -- reference only; FDM does not use directly. */
	vS1: number;
	/** Stall speed flaps-down (m/s IAS). */
	vS0: number;
	/** Max structural cruise / normal operating speed (m/s IAS). */
	vNo: number;
	/** Never-exceed speed (m/s IAS). */
	vNe: number;
}

/**
 * Success/failure criteria the scenario runner evaluates against truth state.
 * Keeping these data-driven (instead of scenario-specific code) lets the
 * Phase 0 runner be trivially reused for future scenarios without mutation.
 */
export interface ScenarioCriteria {
	/** Success: aircraft altitude AGL reaches this value without any failure firing (m AGL). */
	successAltitudeAglMeters?: number;
	/** Failure: AoA above airframe's alphaStall for at least this long (seconds). */
	failureSustainedStallSeconds?: number;
	/** Failure: altitude AGL falls below this (m). Typical: 0 = touched ground off-runway. */
	failureMinimumAltitudeAglMeters?: number;
	/** Hard timeout -- scenario aborts as failure past this many seconds. */
	timeoutSeconds: number;
}

/** Initial FDM truth state a scenario starts from. */
export interface ScenarioInitialState {
	altitude: number;
	groundElevation: number;
	u: number;
	w: number;
	pitch: number;
	pitchRate: number;
	throttle: number;
	elevator: number;
	onGround: boolean;
}

/** Full scenario definition consumed by the BC runner and the app UI. */
export interface ScenarioDefinition {
	id: SimScenarioId;
	title: string;
	objective: string;
	briefing: string;
	aircraft: SimAircraftId;
	initial: ScenarioInitialState;
	criteria: ScenarioCriteria;
}

/**
 * Terminal result produced when a scenario run ends (success / failure /
 * timeout / user-aborted). Phase 0 doesn't persist these; the app simply
 * shows the verdict on the UI.
 */
export interface ScenarioRunResult {
	scenarioId: SimScenarioId;
	outcome: SimScenarioOutcome;
	/** Seconds of sim time elapsed at outcome. */
	elapsedSeconds: number;
	/** Peak altitude AGL reached during the run (m). */
	peakAltitudeAgl: number;
	/** Max AoA observed (rad). */
	maxAlpha: number;
	/** Human-readable reason (rendered in the UI). */
	reason: string;
}
