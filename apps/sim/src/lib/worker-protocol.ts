/**
 * Typed message protocol between the cockpit UI (main thread) and the FDM
 * worker. All messages are structured-clone-safe; values are primitives or
 * plain objects.
 *
 * The worker runs the FDM at SIM_TIMING.FDM_HZ and posts snapshot messages
 * at SIM_TIMING.SNAPSHOT_HZ. The outcome message is posted once when the
 * scenario reaches a terminal state.
 */

import type {
	DisplayState,
	FaultActivation,
	FdmInputs,
	FdmTruthState,
	GradeReport,
	ReplayTape,
	ScenarioRunResult,
	ScenarioStepState,
} from '@ab/bc-sim';
import type { SIM_WORKER_MESSAGES, SimScenarioId } from '@ab/constants';

export type MainToWorker =
	| { type: typeof SIM_WORKER_MESSAGES.INIT; scenarioId: SimScenarioId }
	| { type: typeof SIM_WORKER_MESSAGES.START }
	| { type: typeof SIM_WORKER_MESSAGES.PAUSE }
	| { type: typeof SIM_WORKER_MESSAGES.RESUME }
	| { type: typeof SIM_WORKER_MESSAGES.RESET }
	| { type: typeof SIM_WORKER_MESSAGES.INPUT; inputs: Partial<FdmInputs> }
	| { type: typeof SIM_WORKER_MESSAGES.TOGGLE_BRAKE }
	| { type: typeof SIM_WORKER_MESSAGES.TOGGLE_AUTO_COORDINATE };

export type WorkerToMain =
	| { type: typeof SIM_WORKER_MESSAGES.READY; scenarioId: SimScenarioId }
	| {
			type: typeof SIM_WORKER_MESSAGES.SNAPSHOT;
			truth: FdmTruthState;
			/**
			 * What the cockpit gauges show. Equals truth when no faults are
			 * active; lies in fault-specific ways when activations are live.
			 * Instruments read from this, not from `truth`.
			 */
			display: DisplayState;
			inputs: FdmInputs;
			running: boolean;
			stepState?: ScenarioStepState;
			/** Sticky list of active fault activations as of this snapshot. */
			activations: readonly FaultActivation[];
	  }
	| { type: typeof SIM_WORKER_MESSAGES.OUTCOME; result: ScenarioRunResult }
	/**
	 * Full replay tape posted once per scenario run, immediately after the
	 * OUTCOME message. The main thread persists it for the debrief route.
	 * Even ABORTED runs post a tape (with whatever frames accumulated).
	 *
	 * `grade` is present when the scenario declared a `grading` block and
	 * the evaluator could run (non-empty frames). It is omitted on
	 * scenarios with no grading definition and on aborted runs whose
	 * tapes have zero frames.
	 */
	| { type: typeof SIM_WORKER_MESSAGES.TAPE; tape: ReplayTape; grade?: GradeReport };
