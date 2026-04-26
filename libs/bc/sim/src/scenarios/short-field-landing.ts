/**
 * Short-Field Landing -- the classic ACS task. The pilot is established
 * on a stabilised approach to a runway with an obstacle, configured at
 * full flaps, holding Vref precisely. The goal is to clear the obstacle,
 * touch down on a specified spot with minimum float, and stop in the
 * shortest distance.
 *
 * The scenario teaches:
 *   - precise airspeed control at Vref (no fast, no slow -- both fail)
 *   - hold a steeper-than-normal descent angle to clear the obstacle
 *   - touch down on the target spot, not before, not after
 *   - keep stall margin -- a short-field approach is close to the edge
 *
 * Like the ILS scenario, this rides on `idealPath` for the glide-slope
 * + airspeed + heading discipline, then `airspeed_hold` for Vref, and
 * `stall_margin` because the approach lives near alpha-stall-warning.
 */

import {
	SIM_AIRCRAFT_IDS,
	SIM_FLAP_NOTCHES,
	SIM_KNOTS_PER_METER_PER_SECOND,
	SIM_METERS_PER_FOOT,
	SIM_SCENARIO_IDS,
} from '@ab/constants';
import type { ScenarioDefinition } from '../types';

const FIELD_ELEVATION_FT = 0;
const APPROACH_AGL_FT = 700; // about 50 ft over a 50-ft obstacle ~700 ft from threshold at a 6-deg path
const RUNWAY_HEADING_DEG = 360;
const DEG_TO_RAD = Math.PI / 180;
// C172S short-field Vref: 1.3 * Vs0 ~ 61 KIAS at full flaps. POH lists 61 KIAS over the 50-ft obstacle.
const VREF_KIAS = 61;
const VREF_MS = VREF_KIAS / SIM_KNOTS_PER_METER_PER_SECOND;
const FIELD_ALT_MSL_M = FIELD_ELEVATION_FT * SIM_METERS_PER_FOOT;
const APPROACH_ALT_MSL_M = (FIELD_ELEVATION_FT + APPROACH_AGL_FT) * SIM_METERS_PER_FOOT;
const RUNWAY_HEADING_RAD = RUNWAY_HEADING_DEG * DEG_TO_RAD;
// 6-deg approach: tan(6 deg) ~ 0.105. At 61 KIAS (~31 m/s) the descent
// rate is ~3.3 m/s, slightly steeper than a normal-pattern approach.
const DESCENT_W_M_S = -3.3;

export const SHORT_FIELD_LANDING_SCENARIO: ScenarioDefinition = {
	id: SIM_SCENARIO_IDS.SHORT_FIELD_LANDING,
	title: 'Short-Field Landing',
	tagline: 'Clear the obstacle. Hold Vref precisely. Touch down on the spot.',
	objective:
		'Fly a stabilised approach at Vref over a 50-ft obstacle. Touch down on the target spot with minimum float. Hold airspeed within 5 KIAS.',
	briefing:
		'You are short final to runway 36, full flaps, 700 ft AGL, configured for the short-field profile. Hold 61 KIAS over the obstacle, then bleed energy in the flare and touch down on the spot. Fast = float, slow = sink rate, both lose the run. Keep the airplane on centerline. Use the horizon view -- judge the touchdown spot visually, not by AGL.',
	recommendedOrder: 17,
	recommendationLabel: 'After steep turns -- pattern precision',
	aircraft: SIM_AIRCRAFT_IDS.C172,
	runwayHeadingDegrees: RUNWAY_HEADING_DEG,
	initial: {
		altitude: APPROACH_ALT_MSL_M,
		groundElevation: FIELD_ALT_MSL_M,
		u: VREF_MS,
		w: DESCENT_W_M_S,
		pitch: -0.06,
		pitchRate: 0,
		roll: 0,
		rollRate: 0,
		yawRate: 0,
		heading: RUNWAY_HEADING_RAD,
		throttle: 0.35,
		elevator: 0,
		trim: -0.05,
		aileron: 0,
		rudder: 0,
		brake: false,
		autoCoordinate: true,
		flaps: SIM_FLAP_NOTCHES[3], // full flaps for short-field
		onGround: false,
	},
	wind: {
		// Light headwind down the runway -- the maneuver is about
		// airspeed + spot, not crab correction.
		directionDegrees: RUNWAY_HEADING_DEG,
		speedKnots: 5,
	},
	criteria: {
		// Stalls fail; long timeout covers a go-around / recovery attempt.
		failureSustainedStallSeconds: 1.0,
		timeoutSeconds: 120,
	},
	idealPath: {
		segments: [
			{
				endT: 0,
				altitudeMsl: APPROACH_ALT_MSL_M,
				indicatedAirspeed: VREF_MS,
				heading: RUNWAY_HEADING_RAD,
				pitch: -0.06,
				roll: 0,
				throttle: 0.35,
				label: 'Short final, over the obstacle',
			},
			{
				endT: 30,
				altitudeMsl: FIELD_ALT_MSL_M + 50 * SIM_METERS_PER_FOOT,
				indicatedAirspeed: VREF_MS,
				heading: RUNWAY_HEADING_RAD,
				pitch: -0.04,
				roll: 0,
				throttle: 0.25,
				label: 'Approaching threshold',
			},
			{
				endT: 45,
				altitudeMsl: FIELD_ALT_MSL_M,
				indicatedAirspeed: VREF_MS * 0.92,
				heading: RUNWAY_HEADING_RAD,
				pitch: 0.04, // nose-up flare attitude
				roll: 0,
				throttle: 0,
				label: 'Touchdown on the spot',
			},
		],
	},
	grading: {
		components: [
			// Glide-path discipline: did the pilot fly the authored profile?
			{ kind: 'ideal_path_match', weight: 0.4, params: { tolerance: 30, hardFail: 100 } },
			// Vref +/- 5 KIAS is the ACS standard.
			{
				kind: 'airspeed_hold',
				weight: 0.3,
				params: {
					target: VREF_MS,
					tolerance: 5 / SIM_KNOTS_PER_METER_PER_SECOND,
					hardFail: 12 / SIM_KNOTS_PER_METER_PER_SECOND,
				},
			},
			// Short-field flies near the stall margin; protect against
			// dropping into the warning band on final.
			{ kind: 'stall_margin', weight: 0.2 },
			// Centerline / runway alignment through the flare.
			{
				kind: 'heading_hold',
				weight: 0.1,
				params: { target: RUNWAY_HEADING_RAD, tolerance: 5 * DEG_TO_RAD, hardFail: 15 * DEG_TO_RAD },
			},
		],
	},
	repMetadata: {
		domain: 'landings',
		difficulty: 4,
		tags: ['short-field', 'landing', 'vref', 'spot-landing', 'phase-of-flight:approach', 'visual-flying'],
	},
};
