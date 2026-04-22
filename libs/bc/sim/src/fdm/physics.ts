/**
 * Hand-rolled flight dynamics model for Phase 0.5.
 *
 * The model is split into two tiers:
 *
 * 1. Longitudinal plant (RK4): altitude, body-relative u/w, pitch, pitch
 *    rate. This is the original Phase 0 plant with trim, flaps, parking
 *    brake, and stall-warning tweaks layered in.
 * 2. Lateral kinematics (forward-Euler within each tick): roll, roll rate,
 *    yaw rate, heading. Rolling / yawing is dominated by first-order
 *    damping so a small Euler step at 120 Hz is stable and indistinguish-
 *    able from RK4 at the precision we need for cockpit display.
 *
 * The two tiers talk through the coordinated-turn equation: bank angle
 * produces a horizontal component of lift that curves the flight path,
 * which in turn drives the heading rate. The auto-coordinate autopilot
 * (when enabled) auto-rudders so the slip ball stays centered under
 * aileron input.
 *
 * Wind: u/w are tracked as air-relative body velocities (aerodynamics stay
 * valid). Earth-frame position is derived from ground velocity = air
 * velocity rotated by heading, plus the wind vector. The wind vector is
 * configured per scenario and does not change mid-run in Phase 0.5.
 *
 * Determinism: given the same initial state, inputs stream, and dt, the
 * output trajectory is bit-identical across runs. No Math.random(), no
 * floating-point non-determinism sources (Date.now, performance.now).
 */

import { SIM_GRAVITY_M_S2, SIM_SEA_LEVEL_DENSITY_KG_M3, type SimFlapDegrees } from '@ab/constants';
import type { AircraftConfig, FdmInputs, FdmTruthState } from '../types';

/** Internal continuous state vector used by the longitudinal integrator. */
interface LongitudinalState {
	x: number;
	altitude: number;
	u: number;
	w: number;
	pitch: number;
	pitchRate: number;
	t: number;
}

/** Full FDM state. */
export interface FdmStateVector extends LongitudinalState {
	/** Earth-frame north position (m). */
	posNorth: number;
	/** Earth-frame east position (m). */
	posEast: number;
	roll: number;
	rollRate: number;
	yawRate: number;
	heading: number;
	engineRpm: number;
	/** Scenario-scripted trim bias accumulator (separate from pilot trim). */
	scriptedTrim: number;
}

/** Instantaneous derivatives for the longitudinal RK4 step. */
interface LongitudinalDerivatives {
	dx: number;
	dAltitude: number;
	du: number;
	dw: number;
	dPitch: number;
	dPitchRate: number;
}

/** Wind vector used by the FDM. */
export interface WindVector {
	/** Wind going TOWARD this direction, in earth frame: [north, east], m/s. */
	north: number;
	east: number;
}

/** Clamp helper. */
export function clamp(v: number, lo: number, hi: number): number {
	return v < lo ? lo : v > hi ? hi : v;
}

/**
 * CL(alpha) with a smooth peak around alphaStall. Flaps shift the whole
 * curve upward (more lift at a given AoA, earlier reach to clMax).
 */
export function liftCoefficient(alpha: number, cfg: AircraftConfig, flapsDeg: number = 0): number {
	const clFlaps = (flapsDeg / 10) * cfg.clFlapsPer10Deg;
	const clMaxEff = cfg.clMax + clFlaps;
	const linearCl = cfg.liftSlope * (alpha - cfg.alphaZeroLift) + clFlaps;
	if (alpha <= cfg.alphaStall) {
		return Math.min(linearCl, clMaxEff);
	}
	const POST_STALL_WIDTH = 8 * (Math.PI / 180);
	const excess = Math.min((alpha - cfg.alphaStall) / POST_STALL_WIDTH, 1);
	const t = 0.5 * (1 - Math.cos(Math.PI * excess));
	return clMaxEff + t * (cfg.clPostStall - clMaxEff);
}

/** Drag coefficient: parasite + induced + flap drag. */
export function dragCoefficient(cl: number, cfg: AircraftConfig, flapsDeg: number = 0): number {
	const induced = (cl * cl) / (Math.PI * cfg.aspectRatio * cfg.oswald);
	const flapDrag = (flapsDeg / 10) * cfg.cdFlapsPer10Deg;
	return cfg.cd0 + induced + flapDrag;
}

/**
 * Pitching moment model. Combines natural stability, pitch damping, and
 * pilot authority (elevator + trim). Dynamic-pressure scaling is used so
 * authority fades in deep stall.
 */
export function pitchingAcceleration(
	alpha: number,
	pitchRate: number,
	elevatorEffective: number,
	trueAirspeed: number,
	cfg: AircraftConfig,
): number {
	const qScale = Math.max(0.05, (trueAirspeed * trueAirspeed) / (cfg.vS1 * cfg.vS1));
	const restoring = cfg.pitchStability * (cfg.trimAlpha - alpha) * qScale;
	const damping = -cfg.pitchDamping * pitchRate * qScale;
	const pilot = cfg.pitchAuthority * elevatorEffective * qScale;
	return restoring + damping + pilot;
}

/** Standard-day air density simple lapse (kg/m^3). */
export function airDensity(altitudeMsl: number): number {
	const SCALE_HEIGHT_M = 8500;
	return SIM_SEA_LEVEL_DENSITY_KG_M3 * Math.exp(-altitudeMsl / SCALE_HEIGHT_M);
}

/** Derive AoA from velocity components and pitch. */
export function angleOfAttack(pitch: number, u: number, w: number): number {
	if (Math.abs(u) < 1e-4 && Math.abs(w) < 1e-4) {
		return pitch;
	}
	const flightPathAngle = Math.atan2(w, u);
	return pitch - flightPathAngle;
}

/**
 * Effective elevator command: pilot + trim + scenario-scripted bias.
 */
export function effectiveElevator(inputs: FdmInputs, cfg: AircraftConfig, scriptedTrim: number = 0): number {
	const trimBias = clamp(inputs.trim + scriptedTrim, -1, 1) * cfg.trimRange;
	return clamp(inputs.elevator + trimBias, -1, 1);
}

/**
 * Standard-rate turn heading rate given bank angle and TAS (m/s).
 * Derived from horizontal lift component: psi_dot = g * tan(phi) / V.
 */
export function coordinatedTurnRate(bank: number, trueAirspeed: number): number {
	if (trueAirspeed < 1e-3) return 0;
	return (SIM_GRAVITY_M_S2 * Math.tan(bank)) / trueAirspeed;
}

/**
 * Slip / skid ball from the ratio of actual yaw rate to the coordinated
 * turn rate at current bank. Returns roughly -1..+1; saturates smoothly.
 * Positive = skid (yawing faster than coordinated); negative = slip.
 */
export function slipBall(yawRate: number, bank: number, trueAirspeed: number): number {
	const coordinated = coordinatedTurnRate(bank, trueAirspeed);
	// Full deflection maps to ~5 deg/s mismatch.
	const SCALE = 5 * (Math.PI / 180);
	const diff = yawRate - coordinated;
	return clamp(diff / SCALE, -1, 1);
}

/**
 * Compute the longitudinal state derivatives at a given state + input.
 */
export function derivatives(
	state: LongitudinalState,
	inputs: FdmInputs,
	cfg: AircraftConfig,
	onGround: boolean,
	bank: number,
	scriptedTrim: number,
): LongitudinalDerivatives {
	const { u, w, pitch, pitchRate } = state;
	const tas = Math.hypot(u, w);
	const alpha = angleOfAttack(pitch, u, w);

	const rho = airDensity(state.altitude);
	const dynamicPressure = 0.5 * rho * tas * tas;

	const cl = liftCoefficient(alpha, cfg, inputs.flaps);
	const cd = dragCoefficient(cl, cfg, inputs.flaps);

	const lift = dynamicPressure * cfg.wingArea * cl;
	const drag = dynamicPressure * cfg.wingArea * cd;

	const densityRatio = rho / SIM_SEA_LEVEL_DENSITY_KG_M3;
	const thrust = inputs.throttle * cfg.maxThrustSeaLevel * densityRatio;

	const gamma = tas > 1e-4 ? Math.atan2(w, u) : pitch;
	const cosGamma = Math.cos(gamma);
	const sinGamma = Math.sin(gamma);
	const cosPitch = Math.cos(pitch);
	const sinPitch = Math.sin(pitch);
	const cosBank = Math.cos(bank);

	// Only vertical component of lift supports weight while banked; the
	// horizontal component curves the flight path (handled in yaw math).
	const liftVertical = lift * cosBank;

	const fxEarth = thrust * cosPitch - drag * cosGamma - liftVertical * sinGamma;
	const fzEarth = thrust * sinPitch - drag * sinGamma + liftVertical * cosGamma - cfg.mass * SIM_GRAVITY_M_S2;

	let aXEarth = fxEarth / cfg.mass;
	let aZEarth = fzEarth / cfg.mass;

	const elevEff = effectiveElevator(inputs, cfg, scriptedTrim);
	const qDot = pitchingAcceleration(alpha, pitchRate, elevEff, tas, cfg);

	if (onGround) {
		if (aZEarth < 0) aZEarth = 0;
		// Rolling / brake friction opposes forward motion.
		const mu = inputs.brake ? cfg.brakeFriction : cfg.rollingFriction;
		const frictionAccel = mu * SIM_GRAVITY_M_S2;
		if (u > 0) {
			aXEarth = aXEarth - frictionAccel;
		} else if (inputs.brake) {
			// Static brake: no motion.
			aXEarth = 0;
		}
	}

	return {
		dx: u,
		dAltitude: w,
		du: aXEarth,
		dw: aZEarth,
		dPitch: pitchRate,
		dPitchRate: qDot,
	};
}

function addStep(base: LongitudinalState, d: LongitudinalDerivatives, dt: number): LongitudinalState {
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
	a: LongitudinalDerivatives,
	b: LongitudinalDerivatives,
	c: LongitudinalDerivatives,
	d: LongitudinalDerivatives,
): LongitudinalDerivatives {
	return {
		dx: (a.dx + 2 * b.dx + 2 * c.dx + d.dx) / 6,
		dAltitude: (a.dAltitude + 2 * b.dAltitude + 2 * c.dAltitude + d.dAltitude) / 6,
		du: (a.du + 2 * b.du + 2 * c.du + d.du) / 6,
		dw: (a.dw + 2 * b.dw + 2 * c.dw + d.dw) / 6,
		dPitch: (a.dPitch + 2 * b.dPitch + 2 * c.dPitch + d.dPitch) / 6,
		dPitchRate: (a.dPitchRate + 2 * b.dPitchRate + 2 * c.dPitchRate + d.dPitchRate) / 6,
	};
}

/** Advance the longitudinal state one dt using RK4. */
function rk4LongitudinalStep(
	state: LongitudinalState,
	inputs: FdmInputs,
	cfg: AircraftConfig,
	groundElevation: number,
	bank: number,
	scriptedTrim: number,
	dt: number,
): LongitudinalState {
	const onGround = state.altitude <= groundElevation + 1e-6;

	const k1 = derivatives(state, inputs, cfg, onGround, bank, scriptedTrim);
	const s2 = addStep(state, k1, dt / 2);
	const k2 = derivatives(s2, inputs, cfg, onGround, bank, scriptedTrim);
	const s3 = addStep(state, k2, dt / 2);
	const k3 = derivatives(s3, inputs, cfg, onGround, bank, scriptedTrim);
	const s4 = addStep(state, k3, dt);
	const k4 = derivatives(s4, inputs, cfg, onGround, bank, scriptedTrim);

	const combined = scaleAndSum(k1, k2, k3, k4);
	const next = addStep(state, combined, dt);

	// Post-step ground clamp.
	if (next.altitude < groundElevation) {
		next.altitude = groundElevation;
		if (next.w < 0) next.w = 0;
	}
	if (onGround && next.u < 0) next.u = 0;

	return next;
}

/**
 * Advance roll, yaw, and heading by one dt. First-order plants with
 * damping; forward-Euler is fine at 120 Hz.
 */
function lateralStep(
	state: FdmStateVector,
	inputs: FdmInputs,
	cfg: AircraftConfig,
	trueAirspeed: number,
	onGround: boolean,
	dt: number,
): { roll: number; rollRate: number; yawRate: number; heading: number } {
	const qScale = Math.max(0.05, (trueAirspeed * trueAirspeed) / (cfg.vS1 * cfg.vS1));

	let roll = state.roll;
	let rollRate = state.rollRate;
	let yawRate = state.yawRate;
	let heading = state.heading;

	if (onGround) {
		// Tricycle gear pins roll to zero. Heading changes via rudder
		// ground-steering proportional to ground speed.
		roll = 0;
		rollRate = 0;
		const psiDot = cfg.groundSteering * inputs.rudder * Math.max(0, trueAirspeed);
		yawRate = psiDot;
		heading = heading + psiDot * dt;
	} else {
		const pilotRoll = cfg.rollAuthority * inputs.aileron * qScale;
		const rollDamp = -cfg.rollDamping * rollRate * qScale;
		const pDot = pilotRoll + rollDamp;
		rollRate = rollRate + pDot * dt;
		roll = roll + rollRate * dt;
		if (roll > cfg.bankLimit) {
			roll = cfg.bankLimit;
			if (rollRate > 0) rollRate = 0;
		} else if (roll < -cfg.bankLimit) {
			roll = -cfg.bankLimit;
			if (rollRate < 0) rollRate = 0;
		}

		const coordinated = coordinatedTurnRate(roll, trueAirspeed);
		if (inputs.autoCoordinate) {
			// Auto-rudder: pin yaw rate to the coordinated turn rate so the
			// ball stays centered. Pilot rudder input biases the yaw rate
			// above/beyond coordinated (useful for teaching slips with auto-
			// coordinate ON -- deliberate rudder still produces a ball).
			const rudderYaw = cfg.rudderAuthority * inputs.rudder * qScale;
			const pilotBias = rudderYaw * 0.25; // small deliberate bias per rudder
			yawRate = coordinated + pilotBias;
		} else {
			const rudderYaw = cfg.rudderAuthority * inputs.rudder * qScale;
			const adverse = -cfg.adverseYaw * inputs.aileron * qScale;
			const damp = -cfg.yawDamping * (yawRate - coordinated) * qScale;
			const rDot = rudderYaw + adverse + damp;
			yawRate = yawRate + rDot * dt;
		}
		heading = heading + yawRate * dt;
	}

	// Normalize heading to [0, 2π).
	heading = heading % (2 * Math.PI);
	if (heading < 0) heading += 2 * Math.PI;

	return { roll, rollRate, yawRate, heading };
}

/** Engine RPM follows throttle with a first-order lag. */
function updateRpm(currentRpm: number, throttle: number, cfg: AircraftConfig, dt: number): number {
	const target = cfg.idleRpm + (cfg.maxRpm - cfg.idleRpm) * throttle;
	const tau = 0.3;
	const alpha = 1 - Math.exp(-dt / tau);
	return currentRpm + (target - currentRpm) * alpha;
}

/**
 * Advance the combined state one dt. Wind is applied to earth-frame
 * position only; aero math stays in the moving air mass.
 */
export function fdmStep(
	state: FdmStateVector,
	inputs: FdmInputs,
	cfg: AircraftConfig,
	groundElevation: number,
	wind: WindVector,
	scriptedTrim: number,
	dt: number,
): FdmStateVector {
	const long = rk4LongitudinalStep(
		{
			x: state.x,
			altitude: state.altitude,
			u: state.u,
			w: state.w,
			pitch: state.pitch,
			pitchRate: state.pitchRate,
			t: state.t,
		},
		inputs,
		cfg,
		groundElevation,
		state.roll,
		scriptedTrim,
		dt,
	);

	const tasAfter = Math.hypot(long.u, long.w);
	const onGroundAfter = long.altitude <= groundElevation + 1e-6;

	const lateral = lateralStep(state, inputs, cfg, tasAfter, onGroundAfter, dt);

	const cosH = Math.cos(lateral.heading);
	const sinH = Math.sin(lateral.heading);
	const vNorthAir = long.u * cosH;
	const vEastAir = long.u * sinH;
	const vNorth = vNorthAir + wind.north;
	const vEast = vEastAir + wind.east;
	const posNorth = state.posNorth + vNorth * dt;
	const posEast = state.posEast + vEast * dt;

	const engineRpm = updateRpm(state.engineRpm, inputs.throttle, cfg, dt);

	return {
		...long,
		posNorth,
		posEast,
		roll: lateral.roll,
		rollRate: lateral.rollRate,
		yawRate: lateral.yawRate,
		heading: lateral.heading,
		engineRpm,
		scriptedTrim: state.scriptedTrim,
	};
}

/** Build the public truth snapshot from an internal state vector. */
export function truthStateFromVector(
	state: FdmStateVector,
	cfg: AircraftConfig,
	inputs: FdmInputs,
	groundElevation: number,
	wind: WindVector,
): FdmTruthState {
	const tas = Math.hypot(state.u, state.w);
	const alpha = angleOfAttack(state.pitch, state.u, state.w);
	const cl = liftCoefficient(alpha, cfg, inputs.flaps);
	const cd = dragCoefficient(cl, cfg, inputs.flaps);
	const rho = airDensity(state.altitude);
	const dynamicPressure = 0.5 * rho * tas * tas;
	const lift = dynamicPressure * cfg.wingArea * cl;
	const weight = cfg.mass * SIM_GRAVITY_M_S2;
	const loadFactor = weight > 0 ? lift / weight : 0;
	const ias = tas;
	const onGround = state.altitude <= groundElevation + 1e-6;

	// Ground speed magnitude (earth frame).
	const cosH = Math.cos(state.heading);
	const sinH = Math.sin(state.heading);
	const vNorth = state.u * cosH + wind.north;
	const vEast = state.u * sinH + wind.east;
	const groundSpeed = Math.hypot(vNorth, vEast);

	const elevEff = effectiveElevator(inputs, cfg, state.scriptedTrim);

	return {
		t: state.t,
		x: state.x,
		altitude: state.altitude,
		groundElevation,
		u: state.u,
		w: state.w,
		pitch: state.pitch,
		pitchRate: state.pitchRate,
		roll: state.roll,
		rollRate: state.rollRate,
		yawRate: state.yawRate,
		heading: state.heading,
		alpha,
		trueAirspeed: tas,
		indicatedAirspeed: ias,
		groundSpeed,
		verticalSpeed: state.w,
		liftCoefficient: cl,
		dragCoefficient: cd,
		loadFactor,
		slipBall: slipBall(state.yawRate, state.roll, tas),
		onGround,
		brakeOn: inputs.brake,
		stallWarning: alpha > cfg.alphaStallWarning,
		stalled: alpha > cfg.alphaStall,
		flapsDegrees: inputs.flaps as SimFlapDegrees,
		elevatorEffective: elevEff,
		engineRpm: state.engineRpm,
	};
}
