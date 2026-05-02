import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseQuery } from './query-parser';
import { helpRegistry } from './registry';
import type { HelpPage } from './schema/help-page';
import type { HelpPageBody } from './schema/help-page-body';
import type { HelpPageIndex } from './schema/help-page-index';

function makePage(overrides: Partial<HelpPage>): HelpPage {
	return {
		id: 'page-1',
		title: 'Sample',
		summary: 'A sample help page.',
		tags: {
			appSurface: [APP_SURFACES.GLOBAL],
			helpKind: HELP_KINDS.CONCEPT,
		},
		sections: [{ id: 'lede', title: 'Overview', body: 'Plain-text body.' }],
		...overrides,
	};
}

beforeEach(() => {
	helpRegistry.clear();
});

describe('helpRegistry - register + lookup', () => {
	it('registers pages and looks up by id', () => {
		helpRegistry.registerPages('study', [makePage({ id: 'a' }), makePage({ id: 'b' })]);
		expect(helpRegistry.getById('a')?.id).toBe('a');
		expect(helpRegistry.getById('b')?.id).toBe('b');
		expect(helpRegistry.getAllPages()).toHaveLength(2);
	});

	it('records the appId on each registered page', () => {
		helpRegistry.registerPages('study', [makePage({ id: 'a' })]);
		expect(helpRegistry.getById('a')?.appId).toBe('study');
	});

	it('getByAppSurface returns only pages with matching primary surface', () => {
		helpRegistry.registerPages('study', [
			makePage({ id: 'dash', tags: { appSurface: [APP_SURFACES.DASHBOARD], helpKind: HELP_KINDS.CONCEPT } }),
			makePage({ id: 'mem', tags: { appSurface: [APP_SURFACES.MEMORY], helpKind: HELP_KINDS.CONCEPT } }),
			makePage({
				id: 'dash-2',
				tags: { appSurface: [APP_SURFACES.DASHBOARD, APP_SURFACES.GLOBAL], helpKind: HELP_KINDS.CONCEPT },
			}),
		]);
		const dash = helpRegistry.getByAppSurface(APP_SURFACES.DASHBOARD);
		expect(dash.map((p) => p.id).sort()).toEqual(['dash', 'dash-2']);
	});
});

describe('helpRegistry - idempotent re-registration', () => {
	it('re-registering the same appId replaces the prior pages', () => {
		helpRegistry.registerPages('study', [makePage({ id: 'a' }), makePage({ id: 'b' })]);
		expect(helpRegistry.getAllPages()).toHaveLength(2);

		helpRegistry.registerPages('study', [makePage({ id: 'a', title: 'Updated' }), makePage({ id: 'c' })]);
		expect(helpRegistry.getAllPages()).toHaveLength(2);
		expect(helpRegistry.getById('a')?.title).toBe('Updated');
		expect(helpRegistry.getById('b')).toBeUndefined();
		expect(helpRegistry.getById('c')?.id).toBe('c');
	});

	it('different appIds coexist', () => {
		helpRegistry.registerPages('study', [makePage({ id: 's1' })]);
		helpRegistry.registerPages('spatial', [makePage({ id: 'sp1' })]);
		expect(helpRegistry.getAllPages()).toHaveLength(2);
		expect(helpRegistry.getById('s1')?.appId).toBe('study');
		expect(helpRegistry.getById('sp1')?.appId).toBe('spatial');
	});
});

describe('helpRegistry - search', () => {
	beforeEach(() => {
		helpRegistry.registerPages('study', [
			makePage({
				id: 'calibration',
				title: 'Calibration',
				summary: 'Confidence vs accuracy.',
				tags: { appSurface: [APP_SURFACES.CALIBRATION], helpKind: HELP_KINDS.CONCEPT },
			}),
			makePage({
				id: 'memory-review',
				title: 'Memory review',
				summary: 'Daily FSRS review flow.',
				tags: { appSurface: [APP_SURFACES.MEMORY], helpKind: HELP_KINDS.HOW_TO },
				sections: [
					{ id: 'intro', title: 'Intro', body: 'FSRS rating semantics explained here with calibration cues.' },
				],
			}),
			makePage({
				id: 'keyboard',
				title: 'Keyboard shortcuts',
				summary: 'Every shortcut.',
				tags: { appSurface: [APP_SURFACES.GLOBAL], helpKind: HELP_KINDS.REFERENCE, keywords: ['kbd', 'shortcut'] },
			}),
		]);
	});

	it('exact-title hit ranks first (bucket 1)', () => {
		const results = helpRegistry.search(parseQuery('calibration'));
		expect(results[0]?.id).toBe('calibration');
		expect(results[0]?.rankBucket).toBe(1);
	});

	it('substring-on-title is bucket 2', () => {
		const results = helpRegistry.search(parseQuery('memory'));
		const topHit = results.find((r) => r.id === 'memory-review');
		expect(topHit?.rankBucket).toBe(2);
	});

	it('keyword hit is bucket 3', () => {
		const results = helpRegistry.search(parseQuery('kbd'));
		const hit = results.find((r) => r.id === 'keyboard');
		expect(hit?.rankBucket).toBe(3);
	});

	it('surface filter narrows to matching appSurface entries', () => {
		const results = helpRegistry.search(parseQuery('surface:memory'));
		expect(results.map((r) => r.id)).toEqual(['memory-review']);
	});

	it('kind filter narrows by helpKind', () => {
		const results = helpRegistry.search(parseQuery('kind:how-to'));
		expect(results.map((r) => r.id)).toEqual(['memory-review']);
	});

	it('ranked hits sorted alphabetically within a rank bucket', () => {
		// Seed two pages whose titles tie on the same rank bucket. Substring
		// match on title is bucket 2; both `Beta token` and `Alpha token`
		// match `'token'` at bucket 2. The contract is: tied bucket -> sort
		// alphabetically by title, so `Alpha` lands ahead of `Beta`.
		helpRegistry.clear();
		helpRegistry.registerPages('study', [
			makePage({ id: 'b-page', title: 'Beta token', summary: 'b' }),
			makePage({ id: 'a-page', title: 'Alpha token', summary: 'a' }),
		]);
		const results = helpRegistry.search(parseQuery('token'));
		expect(results.map((r) => r.id)).toEqual(['a-page', 'b-page']);
	});
});

describe('helpRegistry - clear', () => {
	it('clear removes all pages', () => {
		helpRegistry.registerPages('study', [makePage({ id: 'a' })]);
		helpRegistry.clear();
		expect(helpRegistry.getAllPages()).toHaveLength(0);
		expect(helpRegistry.getById('a')).toBeUndefined();
	});
});

// -------- registerIndex / loadById (lazy-load path) --------

function makeIndex(overrides: Partial<HelpPageIndex>): HelpPageIndex {
	return {
		id: 'idx-1',
		title: 'Sample',
		summary: 'A sample help page.',
		tags: {
			appSurface: [APP_SURFACES.GLOBAL],
			helpKind: HELP_KINDS.CONCEPT,
		},
		sections: [{ id: 'lede', title: 'Overview' }],
		searchHaystack: 'a sample help page. plain-text body.',
		...overrides,
	};
}

function makeBody(id: string, overrides: Partial<HelpPageBody> = {}): HelpPageBody {
	return {
		id,
		sections: [{ id: 'lede', title: 'Overview', body: 'Plain-text body.' }],
		...overrides,
	};
}

describe('helpRegistry - registerIndex (lazy)', () => {
	it('exposes metadata-only pages with empty section bodies before loadById', () => {
		const loader = vi.fn(async (id: string) => makeBody(id));
		helpRegistry.registerIndex('study', [makeIndex({ id: 'a', title: 'Alpha' })], loader);

		const page = helpRegistry.getById('a');
		expect(page?.title).toBe('Alpha');
		expect(page?.sections).toHaveLength(1);
		expect(page?.sections[0]?.body).toBe('');
		expect(loader).not.toHaveBeenCalled();
	});

	it('loadById invokes loader and caches the merged body', async () => {
		const loader = vi.fn(async (id: string) =>
			makeBody(id, { sections: [{ id: 'lede', title: 'Overview', body: 'Loaded body text.' }] }),
		);
		helpRegistry.registerIndex('study', [makeIndex({ id: 'b' })], loader);

		const first = await helpRegistry.loadById('b');
		expect(first?.sections[0]?.body).toBe('Loaded body text.');
		expect(loader).toHaveBeenCalledTimes(1);

		// Subsequent calls reuse the cached page.
		const second = await helpRegistry.loadById('b');
		expect(second).toBe(first);
		expect(loader).toHaveBeenCalledTimes(1);

		// `getById` now returns the loaded page.
		expect(helpRegistry.getById('b')?.sections[0]?.body).toBe('Loaded body text.');
	});

	it('loadById returns undefined for unknown ids', async () => {
		helpRegistry.registerIndex('study', [makeIndex({ id: 'c' })], async () => undefined);
		const result = await helpRegistry.loadById('does-not-exist');
		expect(result).toBeUndefined();
	});

	it('concurrent loadById calls share a single in-flight promise', async () => {
		let resolved = 0;
		const loader = vi.fn(async (id: string) => {
			resolved += 1;
			await new Promise((r) => setTimeout(r, 5));
			return makeBody(id);
		});
		helpRegistry.registerIndex('study', [makeIndex({ id: 'd' })], loader);

		const [a, b] = await Promise.all([helpRegistry.loadById('d'), helpRegistry.loadById('d')]);
		expect(a).toBe(b);
		expect(loader).toHaveBeenCalledTimes(1);
		expect(resolved).toBe(1);
	});

	it('search uses the precomputed haystack from the index entry', () => {
		const loader = vi.fn(async (id: string) => makeBody(id));
		helpRegistry.registerIndex(
			'study',
			[
				makeIndex({
					id: 'e',
					title: 'Calibration',
					summary: 'Confidence vs accuracy.',
					searchHaystack: 'confidence vs accuracy. brier score discussion lives here.',
				}),
			],
			loader,
		);

		const hits = helpRegistry.search(parseQuery('brier'));
		expect(hits.map((h) => h.id)).toEqual(['e']);
		expect(hits[0]?.rankBucket).toBe(3);
		// Search did not need the body to find the hit.
		expect(loader).not.toHaveBeenCalled();
	});

	it('re-registering an app via registerIndex replaces prior entries', () => {
		const loader = vi.fn(async (id: string) => makeBody(id));
		helpRegistry.registerIndex('study', [makeIndex({ id: 'f1' })], loader);
		helpRegistry.registerIndex(
			'study',
			[makeIndex({ id: 'f2', title: 'Replaced' })],
			vi.fn(async (id: string) => makeBody(id)),
		);
		expect(helpRegistry.getById('f1')).toBeUndefined();
		expect(helpRegistry.getById('f2')?.title).toBe('Replaced');
	});

	it('eager registerPages can replace a prior lazy registerIndex for the same app', async () => {
		helpRegistry.registerIndex(
			'study',
			[makeIndex({ id: 'g' })],
			vi.fn(async (id: string) => makeBody(id)),
		);
		helpRegistry.registerPages('study', [makePage({ id: 'g', title: 'Eager replacement' })]);

		const page = helpRegistry.getById('g');
		expect(page?.title).toBe('Eager replacement');
		expect(page?.sections[0]?.body).toBe('Plain-text body.');
		// loadById on an eagerly-registered page is a no-op (no loader needed).
		const loaded = await helpRegistry.loadById('g');
		expect(loaded?.sections[0]?.body).toBe('Plain-text body.');
	});
});
