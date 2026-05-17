// @browser-globals: server-only -- never imported by client .svelte
/**
 * Edition-history DB reads -- the server-only half of the edition cache.
 *
 * # Why this module is split from `editions.ts`
 *
 * `editions.ts` ships the browser-safe in-memory cache surface
 * (`getEditionsMap`, `__editions_internal__`) consumed by every per-corpus
 * resolver. Those resolvers register on the `@ab/sources` runtime barrel,
 * which is bundled into the browser.
 *
 * The DB-reading functions below reach `@ab/db/connection` -- the live
 * `postgres` driver. A production `vite build` follows `await import(...)`
 * edges into the client bundle and then compiles `postgres` against the
 * browser-externalised `node:perf_hooks` / `crypto` / `stream` stubs, which
 * crashes the build (`"performance" is not exported by "__vite-browser-
 * external"`). Deferring the import only defers *execution*, not *bundling*.
 *
 * Keeping the DB reads in their own server-only module gives `editions.ts`
 * (and therefore `corpus-resolver.ts` and the runtime barrel) zero edges --
 * static or dynamic -- to `@ab/db/connection`. Server callers (`registry/
 * init.ts`'s warm path, `registry/index.ts`, `@ab/sources/server`) import
 * these functions from here.
 *
 * Source of truth: ADR 019 §6.1 + the browser-hydration debug playbook.
 */

import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { type EditionRow, editions as editionsTable } from '../db/schema.ts';
import type { Edition, SourceId } from '../types.ts';
import { __editions_internal__, rowToEdition } from './editions.ts';

/**
 * Read the row with the highest `published_at` and `retired_at IS NULL` for
 * `sourceId`. Returns null when the entry has no current edition.
 *
 * Tiebreak: when two editions share the same `published_at`, the row with
 * the lex-greater `id` wins. Edition ids are `edition_<ULID>` and ULIDs are
 * monotonic so the lex-max is the most recently inserted row, which is the
 * deterministic choice operators expect.
 */
export async function getCurrentEditionForSource(sourceId: SourceId): Promise<Edition | null> {
	const rows = await db
		.select()
		.from(editionsTable)
		.where(and(eq(editionsTable.sourceId, sourceId), isNull(editionsTable.retiredAt)));
	if (rows.length === 0) return null;
	let winner = rows[0];
	if (winner === undefined) return null;
	for (let i = 1; i < rows.length; i += 1) {
		const row = rows[i];
		if (row === undefined) continue;
		if (compareForCurrent(row, winner) > 0) winner = row;
	}
	return rowToEdition(winner);
}

/**
 * Replace the in-memory edition map with the rows currently in
 * `sources_registry.editions`. Bumps generation so derived caches rebuild.
 * Idempotent on no-op DB content.
 */
export async function loadEditionsFromDb(): Promise<void> {
	const rows = await db.select().from(editionsTable);
	const next = new Map<SourceId, Edition[]>();
	for (const row of rows) {
		const id = row.sourceId as SourceId;
		const list = next.get(id) ?? [];
		list.push(rowToEdition(row));
		next.set(id, list);
	}
	for (const [id, list] of next) {
		list.sort(comparePublishedAtAscending);
		next.set(id, list);
	}
	__editions_internal__.commitDbLoad(next as Map<SourceId, readonly Edition[]>);
}

/**
 * Bootstrap-time helper: hydrate the in-memory editions map from Postgres.
 * Distinct from `loadEditionsFromDb()` only by intent (run once on startup
 * vs. re-query on cache miss); both go through the same read path.
 */
export async function warmEditionsCache(): Promise<void> {
	await loadEditionsFromDb();
}

/**
 * Async read-through: returns the edition map after ensuring the cache is
 * warm and current. The first call hits the DB; subsequent calls within the
 * same generation return the cached map. Generation bumps from the write
 * path force a re-query on the next call.
 */
export async function getEditionsMapAsync(): Promise<Map<SourceId, readonly Edition[]>> {
	if (__editions_internal__.needsDbReload()) {
		await loadEditionsFromDb();
	}
	return __editions_internal__.getActiveTable();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function comparePublishedAtAscending(a: Edition, b: Edition): number {
	const aMs = a.published_date.getTime();
	const bMs = b.published_date.getTime();
	if (aMs !== bMs) return aMs - bMs;
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Comparator for the `getCurrentEditionForSource` tiebreak. Returns positive
 * when `a` should beat `b`. Higher `published_at` wins; on tie, lex-greater
 * `id` wins. Null `published_at` loses to any non-null timestamp; if both are
 * null the lex-greater id wins.
 */
function compareForCurrent(a: EditionRow, b: EditionRow): number {
	const aMs = a.publishedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
	const bMs = b.publishedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
	if (aMs !== bMs) return aMs - bMs;
	if (a.id === b.id) return 0;
	return a.id < b.id ? -1 : 1;
}
