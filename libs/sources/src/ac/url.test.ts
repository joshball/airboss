/**
 * Phase 8 -- AC live URL builder tests.
 *
 * Regression coverage for the correctness review (2026-05-01, finding #2):
 * the dot-style doc number (`91-21.1`) was previously composed verbatim into
 * `AC_91-21.1D.pdf`, but the FAA serves it as `AC_91.21-1D.pdf` (dot/dash
 * flipped). Ground truth: `scripts/sources/config/ac.yaml` row for
 * `ac-91-21-1d` ships URL `AC_91.21-1D.pdf`.
 */

import { describe, expect, it } from 'vitest';
import type { EditionId, SourceId } from '../types.ts';
import { acDocNumberToFaaFilename, getAcLiveUrl } from './url.ts';

describe('getAcLiveUrl', () => {
	it('builds the FAA URL for a simple AC', () => {
		const id = 'airboss-ref:ac/61-65/j' as SourceId;
		expect(getAcLiveUrl(id, '2024-10-30' as EditionId)).toBe(
			'https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_61-65J.pdf',
		);
	});

	it('flips dot/dash for dot-style doc numbers (91-21.1D -> AC_91.21-1D.pdf)', () => {
		// Confirmed against scripts/sources/config/ac.yaml -- ac-91-21-1d ships URL
		// AC_91.21-1D.pdf, not AC_91-21.1D.pdf.
		const id = 'airboss-ref:ac/91-21.1/d' as SourceId;
		expect(getAcLiveUrl(id, '2017-11-17' as EditionId)).toBe(
			'https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_91.21-1D.pdf',
		);
	});

	it('strips ?at= pin from the SourceId', () => {
		const id = 'airboss-ref:ac/61-65/j?at=2024-10-30' as SourceId;
		expect(getAcLiveUrl(id, '2024-10-30' as EditionId)).toBe(
			'https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_61-65J.pdf',
		);
	});

	it('returns null on non-ac SourceId', () => {
		const id = 'airboss-ref:aim/5-1-7' as SourceId;
		expect(getAcLiveUrl(id, '2026-09' as EditionId)).toBeNull();
	});
});

describe('acDocNumberToFaaFilename', () => {
	it('flips separators for dot-style numbers (91-21.1 -> 91.21-1)', () => {
		expect(acDocNumberToFaaFilename('91-21.1')).toBe('91.21-1');
	});

	it('passes simple dash-style numbers through unchanged (61-65)', () => {
		expect(acDocNumberToFaaFilename('61-65')).toBe('61-65');
	});

	it('passes plain numbers through unchanged (60-22)', () => {
		expect(acDocNumberToFaaFilename('60-22')).toBe('60-22');
	});
});
