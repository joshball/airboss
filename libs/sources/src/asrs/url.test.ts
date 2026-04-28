import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { getAsrsLiveUrl } from './url.ts';

describe('getAsrsLiveUrl', () => {
	it('builds a deep-link URL for a 7-digit ACN', () => {
		const id = 'airboss-ref:asrs/1234567' as SourceId;
		const url = getAsrsLiveUrl(id, 'unspecified');
		expect(url).toBe('https://asrs.arc.nasa.gov/search/database.html?acn=1234567');
	});

	it('builds a deep-link URL for a 6-digit ACN', () => {
		const id = 'airboss-ref:asrs/987654' as SourceId;
		const url = getAsrsLiveUrl(id, 'unspecified');
		expect(url).toBe('https://asrs.arc.nasa.gov/search/database.html?acn=987654');
	});

	it('strips a ?at= pin before parsing', () => {
		const id = 'airboss-ref:asrs/1234567?at=2024' as SourceId;
		const url = getAsrsLiveUrl(id, '2024');
		expect(url).toBe('https://asrs.arc.nasa.gov/search/database.html?acn=1234567');
	});

	it('returns null for a non-asrs SourceId', () => {
		const id = 'airboss-ref:ac/61-65/j' as SourceId;
		expect(getAsrsLiveUrl(id, 'unspecified')).toBe(null);
	});

	it('returns null for a malformed asrs locator', () => {
		const id = 'airboss-ref:asrs/12345' as SourceId;
		expect(getAsrsLiveUrl(id, 'unspecified')).toBe(null);
	});

	it('returns null for a multi-segment asrs locator', () => {
		const id = 'airboss-ref:asrs/1234567/extra' as SourceId;
		expect(getAsrsLiveUrl(id, 'unspecified')).toBe(null);
	});
});
