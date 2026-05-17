/**
 * adrs adapter -- Phase-2 Layer-1 census.
 *
 * Verifies the adapter resolves every numbered ADR (single-file and
 * directory form), normalises its status from whichever shape it is recorded
 * in, and that the status-distribution metrics are internally consistent.
 * Spot-check numbers were taken from the actual repo on 2026-05-17.
 */

import { describe, expect, it } from 'vitest';
import { adrsCensus } from '../server';
import type { CorpusCensus } from '../types';

const VALID_STATES = ['accepted', 'proposed', 'superseded', 'partially-superseded', 'unknown'];

describe('adrsCensus', () => {
	const census: CorpusCensus = adrsCensus();

	it('is a census-mode corpus with the wired id', () => {
		expect(census.id).toBe('adrs');
		expect(census.mode).toBe('census');
		expect(census.label).toBe('ADRs');
	});

	it('resolves every numbered ADR with a normalised status', () => {
		// 26 numbered ADRs on disk: 16 single-file + 10 directory-form.
		expect(census.items.length).toBe(26);
		for (const item of census.items) {
			expect(VALID_STATES, `${item.id} state`).toContain(item.derivedState);
			// Every ADR id carries the NNN- number prefix.
			expect(item.id).toMatch(/^\d{3}-/);
			expect(item.label.length).toBeGreaterThan(0);
		}
	});

	it('normalises status across the several shapes ADRs use', () => {
		const stateOf = (idPrefix: string): string | undefined =>
			census.items.find((item) => item.id.startsWith(idPrefix))?.derivedState;
		// 001 -- H1 `(SUPERSEDED)` suffix.
		expect(stateOf('001-')).toBe('superseded');
		// 002 -- H1 `(PARTIALLY SUPERSEDED)` suffix.
		expect(stateOf('002-')).toBe('partially-superseded');
		// 018 -- directory ADR with a YAML `status: accepted` frontmatter.
		expect(stateOf('018-')).toBe('accepted');
		// 028 -- single-file ADR with an inline `Status: \`proposed\`` line.
		expect(stateOf('028-')).toBe('proposed');
	});

	it('reports an ADR count metric equal to the inventory size', () => {
		const metric = census.metrics.find((m) => m.key === 'total');
		expect(metric?.value).toBe(census.items.length);
	});

	it('classifies every ADR into exactly one status bucket', () => {
		const counts = VALID_STATES.reduce<number>(
			(sum, state) => sum + census.items.filter((item) => item.derivedState === state).length,
			0,
		);
		expect(counts).toBe(census.items.length);
	});

	it('reports live ADRs as accepted + partially-superseded', () => {
		const countOf = (state: string): number => census.items.filter((item) => item.derivedState === state).length;
		const live = countOf('accepted') + countOf('partially-superseded');
		const metric = census.metrics.find((m) => m.key === 'live');
		expect(metric?.value).toBe(`${live} / ${census.items.length}`);
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
