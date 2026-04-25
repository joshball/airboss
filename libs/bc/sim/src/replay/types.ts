/**
 * Replay tape -- the system's memory of a scenario run.
 *
 * Every scenario attempt produces one tape. The worker writes 30 Hz
 * frames into a ring buffer while the scenario runs; on outcome, the
 * worker drains the ring and the main thread persists the tape. The
 * Phase 4 debrief renders the tape as a scrubbable timeline.
 *
 * Determinism is the load-bearing invariant. Given the same
 * `(scenarioHash, seed, initial, inputs)` tuple, replaying the tape
 * MUST produce a byte-identical sequence of truth states. If
 * determinism breaks, the debrief lies, and the spec calls for that to
 * be a P0 regression.
 *
 * The tape is structured-clone-safe so the worker can postMessage it
 * without serialization loss, and it serializes to JSON for storage.
 */

import type { SimFaultKind, SimScenarioId, SimScenarioOutcome } from '@ab/constants';
import type { DisplayState, FaultActivation } from '../faults/types';
import type { FdmInputs, FdmTruthState, ScenarioInitialState, ScenarioRunResult } from '../types';

/**
 * One snapshot in the tape -- the full state of the simulation at a
 * given tick boundary. Truth + display + inputs + fault activations.
 */
export interface ReplayFrame {
	/** Sim time at this frame (seconds). */
	t: number;
	/** What the airplane was actually doing. */
	truth: FdmTruthState;
	/** What the cockpit gauges showed. Derived from truth via the fault model. */
	display: DisplayState;
	/** Pilot + scripted inputs as of this frame. */
	inputs: FdmInputs;
	/** Fault activations live this tick (including ones that fired earlier and stuck). */
	activations: readonly FaultActivation[];
	/** Faults that fired on THIS tick (edge); a subset of activations. */
	firedThisTick: readonly SimFaultKind[];
}

/**
 * The full tape of a scenario run. One per attempt. Persisted to
 * `sim.scenario_attempt.replay_tape` in the database.
 */
export interface ReplayTape {
	scenarioId: SimScenarioId;
	/**
	 * Hash of the scenario definition used for this run. The replay
	 * loader rejects tapes whose hash no longer matches the current
	 * definition (the user gets "scenario has changed since you flew it").
	 */
	scenarioHash: string;
	/** RNG seed used for the run. 0 today; reserved for future stochastic faults. */
	seed: number;
	/** Initial state the run started from. */
	initial: ScenarioInitialState;
	/** Frames written at snapshot cadence (~30 Hz). Monotonically increasing t. */
	frames: readonly ReplayFrame[];
	/** Final outcome (success / failure / timeout / aborted). */
	result: ScenarioRunResult;
	/** Schema version of the tape format. Bumped when fields change shape. */
	formatVersion: number;
}

/**
 * Outcome categories that carry a useful tape. ABORTED tapes are kept
 * but not credited as rep attempts; RUNNING never appears (tapes are
 * only emitted at scenario end).
 */
export type TapeOutcome = Exclude<SimScenarioOutcome, 'running'>;
