/**
 * Hermetic tests for cover-page slug + date scrapers. Builds in-memory
 * `ExtractedPage[]` -- no PDF required.
 */

import { describe, expect, it } from 'vitest';
import {
	findAcSlug,
	findAcsEditionSlug,
	findAnyEditionSlug,
	findEffectiveDate,
	findHandbookEditionSlug,
} from './identify.ts';
import type { ExtractedPage } from './types.ts';

function pages(...texts: string[]): ExtractedPage[] {
	return texts.map((text, i) => ({ pageNumber: i + 1, text }));
}

describe('findAcsEditionSlug', () => {
	it('finds a plain numbered ACS slug', () => {
		expect(findAcsEditionSlug(pages('Some text\nFAA-S-ACS-6\nMore text'))).toBe('FAA-S-ACS-6');
	});

	it('finds an ACS slug with revision letter', () => {
		expect(findAcsEditionSlug(pages('Header\nFAA-S-ACS-25\nbody'))).toBe('FAA-S-ACS-25');
		expect(findAcsEditionSlug(pages('Header\nFAA-S-ACS-6B\nbody'))).toBe('FAA-S-ACS-6B');
	});

	it('canonicalizes the revision letter to uppercase', () => {
		expect(findAcsEditionSlug(pages('faa-s-acs-8a'))).toBe('FAA-S-ACS-8A');
	});

	it('returns null when no slug is present', () => {
		expect(findAcsEditionSlug(pages('Lorem ipsum dolor sit amet'))).toBeNull();
	});

	it('returns the first match across pages', () => {
		const result = findAcsEditionSlug(pages('cover sheet only', 'FAA-S-ACS-7 follows on page 2'));
		expect(result).toBe('FAA-S-ACS-7');
	});

	it('does not match handbook or AC slugs', () => {
		expect(findAcsEditionSlug(pages('FAA-H-8083-25C'))).toBeNull();
		expect(findAcsEditionSlug(pages('AC 61-65J'))).toBeNull();
	});
});

describe('findHandbookEditionSlug', () => {
	it('finds 8083-NN or 8083-NNa slugs', () => {
		expect(findHandbookEditionSlug(pages('Pilot Handbook FAA-H-8083-25C'))).toBe('FAA-H-8083-25C');
		expect(findHandbookEditionSlug(pages('AFH FAA-H-8083-3C revision'))).toBe('FAA-H-8083-3C');
		expect(findHandbookEditionSlug(pages('FAA-H-8083-2'))).toBe('FAA-H-8083-2');
	});

	it('returns null for non-handbook slugs', () => {
		expect(findHandbookEditionSlug(pages('FAA-S-ACS-25 only'))).toBeNull();
	});
});

describe('findAcSlug', () => {
	it('finds an AC with dash separator', () => {
		expect(findAcSlug(pages('AC 61-65J Endorsements'))).toBe('AC 61-65J');
	});

	it('finds an AC with dot separator (e.g. 91.21-1D)', () => {
		expect(findAcSlug(pages('AC 91.21-1D Use of Portable Electronic Devices'))).toBe('AC 91.21-1D');
	});

	it('finds an AC without revision letter', () => {
		expect(findAcSlug(pages('AC 91-92 Pilot Briefing'))).toBe('AC 91-92');
	});

	it('returns null when no AC is present', () => {
		expect(findAcSlug(pages('FAA-H-8083-25C'))).toBeNull();
	});
});

describe('findAnyEditionSlug', () => {
	it('returns ACS first when both are present', () => {
		const result = findAnyEditionSlug(pages('FAA-S-ACS-25 and AC 61-65J'));
		expect(result).toEqual({ kind: 'acs', slug: 'FAA-S-ACS-25' });
	});

	it('falls back to handbook then AC', () => {
		expect(findAnyEditionSlug(pages('FAA-H-8083-25C'))).toEqual({
			kind: 'handbook',
			slug: 'FAA-H-8083-25C',
		});
		expect(findAnyEditionSlug(pages('AC 61-65J'))).toEqual({ kind: 'ac', slug: 'AC 61-65J' });
	});

	it('returns null when nothing matches', () => {
		expect(findAnyEditionSlug(pages('Generic body text'))).toBeNull();
	});
});

describe('findEffectiveDate', () => {
	it('parses "Effective May 31, 2024"', () => {
		expect(findEffectiveDate(pages('Effective May 31, 2024'))).toBe('2024-05-31');
	});

	it('parses "Effective: November 1, 2023"', () => {
		expect(findEffectiveDate(pages('Effective: November 1, 2023'))).toBe('2023-11-01');
	});

	it('parses "Effective Date: 5/31/2024"', () => {
		expect(findEffectiveDate(pages('Effective Date: 5/31/2024'))).toBe('2024-05-31');
	});

	it('parses "Effective: 11-01-2023"', () => {
		expect(findEffectiveDate(pages('Effective: 11-01-2023'))).toBe('2023-11-01');
	});

	it('handles two-digit years (assumes 21st century below 50)', () => {
		expect(findEffectiveDate(pages('Effective: 5/31/24'))).toBe('2024-05-31');
		expect(findEffectiveDate(pages('Effective: 5/31/99'))).toBe('1999-05-31');
	});

	it('is case-insensitive on the keyword', () => {
		expect(findEffectiveDate(pages('EFFECTIVE may 31, 2024'))).toBe('2024-05-31');
	});

	it('returns null when no date is present', () => {
		expect(findEffectiveDate(pages('Some content with no effective date'))).toBeNull();
	});

	it('returns null on an unrecognized month', () => {
		expect(findEffectiveDate(pages('Effective Smarch 31, 2024'))).toBeNull();
	});

	it('searches across pages', () => {
		const result = findEffectiveDate(pages('cover only', 'body without date', 'Effective: October 5, 2025'));
		expect(result).toBe('2025-10-05');
	});

	// AC fallback: cover pages often use "Date: M/D/YY" next to "AC No:"
	// instead of "Effective:". Mirror the real AC 61-65J header layout.
	it('finds AC-style "Date: 10/30/24" when AC No is nearby', () => {
		const acHeader = 'Subject: Certification: Pilots and Flight and    Date: 10/30/24            AC No: 61-65J';
		expect(findEffectiveDate(pages(acHeader))).toBe('2024-10-30');
	});

	it('does NOT match a bare "Date:" without AC No nearby', () => {
		expect(findEffectiveDate(pages('Some random Date: 10/30/24 in non-AC content'))).toBeNull();
	});

	it('prefers "Effective" over "Date:" when both appear', () => {
		const text = 'Effective: November 1, 2023\n...\nDate: 10/30/24 AC No: 61-65J';
		expect(findEffectiveDate(pages(text))).toBe('2023-11-01');
	});
});
