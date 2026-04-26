/**
 * Turns Around a Point -- a ground-reference VFR maneuver flown at low
 * altitude (600-1000 ft AGL) to teach wind-correction. The pilot picks a
 * fixed reference on the ground and flies a constant-radius circle
 * around it. Because the airplane drifts in the wind, the bank angle
 * has to vary continuously: steepest on the downwind side (highest
 * groundspeed, tightest turn needed), shallowest on the upwind side
 * (lowest groundspeed, gentlest turn).
 *
 * The scenario teaches:
 *   - hold a fixed AGL while banking continuously
 *   - vary the bank angle with groundspeed to keep radius constant
 *   - hold airspeed inside the maneuvering envelope, well below Va
 *   - keep coordinated through every bank change
 *
 * Like steep turns, this is a horizon-view maneuver. The pilot looks
 * outside at the ground reference, not inside at the gauges. The
 * cockpit page renders the gauges; the dual / window page lets the
 * pilot fly visually the way a real CFI would teach the maneuver.
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
const ENTRY_AGL_FT = 800;
const ENTRY_HEADING_DEG = 90; // pointing east, perpendicular to wind for the entry leg
const ENTRY_KIAS = 90;
const DEG_TO_RAD = Math.PI / 180;
const ENTRY_MS = ENTRY_KIAS / SIM_KNOTS_PER_METER_PER_SECOND;
const ENTRY_ALT_MSL_M = (FIELD_ELEVATION_FT + ENTRY_AGL_FT) * SIM_METERS_PER_FOOT;
const FIELD_ALT_MSL_M = FIELD_ELEVATION_FT * SIM_METERS_PER_FOOT;
const ENTRY_HEADING_RAD = ENTRY_HEADING_DEG * DEG_TO_RAD;

export const GROUND_REFERENCE_TURNS_AROUND_POINT_SCENARIO: ScenarioDefinition = {
	id: SIM_SCENARIO_IDS.GROUND_REFERENCE_TURNS_AROUND_POINT,
	title: 'Turns Around a Point',
	tagline: 'Hold 800 ft AGL. Fly a constant-radius circle around a ground reference, varying bank with groundspeed.',
	objective:
		'Hold 800 ft AGL through a complete circle around a ground reference. Vary bank angle with groundspeed to keep the radius constant. Hold airspeed within tolerance.',
	briefing:
		'You are at 800 ft AGL, 90 KIAS, pointing east. There is a steady crosswind from the south. Pick a ground reference and roll into a left turn (downwind first). Vary the bank: steeper on the downwind side, shallower on the upwind side, so the radius stays constant. Keep your AGL within +/- 100 ft and stay coordinated. Use the horizon view -- look outside at the reference, not at the gauges.',
	recommendedOrder: 16,
	recommendationLabel: 'VFR ground-reference maneuver -- best on the Window surface',
	aircraft: SIM_AIRCRAFT_IDS.C172,
	runwayHeadingDegrees: ENTRY_HEADING_DEG,
	initial: {
		altitude: ENTRY_ALT_MSL_M,
		groundElevation: FIELD_ALT_MSL_M,
		u: ENTRY_MS,
		w: 0,
		pitch: 0.02,
		pitchRate: 0,
		roll: 0,
		rollRate: 0,
		yawRate: 0,
		heading: ENTRY_HEADING_RAD,
		throttle: 0.55,
		elevator: 0,
		trim: 0,
		aileron: 0,
		rudder: 0,
		brake: false,
		autoCoordinate: true,
		flaps: SIM_FLAP_NOTCHES[0],
		onGround: false,
	},
	wind: {
		// Steady crosswind from the south at the entry leg. The whole point
		// of the maneuver is wind-correction; without wind the bank stays
		// constant and the maneuver collapses to a normal turn.
		directionDegrees: 180,
		speedKnots: 12,
	},
	criteria: {
		failureSustainedStallSeconds: 1.0,
		// One full circle at 30-deg bank ~= 28 sec; allow time for entry,
		// two laps, and recovery to the entry heading.
		timeoutSeconds: 180,
	},
	grading: {
		components: [
			// Headline standard: AGL within 100 ft. Tolerance is 50 ft (tight),
			// hard fail at 150 ft.
			{
				kind: 'altitude_hold',
				weight: 0.5,
				params: {
					target: ENTRY_ALT_MSL_M,
					tolerance: 50 * SIM_METERS_PER_FOOT,
					hardFail: 150 * SIM_METERS_PER_FOOT,
				},
			},
			// Heading discipline: pilot should finish the circle on the entry
			// heading. Average heading deviation across the run is a rough
			// proxy for "did you fly a clean circle". Wide tolerance because
			// the heading sweeps through 360 deg; what we are penalising is
			// not finishing on the entry heading, not the sweep itself.
			{
				kind: 'heading_hold',
				weight: 0.3,
				params: {
					target: ENTRY_HEADING_RAD,
					tolerance: 90 * DEG_TO_RAD,
					hardFail: 180 * DEG_TO_RAD,
				},
			},
			// Hold airspeed close to entry; ground-reference maneuvers below
			// Va keep load factor manageable across bank changes.
			{
				kind: 'airspeed_hold',
				weight: 0.2,
				params: {
					target: ENTRY_MS,
					tolerance: 8 / SIM_KNOTS_PER_METER_PER_SECOND,
					hardFail: 20 / SIM_KNOTS_PER_METER_PER_SECOND,
				},
			},
		],
	},
	repMetadata: {
		domain: 'vfr-maneuvers',
		difficulty: 3,
		tags: ['ground-reference', 'turns-around-a-point', 'wind-correction', 'phase-of-flight:cruise', 'visual-flying'],
	},
};
