import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { FORMS_CORPUS, FORMS_RESOLVER } from './resolver.ts';

describe('FORMS_RESOLVER', () => {
	it('declares the corpus name', () => {
		expect(FORMS_RESOLVER.corpus).toBe(FORMS_CORPUS);
		expect(FORMS_RESOLVER.corpus).toBe('forms');
	});

	it('parses a known-good locator', () => {
		const result = FORMS_RESOLVER.parseLocator('8710-1');
		expect(result.kind).toBe('ok');
	});

	it('rejects a malformed locator', () => {
		const result = FORMS_RESOLVER.parseLocator('AC-100');
		expect(result.kind).toBe('error');
	});

	it('returns null live URL (no formula for FAA forms)', () => {
		const url = FORMS_RESOLVER.getLiveUrl('airboss-ref:forms/8710-1' as SourceId, '2020-08');
		expect(url).toBe(null);
	});

	it('returns null for getDerivativeContent (deferred)', () => {
		expect(FORMS_RESOLVER.getDerivativeContent('airboss-ref:forms/8710-1' as SourceId, 'n/a')).toBe(null);
	});

	it('returns null for getIndexedContent (deferred)', async () => {
		const content = await FORMS_RESOLVER.getIndexedContent('airboss-ref:forms/8710-1' as SourceId, 'n/a');
		expect(content).toBe(null);
	});

	it('returns empty editions for an unknown SourceId', async () => {
		const editions = await FORMS_RESOLVER.getEditions('airboss-ref:forms/8710-1' as SourceId);
		expect(editions).toEqual([]);
	});

	it('returns null current edition when no entries are registered', () => {
		expect(FORMS_RESOLVER.getCurrentEdition()).toBe(null);
	});
});
