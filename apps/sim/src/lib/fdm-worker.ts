/**
 * FDM Web Worker. Runs the hand-rolled C172 physics at 120 Hz, evaluates
 * scenario criteria per tick, and posts snapshot messages at 60 Hz for the
 * cockpit UI.
 *
 * Worker lifecycle: receive INIT with a scenario id -> load scenario ->
 * reply READY. The main thread then sends START, which begins the physics
 * loop. PAUSE/RESUME gate the loop without discarding state. RESET
 * rebuilds the engine from the scenario's initial state. INPUT updates
 * the latched throttle / elevator.
 */

/// <reference lib="webworker" />

import type { FrameRing, GradeReport, ReplayFrame, ScenarioStepState } from '@ab/bc-sim';
import {
	applyFaults,
	buildTape,
	createFrameRing,
	evaluateGrading,
	FdmEngine,
	getAircraftConfig,
	getScenario,
	pushFrame,
	ScenarioRunner,
} from '@ab/bc-sim';
import {
	SIM_ELECTRIC_BUS_NOMINAL_VOLTS,
	SIM_FDM_DT_SECONDS,
	SIM_SCENARIO_OUTCOMES,
	SIM_SNAPSHOT_INTERVAL_SECONDS,
	SIM_TIMING,
	SIM_WORKER_MESSAGES,
	type SimScenarioId,
} from '@ab/constants';
import type { MainToWorker, WorkerToMain } from './worker-protocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

interface WorkerState {
	scenarioId: SimScenarioId;
	engine: FdmEngine;
	runner: ScenarioRunner;
	running: boolean;
	terminated: boolean;
	accumulator: number;
	snapshotClock: number;
	tickHandle: number | null;
	lastTickMs: number;
	lastStepState?: ScenarioStepState;
	/** Frame ring the worker writes into at snapshot cadence. Drained
	 *  into a ReplayTape once per run on outcome (or on RESET if a tape
	 *  was in progress). */
	frameRing: FrameRing;
	/** Latched at INIT so the tape carries the same state the run started
	 *  from, regardless of any later state-mutation paths. */
	initialState: ReturnType<typeof getScenario>['initial'];
	/** Most recent frame data captured at snapshot cadence. Also used to
	 *  populate the OUTCOME/TAPE messages so the tape's last frame matches
	 *  the user's last visible cockpit state. */
	lastFrame: ReplayFrame | null;
	/** True once a TAPE message has been posted -- guards against double-
	 *  posting on a pause-then-outcome race. */
	tapePosted: boolean;
}

let state: WorkerState | null = null;

function post(msg: WorkerToMain): void {
	ctx.postMessage(msg);
}

function buildState(scenarioId: SimScenarioId): WorkerState {
	const def = getScenario(scenarioId);
	// Resolve the scenario's pinned aircraft via the registry. C172 today,
	// PA28 lit up in #172, future airframes added by registering a new
	// AircraftConfig in libs/bc/sim/src/fdm/aircraft-registry.ts.
	const cfg = getAircraftConfig(def.aircraft);
	const engine = new FdmEngine(cfg, def.initial, def.wind, def.scriptedInput);
	const runner = new ScenarioRunner(def);
	return {
		scenarioId,
		engine,
		runner,
		running: false,
		terminated: false,
		accumulator: 0,
		snapshotClock: 0,
		tickHandle: null,
		lastTickMs: 0,
		frameRing: createFrameRing(),
		initialState: def.initial,
		lastFrame: null,
		tapePosted: false,
	};
}

/**
 * Build a ReplayFrame from the current engine + runner state. Pure
 * construction -- no message posting and no ring writes. Used by both
 * the snapshot path (which just needs the data to post to the UI) and
 * the in-loop ring writer (which records the same frame for replay).
 */
function captureFrame(s: WorkerState, firedThisTick: readonly ReplayFrame['firedThisTick'][number][]): ReplayFrame {
	const truth = s.engine.snapshot();
	const inputs = s.engine.getInputs();
	const activations = s.runner.getActivations();
	const display = applyFaults({
		truth,
		activations,
		nominalBusVolts: SIM_ELECTRIC_BUS_NOMINAL_VOLTS,
	});
	return {
		t: truth.t,
		truth,
		display,
		inputs,
		activations: activations.slice(),
		firedThisTick,
	};
}

function postSnapshot(s: WorkerState): void {
	const frame = captureFrame(s, []);
	s.lastFrame = frame;
	post({
		type: SIM_WORKER_MESSAGES.SNAPSHOT,
		truth: frame.truth,
		display: frame.display,
		inputs: frame.inputs,
		running: s.running,
		stepState: s.lastStepState,
		activations: frame.activations,
	});
}

/**
 * Build the run's tape and post it to the main thread. Idempotent --
 * once posted, the `tapePosted` latch prevents a second post (e.g. a
 * RESET racing with an OUTCOME). Called on outcome and on user-driven
 * RESET when a run was in progress.
 */
function emitTape(s: WorkerState, result: Parameters<typeof buildTape>[0]['result']): void {
	if (s.tapePosted) return;
	const def = getScenario(s.scenarioId);
	const tape = buildTape({
		def,
		initial: s.initialState,
		seed: 0,
		frames: s.frameRing,
		result,
	});
	// Grade is best-effort: if the scenario declared a `grading` block and
	// the tape has frames, compute it. evaluateGrading throws on malformed
	// definitions or empty tapes; we swallow that here so a grading bug
	// can't suppress the tape itself (debrief still needs the tape for
	// scrubber + ideal-path overlay).
	// Grade is best-effort. evaluateGrading throws on malformed grading
	// definitions (weights not summing to 1.0, empty components, empty
	// frames) -- those are authoring bugs that should surface in BC unit
	// tests, not crash the worker mid-tape-emit. Swallowing here keeps
	// the tape postable so the debrief still has scrubber + traces; the
	// missing grade section is itself the visible signal.
	let grade: GradeReport | undefined;
	if (def.grading !== undefined && tape.frames.length > 0) {
		try {
			grade = evaluateGrading(def.grading, tape, { idealPath: def.idealPath });
		} catch {
			grade = undefined;
		}
	}
	post({ type: SIM_WORKER_MESSAGES.TAPE, tape, grade });
	s.tapePosted = true;
}

function loop(): void {
	if (!state?.running || state.terminated) return;

	const now = performance.now();
	let elapsed = (now - state.lastTickMs) / 1000;
	state.lastTickMs = now;

	// Guard against tab-background jumps: cap catch-up at 0.5 s of sim time.
	if (elapsed > 0.5) elapsed = 0.5;

	state.accumulator += elapsed;

	while (state.accumulator >= SIM_FDM_DT_SECONDS && !state.terminated) {
		state.engine.step(SIM_FDM_DT_SECONDS);
		const truth = state.engine.snapshot();
		const inputs = state.engine.getInputs();
		const evalResult = state.runner.evaluate(truth, inputs);
		state.lastStepState = evalResult.stepState;
		state.accumulator -= SIM_FDM_DT_SECONDS;
		state.snapshotClock += SIM_FDM_DT_SECONDS;

		// Capture a tape frame on the same cadence as snapshot posting.
		// firedThisTick is captured per-FDM-step (not per-snapshot) so the
		// debrief can mark the exact tick a fault triggered.
		if (evalResult.firedThisTick.length > 0 && state.lastFrame !== null) {
			// Carry the edge into the next ring frame so the tape's
			// "fault fired here" mark sits at the right t.
			state.lastFrame = { ...state.lastFrame, firedThisTick: evalResult.firedThisTick };
		}

		if (evalResult.outcome !== SIM_SCENARIO_OUTCOMES.RUNNING) {
			state.terminated = true;
			state.running = false;
			// Final frame (the one that locked the outcome) lands in the ring
			// alongside the snapshot post.
			const finalFrame = captureFrame(state, evalResult.firedThisTick);
			state.lastFrame = finalFrame;
			pushFrame(state.frameRing, finalFrame);
			postSnapshot(state);
			const result = state.runner.finalResult();
			post({ type: SIM_WORKER_MESSAGES.OUTCOME, result });
			emitTape(state, result);
			return;
		}
	}

	if (state.snapshotClock >= SIM_SNAPSHOT_INTERVAL_SECONDS) {
		state.snapshotClock = 0;
		const frame = captureFrame(state, []);
		state.lastFrame = frame;
		pushFrame(state.frameRing, frame);
		post({
			type: SIM_WORKER_MESSAGES.SNAPSHOT,
			truth: frame.truth,
			display: frame.display,
			inputs: frame.inputs,
			running: state.running,
			stepState: state.lastStepState,
			activations: frame.activations,
		});
	}

	state.tickHandle = ctx.setTimeout(loop, 1000 / SIM_TIMING.FDM_HZ) as unknown as number;
}

function start(): void {
	if (!state || state.running || state.terminated) return;
	state.running = true;
	state.lastTickMs = performance.now();
	state.accumulator = 0;
	state.snapshotClock = 0;
	loop();
}

function stop(): void {
	if (!state) return;
	state.running = false;
	if (state.tickHandle !== null) {
		ctx.clearTimeout(state.tickHandle);
		state.tickHandle = null;
	}
}

function reset(): void {
	if (!state) return;
	// If we were mid-run (frames written + no outcome yet), emit an ABORTED
	// tape so the debrief can still inspect what happened up to the reset.
	const wasMidRun = !state.tapePosted && state.frameRing.totalWrites > 0 && !state.terminated;
	if (wasMidRun) {
		state.runner.abort('User reset before scenario terminated.');
		emitTape(state, state.runner.finalResult());
	}
	stop();
	state = buildState(state.scenarioId);
	postSnapshot(state);
}

ctx.addEventListener('message', (event: MessageEvent<MainToWorker>) => {
	const msg = event.data;
	switch (msg.type) {
		case SIM_WORKER_MESSAGES.INIT: {
			stop();
			state = buildState(msg.scenarioId);
			post({ type: SIM_WORKER_MESSAGES.READY, scenarioId: msg.scenarioId });
			postSnapshot(state);
			break;
		}
		case SIM_WORKER_MESSAGES.START: {
			start();
			break;
		}
		case SIM_WORKER_MESSAGES.PAUSE: {
			stop();
			if (state) postSnapshot(state);
			break;
		}
		case SIM_WORKER_MESSAGES.RESUME: {
			start();
			break;
		}
		case SIM_WORKER_MESSAGES.RESET: {
			reset();
			break;
		}
		case SIM_WORKER_MESSAGES.INPUT: {
			if (state) state.engine.setInputs(msg.inputs);
			break;
		}
		case SIM_WORKER_MESSAGES.TOGGLE_BRAKE: {
			if (state) {
				state.engine.toggleBrake();
				postSnapshot(state);
			}
			break;
		}
		case SIM_WORKER_MESSAGES.TOGGLE_AUTO_COORDINATE: {
			if (state) {
				state.engine.toggleAutoCoordinate();
				postSnapshot(state);
			}
			break;
		}
		default: {
			// Exhaustive: compile-time guarantee we handle every message kind.
			const _never: never = msg;
			void _never;
		}
	}
});
