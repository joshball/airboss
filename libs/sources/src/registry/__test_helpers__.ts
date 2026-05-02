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
 * previous table afterward. Detects whether `body` returns a Promise: sync
 * bodies stay synchronous (matching legacy callers); async bodies hold the
 * primed table for the full duration of the awaited work.
 */
export function withTestEntries<T>(entries: Record<string, SourceEntry>, body: () => T): T;
export function withTestEntries<T>(entries: Record<string, SourceEntry>, body: () => Promise<T>): Promise<T>;
export function withTestEntries<T>(entries: Record<string, SourceEntry>, body: () => T | Promise<T>): T | Promise<T> {
	const cast = entries as Record<SourceId, SourceEntry>;
	const prev = __sources_internal__.setActiveTable({ ...cast });
	let restored = false;
	const restore = (): void => {
		if (restored) return;
		restored = true;
		__sources_internal__.setActiveTable(prev);
	};
	try {
		const result = body();
		if (isPromiseLike(result)) {
			return Promise.resolve(result).finally(restore);
		}
		restore();
		return result;
	} catch (err) {
		restore();
		throw err;
	}
}

/**
 * Run `body` with the active edition map swapped to `editions`. Restores the
 * previous map afterward. Like `withTestEntries`, sync bodies stay sync and
 * async bodies hold the primed map until the awaited work completes.
 */
export function withTestEditions<T>(editions: ReadonlyMap<SourceId, readonly Edition[]>, body: () => T): T;
export function withTestEditions<T>(
	editions: ReadonlyMap<SourceId, readonly Edition[]>,
	body: () => Promise<T>,
): Promise<T>;
export function withTestEditions<T>(
	editions: ReadonlyMap<SourceId, readonly Edition[]>,
	body: () => T | Promise<T>,
): T | Promise<T> {
	const prev = __editions_internal__.setActiveTable(new Map(editions));
	let restored = false;
	const restore = (): void => {
		if (restored) return;
		restored = true;
		__editions_internal__.setActiveTable(prev);
	};
	try {
		const result = body();
		if (isPromiseLike(result)) {
			return Promise.resolve(result).finally(restore);
		}
		restore();
		return result;
	} catch (err) {
		restore();
		throw err;
	}
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
	return value !== null && typeof value === 'object' && typeof (value as { then?: unknown }).then === 'function';
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
