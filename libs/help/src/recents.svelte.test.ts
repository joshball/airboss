import { PALETTE_RECENTS_DECAY, PALETTE_RECENTS_MAX, PALETTE_RECENTS_STORAGE_KEY } from '@ab/constants';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	__resetRecentsForTests,
	listWithTimestamp,
	type RecentRecordInput,
	recencyFactor,
	recents,
	recordWithTimestamp,
} from './recents';

const DAY_MS = PALETTE_RECENTS_DECAY.MS_PER_DAY;

function sample(overrides: Partial<RecentRecordInput> = {}): RecentRecordInput {
	return {
		id: 'res-1',
		type: 'faa.handbook',
		title: 'PHAK',
		href: '/library/phak',
		...overrides,
	};
}

describe('recencyFactor', () => {
	it('returns the day weight for ages under 24h', () => {
		const now = 100 * DAY_MS;
		expect(recencyFactor(now - 1, now)).toBe(PALETTE_RECENTS_DECAY.WEIGHT_DAY);
		expect(recencyFactor(now - DAY_MS / 2, now)).toBe(PALETTE_RECENTS_DECAY.WEIGHT_DAY);
	});

	it('returns the week weight for ages 1d-7d', () => {
		const now = 100 * DAY_MS;
		expect(recencyFactor(now - 2 * DAY_MS, now)).toBe(PALETTE_RECENTS_DECAY.WEIGHT_WEEK);
		expect(recencyFactor(now - 6 * DAY_MS, now)).toBe(PALETTE_RECENTS_DECAY.WEIGHT_WEEK);
	});

	it('returns the month weight for ages 7d-30d', () => {
		const now = 100 * DAY_MS;
		expect(recencyFactor(now - 10 * DAY_MS, now)).toBe(PALETTE_RECENTS_DECAY.WEIGHT_MONTH);
		expect(recencyFactor(now - 29 * DAY_MS, now)).toBe(PALETTE_RECENTS_DECAY.WEIGHT_MONTH);
	});

	it('returns the older weight beyond 30d', () => {
		const now = 100 * DAY_MS;
		expect(recencyFactor(now - 31 * DAY_MS, now)).toBe(PALETTE_RECENTS_DECAY.WEIGHT_OLDER);
		expect(recencyFactor(now - 365 * DAY_MS, now)).toBe(PALETTE_RECENTS_DECAY.WEIGHT_OLDER);
	});

	it('clamps negative ages to the day weight (clock skew defence)', () => {
		const now = 100 * DAY_MS;
		expect(recencyFactor(now + DAY_MS, now)).toBe(PALETTE_RECENTS_DECAY.WEIGHT_DAY);
	});
});

describe('recents tracker (localStorage-backed)', () => {
	beforeEach(() => {
		// happy-dom provides a real localStorage. Wipe any prior data.
		if (typeof globalThis.localStorage !== 'undefined') {
			globalThis.localStorage.removeItem(PALETTE_RECENTS_STORAGE_KEY);
		}
		__resetRecentsForTests();
	});

	afterEach(() => {
		if (typeof globalThis.localStorage !== 'undefined') {
			globalThis.localStorage.removeItem(PALETTE_RECENTS_STORAGE_KEY);
		}
		__resetRecentsForTests();
	});

	it('record + list round-trip yields one entry with hits=1', () => {
		recents.record(sample());
		const out = recents.list();
		expect(out).toHaveLength(1);
		expect(out[0]).toMatchObject({
			resultId: 'res-1',
			type: 'faa.handbook',
			title: 'PHAK',
			href: '/library/phak',
			hits: 1,
		});
	});

	it('records survive across singleton resets when localStorage is real', () => {
		recents.record(sample());
		__resetRecentsForTests();
		const out = recents.list();
		expect(out).toHaveLength(1);
		expect(out[0]?.resultId).toBe('res-1');
	});

	it('bumps hits + updates openedAt when the same id is re-recorded', () => {
		const t0 = 1_000_000;
		const t1 = t0 + DAY_MS / 2;
		recordWithTimestamp(sample(), t0);
		recordWithTimestamp(sample(), t1);
		const out = recents.list();
		expect(out).toHaveLength(1);
		expect(out[0]?.hits).toBe(2);
		expect(out[0]?.openedAt).toBe(t1);
	});

	it('caps the stored list at PALETTE_RECENTS_MAX, dropping the oldest by openedAt', () => {
		// Insert MAX+1 entries with strictly increasing timestamps.
		for (let i = 0; i < PALETTE_RECENTS_MAX + 1; i++) {
			recordWithTimestamp(sample({ id: `res-${i}`, title: `T-${i}` }), 1_000 + i);
		}
		const out = recents.list(PALETTE_RECENTS_MAX + 5);
		expect(out).toHaveLength(PALETTE_RECENTS_MAX);
		const ids = out.map((e) => e.resultId);
		// `res-0` was the oldest -- must be dropped.
		expect(ids).not.toContain('res-0');
		expect(ids).toContain(`res-${PALETTE_RECENTS_MAX}`);
	});

	it('ranks recent entries above older entries with equal hits', () => {
		const now = 100 * DAY_MS;
		recordWithTimestamp(sample({ id: 'old' }), now - 60 * DAY_MS); // >30d -> 0.1
		recordWithTimestamp(sample({ id: 'fresh' }), now); // <1d -> 1.0
		const out = listWithTimestamp(10, now);
		expect(out[0]?.resultId).toBe('fresh');
		expect(out[1]?.resultId).toBe('old');
	});

	it('ranks high-hit older entries above single-hit recent entries when hits dominate decay', () => {
		const now = 100 * DAY_MS;
		// `loved`: 30 hits, 10 days old -> 30 * 0.4 = 12
		for (let i = 0; i < 30; i++) {
			recordWithTimestamp(sample({ id: 'loved' }), now - 10 * DAY_MS);
		}
		// `fresh`: 1 hit, today -> 1 * 1.0 = 1
		recordWithTimestamp(sample({ id: 'fresh' }), now);
		const out = listWithTimestamp(10, now);
		expect(out[0]?.resultId).toBe('loved');
		expect(out[1]?.resultId).toBe('fresh');
	});

	it('honors the limit argument', () => {
		recents.record(sample({ id: 'a', title: 'A' }));
		recents.record(sample({ id: 'b', title: 'B' }));
		recents.record(sample({ id: 'c', title: 'C' }));
		expect(recents.list(2)).toHaveLength(2);
		expect(recents.list(0)).toHaveLength(0);
	});

	it('clear() empties both memory and storage', () => {
		recents.record(sample());
		recents.clear();
		expect(recents.list()).toHaveLength(0);
		const raw =
			typeof globalThis.localStorage !== 'undefined'
				? globalThis.localStorage.getItem(PALETTE_RECENTS_STORAGE_KEY)
				: null;
		expect(raw).toBeNull();
	});

	it('tolerates garbage in localStorage (bad JSON) and starts empty', () => {
		if (typeof globalThis.localStorage === 'undefined') return;
		globalThis.localStorage.setItem(PALETTE_RECENTS_STORAGE_KEY, '{not json');
		__resetRecentsForTests();
		expect(recents.list()).toHaveLength(0);
		// Subsequent records still work.
		recents.record(sample());
		expect(recents.list()).toHaveLength(1);
	});

	it('drops malformed entries when parsing the storage payload', () => {
		if (typeof globalThis.localStorage === 'undefined') return;
		const payload = JSON.stringify([
			{ resultId: 'good', type: 'faa.handbook', title: 'A', href: '/a', openedAt: 100, hits: 1 },
			{ resultId: 'no-type', title: 'B', href: '/b', openedAt: 100, hits: 1 },
			{ resultId: 'bad-openedAt', type: 'faa.handbook', title: 'C', href: '/c', openedAt: 'oops', hits: 1 },
			'string-entry',
			null,
		]);
		globalThis.localStorage.setItem(PALETTE_RECENTS_STORAGE_KEY, payload);
		__resetRecentsForTests();
		const out = recents.list();
		expect(out).toHaveLength(1);
		expect(out[0]?.resultId).toBe('good');
	});
});

describe('recents tracker -- SSR fallback (no localStorage)', () => {
	let storedStorage: Storage | undefined;

	beforeEach(() => {
		// Simulate SSR by removing the localStorage global. happy-dom defines
		// it on `globalThis`; we delete + restore.
		storedStorage = globalThis.localStorage;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		delete (globalThis as Record<string, unknown>).localStorage;
		__resetRecentsForTests();
	});

	afterEach(() => {
		if (storedStorage) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(globalThis as Record<string, unknown>).localStorage = storedStorage;
		}
		__resetRecentsForTests();
	});

	it('does not throw on record/list/clear when localStorage is absent', () => {
		expect(() => recents.record(sample())).not.toThrow();
		expect(() => recents.list()).not.toThrow();
		expect(() => recents.clear()).not.toThrow();
	});

	it('keeps entries in memory for the singleton lifetime', () => {
		recents.record(sample({ id: 'a' }));
		recents.record(sample({ id: 'b' }));
		expect(recents.list()).toHaveLength(2);
	});

	it('drops entries when the singleton resets (no persistence layer)', () => {
		recents.record(sample());
		__resetRecentsForTests();
		expect(recents.list()).toHaveLength(0);
	});
});
