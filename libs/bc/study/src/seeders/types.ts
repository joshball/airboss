/**
 * Shared types for the per-shape seed adapters.
 *
 * Each adapter consumes a parsed manifest (already validated by
 * `manifestSchema`) plus a `SeedContext` carrying the repo root, options,
 * and a mutable summary the adapter increments as it writes rows.
 */

export interface SeedContext {
	/** Absolute path to the repo root; used to resolve `body_path` references. */
	readonly repoRoot: string;
	/** Optional dev-seed marker; production runs leave this null. */
	readonly seedOrigin: string | null;
}

export interface SeedSummary {
	editionsProcessed: number;
	sectionsTouched: number;
	sectionsChanged: number;
	figuresWritten: number;
	supersededLinks: number;
}

export function emptySummary(): SeedSummary {
	return {
		editionsProcessed: 0,
		sectionsTouched: 0,
		sectionsChanged: 0,
		figuresWritten: 0,
		supersededLinks: 0,
	};
}
