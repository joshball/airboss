/**
 * Grading-evaluator tests. Builds synthetic tapes that exercise each
 * GradingComponentKind and asserts the score lands where the scoring
 * rules say it should.
 */

import {
	SIM_FAULT_KINDS,
	SIM_FAULT_TRIGGER_KINDS,
	SIM_FLAP_NOTCHES,
	SIM_GRADING,
	SIM_SCENARIO_IDS,
	SIM_SCENARIO_OUTCOMES,
} from '@ab/constants';
import { describe, expect, it } from 'vitest';
import type { FaultActivation } from '../faults/types';
import type { ReplayFrame, ReplayTape } from '../replay/types';
import type { FdmInputs, FdmTruthState, GradingDefinition, IdealPathDefinition } from '../types';
import { evaluateGrading } from './grading';

function makeTruth(overrides: Partial<FdmTruthState> = {}): FdmTruthState {
	return {
		t: 0,
		x: 0,
		altitude: 305,
		groundElevation: 305,
		u: 0,
		w: 0,
		pitch: 0,
		pitchRate: 0,
		roll: 0,
		rollRate: 0,
		yawRate: 0,
		heading: 0,
		alpha: 0,
		trueAirspeed: 0,
		indicatedAirspeed: 0,
		groundSpeed: 0,
		verticalSpeed: 0,
		liftCoefficient: 0,
		dragCoefficient: 0,
		loadFactor: 1,
		slipBall: 0,
		onGround: false,
		brakeOn: false,
		stallWarning: false,
		stalled: false,
		flapsDegrees: SIM_FLAP_NOTCHES[0],
		elevatorEffective: 0,
		engineRpm: 2300,
		oilPressurePsi: 50,
		oilTempCelsius: 90,
		fuelLeftGallons: 26,
		fuelRightGallons: 26,
		ammeterAmps: 3,
		vacuumInHg: 5,
		...overrides,
	};
}

function makeInputs(overrides: Partial<FdmInputs> = {}): FdmInputs {
	return {
		throttle: 0.7,
		elevator: 0,
		trim: 0,
		aileron: 0,
		rudder: 0,
		brake: false,
		autoCoordinate: true,
		flaps: SIM_FLAP_NOTCHES[0],
		...overrides,
	};
}

function makeFrame(
	t: number,
	truthOverrides: Partial<FdmTruthState> = {},
	inputOverrides: Partial<FdmInputs> = {},
	activations: readonly FaultActivation[] = [],
): ReplayFrame {
	const truth = makeTruth({ t, ...truthOverrides });
	return {
		t,
		truth,
		display: {
			indicatedAirspeed: truth.indicatedAirspeed,
			altitudeMsl: truth.altitude,
			verticalSpeed: truth.verticalSpeed,
			pitchIndicated: truth.pitch,
			rollIndicated: truth.roll,
			headingIndicated: truth.heading,
			yawRateIndicated: truth.yawRate,
			slipBall: truth.slipBall,
			alpha: truth.alpha,
			stallWarning: truth.stallWarning,
			stalled: truth.stalled,
			engineRpm: truth.engineRpm,
			flapsDegrees: truth.flapsDegrees,
			electricBusVolts: 28,
			onGround: truth.onGround,
			t: truth.t,
			oilPressurePsi: truth.oilPressurePsi,
			oilTempCelsius: truth.oilTempCelsius,
			fuelLeftGallons: truth.fuelLeftGallons,
			fuelRightGallons: truth.fuelRightGallons,
			ammeterAmps: truth.ammeterAmps,
			vacuumInHg: truth.vacuumInHg,
		},
		inputs: makeInputs(inputOverrides),
		activations,
		firedThisTick: [],
	};
}

function makeTape(frames: readonly ReplayFrame[]): ReplayTape {
	return {
		scenarioId: SIM_SCENARIO_IDS.DEPARTURE_STALL,
		scenarioHash: 'test-hash',
		seed: 0,
		initial: {
			altitude: 305,
			groundElevation: 305,
			u: 0,
			w: 0,
			pitch: 0,
			pitchRate: 0,
			roll: 0,
			rollRate: 0,
			yawRate: 0,
			heading: 0,
			throttle: 0,
			elevator: 0,
			trim: 0,
			aileron: 0,
			rudder: 0,
			brake: false,
			autoCoordinate: true,
			flaps: SIM_FLAP_NOTCHES[0],
			onGround: false,
		},
		frames,
		result: {
			scenarioId: SIM_SCENARIO_IDS.DEPARTURE_STALL,
			outcome: SIM_SCENARIO_OUTCOMES.SUCCESS,
			elapsedSeconds: frames[frames.length - 1]?.t ?? 0,
			peakAltitudeAgl: 100,
			maxAlpha: 0.1,
			reason: 'test',
		},
		formatVersion: 1,
	};
}

describe('evaluateGrading -- input validation', () => {
	it('throws on empty components', () => {
		const tape = makeTape([makeFrame(0)]);
		expect(() => evaluateGrading({ components: [] }, tape)).toThrow(/must not be empty/);
	});

	it('throws when weights do not sum to ~1.0', () => {
		const def: GradingDefinition = {
			components: [{ kind: 'altitude_hold', weight: 0.5, params: { target: 305, tolerance: 10 } }],
		};
		const tape = makeTape([makeFrame(0)]);
		expect(() => evaluateGrading(def, tape)).toThrow(/Grading weights must sum/);
	});

	it('accepts weights summing within epsilon', () => {
		const def: GradingDefinition = {
			components: [
				{ kind: 'altitude_hold', weight: 0.5, params: { target: 305, tolerance: 10 } },
				{ kind: 'heading_hold', weight: 0.5, params: { target: 0, tolerance: 0.1 } },
			],
		};
		const tape = makeTape([makeFrame(0)]);
		const r = evaluateGrading(def, tape);
		expect(r.components).toHaveLength(2);
	});

	it('throws on empty frames', () => {
		const def: GradingDefinition = {
			components: [{ kind: 'altitude_hold', weight: 1, params: { target: 305, tolerance: 10 } }],
		};
		const tape = makeTape([]);
		expect(() => evaluateGrading(def, tape)).toThrow(/empty tape/);
	});
});

describe('evaluateGrading -- altitude_hold', () => {
	it('scores 1.0 when altitude stays inside tolerance', () => {
		const frames = Array.from({ length: 10 }, (_, i) => makeFrame(i, { altitude: 305 + i }));
		const def: GradingDefinition = {
			components: [{ kind: 'altitude_hold', weight: 1, params: { target: 305, tolerance: 20 } }],
		};
		const r = evaluateGrading(def, makeTape(frames));
		expect(r.components[0].score).toBeCloseTo(1, 5);
		expect(r.total).toBeCloseTo(1, 5);
	});

	it('scores 0 when altitude is past hardFail every frame', () => {
		const frames = Array.from({ length: 5 }, (_, i) => makeFrame(i, { altitude: 305 + 200 }));
		const def: GradingDefinition = {
			components: [{ kind: 'altitude_hold', weight: 1, params: { target: 305, tolerance: 10, hardFail: 50 } }],
		};
		const r = evaluateGrading(def, makeTape(frames));
		expect(r.components[0].score).toBe(0);
	});

	it('scores in the linear band when deviation is between tolerance and hardFail', () => {
		// Halfway between tolerance(10) and hardFail(50): deviation 30 -> score 0.5.
		const frames = Array.from({ length: 5 }, (_, i) => makeFrame(i, { altitude: 305 + 30 }));
		const def: GradingDefinition = {
			components: [{ kind: 'altitude_hold', weight: 1, params: { target: 305, tolerance: 10, hardFail: 50 } }],
		};
		const r = evaluateGrading(def, makeTape(frames));
		expect(r.components[0].score).toBeCloseTo(0.5, 5);
	});

	it('scores 0 when target/tolerance are missing', () => {
		const frames = [makeFrame(0)];
		const def: GradingDefinition = {
			components: [{ kind: 'altitude_hold', weight: 1 }],
		};
		const r = evaluateGrading(def, makeTape(frames));
		expect(r.components[0].score).toBe(0);
	});
});

describe('evaluateGrading -- heading_hold', () => {
	it('handles wrap-around heading deltas', () => {
		// Target = 0 (north). All frames at 359 deg = -1 deg deviation, NOT 359 deg.
		const frames = Array.from({ length: 5 }, (_, i) => makeFrame(i, { heading: 359 * (Math.PI / 180) }));
		const def: GradingDefinition = {
			components: [{ kind: 'heading_hold', weight: 1, params: { target: 0, tolerance: 5 * (Math.PI / 180) } }],
		};
		const r = evaluateGrading(def, makeTape(frames));
		expect(r.components[0].score).toBeCloseTo(1, 5);
	});

	it('penalises heading deviation past hardFail', () => {
		const frames = Array.from({ length: 5 }, (_, i) => makeFrame(i, { heading: 90 * (Math.PI / 180) }));
		const def: GradingDefinition = {
			components: [
				{
					kind: 'heading_hold',
					weight: 1,
					params: { target: 0, tolerance: 5 * (Math.PI / 180), hardFail: 30 * (Math.PI / 180) },
				},
			],
		};
		const r = evaluateGrading(def, makeTape(frames));
		expect(r.components[0].score).toBe(0);
	});
});

describe('evaluateGrading -- airspeed_hold', () => {
	it('scores 1.0 inside tolerance band', () => {
		const target = 40; // 40 m/s ~ 78 KIAS
		const frames = Array.from({ length: 6 }, (_, i) => makeFrame(i, { indicatedAirspeed: target + 1 }));
		const def: GradingDefinition = {
			components: [{ kind: 'airspeed_hold', weight: 1, params: { target, tolerance: 3 } }],
		};
		const r = evaluateGrading(def, makeTape(frames));
		expect(r.components[0].score).toBeCloseTo(1, 5);
	});
});

describe('evaluateGrading -- stall_margin', () => {
	it('scores 1.0 when never stalled or warned', () => {
		const frames = Array.from({ length: 10 }, (_, i) => makeFrame(i));
		const def: GradingDefinition = { components: [{ kind: 'stall_margin', weight: 1 }] };
		const r = evaluateGrading(def, makeTape(frames));
		expect(r.components[0].score).toBeCloseTo(1, 5);
	});

	it('scores 0.5 when single-frame tape shows stall warning', () => {
		const frames = [makeFrame(0, { stallWarning: true })];
		const def: GradingDefinition = { components: [{ kind: 'stall_margin', weight: 1 }] };
		const r = evaluateGrading(def, makeTape(frames));
		expect(r.components[0].score).toBe(0.5);
	});

	it('penalises stalled time at 2x rate vs warning time', () => {
		// 10 second tape: 5s warning, 0s stalled -> score = 1 - 5/10 = 0.5
		const frames = Array.from({ length: 11 }, (_, i) => makeFrame(i, { stallWarning: i < 5 }));
		const def: GradingDefinition = { components: [{ kind: 'stall_margin', weight: 1 }] };
		const r = evaluateGrading(def, makeTape(frames));
		expect(r.components[0].score).toBeCloseTo(0.5, 1);
	});

	it('counts stalled seconds at the configured multiplier', () => {
		// 10s tape, frames 0..2 stalled (3s of stall when accumulating dt across
		// transitions). penalty = 3 * MULTIPLIER, score = 1 - penalty/10.
		const stalledSeconds = 3;
		const frames = Array.from({ length: 11 }, (_, i) => makeFrame(i, { stalled: i < stalledSeconds }));
		const def: GradingDefinition = { components: [{ kind: 'stall_margin', weight: 1 }] };
		const r = evaluateGrading(def, makeTape(frames));
		const expected = Math.max(0, 1 - (SIM_GRADING.STALL_PENALTY_MULTIPLIER * stalledSeconds) / 10);
		expect(r.components[0].score).toBeCloseTo(expected, 1);
	});
});

describe('evaluateGrading -- reaction_time', () => {
	it('scores full credit for prompt stick_forward after engine cut', () => {
		const cutT = 5;
		// Frames 0..4: engine running at 2300 RPM; frame 5+: engine cut to 100 RPM.
		// Pilot pulls stick forward at frame 6 (1s reaction).
		const frames: ReplayFrame[] = [];
		for (let t = 0; t <= 10; t += 1) {
			const isCut = t >= cutT;
			const stickForward = t >= cutT + 1;
			frames.push(makeFrame(t, { engineRpm: isCut ? 100 : 2300 }, { elevator: stickForward ? -0.5 : 0 }));
		}
		const def: GradingDefinition = {
			components: [{ kind: 'reaction_time', weight: 1, params: { reactionPredicate: 'stick_forward' } }],
		};
		const r = evaluateGrading(def, makeTape(frames));
		expect(r.components[0].score).toBeCloseTo(1, 5);
	});

	it('scores zero when reaction never comes', () => {
		const frames: ReplayFrame[] = [];
		for (let t = 0; t <= 12; t += 1) {
			frames.push(makeFrame(t, { engineRpm: t >= 5 ? 100 : 2300 }));
		}
		const def: GradingDefinition = {
			components: [{ kind: 'reaction_time', weight: 1, params: { reactionPredicate: 'stick_forward' } }],
		};
		const r = evaluateGrading(def, makeTape(frames));
		expect(r.components[0].score).toBe(0);
	});

	it('uses fault activation as trigger when triggerFaultKind is set', () => {
		const triggerT = 4;
		const activation: FaultActivation = {
			kind: SIM_FAULT_KINDS.VACUUM_FAILURE,
			firedAtT: triggerT,
			params: {
				triggerKind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS,
				triggerValue: triggerT,
				vacuumDriftDegPerSec: 1,
				alternatorDecaySeconds: 60,
				gyroTumbleContinues: false,
				staticBlockFreezeAltFt: 0,
				pitotBlockFreezeKias: 0,
			},
		};
		// Pilot moves controls 1.5s after activation; tape carries the activation
		// from t=4 onward.
		const frames: ReplayFrame[] = [];
		for (let t = 0; t <= 8; t += 1) {
			const acts = t >= triggerT ? [activation] : [];
			const aileron = t >= triggerT + 1.5 ? 0.5 : 0;
			frames.push(makeFrame(t, {}, { aileron }, acts));
		}
		const def: GradingDefinition = {
			components: [
				{
					kind: 'reaction_time',
					weight: 1,
					params: { triggerFaultKind: SIM_FAULT_KINDS.VACUUM_FAILURE },
				},
			],
		};
		const r = evaluateGrading(def, makeTape(frames));
		// 1.5s latency is well inside excellent window (2s) -> score 1.
		expect(r.components[0].score).toBeCloseTo(1, 5);
	});

	it('scores in the linear band for slow reaction', () => {
		// Engine cuts at t=5, pilot reacts at t=10 -> 5s latency.
		// Linear band: 2s = 1.0, 8s = 0.0; 5s is at fraction (5-2)/(8-2) = 0.5 -> score 0.5.
		const frames: ReplayFrame[] = [];
		for (let t = 0; t <= 12; t += 1) {
			const isCut = t >= 5;
			const stickForward = t >= 10;
			frames.push(makeFrame(t, { engineRpm: isCut ? 100 : 2300 }, { elevator: stickForward ? -0.5 : 0 }));
		}
		const def: GradingDefinition = {
			components: [{ kind: 'reaction_time', weight: 1, params: { reactionPredicate: 'stick_forward' } }],
		};
		const r = evaluateGrading(def, makeTape(frames));
		expect(r.components[0].score).toBeCloseTo(0.5, 1);
	});

	it('honors throttle_idle predicate', () => {
		const frames: ReplayFrame[] = [];
		for (let t = 0; t <= 8; t += 1) {
			const isCut = t >= 3;
			const idle = t >= 4 ? 0.05 : 0.7;
			frames.push(makeFrame(t, { engineRpm: isCut ? 100 : 2300 }, { throttle: idle }));
		}
		const def: GradingDefinition = {
			components: [{ kind: 'reaction_time', weight: 1, params: { reactionPredicate: 'throttle_idle' } }],
		};
		const r = evaluateGrading(def, makeTape(frames));
		// Latency 1s < 2s -> full score.
		expect(r.components[0].score).toBeCloseTo(1, 5);
	});
});

describe('evaluateGrading -- ideal_path_match', () => {
	const idealPath: IdealPathDefinition = {
		segments: [
			{ endT: 0, altitudeMsl: 305, indicatedAirspeed: 30, heading: 0, pitch: 0, roll: 0, throttle: 0 },
			{ endT: 10, altitudeMsl: 500, indicatedAirspeed: 40, heading: 0, pitch: 0.1, roll: 0, throttle: 1 },
		],
	};

	it('scores 1.0 when frame matches the linearly-interpolated path', () => {
		// At t=5, interpolated target: alt = 402.5, ias = 35, heading = 0.
		const frames = [makeFrame(5, { altitude: 402.5, indicatedAirspeed: 35, heading: 0 })];
		const def: GradingDefinition = {
			components: [{ kind: 'ideal_path_match', weight: 1, params: { tolerance: 50 } }],
		};
		const r = evaluateGrading(def, makeTape(frames), { idealPath });
		expect(r.components[0].score).toBeCloseTo(1, 5);
	});

	it('scores 0 when no idealPath supplied', () => {
		const frames = [makeFrame(5)];
		const def: GradingDefinition = {
			components: [{ kind: 'ideal_path_match', weight: 1, params: { tolerance: 50 } }],
		};
		const r = evaluateGrading(def, makeTape(frames));
		expect(r.components[0].score).toBe(0);
	});

	it('clamps to first segment when t precedes path start', () => {
		const frames = [makeFrame(-1, { altitude: 305, indicatedAirspeed: 30, heading: 0 })];
		const def: GradingDefinition = {
			components: [{ kind: 'ideal_path_match', weight: 1, params: { tolerance: 50 } }],
		};
		const r = evaluateGrading(def, makeTape(frames), { idealPath });
		expect(r.components[0].score).toBeCloseTo(1, 5);
	});

	it('clamps to last segment when t exceeds path end', () => {
		const frames = [makeFrame(100, { altitude: 500, indicatedAirspeed: 40, heading: 0 })];
		const def: GradingDefinition = {
			components: [{ kind: 'ideal_path_match', weight: 1, params: { tolerance: 50 } }],
		};
		const r = evaluateGrading(def, makeTape(frames), { idealPath });
		expect(r.components[0].score).toBeCloseTo(1, 5);
	});
});

describe('evaluateGrading -- weighted total', () => {
	it('combines components by weight', () => {
		// altitude_hold scores 1, heading_hold scores 0; weights 0.6/0.4 -> total 0.6.
		const frames = [
			makeFrame(0, { altitude: 305, heading: Math.PI / 2 }), // 90 deg off
		];
		const def: GradingDefinition = {
			components: [
				{ kind: 'altitude_hold', weight: 0.6, params: { target: 305, tolerance: 10 } },
				{
					kind: 'heading_hold',
					weight: 0.4,
					params: { target: 0, tolerance: 5 * (Math.PI / 180), hardFail: 30 * (Math.PI / 180) },
				},
			],
		};
		const r = evaluateGrading(def, makeTape(frames));
		expect(r.components[0].score).toBeCloseTo(1, 5);
		expect(r.components[1].score).toBe(0);
		expect(r.total).toBeCloseTo(0.6, 5);
	});
});
