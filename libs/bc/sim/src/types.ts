/**
 * Shared Sim BC types. Plain data only -- no classes, no behaviour. The
 * FDM, worker, scenario runner, and instrument components all cross
 * worker/main-thread boundaries, so every value on these types must be
 * structured-clone-safe (no functions, no symbols).
 */

import type { SimAircraftId, SimFlapDegrees, SimScenarioId, SimScenarioOutcome } from '@ab/constants';

/**
 * Full truth state the FDM produces each tick. This is what the aeroplane
 * is actually doing. Phase 0.5 adds a lateral axis (roll + yaw), wind, a
 * parking brake, trim, and flaps on top of the original longitudinal
 * prototype.
 */
export interface FdmTruthState {
	/** Simulation time in seconds since scenario start. */
	t: number;
	/** Horizontal position along runway heading, along aircraft body-x (m). */
	x: number;
	/** Altitude MSL (m). */
	altitude: number;
	/** Ground elevation beneath the aircraft (m MSL). Phase 0.5 = flat. */
	groundElevation: number;
	/** Horizontal body-x velocity relative to the air mass (m/s). */
	u: number;
	/** Vertical velocity, positive up, relative to the air mass (m/s). */
	w: number;
	/** Pitch angle theta, radians (nose-up positive). */
	pitch: number;
	/** Pitch rate q, rad/s. */
	pitchRate: number;
	/** Bank angle phi, radians (right wing down positive). */
	roll: number;
	/** Roll rate p, rad/s. */
	rollRate: number;
	/** Yaw rate r, rad/s. */
	yawRate: number;
	/** True heading, radians (0 = north, increases clockwise looking down). */
	heading: number;
	/** Angle of attack (rad). */
	alpha: number;
	/** True airspeed magnitude relative to air mass (m/s). */
	trueAirspeed: number;
	/** Indicated airspeed (m/s). Phase 0.5 equals TAS (no density correction). */
	indicatedAirspeed: number;
	/** Ground speed magnitude relative to earth (m/s). */
	groundSpeed: number;
	/** Vertical speed (m/s) positive up, relative to ground. */
	verticalSpeed: number;
	/** Lift coefficient at the current AoA (dimensionless). */
	liftCoefficient: number;
	/** Drag coefficient at the current AoA (dimensionless). */
	dragCoefficient: number;
	/** Load factor (n) -- lift / weight. */
	loadFactor: number;
	/**
	 * Slip/skid indicator, -1..+1 range. Positive = ball right (skid in a
	 * right turn / slip in a left turn); negative = ball left. Zero means
	 * coordinated flight.
	 */
	slipBall: number;
	/** True when the aircraft is on (or below) the ground. */
	onGround: boolean;
	/** True when the parking brake is set. */
	brakeOn: boolean;
	/** True when alpha is above the stall-warning AoA but below critical. */
	stallWarning: boolean;
	/** True when alpha is above the critical AoA for this airframe. */
	stalled: boolean;
	/** Current flap detent (degrees). */
	flapsDegrees: SimFlapDegrees;
	/** Effective elevator command (pilot input + trim bias) actually applied. */
	elevatorEffective: number;
	/** Engine RPM (revolutions per minute). */
	engineRpm: number;
}

/** Pilot-commanded inputs sent from the main thread into the FDM worker. */
export interface FdmInputs {
	/** Throttle lever position, 0..1 (0 = idle, 1 = full). */
	throttle: number;
	/** Elevator command, -1..+1 (-1 = full nose-down, +1 = full nose-up). */
	elevator: number;
	/** Pitch trim bias, -1..+1 (added to elevator command before clamping). */
	trim: number;
	/** Aileron command, -1..+1 (-1 = left, +1 = right). */
	aileron: number;
	/** Rudder command, -1..+1 (-1 = left, +1 = right). */
	rudder: number;
	/** True when the parking brake is set. */
	brake: boolean;
	/**
	 * True when auto-coordination is on. While airborne, this zeroes the
	 * slip ball by commanding rudder automatically; on the ground the
	 * rudder always steers regardless of this flag.
	 */
	autoCoordinate: boolean;
	/** Commanded flap detent (degrees). */
	flaps: SimFlapDegrees;
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
	/** Wing span (m). Used for roll authority scaling. */
	wingSpan: number;
	/** Lift-curve slope in the linear region (per radian). */
	liftSlope: number;
	/** Maximum lift coefficient before stall break (clean). */
	clMax: number;
	/** Zero-lift angle of attack (rad). */
	alphaZeroLift: number;
	/** Critical AoA -- the peak of the CL curve (rad). */
	alphaStall: number;
	/** Post-stall CL floor (lift does not fall below this). */
	clPostStall: number;
	/** AoA at which the stall warning horn activates (rad). */
	alphaStallWarning: number;
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
	/** Roll authority -- aileron command to roll acceleration (rad/s^2 per unit aileron at cruise). */
	rollAuthority: number;
	/** Roll damping coefficient -- opposes roll rate. */
	rollDamping: number;
	/** Cap on bank angle magnitude (rad). */
	bankLimit: number;
	/** Rudder authority -- rudder command to yaw acceleration (rad/s^2 per unit rudder at cruise). */
	rudderAuthority: number;
	/** Yaw damping coefficient -- opposes yaw rate. */
	yawDamping: number;
	/**
	 * Adverse-yaw coefficient. Aileron input produces an opposite-sign yaw
	 * acceleration proportional to this. With auto-coordinate ON the auto-
	 * rudder cancels this; with it OFF the ball swings.
	 */
	adverseYaw: number;
	/** Trim bias limit: max |trim| effect on elevator command. */
	trimRange: number;
	/** Flap CL shift per 10 degrees of flap extension. */
	clFlapsPer10Deg: number;
	/** Flap CD shift per 10 degrees of flap extension. */
	cdFlapsPer10Deg: number;
	/** Max flap deflection for drag/CL scaling (deg). */
	flapMaxDeg: number;
	/** Ground rolling friction coefficient (brake off). */
	rollingFriction: number;
	/** Ground parking-brake friction coefficient (brake on). */
	brakeFriction: number;
	/** Rudder-on-ground authority -- heading rate (rad/s) per unit rudder per m/s of ground speed. */
	groundSteering: number;
	/** Idle engine RPM. */
	idleRpm: number;
	/** Full-throttle engine RPM. */
	maxRpm: number;
	/** Green arc low (typical cruise) RPM. */
	greenArcRpmLow: number;
	/** Green arc high RPM. */
	greenArcRpmHigh: number;
	/** Stall speed clean (m/s IAS) -- reference only; FDM does not use directly. */
	vS1: number;
	/** Stall speed flaps-down (m/s IAS). */
	vS0: number;
	/** Rotation speed (m/s IAS). */
	vR: number;
	/** Best angle of climb (m/s IAS). */
	vX: number;
	/** Best rate of climb (m/s IAS). */
	vY: number;
	/** Maneuvering speed (m/s IAS). */
	vA: number;
	/** Max structural cruise / normal operating speed (m/s IAS). */
	vNo: number;
	/** Never-exceed speed (m/s IAS). */
	vNe: number;
	/** Max flaps extended speed (m/s IAS). */
	vFe: number;
}

/** Per-scenario wind configuration. */
export interface ScenarioWind {
	/** Direction wind is FROM, degrees true (0 = north, clockwise). */
	directionDegrees: number;
	/** Speed in knots. */
	speedKnots: number;
}

/**
 * Scripted-input step applied by the scenario runner. Phase 0.5 uses this
 * for the Departure Stall's "distracted pilot" trim drift.
 */
export interface ScenarioScriptedInput {
	/** Earliest sim time (seconds) before this input is active. */
	startSeconds?: number;
	/** Minimum AGL (meters) before this input is active. */
	minAltitudeAglMeters?: number;
	/** Rate at which scripted trim is added to the pilot trim (per-second). */
	trimBiasRatePerSecond?: number;
	/** Cap on total scripted trim magnitude. */
	trimBiasMax?: number;
}

/**
 * Success/failure criteria the scenario runner evaluates against truth state.
 */
export interface ScenarioCriteria {
	/** Success: aircraft altitude AGL reaches this value without any failure firing (m AGL). */
	successAltitudeAglMeters?: number;
	/** Failure: AoA above airframe's alphaStall for at least this long (seconds). */
	failureSustainedStallSeconds?: number;
	/** Failure: altitude AGL falls below this (m). Typical: 0 = touched ground off-runway. */
	failureMinimumAltitudeAglMeters?: number;
	/** Hard timeout -- scenario aborts as failure past this many seconds. undefined = never. */
	timeoutSeconds?: number;
	/** When true, the scenario never ends on its own (Playground). */
	endless?: boolean;
}

/** Initial FDM truth state a scenario starts from. */
export interface ScenarioInitialState {
	altitude: number;
	groundElevation: number;
	u: number;
	w: number;
	pitch: number;
	pitchRate: number;
	roll: number;
	rollRate: number;
	yawRate: number;
	heading: number;
	throttle: number;
	elevator: number;
	trim: number;
	aileron: number;
	rudder: number;
	brake: boolean;
	autoCoordinate: boolean;
	flaps: SimFlapDegrees;
	onGround: boolean;
}

/**
 * A checkable step in a scenario. The runner evaluates the step's
 * predicate against the current truth state and advances when the
 * accumulator reaches `holdSeconds`.
 */
export interface ScenarioStepDefinition {
	id: string;
	title: string;
	instruction: string;
	/**
	 * Predicate that returns true when the condition for this step is met
	 * for the current tick. Hold seconds stack up while it returns true and
	 * reset when it returns false.
	 */
	check: (truth: FdmTruthState, ctx: ScenarioStepContext) => boolean;
	/** Seconds the predicate must stay true for the step to count as done. */
	holdSeconds?: number;
}

/** Additional context the scenario runner hands to step predicates. */
export interface ScenarioStepContext {
	elapsedSeconds: number;
	throttle: number;
	brakeOn: boolean;
}

/** Full scenario definition consumed by the BC runner and the app UI. */
export interface ScenarioDefinition {
	id: SimScenarioId;
	title: string;
	tagline: string;
	objective: string;
	briefing: string;
	recommendedOrder: number;
	recommendationLabel: string;
	aircraft: SimAircraftId;
	initial: ScenarioInitialState;
	criteria: ScenarioCriteria;
	wind: ScenarioWind;
	/** Optional step ladder; present for tutorial-style scenarios. */
	steps?: readonly ScenarioStepDefinition[];
	/** Optional scripted input stream applied each tick. */
	scriptedInput?: ScenarioScriptedInput;
	/** Runway heading in degrees true. */
	runwayHeadingDegrees: number;
}

/**
 * Terminal result produced when a scenario run ends (success / failure /
 * timeout / user-aborted).
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

/**
 * Per-snapshot tutorial state the runner exposes to the UI. Undefined when
 * the scenario has no step ladder.
 */
export interface ScenarioStepState {
	currentStepIndex: number;
	totalSteps: number;
	currentStepId: string;
	currentStepTitle: string;
	currentStepInstruction: string;
	/** Seconds the current step has been satisfied continuously. */
	holdAccumulatorSeconds: number;
	/** Required hold (seconds) for the current step. 0 if instantaneous. */
	holdRequiredSeconds: number;
	completed: boolean;
}
