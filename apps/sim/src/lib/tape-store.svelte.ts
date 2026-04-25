/**
 * Client-side replay tape store.
 *
 * The FDM worker posts a TAPE message at the end of each scenario run.
 * The cockpit page subscribes, hands the tape to this store, and the
 * debrief route reads from it. Storage today is sessionStorage keyed
 * by scenario id -- survives a page reload but not a tab close.
 *
 * Phase 4 + the spaced-rep wiring will swap this for a real db-backed
 * sim.scenario_attempt row; the store interface stays the same so the
 * debrief route does not have to change.
 */

import { parseTape, type ReplayTape, serializeTape } from '@ab/bc-sim';
import type { SimScenarioId } from '@ab/constants';

const STORAGE_PREFIX = 'sim.tape.';

function storageKey(scenarioId: SimScenarioId): string {
	return `${STORAGE_PREFIX}${scenarioId}`;
}

/**
 * Save the most recent tape for a scenario. Overwrites any previous
 * entry -- only the latest run is kept per scenario for now. The
 * spaced-rep + study integration will add a multi-attempt history
 * table later.
 */
export function saveTape(tape: ReplayTape): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.setItem(storageKey(tape.scenarioId), serializeTape(tape));
	} catch {
		// Quota exceeded or storage disabled. The next run will overwrite
		// regardless, and the debrief simply will not have an old tape to
		// show -- correct degradation, no silent data loss elsewhere.
	}
}

/**
 * Load the most recent tape for a scenario. Returns null if no tape
 * has been recorded this session, or if the stored payload fails to
 * parse (caller treats both equivalently -- "no debrief available").
 */
export function loadTape(scenarioId: SimScenarioId): ReplayTape | null {
	if (typeof sessionStorage === 'undefined') return null;
	const raw = sessionStorage.getItem(storageKey(scenarioId));
	if (raw === null) return null;
	try {
		return parseTape(raw);
	} catch {
		// Stored payload is not a valid tape (probably from an older
		// format version). Nuke it so subsequent calls do not keep
		// trying to parse it.
		sessionStorage.removeItem(storageKey(scenarioId));
		return null;
	}
}

/** Clear the saved tape for a scenario. Used by the dev "reset history" path. */
export function clearTape(scenarioId: SimScenarioId): void {
	if (typeof sessionStorage === 'undefined') return;
	sessionStorage.removeItem(storageKey(scenarioId));
}
