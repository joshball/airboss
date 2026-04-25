/**
 * Piper PA-28 (Cherokee / Warrior class) aircraft profile.
 *
 * Mirrors the C172 profile shape so the FDM can swap aircraft via the
 * AircraftConfig record without rewriting the physics. The PA-28 flies
 * heavier and faster than the C172, with a fixed-pitch prop on the
 * basic Cherokee / Warrior variants we model. POH numbers below are
 * the published Warrior II / III values; Phase 2 (JSBSim port) will
 * replace this with the canonical Archer-III dataset.
 *
 * Reference approximations, not certification data. Suitable for the
 * MVP training-grade sim.
 *
 * Longitudinal references (Warrior II / III):
 * - Wing area 15.79 m^2 (170 ft^2), span 10.67 m
 * - Mass 1089 kg (2400 lb) typical training weight (max gross 2440 lb)
 * - CL_alpha ~5.5 / rad (low-wing, slightly less than C172 high-wing)
 * - Stall alpha ~16 deg, stall warning ~12 deg
 * - CD0 ~0.029, AR ~7.21, Oswald 0.74
 * - Static thrust ~2200 N (160 HP Lycoming O-320)
 *
 * V-speeds (Warrior II POH):
 * - Vs0 44, Vs1 50, Vr 55, Vx 63, Vy 79, Va 111, Vno 126, Vne 154,
 *   Vfe 102 (KIAS)
 */

import { SIM_AIRCRAFT_IDS, SIM_FLAP_NOTCHES, SIM_KNOTS_PER_METER_PER_SECOND } from '@ab/constants';
import type { AircraftConfig } from '../types';

const DEG_TO_RAD = Math.PI / 180;

function knotsToMetersPerSecond(kias: number): number {
	return kias / SIM_KNOTS_PER_METER_PER_SECOND;
}

export const PA28_CONFIG: AircraftConfig = {
	id: SIM_AIRCRAFT_IDS.PA28,
	displayName: 'Piper PA-28 Warrior',
	mass: 1089,
	wingArea: 15.79,
	wingSpan: 10.67,
	liftSlope: 5.5,
	clMax: 1.55,
	alphaZeroLift: -1.4 * DEG_TO_RAD,
	alphaStall: 16 * DEG_TO_RAD,
	clPostStall: 0.85,
	alphaStallWarning: 12 * DEG_TO_RAD,
	cd0: 0.029,
	oswald: 0.74,
	aspectRatio: 7.21,
	// 160 HP Lycoming O-320, fixed-pitch prop. Static thrust slightly
	// lower than the C172S; vZeroThrust similar at ~80 m/s.
	maxThrustSeaLevel: 2200,
	vZeroThrust: 80,
	// PA-28 is slightly less pitch-authoritative than the C172 (low-wing
	// configuration shifts the tail loading) but otherwise similar.
	pitchAuthority: 3.6,
	pitchDamping: 4.2,
	pitchStability: 12.5,
	trimAlpha: 3.0 * DEG_TO_RAD,
	rollAuthority: 4.0,
	rollDamping: 4.0,
	bankLimit: 80 * DEG_TO_RAD,
	rudderAuthority: 1.5,
	yawDamping: 1.8,
	adverseYaw: 0.3,
	trimRange: 0.2,
	clFlapsPer10Deg: 0.28,
	cdFlapsPer10Deg: 0.022,
	flapMaxDeg: SIM_FLAP_NOTCHES[SIM_FLAP_NOTCHES.length - 1],
	rollingFriction: 0.04,
	brakeFriction: 0.5,
	groundSteering: 0.009,
	idleRpm: 700,
	maxRpm: 2700,
	greenArcRpmLow: 2100,
	greenArcRpmHigh: 2500,
	// PA-28 cluster ranges -- POH typical for the Warrior II / III.
	oilPressureIdlePsi: 25,
	oilPressureMaxPsi: 90,
	oilPressureGreenLowPsi: 60,
	oilPressureGreenHighPsi: 90,
	oilTempCruiseC: 95,
	oilTempRedlineC: 118,
	oilWarmupSeconds: 90,
	// PA-28 Warrior II has 25 gal usable per side (50 total).
	fuelTankCapacityGallons: 25,
	fuelBurnGphFull: 8.5,
	fuelBurnGphIdle: 1.1,
	ammeterIdleAmps: 3,
	ammeterCruiseAmps: 12,
	vacuumNominalInHg: 5.0,
	vS0: knotsToMetersPerSecond(44),
	vS1: knotsToMetersPerSecond(50),
	vR: knotsToMetersPerSecond(55),
	vX: knotsToMetersPerSecond(63),
	vY: knotsToMetersPerSecond(79),
	vA: knotsToMetersPerSecond(111),
	vNo: knotsToMetersPerSecond(126),
	vNe: knotsToMetersPerSecond(154),
	vFe: knotsToMetersPerSecond(102),
};
