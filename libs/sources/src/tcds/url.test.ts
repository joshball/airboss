import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { getTcdsLiveUrl } from './url.ts';

describe('getTcdsLiveUrl', () => {
	it('returns the TCDS landing page for a known-good locator', () => {
		const id = 'airboss-ref:tcds/3a12' as SourceId;
		const url = getTcdsLiveUrl(id, 'unspecified');
		expect(url).toContain('faa.gov');
		expect(url).toContain('typecertdatasheets');
	});

	it('strips the ?at= pin before parsing', () => {
		const id = 'airboss-ref:tcds/3a12?at=2024-08' as SourceId;
		const url = getTcdsLiveUrl(id, '2024-08');
		expect(url).toContain('faa.gov');
	});

	it('returns null for a non-tcds SourceId', () => {
		const id = 'airboss-ref:ac/61-65/j' as SourceId;
		expect(getTcdsLiveUrl(id, 'unspecified')).toBe(null);
	});

	it('returns null for a malformed tcds locator', () => {
		const id = 'airboss-ref:tcds/3A12' as SourceId;
		expect(getTcdsLiveUrl(id, 'unspecified')).toBe(null);
	});

	it('returns null for a multi-segment tcds locator', () => {
		const id = 'airboss-ref:tcds/3a12/extra' as SourceId;
		expect(getTcdsLiveUrl(id, 'unspecified')).toBe(null);
	});
});
