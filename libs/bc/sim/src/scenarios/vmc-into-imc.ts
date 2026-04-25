/**
 * VMC into IMC -- VFR pilot blunders into clouds. The scenario teaches
 * the 180-degree turn back to VMC: recognise the loss of horizon,
 * commit to a coordinated standard-rate turn, hold attitude on the AI
 * + altimeter + airspeed, and roll out on a course back the way you
 * came.
 *
 * Without a horizon view the cockpit can't visually depict the cloud
 * entry; the scenario simulates IMC by:
 *   1. Starting in level flight at cruise.
 *   2. Adding a small vacuum drift after t=20 sec to simulate the
 *      stress of partial-panel-on-instruments + spatial disorientation.
 *   3. Grading on hold-altitude during a 180 turn -- the 180 itself
 *      is the recovery skill.
 *
 * When Phase 7 (Three.js horizon) ships, this scenario will be
 * augmented with a "lights go out" effect to actually represent the
 * loss of visual reference.
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

const CRUISE_ALT_FT = 4500;
const CRUISE_ALT_MSL_M = CRUISE_ALT_FT * SIM_METERS_PER_FOOT;
const ENTRY_HEADING_DEG = 270;
const DEG_TO_RAD = Math.PI / 180;
const ENTRY_HEADING_RAD = ENTRY_HEADING_DEG * DEG_TO_RAD;
const ESCAPE_HEADING_DEG = 90;
const ESCAPE_HEADING_RAD = ESCAPE_HEADING_DEG * DEG_TO_RAD;
const CRUISE_KIAS = 100;
const CRUISE_MS = CRUISE_KIAS / SIM_KNOTS_PER_METER_PER_SECOND;
const VACUUM_T_SECONDS = 20;
const RUN_DURATION_SECONDS = 240;

export const VMC_INTO_IMC_SCENARIO: ScenarioDefinition = {
	id: SIM_SCENARIO_IDS.VMC_INTO_IMC,
	title: 'VMC into IMC -- 180-degree turn',
	tagline: 'You blundered into clouds. Standard-rate turn back to VMC.',
	objective:
		'You are heading 270 at 4500 ft / 100 KIAS in deteriorating visibility. Execute a coordinated 180-degree turn back to heading 090 while holding altitude.',
	briefing:
		"You're flying west into a cloud bank you should not have entered. The sky goes white, the horizon vanishes, you have to get out. Standard procedure: scan the AI, level the wings, then roll into a 30-degree-bank standard-rate turn -- 180 degrees the way you came. Roll out on heading 090. Hold 4500 ft within 200 ft for the turn. The vacuum gyros will start drifting on you within 20 seconds, so the turn is on partial-panel by the time you finish it.",
	recommendedOrder: 12,
	recommendationLabel: 'Inadvertent IMC recovery',
	aircraft: SIM_AIRCRAFT_IDS.C172,
	runwayHeadingDegrees: ENTRY_HEADING_DEG,
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
		heading: ENTRY_HEADING_RAD,
		throttle: 0.7,
		elevator: 0,
		trim: 0.05,
		aileron: 0,
		rudder: 0,
		brake: false,
		autoCoordinate: true,
		flaps: SIM_FLAP_NOTCHES[0],
		onGround: false,
	},
	wind: { directionDegrees: 270, speedKnots: 5 },
	criteria: {
		failureSustainedStallSeconds: 1.0,
		failureMinimumAltitudeAglMeters: (CRUISE_ALT_FT - 1500) * SIM_METERS_PER_FOOT,
		timeoutSeconds: RUN_DURATION_SECONDS,
	},
	faults: [
		{
			kind: SIM_FAULT_KINDS.VACUUM_FAILURE,
			trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: VACUUM_T_SECONDS },
			params: { vacuumDriftDegPerSec: 0.5 },
		},
	],
	idealPath: {
		segments: [
			{
				endT: 0,
				altitudeMsl: CRUISE_ALT_MSL_M,
				indicatedAirspeed: CRUISE_MS,
				heading: ENTRY_HEADING_RAD,
				pitch: 0.04,
				roll: 0,
				throttle: 0.7,
				label: 'Cruise into IMC',
			},
			{
				endT: 30,
				altitudeMsl: CRUISE_ALT_MSL_M,
				indicatedAirspeed: CRUISE_MS,
				heading: 180 * DEG_TO_RAD,
				pitch: 0.04,
				roll: 30 * DEG_TO_RAD,
				throttle: 0.7,
				label: 'Mid-180-turn',
			},
			{
				endT: 60,
				altitudeMsl: CRUISE_ALT_MSL_M,
				indicatedAirspeed: CRUISE_MS,
				heading: ESCAPE_HEADING_RAD,
				pitch: 0.04,
				roll: 0,
				throttle: 0.7,
				label: 'Roll-out heading 090',
			},
			{
				endT: RUN_DURATION_SECONDS,
				altitudeMsl: CRUISE_ALT_MSL_M,
				indicatedAirspeed: CRUISE_MS,
				heading: ESCAPE_HEADING_RAD,
				pitch: 0.04,
				roll: 0,
				throttle: 0.7,
				label: 'Hold heading 090',
			},
		],
	},
	grading: {
		components: [
			// The 180 is the headline: roll out on the right heading.
			{ kind: 'heading_hold', weight: 0.4, params: { target: ESCAPE_HEADING_RAD, tolerance: 15 * DEG_TO_RAD } },
			{
				kind: 'altitude_hold',
				weight: 0.3,
				params: { target: CRUISE_ALT_MSL_M, tolerance: 200 * SIM_METERS_PER_FOOT, hardFail: 600 * SIM_METERS_PER_FOOT },
			},
			{
				kind: 'airspeed_hold',
				weight: 0.2,
				params: {
					target: CRUISE_MS,
					tolerance: 15 / SIM_KNOTS_PER_METER_PER_SECOND,
					hardFail: 30 / SIM_KNOTS_PER_METER_PER_SECOND,
				},
			},
			{ kind: 'stall_margin', weight: 0.1 },
		],
	},
	repMetadata: {
		domain: 'imc',
		difficulty: 5,
		tags: ['vmc-into-imc', '180-turn', 'partial-panel', 'spatial-disorientation', 'phase-of-flight:cruise'],
	},
};
