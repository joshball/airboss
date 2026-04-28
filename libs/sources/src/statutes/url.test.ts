import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { getStatutesLiveUrl } from './url.ts';

describe('getStatutesLiveUrl', () => {
	it('builds a section URL', () => {
		const id = 'airboss-ref:statutes/usc-49/40103' as SourceId;
		const url = getStatutesLiveUrl(id, 'unspecified');
		expect(url).toContain('uscode.house.gov');
		expect(url).toContain('USC-prelim-title49-section40103');
	});

	it('builds a section URL with subsection anchor', () => {
		const id = 'airboss-ref:statutes/usc-49/44102/a' as SourceId;
		const url = getStatutesLiveUrl(id, 'unspecified');
		expect(url).toContain('USC-prelim-title49-section44102');
		expect(url?.endsWith('#a')).toBe(true);
	});

	it('strips the ?at= pin before parsing', () => {
		const id = 'airboss-ref:statutes/usc-49/40103?at=2024' as SourceId;
		const url = getStatutesLiveUrl(id, '2024');
		expect(url).toContain('uscode.house.gov');
	});

	it('handles a single-digit title', () => {
		const id = 'airboss-ref:statutes/usc-5/552' as SourceId;
		const url = getStatutesLiveUrl(id, 'unspecified');
		expect(url).toContain('title5-section552');
	});

	it('returns null for a non-statutes SourceId', () => {
		const id = 'airboss-ref:ac/61-65/j' as SourceId;
		expect(getStatutesLiveUrl(id, 'unspecified')).toBe(null);
	});

	it('returns null for a malformed statutes locator', () => {
		const id = 'airboss-ref:statutes/usc-49' as SourceId;
		expect(getStatutesLiveUrl(id, 'unspecified')).toBe(null);
	});
});
