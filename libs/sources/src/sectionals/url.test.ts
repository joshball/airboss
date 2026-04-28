import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { getSectionalsLiveUrl } from './url.ts';

describe('getSectionalsLiveUrl', () => {
	it('returns the AeroNav VFR landing page for a chart locator', () => {
		const id = 'airboss-ref:sectionals/denver' as SourceId;
		const url = getSectionalsLiveUrl(id, 'unspecified');
		expect(url).toContain('faa.gov');
		expect(url).toContain('vfr');
	});

	it('strips the ?at= pin before parsing', () => {
		const id = 'airboss-ref:sectionals/denver?at=2026-04-23' as SourceId;
		const url = getSectionalsLiveUrl(id, '2026-04-23');
		expect(url).toContain('faa.gov');
	});

	it('returns null for a non-sectionals SourceId', () => {
		const id = 'airboss-ref:ac/61-65/j' as SourceId;
		expect(getSectionalsLiveUrl(id, 'unspecified')).toBe(null);
	});

	it('returns null for a malformed sectionals locator', () => {
		const id = 'airboss-ref:sectionals/Denver' as SourceId;
		expect(getSectionalsLiveUrl(id, 'unspecified')).toBe(null);
	});

	it('returns null for an empty sectionals locator', () => {
		const id = 'airboss-ref:sectionals/denver/north' as SourceId;
		expect(getSectionalsLiveUrl(id, 'unspecified')).toBe(null);
	});
});
