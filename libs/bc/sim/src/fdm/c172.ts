/**
 * Cessna 172-class aircraft configuration for the Phase 0.5 hand-rolled
 * FDM.
 *
 * Values match published C172 performance numbers at typical GA training
 * weights. Reference approximations, not a certification dataset. Phase 2
 * will replace this with a JSBSim dataset.
 *
 * Longitudinal references:
 * - Wing area 16.17 m^2 (174 ft^2), span 11.0 m
 * - Mass ~1043 kg (2300 lb) training weight
 * - CL_alpha ~5.7 / rad, CL_max ~1.6 clean
 * - Stall alpha ~16 deg absolute AoA; stall warning ~11 deg
 * - CD0 ~0.027, Oswald 0.75, AR ~7.32
 * - Max thrust ~1100 N static sea level (160 HP prop at ~70% eff takeoff)
 *
 * Lateral references:
 * - Roll rate ~60 deg/s at full aileron
 * - Yaw damping tuned to damp out dutch roll in a few seconds
 * - Adverse yaw small but noticeable with auto-coordinate OFF
 *
 * V-speeds (C172S POH typical):
 * - Vs0 33, Vs1 44, Vr 55, Vx 62, Vy 74, Va 98, Vno 129, Vne 163, Vfe 110 (KIAS)
 */

import { SIM_AIRCRAFT_IDS, SIM_FLAP_NOTCHES, SIM_KNOTS_PER_METER_PER_SECOND } from '@ab/constants';
import type { AircraftConfig } from '../types';

const DEG_TO_RAD = Math.PI / 180;

function knotsToMetersPerSecond(kias: number): number {
	return kias / SIM_KNOTS_PER_METER_PER_SECOND;
}

export const C172_CONFIG: AircraftConfig = {
	id: SIM_AIRCRAFT_IDS.C172,
	displayName: 'Cessna 172',
	mass: 1043,
	wingArea: 16.17,
	wingSpan: 11.0,
	liftSlope: 5.7,
	clMax: 1.6,
	alphaZeroLift: -1.5 * DEG_TO_RAD,
	alphaStall: 16 * DEG_TO_RAD,
	clPostStall: 0.9,
	// ~5 deg below critical AoA -- matches a mechanical stall warning tab
	// activating at Vs + 5 to 10 knots.
	alphaStallWarning: 11 * DEG_TO_RAD,
	cd0: 0.027,
	oswald: 0.75,
	aspectRatio: 7.32,
	// Constant-thrust model (no prop curve). Chosen between static thrust
	// (~2300 N) and cruise thrust (~1600 N) so takeoff roll and cruise both
	// land in the right neighborhood. Phase 2 will replace with a prop map.
	maxThrustSeaLevel: 1800,
	// Authority: full elevator is enough to overcome natural stability at
	// slow speeds (so the pilot can stall the airplane on purpose, as
	// happens in real life). Scales with dynamic pressure, so cruise-speed
	// pulls feel firm but stall-speed pulls are easier.
	pitchAuthority: 4.0,
	// Aerodynamic damping on q. Picked so that pitch oscillations damp out
	// in a few seconds after an elevator pulse.
	pitchDamping: 4.0,
	// Natural AoA-restoring stability: airframe wants to fly at trimAlpha.
	// Higher values = more nose-heavy / more stable.
	pitchStability: 12.0,
	// Trim AoA chosen so that neutral elevator at ~85 KIAS cruise sits
	// close to 1 G level flight without pilot input.
	trimAlpha: 3.0 * DEG_TO_RAD,
	// Roll: at cruise TAS, full aileron yields ~60 deg/s steady roll rate.
	// Steady-state p = authority / damping -> 4.2 / 4.0 ~ 1.05 rad/s ~ 60 deg/s.
	rollAuthority: 4.2,
	rollDamping: 4.0,
	bankLimit: 80 * DEG_TO_RAD,
	// Yaw: full rudder at cruise yields a noticeable yaw rate; damping
	// brings it back quickly.
	rudderAuthority: 1.6,
	yawDamping: 1.8,
	adverseYaw: 0.35,
	// Trim range: +/- 20% bias on elevator command.
	trimRange: 0.2,
	// Flap effects. 30 deg flaps ~ +0.9 CL, +0.07 CD (reduces Vs0 to ~33 KIAS).
	clFlapsPer10Deg: 0.3,
	cdFlapsPer10Deg: 0.023,
	flapMaxDeg: SIM_FLAP_NOTCHES[SIM_FLAP_NOTCHES.length - 1],
	rollingFriction: 0.04,
	brakeFriction: 0.5,
	// Ground steering: rudder gives roughly 5 deg/s heading change at 10 m/s
	// with full rudder.
	groundSteering: 0.009,
	idleRpm: 800,
	maxRpm: 2600,
	greenArcRpmLow: 2100,
	greenArcRpmHigh: 2500,
	vS0: knotsToMetersPerSecond(33),
	vS1: knotsToMetersPerSecond(44),
	vR: knotsToMetersPerSecond(55),
	vX: knotsToMetersPerSecond(62),
	vY: knotsToMetersPerSecond(74),
	vA: knotsToMetersPerSecond(98),
	vNo: knotsToMetersPerSecond(129),
	vNe: knotsToMetersPerSecond(163),
	vFe: knotsToMetersPerSecond(110),
};
