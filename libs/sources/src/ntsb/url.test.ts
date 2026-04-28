import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { getNtsbLiveUrl } from './url.ts';

describe('getNtsbLiveUrl', () => {
	it('builds a CAROL search URL for an NTSB ID', () => {
		const url = getNtsbLiveUrl('airboss-ref:ntsb/WPR23LA123' as SourceId, 'unspecified');
		expect(url).toBe('https://data.ntsb.gov/carol-main-public/basic-search?queryString=WPR23LA123');
	});

	it('appends a fragment for the named section', () => {
		const url = getNtsbLiveUrl('airboss-ref:ntsb/CEN24FA045/probable-cause' as SourceId, 'unspecified');
		expect(url).toBe('https://data.ntsb.gov/carol-main-public/basic-search?queryString=CEN24FA045#probable-cause');
	});

	it('returns null for a non-ntsb SourceId', () => {
		const url = getNtsbLiveUrl('airboss-ref:ac/61-65/j' as SourceId, 'unspecified');
		expect(url).toBe(null);
	});

	it('returns null for a malformed ntsb locator', () => {
		const url = getNtsbLiveUrl('airboss-ref:ntsb/WPR23' as SourceId, 'unspecified');
		expect(url).toBe(null);
	});
});
