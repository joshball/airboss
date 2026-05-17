/**
 * knowledge-nodes adapter -- Phase-2 Layer-1 census.
 *
 * Verifies the adapter returns a schema-valid `census`-mode `CorpusCensus`,
 * that every node is classified into the complete / draft / skeleton
 * vocabulary, and that the derived counts agree with the on-disk corpus.
 * Spot-check numbers were taken from the actual repo on 2026-05-17.
 */

import { describe, expect, it } from 'vitest';
import { knowledgeNodesCensus } from '../server';
import type { CorpusCensus } from '../types';

const VALID_STATES = ['complete', 'draft', 'skeleton'];

describe('knowledgeNodesCensus', () => {
	const census: CorpusCensus = knowledgeNodesCensus();

	it('is a census-mode corpus with the wired id and identity prose', () => {
		expect(census.id).toBe('knowledge-nodes');
		expect(census.mode).toBe('census');
		expect(census.label).toBe('Knowledge nodes');
		expect(census.whatItIs.length).toBeGreaterThan(0);
		expect(census.whyItExists.length).toBeGreaterThan(0);
		expect(census.stateRule.length).toBeGreaterThan(0);
	});

	it('inventories every node.md with a valid derived state', () => {
		// The knowledge graph carries 83 node.md files on disk.
		expect(census.items.length).toBe(83);
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
		// The corpus has authored nodes and unauthored skeletons -- both buckets non-empty.
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

	it('carries no fabricated gaps and an honest Layer-2 placeholder', () => {
		expect(census.gaps.length).toBe(0);
		expect(census.next.length).toBe(0);
		expect(census.layerTwoPending).toBeDefined();
		expect(census.layerTwoPending?.message.length).toBeGreaterThan(0);
	});

	it('every metric carries the explanatory triad', () => {
		for (const metric of census.metrics) {
			expect(metric.whatItMeasures.trim().length).toBeGreaterThan(0);
			expect(metric.whyItMatters.trim().length).toBeGreaterThan(0);
			expect(metric.whatToDo?.text.trim().length).toBeGreaterThan(0);
		}
	});
});
