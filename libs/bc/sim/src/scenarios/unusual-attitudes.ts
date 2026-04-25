/**
 * Unusual Attitudes -- the airplane starts already pitched and rolled
 * away from level. The pilot has to recognise the attitude on the AI
 * (the ASI / VSI confirm pitch direction; the TC confirms roll
 * direction) and recover wings-level + altitude-stable.
 *
 * Single nose-high variant for now -- a future PR can add the nose-low
 * variant by duplicating this file with sign-flipped initial state.
 *
 * Recovery procedure -- nose-high:
 *   1. Pitch down (push) toward the horizon
 *   2. Add power
 *   3. Wings level
 *
 * Recovery procedure -- nose-low (when the variant ships):
 *   1. Reduce power
 *   2. Wings level
 *   3. Pitch up (pull) gently to the horizon
 */

import {
	SIM_AIRCRAFT_IDS,
	SIM_FLAP_NOTCHES,
	SIM_KNOTS_PER_METER_PER_SECOND,
	SIM_METERS_PER_FOOT,
	SIM_SCENARIO_IDS,
} from '@ab/constants';
import type { ScenarioDefinition } from '../types';

const RECOVERY_ALT_FT = 4000;
const RECOVERY_ALT_MSL_M = RECOVERY_ALT_FT * SIM_METERS_PER_FOOT;
const RUNWAY_HEADING_DEG = 90;
const DEG_TO_RAD = Math.PI / 180;
const HEADING_RAD = RUNWAY_HEADING_DEG * DEG_TO_RAD;
const RECOVERY_KIAS = 95;
const RECOVERY_MS = RECOVERY_KIAS / SIM_KNOTS_PER_METER_PER_SECOND;
const RUN_DURATION_SECONDS = 120;

export const UNUSUAL_ATTITUDES_SCENARIO: ScenarioDefinition = {
	id: SIM_SCENARIO_IDS.UNUSUAL_ATTITUDES_NOSE_HI,
	title: 'Unusual Attitudes (Nose High)',
	tagline: 'Pitched up 25 degrees, banked 30. Recover wings-level + on altitude.',
	objective:
		'You start in a steep, slow climbing turn. Recognise the attitude, recover to wings-level cruise, hold 4000 ft and runway heading.',
	briefing:
		'You start in an unusual attitude: pitch +25 deg, right bank 30 deg, airspeed decaying through 70 KIAS. Recovery for nose-high: push the nose down toward the horizon, add power, level the wings -- in that order. Get back to wings-level cruise at 4000 ft / 95 KIAS / heading 090.',
	recommendedOrder: 9,
	recommendationLabel: 'Recovery practice',
	aircraft: SIM_AIRCRAFT_IDS.C172,
	runwayHeadingDegrees: RUNWAY_HEADING_DEG,
	initial: {
		altitude: RECOVERY_ALT_MSL_M,
		groundElevation: 0,
		// 70 KIAS, decaying. Body axis u = airspeed; w = small upward
		// component for the climbing-turn entry.
		u: 70 / SIM_KNOTS_PER_METER_PER_SECOND,
		w: 4,
		pitch: 25 * DEG_TO_RAD,
		pitchRate: 0,
		roll: 30 * DEG_TO_RAD,
		rollRate: 0,
		yawRate: 0,
		heading: HEADING_RAD + 20 * DEG_TO_RAD,
		throttle: 0.4,
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
		failureMinimumAltitudeAglMeters: (RECOVERY_ALT_FT - 2000) * SIM_METERS_PER_FOOT,
		timeoutSeconds: RUN_DURATION_SECONDS,
	},
	idealPath: {
		segments: [
			{
				endT: 0,
				altitudeMsl: RECOVERY_ALT_MSL_M,
				indicatedAirspeed: 70 / SIM_KNOTS_PER_METER_PER_SECOND,
				heading: HEADING_RAD + 20 * DEG_TO_RAD,
				pitch: 25 * DEG_TO_RAD,
				roll: 30 * DEG_TO_RAD,
				throttle: 0.4,
				label: 'Unusual attitude',
			},
			{
				endT: 10,
				altitudeMsl: RECOVERY_ALT_MSL_M + 100 * SIM_METERS_PER_FOOT,
				indicatedAirspeed: 75 / SIM_KNOTS_PER_METER_PER_SECOND,
				heading: HEADING_RAD + 10 * DEG_TO_RAD,
				pitch: 0.04,
				roll: 0,
				throttle: 1,
				label: 'Push + add power + level',
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
			// Attitude recovery is the headline measurement. A good
			// recovery shows up as a fast convergence of pitch and roll
			// to ~0.
			{ kind: 'reaction_time', weight: 0.3, params: { reactionPredicate: 'stick_forward' } },
			{
				kind: 'altitude_hold',
				weight: 0.3,
				params: { target: RECOVERY_ALT_MSL_M, tolerance: 200 * SIM_METERS_PER_FOOT },
			},
			{ kind: 'heading_hold', weight: 0.2, params: { target: HEADING_RAD, tolerance: 15 * DEG_TO_RAD } },
			{
				kind: 'airspeed_hold',
				weight: 0.1,
				params: {
					target: RECOVERY_MS,
					tolerance: 10 / SIM_KNOTS_PER_METER_PER_SECOND,
					hardFail: 25 / SIM_KNOTS_PER_METER_PER_SECOND,
				},
			},
			{ kind: 'stall_margin', weight: 0.1 },
		],
	},
	repMetadata: {
		domain: 'recovery',
		difficulty: 4,
		tags: ['unusual-attitudes', 'nose-high', 'recovery', 'phase-of-flight:cruise'],
	},
};
