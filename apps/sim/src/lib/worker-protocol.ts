/**
 * Typed message protocol between the cockpit UI (main thread) and the FDM
 * worker. All messages are structured-clone-safe; values are primitives or
 * plain objects.
 *
 * The worker runs the FDM at SIM_TIMING.FDM_HZ and posts snapshot messages
 * at SIM_TIMING.SNAPSHOT_HZ. The outcome message is posted once when the
 * scenario reaches a terminal state.
 */

import type { FdmInputs, FdmTruthState, ScenarioRunResult } from '@ab/bc-sim';
import type { SIM_WORKER_MESSAGES, SimScenarioId } from '@ab/constants';

export type MainToWorker =
	| { type: typeof SIM_WORKER_MESSAGES.INIT; scenarioId: SimScenarioId }
	| { type: typeof SIM_WORKER_MESSAGES.START }
	| { type: typeof SIM_WORKER_MESSAGES.PAUSE }
	| { type: typeof SIM_WORKER_MESSAGES.RESUME }
	| { type: typeof SIM_WORKER_MESSAGES.RESET }
	| { type: typeof SIM_WORKER_MESSAGES.INPUT; inputs: Partial<FdmInputs> };

export type WorkerToMain =
	| { type: typeof SIM_WORKER_MESSAGES.READY; scenarioId: SimScenarioId }
	| { type: typeof SIM_WORKER_MESSAGES.SNAPSHOT; truth: FdmTruthState; inputs: FdmInputs; running: boolean }
	| { type: typeof SIM_WORKER_MESSAGES.OUTCOME; result: ScenarioRunResult };
