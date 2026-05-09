/**
 * Edition writer -- the seed-time path that populates
 * `sources_registry.editions`. Idempotent upsert by `(source_id, edition_label)`,
 * with optional `retired_at`. The seed is the only caller; ingest pipelines use
 * `commitIngestBatch` (lifecycle.ts) which today mutates the in-memory map and
 * eventually persists via `recordPromotion`. After ADR 026, the registry is the
 * single source of truth, which means the seed must persist edition rows here
 * before any read path consults the registry.
 *
 * Server-only. Re-exported via `@ab/sources/server`.
 */

import { createId } from '@ab/utils';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { type EditionRow, type NewEditionRow, editions as editionsTable } from '../db/schema.ts';
import type { SourceId } from '../types.ts';
import { __editions_internal__ } from './editions.ts';

/**
 * Input for `upsertEdition`. `retiredAt` may be `null` (current edition),
 * a `Date` (retired at the given timestamp), or omitted entirely (defaults to
 * `null` -- treats the edition as current).
 */
export interface UpsertEditionInput {
	readonly sourceId: SourceId;
	readonly editionLabel: string;
	readonly publishedAt?: Date | null;
	readonly retiredAt?: Date | null;
}

/**
 * Idempotent upsert by `(source_id, edition_label)`. Returns the persisted row.
 *
 * Behavior:
 *
 *   - If no row matches `(sourceId, editionLabel)`, insert with a fresh
 *     `edition_<ULID>` id and the supplied timestamps.
 *   - If a row exists, update its `published_at` + `retired_at` to the input
 *     values (last writer wins). The `id` is preserved so cross-call
 *     references stay valid.
 *
 * The seed calls this for every `(slug, edition)` pair it produces; running
 * the seed twice converges on the same row set with no churn.
 *
 * Bumps the in-memory generation counter so downstream caches re-query on
 * the next read.
 */
export async function upsertEdition(input: UpsertEditionInput): Promise<EditionRow> {
	const existing = await db
		.select()
		.from(editionsTable)
		.where(and(eq(editionsTable.sourceId, input.sourceId), eq(editionsTable.editionLabel, input.editionLabel)))
		.limit(1);

	const publishedAt = input.publishedAt ?? null;
	const retiredAt = input.retiredAt ?? null;

	if (existing[0] !== undefined) {
		const [updated] = await db
			.update(editionsTable)
			.set({ publishedAt, retiredAt })
			.where(eq(editionsTable.id, existing[0].id))
			.returning();
		if (updated === undefined) throw new Error(`upsertEdition: update returned no row for id=${existing[0].id}`);
		__editions_internal__.bumpGeneration();
		return updated;
	}

	const row: NewEditionRow = {
		id: createId('edition'),
		sourceId: input.sourceId,
		editionLabel: input.editionLabel,
		publishedAt,
		retiredAt,
	};
	const [inserted] = await db.insert(editionsTable).values(row).returning();
	if (inserted === undefined) {
		throw new Error(`upsertEdition: insert returned no row for ${input.sourceId} / ${input.editionLabel}`);
	}
	__editions_internal__.bumpGeneration();
	return inserted;
}

/**
 * Mark every edition for `sourceId` other than the supplied `currentLabel` as
 * retired -- so a fresh seed pass that walks oldest -> newest can declare the
 * latest edition by calling `markPriorEditionsRetired` after the upserts land.
 *
 * `retiredAt` defaults to the current server clock. Idempotent: editions that
 * are already retired keep their existing `retired_at` timestamp.
 *
 * Returns the count of rows whose `retired_at` was updated by this call.
 */
export async function markPriorEditionsRetired(
	sourceId: SourceId,
	currentLabel: string,
	retiredAt: Date = new Date(),
): Promise<number> {
	const rows = await db.select().from(editionsTable).where(eq(editionsTable.sourceId, sourceId));
	let updated = 0;
	for (const row of rows) {
		if (row.editionLabel === currentLabel) continue;
		if (row.retiredAt !== null) continue;
		await db.update(editionsTable).set({ retiredAt }).where(eq(editionsTable.id, row.id));
		updated += 1;
	}
	if (updated > 0) __editions_internal__.bumpGeneration();
	return updated;
}
