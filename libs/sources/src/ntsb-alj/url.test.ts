import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { getNtsbAljLiveUrl } from './url.ts';

describe('getNtsbAljLiveUrl', () => {
	it('returns the NTSB-OALJ landing page for a known-good locator', () => {
		const id = 'airboss-ref:ntsb-alj/ea-5567' as SourceId;
		const url = getNtsbAljLiveUrl(id, 'unspecified');
		expect(url).toContain('ntsb.gov');
		expect(url).toContain('alj');
	});

	it('strips the ?at= pin before parsing', () => {
		const id = 'airboss-ref:ntsb-alj/ea-5567?at=2018-03' as SourceId;
		const url = getNtsbAljLiveUrl(id, '2018-03');
		expect(url).toContain('ntsb.gov');
	});

	it('handles a locator with a section segment', () => {
		const id = 'airboss-ref:ntsb-alj/ea-5567/findings-of-fact' as SourceId;
		const url = getNtsbAljLiveUrl(id, 'unspecified');
		expect(url).toContain('ntsb.gov');
	});

	it('returns null for a non-ntsb-alj SourceId', () => {
		const id = 'airboss-ref:ac/61-65/j' as SourceId;
		expect(getNtsbAljLiveUrl(id, 'unspecified')).toBe(null);
	});

	it('returns null for a malformed locator', () => {
		const id = 'airboss-ref:ntsb-alj/xy-1234' as SourceId;
		expect(getNtsbAljLiveUrl(id, 'unspecified')).toBe(null);
	});

	it('returns null for an empty locator', () => {
		const id = 'airboss-ref:ntsb-alj/' as SourceId;
		expect(getNtsbAljLiveUrl(id, 'unspecified')).toBe(null);
	});
});
