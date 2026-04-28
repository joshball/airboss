import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { getInfoLiveUrl } from './url.ts';

describe('getInfoLiveUrl', () => {
	it('returns the InFO landing page for a known-good locator', () => {
		const id = 'airboss-ref:info/21010' as SourceId;
		const url = getInfoLiveUrl(id, 'unspecified');
		expect(url).toContain('faa.gov');
		expect(url).toContain('info');
	});

	it('strips the ?at= pin before parsing', () => {
		const id = 'airboss-ref:info/21010?at=2021-04' as SourceId;
		const url = getInfoLiveUrl(id, '2021-04');
		expect(url).toContain('faa.gov');
	});

	it('returns null for a non-info SourceId', () => {
		const id = 'airboss-ref:ac/61-65/j' as SourceId;
		expect(getInfoLiveUrl(id, 'unspecified')).toBe(null);
	});

	it('returns null for a malformed info locator', () => {
		const id = 'airboss-ref:info/21A10' as SourceId;
		expect(getInfoLiveUrl(id, 'unspecified')).toBe(null);
	});

	it('returns null for a multi-segment info locator', () => {
		const id = 'airboss-ref:info/21010/extra' as SourceId;
		expect(getInfoLiveUrl(id, 'unspecified')).toBe(null);
	});
});
