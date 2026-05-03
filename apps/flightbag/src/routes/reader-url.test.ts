import { REFERENCE_KINDS, ROUTES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { readerUrlFor } from './reader-url';

describe('readerUrlFor', () => {
	it('maps a handbook to FLIGHTBAG_HANDBOOK -- strips the FAA-H- prefix from the edition', () => {
		expect(readerUrlFor(REFERENCE_KINDS.HANDBOOK, 'phak', 'FAA-H-8083-25C')).toBe(
			ROUTES.FLIGHTBAG_HANDBOOK('phak', '8083-25C'),
		);
	});

	it('passes a non-FAA-H handbook edition through unchanged', () => {
		expect(readerUrlFor(REFERENCE_KINDS.HANDBOOK, 'tips-mountain-flying', 'mtn-2003')).toBe(
			ROUTES.FLIGHTBAG_HANDBOOK('tips-mountain-flying', 'mtn-2003'),
		);
	});

	it('maps the AIM to the AIM landing', () => {
		expect(readerUrlFor(REFERENCE_KINDS.AIM, 'aim', '2026-04')).toBe(ROUTES.FLIGHTBAG_AIM);
	});

	it('maps a 14 CFR Part to FLIGHTBAG_CFR_PART', () => {
		expect(readerUrlFor(REFERENCE_KINDS.CFR, '14cfr91', 'current')).toBe(ROUTES.FLIGHTBAG_CFR_PART('14', '91'));
	});

	it('maps a 49 CFR Part to FLIGHTBAG_CFR_PART', () => {
		expect(readerUrlFor(REFERENCE_KINDS.CFR, '49cfr830', 'current')).toBe(ROUTES.FLIGHTBAG_CFR_PART('49', '830'));
	});

	it('maps an AC to FLIGHTBAG_AC -- strips the `ac-` slug prefix and lowercases the rev letter', () => {
		expect(readerUrlFor(REFERENCE_KINDS.AC, 'ac-61-65', 'AC 61-65J')).toBe(ROUTES.FLIGHTBAG_AC('61-65', 'j'));
	});

	it('maps an ACS publication to FLIGHTBAG_ACS', () => {
		expect(readerUrlFor(REFERENCE_KINDS.ACS, 'ppl-airplane-acs-6c', 'FAA-S-ACS-6C')).toBe(
			ROUTES.FLIGHTBAG_ACS('ppl-airplane-acs-6c'),
		);
	});

	it('returns null for kinds without a flightbag route (NTSB, POH umbrella, OTHER)', () => {
		expect(readerUrlFor(REFERENCE_KINDS.NTSB, 'ntsb', 'archive')).toBeNull();
		expect(readerUrlFor(REFERENCE_KINDS.POH, 'poh-afm', 'aircraft-specific')).toBeNull();
		expect(readerUrlFor(REFERENCE_KINDS.OTHER, 'jeppesen-faa-charts', 'current')).toBeNull();
	});

	it('returns null for an AC whose edition has no trailing revision letter', () => {
		expect(readerUrlFor(REFERENCE_KINDS.AC, 'ac-99-99', '99-99')).toBeNull();
	});

	it('returns null for a malformed CFR slug', () => {
		expect(readerUrlFor(REFERENCE_KINDS.CFR, 'not-a-cfr-slug', 'current')).toBeNull();
	});
});
