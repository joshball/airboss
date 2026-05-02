/**
 * Lifecycle state machine + atomic batch promotion.
 *
 * Source of truth: ADR 019 §2.4. Five states: `draft`, `pending`, `accepted`,
 * `retired`, `superseded`. Transitions are atomic at the batch level: either
 * every entry in a batch transitions or none does. The audit trail
 * (`promotion_batches`) preserves every promotion + de-promotion event.
 *
 * Phase 2 ships the in-memory implementation. Persistence to Postgres is a
 * future WP; the audit-trail shape is final.
 */

import { PROMOTION_STATES } from '@ab/constants';
import { createId } from '@ab/utils';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { type PromotionBatchRow, promotionBatches } from '../db/schema.ts';
import type { Edition, SourceEntry, SourceId, SourceLifecycle } from '../types.ts';
import { __editions_internal__ } from './editions.ts';
import { __sources_internal__, getSources } from './sources.ts';

// ---------------------------------------------------------------------------
// Promotion-batch shape (ADR 019 §2.4)
// ---------------------------------------------------------------------------

export type PromotionState = 'promoted' | 'de-promoted';

export interface PromotionBatch {
	readonly id: string;
	readonly corpus: string;
	readonly reviewerId: string;
	readonly promotionDate: Date;
	readonly scope: readonly SourceId[];
	readonly inputSource: string;
	readonly state: PromotionState;
	readonly fromLifecycle: SourceLifecycle;
	readonly toLifecycle: SourceLifecycle;
	readonly previousBatchId?: string;
}

export interface PromotionInput {
	readonly corpus: string;
	readonly reviewerId: string;
	readonly scope: readonly SourceId[];
	readonly inputSource: string;
	readonly targetLifecycle: SourceLifecycle;
}

export interface DePromotionInput {
	readonly corpus: string;
	readonly reviewerId: string;
	readonly scope: readonly SourceId[];
	readonly inputSource: string;
	readonly targetLifecycle: SourceLifecycle;
	readonly previousBatchId: string;
}

export type PromotionResult = { ok: true; batch: PromotionBatch } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Readonly<Record<SourceLifecycle, readonly SourceLifecycle[]>> = Object.freeze({
	draft: ['pending'],
	pending: ['accepted', 'retired'],
	accepted: ['retired', 'superseded', 'pending'], // last entry is the de-promote path
	retired: [],
	superseded: [],
});

/**
 * The valid target lifecycles from `from`. Returns an empty array for terminal
 * states (`retired`, `superseded`).
 */
export function getValidTransitions(from: SourceLifecycle): readonly SourceLifecycle[] {
	return VALID_TRANSITIONS[from];
}

/** Returns true when `from -> to` is permitted by the state machine. */
export function isValidTransition(from: SourceLifecycle, to: SourceLifecycle): boolean {
	return VALID_TRANSITIONS[from].includes(to);
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

/**
 * In-memory overlay of `SourceId -> latest lifecycle`. Derived from the
 * `promotion_batches` audit trail at startup via `rebuildLifecycleOverlay`,
 * then mutated in-place when `recordPromotion` / `recordDePromotion` commit.
 *
 * The overlay is the runtime cache; the audit trail is the source of truth.
 */
const ENTRY_LIFECYCLES: Map<SourceId, SourceLifecycle> = new Map();

/**
 * Read an entry's current lifecycle. Returns the in-memory overlay if set;
 * otherwise falls back to `SOURCES[id].lifecycle`. Returns null if the entry
 * is unknown.
 */
export function getEntryLifecycle(id: SourceId): SourceLifecycle | null {
	const overlay = ENTRY_LIFECYCLES.get(id);
	if (overlay !== undefined) return overlay;
	const entry = getSources()[id];
	return entry?.lifecycle ?? null;
}

// ---------------------------------------------------------------------------
// Promotion / de-promotion
// ---------------------------------------------------------------------------

/**
 * Atomic batch promotion. Validates every entry's transition before mutating
 * any. Either all `scope` entries transition to `targetLifecycle` or none do.
 *
 * Persistence: opens a Drizzle transaction, inserts one `promotion_batches`
 * row, and only mutates the in-memory overlay after the transaction commits.
 * On any DB error the overlay is untouched.
 */
export async function recordPromotion(input: PromotionInput): Promise<PromotionResult> {
	const validation = validatePromotionInput(input);
	if (!validation.ok) return validation;

	const batch: PromotionBatch = {
		id: createId('batch'),
		corpus: input.corpus,
		reviewerId: input.reviewerId,
		promotionDate: new Date(),
		scope: [...input.scope],
		inputSource: input.inputSource,
		state: PROMOTION_STATES.PROMOTED,
		fromLifecycle: validation.fromLifecycle,
		toLifecycle: input.targetLifecycle,
	};

	try {
		await db.transaction(async (tx) => {
			await tx.insert(promotionBatches).values(toRow(batch));
		});
	} catch (err) {
		return { ok: false, error: errorMessage(err) };
	}

	// Commit succeeded; mutate overlay + bump generation. Order matters:
	// overlay first so any concurrent reader sees the new state before the
	// generation bump invalidates derived caches.
	for (const id of input.scope) {
		ENTRY_LIFECYCLES.set(id, input.targetLifecycle);
	}
	__editions_internal__.bumpGeneration();
	return { ok: true, batch };
}

/**
 * De-promotion: walks `accepted` entries back to `pending` (or `retired`).
 * Records `previousBatchId` so the audit trail links the events. Atomic at
 * the batch level. The FK on `previous_batch_id -> id` enforces existence
 * of the referenced batch at the DB level; mid-transaction failure rolls
 * back the audit row and leaves the overlay untouched.
 */
export async function recordDePromotion(input: DePromotionInput): Promise<PromotionResult> {
	if (input.scope.length === 0) {
		return { ok: false, error: 'empty scope: de-promotion requires at least one entry' };
	}

	if (input.targetLifecycle === 'draft') {
		return { ok: false, error: 'cannot transition to "draft"; draft is a starting state only' };
	}

	const transitionCheck = validateScopeTransitions(input.scope, input.targetLifecycle);
	if (!transitionCheck.ok) return transitionCheck;

	const batch: PromotionBatch = {
		id: createId('batch'),
		corpus: input.corpus,
		reviewerId: input.reviewerId,
		promotionDate: new Date(),
		scope: [...input.scope],
		inputSource: input.inputSource,
		state: PROMOTION_STATES.DE_PROMOTED,
		fromLifecycle: transitionCheck.fromLifecycle,
		toLifecycle: input.targetLifecycle,
		previousBatchId: input.previousBatchId,
	};

	try {
		await db.transaction(async (tx) => {
			await tx.insert(promotionBatches).values(toRow(batch));
		});
	} catch (err) {
		return { ok: false, error: errorMessage(err) };
	}

	for (const id of input.scope) {
		ENTRY_LIFECYCLES.set(id, input.targetLifecycle);
	}
	__editions_internal__.bumpGeneration();
	return { ok: true, batch };
}

// ---------------------------------------------------------------------------
// Bootstrap rebuild
// ---------------------------------------------------------------------------

/**
 * Replay every persisted batch into the overlay map so a freshly-loaded
 * process sees the same lifecycle state the prior process committed.
 *
 * Read order: `promotion_date ASC`. Each batch's `toLifecycle` overwrites
 * the prior overlay entry for every id in its scope; the final pass
 * therefore reflects the most-recent state per id.
 */
export async function rebuildLifecycleOverlay(): Promise<void> {
	const rows = await db.select().from(promotionBatches).orderBy(asc(promotionBatches.promotionDate));
	ENTRY_LIFECYCLES.clear();
	for (const row of rows) {
		const targetLifecycle = row.toLifecycle as SourceLifecycle;
		const scope = row.scope as readonly string[];
		for (const id of scope) {
			ENTRY_LIFECYCLES.set(id as SourceId, targetLifecycle);
		}
	}
}

// ---------------------------------------------------------------------------
// Atomic ingest batch commit (ADR 019 §2.4)
// ---------------------------------------------------------------------------

export interface IngestBatchInput {
	readonly corpus: string;
	readonly reviewerId: string;
	readonly inputSource: string;
	readonly targetLifecycle: SourceLifecycle;
	/** Entries to insert / overwrite in the SOURCES table. */
	readonly sources: Record<SourceId, SourceEntry>;
	/** Edition rows to merge into the EDITIONS map. */
	readonly editions: ReadonlyMap<SourceId, readonly Edition[]>;
	/**
	 * The subset of `sources` keys whose lifecycle should transition to
	 * `targetLifecycle`. Empty array means "no promotion to record" -- the
	 * caller may still want to upsert sources/editions without recording a
	 * batch (e.g., the entry is already-accepted and is being re-emitted
	 * idempotently).
	 */
	readonly scope: readonly SourceId[];
}

export type IngestBatchResult =
	| { readonly ok: true; readonly batchId: string | null }
	| { readonly ok: false; readonly error: string };

/**
 * Atomic batch commit per ADR 019 §2.4. Validates the proposed promotion
 * BEFORE mutating any registry table; on validation failure, no SOURCES,
 * EDITIONS, or lifecycle state is changed. On lifecycle-mutation failure
 * the SOURCES/EDITIONS overlays are rolled back to their pre-call values.
 *
 * This is the only correct way for an ingest pipeline to record SOURCES +
 * EDITIONS + lifecycle changes together. Direct calls to
 * `__sources_internal__.setActiveTable` followed by `recordPromotion` are
 * non-atomic; mid-batch lifecycle failures leave the registry tables ahead
 * of the lifecycle state.
 *
 * Returns the new batch ID on success, or `null` if `scope` was empty
 * (caller upserted entries without recording a promotion -- typically the
 * already-accepted idempotent path).
 */
export async function commitIngestBatch(input: IngestBatchInput): Promise<IngestBatchResult> {
	if (input.targetLifecycle === 'draft') {
		return { ok: false, error: 'cannot transition to "draft"; draft is a starting state only' };
	}

	// Phase 1: validate scope BEFORE any mutation.
	if (input.scope.length > 0) {
		const proposedSources: Record<SourceId, SourceEntry> = {
			...__sources_internal__.getActiveTable(),
			...input.sources,
		};
		let fromLifecycle: SourceLifecycle | null = null;
		for (const id of input.scope) {
			const overlay = ENTRY_LIFECYCLES.get(id);
			const proposed = proposedSources[id];
			if (overlay === undefined && proposed === undefined) {
				return { ok: false, error: `entry "${id}" is not in the registry` };
			}
			const current = overlay ?? proposed?.lifecycle;
			if (current === undefined) {
				return { ok: false, error: `entry "${id}" has no lifecycle to transition from` };
			}
			if (!isValidTransition(current, input.targetLifecycle)) {
				return {
					ok: false,
					error: `entry "${id}" cannot transition from "${current}" to "${input.targetLifecycle}"`,
				};
			}
			if (fromLifecycle === null) {
				fromLifecycle = current;
			} else if (fromLifecycle !== current) {
				return {
					ok: false,
					error: `batch contains entries in mixed lifecycles ("${fromLifecycle}" and "${current}"); promote homogeneous batches only`,
				};
			}
		}
	}

	// Phase 2: snapshot prior state for rollback, then apply SOURCES/EDITIONS.
	const priorSources = __sources_internal__.getActiveTable();
	const priorEditions = __editions_internal__.getActiveTable();
	const nextSources: Record<SourceId, SourceEntry> = { ...priorSources, ...input.sources };
	const nextEditions = new Map(priorEditions);
	for (const [id, incoming] of input.editions) {
		const existing = nextEditions.get(id) ?? [];
		const merged: Edition[] = [...existing];
		for (const edition of incoming) {
			if (!merged.some((e) => e.id === edition.id)) {
				merged.push(edition);
			}
		}
		nextEditions.set(id, merged);
	}
	__sources_internal__.setActiveTable(nextSources);
	__editions_internal__.setActiveTable(nextEditions);

	// Phase 3: record the promotion (or skip if scope is empty).
	if (input.scope.length === 0) {
		return { ok: true, batchId: null };
	}

	const promotion = await recordPromotion({
		corpus: input.corpus,
		reviewerId: input.reviewerId,
		scope: input.scope,
		inputSource: input.inputSource,
		targetLifecycle: input.targetLifecycle,
	});
	if (!promotion.ok) {
		__sources_internal__.setActiveTable(priorSources);
		__editions_internal__.setActiveTable(priorEditions);
		return { ok: false, error: promotion.error };
	}

	return { ok: true, batchId: promotion.batch.id };
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/**
 * Look up a batch by its ID from the persisted audit trail. Returns null
 * when no matching row exists. The `promotion_batches` table is
 * append-only so a single-row read by primary key is the canonical access
 * pattern.
 */
export async function getBatch(id: string): Promise<PromotionBatch | null> {
	const rows = await db.select().from(promotionBatches).where(eq(promotionBatches.id, id)).limit(1);
	const row = rows[0];
	return row === undefined ? null : rowToBatch(row);
}

/**
 * All batches in chronological order (oldest first). Walks the persisted
 * audit trail.
 */
export async function listBatches(): Promise<readonly PromotionBatch[]> {
	const rows = await db.select().from(promotionBatches).orderBy(asc(promotionBatches.promotionDate));
	return rows.map(rowToBatch);
}

// ---------------------------------------------------------------------------
// Test-only reset
// ---------------------------------------------------------------------------

export const __lifecycle_internal__ = {
	reset(): void {
		ENTRY_LIFECYCLES.clear();
	},
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function validatePromotionInput(
	input: PromotionInput,
): { readonly ok: true; readonly fromLifecycle: SourceLifecycle } | { readonly ok: false; readonly error: string } {
	if (input.scope.length === 0) {
		return { ok: false, error: 'empty scope: promotion requires at least one entry' };
	}
	if (input.targetLifecycle === 'draft') {
		return { ok: false, error: 'cannot transition to "draft"; draft is a starting state only' };
	}
	return validateScopeTransitions(input.scope, input.targetLifecycle);
}

function validateScopeTransitions(
	scope: readonly SourceId[],
	target: SourceLifecycle,
): { readonly ok: true; readonly fromLifecycle: SourceLifecycle } | { readonly ok: false; readonly error: string } {
	let fromLifecycle: SourceLifecycle | null = null;
	for (const id of scope) {
		const current = getEntryLifecycle(id);
		if (current === null) {
			return { ok: false, error: `entry "${id}" is not in the registry` };
		}
		if (!isValidTransition(current, target)) {
			return {
				ok: false,
				error: `entry "${id}" cannot transition from "${current}" to "${target}"`,
			};
		}
		if (fromLifecycle === null) {
			fromLifecycle = current;
		} else if (fromLifecycle !== current) {
			return {
				ok: false,
				error: `batch contains entries in mixed lifecycles ("${fromLifecycle}" and "${current}"); promote homogeneous batches only`,
			};
		}
	}
	if (fromLifecycle === null) {
		return { ok: false, error: 'unable to determine source lifecycle' };
	}
	return { ok: true, fromLifecycle };
}

function toRow(batch: PromotionBatch): typeof promotionBatches.$inferInsert {
	return {
		id: batch.id,
		corpus: batch.corpus,
		reviewerId: batch.reviewerId,
		promotionDate: batch.promotionDate,
		scope: [...batch.scope] as readonly string[],
		inputSource: batch.inputSource,
		state: batch.state,
		fromLifecycle: batch.fromLifecycle,
		toLifecycle: batch.toLifecycle,
		previousBatchId: batch.previousBatchId ?? null,
	};
}

function rowToBatch(row: PromotionBatchRow): PromotionBatch {
	const base: {
		readonly id: string;
		readonly corpus: string;
		readonly reviewerId: string;
		readonly promotionDate: Date;
		readonly scope: readonly SourceId[];
		readonly inputSource: string;
		readonly state: PromotionState;
		readonly fromLifecycle: SourceLifecycle;
		readonly toLifecycle: SourceLifecycle;
	} = {
		id: row.id,
		corpus: row.corpus,
		reviewerId: row.reviewerId,
		promotionDate: row.promotionDate,
		scope: row.scope.map((s) => s as SourceId),
		inputSource: row.inputSource,
		state: row.state as PromotionState,
		fromLifecycle: row.fromLifecycle as SourceLifecycle,
		toLifecycle: row.toLifecycle as SourceLifecycle,
	};
	if (row.previousBatchId !== null) {
		return { ...base, previousBatchId: row.previousBatchId };
	}
	return base;
}

function errorMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	return String(err);
}
