/**
 * Sim BC -- replay tape.
 *
 * Public surface for the worker-side ring buffer + tape construction
 * and the main-thread serialize / parse / validate path.
 */

export { hashScenarioDefinition } from './hash';
export {
	createFrameRing,
	DEFAULT_RING_CAPACITY,
	drainFrames,
	type FrameRing,
	pushFrame,
	ringFramesDropped,
	ringHasWrapped,
} from './ring-buffer';
export {
	buildTape,
	parseTape,
	REPLAY_TAPE_FORMAT_VERSION,
	serializeTape,
	type TapeHashValidation,
	validateTapeHash,
} from './tape';
export type { ReplayFrame, ReplayTape, TapeOutcome } from './types';
