/**
 * Hand-rolled 3-DoF flight dynamics model for Phase 0.
 *
 * State vector (body-axis-ish, simplified to 2D longitudinal):
 *
 * - x         horizontal position along flight path (m)
 * - altitude  altitude MSL (m)
 * - u         body-x velocity (m/s) -- approximately forward velocity
 * - w         body-z velocity (m/s), positive up -- approximately vertical
 * - pitch     theta, rad -- body pitch angle relative to horizon
 * - pitchRate q, rad/s
 *
 * The model is longitudinal only: no roll, no yaw, no sideslip. Lift and
 * drag are computed from alpha = pitch - flightPathAngle using a linear-
 * up-to-stall CL(alpha) curve with a smooth drop beyond alphaStall.
 * Integration is RK4 at the caller's chosen dt (typically 1/120 s).
 *
 * Determinism: given the same initial state, inputs stream, and dt, the
 * output trajectory is bit-identical across runs. No Math.random(), no
 * floating-point non-determinism sources (Date.now, performance.now).
 */

import { SIM_GRAVITY_M_S2, SIM_SEA_LEVEL_DENSITY_KG_M3 } from '@ab/constants';
import type { AircraftConfig, FdmInputs, FdmTruthState } from '../types';

/** Internal continuous state vector used by the integrator. */
interface StateVector {
	x: number;
	altitude: number;
	u: number;
	w: number;
	pitch: number;
	pitchRate: number;
	t: number;
}

/** Instantaneous derivatives of the state vector. */
interface StateDerivatives {
	dx: number;
	dAltitude: number;
	du: number;
	dw: number;
	dPitch: number;
	dPitchRate: number;
}

/**
 * Compute CL(alpha) with a smooth peak around alphaStall. Below stall:
 * linear with slope liftSlope. Above stall: cosine rolloff from clMax down
 * to clPostStall over ~8 degrees of additional alpha.
 */
export function liftCoefficient(alpha: number, cfg: AircraftConfig): number {
	const linearCl = cfg.liftSlope * (alpha - cfg.alphaZeroLift);
	if (alpha <= cfg.alphaStall) {
		// Cap at clMax even in the linear region -- the linear model can
		// exceed clMax slightly before the stall break, which is unphysical.
		return Math.min(linearCl, cfg.clMax);
	}
	const POST_STALL_WIDTH = 8 * (Math.PI / 180);
	const excess = Math.min((alpha - cfg.alphaStall) / POST_STALL_WIDTH, 1);
	// Smooth cosine transition from clMax at alphaStall to clPostStall at
	// alphaStall + POST_STALL_WIDTH.
	const t = 0.5 * (1 - Math.cos(Math.PI * excess));
	return cfg.clMax + t * (cfg.clPostStall - cfg.clMax);
}

/** Drag coefficient: parasite + induced. Induced penalty survives stall. */
export function dragCoefficient(cl: number, cfg: AircraftConfig): number {
	const induced = (cl * cl) / (Math.PI * cfg.aspectRatio * cfg.oswald);
	return cfg.cd0 + induced;
}

/**
 * Pitching moment model. Combines three effects:
 *
 * 1. Natural stability: restoring moment proportional to (trimAlpha - alpha).
 *    A positive coefficient means the airframe wants to return toward trim.
 * 2. Pitch damping: opposes pitch rate, scaled by dynamic-pressure-like
 *    proxy so it fades at low speed (stall).
 * 3. Pilot authority: elevator input directly commands pitching accel.
 *
 * Returns d(pitchRate)/dt in rad/s^2.
 */
export function pitchingAcceleration(
	alpha: number,
	pitchRate: number,
	elevator: number,
	trueAirspeed: number,
	cfg: AircraftConfig,
): number {
	// Dynamic-pressure-like scaling: aerodynamic surfaces lose authority as
	// speed drops. We normalize by (vS1)^2 so authority is ~1.0 at stall
	// speed; this keeps the elevator feel consistent in normal flight but
	// softens it in deep stall.
	const qScale = Math.max(0.05, (trueAirspeed * trueAirspeed) / (cfg.vS1 * cfg.vS1));
	const restoring = cfg.pitchStability * (cfg.trimAlpha - alpha) * qScale;
	const damping = -cfg.pitchDamping * pitchRate * qScale;
	const pilot = cfg.pitchAuthority * elevator * qScale;
	return restoring + damping + pilot;
}

/**
 * Standard-day air density simple lapse (kg/m^3). For Phase 0 we ignore
 * non-standard atmospheres; this is good enough that stall-speed-vs-altitude
 * shows up but doesn't dominate.
 */
export function airDensity(altitudeMsl: number): number {
	// Simple exponential atmosphere; scale height ~8500 m.
	const SCALE_HEIGHT_M = 8500;
	return SIM_SEA_LEVEL_DENSITY_KG_M3 * Math.exp(-altitudeMsl / SCALE_HEIGHT_M);
}

/** Derive AoA from velocity components and pitch. */
export function angleOfAttack(pitch: number, u: number, w: number): number {
	// Flight path angle gamma = atan2(w, u). AoA = pitch - gamma.
	// When the airplane is stationary (u == 0, w == 0), alpha collapses to
	// pitch itself, which is the right answer on the runway.
	if (Math.abs(u) < 1e-4 && Math.abs(w) < 1e-4) {
		return pitch;
	}
	const flightPathAngle = Math.atan2(w, u);
	return pitch - flightPathAngle;
}

/**
 * Compute the full set of state derivatives at a given state + input.
 * This is the right-hand side of the ODE the RK4 integrator advances.
 */
export function derivatives(
	state: StateVector,
	inputs: FdmInputs,
	cfg: AircraftConfig,
	onGround: boolean,
): StateDerivatives {
	const { u, w, pitch, pitchRate } = state;
	const tas = Math.hypot(u, w);
	const alpha = angleOfAttack(pitch, u, w);

	const rho = airDensity(state.altitude);
	const dynamicPressure = 0.5 * rho * tas * tas;

	const cl = liftCoefficient(alpha, cfg);
	const cd = dragCoefficient(cl, cfg);

	const lift = dynamicPressure * cfg.wingArea * cl;
	const drag = dynamicPressure * cfg.wingArea * cd;

	// Thrust along body-x. Simple altitude lapse: thrust drops with density.
	const densityRatio = rho / SIM_SEA_LEVEL_DENSITY_KG_M3;
	const thrust = inputs.throttle * cfg.maxThrustSeaLevel * densityRatio;

	// Flight path angle: direction of the velocity vector.
	const gamma = tas > 1e-4 ? Math.atan2(w, u) : pitch;

	// Forces in earth frame. Lift acts perpendicular to velocity; drag along
	// negative velocity; thrust along body-x (aligned with pitch); gravity
	// straight down.
	const cosGamma = Math.cos(gamma);
	const sinGamma = Math.sin(gamma);
	const cosPitch = Math.cos(pitch);
	const sinPitch = Math.sin(pitch);

	// Earth-frame acceleration: sum of forces / mass, minus gravity on the
	// vertical component. Positive z = up.
	const fxEarth = thrust * cosPitch - drag * cosGamma - lift * sinGamma;
	const fzEarth = thrust * sinPitch - drag * sinGamma + lift * cosGamma - cfg.mass * SIM_GRAVITY_M_S2;

	const aXEarth = fxEarth / cfg.mass;
	let aZEarth = fzEarth / cfg.mass;

	// Ground contact: if sitting on the ground and net vertical accel is
	// downward, suppress descent. Also zero vertical velocity and apply a
	// simple rolling-friction brake on horizontal motion when stopped.
	if (onGround) {
		if (aZEarth < 0) aZEarth = 0;
	}

	const qDot = pitchingAcceleration(alpha, pitchRate, inputs.elevator, tas, cfg);

	// We treat u and w as earth-frame velocity components in this
	// longitudinal 2-D model. This simplification means "u" is horizontal
	// ground speed and "w" is vertical speed (positive up). Pitch is
	// tracked separately and drives aerodynamic force orientation through
	// alpha. This keeps the integration straightforward without sacrificing
	// realism for Phase 0 scenarios.
	return {
		dx: u,
		dAltitude: w,
		du: aXEarth,
		dw: aZEarth,
		dPitch: pitchRate,
		dPitchRate: qDot,
	};
}

function addStep(base: StateVector, d: StateDerivatives, dt: number): StateVector {
	return {
		x: base.x + d.dx * dt,
		altitude: base.altitude + d.dAltitude * dt,
		u: base.u + d.du * dt,
		w: base.w + d.dw * dt,
		pitch: base.pitch + d.dPitch * dt,
		pitchRate: base.pitchRate + d.dPitchRate * dt,
		t: base.t + dt,
	};
}

function scaleAndSum(
	a: StateDerivatives,
	b: StateDerivatives,
	c: StateDerivatives,
	d: StateDerivatives,
): StateDerivatives {
	return {
		dx: (a.dx + 2 * b.dx + 2 * c.dx + d.dx) / 6,
		dAltitude: (a.dAltitude + 2 * b.dAltitude + 2 * c.dAltitude + d.dAltitude) / 6,
		du: (a.du + 2 * b.du + 2 * c.du + d.du) / 6,
		dw: (a.dw + 2 * b.dw + 2 * c.dw + d.dw) / 6,
		dPitch: (a.dPitch + 2 * b.dPitch + 2 * c.dPitch + d.dPitch) / 6,
		dPitchRate: (a.dPitchRate + 2 * b.dPitchRate + 2 * c.dPitchRate + d.dPitchRate) / 6,
	};
}

/**
 * Advance the state one dt using RK4. The aircraft is considered "on
 * ground" if altitude <= groundElevation *before* integration; ground
 * contact is sticky across the RK4 stages to avoid the integrator pushing
 * the airframe through the ground mid-stage.
 */
export function rk4Step(
	state: StateVector,
	inputs: FdmInputs,
	cfg: AircraftConfig,
	groundElevation: number,
	dt: number,
): StateVector {
	const onGround = state.altitude <= groundElevation + 1e-6;

	const k1 = derivatives(state, inputs, cfg, onGround);
	const s2 = addStep(state, k1, dt / 2);
	const k2 = derivatives(s2, inputs, cfg, onGround);
	const s3 = addStep(state, k2, dt / 2);
	const k3 = derivatives(s3, inputs, cfg, onGround);
	const s4 = addStep(state, k3, dt);
	const k4 = derivatives(s4, inputs, cfg, onGround);

	const combined = scaleAndSum(k1, k2, k3, k4);
	const next = addStep(state, combined, dt);

	// Post-step ground clamp: if the integrator pushed us below the ground,
	// snap altitude and zero the vertical velocity. Keep horizontal motion
	// but bleed it slightly (rolling friction) so a sitting airplane doesn't
	// creep forever.
	if (next.altitude < groundElevation) {
		next.altitude = groundElevation;
		if (next.w < 0) next.w = 0;
		// Simple rolling resistance: drop horizontal speed ~0.2 m/s^2 per
		// second of ground contact when throttle is below idle-ish.
		if (inputs.throttle < 0.2 && next.u > 0) {
			const brake = 2.0 * dt;
			next.u = Math.max(0, next.u - brake);
		}
	}

	return next;
}

/** Build the public truth snapshot from an internal state vector. */
export function truthStateFromVector(state: StateVector, cfg: AircraftConfig, groundElevation: number): FdmTruthState {
	const tas = Math.hypot(state.u, state.w);
	const alpha = angleOfAttack(state.pitch, state.u, state.w);
	const cl = liftCoefficient(alpha, cfg);
	const cd = dragCoefficient(cl, cfg);
	const rho = airDensity(state.altitude);
	const dynamicPressure = 0.5 * rho * tas * tas;
	const lift = dynamicPressure * cfg.wingArea * cl;
	const weight = cfg.mass * SIM_GRAVITY_M_S2;
	const loadFactor = weight > 0 ? lift / weight : 0;
	// Phase 0 IAS == TAS (sea-level-equivalent density isn't modelled).
	const ias = tas;

	return {
		t: state.t,
		x: state.x,
		altitude: state.altitude,
		groundElevation,
		u: state.u,
		w: state.w,
		pitch: state.pitch,
		pitchRate: state.pitchRate,
		alpha,
		trueAirspeed: tas,
		indicatedAirspeed: ias,
		verticalSpeed: state.w,
		liftCoefficient: cl,
		dragCoefficient: cd,
		loadFactor,
		onGround: state.altitude <= groundElevation + 1e-6,
		stalled: alpha > cfg.alphaStall,
	};
}

/** Ergonomic type alias for external callers. */
export type FdmStateVector = StateVector;
