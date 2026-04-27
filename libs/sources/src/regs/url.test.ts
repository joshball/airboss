import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { getRegsLiveUrl } from './url.ts';

describe('getRegsLiveUrl', () => {
	describe('current edition', () => {
		it('builds a section URL', () => {
			const url = getRegsLiveUrl('airboss-ref:regs/cfr-14/91/103' as SourceId, '2026', {
				isCurrent: true,
			});
			expect(url).toBe('https://www.ecfr.gov/current/title-14/part-91/section-91.103');
		});

		it('builds a subpart URL with uppercased letter', () => {
			const url = getRegsLiveUrl('airboss-ref:regs/cfr-14/91/subpart-b' as SourceId, '2026', {
				isCurrent: true,
			});
			expect(url).toBe('https://www.ecfr.gov/current/title-14/part-91/subpart-B');
		});

		it('builds a Part-level URL', () => {
			const url = getRegsLiveUrl('airboss-ref:regs/cfr-14/91' as SourceId, '2026', {
				isCurrent: true,
			});
			expect(url).toBe('https://www.ecfr.gov/current/title-14/part-91');
		});

		it('builds a 49 CFR section URL', () => {
			const url = getRegsLiveUrl('airboss-ref:regs/cfr-49/830/5' as SourceId, '2026', {
				isCurrent: true,
			});
			expect(url).toBe('https://www.ecfr.gov/current/title-49/part-830/section-830.5');
		});
	});

	describe('past edition', () => {
		it('uses /on/<snapshotDate>/', () => {
			const url = getRegsLiveUrl('airboss-ref:regs/cfr-14/91/103' as SourceId, '2024', {
				isCurrent: false,
				snapshotDate: '2024-01-01',
			});
			expect(url).toBe('https://www.ecfr.gov/on/2024-01-01/title-14/part-91/section-91.103');
		});

		it('falls back to edition slug when snapshotDate omitted', () => {
			const url = getRegsLiveUrl('airboss-ref:regs/cfr-14/91/103' as SourceId, '2024-01-01', {
				isCurrent: false,
			});
			expect(url).toBe('https://www.ecfr.gov/on/2024-01-01/title-14/part-91/section-91.103');
		});
	});

	describe('strips pin from input', () => {
		it('handles ?at= in the SourceId', () => {
			const url = getRegsLiveUrl('airboss-ref:regs/cfr-14/91/103?at=2026' as SourceId, '2026', {
				isCurrent: true,
			});
			expect(url).toBe('https://www.ecfr.gov/current/title-14/part-91/section-91.103');
		});
	});

	describe('returns null', () => {
		it('on a non-regs SourceId', () => {
			const url = getRegsLiveUrl('airboss-ref:aim/5-1-7' as SourceId, '2026', { isCurrent: true });
			expect(url).toBeNull();
		});

		it('on a malformed regs SourceId', () => {
			const url = getRegsLiveUrl('airboss-ref:regs/cfr-14/abc' as SourceId, '2026', { isCurrent: true });
			expect(url).toBeNull();
		});
	});
});
