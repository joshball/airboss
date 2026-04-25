/**
 * Tests for the replay-tape pipeline: ring buffer (push, drain, wrap),
 * scenario hash (stability + change detection), tape serialize/parse
 * round-trip, hash validation against changing definitions.
 */

import { SIM_FAULT_KINDS, SIM_FAULT_TRIGGER_KINDS, SIM_FLAP_NOTCHES, SIM_SCENARIO_OUTCOMES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { activateFault } from '../faults/transform';
import type { FaultActivation } from '../faults/types';
import { getScenario } from '../scenarios/registry';
import type { FdmInputs, FdmTruthState, ScenarioDefinition } from '../types';
import { hashScenarioDefinition } from './hash';
import { createFrameRing, drainFrames, pushFrame, ringFramesDropped, ringHasWrapped } from './ring-buffer';
import { buildTape, parseTape, REPLAY_TAPE_FORMAT_VERSION, serializeTape, validateTapeHash } from './tape';
import type { ReplayFrame } from './types';

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
		onGround: true,
		brakeOn: false,
		stallWarning: false,
		stalled: false,
		flapsDegrees: SIM_FLAP_NOTCHES[0],
		elevatorEffective: 0,
		engineRpm: 800,
		...overrides,
	};
}

function makeInputs(): FdmInputs {
	return {
		throttle: 0,
		elevator: 0,
		trim: 0,
		aileron: 0,
		rudder: 0,
		brake: false,
		autoCoordinate: true,
		flaps: SIM_FLAP_NOTCHES[0],
	};
}

function makeFrame(t: number): ReplayFrame {
	const truth = makeTruth({ t });
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
		},
		inputs: makeInputs(),
		activations: [],
		firedThisTick: [],
	};
}

describe('FrameRing -- push, drain, wrap', () => {
	it('drains pushed frames in insertion order when below capacity', () => {
		const ring = createFrameRing(10);
		for (let i = 0; i < 5; i += 1) pushFrame(ring, makeFrame(i));
		const frames = drainFrames(ring);
		expect(frames.map((f) => f.t)).toEqual([0, 1, 2, 3, 4]);
		expect(ringHasWrapped(ring)).toBe(false);
		expect(ringFramesDropped(ring)).toBe(0);
	});

	it('overwrites oldest frames when wrapped, drains the most-recent window', () => {
		const ring = createFrameRing(3);
		for (let i = 0; i < 7; i += 1) pushFrame(ring, makeFrame(i));
		// Drop check has to happen before drain -- drain resets totalWrites.
		expect(ringHasWrapped(ring)).toBe(true);
		expect(ringFramesDropped(ring)).toBe(4); // 7 written, 3 capacity
		const frames = drainFrames(ring);
		expect(frames.map((f) => f.t)).toEqual([4, 5, 6]);
	});

	it('returns an empty array when never written to', () => {
		const ring = createFrameRing(10);
		expect(drainFrames(ring)).toEqual([]);
	});

	it('resets after drain so the same ring can be reused for a fresh run', () => {
		const ring = createFrameRing(5);
		pushFrame(ring, makeFrame(1));
		drainFrames(ring);
		pushFrame(ring, makeFrame(99));
		const frames = drainFrames(ring);
		expect(frames.map((f) => f.t)).toEqual([99]);
	});

	it('rejects zero or negative capacity', () => {
		expect(() => createFrameRing(0)).toThrow();
		expect(() => createFrameRing(-1)).toThrow();
	});
});

describe('hashScenarioDefinition -- stability + change detection', () => {
	it('produces the same hash for the same definition twice', () => {
		const def = getScenario('playground' as ScenarioDefinition['id']);
		expect(hashScenarioDefinition(def)).toBe(hashScenarioDefinition(def));
	});

	it('produces different hashes for different scenarios', () => {
		const a = getScenario('playground' as ScenarioDefinition['id']);
		const b = getScenario('first-flight' as ScenarioDefinition['id']);
		expect(hashScenarioDefinition(a)).not.toBe(hashScenarioDefinition(b));
	});

	it('changes when a fault is added to the definition', () => {
		const base = getScenario('playground' as ScenarioDefinition['id']);
		const baseHash = hashScenarioDefinition(base);
		const withFault: ScenarioDefinition = {
			...base,
			faults: [
				{
					kind: SIM_FAULT_KINDS.VACUUM_FAILURE,
					trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 60 },
				},
			],
		};
		expect(hashScenarioDefinition(withFault)).not.toBe(baseHash);
	});

	it('returns hex of fixed length 8', () => {
		const def = getScenario('playground' as ScenarioDefinition['id']);
		expect(hashScenarioDefinition(def)).toMatch(/^[0-9a-f]{8}$/);
	});
});

describe('buildTape + serializeTape + parseTape -- round trip', () => {
	const def = getScenario('playground' as ScenarioDefinition['id']);

	it('round-trips an empty (no-frames) tape', () => {
		const ring = createFrameRing(10);
		const tape = buildTape({
			def,
			initial: def.initial,
			seed: 0,
			frames: ring,
			result: {
				scenarioId: def.id,
				outcome: SIM_SCENARIO_OUTCOMES.ABORTED,
				elapsedSeconds: 0,
				peakAltitudeAgl: 0,
				maxAlpha: 0,
				reason: 'aborted at start',
			},
		});
		const restored = parseTape(serializeTape(tape));
		expect(restored.scenarioId).toBe(def.id);
		expect(restored.frames.length).toBe(0);
		expect(restored.formatVersion).toBe(REPLAY_TAPE_FORMAT_VERSION);
	});

	it('round-trips a tape with frames + activations', () => {
		const ring = createFrameRing(10);
		const activation: FaultActivation = activateFault(
			{
				kind: SIM_FAULT_KINDS.VACUUM_FAILURE,
				trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 60 },
			},
			60,
		);
		for (let i = 0; i < 4; i += 1) {
			const f = makeFrame(i);
			const withActivation: ReplayFrame = i >= 2 ? { ...f, activations: [activation] } : f;
			pushFrame(ring, withActivation);
		}
		const tape = buildTape({
			def,
			initial: def.initial,
			seed: 0,
			frames: ring,
			result: {
				scenarioId: def.id,
				outcome: SIM_SCENARIO_OUTCOMES.SUCCESS,
				elapsedSeconds: 4,
				peakAltitudeAgl: 0,
				maxAlpha: 0,
				reason: 'all steps complete',
			},
		});
		const restored = parseTape(serializeTape(tape));
		expect(restored.frames.length).toBe(4);
		expect(restored.frames[2].activations[0].kind).toBe(SIM_FAULT_KINDS.VACUUM_FAILURE);
		expect(restored.frames[0].activations.length).toBe(0);
	});

	it('rejects malformed JSON', () => {
		expect(() => parseTape('not json')).toThrow();
	});

	it('rejects a payload with the wrong shape', () => {
		expect(() => parseTape(JSON.stringify({ scenarioId: 'foo' }))).toThrow();
	});

	it('rejects a payload from a future format version', () => {
		const def2 = getScenario('playground' as ScenarioDefinition['id']);
		const ring = createFrameRing(5);
		const tape = buildTape({
			def: def2,
			initial: def2.initial,
			seed: 0,
			frames: ring,
			result: {
				scenarioId: def2.id,
				outcome: SIM_SCENARIO_OUTCOMES.ABORTED,
				elapsedSeconds: 0,
				peakAltitudeAgl: 0,
				maxAlpha: 0,
				reason: 'x',
			},
		});
		const futureTape = JSON.stringify({ ...tape, formatVersion: 999 });
		expect(() => parseTape(futureTape)).toThrow(/format version/);
	});
});

describe('validateTapeHash -- change detection', () => {
	const def = getScenario('playground' as ScenarioDefinition['id']);

	it('matches when the definition is unchanged', () => {
		const ring = createFrameRing(5);
		const tape = buildTape({
			def,
			initial: def.initial,
			seed: 0,
			frames: ring,
			result: {
				scenarioId: def.id,
				outcome: SIM_SCENARIO_OUTCOMES.ABORTED,
				elapsedSeconds: 0,
				peakAltitudeAgl: 0,
				maxAlpha: 0,
				reason: 'x',
			},
		});
		const validation = validateTapeHash(tape, def);
		expect(validation.matches).toBe(true);
	});

	it('rejects when the definition has changed since the tape was recorded', () => {
		const ring = createFrameRing(5);
		const original = buildTape({
			def,
			initial: def.initial,
			seed: 0,
			frames: ring,
			result: {
				scenarioId: def.id,
				outcome: SIM_SCENARIO_OUTCOMES.ABORTED,
				elapsedSeconds: 0,
				peakAltitudeAgl: 0,
				maxAlpha: 0,
				reason: 'x',
			},
		});
		const newer: ScenarioDefinition = {
			...def,
			faults: [
				{
					kind: SIM_FAULT_KINDS.PITOT_BLOCK,
					trigger: { kind: SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS, at: 30 },
				},
			],
		};
		const validation = validateTapeHash(original, newer);
		expect(validation.matches).toBe(false);
		expect(validation.tapeHash).not.toBe(validation.currentHash);
	});
});
