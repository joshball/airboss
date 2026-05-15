/**
 * Shared shapes for the wx-practice mastery dashboard (server load output +
 * client-side helpers). Browser-safe -- this file imports only types and
 * never reaches `node:*`.
 */
import type { WxPracticeMasteryRow } from '@ab/bc-wx-practice';
import {
	WX_PRACTICE_MASTERY_STATE_VALUES,
	WX_PRACTICE_MASTERY_STATES,
	WX_PRODUCTS,
	type WxPracticeMasteryState,
	type WxProduct,
} from '@ab/constants';

/**
 * Narrow the BC's `string` state column to the typed union. Defaults to
 * `active` for any unrecognized value so a corrupt row never poisons the
 * dashboard.
 */
function narrowState(raw: string): WxPracticeMasteryState {
	return (WX_PRACTICE_MASTERY_STATE_VALUES as readonly string[]).includes(raw)
		? (raw as WxPracticeMasteryState)
		: WX_PRACTICE_MASTERY_STATES.ACTIVE;
}

/**
 * Display state used by the dashboard. Adds `never-seen` to the canonical
 * three-state contract -- never-seen rows have no mastery row yet, so the
 * BC's state enum cannot represent them. The dashboard composes the union.
 */
export type WxMasteryDisplayState = WxPracticeMasteryState | 'never-seen';

/** All sort keys exposed via `?sort=`. */
export const WX_MASTERY_SORT_KEYS = ['attempts', 'ratio', 'last-seen', 'label'] as const;
export type WxMasterySortKey = (typeof WX_MASTERY_SORT_KEYS)[number];
export const DEFAULT_WX_MASTERY_SORT: WxMasterySortKey = 'attempts';

/** All product values exposed via `?product=`. */
export const WX_MASTERY_PRODUCTS = [
	WX_PRODUCTS.METAR,
	WX_PRODUCTS.TAF,
	WX_PRODUCTS.PIREP,
	WX_PRODUCTS.FB,
	WX_PRODUCTS.AIRMET,
] as const satisfies ReadonlyArray<WxProduct>;
export const DEFAULT_WX_MASTERY_PRODUCT: WxProduct = WX_PRODUCTS.METAR;

/** All state filter values exposed via `?state=`. */
export const WX_MASTERY_STATE_FILTERS = [
	WX_PRACTICE_MASTERY_STATES.ACTIVE,
	WX_PRACTICE_MASTERY_STATES.PASSIVE,
	WX_PRACTICE_MASTERY_STATES.DEMOTED,
	'never-seen',
] as const satisfies ReadonlyArray<WxMasteryDisplayState>;

/**
 * One row in the rendered grid. Composed server-side from `(catalog family,
 * mastery row?)` so the client never has to do the join.
 */
export interface WxMasteryDisplayRow {
	readonly product: WxProduct;
	readonly family: string;
	readonly label: string;
	readonly attempts: number;
	readonly correct: number;
	/** `correct / attempts`, clamped to `[0, 1]`. `null` when `attempts === 0`. */
	readonly ratio: number | null;
	readonly state: WxMasteryDisplayState;
	readonly lastSeenAt: string | null;
}

/** Per-product nav tab summary. */
export interface WxMasteryProductTab {
	readonly product: WxProduct;
	readonly label: string;
	readonly familyCount: number;
	readonly attemptedCount: number;
}

/** Summary counts the page renders above the grid. */
export interface WxMasterySummary {
	readonly totalFamilies: number;
	readonly attemptedFamilies: number;
	readonly activeCount: number;
	readonly passiveCount: number;
	readonly demotedCount: number;
	readonly neverSeenCount: number;
}

/**
 * Server -> client data shape for the mastery page. Filters are resolved
 * server-side so the URL is the single source of truth.
 */
export interface WxMasteryPageData {
	readonly product: WxProduct;
	readonly stateFilters: ReadonlyArray<WxMasteryDisplayState>;
	readonly sort: WxMasterySortKey;
	readonly rows: ReadonlyArray<WxMasteryDisplayRow>;
	readonly weakFamilies: ReadonlyArray<string>;
	readonly summary: WxMasterySummary;
	readonly tabs: ReadonlyArray<WxMasteryProductTab>;
}

/** Human-friendly product label. */
export function productLabel(p: WxProduct): string {
	switch (p) {
		case 'metar':
			return 'METAR';
		case 'taf':
			return 'TAF';
		case 'pirep':
			return 'PIREP';
		case 'fb':
			return 'FB';
		case 'airmet':
			return 'AIRMET / SIGMET';
	}
}

/** Human-friendly state label. */
export function stateLabel(s: WxMasteryDisplayState): string {
	switch (s) {
		case 'active':
			return 'Active';
		case 'passive':
			return 'Passive';
		case 'demoted':
			return 'Demoted';
		case 'never-seen':
			return 'Never seen';
	}
}

/** Parse the `?product=` query param. Unknown values fall back to the default. */
export function parseProductParam(value: string | null): WxProduct {
	if (value === null) return DEFAULT_WX_MASTERY_PRODUCT;
	const matched = WX_MASTERY_PRODUCTS.find((p) => p === value.toLowerCase());
	return matched ?? DEFAULT_WX_MASTERY_PRODUCT;
}

/** Parse the comma-separated `?state=` query param. */
export function parseStateParam(value: string | null): ReadonlyArray<WxMasteryDisplayState> {
	if (value === null || value.trim() === '') return WX_MASTERY_STATE_FILTERS;
	const wanted = new Set(
		value
			.split(',')
			.map((s) => s.trim().toLowerCase())
			.filter((s) => s.length > 0),
	);
	const out = WX_MASTERY_STATE_FILTERS.filter((s) => wanted.has(s));
	// Empty intersection means the user explicitly asked for "nothing" --
	// preserve that signal rather than defaulting back to "everything."
	// Returning an empty array makes the empty state surface naturally.
	return out;
}

/** Parse the `?sort=` query param. */
export function parseSortParam(value: string | null): WxMasterySortKey {
	if (value === null) return DEFAULT_WX_MASTERY_SORT;
	const matched = WX_MASTERY_SORT_KEYS.find((k) => k === value.toLowerCase());
	return matched ?? DEFAULT_WX_MASTERY_SORT;
}

/**
 * Compose `(catalog family, mastery row?)` pairs into rendered grid rows.
 * Catalog families with no mastery row become `never-seen`.
 */
export function composeDisplayRows(
	catalog: ReadonlyArray<{ readonly slug: string; readonly label: string }>,
	mastery: ReadonlyArray<WxPracticeMasteryRow>,
	product: WxProduct,
): ReadonlyArray<WxMasteryDisplayRow> {
	const masteryByFamily = new Map<string, WxPracticeMasteryRow>();
	for (const row of mastery) {
		// Sub-families collapse to the parent family for display -- the
		// dashboard shows one row per family. If multiple sub-family rows
		// exist for a family, keep the one with the most attempts.
		const existing = masteryByFamily.get(row.family);
		if (!existing || row.attempts > existing.attempts) {
			masteryByFamily.set(row.family, row);
		}
	}
	return catalog.map((fam) => {
		const row = masteryByFamily.get(fam.slug);
		if (!row) {
			return {
				product,
				family: fam.slug,
				label: fam.label,
				attempts: 0,
				correct: 0,
				ratio: null,
				state: 'never-seen' as const,
				lastSeenAt: null,
			};
		}
		const ratio = row.attempts > 0 ? Math.min(1, Math.max(0, row.correct / row.attempts)) : null;
		return {
			product,
			family: fam.slug,
			label: fam.label,
			attempts: row.attempts,
			correct: row.correct,
			ratio,
			state: narrowState(row.state),
			lastSeenAt: row.lastSeenAt === null ? null : row.lastSeenAt.toISOString(),
		};
	});
}

/**
 * Compare two rows by the active sort key. Extracted so the `Array.sort`
 * callback always returns a value on every branch (Biome's
 * `useCallbackReturn`).
 */
function compareRows(a: WxMasteryDisplayRow, b: WxMasteryDisplayRow, sort: WxMasterySortKey): number {
	switch (sort) {
		case 'attempts':
			// Descending. Never-seen rows (attempts === 0) drop to the
			// bottom, which matches the dashboard's "what have I done"
			// reading order.
			if (b.attempts !== a.attempts) return b.attempts - a.attempts;
			return a.label.localeCompare(b.label);
		case 'ratio': {
			// Ascending on ratio (lowest first = "what am I struggling
			// with"). Never-seen rows have no ratio -- park them at the
			// end. Identical ratios fall through to label.
			const aRatio = a.ratio ?? Number.POSITIVE_INFINITY;
			const bRatio = b.ratio ?? Number.POSITIVE_INFINITY;
			if (aRatio !== bRatio) return aRatio - bRatio;
			return a.label.localeCompare(b.label);
		}
		case 'last-seen': {
			// Descending on last-seen. Never-seen / null rows go last.
			const aTs = a.lastSeenAt === null ? 0 : Date.parse(a.lastSeenAt);
			const bTs = b.lastSeenAt === null ? 0 : Date.parse(b.lastSeenAt);
			if (bTs !== aTs) return bTs - aTs;
			return a.label.localeCompare(b.label);
		}
		case 'label':
			return a.label.localeCompare(b.label);
	}
}

/**
 * Sort a row list in-place-safe (returns a new array). Stable on label as
 * the tiebreaker so the grid renders deterministically across reloads.
 */
export function sortRows(
	rows: ReadonlyArray<WxMasteryDisplayRow>,
	sort: WxMasterySortKey,
): ReadonlyArray<WxMasteryDisplayRow> {
	const copy = rows.slice();
	copy.sort((a, b) => compareRows(a, b, sort));
	return copy;
}

/** Filter rows by state. An empty filter keeps zero rows (explicit choice). */
export function filterRowsByState(
	rows: ReadonlyArray<WxMasteryDisplayRow>,
	states: ReadonlyArray<WxMasteryDisplayState>,
): ReadonlyArray<WxMasteryDisplayRow> {
	if (states.length === 0) return [];
	const set = new Set(states);
	return rows.filter((r) => set.has(r.state));
}

/**
 * Pick the families a "drill my weak families" button should oversample.
 *
 * Rule: active + demoted rows with the lowest non-null ratio. Cap at six so
 * the drill URL stays under 2 KB. Returns family slugs in worst-first order.
 */
export function pickWeakFamilies(rows: ReadonlyArray<WxMasteryDisplayRow>, max: number = 6): ReadonlyArray<string> {
	const eligible = rows
		.filter((r) => (r.state === 'active' || r.state === 'demoted') && r.ratio !== null && r.attempts > 0)
		.slice()
		.sort((a, b) => {
			const aRatio = a.ratio ?? 1;
			const bRatio = b.ratio ?? 1;
			if (aRatio !== bRatio) return aRatio - bRatio;
			// Tiebreaker: more attempts = stronger signal of weakness.
			return b.attempts - a.attempts;
		})
		.slice(0, max);
	return eligible.map((r) => r.family);
}

/**
 * Build a relative-time label from an ISO timestamp.
 *
 * Pure, deterministic given `(value, now)` so it's testable without faking
 * Date. Returns "never" for null inputs, "just now" for sub-minute deltas,
 * "Nm ago" / "Nh ago" / "yesterday" / "Nd ago" / "Nw ago" / a date string
 * for older values.
 */
export function relativeLastSeen(value: string | null, now: Date = new Date()): string {
	if (value === null) return 'never';
	const ts = Date.parse(value);
	if (Number.isNaN(ts)) return 'never';
	const deltaMs = now.getTime() - ts;
	const minute = 60 * 1000;
	const hour = 60 * minute;
	const day = 24 * hour;
	if (deltaMs < minute) return 'just now';
	if (deltaMs < hour) return `${Math.floor(deltaMs / minute)}m ago`;
	if (deltaMs < day) return `${Math.floor(deltaMs / hour)}h ago`;
	if (deltaMs < 2 * day) return 'yesterday';
	if (deltaMs < 7 * day) return `${Math.floor(deltaMs / day)}d ago`;
	if (deltaMs < 30 * day) return `${Math.floor(deltaMs / (7 * day))}w ago`;
	const d = new Date(ts);
	return d.toISOString().slice(0, 10);
}
