import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { getHandbooksLiveUrl } from './url.ts';

describe('getHandbooksLiveUrl', () => {
	it('returns the PHAK landing URL for a section', () => {
		expect(getHandbooksLiveUrl('airboss-ref:handbooks/phak/8083-25C/12/3' as SourceId, '8083-25C')).toBe(
			'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak',
		);
	});

	it('returns the PHAK landing URL for a chapter', () => {
		expect(getHandbooksLiveUrl('airboss-ref:handbooks/phak/8083-25C/12' as SourceId, '8083-25C')).toBe(
			'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak',
		);
	});

	it('returns the AFH landing URL', () => {
		expect(getHandbooksLiveUrl('airboss-ref:handbooks/afh/8083-3C/5/intro' as SourceId, '8083-3C')).toBe(
			'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/airplane_handbook',
		);
	});

	it('returns the AvWX landing URL', () => {
		expect(getHandbooksLiveUrl('airboss-ref:handbooks/avwx/8083-28B/3/2' as SourceId, '8083-28B')).toBe(
			'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/aviation_weather_handbook',
		);
	});

	it('returns the landing URL for a figure locator', () => {
		expect(getHandbooksLiveUrl('airboss-ref:handbooks/phak/8083-25C/fig-12-7' as SourceId, '8083-25C')).toBe(
			'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak',
		);
	});

	it('returns null for a malformed SourceId', () => {
		expect(getHandbooksLiveUrl('airboss-ref:handbooks/xfh/abc' as SourceId, '8083-25C')).toBeNull();
	});

	it('returns null for a non-handbooks SourceId', () => {
		expect(getHandbooksLiveUrl('airboss-ref:regs/cfr-14/91/103' as SourceId, '2026')).toBeNull();
	});

	it('strips ?at= pin before parsing', () => {
		expect(getHandbooksLiveUrl('airboss-ref:handbooks/phak/8083-25C/12/3?at=8083-25C' as SourceId, '8083-25C')).toBe(
			'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak',
		);
	});
});
