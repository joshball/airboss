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

import type { ScenarioStepState } from '@ab/bc-sim';
import { applyFaults, C172_CONFIG, FdmEngine, getScenario, ScenarioRunner } from '@ab/bc-sim';
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
}

let state: WorkerState | null = null;

function post(msg: WorkerToMain): void {
	ctx.postMessage(msg);
}

function buildState(scenarioId: SimScenarioId): WorkerState {
	const def = getScenario(scenarioId);
	// Phase 0.5 only ships the C172. If future scenarios pin a different
	// aircraft, resolve it here. Using the id keyed lookup keeps the switch
	// explicit rather than implicit string matching.
	const cfg = C172_CONFIG;
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
	};
}

function postSnapshot(s: WorkerState): void {
	const truth = s.engine.snapshot();
	const activations = s.runner.getActivations();
	const display = applyFaults({
		truth,
		activations,
		nominalBusVolts: SIM_ELECTRIC_BUS_NOMINAL_VOLTS,
	});
	post({
		type: SIM_WORKER_MESSAGES.SNAPSHOT,
		truth,
		display,
		inputs: s.engine.getInputs(),
		running: s.running,
		stepState: s.lastStepState,
		activations,
	});
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

		if (evalResult.outcome !== SIM_SCENARIO_OUTCOMES.RUNNING) {
			state.terminated = true;
			state.running = false;
			postSnapshot(state);
			post({ type: SIM_WORKER_MESSAGES.OUTCOME, result: state.runner.finalResult() });
			return;
		}
	}

	if (state.snapshotClock >= SIM_SNAPSHOT_INTERVAL_SECONDS) {
		state.snapshotClock = 0;
		postSnapshot(state);
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
