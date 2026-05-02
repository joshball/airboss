/**
 * Per-entry edition history.
 *
 * Source of truth: ADR 019 §6.1 (`Edition` + `AliasEntry`) + §1.3 (edition
 * pinning). Editions live in the indexed tier per ADR 019 §2.1's removal
 * note ("`editions: Edition[]` move to indexed tier"); Phase 2 ships an
 * in-memory map. Persistence to Postgres is a future WP.
 *
 * Phase 2 ships empty. Phase 3+ ingestion runs populate per-entry editions
 * as they walk authoritative sources (eCFR XML, FAA handbook PDFs, etc.).
 */

import type { Edition, SourceId } from '../types.ts';

/**
 * The edition map. Keys are the canonical `airboss-ref:` URI string with
 * `?at=` stripped (matches `SOURCES` keys). Values are the chronological
 * list of editions known for that entry, oldest first.
 *
 * Phase 2 ships empty; Phase 3+ populate.
 */
export const EDITIONS: ReadonlyMap<SourceId, readonly Edition[]> = new Map();

/**
 * Test-only mutation surface. Production code MUST NOT call this.
 *
 * Bumps the editions generation counter on every swap so any cached index
 * (`registry/index-cache.ts`) sees an invalidation signal on the next read.
 */
export const __editions_internal__ = {
	getActiveTable(): Map<SourceId, readonly Edition[]> {
		return _activeEditions;
	},
	setActiveTable(next: Map<SourceId, readonly Edition[]>): Map<SourceId, readonly Edition[]> {
		const prev = _activeEditions;
		_activeEditions = next;
		_editionsGeneration += 1;
		return prev;
	},
	/**
	 * Monotonic generation counter. Bumped on every `setActiveTable` call.
	 * Index caches (`registry/index-cache.ts`) compare this against their
	 * last-seen generation to decide whether to rebuild.
	 */
	getGeneration(): number {
		return _editionsGeneration;
	},
};

let _activeEditions: Map<SourceId, readonly Edition[]> = new Map(EDITIONS);
let _editionsGeneration = 0;

/** Read the currently-active edition map. */
export function getEditionsMap(): Map<SourceId, readonly Edition[]> {
	return _activeEditions;
}
