/**
 * Crosswind Landing -- the runway points one way, the wind blows
 * across it. The pilot has to keep the airplane tracking the centerline
 * while the wind tries to drift it sideways. Two correction techniques
 * exist: crab to a wind-corrected heading on final and de-crab in the
 * flare, or sideslip the airplane (upwind wing low, opposite rudder) to
 * align the longitudinal axis with the runway and stop the drift with
 * a steady cross-control.
 *
 * The scenario teaches:
 *   - hold runway heading at touchdown (no crab on the wheels)
 *   - track the centerline with sideslip + rudder, not aileron drift
 *   - hold approach airspeed across the cross-control
 *   - keep stall margin -- a sideslip raises stall speed and obscures
 *     the slip indicator
 *
 * Like short-field, this rides on `idealPath` for centerline + glide-
 * slope discipline, plus `heading_hold` for runway alignment, plus
 * airspeed and stall margin.
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
const APPROACH_AGL_FT = 600;
const RUNWAY_HEADING_DEG = 90; // runway 09, pointing east
const DEG_TO_RAD = Math.PI / 180;
// Approach airspeed for crosswind landing in a C172 -- slightly higher
// than the short-field target to keep control authority.
const VAPP_KIAS = 65;
const VAPP_MS = VAPP_KIAS / SIM_KNOTS_PER_METER_PER_SECOND;
const FIELD_ALT_MSL_M = FIELD_ELEVATION_FT * SIM_METERS_PER_FOOT;
const APPROACH_ALT_MSL_M = (FIELD_ELEVATION_FT + APPROACH_AGL_FT) * SIM_METERS_PER_FOOT;
const RUNWAY_HEADING_RAD = RUNWAY_HEADING_DEG * DEG_TO_RAD;
// 4-deg approach: tan(4 deg) ~ 0.07. At 65 KIAS (~33 m/s) -> ~2.3 m/s descent.
const DESCENT_W_M_S = -2.3;
// Crosswind: from the north (000), perpendicular to runway 09 -> a pure
// 12-knot left crosswind. Within C172 demonstrated of 15 knots.
const CROSSWIND_FROM_DEG = 360;
const CROSSWIND_KNOTS = 12;

export const CROSSWIND_LANDING_SCENARIO: ScenarioDefinition = {
	id: SIM_SCENARIO_IDS.CROSSWIND_LANDING,
	title: 'Crosswind Landing',
	tagline: 'Wind from the left at 12 kt. Hold runway heading. Track the centerline through the flare.',
	objective:
		'Fly final to runway 09 with a 12-knot left crosswind. Hold runway heading at touchdown. Track centerline. Hold airspeed within 5 KIAS.',
	briefing:
		'You are short final to runway 09, 600 ft AGL, 65 KIAS, with a 12-knot crosswind from the north. Pick a technique: crab on final and de-crab in the flare, or sideslip the whole way down (upwind wing low, opposite rudder). The wheels must touch with the longitudinal axis aligned with the runway -- side-loading on touchdown is a fail. Hold the centerline; do not let the airplane drift downwind.',
	recommendedOrder: 19,
	recommendationLabel: 'After short-field -- crosswind technique',
	aircraft: SIM_AIRCRAFT_IDS.C172,
	runwayHeadingDegrees: RUNWAY_HEADING_DEG,
	initial: {
		altitude: APPROACH_ALT_MSL_M,
		groundElevation: FIELD_ALT_MSL_M,
		u: VAPP_MS,
		w: DESCENT_W_M_S,
		pitch: -0.04,
		pitchRate: 0,
		roll: 0,
		rollRate: 0,
		yawRate: 0,
		heading: RUNWAY_HEADING_RAD,
		throttle: 0.4,
		elevator: 0,
		trim: -0.05,
		aileron: 0,
		rudder: 0,
		brake: false,
		// Auto-coordinate OFF: a crosswind landing demands a sideslip,
		// which is by definition uncoordinated. Cross-controlling is the
		// whole point of the maneuver.
		autoCoordinate: false,
		flaps: SIM_FLAP_NOTCHES[2], // partial flaps for crosswind handling
		onGround: false,
	},
	wind: {
		directionDegrees: CROSSWIND_FROM_DEG,
		speedKnots: CROSSWIND_KNOTS,
	},
	criteria: {
		failureSustainedStallSeconds: 1.0,
		timeoutSeconds: 120,
	},
	idealPath: {
		segments: [
			{
				endT: 0,
				altitudeMsl: APPROACH_ALT_MSL_M,
				indicatedAirspeed: VAPP_MS,
				heading: RUNWAY_HEADING_RAD,
				pitch: -0.04,
				roll: 0,
				throttle: 0.4,
				label: 'Short final, sideslip established',
			},
			{
				endT: 25,
				altitudeMsl: FIELD_ALT_MSL_M + 50 * SIM_METERS_PER_FOOT,
				indicatedAirspeed: VAPP_MS,
				heading: RUNWAY_HEADING_RAD,
				pitch: -0.03,
				roll: 0,
				throttle: 0.3,
				label: 'Crossing threshold',
			},
			{
				endT: 40,
				altitudeMsl: FIELD_ALT_MSL_M,
				indicatedAirspeed: VAPP_MS * 0.95,
				heading: RUNWAY_HEADING_RAD,
				pitch: 0.03,
				roll: 0,
				throttle: 0,
				label: 'Touchdown, runway-aligned',
			},
		],
	},
	grading: {
		components: [
			// Centerline + glide-path discipline.
			{ kind: 'ideal_path_match', weight: 0.4, params: { tolerance: 30, hardFail: 100 } },
			// Runway alignment is the headline crosswind standard. A wide
			// crab on touchdown breaks the gear; tolerance is tight.
			{
				kind: 'heading_hold',
				weight: 0.3,
				params: { target: RUNWAY_HEADING_RAD, tolerance: 5 * DEG_TO_RAD, hardFail: 15 * DEG_TO_RAD },
			},
			// Hold approach airspeed.
			{
				kind: 'airspeed_hold',
				weight: 0.2,
				params: {
					target: VAPP_MS,
					tolerance: 5 / SIM_KNOTS_PER_METER_PER_SECOND,
					hardFail: 15 / SIM_KNOTS_PER_METER_PER_SECOND,
				},
			},
			// Sideslip raises stall speed; protect the margin through the flare.
			{ kind: 'stall_margin', weight: 0.1 },
		],
	},
	repMetadata: {
		domain: 'landings',
		difficulty: 4,
		tags: ['crosswind', 'landing', 'sideslip', 'crab', 'phase-of-flight:approach', 'visual-flying'],
	},
};
