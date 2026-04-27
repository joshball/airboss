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
import type { SourceId, SourceLifecycle } from '../types.ts';
import { getSources } from './sources.ts';

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
