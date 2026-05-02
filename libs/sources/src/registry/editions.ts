/**
 * Per-entry edition history.
 *
 * Source of truth: ADR 019 §6.1 (`Edition` + `AliasEntry`) + §1.3 (edition
 * pinning). Editions live in the indexed tier per ADR 019 §2.1's removal
 * note ("`editions: Edition[]` move to indexed tier"). Persisted in the
 * `sources_registry.editions` table; reads go through an in-memory cache
 * gated by a generation counter so existing sync callers (resolvers,
 * snapshot writers, the renderer) stay sync.
 *
 * Cache contract:
 *
 *   - `_activeEditions` is the in-memory `Map<SourceId, readonly Edition[]>`
 *     consumed by every sync caller. It is populated either by
 *     `warmEditionsCache()` at bootstrap (Postgres -> map) or by ingestion
 *     pipelines via `__editions_internal__.setActiveTable` (in-memory only).
 *   - `_loaded` distinguishes "no row in DB for this id" (entry absent) from
 *     "cache has not been warmed yet" (cache cold).
 *   - `_editionsGeneration` is monotonic; bumped on every cache mutation
 *     (set, warm, write commit). Index caches in `index-cache.ts` watch
 *     this counter to know when to rebuild.
 *
 * Phase 2 ships an empty initial state. Ingestion pipelines populate the
 * map (in memory) via `commitIngestBatch`; future WPs persist edition rows
 * to Postgres so the cache survives restart.
 */

import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { type EditionAliasEntry, type EditionRow, editions as editionsTable } from '../db/schema.ts';
import type { Edition, SourceId } from '../types.ts';

/**
 * The edition map. Keys are the canonical `airboss-ref:` URI string with
 * `?at=` stripped (matches `SOURCES` keys). Values are the chronological
 * list of editions known for that entry, oldest first.
 *
 * Phase 2 ships empty; Phase 3+ populate.
 */
export const EDITIONS: ReadonlyMap<SourceId, readonly Edition[]> = new Map();

let _activeEditions: Map<SourceId, readonly Edition[]> = new Map(EDITIONS);
let _editionsGeneration = 0;
let _loaded = false;
let _cachedGeneration = -1;

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
		_cachedGeneration = _editionsGeneration;
		_loaded = true;
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
	/**
	 * Force the next `getEditionsMapAsync` call to re-query the DB. Used by
	 * the write path (Phase 3 transactions) to invalidate the read-through
	 * cache after committing an edition row.
	 */
	bumpGeneration(): void {
		_editionsGeneration += 1;
	},
	/**
	 * Test-only reset of the loaded flag + cache generation. The harness
	 * uses it to force a fresh load against a primed test DB or to drop a
	 * warm-from-prior-test cache. Production code MUST NOT call this.
	 */
	resetLoadedForTests(): void {
		_loaded = false;
		_cachedGeneration = -1;
	},
	/** Test-only inspector for `_loaded` (the "DB warmed yet" flag). */
	isLoadedForTests(): boolean {
		return _loaded;
	},
};

/**
 * Read the currently-active edition map. Sync surface preserved for the ~25
 * resolver call sites. Callers that need the latest persisted state must
 * call `warmEditionsCache()` (or `loadEditionsFromDb()`) before reading.
 *
 * Phase 2 contract: production code calls `warmEditionsCache()` once at
 * bootstrap from `apps/{app}/src/hooks.server.ts` via `initRegistry()`;
 * subsequent reads observe the result. After the bootstrap, ingestion
 * mutations (in-memory `setActiveTable` or DB writes that bump the
 * generation) trigger a re-load on the next call.
 */
export function getEditionsMap(): Map<SourceId, readonly Edition[]> {
	return _activeEditions;
}

/**
 * Async read-through: returns the edition map after ensuring the cache is
 * warm and current. The first call hits the DB; subsequent calls within the
 * same generation return the cached map. Generation bumps from the write
 * path force a re-query on the next call.
 */
export async function getEditionsMapAsync(): Promise<Map<SourceId, readonly Edition[]>> {
	if (!_loaded || _cachedGeneration !== _editionsGeneration) {
		await loadEditionsFromDb();
	}
	return _activeEditions;
}

/**
 * Read the row with the highest `published_at` and `retired_at IS NULL` for
 * `sourceId`. Returns null when the entry has no current edition.
 *
 * Tiebreak: when two editions share the same `published_at`, the row with
 * the lex-greater `id` wins. Edition ids are `edition_<ULID>` and ULIDs are
 * monotonic so the lex-max is the most recently inserted row, which is the
 * deterministic choice operators expect.
 *
 * No per-call cache yet (per design.md "defer until measured"). The W5
 * generation-counter cache in `index-cache.ts` already memoizes the
 * lex-max edition slug per corpus, which covers the renderer hot path.
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
	_activeEditions = next as Map<SourceId, readonly Edition[]>;
	_editionsGeneration += 1;
	_cachedGeneration = _editionsGeneration;
	_loaded = true;
}

/**
 * Bootstrap-time helper: hydrate the in-memory editions map from Postgres.
 * Distinct from `loadEditionsFromDb()` only by intent (run once on startup
 * vs. re-query on cache miss); both go through the same read path.
 */
export async function warmEditionsCache(): Promise<void> {
	await loadEditionsFromDb();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToEdition(row: EditionRow): Edition {
	const aliases = row.metadata?.aliases;
	if (aliases !== undefined && aliases.length > 0) {
		return {
			id: row.editionLabel,
			published_date: row.publishedAt ?? new Date(0),
			source_url: '',
			aliases: aliases.map(toAliasEntry),
		};
	}
	return {
		id: row.editionLabel,
		published_date: row.publishedAt ?? new Date(0),
		source_url: '',
	};
}

function toAliasEntry(raw: EditionAliasEntry): {
	readonly from: SourceId;
	readonly to: SourceId | readonly SourceId[];
	readonly kind: 'silent' | 'content-change' | 'cross-section' | 'split' | 'merge';
} {
	const to = Array.isArray(raw.to) ? (raw.to as readonly string[]).map((t) => t as SourceId) : (raw.to as SourceId);
	return {
		from: raw.from as SourceId,
		to,
		kind: raw.kind,
	};
}

function comparePublishedAtAscending(a: Edition, b: Edition): number {
	const aMs = a.published_date.getTime();
	const bMs = b.published_date.getTime();
	if (aMs !== bMs) return aMs - bMs;
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Comparator for the `getCurrentEditionForSource` tiebreak. Returns positive when
 * `a` should beat `b`. Higher `published_at` wins; on tie, lex-greater `id`
 * wins. Null `published_at` loses to any non-null timestamp; if both are
 * null the lex-greater id wins.
 */
function compareForCurrent(a: EditionRow, b: EditionRow): number {
	const aMs = a.publishedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
	const bMs = b.publishedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
	if (aMs !== bMs) return aMs - bMs;
	if (a.id === b.id) return 0;
	return a.id < b.id ? -1 : 1;
}
