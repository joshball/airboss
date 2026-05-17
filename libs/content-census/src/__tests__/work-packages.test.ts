/**
 * work-packages adapter -- Phase-2 Layer-1 census.
 *
 * Verifies the adapter inventories every work-package directory carrying a
 * spec.md, derives the WP status straight from frontmatter, and that the
 * status-distribution metrics are internally consistent. Spot-check numbers
 * were taken from the actual repo on 2026-05-17.
 */

import { WP_STATUSES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { workPackagesCensus } from '../server';
import type { CorpusCensus } from '../types';

const VALID_STATES = [...WP_STATUSES, 'unparseable'];

describe('workPackagesCensus', () => {
	const census: CorpusCensus = workPackagesCensus();

	it('is a census-mode corpus with the wired id', () => {
		expect(census.id).toBe('work-packages');
		expect(census.mode).toBe('census');
		expect(census.label).toBe('Work packages');
	});

	it('inventories every spec-bearing work package with a valid derived state', () => {
		// 113 work-package directories carry a spec.md on disk.
		expect(census.items.length).toBe(113);
		for (const item of census.items) {
			expect(VALID_STATES, `${item.id} state`).toContain(item.derivedState);
			// Every WP item links to its roadmap detail page.
			expect(item.href).toBe(`/roadmap/${encodeURIComponent(item.id)}`);
		}
	});

	it('reports a work-package count metric equal to the inventory size', () => {
		const metric = census.metrics.find((m) => m.key === 'total');
		expect(metric?.value).toBe(census.items.length);
	});

	it('reports open as the sum of draft + signed-off + in-flight', () => {
		const countOf = (state: string): number => census.items.filter((item) => item.derivedState === state).length;
		const open = countOf('draft') + countOf('signed-off') + countOf('in-flight');
		const metric = census.metrics.find((m) => m.key === 'open');
		expect(metric?.value).toBe(`${open} / ${census.items.length}`);
	});

	it('reports a shipped metric as a fraction of the total', () => {
		const shipped = census.items.filter((item) => item.derivedState === 'shipped').length;
		const metric = census.metrics.find((m) => m.key === 'shipped');
		expect(metric?.value).toBe(`${shipped} / ${census.items.length}`);
	});

	it('links the roadmap dashboard rather than duplicating the process view', () => {
		const linksRoadmap = census.docs.some((doc) => doc.href === '/roadmap');
		expect(linksRoadmap).toBe(true);
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
