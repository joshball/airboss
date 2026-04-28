import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { getFormsLiveUrl } from './url.ts';

describe('getFormsLiveUrl', () => {
	it('returns null for a form number locator (no formula)', () => {
		const id = 'airboss-ref:forms/8710-1' as SourceId;
		expect(getFormsLiveUrl(id, 'unspecified')).toBe(null);
	});

	it('returns null even with edition pin', () => {
		const id = 'airboss-ref:forms/8710-1?at=2020-08' as SourceId;
		expect(getFormsLiveUrl(id, '2020-08')).toBe(null);
	});

	it('returns null for a form with revision letter', () => {
		const id = 'airboss-ref:forms/8060-4A' as SourceId;
		expect(getFormsLiveUrl(id, 'unspecified')).toBe(null);
	});

	it('returns null for a non-forms SourceId', () => {
		const id = 'airboss-ref:ac/61-65/j' as SourceId;
		expect(getFormsLiveUrl(id, 'unspecified')).toBe(null);
	});
});
