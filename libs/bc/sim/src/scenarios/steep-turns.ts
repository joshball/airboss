/**
 * Steep Turns -- a VFR maneuver that is best practiced visually,
 * not on the gauges. The pilot rolls into a 45-degree bank, holds it
 * through a full 360-degree turn, then rolls out on the original
 * heading without losing more than 100 ft of altitude. Then repeat in
 * the opposite direction.
 *
 * The scenario teaches:
 *   - keep the bank steady at 45 degrees
 *   - add elevator back-pressure to maintain altitude (load factor goes
 *     from 1g to about 1.41g at 45 degrees)
 *   - keep coordinated (slip-ball centered)
 *   - finish on the entry heading without ballooning or descending
 *
 * This is the first scenario explicitly designed for the Phase 7
 * outside-the-cockpit horizon view. The cockpit page shows the gauges,
 * but the dual / window page lets the pilot fly the maneuver visually
 * the way a real-airplane CFI would teach it -- keeping the horizon
 * the right distance above the cowl.
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
const ENTRY_AGL_FT = 3000;
const ENTRY_HEADING_DEG = 360; // pointing north
const ENTRY_KIAS = 95;
const DEG_TO_RAD = Math.PI / 180;
const ENTRY_MS = ENTRY_KIAS / SIM_KNOTS_PER_METER_PER_SECOND;
const ENTRY_ALT_MSL_M = (FIELD_ELEVATION_FT + ENTRY_AGL_FT) * SIM_METERS_PER_FOOT;
const FIELD_ALT_MSL_M = FIELD_ELEVATION_FT * SIM_METERS_PER_FOOT;
const ENTRY_HEADING_RAD = ENTRY_HEADING_DEG * DEG_TO_RAD;

export const STEEP_TURNS_SCENARIO: ScenarioDefinition = {
	id: SIM_SCENARIO_IDS.STEEP_TURNS,
	title: 'Steep Turns',
	tagline: 'Roll into 45 deg of bank. Hold altitude through 360 deg. Roll out on entry heading.',
	objective:
		'Hold a 45-degree banked turn through a full circle. Keep altitude within 100 ft and finish on the entry heading.',
	briefing:
		'You are at 3000 ft AGL, 95 KIAS, pointing north. Roll into a 45-degree banked turn (either direction). Add back-pressure to maintain altitude. Hold the bank steady through a full 360 degrees. Roll out wings-level on north. The horizon view (Window or Dual surface) is the right place to fly this -- look outside, not at the gauges. Use the ASI and AI as cross-references, not the primary signal.',
	recommendedOrder: 15,
	recommendationLabel: 'VFR maneuver -- best on the Window surface',
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
		throttle: 0.6,
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
		// Light wind. The scenario is about bank + altitude control, not
		// crab correction.
		directionDegrees: 360,
		speedKnots: 5,
	},
	criteria: {
		failureSustainedStallSeconds: 1.0,
		// Generous timeout: 360 deg at standard rate (3 deg/s) is 2 min;
		// at 45-deg-bank standard practice (~12-15 deg/s) it's ~25 sec.
		// Allow time for two consecutive turns + roll-in/out + recovery.
		timeoutSeconds: 180,
	},
	grading: {
		components: [
			// Altitude hold within 100 ft is the headline standard.
			{
				kind: 'altitude_hold',
				weight: 0.5,
				params: {
					target: ENTRY_ALT_MSL_M,
					tolerance: 30 * SIM_METERS_PER_FOOT,
					hardFail: 150 * SIM_METERS_PER_FOOT,
				},
			},
			// Hold airspeed close to entry: 95 KIAS +/- 10 within tolerance.
			{
				kind: 'airspeed_hold',
				weight: 0.3,
				params: {
					target: ENTRY_MS,
					tolerance: 10 / SIM_KNOTS_PER_METER_PER_SECOND,
					hardFail: 25 / SIM_KNOTS_PER_METER_PER_SECOND,
				},
			},
			// Stay out of accelerated stall.
			{ kind: 'stall_margin', weight: 0.2 },
		],
	},
	repMetadata: {
		domain: 'vfr-maneuvers',
		difficulty: 3,
		tags: ['steep-turns', 'bank-control', 'load-factor', 'phase-of-flight:cruise', 'visual-flying'],
	},
};
