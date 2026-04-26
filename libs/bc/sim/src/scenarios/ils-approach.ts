/**
 * ILS RWY 14 Approach -- the pilot is established on the localiser at
 * 2000 ft AGL, ~7 km from the threshold, on the glide-slope. Three
 * marker beacons sit on the localiser centerline at the standard
 * positions: outer marker (~7 km out, beam highest), middle marker
 * (~1 km from threshold, decision-altitude reminder), inner marker
 * (~300 m, threshold of category-II minima).
 *
 * The scenario teaches:
 *   - hold the localiser centerline with rudder + small bank corrections
 *   - track the glide-slope on pitch/power, ~500 ft/min descent
 *   - recognise each marker beacon's audio + caption signature
 *
 * This is the first scenario to exercise the `markerBeacons` field on
 * `ScenarioDefinition` (PR #188). The cue dispatch is wired end-to-end
 * via the worker's `markerBeaconAtPosition` lookup; this scenario is
 * the first content to drive it.
 */

import {
	SIM_AIRCRAFT_IDS,
	SIM_FLAP_NOTCHES,
	SIM_KNOTS_PER_METER_PER_SECOND,
	SIM_MARKER_BEACON_KINDS,
	SIM_METERS_PER_FOOT,
	SIM_SCENARIO_IDS,
} from '@ab/constants';
import type { ScenarioDefinition } from '../types';

const FIELD_ELEVATION_FT = 500;
const APPROACH_AGL_FT = 2000;
const RUNWAY_HEADING_DEG = 140;
const DEG_TO_RAD = Math.PI / 180;
const VAPP_KIAS = 75;
const VAPP_MS = VAPP_KIAS / SIM_KNOTS_PER_METER_PER_SECOND;
const FIELD_ALT_MSL_M = FIELD_ELEVATION_FT * SIM_METERS_PER_FOOT;
const APPROACH_ALT_MSL_M = (FIELD_ELEVATION_FT + APPROACH_AGL_FT) * SIM_METERS_PER_FOOT;
const RUNWAY_HEADING_RAD = RUNWAY_HEADING_DEG * DEG_TO_RAD;

// Standard ILS marker-beacon layout. The airplane starts at x=0 (the
// FDM bootstraps every scenario at the origin) and flies forward
// along its body-x axis toward the runway. Marker beacons sit at
// positive x at standard distances ahead of the start point.
// - Outer (OM): ~7 km out from start; coincident with start position.
// - Middle (MM): ~5950 m ahead; coincides with ~1 km from threshold.
// - Inner (IM): ~6700 m ahead; ~300 m from threshold.
const RUNWAY_THRESHOLD_X = 7000;

export const ILS_APPROACH_SCENARIO: ScenarioDefinition = {
	id: SIM_SCENARIO_IDS.ILS_APPROACH,
	title: 'ILS RWY 14 Approach',
	tagline: 'Hold the localiser and glide-slope from the outer marker to the inner.',
	objective:
		'Fly an established ILS approach. Recognise each marker beacon. Hold centerline + glide-slope to the inner marker.',
	briefing:
		'You are 7 km out, 2000 ft AGL, established on the localiser for runway 14. Hold 75 KIAS, ~500 ft/min descent, runway-aligned heading. Three marker beacons mark your progress: outer (low-pitch slow dashes), middle (alternating dot-dash), inner (high-pitch fast dots). Cross the inner marker at decision altitude. The cue tone + caption identify each beacon as you fly through it.',
	recommendedOrder: 14,
	recommendationLabel: 'After VMC into IMC',
	aircraft: SIM_AIRCRAFT_IDS.C172,
	runwayHeadingDegrees: RUNWAY_HEADING_DEG,
	initial: {
		altitude: APPROACH_ALT_MSL_M,
		groundElevation: FIELD_ALT_MSL_M,
		u: VAPP_MS,
		w: -2.5, // ~500 ft/min descent at 75 KIAS works out to roughly this in m/s.
		pitch: -0.04,
		pitchRate: 0,
		roll: 0,
		rollRate: 0,
		yawRate: 0,
		heading: RUNWAY_HEADING_RAD,
		throttle: 0.45,
		elevator: 0,
		trim: -0.1,
		aileron: 0,
		rudder: 0,
		brake: false,
		autoCoordinate: true,
		flaps: SIM_FLAP_NOTCHES[1],
		onGround: false,
	},
	wind: {
		// Light headwind component to keep the localiser tracking honest.
		directionDegrees: 130,
		speedKnots: 7,
	},
	criteria: {
		// Touchdown is success: a runway-aligned heading + AGL near zero
		// with reasonable airspeed. Sustained stall fails. Hard timeout
		// covers a fly-around scenario.
		failureSustainedStallSeconds: 1.0,
		timeoutSeconds: 240,
	},
	markerBeacons: [
		{
			kind: SIM_MARKER_BEACON_KINDS.OUTER,
			xMeters: 0,
			halfWidthMeters: 200,
			aglCeilingMeters: 600,
		},
		{
			kind: SIM_MARKER_BEACON_KINDS.MIDDLE,
			xMeters: RUNWAY_THRESHOLD_X - 1050,
			halfWidthMeters: 80,
			aglCeilingMeters: 300,
		},
		{
			kind: SIM_MARKER_BEACON_KINDS.INNER,
			xMeters: RUNWAY_THRESHOLD_X - 300,
			halfWidthMeters: 30,
			aglCeilingMeters: 150,
		},
	],
	idealPath: {
		segments: [
			{
				endT: 0,
				altitudeMsl: APPROACH_ALT_MSL_M,
				indicatedAirspeed: VAPP_MS,
				heading: RUNWAY_HEADING_RAD,
				pitch: -0.04,
				roll: 0,
				throttle: 0.45,
				label: 'Outer marker, established',
			},
			{
				endT: 90,
				altitudeMsl: FIELD_ALT_MSL_M + 200 * SIM_METERS_PER_FOOT,
				indicatedAirspeed: VAPP_MS,
				heading: RUNWAY_HEADING_RAD,
				pitch: -0.04,
				roll: 0,
				throttle: 0.4,
				label: 'Middle marker, decision altitude',
			},
			{
				endT: 120,
				altitudeMsl: FIELD_ALT_MSL_M,
				indicatedAirspeed: VAPP_MS * 0.95,
				heading: RUNWAY_HEADING_RAD,
				pitch: -0.02,
				roll: 0,
				throttle: 0.3,
				label: 'Inner marker, threshold',
			},
		],
	},
	grading: {
		components: [
			// Hold the glide-slope: target altitude is implicitly authored
			// in idealPath; here grade against staying close to the path
			// in altitude space.
			{ kind: 'ideal_path_match', weight: 0.4 },
			// Hold runway heading: 5 deg tolerance, 15 deg hard fail.
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
			{ kind: 'stall_margin', weight: 0.1 },
		],
	},
	repMetadata: {
		domain: 'instrument-approach',
		difficulty: 4,
		tags: ['ils', 'localiser', 'glide-slope', 'marker-beacon', 'phase-of-flight:approach'],
	},
};
