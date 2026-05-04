/**
 * Cross-file error classes for the study BC.
 *
 * Hosts errors used by more than one module so we have a single canonical
 * definition + barrel re-export. Per-file errors that are local to one module
 * stay alongside their throw sites; only the shared shapes live here.
 */

/**
 * Raised when `sourceType !== 'personal'` but `sourceRef` is missing.
 *
 * Shared by `cards.ts` and `scenarios.ts` so a route handler that catches
 * `SourceRefRequiredError` from `@ab/bc-study` discriminates the same failure
 * mode across both surfaces. Previously two identically-named classes lived
 * in each module; only the cards version was barreled, so `instanceof` checks
 * silently missed the scenarios case.
 */
export class SourceRefRequiredError extends Error {
	constructor() {
		super('source_ref is required when source_type is not personal');
		this.name = 'SourceRefRequiredError';
	}
}

/**
 * Raised when `INSERT ... RETURNING` (or the equivalent upsert path) returns
 * zero rows where the BC contract guarantees one. This is an
 * "internal-invariant violated" condition: the row should always come back,
 * because the upsert target collides on a known unique key. Surfacing a typed
 * class lets route handlers map to a stable 500 instead of parsing
 * `Error.message`, and keeps log search by error name aligned with the rest
 * of the BC.
 *
 * `entity` describes which write returned empty (e.g. `'goal'`, `'syllabus'`,
 * `'credential'`); `id` is the primary key of the row that was being written
 * (or a synthetic key like `'<goalId>:<syllabusId>'` for composite-PK rows).
 */
export class UpsertReturnedNoRowError extends Error {
	constructor(
		public readonly entity: string,
		public readonly id: string,
	) {
		super(`Upsert of ${entity} ${id} returned no row`);
		this.name = 'UpsertReturnedNoRowError';
	}
}
