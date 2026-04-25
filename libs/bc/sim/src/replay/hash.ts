/**
 * Scenario-definition hash.
 *
 * Replay tapes embed a hash of the scenario definition that produced
 * them. On load the debrief computes the current hash and rejects the
 * tape if it does not match -- "scenario has changed since you flew it."
 * This prevents the debrief from showing a misleading replay when the
 * authored definition has shifted (different initial state, different
 * grading, different faults).
 *
 * The hash is a deterministic FNV-1a over a canonical JSON of the
 * fields that affect the run. Function fields (step `check` predicates)
 * are skipped -- they cannot be serialised, but their effect is
 * captured in the recorded frames anyway. Hashing `id + initial +
 * criteria + wind + scriptedInput + step ids/holdSeconds + faults +
 * idealPath + grading` is sufficient: two definitions with the same
 * hash produce the same scenario shape from the runner's perspective.
 *
 * FNV-1a is not cryptographically secure; that is fine. We need
 * deterministic equality, not adversarial collision resistance.
 */

import type { ScenarioDefinition } from '../types';

const FNV_OFFSET_BASIS_32 = 0x811c9dc5;
const FNV_PRIME_32 = 0x01000193;

/** FNV-1a 32-bit hash of a string. Returns hex with leading zeros, length 8. */
function fnv1a32(input: string): string {
	let hash = FNV_OFFSET_BASIS_32;
	for (let i = 0; i < input.length; i += 1) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, FNV_PRIME_32);
	}
	// Convert to unsigned 32-bit then to hex.
	const unsigned = hash >>> 0;
	return unsigned.toString(16).padStart(8, '0');
}

/**
 * Build the canonical JSON that gets hashed. Object key ordering is
 * stable -- we explicitly enumerate fields rather than `JSON.stringify`-ing
 * the whole def, because step `check` functions are not serialisable
 * and because property-iteration order is engine-dependent for
 * non-string-keyed records.
 */
function canonicalJson(def: ScenarioDefinition): string {
	const stepShape = def.steps?.map((s) => ({
		id: s.id,
		title: s.title,
		instruction: s.instruction,
		holdSeconds: s.holdSeconds ?? 0,
	}));
	const canonical = {
		id: def.id,
		title: def.title,
		aircraft: def.aircraft,
		runwayHeadingDegrees: def.runwayHeadingDegrees,
		initial: def.initial,
		criteria: def.criteria,
		wind: def.wind,
		scriptedInput: def.scriptedInput ?? null,
		steps: stepShape ?? null,
		faults: def.faults ?? null,
		idealPath: def.idealPath ?? null,
		grading: def.grading ?? null,
		repMetadata: def.repMetadata ?? null,
	};
	return JSON.stringify(canonical);
}

/**
 * Compute the canonical hash of a scenario definition. Stable across
 * page reloads and Node versions (FNV-1a, fixed `JSON.stringify` over a
 * canonical object).
 */
export function hashScenarioDefinition(def: ScenarioDefinition): string {
	return fnv1a32(canonicalJson(def));
}
