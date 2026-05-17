/**
 * knowledge-nodes adapter -- the Phase-3 full reference adapter.
 *
 * Verifies the adapter returns a schema-valid `full`-mode `CorpusCensus`,
 * that every node is classified into the complete / draft / skeleton
 * vocabulary, that the derived counts agree with the on-disk corpus, and
 * that the gap view + next-list are real (every gap carries the
 * what / why / do triad, every gap maps to a genuine on-disk deficiency).
 *
 * The corpus grows over time; counts are asserted with a tolerance comment.
 * Spot-check numbers were taken from the actual repo on 2026-05-17:
 *   83 nodes -- 60 complete, 1 draft, 22 skeleton; 31 cardless authored
 *   nodes; 11 dangling cross-links across 3 source nodes; 0 orphans.
 */

import { describe, expect, it } from 'vitest';
import { knowledgeNodesCensus } from '../server';
import type { CorpusCensus } from '../types';

const VALID_STATES = ['complete', 'draft', 'skeleton'];
const GAP_SEVERITIES = ['structural', 'thin', 'nice-to-have'];
const NEXT_VALUES = ['high', 'standard', 'low'];

describe('knowledgeNodesCensus', () => {
	const census: CorpusCensus = knowledgeNodesCensus();

	it('is a full-mode corpus with the wired id and identity prose', () => {
		expect(census.id).toBe('knowledge-nodes');
		expect(census.mode).toBe('full');
		expect(census.label).toBe('Knowledge nodes');
		expect(census.whatItIs.length).toBeGreaterThan(0);
		expect(census.whyItExists.length).toBeGreaterThan(0);
		expect(census.stateRule.length).toBeGreaterThan(0);
	});

	it('inventories every node.md with a valid derived state', () => {
		// The knowledge graph carried 83 node.md files on 2026-05-17; the
		// corpus grows, so this is a lower bound, not an exact count.
		expect(census.items.length).toBeGreaterThanOrEqual(80);
		for (const item of census.items) {
			expect(VALID_STATES, `${item.id} state`).toContain(item.derivedState);
			expect(item.id.length).toBeGreaterThan(0);
			expect(item.label.length).toBeGreaterThan(0);
		}
	});

	it('classifies the complete / draft / skeleton distribution from real bodies', () => {
		const counts = (state: string): number => census.items.filter((item) => item.derivedState === state).length;
		// Every node lands in exactly one bucket.
		expect(counts('complete') + counts('draft') + counts('skeleton')).toBe(census.items.length);
		// The corpus has authored nodes and unauthored skeletons -- both non-empty.
		expect(counts('complete')).toBeGreaterThan(0);
		expect(counts('skeleton')).toBeGreaterThan(0);
	});

	it('reports a node count metric equal to the inventory size', () => {
		const metric = census.metrics.find((m) => m.key === 'nodes');
		expect(metric).toBeDefined();
		expect(metric?.value).toBe(census.items.length);
	});

	it('reports a complete-nodes metric as a fraction of the total', () => {
		const complete = census.items.filter((item) => item.derivedState === 'complete').length;
		const metric = census.metrics.find((m) => m.key === 'complete');
		expect(metric?.value).toBe(`${complete} / ${census.items.length}`);
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
		// The 2026-05-17 corpus has skeleton, cardless, draft, and dangling-edge
		// gaps -- at least three gaps. The exact set shifts as nodes are
		// authored; the invariant is that each gap is fully explained.
		expect(census.gaps.length).toBeGreaterThanOrEqual(3);
		for (const gap of census.gaps) {
			expect(gap.title.trim().length).toBeGreaterThan(0);
			expect(gap.whatItMeasures.trim().length).toBeGreaterThan(0);
			expect(gap.whyItMatters.trim().length).toBeGreaterThan(0);
			expect(gap.whatToDo.text.trim().length).toBeGreaterThan(0);
			expect(GAP_SEVERITIES, `${gap.title} severity`).toContain(gap.severity);
			expect(gap.whatToDo.href?.trim().length).toBeGreaterThan(0);
		}
	});

	it('flags the skeleton-node gap as structural', () => {
		const skeleton = census.items.filter((item) => item.derivedState === 'skeleton').length;
		const gap = census.gaps.find((g) => g.title.includes('skeleton'));
		expect(gap, 'skeleton gap present while skeletons exist').toBeDefined();
		expect(gap?.severity).toBe('structural');
		// The gap title leads with the real skeleton count.
		expect(gap?.title.startsWith(`${skeleton} `)).toBe(true);
	});

	it('flags a cardless-node gap derived from nodes with a body but no cards', () => {
		// A cardless node has a non-skeleton state and a "0 cards" detail.
		const cardless = census.items.filter(
			(item) => item.derivedState !== 'skeleton' && /\b0 cards\b/.test(item.detail ?? ''),
		).length;
		const gap = census.gaps.find((g) => g.title.includes('no cards'));
		if (cardless > 0) {
			expect(gap, 'cardless gap present while cardless nodes exist').toBeDefined();
			expect(gap?.severity).toBe('thin');
			expect(gap?.title.startsWith(`${cardless} `)).toBe(true);
		} else {
			expect(gap).toBeUndefined();
		}
	});

	it('flags a dangling cross-link gap when frontmatter edges point to missing nodes', () => {
		// 11 dangling edges existed on 2026-05-17; the gap exists as long as
		// any unresolved edge does.
		const gap = census.gaps.find((g) => g.title.includes('dangle'));
		expect(gap, 'dangling cross-link gap present on the 2026-05-17 corpus').toBeDefined();
		expect(gap?.severity).toBe('structural');
		expect(gap?.whatItMeasures).toMatch(/->/);
	});

	it('does not fabricate an orphan gap -- the 2026-05-17 corpus has none', () => {
		// Every node on disk is wired into the graph; the orphan gap must be
		// absent rather than a fabricated zero-count entry.
		const gap = census.gaps.find((g) => g.title.includes('orphan'));
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
		// The highest-value next-item targets the critical-priority skeletons.
		const top = census.next[0];
		expect(top.value).toBe('high');
		expect(top.text).toMatch(/critical-priority skeleton/);
	});
});
