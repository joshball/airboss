/**
 * Card-completeness validator tests.
 *
 * Three concerns:
 *   1. Required-field detection: null, undefined, "", "   " all count.
 *   2. Variant coverage: every CardVariant in the union has entries in
 *      both REQUIRED + RECOMMENDED tables. A new variant added without
 *      updating the tables fails this guard.
 *   3. enforceCardComplete throws / swallows per the dev/prod toggle.
 */

import { describe, expect, it } from 'vitest';
import {
	assertCardComplete,
	CardDataMissingError,
	type CardVariant,
	enforceCardComplete,
	RECOMMENDED_FIELDS_BY_VARIANT,
	REQUIRED_FIELDS_BY_VARIANT,
	validateCardData,
} from './validation';

const ALL_VARIANTS: readonly CardVariant[] = [
	'CfrTitleCard',
	'CfrPartCard',
	'CfrSectionCard',
	'AimCorpusCard',
	'AcCard',
	'AcsCard',
	'PtsCard',
	'SafoCard',
	'InfoCard',
	'PohCard',
	'NtsbCard',
	'HandbookCard',
	'UmbrellaCard',
];

describe('validateCardData', () => {
	it('null, undefined, empty string, and whitespace-only count as missing', () => {
		const result = validateCardData('CfrPartCard', 'subject', {
			titleNumber: null,
			partNumber: undefined,
			partTitle: '   ',
			external: null,
		});
		expect(result.missingRequired.sort()).toEqual(['external', 'partNumber', 'partTitle', 'titleNumber'].sort());
	});

	it('non-empty values pass even when type is unexpected (we only check missing-ness here)', () => {
		const result = validateCardData('CfrPartCard', 'subject', {
			titleNumber: 14,
			partNumber: '91',
			partTitle: 'General Operating Rules',
			external: { url: 'https://www.ecfr.gov/current/title-14/part-91', label: 'eCFR' },
		});
		expect(result.missingRequired).toEqual([]);
	});

	it('separates missing-required from missing-recommended', () => {
		const result = validateCardData('CfrPartCard', 'subject', {
			titleNumber: 14,
			partNumber: '91',
			partTitle: 'General Operating Rules',
			external: { url: 'https://www.ecfr.gov/current/title-14/part-91', label: 'eCFR' },
			description: '',
			whyItMatters: null,
		});
		expect(result.missingRequired).toEqual([]);
		expect(result.missingRecommended.sort()).toEqual(['description', 'whyItMatters'].sort());
	});

	it('returns the variant + subject untouched for diagnostics', () => {
		const result = validateCardData('AcCard', 'AC 91-21', {});
		expect(result.variant).toBe('AcCard');
		expect(result.subject).toBe('AC 91-21');
	});
});

describe('variant coverage', () => {
	it('every variant has an entry in the required table', () => {
		for (const v of ALL_VARIANTS) {
			expect(REQUIRED_FIELDS_BY_VARIANT[v], `${v} missing required-fields entry`).toBeDefined();
		}
	});

	it('every variant has an entry in the recommended table', () => {
		for (const v of ALL_VARIANTS) {
			expect(RECOMMENDED_FIELDS_BY_VARIANT[v], `${v} missing recommended-fields entry`).toBeDefined();
		}
	});

	it('UmbrellaCard requires only `title` -- it is the tolerant fallback', () => {
		// Locks the contract: a freshly-ingested corpus that has not yet had
		// copy authored should not crash a page that renders it through the
		// umbrella fallback.
		expect(REQUIRED_FIELDS_BY_VARIANT.UmbrellaCard).toEqual(['title']);
	});

	it('CfrTitleCard demands description + whyItMatters -- the kind-copy registry must always be complete', () => {
		expect(REQUIRED_FIELDS_BY_VARIANT.CfrTitleCard).toContain('description');
		expect(REQUIRED_FIELDS_BY_VARIANT.CfrTitleCard).toContain('whyItMatters');
	});
});

describe('assertCardComplete', () => {
	it('throws CardDataMissingError when a required field is missing', () => {
		expect(() => assertCardComplete('CfrPartCard', '14 CFR Part 91', { titleNumber: 14 })).toThrow(
			CardDataMissingError,
		);
	});

	it('error names the variant + subject + missing fields', () => {
		try {
			assertCardComplete('CfrPartCard', '14 CFR Part 91', {});
			throw new Error('expected throw');
		} catch (err) {
			expect(err).toBeInstanceOf(CardDataMissingError);
			const e = err as CardDataMissingError;
			expect(e.message).toContain('CfrPartCard');
			expect(e.message).toContain('14 CFR Part 91');
			expect(e.message).toContain('titleNumber');
			expect(e.message).toContain('partNumber');
			expect(e.message).toContain('partTitle');
		}
	});

	it('does not throw when every required field is populated', () => {
		expect(() =>
			assertCardComplete('CfrPartCard', '14 CFR Part 91', {
				titleNumber: 14,
				partNumber: '91',
				partTitle: 'General Operating Rules',
				external: { url: 'https://www.ecfr.gov/current/title-14/part-91', label: 'eCFR' },
			}),
		).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// CFR `external` (eCFR canonical URL) requirement
//
// Every CFR variant carries `external` as a required field. The URL is built
// by `buildEcfrUrl` / `buildPartUrl` / `buildSectionUrl` in
// libs/sources/src/regs/nav-tree.ts -- those helpers always return a
// non-null URL (they fall back to the eCFR shortcut form when the nav-tree
// YAML is missing), so a missing `external` is a wiring bug.
// ---------------------------------------------------------------------------

describe('CFR external requirement', () => {
	it('CfrTitleCard requires external', () => {
		expect(REQUIRED_FIELDS_BY_VARIANT.CfrTitleCard).toContain('external');
	});

	it('CfrPartCard requires external', () => {
		expect(REQUIRED_FIELDS_BY_VARIANT.CfrPartCard).toContain('external');
	});

	it('CfrSectionCard requires external', () => {
		expect(REQUIRED_FIELDS_BY_VARIANT.CfrSectionCard).toContain('external');
	});

	it('an external object missing url counts as missing', () => {
		const result = validateCardData('CfrPartCard', 'subject', {
			titleNumber: 14,
			partNumber: '91',
			partTitle: 'General',
			external: { url: '', label: 'eCFR' },
		});
		expect(result.missingRequired).toContain('external');
	});

	it('an external object missing label counts as missing', () => {
		const result = validateCardData('CfrPartCard', 'subject', {
			titleNumber: 14,
			partNumber: '91',
			partTitle: 'General',
			external: { url: 'https://example.com', label: '' },
		});
		expect(result.missingRequired).toContain('external');
	});

	it('a complete external object passes', () => {
		const result = validateCardData('CfrSectionCard', '§91.103', {
			partNumber: '91',
			sectionCode: '91.103',
			sectionTitle: 'Preflight action',
			external: {
				url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-91/section-91.103',
				label: 'eCFR',
			},
		});
		expect(result.missingRequired).toEqual([]);
	});

	it('non-CFR variants do not require external (recommended at most)', () => {
		expect(REQUIRED_FIELDS_BY_VARIANT.AcCard).not.toContain('external');
		expect(REQUIRED_FIELDS_BY_VARIANT.AimCorpusCard).not.toContain('external');
		expect(REQUIRED_FIELDS_BY_VARIANT.NtsbCard).not.toContain('external');
		expect(REQUIRED_FIELDS_BY_VARIANT.HandbookCard).not.toContain('external');
		expect(REQUIRED_FIELDS_BY_VARIANT.UmbrellaCard).not.toContain('external');
		expect(REQUIRED_FIELDS_BY_VARIANT.AcsCard).not.toContain('external');
		expect(REQUIRED_FIELDS_BY_VARIANT.PtsCard).not.toContain('external');
		expect(REQUIRED_FIELDS_BY_VARIANT.SafoCard).not.toContain('external');
		expect(REQUIRED_FIELDS_BY_VARIANT.InfoCard).not.toContain('external');
		expect(REQUIRED_FIELDS_BY_VARIANT.PohCard).not.toContain('external');
	});
});

// ---------------------------------------------------------------------------
// Wave-2 corpus wrappers: ACS / PTS / SAFO / InFO / POH
//
// Each variant has its own required-field shape. Lock the contract here so
// adding a sixth variant later won't accidentally drift one of these.
// ---------------------------------------------------------------------------

describe('Wave-2 corpus wrappers', () => {
	it('AcsCard requires slug + title + edition; recommends description + whyItMatters', () => {
		expect(REQUIRED_FIELDS_BY_VARIANT.AcsCard).toEqual(['slug', 'title', 'edition']);
		expect(RECOMMENDED_FIELDS_BY_VARIANT.AcsCard).toEqual(['description', 'whyItMatters']);
	});

	it('PtsCard requires slug + title + edition; recommends description', () => {
		expect(REQUIRED_FIELDS_BY_VARIANT.PtsCard).toEqual(['slug', 'title', 'edition']);
		expect(RECOMMENDED_FIELDS_BY_VARIANT.PtsCard).toEqual(['description']);
	});

	it('SafoCard requires safoNumber + title; recommends summary + date + audience', () => {
		expect(REQUIRED_FIELDS_BY_VARIANT.SafoCard).toEqual(['safoNumber', 'title']);
		expect(RECOMMENDED_FIELDS_BY_VARIANT.SafoCard).toEqual(['summary', 'date', 'audience']);
	});

	it('InfoCard requires infoNumber + title; recommends summary + date + audience', () => {
		expect(REQUIRED_FIELDS_BY_VARIANT.InfoCard).toEqual(['infoNumber', 'title']);
		expect(RECOMMENDED_FIELDS_BY_VARIANT.InfoCard).toEqual(['summary', 'date', 'audience']);
	});

	it('PohCard requires aircraftModel + title + revision; recommends description', () => {
		expect(REQUIRED_FIELDS_BY_VARIANT.PohCard).toEqual(['aircraftModel', 'title', 'revision']);
		expect(RECOMMENDED_FIELDS_BY_VARIANT.PohCard).toEqual(['description']);
	});

	it('a complete AcsCard fixture validates clean', () => {
		const result = validateCardData('AcsCard', 'FAA-S-ACS-6B', {
			slug: 'faa-s-acs-6b',
			title: 'Private Pilot - Airplane Airman Certification Standards',
			edition: 'FAA-S-ACS-6B',
			description: 'FAA test guide for the private pilot airplane practical test.',
			whyItMatters: 'This is exactly what your DPE expects you to know on checkride day.',
		});
		expect(result.missingRequired).toEqual([]);
		expect(result.missingRecommended).toEqual([]);
	});

	it('a complete SafoCard fixture validates clean', () => {
		const result = validateCardData('SafoCard', 'SAFO 23001', {
			safoNumber: 'SAFO 23001',
			title: 'Helicopter Pilot Decision-Making in Whiteout Conditions',
			date: '2023-01-12',
			summary: 'Recommended whiteout-recognition procedures for rotorcraft operators.',
			audience: 'Air carriers',
		});
		expect(result.missingRequired).toEqual([]);
		expect(result.missingRecommended).toEqual([]);
	});

	it('a complete PohCard fixture validates clean', () => {
		const result = validateCardData('PohCard', 'Cessna 172S', {
			aircraftModel: 'Cessna 172S',
			title: 'Cessna 172S Pilot Operating Handbook',
			revision: '13',
			description: 'Manufacturer POH for the Cessna 172S Skyhawk.',
		});
		expect(result.missingRequired).toEqual([]);
		expect(result.missingRecommended).toEqual([]);
	});

	it('a missing required field on AcsCard surfaces in missingRequired', () => {
		const result = validateCardData('AcsCard', 'subject', {
			slug: 'faa-s-acs-6b',
			title: '',
			edition: 'B',
		});
		expect(result.missingRequired).toEqual(['title']);
	});
});

describe('enforceCardComplete', () => {
	it('throws when throwOnMissing is true', () => {
		expect(() => enforceCardComplete('CfrPartCard', 'subject', {}, { throwOnMissing: true })).toThrow(
			CardDataMissingError,
		);
	});

	it('returns the result when throwOnMissing is false', () => {
		const result = enforceCardComplete('CfrPartCard', 'subject', {}, { throwOnMissing: false });
		expect(result.missingRequired.length).toBeGreaterThan(0);
		// Did not throw -- we got here.
		expect(result.subject).toBe('subject');
	});
});
