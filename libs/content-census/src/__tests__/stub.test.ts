/**
 * The placeholder stub adapter -- design.md "Placeholder honesty".
 *
 * Verifies the stub adapter returns the corpus's real name + location and an
 * explicit, labelled "pending" state -- and that it fabricates nothing else:
 * no counts, no derived states, no fake metrics or gaps.
 */

import { describe, expect, it } from 'vitest';
import { CORPUS_REGISTRY } from '../registry';
import { stubCensus } from '../server';

describe('stubCensus', () => {
	// knowledge-nodes is a representative Phase-2 corpus.
	const descriptor = CORPUS_REGISTRY.find((c) => c.id === 'knowledge-nodes');

	it('has a registry descriptor to build from', () => {
		expect(descriptor).toBeDefined();
	});

	it('returns the corpus real name and location, not fabricated data', () => {
		if (!descriptor) throw new Error('missing descriptor');
		const census = stubCensus(descriptor);
		expect(census.id).toBe('knowledge-nodes');
		expect(census.label).toBe('Knowledge nodes');
		expect(census.location).toBe('course/knowledge/**');
		expect(census.mode).toBe('stub');
	});

	it('fabricates no inventory, metrics, gaps, or next-items', () => {
		if (!descriptor) throw new Error('missing descriptor');
		const census = stubCensus(descriptor);
		expect(census.items).toEqual([]);
		expect(census.metrics).toEqual([]);
		expect(census.gaps).toEqual([]);
		expect(census.next).toEqual([]);
	});

	it('carries an explicit labelled pending state with a link to the WP', () => {
		if (!descriptor) throw new Error('missing descriptor');
		const census = stubCensus(descriptor);
		expect(census.pending).toBeDefined();
		expect(census.pending?.message).toMatch(/pending/i);
		expect(census.pending?.href).toMatch(/content-census/);
	});
});
