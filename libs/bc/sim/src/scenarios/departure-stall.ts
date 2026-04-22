/**
 * Departure Stall -- the Phase 0 seed scenario.
 *
 * Puts the pilot at ~50 ft AGL, full throttle, in a nose-high climbing
 * attitude typical of a short-field departure. Too much back-pressure =
 * stall near the ground; too little = lose the climb. Success = reach
 * 500 ft AGL without holding a stall longer than a second.
 */

import { SIM_AIRCRAFT_IDS, SIM_METERS_PER_FOOT, SIM_SCENARIO_IDS } from '@ab/constants';
import type { ScenarioDefinition } from '../types';

const FIELD_ELEVATION_FT = 1000;
const START_AGL_FT = 50;
const SUCCESS_AGL_FT = 500;

const DEG_TO_RAD = Math.PI / 180;

export const DEPARTURE_STALL_SCENARIO: ScenarioDefinition = {
	id: SIM_SCENARIO_IDS.DEPARTURE_STALL,
	title: 'Departure Stall',
	objective: 'Maintain flying airspeed. Do not stall.',
	briefing:
		'Short-field takeoff from a 1000 ft MSL runway. You just lifted off at Vr with full throttle and a nose-high attitude. Climb to 500 ft AGL without stalling -- keep the elevator honest.',
	aircraft: SIM_AIRCRAFT_IDS.C172,
	initial: {
		altitude: (FIELD_ELEVATION_FT + START_AGL_FT) * SIM_METERS_PER_FOOT,
		groundElevation: FIELD_ELEVATION_FT * SIM_METERS_PER_FOOT,
		// ~55 KIAS horizontal, small positive vertical component -- climbing
		// out of rotation.
		u: 28,
		w: 2.5,
		pitch: 10 * DEG_TO_RAD,
		pitchRate: 0,
		throttle: 1.0,
		elevator: 0.0,
		onGround: false,
	},
	criteria: {
		successAltitudeAglMeters: SUCCESS_AGL_FT * SIM_METERS_PER_FOOT,
		failureSustainedStallSeconds: 1.0,
		failureMinimumAltitudeAglMeters: 0,
		timeoutSeconds: 60,
	},
};
