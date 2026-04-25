/**
 * Engine Failure After Takeoff (EFATO) -- the takeoff goes well, then
 * the engine quits at ~400 ft AGL and the pilot has to commit to a
 * landing within the safe-cone in front of the airplane. Climbing turns
 * back to the runway are a textbook way to die at this altitude.
 *
 * The scenario teaches:
 *   - immediate trade altitude for airspeed (push the nose over hard)
 *   - pick a landing spot within ~30 deg of straight ahead
 *   - do not attempt a 180 turn back to the runway -- the impossible turn
 *     kills more pilots than the engine failure itself
 *   - flare and land or crash gently within the safe-cone
 *
 * The FDM forces throttle to zero once the airplane crosses 400 ft AGL.
 * The pilot has to glide the airplane to a survivable touchdown.
 */

import {
	SIM_AIRCRAFT_IDS,
	SIM_FLAP_NOTCHES,
	SIM_KNOTS_PER_METER_PER_SECOND,
	SIM_METERS_PER_FOOT,
	SIM_SCENARIO_IDS,
} from '@ab/constants';
import type { ScenarioDefinition } from '../types';

const FIELD_ELEVATION_FT = 1000;
const ENGINE_FAILURE_AGL_FT = 400;
const RUNWAY_HEADING_DEG = 90;
const DEG_TO_RAD = Math.PI / 180;
const VBESTGLIDE_KIAS = 68;
const VBESTGLIDE_MS = VBESTGLIDE_KIAS / SIM_KNOTS_PER_METER_PER_SECOND;
const FIELD_ALT_MSL_M = FIELD_ELEVATION_FT * SIM_METERS_PER_FOOT;
const FAILURE_ALT_MSL_M = (FIELD_ELEVATION_FT + ENGINE_FAILURE_AGL_FT) * SIM_METERS_PER_FOOT;
const RUNWAY_HEADING_RAD = RUNWAY_HEADING_DEG * DEG_TO_RAD;

export const EFATO_SCENARIO: ScenarioDefinition = {
	id: SIM_SCENARIO_IDS.EFATO,
	title: 'Engine Failure After Takeoff',
	tagline: 'The engine quits at 400 ft. Land straight ahead within the safe cone.',
	objective: 'Survive an engine failure on the climb-out. Trade altitude for airspeed. Land within the safe cone.',
	briefing:
		'Runway 09, 1000 ft field, light wind. Take off normally. At about 400 ft AGL the engine will quit. Do not turn back. Push the nose over to best-glide (68 KIAS), pick a landing spot within roughly 30 degrees of straight ahead, and put the airplane on the ground gently. The "impossible turn" kills people; the safe cone in front of you is your friend.',
	recommendedOrder: 4,
	recommendationLabel: 'After Departure Stall',
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
		heading: RUNWAY_HEADING_RAD,
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
		speedKnots: 5,
	},
	criteria: {
		// Success: the pilot got the airplane back on the ground without
		// stalling and within the safe cone (heading within 60 deg of
		// runway, in the runway-aligned half-plane). Hard timeout if
		// they keep flying around forever.
		failureSustainedStallSeconds: 1.0,
		timeoutSeconds: 180,
	},
	scriptedInput: {
		engineFailureAtAglMeters: ENGINE_FAILURE_AGL_FT * SIM_METERS_PER_FOOT,
	},
	idealPath: {
		segments: [
			{
				endT: 0,
				altitudeMsl: FIELD_ALT_MSL_M,
				indicatedAirspeed: 0,
				heading: RUNWAY_HEADING_RAD,
				pitch: 0,
				roll: 0,
				throttle: 0,
				label: 'Brake release',
			},
			{
				endT: 25,
				altitudeMsl: FAILURE_ALT_MSL_M,
				indicatedAirspeed: VBESTGLIDE_MS,
				heading: RUNWAY_HEADING_RAD,
				pitch: 0.13,
				roll: 0,
				throttle: 1,
				label: 'Engine fails at 400 AGL',
			},
			{
				endT: 35,
				altitudeMsl: FAILURE_ALT_MSL_M - 100 * SIM_METERS_PER_FOOT,
				indicatedAirspeed: VBESTGLIDE_MS,
				heading: RUNWAY_HEADING_RAD,
				pitch: -0.05,
				roll: 0,
				throttle: 0,
				label: 'Push for best-glide',
			},
			{
				endT: 75,
				altitudeMsl: FIELD_ALT_MSL_M,
				indicatedAirspeed: VBESTGLIDE_MS * 0.85,
				heading: RUNWAY_HEADING_RAD,
				pitch: 0.05,
				roll: 0,
				throttle: 0,
				label: 'Touchdown within safe cone',
			},
		],
	},
	grading: {
		components: [
			// Reaction time -- how fast the pilot got the nose over once the
			// engine quit. A throttle-idle gesture is the recognition signal.
			{ kind: 'reaction_time', weight: 0.4, params: { reactionPredicate: 'stick_forward' } },
			// Hold airspeed at best-glide.
			{
				kind: 'airspeed_hold',
				weight: 0.3,
				params: {
					target: VBESTGLIDE_MS,
					tolerance: 8 / SIM_KNOTS_PER_METER_PER_SECOND,
					hardFail: 20 / SIM_KNOTS_PER_METER_PER_SECOND,
				},
			},
			// Stay out of stall.
			{ kind: 'stall_margin', weight: 0.2 },
			// Stay close to runway heading -- "do not turn back" rendered as a
			// heading-hold target. Wide tolerance because the pilot may need
			// to deviate to find a landing spot.
			{ kind: 'heading_hold', weight: 0.1, params: { target: RUNWAY_HEADING_RAD, tolerance: 30 * DEG_TO_RAD } },
		],
	},
	repMetadata: {
		domain: 'efato',
		difficulty: 5,
		tags: ['engine-failure', 'best-glide', 'decision-making', 'phase-of-flight:climb', 'do-not-turn-back'],
	},
};
