/**
 * Departure Stall -- pilot gets distracted after rotation.
 *
 * Teaches the learner to notice a creeping pitch-up trim and counter it
 * with forward pressure before the wing gives up. Through 200 ft AGL a
 * slow nose-up trim bias creeps in (simulating an out-of-trim takeoff or
 * the pilot's hand on the yoke drifting upward); the learner must hold
 * forward elevator and retrim to keep airspeed in the safe band all the
 * way to 1500 ft AGL.
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
const SUCCESS_AGL_FT = 1500;
const RUNWAY_HEADING_DEG = 90;
const DEG_TO_RAD = Math.PI / 180;
const VY_KIAS = 74;
const VY_MS = VY_KIAS / SIM_KNOTS_PER_METER_PER_SECOND;
const SUCCESS_ALT_MSL_M = (FIELD_ELEVATION_FT + SUCCESS_AGL_FT) * SIM_METERS_PER_FOOT;
const FIELD_ALT_MSL_M = FIELD_ELEVATION_FT * SIM_METERS_PER_FOOT;
const RUNWAY_HEADING_RAD = RUNWAY_HEADING_DEG * DEG_TO_RAD;

export const DEPARTURE_STALL_SCENARIO: ScenarioDefinition = {
	id: SIM_SCENARIO_IDS.DEPARTURE_STALL,
	title: 'Departure Stall',
	tagline: 'Trim drifts on the climbout. Catch it before airspeed decays.',
	objective: 'Full-throttle takeoff. Climb out. Do not let airspeed decay into a stall.',
	briefing:
		'Runway 09 at a 1000 ft field, light quartering wind. Release the brake, push the throttle to the firewall, and climb to 1500 ft AGL. Through 200 ft the airplane will want to pitch up on you -- stay ahead of it with forward pressure, and retrim as needed. Airspeed below 55 KIAS with the nose high near the ground is a stall you will not recover from.',
	recommendedOrder: 3,
	recommendationLabel: 'After First Flight',
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
		directionDegrees: 100,
		speedKnots: 7,
	},
	criteria: {
		successAltitudeAglMeters: SUCCESS_AGL_FT * SIM_METERS_PER_FOOT,
		failureSustainedStallSeconds: 1.0,
		failureMinimumAltitudeAglMeters: 0,
		timeoutSeconds: 240,
	},
	scriptedInput: {
		minAltitudeAglMeters: 200 * SIM_METERS_PER_FOOT,
		trimBiasRatePerSecond: 0.03,
		trimBiasMax: 0.6,
	},
	// Ideal-path keyframes: brake-release at t=0, rotate at ~10s, climb at
	// Vy through 1500 ft AGL by ~120s. The pilot's job is to hold airspeed
	// in the climb band; the path captures what a clean run looks like.
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
				endT: 10,
				altitudeMsl: FIELD_ALT_MSL_M,
				indicatedAirspeed: VY_MS * 0.75,
				heading: RUNWAY_HEADING_RAD,
				pitch: 0,
				roll: 0,
				throttle: 1,
				label: 'Rotate',
			},
			{
				endT: 30,
				altitudeMsl: FIELD_ALT_MSL_M + 200 * SIM_METERS_PER_FOOT,
				indicatedAirspeed: VY_MS,
				heading: RUNWAY_HEADING_RAD,
				pitch: 0.13,
				roll: 0,
				throttle: 1,
				label: 'Vy climb begin',
			},
			{
				endT: 120,
				altitudeMsl: SUCCESS_ALT_MSL_M,
				indicatedAirspeed: VY_MS,
				heading: RUNWAY_HEADING_RAD,
				pitch: 0.13,
				roll: 0,
				throttle: 1,
				label: 'Reach 1500 AGL',
			},
		],
	},
	grading: {
		components: [
			// Hold airspeed near Vy with a 5 KIAS tolerance band.
			{
				kind: 'airspeed_hold',
				weight: 0.5,
				params: {
					target: VY_MS,
					tolerance: 5 / SIM_KNOTS_PER_METER_PER_SECOND,
					hardFail: 15 / SIM_KNOTS_PER_METER_PER_SECOND,
				},
			},
			// Reward staying out of stall margin -- the failure mode the
			// scenario teaches against.
			{ kind: 'stall_margin', weight: 0.3 },
			// Hold runway heading on the climbout.
			{ kind: 'heading_hold', weight: 0.2, params: { target: RUNWAY_HEADING_RAD, tolerance: 10 * DEG_TO_RAD } },
		],
	},
	repMetadata: {
		domain: 'stalls',
		difficulty: 3,
		tags: ['departure', 'stall-recovery', 'trim-management', 'phase-of-flight:climb'],
	},
};
