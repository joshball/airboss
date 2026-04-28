/**
 * Phase 8 -- AC live URL builder tests.
 */

import { describe, expect, it } from 'vitest';
import type { EditionId, SourceId } from '../types.ts';
import { getAcLiveUrl } from './url.ts';

describe('getAcLiveUrl', () => {
	it('builds the FAA URL for a simple AC', () => {
		const id = 'airboss-ref:ac/61-65/j' as SourceId;
		expect(getAcLiveUrl(id, '2024-10-30' as EditionId)).toBe(
			'https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_61-65J.pdf',
		);
	});

	it('builds the URL for a dotted-sub AC', () => {
		const id = 'airboss-ref:ac/91-21.1/d' as SourceId;
		expect(getAcLiveUrl(id, '2017-11-17' as EditionId)).toBe(
			'https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_91-21.1D.pdf',
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
