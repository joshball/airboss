/**
 * Edition resolver -- the single read-side API for "what is the current
 * edition for this source?" plus the supersession probe + chain walk.
 *
 * Source of truth: ADR 026 §6 + the partial index
 * `editions_source_current_idx WHERE retired_at IS NULL` on
 * `sources_registry.editions` (see [libs/sources/src/db/schema.ts]).
 *
 * Server-only: queries the live postgres handle. Re-exported via
 * `@ab/sources/server`; never via the runtime barrel `@ab/sources`. A
 * `.svelte` file that imports from here trips the
 * `scripts/check-browser-globals.ts` guard.
 *
 * Why one resolver file (and not five spread across per-corpus resolvers):
 * ADR 026 §6 makes this load-bearing. "Without a single API, every consumer
 * would re-implement the registry probe, which re-introduces the drift this
 * ADR is closing." Every BC consumer + route handler that needs to know
 * "current edition" or "is this row superseded?" goes through one of the
 * four functions below.
 */

import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { type EditionRow, editions as editionsTable } from '../db/schema.ts';
import type { SourceId } from '../types.ts';

/**
 * The current edition row for `sourceId`. Returns the row whose `retired_at`
 * is NULL and whose `published_at` is highest. Returns `null` when:
 *
 *   - no rows exist for `sourceId`, OR
 *   - every row carries `retired_at` (no current edition).
 *
 * Tiebreak when two rows share `published_at`: the lex-greater `id` wins.
 * Edition ids are `edition_<ULID>` and ULIDs sort monotonically, so the
 * lex-max is the most recently inserted row -- the deterministic operator
 * choice. Matches the rule in `editions.ts:138 getCurrentEditionForSource`.
 */
export async function getCurrentEdition(sourceId: SourceId): Promise<EditionRow | null> {
	const rows = await db
		.select()
		.from(editionsTable)
		.where(and(eq(editionsTable.sourceId, sourceId), isNull(editionsTable.retiredAt)));
	if (rows.length === 0) return null;
	let winner = rows[0];
	if (winner === undefined) return null;
	for (let i = 1; i < rows.length; i += 1) {
		const candidate = rows[i];
		if (candidate === undefined) continue;
		if (compareForCurrent(candidate, winner) > 0) winner = candidate;
	}
	return winner;
}

/**
 * The row for `(sourceId, label)`. Returns `null` when no row matches.
 *
 * Used by the amendment 2026-05 resolver chain when a citation pins to an
 * older edition (e.g. a page-pinned AFH 3B citation): the resolver fetches
 * the labelled row to confirm the pin is valid.
 */
export async function getEditionByLabel(sourceId: SourceId, label: string): Promise<EditionRow | null> {
	const rows = await db
		.select()
		.from(editionsTable)
		.where(and(eq(editionsTable.sourceId, sourceId), eq(editionsTable.editionLabel, label)))
		.limit(1);
	return rows[0] ?? null;
}

/**
 * `true` when the named edition exists for `sourceId` AND carries `retired_at`.
 * `false` otherwise -- including when the label doesn't exist in the registry.
 *
 * The "unknown returns false" semantics matches the implicit "if I don't know
 * about this row, I have no evidence it's superseded" rule the BC consumers
 * want: an unrecognised label is not silently treated as retired.
 */
export async function isEditionSuperseded(sourceId: SourceId, label: string): Promise<boolean> {
	const row = await getEditionByLabel(sourceId, label);
	if (row === null) return false;
	return row.retiredAt !== null;
}

/**
 * Every edition row for `sourceId`, oldest first (by `published_at` ASC).
 * Returns `[]` when no rows exist.
 *
 * Tiebreak when two rows share `published_at`: lex-smaller `id` first
 * (mirrors the asc ordering chosen by `loadEditionsFromDb` so cross-call
 * consistency is preserved).
 *
 * Used by the regulations + library readers when they need the full chain
 * (e.g. the "history" view of a CFR Part across years).
 */
export async function listEditionsForSource(sourceId: SourceId): Promise<readonly EditionRow[]> {
	const rows = await db
		.select()
		.from(editionsTable)
		.where(eq(editionsTable.sourceId, sourceId))
		.orderBy(asc(editionsTable.publishedAt), asc(editionsTable.id));
	return rows;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Comparator for the `getCurrentEdition` tiebreak. Returns positive when
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
