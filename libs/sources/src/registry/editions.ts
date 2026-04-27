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
 */
export const __editions_internal__ = {
	getActiveTable(): Map<SourceId, readonly Edition[]> {
		return _activeEditions;
	},
	setActiveTable(next: Map<SourceId, readonly Edition[]>): Map<SourceId, readonly Edition[]> {
		const prev = _activeEditions;
		_activeEditions = next;
		return prev;
	},
};

let _activeEditions: Map<SourceId, readonly Edition[]> = new Map(EDITIONS);

/** Read the currently-active edition map. */
export function getEditionsMap(): Map<SourceId, readonly Edition[]> {
	return _activeEditions;
}
