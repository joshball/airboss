/**
 * Playground -- free flight, no pass or fail. The learner sits on runway
 * 09 with the parking brake set; they choose what to do. No clock, no
 * objective, no graduation. Sole purpose: practice the controls.
 */

import { SIM_AIRCRAFT_IDS, SIM_FLAP_NOTCHES, SIM_METERS_PER_FOOT, SIM_SCENARIO_IDS } from '@ab/constants';
import type { ScenarioDefinition } from '../types';

const FIELD_ELEVATION_FT = 1000;
const RUNWAY_HEADING_DEG = 90;
const DEG_TO_RAD = Math.PI / 180;

export const PLAYGROUND_SCENARIO: ScenarioDefinition = {
	id: SIM_SCENARIO_IDS.PLAYGROUND,
	title: 'Playground',
	tagline: 'Free flight. No pass, no fail. Practice the controls.',
	objective: 'Free flight. Practice taxi, takeoff, turns, climbs, descents. No objective.',
	briefing:
		'Runway 09 at a 1000 ft field, no wind. Parking brake is set. Auto-coordinate is on. Release the brake with the period key, feed in throttle, rudder to steer. Take off when you want to. Press ? at any time to see the key map.',
	recommendedOrder: 1,
	recommendationLabel: 'Recommended first',
	aircraft: SIM_AIRCRAFT_IDS.C172,
	runwayHeadingDegrees: RUNWAY_HEADING_DEG,
	initial: {
		altitude: FIELD_ELEVATION_FT * SIM_METERS_PER_FOOT,
		groundElevation: FIELD_ELEVATION_FT * SIM_METERS_PER_FOOT,
		u: 0,
		w: 0,
		pitch: 0,
		pitchRate: 0,
		roll: 0,
		rollRate: 0,
		yawRate: 0,
		heading: RUNWAY_HEADING_DEG * DEG_TO_RAD,
		throttle: 0.0,
		elevator: 0,
		trim: 0,
		aileron: 0,
		rudder: 0,
		brake: true,
		autoCoordinate: true,
		flaps: SIM_FLAP_NOTCHES[0],
		onGround: true,
	},
	wind: {
		directionDegrees: 90,
		speedKnots: 0,
	},
	criteria: {
		endless: true,
	},
};
