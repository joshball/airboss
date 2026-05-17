/**
 * cards adapter -- Phase-2 Layer-1 census.
 *
 * Verifies the adapter inventories knowledge nodes by their embedded
 * `:::cards` deck, classifies each into rich / thin / none, and that the
 * total card count agrees with the on-disk corpus. Spot-check numbers were
 * taken from the actual repo on 2026-05-17.
 */

import { describe, expect, it } from 'vitest';
import { cardsCensus } from '../server';
import type { CorpusCensus } from '../types';

const VALID_STATES = ['rich', 'thin', 'none'];

describe('cardsCensus', () => {
	const census: CorpusCensus = cardsCensus();

	it('is a census-mode corpus with the wired id', () => {
		expect(census.id).toBe('cards');
		expect(census.mode).toBe('census');
		expect(census.label).toBe('Cards (spaced-rep)');
	});

	it('inventories one item per knowledge node with a valid deck state', () => {
		// The unit of the cards census is the node -- 83 node.md files.
		expect(census.items.length).toBe(83);
		for (const item of census.items) {
			expect(VALID_STATES, `${item.id} state`).toContain(item.derivedState);
		}
	});

	it('reports 300 total cards across the corpus', () => {
		const metric = census.metrics.find((m) => m.key === 'total-cards');
		expect(metric?.value).toBe(300);
	});

	it('counts nodes-with-a-deck as rich + thin, never none', () => {
		const rich = census.items.filter((item) => item.derivedState === 'rich').length;
		const thin = census.items.filter((item) => item.derivedState === 'thin').length;
		const metric = census.metrics.find((m) => m.key === 'nodes-with-cards');
		expect(metric?.value).toBe(`${rich + thin} / ${census.items.length}`);
	});

	it('reports a no-deck count equal to the none-state items', () => {
		const none = census.items.filter((item) => item.derivedState === 'none').length;
		const metric = census.metrics.find((m) => m.key === 'no-deck');
		expect(metric?.value).toBe(none);
		// The corpus has both decked and deckless nodes.
		expect(none).toBeGreaterThan(0);
		expect(none).toBeLessThan(census.items.length);
	});

	it('carries no fabricated gaps and a labelled Layer-2 placeholder', () => {
		expect(census.gaps.length).toBe(0);
		expect(census.layerTwoPending).toBeDefined();
	});

	it('every metric carries the explanatory triad', () => {
		for (const metric of census.metrics) {
			expect(metric.whatItMeasures.trim().length).toBeGreaterThan(0);
			expect(metric.whyItMatters.trim().length).toBeGreaterThan(0);
			expect(metric.whatToDo?.text.trim().length).toBeGreaterThan(0);
		}
	});
});
