/**
 * Static identity table for every entry in every corpus.
 *
 * Source of truth: ADR 019 §2.1 (`SourceEntry` schema) + §2.6 (registry
 * population pattern).
 *
 * Phase 2 ships this empty. Per-corpus ingestion phases (Phase 3 CFR,
 * Phase 6 handbooks, Phase 7 AIM, Phase 8 AC, Phase 10 irregulars) populate
 * via their own ingestion runs which add entries with `lifecycle: 'pending'`,
 * then the reviewer promotes via `recordPromotion` (see `lifecycle.ts`).
 *
 * The constant is a frozen record so that consumers cannot mutate it
 * accidentally; per-test mutation goes through `__test_helpers__.ts`.
 */

import type { SourceEntry, SourceId } from '../types.ts';

/**
 * The static identity table. Keys are canonical `airboss-ref:` URI strings
 * with the `?at=` query stripped (the entry identifies the section; editions
 * are tracked separately in `editions.ts`).
 *
 * Phase 2 ships empty; Phase 3+ populate via their per-corpus pipelines.
 */
export const SOURCES: Readonly<Record<SourceId, SourceEntry>> = Object.freeze({});

/**
 * Test-only mutation surface. Production code MUST NOT call this. Tests use
 * `__test_helpers__.ts` to swap the active entry table for the duration of a
 * test; see `registry/__test_helpers__.ts`.
 *
 * The function returns the previous table so the test can restore it after.
 */
export const __sources_internal__ = {
	getActiveTable(): Record<SourceId, SourceEntry> {
		return _activeSources;
	},
	setActiveTable(next: Record<SourceId, SourceEntry>): Record<SourceId, SourceEntry> {
		const prev = _activeSources;
		_activeSources = next;
		return prev;
	},
};

let _activeSources: Record<SourceId, SourceEntry> = { ...SOURCES };

/**
 * Read the currently-active entry table. Production callers see `SOURCES`
 * (empty in Phase 2); tests may have swapped in fixtures.
 */
export function getSources(): Record<SourceId, SourceEntry> {
	return _activeSources;
}
