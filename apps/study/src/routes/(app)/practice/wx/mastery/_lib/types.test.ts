import { describe, expect, it } from 'vitest';
import type { WxPracticeMasteryRow } from '$lib/types/wx-practice-mastery-contract';
import {
	composeDisplayRows,
	filterRowsByState,
	parseProductParam,
	parseSortParam,
	parseStateParam,
	pickWeakFamilies,
	relativeLastSeen,
	sortRows,
	type WxMasteryDisplayRow,
} from './types';

const catalog = [
	{ slug: 'wind', label: 'Wind' },
	{ slug: 'visibility', label: 'Visibility' },
	{ slug: 'sky', label: 'Sky condition' },
	{ slug: 'altimeter', label: 'Altimeter' },
] as const;

function mkRow(family: string, overrides: Partial<WxPracticeMasteryRow> = {}): WxPracticeMasteryRow {
	return {
		userId: 'usr_test',
		product: 'metar',
		family,
		subFamily: null,
		attempts: 10,
		correct: 5,
		recentRing: [],
		streakAcrossSessions: 0,
		state: 'active',
		lastSeenAt: null,
		lastUpdatedAt: '2026-05-14T00:00:00.000Z',
		...overrides,
	};
}

describe('parseProductParam', () => {
	it('returns the default when the param is missing', () => {
		expect(parseProductParam(null)).toBe('metar');
	});

	it('accepts every known product', () => {
		expect(parseProductParam('metar')).toBe('metar');
		expect(parseProductParam('taf')).toBe('taf');
		expect(parseProductParam('pirep')).toBe('pirep');
		expect(parseProductParam('fb')).toBe('fb');
		expect(parseProductParam('airmet')).toBe('airmet');
	});

	it('falls back to the default on unknown input', () => {
		expect(parseProductParam('unknown')).toBe('metar');
	});

	it('lowercases the value before matching', () => {
		expect(parseProductParam('METAR')).toBe('metar');
	});
});

describe('parseStateParam', () => {
	it('returns every state when the param is missing', () => {
		expect(parseStateParam(null)).toEqual(['active', 'passive', 'demoted', 'never-seen']);
	});

	it('returns every state when the param is blank', () => {
		expect(parseStateParam('   ')).toEqual(['active', 'passive', 'demoted', 'never-seen']);
	});

	it('returns the intersection with the known states', () => {
		expect(parseStateParam('active,demoted')).toEqual(['active', 'demoted']);
	});

	it('drops unknown values', () => {
		expect(parseStateParam('active,bogus')).toEqual(['active']);
	});

	it('returns an empty array when nothing intersects (preserves explicit choice)', () => {
		expect(parseStateParam('bogus,unknown')).toEqual([]);
	});

	it('preserves document order for stable URLs regardless of input order', () => {
		expect(parseStateParam('demoted,active')).toEqual(['active', 'demoted']);
	});
});

describe('parseSortParam', () => {
	it('returns the default when missing', () => {
		expect(parseSortParam(null)).toBe('attempts');
	});

	it('accepts every known sort key', () => {
		expect(parseSortParam('ratio')).toBe('ratio');
		expect(parseSortParam('last-seen')).toBe('last-seen');
		expect(parseSortParam('label')).toBe('label');
	});

	it('falls back to the default on unknown input', () => {
		expect(parseSortParam('xyz')).toBe('attempts');
	});
});

describe('composeDisplayRows', () => {
	it('produces a never-seen row for every catalog family with no mastery row', () => {
		const rows = composeDisplayRows(catalog, [], 'metar');
		expect(rows).toHaveLength(4);
		for (const r of rows) {
			expect(r.state).toBe('never-seen');
			expect(r.attempts).toBe(0);
			expect(r.ratio).toBeNull();
		}
	});

	it('joins mastery rows to catalog families on the family slug', () => {
		const mastery: WxPracticeMasteryRow[] = [
			mkRow('wind', { attempts: 10, correct: 7, state: 'active', lastSeenAt: '2026-05-13T12:00:00.000Z' }),
		];
		const rows = composeDisplayRows(catalog, mastery, 'metar');
		const wind = rows.find((r) => r.family === 'wind');
		expect(wind?.state).toBe('active');
		expect(wind?.attempts).toBe(10);
		expect(wind?.correct).toBe(7);
		expect(wind?.ratio).toBeCloseTo(0.7);
		expect(wind?.lastSeenAt).toBe('2026-05-13T12:00:00.000Z');
	});

	it('keeps the highest-attempt sub-family when multiple rows exist', () => {
		const mastery: WxPracticeMasteryRow[] = [
			mkRow('wind', { subFamily: 'direction', attempts: 5, correct: 3 }),
			mkRow('wind', { subFamily: 'gust', attempts: 12, correct: 11 }),
		];
		const rows = composeDisplayRows(catalog, mastery, 'metar');
		const wind = rows.find((r) => r.family === 'wind');
		expect(wind?.attempts).toBe(12);
		expect(wind?.correct).toBe(11);
	});

	it('clamps ratio into [0, 1]', () => {
		const mastery: WxPracticeMasteryRow[] = [mkRow('wind', { attempts: 10, correct: 15 })];
		const rows = composeDisplayRows(catalog, mastery, 'metar');
		expect(rows.find((r) => r.family === 'wind')?.ratio).toBe(1);
	});

	it('returns null ratio when attempts is zero', () => {
		const mastery: WxPracticeMasteryRow[] = [mkRow('wind', { attempts: 0, correct: 0 })];
		const rows = composeDisplayRows(catalog, mastery, 'metar');
		expect(rows.find((r) => r.family === 'wind')?.ratio).toBeNull();
	});
});

describe('filterRowsByState', () => {
	const rows: WxMasteryDisplayRow[] = [
		{
			product: 'metar',
			family: 'a',
			label: 'A',
			attempts: 5,
			correct: 4,
			ratio: 0.8,
			state: 'active',
			lastSeenAt: null,
		},
		{
			product: 'metar',
			family: 'b',
			label: 'B',
			attempts: 5,
			correct: 5,
			ratio: 1,
			state: 'passive',
			lastSeenAt: null,
		},
		{
			product: 'metar',
			family: 'c',
			label: 'C',
			attempts: 0,
			correct: 0,
			ratio: null,
			state: 'never-seen',
			lastSeenAt: null,
		},
	];

	it('keeps every row when every state is requested', () => {
		expect(filterRowsByState(rows, ['active', 'passive', 'demoted', 'never-seen'])).toHaveLength(3);
	});

	it('keeps only rows whose state is in the set', () => {
		expect(filterRowsByState(rows, ['active']).map((r) => r.family)).toEqual(['a']);
	});

	it('returns zero rows when the filter set is empty (preserves explicit choice)', () => {
		expect(filterRowsByState(rows, [])).toHaveLength(0);
	});
});

describe('sortRows', () => {
	const rows: WxMasteryDisplayRow[] = [
		{
			product: 'metar',
			family: 'a',
			label: 'Apple',
			attempts: 1,
			correct: 1,
			ratio: 1.0,
			state: 'passive',
			lastSeenAt: '2026-05-10T00:00:00.000Z',
		},
		{
			product: 'metar',
			family: 'b',
			label: 'Banana',
			attempts: 10,
			correct: 4,
			ratio: 0.4,
			state: 'active',
			lastSeenAt: '2026-05-13T00:00:00.000Z',
		},
		{
			product: 'metar',
			family: 'c',
			label: 'Cherry',
			attempts: 0,
			correct: 0,
			ratio: null,
			state: 'never-seen',
			lastSeenAt: null,
		},
	];

	it('sorts by attempts descending, never-seen rows last', () => {
		const sorted = sortRows(rows, 'attempts');
		expect(sorted.map((r) => r.family)).toEqual(['b', 'a', 'c']);
	});

	it('sorts by ratio ascending, never-seen rows last', () => {
		const sorted = sortRows(rows, 'ratio');
		expect(sorted.map((r) => r.family)).toEqual(['b', 'a', 'c']);
	});

	it('sorts by last-seen descending, null timestamps last', () => {
		const sorted = sortRows(rows, 'last-seen');
		expect(sorted.map((r) => r.family)).toEqual(['b', 'a', 'c']);
	});

	it('sorts by label alphabetically', () => {
		const sorted = sortRows(rows, 'label');
		expect(sorted.map((r) => r.label)).toEqual(['Apple', 'Banana', 'Cherry']);
	});
});

describe('pickWeakFamilies', () => {
	it('picks active + demoted rows with the lowest ratio first', () => {
		const rows: WxMasteryDisplayRow[] = [
			{
				product: 'metar',
				family: 'good',
				label: 'G',
				attempts: 10,
				correct: 9,
				ratio: 0.9,
				state: 'active',
				lastSeenAt: null,
			},
			{
				product: 'metar',
				family: 'bad',
				label: 'B',
				attempts: 10,
				correct: 3,
				ratio: 0.3,
				state: 'active',
				lastSeenAt: null,
			},
			{
				product: 'metar',
				family: 'sad',
				label: 'S',
				attempts: 5,
				correct: 1,
				ratio: 0.2,
				state: 'demoted',
				lastSeenAt: null,
			},
		];
		expect(pickWeakFamilies(rows)).toEqual(['sad', 'bad', 'good']);
	});

	it('skips passive rows (already mastered)', () => {
		const rows: WxMasteryDisplayRow[] = [
			{
				product: 'metar',
				family: 'easy',
				label: 'E',
				attempts: 10,
				correct: 1,
				ratio: 0.1,
				state: 'passive',
				lastSeenAt: null,
			},
			{
				product: 'metar',
				family: 'hard',
				label: 'H',
				attempts: 10,
				correct: 5,
				ratio: 0.5,
				state: 'active',
				lastSeenAt: null,
			},
		];
		expect(pickWeakFamilies(rows)).toEqual(['hard']);
	});

	it('skips never-seen rows (no signal)', () => {
		const rows: WxMasteryDisplayRow[] = [
			{
				product: 'metar',
				family: 'unknown',
				label: 'U',
				attempts: 0,
				correct: 0,
				ratio: null,
				state: 'never-seen',
				lastSeenAt: null,
			},
		];
		expect(pickWeakFamilies(rows)).toEqual([]);
	});

	it('caps the list at the configured max', () => {
		const rows: WxMasteryDisplayRow[] = Array.from({ length: 20 }, (_, i) => ({
			product: 'metar' as const,
			family: `f${i}`,
			label: `F${i}`,
			attempts: 10,
			correct: i,
			ratio: i / 10,
			state: 'active' as const,
			lastSeenAt: null,
		}));
		expect(pickWeakFamilies(rows, 3)).toEqual(['f0', 'f1', 'f2']);
	});
});

describe('relativeLastSeen', () => {
	const now = new Date('2026-05-14T12:00:00.000Z');

	it('returns "never" for null', () => {
		expect(relativeLastSeen(null, now)).toBe('never');
	});

	it('returns "just now" for sub-minute deltas', () => {
		expect(relativeLastSeen('2026-05-14T11:59:30.000Z', now)).toBe('just now');
	});

	it('returns Nm ago for sub-hour deltas', () => {
		expect(relativeLastSeen('2026-05-14T11:30:00.000Z', now)).toBe('30m ago');
	});

	it('returns Nh ago for sub-day deltas', () => {
		expect(relativeLastSeen('2026-05-14T09:00:00.000Z', now)).toBe('3h ago');
	});

	it('returns "yesterday" for 1-2 day deltas', () => {
		expect(relativeLastSeen('2026-05-13T12:00:00.000Z', now)).toBe('yesterday');
	});

	it('returns Nd ago for sub-week deltas', () => {
		expect(relativeLastSeen('2026-05-10T12:00:00.000Z', now)).toBe('4d ago');
	});

	it('returns Nw ago for sub-month deltas', () => {
		expect(relativeLastSeen('2026-04-30T12:00:00.000Z', now)).toBe('2w ago');
	});

	it('returns an ISO date for older timestamps', () => {
		expect(relativeLastSeen('2026-03-01T12:00:00.000Z', now)).toBe('2026-03-01');
	});

	it('returns "never" for unparseable input', () => {
		expect(relativeLastSeen('not a date', now)).toBe('never');
	});
});
