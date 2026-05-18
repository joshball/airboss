/**
 * cards adapter -- the Phase-3 full reference adapter.
 *
 * Verifies the adapter returns a schema-valid `full`-mode `CorpusCensus`,
 * inventories every knowledge node by its embedded `:::cards` deck,
 * classifies each into rich / thin / none, that the total card count agrees
 * with the on-disk corpus, and that the gap view + next-list are real --
 * every gap carries the what / why / do triad, every gap maps to a genuine
 * on-disk deficiency, no gap is fabricated.
 *
 * The corpus grows over time; counts are asserted with a tolerance comment.
 * Spot-check numbers were taken from the actual repo on 2026-05-18:
 *   83 nodes -- 30 rich, 0 thin, 53 deckless; of the 53 deckless, 31 host
 *   authored prose (the cardless gap) and 22 are skeleton nodes; 300 cards
 *   total; 24 of the 31 cardless authored nodes are study-priority critical.
 */

import { describe, expect, it } from 'vitest';
import { cardsCensus } from '../server';
import type { CorpusCensus } from '../types';

const VALID_STATES = ['rich', 'thin', 'none'];
const GAP_SEVERITIES = ['structural', 'thin', 'nice-to-have'];
const NEXT_VALUES = ['high', 'standard', 'low'];

describe('cardsCensus', () => {
	const census: CorpusCensus = cardsCensus();

	it('is a full-mode corpus with the wired id and identity prose', () => {
		expect(census.id).toBe('cards');
		expect(census.mode).toBe('full');
		expect(census.label).toBe('Cards (spaced-rep)');
		expect(census.whatItIs.length).toBeGreaterThan(0);
		expect(census.whyItExists.length).toBeGreaterThan(0);
		expect(census.stateRule.length).toBeGreaterThan(0);
	});

	it('inventories one item per knowledge node with a valid deck state', () => {
		// The knowledge graph carried 83 node.md files on 2026-05-18; the
		// corpus grows, so this is a lower bound, not an exact count.
		expect(census.items.length).toBeGreaterThanOrEqual(80);
		for (const item of census.items) {
			expect(VALID_STATES, `${item.id} state`).toContain(item.derivedState);
			expect(item.id.length).toBeGreaterThan(0);
			expect(item.label.length).toBeGreaterThan(0);
			expect(item.detail).toMatch(/^\d+ cards?$/);
		}
	});

	it('classifies the rich / thin / none distribution from real decks', () => {
		const counts = (state: string): number => census.items.filter((item) => item.derivedState === state).length;
		// Every node lands in exactly one bucket.
		expect(counts('rich') + counts('thin') + counts('none')).toBe(census.items.length);
		// The corpus has both decked and deckless nodes.
		expect(counts('rich')).toBeGreaterThan(0);
		expect(counts('none')).toBeGreaterThan(0);
	});

	it('reports a total-cards metric that sums the per-node detail counts', () => {
		const summed = census.items.reduce((total, item) => {
			const match = (item.detail ?? '').match(/^(\d+) cards?$/);
			return total + (match ? Number(match[1]) : 0);
		}, 0);
		const metric = census.metrics.find((m) => m.key === 'total-cards');
		expect(metric?.value).toBe(summed);
		// The corpus carried 300 cards on 2026-05-18; it grows, so lower bound.
		expect(metric?.value).toBeGreaterThanOrEqual(300);
	});

	it('counts nodes-with-a-deck as rich + thin, never none', () => {
		const rich = census.items.filter((item) => item.derivedState === 'rich').length;
		const thin = census.items.filter((item) => item.derivedState === 'thin').length;
		const metric = census.metrics.find((m) => m.key === 'nodes-with-cards');
		expect(metric?.value).toBe(`${rich + thin} / ${census.items.length}`);
	});

	it('reports a no-deck metric equal to the none-state items', () => {
		const none = census.items.filter((item) => item.derivedState === 'none').length;
		const metric = census.metrics.find((m) => m.key === 'no-deck');
		expect(metric?.value).toBe(none);
		// The corpus has both decked and deckless nodes.
		expect(none).toBeGreaterThan(0);
		expect(none).toBeLessThan(census.items.length);
	});

	it('every metric carries the explanatory triad', () => {
		for (const metric of census.metrics) {
			expect(metric.whatItMeasures.trim().length).toBeGreaterThan(0);
			expect(metric.whyItMatters.trim().length).toBeGreaterThan(0);
			expect(metric.whatToDo?.text.trim().length).toBeGreaterThan(0);
		}
	});

	it('carries no Layer-2 placeholder -- it is a full adapter, not census-mode', () => {
		expect(census.layerTwoPending).toBeUndefined();
	});

	it('produces a real gap view, every gap carrying the what / why / do triad', () => {
		// The 2026-05-18 corpus has 31 cardless authored nodes -> at least the
		// cardless gap. The exact set shifts as decks are authored; the
		// invariant is that each gap present is fully explained.
		expect(census.gaps.length).toBeGreaterThanOrEqual(1);
		for (const gap of census.gaps) {
			expect(gap.title.trim().length).toBeGreaterThan(0);
			expect(gap.whatItMeasures.trim().length).toBeGreaterThan(0);
			expect(gap.whyItMatters.trim().length).toBeGreaterThan(0);
			expect(gap.whatToDo.text.trim().length).toBeGreaterThan(0);
			expect(GAP_SEVERITIES, `${gap.title} severity`).toContain(gap.severity);
			expect(gap.whatToDo.href?.trim().length).toBeGreaterThan(0);
		}
	});

	it('flags the cardless-authored-node gap as structural with the real count', () => {
		// A cardless authored node is deckless ("0 cards") but its host node
		// is not a skeleton -- it has prose. The gap title leads with that
		// count. Skeleton-hosted deckless nodes are excluded by design.
		const gap = census.gaps.find((g) => g.title.includes('no deck'));
		expect(gap, 'cardless gap present while cardless authored nodes exist').toBeDefined();
		expect(gap?.severity).toBe('structural');
		// The count in the title is a positive integer, no greater than the
		// no-deck total (skeleton-hosted deckless nodes are excluded).
		const titleCount = Number(gap?.title.match(/^(\d+) /)?.[1]);
		const noDeck = census.items.filter((item) => item.derivedState === 'none').length;
		expect(titleCount).toBeGreaterThan(0);
		expect(titleCount).toBeLessThanOrEqual(noDeck);
	});

	it('does not fabricate a thin-deck gap -- the 2026-05-18 corpus has none', () => {
		// Every decked node on disk clears the rich threshold, so there are no
		// thin decks; the thin-deck gap must be absent rather than a
		// fabricated zero-count entry.
		const thin = census.items.filter((item) => item.derivedState === 'thin').length;
		const gap = census.gaps.find((g) => g.title.includes('thin'));
		if (thin > 0) {
			expect(gap, 'thin gap present while thin decks exist').toBeDefined();
			expect(gap?.severity).toBe('thin');
		} else {
			expect(gap).toBeUndefined();
		}
	});

	it('does not fabricate a deck-on-skeleton gap -- the 2026-05-18 corpus has none', () => {
		// No skeleton node carries a deck today; the gap must be absent, not a
		// fabricated zero-count entry.
		const gap = census.gaps.find((g) => g.title.includes('stranded on a skeleton'));
		expect(gap).toBeUndefined();
	});

	it('produces a value-ranked next-list, each item linked and rationalised', () => {
		expect(census.next.length).toBeGreaterThan(0);
		for (const item of census.next) {
			expect(item.text.trim().length).toBeGreaterThan(0);
			expect(item.rationale.trim().length).toBeGreaterThan(0);
			expect(item.href?.trim().length).toBeGreaterThan(0);
			expect(NEXT_VALUES, `${item.text} value`).toContain(item.value);
		}
		// The highest-value next-item targets the critical-priority cardless
		// nodes -- the content a learner most needs to retain with no deck.
		const top = census.next[0];
		expect(top.value).toBe('high');
		expect(top.text).toMatch(/critical-priority cardless/);
	});
});
