/**
 * Vacuum Failure -- you are at cruise, the AI starts to drift, and you
 * have to recognise it and switch to your partial-panel scan before
 * a creeping bank tips into a graveyard spiral.
 *
 * Teaches:
 *   - recognise a vacuum failure by cross-checking AI vs turn coordinator
 *     and HI vs magnetic compass
 *   - switch to T/B scan + altimeter + airspeed
 *   - hold heading and altitude on the partial panel for the rest of the
 *     run
 *
 * The fault model fires `vacuum_failure` 30 seconds in. The AI starts
 * pitching nose-up and rolling right at 1 deg/s; the HI heading drifts
 * left. The pilot has to keep the airplane upright and on heading using
 * only the TC (electric) and the magnetic compass.
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

const CRUISE_ALT_FT = 3500;
const CRUISE_ALT_MSL_M = CRUISE_ALT_FT * SIM_METERS_PER_FOOT;
const RUNWAY_HEADING_DEG = 90;
const DEG_TO_RAD = Math.PI / 180;
const CRUISE_KIAS = 95;
const CRUISE_MS = CRUISE_KIAS / SIM_KNOTS_PER_METER_PER_SECOND;
const HEADING_RAD = RUNWAY_HEADING_DEG * DEG_TO_RAD;
const FAILURE_T_SECONDS = 30;
const RUN_DURATION_SECONDS = 240;

export const VACUUM_FAILURE_SCENARIO: ScenarioDefinition = {
	id: SIM_SCENARIO_IDS.VACUUM_FAILURE,
	title: 'Vacuum Failure at Cruise',
	tagline: 'The AI drifts. Catch it before the wing follows.',
	objective:
		'Recognise the vacuum failure by cross-check, switch to partial panel, hold heading and altitude for four minutes.',
	briefing:
		'Cruise at 3500 ft, 95 KIAS, heading 090. After about 30 seconds your vacuum-driven gyros will start to drift. The AI will pitch up and roll right; the HI will drift left. Cross-check the turn coordinator (electric, still good) and the magnetic compass to recognise the failure. Once you are on partial panel, hold heading 090 within 10 degrees and altitude within 100 ft for the remainder of the run.',
	recommendedOrder: 5,
	recommendationLabel: 'Partial-panel introduction',
	aircraft: SIM_AIRCRAFT_IDS.C172,
	runwayHeadingDegrees: RUNWAY_HEADING_DEG,
	initial: {
		altitude: CRUISE_ALT_MSL_M,
		// Cruise scenarios start with the airplane in trim so the pilot can
		// focus on recognition + recovery rather than first wrestling the
		// airplane down to a stable cruise.
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
	wind: {
		directionDegrees: 90,
		speedKnots: 0,
	},
	criteria: {
		failureSustainedStallSeconds: 1.0,
		// Cruise altitude floor: bust 1000 ft below the start and you have
		// lost the airplane.
		failureMinimumAltitudeAglMeters: (CRUISE_ALT_FT - 1000) * SIM_METERS_PER_FOOT,
		timeoutSeconds: RUN_DURATION_SECONDS,
	},
	faults: [
		{
			kind: SIM_FAULT_KINDS.VACUUM_FAILURE,
			trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: FAILURE_T_SECONDS },
			params: {
				vacuumDriftDegPerSec: 1,
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
				label: 'Vacuum fails',
			},
			{
				endT: RUN_DURATION_SECONDS,
				altitudeMsl: CRUISE_ALT_MSL_M,
				indicatedAirspeed: CRUISE_MS,
				heading: HEADING_RAD,
				pitch: 0.04,
				roll: 0,
				throttle: 0.65,
				label: 'Hold partial panel',
			},
		],
	},
	grading: {
		components: [
			// The failure mode is "you let it drift" -- altitude and heading
			// are the load-bearing measurements.
			{
				kind: 'altitude_hold',
				weight: 0.4,
				params: {
					target: CRUISE_ALT_MSL_M,
					tolerance: 100 * SIM_METERS_PER_FOOT,
					hardFail: 500 * SIM_METERS_PER_FOOT,
				},
			},
			{ kind: 'heading_hold', weight: 0.3, params: { target: HEADING_RAD, tolerance: 10 * DEG_TO_RAD } },
			{
				kind: 'airspeed_hold',
				weight: 0.2,
				params: {
					target: CRUISE_MS,
					tolerance: 10 / SIM_KNOTS_PER_METER_PER_SECOND,
					hardFail: 25 / SIM_KNOTS_PER_METER_PER_SECOND,
				},
			},
			// Recognition signal -- the pilot's first non-trivial control
			// input post-failure indicates they noticed.
			{ kind: 'reaction_time', weight: 0.1, params: { triggerFaultKind: SIM_FAULT_KINDS.VACUUM_FAILURE } },
		],
	},
	repMetadata: {
		domain: 'partial-panel',
		difficulty: 4,
		tags: ['vacuum-failure', 'partial-panel', 'instrument-cross-check', 'phase-of-flight:cruise'],
	},
};
