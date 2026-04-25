/**
 * Playground PA-28 -- free flight in the Warrior. Identical structure
 * to the C172 Playground but pinned to the PA-28 aircraft profile.
 *
 * Lets a learner feel the difference between high-wing (C172) and
 * low-wing (PA-28) handling without authoring a graded scenario.
 */

import { SIM_AIRCRAFT_IDS, SIM_FLAP_NOTCHES, SIM_METERS_PER_FOOT, SIM_SCENARIO_IDS } from '@ab/constants';
import type { ScenarioDefinition } from '../types';

const FIELD_ELEVATION_FT = 1000;
const RUNWAY_HEADING_DEG = 90;
const DEG_TO_RAD = Math.PI / 180;

export const PLAYGROUND_PA28_SCENARIO: ScenarioDefinition = {
	id: SIM_SCENARIO_IDS.PLAYGROUND_PA28,
	title: 'Playground (PA-28)',
	tagline: 'Free flight in the Warrior. Same field, different airframe.',
	objective: 'Free flight in the PA-28. Practice taxi, takeoff, turns, climbs, descents. No objective.',
	briefing:
		'Same field, same runway, same controls -- but you are flying a Piper PA-28 Warrior instead of a C172. Notice how the airplane feels heavier, the climb is slower at full throttle, and the V-speeds shift higher. The PA-28 stalls at 50 KIAS clean (vs 44 in the C172) and rotates around 55. Otherwise the cockpit and the inputs are unchanged.',
	recommendedOrder: 13,
	recommendationLabel: 'Try the Warrior',
	aircraft: SIM_AIRCRAFT_IDS.PA28,
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
