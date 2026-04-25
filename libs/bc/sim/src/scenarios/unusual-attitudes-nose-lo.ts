/**
 * Unusual Attitudes (Nose Low) -- the airplane starts in a steep
 * descending turn. Recovery procedure:
 *   1. Reduce power
 *   2. Wings level
 *   3. Pitch up gently to the horizon
 *
 * Companion scenario to Unusual Attitudes (Nose High). Sign-flipped
 * initial state captures the nose-low entry; grading weights the same
 * recovery skills with reaction-time tied to throttle-idle.
 */

import {
	SIM_AIRCRAFT_IDS,
	SIM_FLAP_NOTCHES,
	SIM_KNOTS_PER_METER_PER_SECOND,
	SIM_METERS_PER_FOOT,
	SIM_SCENARIO_IDS,
} from '@ab/constants';
import type { ScenarioDefinition } from '../types';

const RECOVERY_ALT_FT = 4500;
const RECOVERY_ALT_MSL_M = RECOVERY_ALT_FT * SIM_METERS_PER_FOOT;
const RUNWAY_HEADING_DEG = 90;
const DEG_TO_RAD = Math.PI / 180;
const HEADING_RAD = RUNWAY_HEADING_DEG * DEG_TO_RAD;
const RECOVERY_KIAS = 95;
const RECOVERY_MS = RECOVERY_KIAS / SIM_KNOTS_PER_METER_PER_SECOND;
const RUN_DURATION_SECONDS = 120;

export const UNUSUAL_ATTITUDES_NOSE_LO_SCENARIO: ScenarioDefinition = {
	id: SIM_SCENARIO_IDS.UNUSUAL_ATTITUDES_NOSE_LO,
	title: 'Unusual Attitudes (Nose Low)',
	tagline: 'Pitched down 25 degrees, banked 40. Reduce power, level, recover.',
	objective:
		'You start in a steep descending turn at high airspeed. Reduce power, level the wings, recover pitch to the horizon. Hold 4500 ft and runway heading.',
	briefing:
		'You start in an unusual attitude: pitch -25 deg, left bank 40 deg, airspeed accelerating through 130 KIAS. Recovery for nose-low: reduce power, level the wings, then pitch up gently -- in that order. Pull too hard on entry and you will overstress the airplane.',
	recommendedOrder: 11,
	recommendationLabel: 'Recovery practice (descending)',
	aircraft: SIM_AIRCRAFT_IDS.C172,
	runwayHeadingDegrees: RUNWAY_HEADING_DEG,
	initial: {
		altitude: RECOVERY_ALT_MSL_M,
		groundElevation: 0,
		u: 130 / SIM_KNOTS_PER_METER_PER_SECOND,
		w: -8,
		pitch: -25 * DEG_TO_RAD,
		pitchRate: 0,
		roll: -40 * DEG_TO_RAD,
		rollRate: 0,
		yawRate: 0,
		heading: HEADING_RAD - 30 * DEG_TO_RAD,
		throttle: 0.85,
		elevator: 0,
		trim: 0,
		aileron: 0,
		rudder: 0,
		brake: false,
		autoCoordinate: true,
		flaps: SIM_FLAP_NOTCHES[0],
		onGround: false,
	},
	wind: { directionDegrees: 90, speedKnots: 0 },
	criteria: {
		failureSustainedStallSeconds: 1.0,
		failureMinimumAltitudeAglMeters: (RECOVERY_ALT_FT - 2500) * SIM_METERS_PER_FOOT,
		timeoutSeconds: RUN_DURATION_SECONDS,
	},
	idealPath: {
		segments: [
			{
				endT: 0,
				altitudeMsl: RECOVERY_ALT_MSL_M,
				indicatedAirspeed: 130 / SIM_KNOTS_PER_METER_PER_SECOND,
				heading: HEADING_RAD - 30 * DEG_TO_RAD,
				pitch: -25 * DEG_TO_RAD,
				roll: -40 * DEG_TO_RAD,
				throttle: 0.85,
				label: 'Unusual attitude entry',
			},
			{
				endT: 12,
				altitudeMsl: RECOVERY_ALT_MSL_M - 200 * SIM_METERS_PER_FOOT,
				indicatedAirspeed: RECOVERY_MS,
				heading: HEADING_RAD - 10 * DEG_TO_RAD,
				pitch: 0.04,
				roll: 0,
				throttle: 0.4,
				label: 'Throttle idle + level wings + pitch up',
			},
			{
				endT: RUN_DURATION_SECONDS,
				altitudeMsl: RECOVERY_ALT_MSL_M,
				indicatedAirspeed: RECOVERY_MS,
				heading: HEADING_RAD,
				pitch: 0.04,
				roll: 0,
				throttle: 0.65,
				label: 'Stable cruise',
			},
		],
	},
	grading: {
		components: [
			// Nose-low recovery starts with throttle-idle, not stick-forward.
			{ kind: 'reaction_time', weight: 0.3, params: { reactionPredicate: 'throttle_idle' } },
			{
				kind: 'altitude_hold',
				weight: 0.3,
				params: { target: RECOVERY_ALT_MSL_M, tolerance: 300 * SIM_METERS_PER_FOOT },
			},
			{ kind: 'heading_hold', weight: 0.2, params: { target: HEADING_RAD, tolerance: 15 * DEG_TO_RAD } },
			{
				kind: 'airspeed_hold',
				weight: 0.1,
				params: {
					target: RECOVERY_MS,
					tolerance: 15 / SIM_KNOTS_PER_METER_PER_SECOND,
					hardFail: 35 / SIM_KNOTS_PER_METER_PER_SECOND,
				},
			},
			{ kind: 'stall_margin', weight: 0.1 },
		],
	},
	repMetadata: {
		domain: 'recovery',
		difficulty: 4,
		tags: ['unusual-attitudes', 'nose-low', 'recovery', 'overspeed', 'phase-of-flight:cruise'],
	},
};
