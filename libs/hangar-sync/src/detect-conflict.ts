/**
 * Conflict detection.
 *
 * Before writing a sync, compare the `rev` each row had when the sync
 * started reading against the `rev` the row has right now. Any row whose
 * rev advanced between the read and the write indicates another actor
 * (another sync run, a crashed-mid-flight worker, a DB shell session)
 * bumped it -- their edit would be silently clobbered unless we abort.
 *
 * Also accepts an optional baseline (the rev snapshot from the most recent
 * successful sync in `hangar.sync_log.rev_snapshot`). If a caller only has
 * a baseline, the check is equivalent: compare currentRev against the last
 * known good rev.
 *
 * In practice the per-targetId job queue + the pg_advisory_lock this
 * service takes inside `runSyncJob` make the cross-process race vanishingly
 * unlikely, but the check is cheap, explicit, and auditable so it stays.
 */

import type { HangarSyncLogRow } from '@ab/db';
import type { ConflictEntry, ConflictReport } from './types';

export interface ConflictInputs {
	/** Current rev for every reference in scope, keyed by id. */
	referenceRevs: Readonly<Record<string, number>>;
	/** Current rev for every source in scope, keyed by id. */
	sourceRevs: Readonly<Record<string, number>>;
	/**
	 * Rev snapshot the sync observed when it started (or, absent that, the
	 * rev snapshot from the most recent successful `sync_log` row). A row
	 * with `currentRev > baselineRev` is a conflict.
	 */
	baseline: {
		references: Readonly<Record<string, number>>;
		sources: Readonly<Record<string, number>>;
	} | null;
}

/**
 * Compare current revs against the baseline. Ids present in `referenceRevs`
 * / `sourceRevs` but not in the baseline are ignored (newly-created rows
 * cannot be in conflict with something that hasn't been synced yet).
 */
export function detectConflict(inputs: ConflictInputs): ConflictReport {
	const entries: ConflictEntry[] = [];
	const baselineRefs = inputs.baseline?.references ?? {};
	const baselineSrcs = inputs.baseline?.sources ?? {};

	for (const [id, currentRev] of Object.entries(inputs.referenceRevs)) {
		const lastSyncedRev = baselineRefs[id];
		if (lastSyncedRev === undefined) continue;
		if (currentRev > lastSyncedRev) {
			entries.push({ kind: 'reference', id, currentRev, lastSyncedRev });
		}
	}

	for (const [id, currentRev] of Object.entries(inputs.sourceRevs)) {
		const lastSyncedRev = baselineSrcs[id];
		if (lastSyncedRev === undefined) continue;
		if (currentRev > lastSyncedRev) {
			entries.push({ kind: 'source', id, currentRev, lastSyncedRev });
		}
	}

	return { entries, hasConflict: entries.length > 0 };
}

/** Extract a baseline from a `sync_log` row (null when the row has no snapshot). */
export function baselineFromSyncLog(row: HangarSyncLogRow | null): ConflictInputs['baseline'] {
	if (!row?.revSnapshot) return null;
	return row.revSnapshot;
}
