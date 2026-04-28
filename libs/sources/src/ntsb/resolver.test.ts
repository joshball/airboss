import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { NTSB_CORPUS, NTSB_RESOLVER } from './resolver.ts';

describe('NTSB_RESOLVER', () => {
	it('declares the corpus name', () => {
		expect(NTSB_RESOLVER.corpus).toBe(NTSB_CORPUS);
		expect(NTSB_RESOLVER.corpus).toBe('ntsb');
	});

	it('parses a known-good locator', () => {
		const result = NTSB_RESOLVER.parseLocator('WPR23LA123');
		expect(result.kind).toBe('ok');
	});

	it('rejects a malformed locator', () => {
		const result = NTSB_RESOLVER.parseLocator('not-an-ntsb-id');
		expect(result.kind).toBe('error');
	});

	it('builds a live URL for a known-good SourceId', () => {
		const url = NTSB_RESOLVER.getLiveUrl('airboss-ref:ntsb/CEN24FA045/probable-cause' as SourceId, 'unspecified');
		expect(url).toContain('ntsb.gov');
		expect(url).toContain('CEN24FA045');
	});

	it('returns null for getDerivativeContent (deferred to a later WP)', () => {
		const content = NTSB_RESOLVER.getDerivativeContent('airboss-ref:ntsb/WPR23LA123' as SourceId, 'unspecified');
		expect(content).toBe(null);
	});

	it('returns null for getIndexedContent (deferred to a later WP)', async () => {
		const content = await NTSB_RESOLVER.getIndexedContent('airboss-ref:ntsb/WPR23LA123' as SourceId, 'unspecified');
		expect(content).toBe(null);
	});

	it('returns empty editions for an unknown SourceId', async () => {
		const editions = await NTSB_RESOLVER.getEditions('airboss-ref:ntsb/WPR23LA123' as SourceId);
		expect(editions).toEqual([]);
	});

	it('returns null current edition when no entries are registered', () => {
		expect(NTSB_RESOLVER.getCurrentEdition()).toBe(null);
	});
});
