/**
 * Aft-CG Slow Flight -- the airplane is loaded at the aft edge of the
 * envelope, so it's pitch-sensitive and stall-prone. Pilot must hold
 * Vs1 + 5 KIAS at altitude with the gear / flaps / power configuration
 * the briefing names, without bobbling pitch into a stall.
 *
 * Aft-CG modeling: we use the existing trim drift mechanism set to a
 * slow nose-up bias (the airframe naturally wants to pitch up as the
 * CG moves aft). Pilot has to retrim and hold airspeed precisely.
 */

import {
	SIM_AIRCRAFT_IDS,
	SIM_FLAP_NOTCHES,
	SIM_KNOTS_PER_METER_PER_SECOND,
	SIM_METERS_PER_FOOT,
	SIM_SCENARIO_IDS,
} from '@ab/constants';
import type { ScenarioDefinition } from '../types';

const ENTRY_ALT_FT = 4000;
const ENTRY_ALT_MSL_M = ENTRY_ALT_FT * SIM_METERS_PER_FOOT;
const RUNWAY_HEADING_DEG = 90;
const DEG_TO_RAD = Math.PI / 180;
const HEADING_RAD = RUNWAY_HEADING_DEG * DEG_TO_RAD;
// Slow flight target: Vs1 + 5 KIAS at C172S Vs1 = 44 KIAS.
const SLOW_FLIGHT_KIAS = 49;
const SLOW_FLIGHT_MS = SLOW_FLIGHT_KIAS / SIM_KNOTS_PER_METER_PER_SECOND;
const RUN_DURATION_SECONDS = 240;

export const AFT_CG_SLOW_FLIGHT_SCENARIO: ScenarioDefinition = {
	id: SIM_SCENARIO_IDS.AFT_CG_SLOW_FLIGHT,
	title: 'Aft-CG Slow Flight',
	tagline: 'CG at the aft edge. Hold Vs1 + 5 without bobbling into a stall.',
	objective:
		'Configure for slow flight at 49 KIAS / 4000 ft / heading 090 with full flaps. Hold the configuration without porpoising or stalling.',
	briefing:
		'You are at 4000 ft, configured slow with full flaps, near Vs1 + 5 KIAS. The CG is at the aft edge of the envelope -- the airplane is pitch-sensitive and wants to nose up. Use trim aggressively, fly with the airplane (small inputs), and hold the configuration for four minutes. Stall fails the run.',
	recommendedOrder: 10,
	recommendationLabel: 'Aft-CG handling',
	aircraft: SIM_AIRCRAFT_IDS.C172,
	runwayHeadingDegrees: RUNWAY_HEADING_DEG,
	initial: {
		altitude: ENTRY_ALT_MSL_M,
		groundElevation: 0,
		u: SLOW_FLIGHT_MS,
		w: 0,
		pitch: 0.18,
		pitchRate: 0,
		roll: 0,
		rollRate: 0,
		yawRate: 0,
		heading: HEADING_RAD,
		throttle: 0.55,
		elevator: 0,
		trim: 0.4,
		aileron: 0,
		rudder: 0,
		brake: false,
		autoCoordinate: true,
		flaps: SIM_FLAP_NOTCHES[3],
		onGround: false,
	},
	wind: { directionDegrees: 90, speedKnots: 0 },
	criteria: {
		failureSustainedStallSeconds: 0.5,
		failureMinimumAltitudeAglMeters: (ENTRY_ALT_FT - 500) * SIM_METERS_PER_FOOT,
		timeoutSeconds: RUN_DURATION_SECONDS,
	},
	scriptedInput: {
		// Aft-CG nose-up tendency. The pilot has to retrim continuously.
		trimBiasRatePerSecond: 0.02,
		trimBiasMax: 0.5,
	},
	idealPath: {
		segments: [
			{
				endT: 0,
				altitudeMsl: ENTRY_ALT_MSL_M,
				indicatedAirspeed: SLOW_FLIGHT_MS,
				heading: HEADING_RAD,
				pitch: 0.18,
				roll: 0,
				throttle: 0.55,
				label: 'Slow flight entry',
			},
			{
				endT: RUN_DURATION_SECONDS,
				altitudeMsl: ENTRY_ALT_MSL_M,
				indicatedAirspeed: SLOW_FLIGHT_MS,
				heading: HEADING_RAD,
				pitch: 0.18,
				roll: 0,
				throttle: 0.55,
				label: 'Hold configuration',
			},
		],
	},
	grading: {
		components: [
			{
				kind: 'airspeed_hold',
				weight: 0.4,
				params: {
					target: SLOW_FLIGHT_MS,
					tolerance: 5 / SIM_KNOTS_PER_METER_PER_SECOND,
					hardFail: 12 / SIM_KNOTS_PER_METER_PER_SECOND,
				},
			},
			{ kind: 'stall_margin', weight: 0.3 },
			{
				kind: 'altitude_hold',
				weight: 0.2,
				params: { target: ENTRY_ALT_MSL_M, tolerance: 100 * SIM_METERS_PER_FOOT },
			},
			{ kind: 'heading_hold', weight: 0.1, params: { target: HEADING_RAD, tolerance: 10 * DEG_TO_RAD } },
		],
	},
	repMetadata: {
		domain: 'slow-flight',
		difficulty: 4,
		tags: ['slow-flight', 'aft-cg', 'trim-management', 'phase-of-flight:cruise'],
	},
};
