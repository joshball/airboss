/**
 * Phase 8 -- AC live URL builder tests.
 */

import { describe, expect, it } from 'vitest';
import type { EditionId, SourceId } from '../types.ts';
import { getAcLiveUrl, toFaaDocFilename } from './url.ts';

describe('getAcLiveUrl', () => {
	it('builds the FAA URL for a simple AC', () => {
		const id = 'airboss-ref:ac/61-65/j' as SourceId;
		expect(getAcLiveUrl(id, '2024-10-30' as EditionId)).toBe(
			'https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_61-65J.pdf',
		);
	});

	it('builds the URL for a dotted-sub AC (swaps dash/dot per FAA convention)', () => {
		// Locator stores `91-21.1` (dash-then-dot), FAA serves `AC_91.21-1D.pdf`
		// (dot-then-dash). See scripts/sources/config/ac.yaml entry `ac-91-21-1d`.
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

	it('preserves dash-only doc numbers when revision letter follows', () => {
		// AC 60-22 has no revision in canonical form, but ADR 019 §1.2 rejects
		// unrevisioned ACs. Use 120-71B, a real dash-only AC with revision.
		const id = 'airboss-ref:ac/120-71/b' as SourceId;
		expect(getAcLiveUrl(id, '2014-09-19' as EditionId)).toBe(
			'https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_120-71B.pdf',
		);
	});

	it('returns null on non-ac SourceId', () => {
		const id = 'airboss-ref:aim/5-1-7' as SourceId;
		expect(getAcLiveUrl(id, '2026-09' as EditionId)).toBeNull();
	});
});

describe('toFaaDocFilename', () => {
	it('swaps dash/dot positions for dotted-sub doc numbers', () => {
		// `91-21.1` -> `91.21-1` (FAA convention -- dot moves from after the
		// second group to between the first two, dash moves to before the third).
		expect(toFaaDocFilename('91-21.1')).toBe('91.21-1');
	});

	it('passes through plain dash-separated doc numbers', () => {
		expect(toFaaDocFilename('61-65')).toBe('61-65');
		expect(toFaaDocFilename('60-22')).toBe('60-22');
		expect(toFaaDocFilename('120-71')).toBe('120-71');
		expect(toFaaDocFilename('00-6')).toBe('00-6');
	});

	it('passes through doc numbers without the dash-dot trailing pattern', () => {
		// `150-5210-7` is FAA slash-style (rejected at ingest, but the URL
		// builder must not corrupt it if it ever reaches us).
		expect(toFaaDocFilename('150-5210-7')).toBe('150-5210-7');
	});
});
