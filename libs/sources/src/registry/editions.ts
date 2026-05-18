/**
 * Per-entry edition history -- the browser-safe in-memory cache.
 *
 * Source of truth: ADR 019 §6.1 (`Edition` + `AliasEntry`) + §1.3 (edition
 * pinning). Editions live in the indexed tier per ADR 019 §2.1's removal
 * note ("`editions: Edition[]` move to indexed tier"). Persisted in the
 * `sources_registry.editions` table; reads go through an in-memory cache
 * gated by a generation counter so existing sync callers (resolvers,
 * snapshot writers, the renderer) stay sync.
 *
 * # Browser safety
 *
 * This module is reached from the `@ab/sources` runtime barrel (every
 * per-corpus resolver imports `getEditionsMap` here, and `corpus-resolver.ts`
 * re-exports `ENUMERATED_CORPORA` off the barrel). It MUST stay browser-safe:
 * no static OR dynamic edge to `@ab/db/connection`. The DB-reading functions
 * (`loadEditionsFromDb`, `warmEditionsCache`, `getEditionsMapAsync`,
 * `getCurrentEditionForSource`) live in the server-only `editions-db.ts`,
 * which calls back into this module's `__editions_internal__.commitDbLoad`
 * to populate the cache. A `vite build` follows dynamic imports too, so a
 * deferred `await import('@ab/db/connection')` here would still ship the
 * `postgres` driver into the client bundle and crash the build.
 *
 * Cache contract:
 *
 *   - `_activeEditions` is the in-memory `Map<SourceId, readonly Edition[]>`
 *     consumed by every sync caller. It is populated either by
 *     `warmEditionsCache()` at bootstrap (Postgres -> map via `editions-db.ts`)
 *     or by ingestion pipelines via `__editions_internal__.setActiveTable`
 *     (in-memory only).
 *   - `_loaded` distinguishes "no row in DB for this id" (entry absent) from
 *     "cache has not been warmed yet" (cache cold).
 *   - `_editionsGeneration` is monotonic; bumped on every cache mutation
 *     (set, warm, write commit). Index caches in `index-cache.ts` watch
 *     this counter to know when to rebuild.
 *
 * The cache starts empty on each process. Ingestion pipelines populate it
 * via `commitIngestBatch` (in-memory) and via `warmEditionsCache()` at
 * bootstrap (Postgres -> map). See WP `promotion-batches-persistence` for
 * the persistence design.
 */

import type { EditionAliasEntry, EditionRow } from '../db/schema.ts';
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
 * Mutation surface. Test-only EXCEPT for `commitDbLoad` / `needsDbReload` /
 * `getActiveTable`, which the server-only `editions-db.ts` uses to populate
 * the cache from Postgres. Production application code MUST NOT call the
 * `setActiveTable` / reset members directly.
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
	 * Server-only: commit a freshly-loaded edition map from Postgres. Called
	 * by `editions-db.ts`'s `loadEditionsFromDb`. Mirrors `setActiveTable`
	 * (swap + generation bump + mark loaded) but is named for the DB-load
	 * path so the call site reads as production code rather than test wiring.
	 */
	commitDbLoad(next: Map<SourceId, readonly Edition[]>): void {
		_activeEditions = next;
		_editionsGeneration += 1;
		_cachedGeneration = _editionsGeneration;
		_loaded = true;
	},
	/**
	 * Server-only: true when the cache has never been warmed, or when the
	 * write path bumped the generation since the last DB load. Drives the
	 * read-through in `editions-db.ts`'s `getEditionsMapAsync`.
	 */
	needsDbReload(): boolean {
		return !_loaded || _cachedGeneration !== _editionsGeneration;
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
 * call `warmEditionsCache()` (from `editions-db.ts`) before reading.
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

// ---------------------------------------------------------------------------
// Row -> domain helpers (pure -- shared with the server-only `editions-db.ts`)
// ---------------------------------------------------------------------------

/**
 * Convert a persisted `editions` row into the in-memory `Edition` shape.
 * Pure (no I/O); shared by `editions-db.ts`'s DB-read path.
 */
export function rowToEdition(row: EditionRow): Edition {
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
