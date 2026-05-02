/**
 * Conflict detection.
 *
 * Before writing a sync, compare what the last successful sync observed
 * (`hangar.sync_log.rev_snapshot`) against the rows visible right now.
 * Two kinds of conflict can surface:
 *
 * 1. **advanced** -- a row's `rev` moved forward since the last sync. Some
 *    other actor (a parallel sync run, a crashed-mid-flight worker, a DB
 *    shell session) bumped it. Writing the on-disk TOML now would silently
 *    clobber an edit the sync-log baseline didn't see.
 * 2. **deleted** -- a row that the baseline saw is now missing entirely
 *    AND is not tracked as a soft-delete. The row was hard-deleted out of
 *    band (manual SQL, DB reset, restore from backup). The previous
 *    implementation only walked current revs and missed this case
 *    completely; the sync would noop and leave the orphaned id on disk.
 *
 * Tracked soft-deletes are NOT conflicts: they're an intentional change
 * the sync should propagate. The caller passes `deletedIds` so this
 * detector can tell "row vanished by accident" from "row was deleted on
 * purpose"; the second case flows through `detectDrift` instead.
 *
 * In practice the per-targetId job queue + the pg_advisory_lock the sync
 * service takes inside `runSyncJob` make the cross-process race vanishingly
 * unlikely, but the check is cheap, explicit, and auditable so it stays.
 */

import type { HangarSyncLogRow } from '@ab/bc-hangar/schema';
import { parseRevSnapshot } from '@ab/bc-hangar/schema-types';
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
	/**
	 * Ids of rows that exist in the DB but are soft-deleted (`deleted_at`
	 * set). A baseline id missing from the current rev map but present
	 * here is an intentional deletion -- not a conflict. Optional for
	 * back-compat; omitting it means every disappearance is treated as a
	 * hard-delete conflict.
	 */
	deletedIds?: {
		references?: readonly string[];
		sources?: readonly string[];
	};
}

/**
 * Walk both directions:
 *   - current ids past their baseline rev -> `advanced`
 *   - baseline ids missing from current AND not soft-deleted -> `deleted`
 *
 * New rows (current ids absent from baseline) are not conflicts: they
 * cannot collide with a snapshot that never saw them.
 */
export function detectConflict(inputs: ConflictInputs): ConflictReport {
	const entries: ConflictEntry[] = [];
	const baselineRefs = inputs.baseline?.references ?? {};
	const baselineSrcs = inputs.baseline?.sources ?? {};
	const deletedRefIds = new Set(inputs.deletedIds?.references ?? []);
	const deletedSourceIds = new Set(inputs.deletedIds?.sources ?? []);

	for (const [id, currentRev] of Object.entries(inputs.referenceRevs)) {
		const lastSyncedRev = baselineRefs[id];
		if (lastSyncedRev === undefined) continue;
		if (currentRev > lastSyncedRev) {
			entries.push({ kind: 'reference', id, cause: 'advanced', currentRev, lastSyncedRev });
		}
	}

	for (const [id, currentRev] of Object.entries(inputs.sourceRevs)) {
		const lastSyncedRev = baselineSrcs[id];
		if (lastSyncedRev === undefined) continue;
		if (currentRev > lastSyncedRev) {
			entries.push({ kind: 'source', id, cause: 'advanced', currentRev, lastSyncedRev });
		}
	}

	for (const [id, lastSyncedRev] of Object.entries(baselineRefs)) {
		if (id in inputs.referenceRevs) continue;
		if (deletedRefIds.has(id)) continue;
		entries.push({ kind: 'reference', id, cause: 'deleted', currentRev: null, lastSyncedRev });
	}

	for (const [id, lastSyncedRev] of Object.entries(baselineSrcs)) {
		if (id in inputs.sourceRevs) continue;
		if (deletedSourceIds.has(id)) continue;
		entries.push({ kind: 'source', id, cause: 'deleted', currentRev: null, lastSyncedRev });
	}

	return { entries, hasConflict: entries.length > 0 };
}

/**
 * Extract a baseline from a `sync_log` row (null when the row has no
 * snapshot). Validates the jsonb shape with Zod -- a malformed snapshot
 * (manual SQL, schema drift) returns `null` so the sync degrades to
 * "no last successful sync" instead of crashing on `Object.entries(undefined)`.
 */
export function baselineFromSyncLog(row: HangarSyncLogRow | null): ConflictInputs['baseline'] {
	if (!row?.revSnapshot) return null;
	return parseRevSnapshot(row.revSnapshot);
}
