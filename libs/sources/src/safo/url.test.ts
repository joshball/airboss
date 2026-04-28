import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { getSafoLiveUrl } from './url.ts';

describe('getSafoLiveUrl', () => {
	it('returns the SAFO landing page for a known-good locator', () => {
		const id = 'airboss-ref:safo/23004' as SourceId;
		const url = getSafoLiveUrl(id, 'unspecified');
		expect(url).toContain('faa.gov');
		expect(url).toContain('safo');
	});

	it('strips the ?at= pin before parsing', () => {
		const id = 'airboss-ref:safo/23004?at=2023-04' as SourceId;
		const url = getSafoLiveUrl(id, '2023-04');
		expect(url).toContain('faa.gov');
	});

	it('returns null for a non-safo SourceId', () => {
		const id = 'airboss-ref:ac/61-65/j' as SourceId;
		expect(getSafoLiveUrl(id, 'unspecified')).toBe(null);
	});

	it('returns null for a malformed safo locator', () => {
		const id = 'airboss-ref:safo/23A04' as SourceId;
		expect(getSafoLiveUrl(id, 'unspecified')).toBe(null);
	});

	it('returns null for a multi-segment safo locator', () => {
		const id = 'airboss-ref:safo/23004/extra' as SourceId;
		expect(getSafoLiveUrl(id, 'unspecified')).toBe(null);
	});
});
