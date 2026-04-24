/**
 * Shared types for the sync service.
 */

import type { HangarSyncMode, SyncOutcome } from '@ab/constants';

/**
 * Map of absolute path -> file body to write. Preserves the per-file
 * separation so the commit step can stage each file by name (per CLAUDE.md
 * "never use git add -A").
 */
export type FileWrites = Readonly<Record<string, string>>;

/**
 * One drifted row surfaced by `detectDrift`. `kind` lets the UI render the
 * right badge + action target. `id` keys back to the row.
 */
export interface DriftEntry {
	kind: 'reference' | 'source';
	id: string;
	/** True when the row has `dirty = true`. */
	dirty: boolean;
	/** True when re-emitting from DB produces a different TOML body. */
	differsOnDisk: boolean;
}

/**
 * Result of the drift scan. `files` lists the absolute paths whose emitted
 * bodies differ from disk (can be empty even when `entries.length > 0` if
 * all dirty rows happened to encode identically).
 */
export interface DriftReport {
	entries: readonly DriftEntry[];
	/** Absolute paths with a diff between DB-derived TOML and on-disk TOML. */
	files: readonly string[];
}

/**
 * One conflict surfaced by `detectConflict`. A conflict means some actor
 * advanced `rev` past what the last successful sync observed, so writing
 * back now would silently clobber an edit the sync-log didn't see.
 */
export interface ConflictEntry {
	kind: 'reference' | 'source';
	id: string;
	/** `rev` in the DB right now. */
	currentRev: number;
	/** `rev` the last successful sync recorded for this id. */
	lastSyncedRev: number | null;
}

export interface ConflictReport {
	entries: readonly ConflictEntry[];
	hasConflict: boolean;
}

/**
 * Output of a commit-and-maybe-PR run. Always carries a SHA (even for a
 * local commit); `prUrl` is non-null only in `pr` mode.
 */
export interface CommitOutcome {
	mode: HangarSyncMode;
	sha: string;
	branch: string;
	files: readonly string[];
	prUrl: string | null;
}

/** Terminal result of `runSyncJob`. */
export interface SyncResult {
	outcome: SyncOutcome;
	/** Present on `success` runs that actually wrote + committed. */
	commit: CommitOutcome | null;
	/** Drift report captured at the start of the run. Always present. */
	drift: DriftReport;
	/** Conflicts detected (empty when none). */
	conflicts: readonly ConflictEntry[];
	/** Short human-readable explanation (mirrors `hangar.sync_log.message`). */
	message: string;
}
