/**
 * Cessna 172-class aircraft configuration for the Phase 0 hand-rolled FDM.
 *
 * Values are chosen to match published C172 performance numbers at typical
 * GA training weights. They are reference approximations, not a
 * certification dataset -- the Phase 2 JSBSim port will replace this with
 * real aircraft-specific tables.
 *
 * References for the tuning:
 * - Wing area 16.17 m^2 (174 ft^2)
 * - Mass ~1043 kg (2300 lb) at typical training weight
 * - CL_alpha ~5.7 / rad (thin-airfoil theory, 2-D corrected to 3-D)
 * - CL_max ~1.6 clean
 * - Zero-lift alpha ~-1.5 deg (typical cambered NACA 2412-ish)
 * - Stall alpha ~16 deg absolute AoA
 * - CD0 ~0.027, Oswald 0.75, AR ~7.32
 * - Max thrust ~1100 N at static sea level (derived from 160 HP prop at ~70% eff at takeoff)
 * - Stall speeds: Vs1 ~48 KIAS, Vs0 ~40 KIAS; Vno 129 KIAS; Vne 163 KIAS
 */

import { SIM_AIRCRAFT_IDS, SIM_KNOTS_PER_METER_PER_SECOND } from '@ab/constants';
import type { AircraftConfig } from '../types';

const DEG_TO_RAD = Math.PI / 180;

function knotsToMetersPerSecond(kias: number): number {
	return kias / SIM_KNOTS_PER_METER_PER_SECOND;
}

export const C172_CONFIG: AircraftConfig = {
	id: SIM_AIRCRAFT_IDS.C172,
	displayName: 'Cessna 172 (Phase 0)',
	mass: 1043,
	wingArea: 16.17,
	liftSlope: 5.7,
	clMax: 1.6,
	alphaZeroLift: -1.5 * DEG_TO_RAD,
	alphaStall: 16 * DEG_TO_RAD,
	clPostStall: 0.9,
	cd0: 0.027,
	oswald: 0.75,
	aspectRatio: 7.32,
	maxThrustSeaLevel: 1100,
	// Authority: full elevator is enough to overcome natural stability at
	// slow speeds (so the pilot can stall the airplane on purpose, as
	// happens in real life). Scales with dynamic pressure, so cruise-speed
	// pulls feel firm but stall-speed pulls are easier.
	pitchAuthority: 4.0,
	// Aerodynamic damping on q. Picked so that dutch-roll-free pitch
	// oscillations damp out in a few seconds after an elevator pulse.
	pitchDamping: 4.0,
	// Natural AoA-restoring stability: airframe wants to fly at trimAlpha.
	// Higher values = more nose-heavy / more stable.
	pitchStability: 12.0,
	// Trim AoA chosen so that neutral elevator at ~85 KIAS cruise sits close
	// to 1 G level flight without pilot input.
	trimAlpha: 3.0 * DEG_TO_RAD,
	vS1: knotsToMetersPerSecond(48),
	vS0: knotsToMetersPerSecond(40),
	vNo: knotsToMetersPerSecond(129),
	vNe: knotsToMetersPerSecond(163),
};
