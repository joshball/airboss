/**
 * First Flight -- guided tutorial from runway to altitude to cruise and
 * back. Walks the learner through every major control in order: brake
 * release, throttle, rotate, climb at Vy, level off, heading control,
 * descend, return to altitude. Each step has a predicate; the scenario
 * advances when the predicate is continuously satisfied for its hold
 * duration.
 */

import { SIM_AIRCRAFT_IDS, SIM_FLAP_NOTCHES, SIM_METERS_PER_FOOT, SIM_SCENARIO_IDS } from '@ab/constants';
import type { ScenarioDefinition, ScenarioStepDefinition } from '../types';

const FIELD_ELEVATION_FT = 1000;
const RUNWAY_HEADING_DEG = 90;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

const TARGET_CLIMB_KIAS = 74;
const CLIMB_TOLERANCE_KTS = 5;
const CRUISE_TARGET_AGL_FT = 2000;
const CRUISE_TOLERANCE_FT = 100;
const DESCENT_TARGET_AGL_FT = 1500;
const HEADING_TOLERANCE_DEG = 5;

const KNOTS_PER_M_S = 1.943844492440605;

function aglFeet(truth: { altitude: number; groundElevation: number }): number {
	return (truth.altitude - truth.groundElevation) * (1 / SIM_METERS_PER_FOOT);
}

function headingDifferenceDegrees(headingRad: number, targetDeg: number): number {
	const actualDeg = (((headingRad * RAD_TO_DEG) % 360) + 360) % 360;
	let diff = actualDeg - targetDeg;
	while (diff > 180) diff -= 360;
	while (diff < -180) diff += 360;
	return diff;
}

const FIRST_FLIGHT_STEPS: readonly ScenarioStepDefinition[] = [
	{
		id: 'release-brake',
		title: 'Release the parking brake',
		instruction: 'Press the period key ( . ) to release the parking brake.',
		check: (_truth, ctx) => !ctx.brakeOn,
	},
	{
		id: 'full-throttle',
		title: 'Set full throttle',
		instruction: 'Hold Shift (or press 9) until the throttle bar is full.',
		check: (_truth, ctx) => ctx.throttle >= 0.98,
	},
	{
		id: 'rotate',
		title: 'Rotate at Vr (55 KIAS)',
		instruction: 'When airspeed reaches 55 KIAS, pull back on the elevator (W) to lift off.',
		check: (truth) => !truth.onGround && truth.indicatedAirspeed * KNOTS_PER_M_S >= 55,
	},
	{
		id: 'climb-vy',
		title: 'Climb at Vy (74 KIAS)',
		instruction: 'Hold 74 KIAS (+/- 5 kt) for 10 seconds using pitch. Trim down ( [ ) if the nose wants up.',
		holdSeconds: 10,
		check: (truth) => {
			if (truth.onGround) return false;
			const kias = truth.indicatedAirspeed * KNOTS_PER_M_S;
			return Math.abs(kias - TARGET_CLIMB_KIAS) <= CLIMB_TOLERANCE_KTS;
		},
	},
	{
		id: 'level-2000',
		title: 'Level off at 2000 ft AGL',
		instruction: 'Level at 2000 ft AGL (+/- 100 ft) for 15 seconds. Reduce pitch as you approach altitude.',
		holdSeconds: 15,
		check: (truth) => {
			if (truth.onGround) return false;
			const agl = aglFeet(truth);
			return Math.abs(agl - CRUISE_TARGET_AGL_FT) <= CRUISE_TOLERANCE_FT;
		},
	},
	{
		id: 'heading-180',
		title: 'Turn to heading 180',
		instruction: 'Bank right to heading 180 (+/- 5 deg) and hold for 10 seconds.',
		holdSeconds: 10,
		check: (truth) => {
			if (truth.onGround) return false;
			return Math.abs(headingDifferenceDegrees(truth.heading, 180)) <= HEADING_TOLERANCE_DEG;
		},
	},
	{
		id: 'heading-360',
		title: 'Turn to heading 360',
		instruction: 'Bank left to heading 360 (+/- 5 deg) and hold for 10 seconds.',
		holdSeconds: 10,
		check: (truth) => {
			if (truth.onGround) return false;
			return Math.abs(headingDifferenceDegrees(truth.heading, 360)) <= HEADING_TOLERANCE_DEG;
		},
	},
	{
		id: 'descend-1500',
		title: 'Descend to 1500 ft AGL',
		instruction: 'Reduce power and descend to 1500 ft AGL (+/- 100 ft). Hold for 5 seconds.',
		holdSeconds: 5,
		check: (truth) => {
			if (truth.onGround) return false;
			const agl = aglFeet(truth);
			return Math.abs(agl - DESCENT_TARGET_AGL_FT) <= CRUISE_TOLERANCE_FT;
		},
	},
	{
		id: 'return-2000',
		title: 'Climb back to 2000 ft AGL',
		instruction: 'Add power, pitch up, return to 2000 ft AGL (+/- 100 ft). Hold for 5 seconds.',
		holdSeconds: 5,
		check: (truth) => {
			if (truth.onGround) return false;
			const agl = aglFeet(truth);
			return Math.abs(agl - CRUISE_TARGET_AGL_FT) <= CRUISE_TOLERANCE_FT;
		},
	},
];

export const FIRST_FLIGHT_SCENARIO: ScenarioDefinition = {
	id: SIM_SCENARIO_IDS.FIRST_FLIGHT,
	title: 'First Flight',
	tagline: 'Takeoff, climb, cruise, turn, descend. Every control, in order.',
	objective: 'Complete each step to graduate: brake, throttle, rotate, climb, level, turn, descend, return.',
	briefing:
		'Runway 09, light direct headwind. Auto-coordinate is on so banking turns the airplane without rudder work. The panel on the right tracks progress step by step. Follow along; reach the final step to graduate.',
	recommendedOrder: 2,
	recommendationLabel: 'After Playground',
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
		directionDegrees: 90,
		speedKnots: 5,
	},
	criteria: {
		failureSustainedStallSeconds: 1.0,
		failureMinimumAltitudeAglMeters: -1, // ground-floor failure not wanted for tutorial
		timeoutSeconds: 1200,
	},
	steps: FIRST_FLIGHT_STEPS,
};
