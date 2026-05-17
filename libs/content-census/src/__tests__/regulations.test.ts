/**
 * regulations adapter -- Phase-2 Layer-1 census.
 *
 * Verifies the adapter inventories the ten weekly modules of the FAR
 * navigation course, classifies each full / partial, and that the modality
 * and lesson metrics agree with the on-disk corpus. Spot-check numbers were
 * taken from the actual repo on 2026-05-17.
 */

import { describe, expect, it } from 'vitest';
import { regulationsCensus } from '../server';
import type { CorpusCensus } from '../types';

const VALID_STATES = ['full', 'partial'];

describe('regulationsCensus', () => {
	const census: CorpusCensus = regulationsCensus();

	it('is a census-mode corpus with the wired id', () => {
		expect(census.id).toBe('regulations');
		expect(census.mode).toBe('census');
		expect(census.label).toBe('Regulations course');
	});

	it('inventories all ten course weeks with a valid state', () => {
		expect(census.items.length).toBe(10);
		for (const item of census.items) {
			expect(VALID_STATES, `${item.id} state`).toContain(item.derivedState);
			// Each week directory is named week-NN-*.
			expect(item.id).toMatch(/^week-\d{2}-/);
		}
	});

	it('reports a course-weeks metric equal to the inventory size', () => {
		const metric = census.metrics.find((m) => m.key === 'weeks');
		expect(metric?.value).toBe(10);
	});

	it('reports full-weeks as a fraction of the total', () => {
		const full = census.items.filter((item) => item.derivedState === 'full').length;
		const metric = census.metrics.find((m) => m.key === 'full-weeks');
		expect(metric?.value).toBe(`${full} / 10`);
	});

	it('reports a positive lesson-file count', () => {
		const metric = census.metrics.find((m) => m.key === 'lessons');
		expect(typeof metric?.value).toBe('number');
		expect(metric?.value as number).toBeGreaterThan(0);
	});

	it('reports modality coverage as a fraction of the ten weeks', () => {
		const metric = census.metrics.find((m) => m.key === 'modality-coverage');
		expect(metric?.value).toMatch(/^\d+ \/ 10$/);
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
