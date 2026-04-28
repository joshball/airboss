import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { getInterpLiveUrl } from './url.ts';

describe('getInterpLiveUrl', () => {
	it('returns the chief-counsel landing page for a chief-counsel locator', () => {
		const id = 'airboss-ref:interp/chief-counsel/mangiamele-2009' as SourceId;
		const url = getInterpLiveUrl(id, 'unspecified');
		expect(url).toContain('faa.gov');
		expect(url).toContain('interpretations');
	});

	it('returns the NTSB appeals page for an ntsb locator', () => {
		const id = 'airboss-ref:interp/ntsb/administrator-v-lobeiko' as SourceId;
		const url = getInterpLiveUrl(id, 'unspecified');
		expect(url).toContain('ntsb.gov');
		expect(url).toContain('aviation_appeals');
	});

	it('strips the ?at= pin before parsing', () => {
		const id = 'airboss-ref:interp/chief-counsel/mangiamele-2009?at=2009-12' as SourceId;
		const url = getInterpLiveUrl(id, '2009-12');
		expect(url).toContain('faa.gov');
	});

	it('returns null for a non-interp SourceId', () => {
		const id = 'airboss-ref:ac/61-65/j' as SourceId;
		expect(getInterpLiveUrl(id, 'unspecified')).toBe(null);
	});

	it('returns null for a malformed interp locator', () => {
		const id = 'airboss-ref:interp/ombudsman/foo-2020' as SourceId;
		expect(getInterpLiveUrl(id, 'unspecified')).toBe(null);
	});

	it('returns null for an interp locator missing slug', () => {
		const id = 'airboss-ref:interp/chief-counsel' as SourceId;
		expect(getInterpLiveUrl(id, 'unspecified')).toBe(null);
	});
});
