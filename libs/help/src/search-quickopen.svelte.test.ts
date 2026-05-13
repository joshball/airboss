/**
 * Phase 5 integration: `searchGrouped` in `quickopen` mode surfaces
 * recents in the top-hits strip when the query is empty, and filters
 * stored recents through the quickopen eligibility set.
 */

import { __resetRegistryForTests } from '@ab/aviation';
import { APP_SURFACES, PALETTE_RECENTS_STORAGE_KEY } from '@ab/constants';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __resetRecentsForTests, recents } from './recents';
import type { PaletteHost } from './schema/result-types';
import { searchGrouped } from './search';

const HOST: PaletteHost = { surface: APP_SURFACES.GLOBAL };

function wipeStorage(): void {
	if (typeof globalThis.localStorage !== 'undefined') {
		globalThis.localStorage.removeItem(PALETTE_RECENTS_STORAGE_KEY);
	}
}

beforeEach(() => {
	__resetRegistryForTests();
	wipeStorage();
	__resetRecentsForTests();
});

afterEach(() => {
	wipeStorage();
	__resetRecentsForTests();
});

describe('searchGrouped -- quickopen mode empty state', () => {
	it('returns empty topHits when no recents have been recorded', () => {
		const out = searchGrouped('', HOST, [], 'quickopen');
		expect(out.topHits).toHaveLength(0);
		expect(out.totalCount).toBe(0);
	});

	it('surfaces recorded recents as topHits when the input is empty', () => {
		recents.record({
			id: 'phak',
			type: 'faa.handbook',
			title: 'PHAK',
			href: '/library/phak',
		});
		recents.record({
			id: 'cfr-91',
			type: 'faa.cfr.part',
			title: '14 CFR Part 91',
			href: '/library/14cfr91',
		});
		const out = searchGrouped('', HOST, [], 'quickopen');
		expect(out.topHits.length).toBe(2);
		const ids = out.topHits.map((r) => r.id);
		expect(ids).toContain('phak');
		expect(ids).toContain('cfr-91');
		// Each surfaced recent is tagged with source: 'recents' so the UI
		// can label / style it differently.
		for (const hit of out.topHits) {
			expect(hit.source).toBe('recents');
		}
	});

	it('drops recents whose type is not in PALETTE_MODE_ELIGIBLE.quickopen', () => {
		// `mine.card` is NOT in the quickopen eligible set.
		recents.record({
			id: 'card-1',
			type: 'mine.card',
			title: 'Some card',
			href: '/study/cards/card-1',
		});
		// `airboss.knode` IS eligible.
		recents.record({
			id: 'knode-1',
			type: 'airboss.knode',
			title: 'A knowledge node',
			href: '/study/knode-1',
		});
		const out = searchGrouped('', HOST, [], 'quickopen');
		const ids = out.topHits.map((r) => r.id);
		expect(ids).toContain('knode-1');
		expect(ids).not.toContain('card-1');
	});

	it('default mode (search) does NOT surface recents on empty input', () => {
		recents.record({
			id: 'phak',
			type: 'faa.handbook',
			title: 'PHAK',
			href: '/library/phak',
		});
		const out = searchGrouped('', HOST);
		expect(out.topHits).toHaveLength(0);
		expect(out.totalCount).toBe(0);
	});
});
