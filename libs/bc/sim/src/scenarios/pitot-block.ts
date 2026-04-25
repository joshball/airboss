/**
 * Pitot blockage on the climb-out -- the ASI starts behaving like a
 * second altimeter, the pilot has to recognise the lie before reacting
 * to "indicated airspeed" they no longer have.
 *
 * The scenario teaches:
 *   - pitot-block recognition: ASI rises with altitude even at constant
 *     throttle / pitch
 *   - cross-check ASI against attitude + power (textbook partial-panel)
 *   - hold a known-good pitch + power setting and ignore the ASI for
 *     the rest of the climb
 *
 * Pitot block fires at 60 seconds; the freeze-time IAS is captured so
 * the gauge starts truthful and diverges from there.
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

const FIELD_ELEVATION_FT = 1000;
const FIELD_ALT_MSL_M = FIELD_ELEVATION_FT * SIM_METERS_PER_FOOT;
const RUNWAY_HEADING_DEG = 90;
const DEG_TO_RAD = Math.PI / 180;
const HEADING_RAD = RUNWAY_HEADING_DEG * DEG_TO_RAD;
const VY_KIAS = 74;
const VY_MS = VY_KIAS / SIM_KNOTS_PER_METER_PER_SECOND;
// 1500 ft AGL ~= 2500 ft MSL at this field; the run targets a steady
// climb past the failure to 4000 ft AGL so the pilot has time to
// detect + correct.
const TARGET_ALT_MSL_M = (FIELD_ELEVATION_FT + 4000) * SIM_METERS_PER_FOOT;
const FAILURE_T_SECONDS = 60;
const PITOT_BLOCK_AT_KIAS = 80;
const RUN_DURATION_SECONDS = 240;

export const PITOT_BLOCK_SCENARIO: ScenarioDefinition = {
	id: SIM_SCENARIO_IDS.PITOT_BLOCK,
	title: 'Pitot Blockage on Climb',
	tagline: 'The ASI is lying to you. Hold pitch + power and trust the picture.',
	objective:
		'Climb out normally. When the ASI starts reading too high, recognise the pitot block and hold a known-good pitch + power instead of reacting to the gauge.',
	briefing:
		'Standard climb-out from runway 09. About a minute in, the pitot tube ices over (or stays blocked from a stuck cover -- the cause does not matter). The ASI will start reading higher than truth as you climb -- if you push the nose down to "slow down," you will dive into a real low-airspeed situation. The recovery is to hold the pitch attitude that gave you Vy when the gauge was right, and the power setting that gave you the climb. Trust the picture. Continue to 4000 ft AGL on partial panel.',
	recommendedOrder: 6,
	recommendationLabel: 'After Vacuum Failure',
	aircraft: SIM_AIRCRAFT_IDS.C172,
	runwayHeadingDegrees: RUNWAY_HEADING_DEG,
	initial: {
		altitude: FIELD_ALT_MSL_M,
		groundElevation: FIELD_ALT_MSL_M,
		u: 0,
		w: 0,
		pitch: 0,
		pitchRate: 0,
		roll: 0,
		rollRate: 0,
		yawRate: 0,
		heading: HEADING_RAD,
		throttle: 0,
		elevator: 0,
		trim: 0,
		aileron: 0,
		rudder: 0,
		brake: true,
		autoCoordinate: true,
		flaps: SIM_FLAP_NOTCHES[0],
		onGround: true,
	},
	wind: { directionDegrees: 90, speedKnots: 5 },
	criteria: {
		successAltitudeAglMeters: 4000 * SIM_METERS_PER_FOOT,
		failureSustainedStallSeconds: 1.0,
		failureMinimumAltitudeAglMeters: 0,
		timeoutSeconds: RUN_DURATION_SECONDS,
	},
	faults: [
		{
			kind: SIM_FAULT_KINDS.PITOT_BLOCK,
			trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: FAILURE_T_SECONDS },
			params: {
				pitotBlockFreezeKias: PITOT_BLOCK_AT_KIAS,
				// The pitot-block ASI math anchors to staticBlockFreezeAltFt
				// as the "block-time altitude" reference. Use the field
				// altitude + ~1500 ft AGL as the reference altitude where
				// the freeze captured.
				staticBlockFreezeAltFt: FIELD_ELEVATION_FT + 1500,
			},
		},
	],
	idealPath: {
		segments: [
			{
				endT: 0,
				altitudeMsl: FIELD_ALT_MSL_M,
				indicatedAirspeed: 0,
				heading: HEADING_RAD,
				pitch: 0,
				roll: 0,
				throttle: 0,
				label: 'Brake release',
			},
			{
				endT: FAILURE_T_SECONDS,
				altitudeMsl: FIELD_ALT_MSL_M + 1500 * SIM_METERS_PER_FOOT,
				indicatedAirspeed: VY_MS,
				heading: HEADING_RAD,
				pitch: 0.13,
				roll: 0,
				throttle: 1,
				label: 'Pitot blocks',
			},
			{
				endT: RUN_DURATION_SECONDS,
				altitudeMsl: TARGET_ALT_MSL_M,
				indicatedAirspeed: VY_MS,
				heading: HEADING_RAD,
				pitch: 0.13,
				roll: 0,
				throttle: 1,
				label: 'Hold attitude + power to 4000 AGL',
			},
		],
	},
	grading: {
		components: [
			// The teaching point: hold pitch attitude post-failure, do not
			// chase the ASI down into a low-airspeed dive.
			{
				kind: 'altitude_hold',
				weight: 0.4,
				params: {
					target: TARGET_ALT_MSL_M,
					tolerance: 200 * SIM_METERS_PER_FOOT,
				},
			},
			{
				kind: 'airspeed_hold',
				weight: 0.3,
				params: {
					target: VY_MS,
					tolerance: 8 / SIM_KNOTS_PER_METER_PER_SECOND,
					hardFail: 25 / SIM_KNOTS_PER_METER_PER_SECOND,
				},
			},
			{ kind: 'stall_margin', weight: 0.2 },
			{ kind: 'heading_hold', weight: 0.1, params: { target: HEADING_RAD, tolerance: 15 * DEG_TO_RAD } },
		],
	},
	repMetadata: {
		domain: 'partial-panel',
		difficulty: 4,
		tags: ['pitot-block', 'partial-panel', 'pitch-and-power', 'phase-of-flight:climb'],
	},
};
