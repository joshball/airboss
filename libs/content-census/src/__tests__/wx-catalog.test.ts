/**
 * wx-catalog adapter -- the FULL reference adapter.
 *
 * Verifies the adapter returns a schema-valid `CorpusCensus` and that its
 * derived counts equal the known on-disk fixtures of `catalog.json` /
 * `scenario-matches.json`. The fixture numbers below were derived from the
 * actual files on 2026-05-17; if the catalog is re-authored these update.
 */

import { describe, expect, it } from 'vitest';
import { wxCatalogCensus } from '../server';
import type { CorpusCensus } from '../types';

describe('wxCatalogCensus', () => {
	const census: CorpusCensus = wxCatalogCensus();

	it('returns a full-mode census for the wx-catalog corpus', () => {
		expect(census.id).toBe('wx-catalog');
		expect(census.mode).toBe('full');
		expect(census.label).toBe('Encoded-text catalog');
		expect(census.pending).toBeUndefined();
	});

	it('inventories all 155 catalog examples with a matched/unmatched state', () => {
		expect(census.items.length).toBe(155);
		for (const item of census.items) {
			expect(['matched', 'unmatched']).toContain(item.derivedState);
			expect(item.id.length).toBeGreaterThan(0);
			expect(typeof item.detail).toBe('string');
		}
	});

	it('derives 20 matched examples', () => {
		const matched = census.items.filter((item) => item.derivedState === 'matched');
		expect(matched.length).toBe(20);
	});

	it('reports generator coverage as 20 / 155', () => {
		const metric = census.metrics.find((m) => m.key === 'generator-coverage');
		expect(metric).toBeDefined();
		expect(metric?.value).toBe('20 / 155');
	});

	it('reports 87 token families, 43 generator-covered', () => {
		const families = census.metrics.find((m) => m.key === 'token-families');
		const covered = census.metrics.find((m) => m.key === 'covered-families');
		expect(families?.value).toBe(87);
		expect(covered?.value).toBe('43 / 87');
	});

	it('reports 6 of 7 scenarios contributing', () => {
		const scenarios = census.metrics.find((m) => m.key === 'scenarios');
		expect(scenarios?.value).toBe('6 / 7');
	});

	it('surfaces the three known gaps with correct severities', () => {
		expect(census.gaps.length).toBe(3);
		const structural = census.gaps.filter((g) => g.severity === 'structural');
		// The AIRMET / SIGMET emitter gap is the single structural gap.
		expect(structural.length).toBe(1);
		expect(structural[0].title).toMatch(/AIRMET/);

		const frontalGap = census.gaps.find((g) => g.title.includes('frontal-pressure-march'));
		expect(frontalGap).toBeDefined();
		expect(frontalGap?.severity).toBe('thin');

		const tokenGap = census.gaps.find((g) => g.title.includes('token families'));
		expect(tokenGap).toBeDefined();
		expect(tokenGap?.severity).toBe('thin');
	});

	it('provides a value-ranked next-list led by a high-value item', () => {
		expect(census.next.length).toBeGreaterThan(0);
		const highValue = census.next.filter((n) => n.value === 'high');
		expect(highValue.length).toBeGreaterThanOrEqual(1);
	});

	it('links every governing document', () => {
		expect(census.docs.length).toBeGreaterThanOrEqual(3);
		for (const doc of census.docs) {
			expect(doc.label.length).toBeGreaterThan(0);
			expect(doc.href.length).toBeGreaterThan(0);
			expect(doc.role.length).toBeGreaterThan(0);
		}
	});
});
