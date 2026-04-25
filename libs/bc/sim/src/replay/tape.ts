/**
 * Replay tape construction + serialization.
 *
 * The worker collects frames in a ring buffer during the run, then on
 * outcome calls `buildTape` to assemble the final ReplayTape, posts it
 * to the main thread, and the persistence layer serializes via
 * `serializeTape` (JSON today; LZ-compressed JSON later when sizes
 * force it). On load, the debrief calls `parseTape` and validates the
 * embedded `scenarioHash` against the current definition before
 * rendering.
 */

import type { ScenarioDefinition, ScenarioInitialState, ScenarioRunResult } from '../types';
import { hashScenarioDefinition } from './hash';
import type { FrameRing } from './ring-buffer';
import { drainFrames } from './ring-buffer';
import type { ReplayFrame, ReplayTape } from './types';

/** Format version. Bump when the on-disk shape changes. */
export const REPLAY_TAPE_FORMAT_VERSION = 1;

/**
 * Drain the frame ring and assemble the final tape. Called once per
 * scenario run, on outcome. Idempotent: safe to call again on an
 * empty ring (returns a tape with zero frames, useful for ABORTED
 * runs that ended before the first snapshot fired).
 */
export function buildTape(args: {
	def: ScenarioDefinition;
	initial: ScenarioInitialState;
	seed: number;
	frames: FrameRing;
	result: ScenarioRunResult;
}): ReplayTape {
	const drained = drainFrames(args.frames);
	return {
		scenarioId: args.def.id,
		scenarioHash: hashScenarioDefinition(args.def),
		seed: args.seed,
		initial: args.initial,
		frames: drained,
		result: args.result,
		formatVersion: REPLAY_TAPE_FORMAT_VERSION,
	};
}

/**
 * Serialize to a string suitable for storage. JSON today; will swap to
 * a compressed wire format in a follow-up PR (gzip-of-JSON via the
 * platform CompressionStream API) when tape sizes force it. The
 * serialize/parse pair stays round-trip-stable through that swap.
 */
export function serializeTape(tape: ReplayTape): string {
	return JSON.stringify(tape);
}

/**
 * Parse a serialized tape. Throws on schema mismatch (unknown format
 * version, missing required fields). The debrief catches and surfaces
 * "tape unreadable" without crashing.
 */
export function parseTape(serialized: string): ReplayTape {
	const parsed: unknown = JSON.parse(serialized);
	if (!isReplayTape(parsed)) {
		throw new Error('parseTape: serialized payload is not a valid ReplayTape');
	}
	if (parsed.formatVersion !== REPLAY_TAPE_FORMAT_VERSION) {
		throw new Error(
			`parseTape: format version mismatch (tape=${parsed.formatVersion}, runtime=${REPLAY_TAPE_FORMAT_VERSION})`,
		);
	}
	return parsed;
}

/**
 * Validation result from comparing a tape's embedded hash to the
 * current definition. The debrief uses this to decide whether to
 * render or to show "scenario has changed since you flew it."
 */
export interface TapeHashValidation {
	matches: boolean;
	tapeHash: string;
	currentHash: string;
}

/**
 * Validate a loaded tape against the current scenario definition.
 * Returns the comparison detail so the UI can surface a clear message
 * instead of just true/false.
 */
export function validateTapeHash(tape: ReplayTape, def: ScenarioDefinition): TapeHashValidation {
	const currentHash = hashScenarioDefinition(def);
	return {
		matches: tape.scenarioHash === currentHash,
		tapeHash: tape.scenarioHash,
		currentHash,
	};
}

// --- internal type guards ------------------------------------------------

function isReplayTape(value: unknown): value is ReplayTape {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.scenarioId === 'string' &&
		typeof v.scenarioHash === 'string' &&
		typeof v.seed === 'number' &&
		typeof v.formatVersion === 'number' &&
		typeof v.initial === 'object' &&
		v.initial !== null &&
		typeof v.result === 'object' &&
		v.result !== null &&
		Array.isArray(v.frames) &&
		v.frames.every(isReplayFrame)
	);
}

function isReplayFrame(value: unknown): value is ReplayFrame {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.t === 'number' &&
		typeof v.truth === 'object' &&
		v.truth !== null &&
		typeof v.display === 'object' &&
		v.display !== null &&
		typeof v.inputs === 'object' &&
		v.inputs !== null &&
		Array.isArray(v.activations) &&
		Array.isArray(v.firedThisTick)
	);
}
