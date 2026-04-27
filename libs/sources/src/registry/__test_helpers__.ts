/**
 * Test-only helpers for priming the registry's in-memory tables. Production
 * code MUST NOT import this module.
 *
 * Tests use `withTestEntries` and `withTestEditions` (or the lower-level
 * `__sources_internal__` / `__editions_internal__`) to swap in fixture data
 * for the duration of a test. The `withX` form uses try/finally to restore
 * the previous state even on test failure.
 */

import type { Edition, SourceEntry, SourceId } from '../types.ts';
import { __corpus_resolver_internal__ } from './corpus-resolver.ts';
import { __editions_internal__ } from './editions.ts';
import { __lifecycle_internal__ } from './lifecycle.ts';
import { clearReverseIndex } from './query.ts';
import { __sources_internal__ } from './sources.ts';

/**
 * Run `body` with the active entry table swapped to `entries`. Restores the
 * previous table afterward.
 */
export function withTestEntries<T>(entries: Record<string, SourceEntry>, body: () => T): T {
	const cast = entries as Record<SourceId, SourceEntry>;
	const prev = __sources_internal__.setActiveTable({ ...cast });
	try {
		return body();
	} finally {
		__sources_internal__.setActiveTable(prev);
	}
}

/**
 * Run `body` with the active edition map swapped to `editions`. Restores the
 * previous map afterward.
 */
export function withTestEditions<T>(editions: ReadonlyMap<SourceId, readonly Edition[]>, body: () => T): T {
	const prev = __editions_internal__.setActiveTable(new Map(editions));
	try {
		return body();
	} finally {
		__editions_internal__.setActiveTable(prev);
	}
}

/**
 * Reset every test-mutable surface to its production default. Convenient
 * `beforeEach` / `afterEach` helper.
 */
export function resetRegistry(): void {
	__lifecycle_internal__.reset();
	__corpus_resolver_internal__.resetToDefaults();
	__sources_internal__.setActiveTable({});
	__editions_internal__.setActiveTable(new Map());
	clearReverseIndex();
}
