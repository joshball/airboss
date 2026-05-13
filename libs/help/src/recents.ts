/**
 * Palette recents tracker (Phase 5).
 *
 * `localStorage`-backed singleton that records every palette activation
 * (Enter on a row, click on a row) so the Cmd+P quick-open mode can show
 * "things the user actually uses" when the input is empty.
 *
 * Browser-only by construction: the singleton is lazy (read on first
 * call, not at module load) so SSR-loaded `@ab/help` consumers don't
 * trip a `ReferenceError`. When `localStorage` is absent (SSR, private
 * mode, embedded contexts), the tracker falls back to an in-memory list
 * scoped to the lifetime of the singleton. Recents that land in the
 * fallback are lost on reload; that's the correct degradation -- the
 * recents shouldn't be a feature gate, just a convenience layer.
 *
 * Ranking: `hits * recencyFactor(openedAt)`. A recent + frequent entry
 * floats top. Buckets in `PALETTE_RECENTS_DECAY` (see `@ab/constants`).
 *
 * Source: `docs/work-packages/command-palette/design.md` ("Recents
 * (Phase 5)") and `docs/work-packages/command-palette/spec.md` (mode
 * contract -- `quickopen` filters to recents-eligible result types).
 */

import {
	PALETTE_RECENTS_DECAY,
	PALETTE_RECENTS_DEFAULT_LIMIT,
	PALETTE_RECENTS_MAX,
	PALETTE_RECENTS_STORAGE_KEY,
} from '@ab/constants';
import type { SearchResultType } from './schema/result-types';

/** Snapshot of one prior palette activation. */
export interface RecentEntry {
	readonly resultId: string;
	readonly type: SearchResultType;
	readonly title: string;
	readonly href: string;
	/** Epoch ms of the most recent activation. */
	readonly openedAt: number;
	/** Accumulated open count across all sessions. */
	readonly hits: number;
}

/** Minimum shape `record()` accepts (the relevant slice of `SearchResult`). */
export interface RecentRecordInput {
	readonly id: string;
	readonly type: SearchResultType;
	readonly title: string;
	readonly href: string;
}

/** Public recents API. The singleton instance lives at `recents` below. */
export interface RecentsTracker {
	/**
	 * Record an activation. If `resultId` already exists, bumps `hits`
	 * and updates `openedAt`; otherwise pushes a new entry. When the
	 * cap is exceeded, drops the entry with the oldest `openedAt`.
	 */
	record(result: RecentRecordInput): void;
	/**
	 * List entries by recency-weighted score (descending). Sorts
	 * `hits * recencyFactor(openedAt)`. Default `limit` is
	 * `PALETTE_RECENTS_DEFAULT_LIMIT`.
	 */
	list(limit?: number): readonly RecentEntry[];
	/** Wipe both localStorage + in-memory cache. */
	clear(): void;
}

/**
 * Time-bucket decay factor for the openedAt timestamp. Pure function;
 * mirrors the constants table in `@ab/constants`.
 */
export function recencyFactor(openedAt: number, now: number = Date.now()): number {
	const ageMs = Math.max(0, now - openedAt);
	const ageDays = ageMs / PALETTE_RECENTS_DECAY.MS_PER_DAY;
	if (ageDays < PALETTE_RECENTS_DECAY.DAY_THRESHOLD) return PALETTE_RECENTS_DECAY.WEIGHT_DAY;
	if (ageDays < PALETTE_RECENTS_DECAY.WEEK_THRESHOLD) return PALETTE_RECENTS_DECAY.WEIGHT_WEEK;
	if (ageDays < PALETTE_RECENTS_DECAY.MONTH_THRESHOLD) return PALETTE_RECENTS_DECAY.WEIGHT_MONTH;
	return PALETTE_RECENTS_DECAY.WEIGHT_OLDER;
}

/**
 * Sort comparator used by `list()`. Higher score wins; ties broken by
 * most-recent `openedAt`, then by title for stability.
 */
function compareEntries(a: RecentEntry, b: RecentEntry, now: number): number {
	const aScore = a.hits * recencyFactor(a.openedAt, now);
	const bScore = b.hits * recencyFactor(b.openedAt, now);
	if (aScore !== bScore) return bScore - aScore;
	if (a.openedAt !== b.openedAt) return b.openedAt - a.openedAt;
	return a.title.localeCompare(b.title);
}

/** Detect whether `localStorage` is usable in the current context. */
function hasLocalStorage(): boolean {
	if (typeof globalThis === 'undefined') return false;
	const ls = (globalThis as { localStorage?: Storage }).localStorage;
	if (!ls) return false;
	try {
		// Touch the API surface -- some embedded contexts throw on access.
		const probeKey = `${PALETTE_RECENTS_STORAGE_KEY}.__probe__`;
		ls.setItem(probeKey, '1');
		ls.removeItem(probeKey);
		return true;
	} catch {
		return false;
	}
}

/**
 * Parse a stored payload. Defensive: any structural issue (bad JSON,
 * wrong field types, non-array root) yields an empty list rather than
 * surfacing the error to callers. The version is baked into the
 * storage key so we never need to migrate in place.
 */
function parsePayload(raw: string | null): RecentEntry[] {
	if (!raw) return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return [];
	}
	if (!Array.isArray(parsed)) return [];
	const out: RecentEntry[] = [];
	for (const item of parsed) {
		if (typeof item !== 'object' || item === null) continue;
		const candidate = item as Record<string, unknown>;
		const resultId = candidate.resultId;
		const type = candidate.type;
		const title = candidate.title;
		const href = candidate.href;
		const openedAt = candidate.openedAt;
		const hits = candidate.hits;
		if (typeof resultId !== 'string' || resultId.length === 0) continue;
		if (typeof type !== 'string' || type.length === 0) continue;
		if (typeof title !== 'string') continue;
		if (typeof href !== 'string') continue;
		if (typeof openedAt !== 'number' || !Number.isFinite(openedAt)) continue;
		if (typeof hits !== 'number' || !Number.isFinite(hits)) continue;
		out.push({
			resultId,
			type: type as SearchResultType,
			title,
			href,
			openedAt,
			hits,
		});
	}
	return out;
}

/**
 * Internal mutable state. Lazy-loaded on first call so SSR consumers
 * that touch `@ab/help` (via the runtime barrel) don't trip a
 * `localStorage is not defined` error.
 */
interface State {
	entries: RecentEntry[];
	loaded: boolean;
	persistent: boolean;
}

function createState(): State {
	return { entries: [], loaded: false, persistent: false };
}

const state: State = createState();

function ensureLoaded(): void {
	if (state.loaded) return;
	state.persistent = hasLocalStorage();
	if (state.persistent) {
		try {
			const raw = globalThis.localStorage.getItem(PALETTE_RECENTS_STORAGE_KEY);
			state.entries = parsePayload(raw);
		} catch {
			state.entries = [];
		}
	} else {
		state.entries = [];
	}
	state.loaded = true;
}

function persist(): void {
	if (!state.persistent) return;
	try {
		globalThis.localStorage.setItem(PALETTE_RECENTS_STORAGE_KEY, JSON.stringify(state.entries));
	} catch {
		// quota exceeded / disabled mid-session: leave in-memory state intact.
	}
}

function recordInternal(input: RecentRecordInput, now: number = Date.now()): void {
	ensureLoaded();
	const idx = state.entries.findIndex((e) => e.resultId === input.id);
	if (idx >= 0) {
		const existing = state.entries[idx];
		if (!existing) return;
		const updated: RecentEntry = {
			resultId: existing.resultId,
			type: input.type,
			title: input.title,
			href: input.href,
			openedAt: now,
			hits: existing.hits + 1,
		};
		state.entries[idx] = updated;
	} else {
		const entry: RecentEntry = {
			resultId: input.id,
			type: input.type,
			title: input.title,
			href: input.href,
			openedAt: now,
			hits: 1,
		};
		state.entries.push(entry);
	}
	// Trim oldest if we're over the cap. Sort by openedAt asc, drop head.
	if (state.entries.length > PALETTE_RECENTS_MAX) {
		state.entries.sort((a, b) => a.openedAt - b.openedAt);
		state.entries.splice(0, state.entries.length - PALETTE_RECENTS_MAX);
	}
	persist();
}

function listInternal(limit: number, now: number = Date.now()): readonly RecentEntry[] {
	ensureLoaded();
	const sorted = [...state.entries].sort((a, b) => compareEntries(a, b, now));
	return sorted.slice(0, Math.max(0, limit));
}

function clearInternal(): void {
	state.entries = [];
	if (state.persistent) {
		try {
			globalThis.localStorage.removeItem(PALETTE_RECENTS_STORAGE_KEY);
		} catch {
			// non-fatal -- in-memory state is already wiped.
		}
	}
	// Keep `loaded` true: subsequent calls should NOT re-read from
	// localStorage (we just cleared it).
	state.loaded = true;
}

export const recents: RecentsTracker = {
	record(result: RecentRecordInput): void {
		recordInternal(result);
	},
	list(limit: number = PALETTE_RECENTS_DEFAULT_LIMIT): readonly RecentEntry[] {
		return listInternal(limit);
	},
	clear(): void {
		clearInternal();
	},
};

/**
 * Test-only reset hook. Production callers MUST NOT use this; it
 * exists so vitest can rebuild the singleton between specs.
 */
export function __resetRecentsForTests(): void {
	state.entries = [];
	state.loaded = false;
	state.persistent = false;
}

/**
 * Test-only override for the timestamp source. `record()` and `list()`
 * always read `Date.now()` at call time, but tests need deterministic
 * timestamps for the bucket / decay assertions. Pass a function or
 * `null` to reset to the default.
 */
export function recordWithTimestamp(input: RecentRecordInput, now: number): void {
	recordInternal(input, now);
}

export function listWithTimestamp(limit: number, now: number): readonly RecentEntry[] {
	return listInternal(limit, now);
}
