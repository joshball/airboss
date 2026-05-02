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

import { createId } from '@ab/utils';
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

const BATCHES: Map<string, PromotionBatch> = new Map();
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
 */
export function recordPromotion(input: PromotionInput): PromotionResult {
	if (input.scope.length === 0) {
		return { ok: false, error: 'empty scope: promotion requires at least one entry' };
	}

	if (input.targetLifecycle === 'draft') {
		return { ok: false, error: 'cannot transition to "draft"; draft is a starting state only' };
	}

	let fromLifecycle: SourceLifecycle | null = null;
	for (const id of input.scope) {
		const current = getEntryLifecycle(id);
		if (current === null) {
			return { ok: false, error: `entry "${id}" is not in the registry` };
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

	if (fromLifecycle === null) {
		// Defensive; we already checked scope.length > 0.
		return { ok: false, error: 'unable to determine source lifecycle' };
	}

	// All entries validate. Mutate.
	const batch: PromotionBatch = {
		id: createId('batch'),
		corpus: input.corpus,
		reviewerId: input.reviewerId,
		promotionDate: new Date(),
		scope: [...input.scope],
		inputSource: input.inputSource,
		state: 'promoted',
		fromLifecycle,
		toLifecycle: input.targetLifecycle,
	};

	for (const id of input.scope) {
		ENTRY_LIFECYCLES.set(id, input.targetLifecycle);
	}
	BATCHES.set(batch.id, batch);

	return { ok: true, batch };
}

/**
 * De-promotion: walks `accepted` entries back to `pending` (or `retired`).
 * Records `previousBatchId` so the audit trail links the events. Atomic at
 * the batch level.
 */
export function recordDePromotion(input: DePromotionInput): PromotionResult {
	if (input.scope.length === 0) {
		return { ok: false, error: 'empty scope: de-promotion requires at least one entry' };
	}

	if (!BATCHES.has(input.previousBatchId)) {
		return { ok: false, error: `previous batch "${input.previousBatchId}" not found` };
	}

	if (input.targetLifecycle === 'draft') {
		return { ok: false, error: 'cannot transition to "draft"; draft is a starting state only' };
	}

	let fromLifecycle: SourceLifecycle | null = null;
	for (const id of input.scope) {
		const current = getEntryLifecycle(id);
		if (current === null) {
			return { ok: false, error: `entry "${id}" is not in the registry` };
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
				error: `batch contains entries in mixed lifecycles ("${fromLifecycle}" and "${current}")`,
			};
		}
	}

	if (fromLifecycle === null) {
		return { ok: false, error: 'unable to determine source lifecycle' };
	}

	const batch: PromotionBatch = {
		id: createId('batch'),
		corpus: input.corpus,
		reviewerId: input.reviewerId,
		promotionDate: new Date(),
		scope: [...input.scope],
		inputSource: input.inputSource,
		state: 'de-promoted',
		fromLifecycle,
		toLifecycle: input.targetLifecycle,
		previousBatchId: input.previousBatchId,
	};

	for (const id of input.scope) {
		ENTRY_LIFECYCLES.set(id, input.targetLifecycle);
	}
	BATCHES.set(batch.id, batch);

	return { ok: true, batch };
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
 * (impossible given the pre-validation, but kept defensive), the
 * SOURCES/EDITIONS overlays are rolled back to their pre-call values.
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
export function commitIngestBatch(input: IngestBatchInput): IngestBatchResult {
	if (input.targetLifecycle === 'draft') {
		return { ok: false, error: 'cannot transition to "draft"; draft is a starting state only' };
	}

	// Phase 1: validate scope BEFORE any mutation.
	if (input.scope.length > 0) {
		// The proposed source table is the union of (current sources + new sources).
		// We need to validate that every scope id resolves -- either via the
		// in-flight sourcesPatch or via the existing active table.
		const proposedSources: Record<SourceId, SourceEntry> = {
			...__sources_internal__.getActiveTable(),
			...input.sources,
		};
		let fromLifecycle: SourceLifecycle | null = null;
		for (const id of input.scope) {
			// Lifecycle: prefer the in-memory overlay, then the proposed entry's
			// lifecycle (which is what the entry will be after the mutation).
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
	// Editions for each id are merged (de-duplicated by edition id) so callers
	// can pass only the in-flight additions without having to seed their
	// accumulator from the active map.
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

	const promotion = recordPromotion({
		corpus: input.corpus,
		reviewerId: input.reviewerId,
		scope: input.scope,
		inputSource: input.inputSource,
		targetLifecycle: input.targetLifecycle,
	});
	if (!promotion.ok) {
		// Rollback the SOURCES/EDITIONS mutations -- the promotion failed, so
		// the registry must end the call exactly as it began.
		__sources_internal__.setActiveTable(priorSources);
		__editions_internal__.setActiveTable(priorEditions);
		return { ok: false, error: promotion.error };
	}

	return { ok: true, batchId: promotion.batch.id };
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/** Look up a batch by its ID. */
export function getBatch(id: string): PromotionBatch | null {
	return BATCHES.get(id) ?? null;
}

/** All batches in chronological insertion order. */
export function listBatches(): readonly PromotionBatch[] {
	return Array.from(BATCHES.values());
}

// ---------------------------------------------------------------------------
// Test-only reset
// ---------------------------------------------------------------------------

export const __lifecycle_internal__ = {
	reset(): void {
		BATCHES.clear();
		ENTRY_LIFECYCLES.clear();
	},
};
