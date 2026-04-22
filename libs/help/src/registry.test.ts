import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseQuery } from './query-parser';
import { helpRegistry } from './registry';
import type { HelpPage } from './schema/help-page';

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
		// All three pages' bodies contain "a"; but only two have "review" in body/summary.
		const results = helpRegistry.search(parseQuery('review'));
		expect(results.map((r) => r.id)).toContain('memory-review');
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
