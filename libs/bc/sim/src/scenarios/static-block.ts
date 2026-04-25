/**
 * Static port blockage on descent -- altimeter freezes, VSI reads zero,
 * ASI reverses sense. Pilot has to recognise the static-block signature
 * (three gauges all wrong in different directions) and fly the descent
 * by attitude + power + truth they can still trust (heading, RPM, GPS
 * altitude on a real airplane; just heading + RPM here).
 *
 * The scenario teaches:
 *   - static-block recognition: the altimeter freezes, VSI sticks at 0,
 *     ASI reverses sense (reads HIGHER on descent, LOWER on climb)
 *   - cross-check shows three "static" instruments lying together
 *   - alternate static source (selectively breaks the cabin static
 *     pressure differently) -- in real airplane, opens to cabin; here
 *     we just want the recognition + attitude-flying response
 *
 * Static block fires at 30 sec into a descent from cruise. The pilot
 * must hold a controlled descent without trusting altimeter / VSI / ASI.
 */

import {
	SIM_AIRCRAFT_IDS,
	SIM_FAULT_KINDS,
	SIM_FAULT_TRIGGER_KINDS,
	SIM_FLAP_NOTCHES,
	SIM_KNOTS_PER_METER_PER_SECOND,
	SIM_METERS_PER_FOOT,
	SIM_SCENARIO_IDS,
} from '@ab/constants';
import type { ScenarioDefinition } from '../types';

const CRUISE_ALT_FT = 5000;
const TARGET_ALT_FT = 2000;
const CRUISE_ALT_MSL_M = CRUISE_ALT_FT * SIM_METERS_PER_FOOT;
const TARGET_ALT_MSL_M = TARGET_ALT_FT * SIM_METERS_PER_FOOT;
const RUNWAY_HEADING_DEG = 90;
const DEG_TO_RAD = Math.PI / 180;
const HEADING_RAD = RUNWAY_HEADING_DEG * DEG_TO_RAD;
const CRUISE_KIAS = 95;
const CRUISE_MS = CRUISE_KIAS / SIM_KNOTS_PER_METER_PER_SECOND;
const FAILURE_T_SECONDS = 30;
const RUN_DURATION_SECONDS = 240;

export const STATIC_BLOCK_SCENARIO: ScenarioDefinition = {
	id: SIM_SCENARIO_IDS.STATIC_BLOCK,
	title: 'Static Blockage on Descent',
	tagline: 'Three gauges lie at once. Fly attitude + power.',
	objective:
		'Descend from 5000 to 2000 ft. When the static port blocks, recognise the pattern (altimeter frozen, VSI zero, ASI reversed) and fly attitude + power.',
	briefing:
		'Cruise at 5000 ft, 95 KIAS, heading 090. About 30 seconds in your static port will block. The altimeter will freeze; the VSI will read zero; the ASI will start reading too high as you descend. None of those three gauges will help you down. Recognise the pattern, set a known descent attitude (about 3 deg nose down) and reduce power. Get the airplane to 2000 ft within four minutes.',
	recommendedOrder: 7,
	recommendationLabel: 'Static-block recognition',
	aircraft: SIM_AIRCRAFT_IDS.C172,
	runwayHeadingDegrees: RUNWAY_HEADING_DEG,
	initial: {
		altitude: CRUISE_ALT_MSL_M,
		groundElevation: 0,
		u: CRUISE_MS,
		w: 0,
		pitch: 0.04,
		pitchRate: 0,
		roll: 0,
		rollRate: 0,
		yawRate: 0,
		heading: HEADING_RAD,
		throttle: 0.65,
		elevator: 0,
		trim: 0.05,
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
		failureMinimumAltitudeAglMeters: 1000 * SIM_METERS_PER_FOOT,
		timeoutSeconds: RUN_DURATION_SECONDS,
	},
	faults: [
		{
			kind: SIM_FAULT_KINDS.STATIC_BLOCK,
			trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: FAILURE_T_SECONDS },
			params: {
				staticBlockFreezeAltFt: CRUISE_ALT_FT,
			},
		},
	],
	idealPath: {
		segments: [
			{
				endT: 0,
				altitudeMsl: CRUISE_ALT_MSL_M,
				indicatedAirspeed: CRUISE_MS,
				heading: HEADING_RAD,
				pitch: 0.04,
				roll: 0,
				throttle: 0.65,
				label: 'Stable cruise',
			},
			{
				endT: FAILURE_T_SECONDS,
				altitudeMsl: CRUISE_ALT_MSL_M,
				indicatedAirspeed: CRUISE_MS,
				heading: HEADING_RAD,
				pitch: 0.04,
				roll: 0,
				throttle: 0.65,
				label: 'Static blocks',
			},
			{
				endT: RUN_DURATION_SECONDS,
				altitudeMsl: TARGET_ALT_MSL_M,
				indicatedAirspeed: CRUISE_MS * 0.85,
				heading: HEADING_RAD,
				pitch: -0.05,
				roll: 0,
				throttle: 0.45,
				label: 'Reach 2000 ft on attitude + power',
			},
		],
	},
	grading: {
		components: [
			// Get to the target altitude is the headline measurement.
			{
				kind: 'altitude_hold',
				weight: 0.4,
				params: { target: TARGET_ALT_MSL_M, tolerance: 200 * SIM_METERS_PER_FOOT },
			},
			{ kind: 'heading_hold', weight: 0.2, params: { target: HEADING_RAD, tolerance: 10 * DEG_TO_RAD } },
			{
				kind: 'airspeed_hold',
				weight: 0.2,
				params: {
					target: CRUISE_MS * 0.9,
					tolerance: 15 / SIM_KNOTS_PER_METER_PER_SECOND,
					hardFail: 30 / SIM_KNOTS_PER_METER_PER_SECOND,
				},
			},
			{ kind: 'stall_margin', weight: 0.1 },
			{ kind: 'reaction_time', weight: 0.1, params: { triggerFaultKind: SIM_FAULT_KINDS.STATIC_BLOCK } },
		],
	},
	repMetadata: {
		domain: 'partial-panel',
		difficulty: 4,
		tags: ['static-block', 'partial-panel', 'pitch-and-power', 'phase-of-flight:descent'],
	},
};
