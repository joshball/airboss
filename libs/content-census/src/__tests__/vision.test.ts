/**
 * vision adapter -- Phase-2 Layer-1 census.
 *
 * Verifies the adapter inventories the per-product vision documents, derives
 * a fleshed-out / outline / stub state from `prd_depth` + `status`
 * frontmatter, and that category READMEs are excluded. Spot-check numbers
 * were taken from the actual repo on 2026-05-17.
 */

import { describe, expect, it } from 'vitest';
import { visionCensus } from '../server';
import type { CorpusCensus } from '../types';

const VALID_STATES = ['fleshed-out', 'outline', 'stub'];

describe('visionCensus', () => {
	const census: CorpusCensus = visionCensus();

	it('is a census-mode corpus with the wired id', () => {
		expect(census.id).toBe('vision');
		expect(census.mode).toBe('census');
		expect(census.label).toBe('Vision / PRD docs');
	});

	it('inventories the product documents with a valid derived state', () => {
		// PRD / VISION / DESIGN files only -- 58 product documents on disk.
		expect(census.items.length).toBe(58);
		for (const item of census.items) {
			expect(VALID_STATES, `${item.id} state`).toContain(item.derivedState);
			expect(item.label.length).toBeGreaterThan(0);
		}
	});

	it('reports a vision-documents metric equal to the inventory size', () => {
		const metric = census.metrics.find((m) => m.key === 'docs');
		expect(metric?.value).toBe(census.items.length);
	});

	it('classifies the depth distribution -- every doc in exactly one bucket', () => {
		const counts = (state: string): number =>
			census.items.filter((item) => item.derivedState === state).length;
		expect(counts('fleshed-out') + counts('outline') + counts('stub')).toBe(census.items.length);
		// The vision corpus is mostly light outlines with a worked-up minority.
		expect(counts('outline')).toBeGreaterThan(0);
		expect(counts('fleshed-out')).toBeGreaterThan(0);
	});

	it('reports a fleshed-out metric as a fraction of the total', () => {
		const fleshedOut = census.items.filter((item) => item.derivedState === 'fleshed-out').length;
		const metric = census.metrics.find((m) => m.key === 'fleshed-out');
		expect(metric?.value).toBe(`${fleshedOut} / ${census.items.length}`);
	});

	it('carries no fabricated gaps and an honest Layer-2 placeholder', () => {
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
