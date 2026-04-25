/**
 * Partial Panel -- worst-case combination: vacuum + alternator both fail.
 * AI / HI drift, TC fades, the pilot has only airspeed + altimeter +
 * magnetic compass + tach to fly with. The recovery skill being trained
 * is the cross-check pattern + the discipline of believing the few
 * remaining truth sources.
 *
 * Faults fire 30 sec apart so the pilot sees two distinct recognition
 * signatures and has to integrate both. Vacuum first; alternator at
 * t=60 once the pilot has switched scans.
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

const CRUISE_ALT_FT = 4000;
const CRUISE_ALT_MSL_M = CRUISE_ALT_FT * SIM_METERS_PER_FOOT;
const RUNWAY_HEADING_DEG = 90;
const DEG_TO_RAD = Math.PI / 180;
const HEADING_RAD = RUNWAY_HEADING_DEG * DEG_TO_RAD;
const CRUISE_KIAS = 95;
const CRUISE_MS = CRUISE_KIAS / SIM_KNOTS_PER_METER_PER_SECOND;
const VACUUM_T_SECONDS = 30;
const ALTERNATOR_T_SECONDS = 60;
const RUN_DURATION_SECONDS = 300;

export const PARTIAL_PANEL_SCENARIO: ScenarioDefinition = {
	id: SIM_SCENARIO_IDS.PARTIAL_PANEL,
	title: 'Partial Panel -- Vacuum + Alternator',
	tagline: 'Two systems fail. Trust airspeed, altimeter, and the magnetic compass.',
	objective:
		'Hold heading and altitude through a vacuum failure followed by an alternator failure. End the run on partial panel with the airplane controlled.',
	briefing:
		'Cruise at 4000 ft, 95 KIAS, heading 090. About 30 seconds in your vacuum gyros will start drifting -- catch it on the AI/HI cross-check. Thirty seconds after that the alternator will quit -- the TC will fade, the bus will go to the battery, and the LOW VOLTS lamp will light. End the run on partial panel: airspeed, altimeter, magnetic compass, tach. Hold 090 within 15 degrees and 4000 ft within 200 ft for the rest of the five-minute run.',
	recommendedOrder: 8,
	recommendationLabel: 'Worst-case partial panel',
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
		failureMinimumAltitudeAglMeters: (CRUISE_ALT_FT - 1500) * SIM_METERS_PER_FOOT,
		timeoutSeconds: RUN_DURATION_SECONDS,
	},
	faults: [
		{
			kind: SIM_FAULT_KINDS.VACUUM_FAILURE,
			trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: VACUUM_T_SECONDS },
			params: { vacuumDriftDegPerSec: 1 },
		},
		{
			kind: SIM_FAULT_KINDS.ALTERNATOR_FAILURE,
			trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: ALTERNATOR_T_SECONDS },
			params: { alternatorDecaySeconds: 60 },
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
				endT: VACUUM_T_SECONDS,
				altitudeMsl: CRUISE_ALT_MSL_M,
				indicatedAirspeed: CRUISE_MS,
				heading: HEADING_RAD,
				pitch: 0.04,
				roll: 0,
				throttle: 0.65,
				label: 'Vacuum fails',
			},
			{
				endT: ALTERNATOR_T_SECONDS,
				altitudeMsl: CRUISE_ALT_MSL_M,
				indicatedAirspeed: CRUISE_MS,
				heading: HEADING_RAD,
				pitch: 0.04,
				roll: 0,
				throttle: 0.65,
				label: 'Alternator fails',
			},
			{
				endT: RUN_DURATION_SECONDS,
				altitudeMsl: CRUISE_ALT_MSL_M,
				indicatedAirspeed: CRUISE_MS,
				heading: HEADING_RAD,
				pitch: 0.04,
				roll: 0,
				throttle: 0.65,
				label: 'Hold partial panel to end-of-run',
			},
		],
	},
	grading: {
		components: [
			{
				kind: 'altitude_hold',
				weight: 0.4,
				params: { target: CRUISE_ALT_MSL_M, tolerance: 200 * SIM_METERS_PER_FOOT, hardFail: 600 * SIM_METERS_PER_FOOT },
			},
			{ kind: 'heading_hold', weight: 0.3, params: { target: HEADING_RAD, tolerance: 15 * DEG_TO_RAD } },
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
		domain: 'partial-panel',
		difficulty: 5,
		tags: ['vacuum-failure', 'alternator-failure', 'partial-panel', 'worst-case', 'phase-of-flight:cruise'],
	},
};
