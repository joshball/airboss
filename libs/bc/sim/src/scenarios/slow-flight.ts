/**
 * Slow Flight -- the basic ACS task. The pilot configures for flight at
 * an airspeed where any further increase in angle of attack, increase in
 * load factor, or reduction in power will produce an immediate stall
 * warning. The classic target is about 5 KIAS above the stall warning
 * speed, full flaps, in level flight.
 *
 * The scenario teaches:
 *   - feel the airplane in the back of the lift curve, where pitch +
 *     power roles trade (pitch controls airspeed, power controls
 *     altitude)
 *   - hold airspeed within a tight band right above the stall warning
 *   - hold altitude precisely while flying near alpha-stall-warning
 *   - keep heading and coordination at very low airspeed where rudder
 *     authority is reduced
 *
 * This scenario is distinct from `aft-cg-slow-flight`, which adds the
 * trim-drift challenge of an aft CG. This is the standard ACS slow-flight
 * task -- forward CG, full flaps, hold the configuration.
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
const ENTRY_AGL_FT = 3500;
const ENTRY_HEADING_DEG = 270; // pointing west
const DEG_TO_RAD = Math.PI / 180;
// Slow-flight target: just above stall warning. C172S Vs0 ~ 40 KIAS at
// full flaps; ACS task targets about 5 KIAS above stall-warning onset.
// 50 KIAS is the published "slow flight" target on most C172 lesson plans.
const SLOW_FLIGHT_KIAS = 50;
const SLOW_FLIGHT_MS = SLOW_FLIGHT_KIAS / SIM_KNOTS_PER_METER_PER_SECOND;
const ENTRY_ALT_MSL_M = (FIELD_ELEVATION_FT + ENTRY_AGL_FT) * SIM_METERS_PER_FOOT;
const FIELD_ALT_MSL_M = FIELD_ELEVATION_FT * SIM_METERS_PER_FOOT;
const ENTRY_HEADING_RAD = ENTRY_HEADING_DEG * DEG_TO_RAD;

export const SLOW_FLIGHT_SCENARIO: ScenarioDefinition = {
	id: SIM_SCENARIO_IDS.SLOW_FLIGHT,
	title: 'Slow Flight',
	tagline: 'Hold 50 KIAS, full flaps, level. Live just above the stall warning.',
	objective:
		'Configure for slow flight at 50 KIAS / 3500 ft AGL with full flaps. Hold airspeed within 5 KIAS, altitude within 100 ft, heading within 10 deg.',
	briefing:
		'You are at 3500 ft AGL, configured slow with full flaps. Target airspeed is 50 KIAS -- just above the stall-warning onset. Pitch controls airspeed, power controls altitude. Use rudder, not aileron, for heading corrections; aileron at this speed walks you toward a spin. Hold the configuration for two minutes without busting the stall margin.',
	recommendedOrder: 18,
	recommendationLabel: 'After short-field landing -- back of the lift curve',
	aircraft: SIM_AIRCRAFT_IDS.C172,
	runwayHeadingDegrees: ENTRY_HEADING_DEG,
	initial: {
		altitude: ENTRY_ALT_MSL_M,
		groundElevation: FIELD_ALT_MSL_M,
		u: SLOW_FLIGHT_MS,
		w: 0,
		pitch: 0.16, // high pitch attitude is normal at this airspeed
		pitchRate: 0,
		roll: 0,
		rollRate: 0,
		yawRate: 0,
		heading: ENTRY_HEADING_RAD,
		throttle: 0.6, // power is up to maintain altitude on the back side
		elevator: 0,
		trim: 0.25,
		aileron: 0,
		rudder: 0,
		brake: false,
		autoCoordinate: true,
		flaps: SIM_FLAP_NOTCHES[3], // full flaps
		onGround: false,
	},
	wind: {
		// Light wind. The scenario is about airspeed/altitude precision,
		// not wind-correction.
		directionDegrees: ENTRY_HEADING_DEG,
		speedKnots: 4,
	},
	criteria: {
		// A real stall fails the maneuver. Long timeout covers the full hold.
		failureSustainedStallSeconds: 1.0,
		timeoutSeconds: 150,
	},
	grading: {
		components: [
			// Headline standard: airspeed within 5 KIAS of target.
			{
				kind: 'airspeed_hold',
				weight: 0.5,
				params: {
					target: SLOW_FLIGHT_MS,
					tolerance: 5 / SIM_KNOTS_PER_METER_PER_SECOND,
					hardFail: 12 / SIM_KNOTS_PER_METER_PER_SECOND,
				},
			},
			// Altitude within 100 ft.
			{
				kind: 'altitude_hold',
				weight: 0.3,
				params: {
					target: ENTRY_ALT_MSL_M,
					tolerance: 30 * SIM_METERS_PER_FOOT,
					hardFail: 100 * SIM_METERS_PER_FOOT,
				},
			},
			// Heading within 10 deg.
			{
				kind: 'heading_hold',
				weight: 0.2,
				params: {
					target: ENTRY_HEADING_RAD,
					tolerance: 10 * DEG_TO_RAD,
					hardFail: 25 * DEG_TO_RAD,
				},
			},
		],
	},
	repMetadata: {
		domain: 'slow-flight',
		difficulty: 3,
		tags: ['slow-flight', 'stall-margin', 'back-of-the-curve', 'phase-of-flight:cruise', 'visual-flying'],
	},
};
