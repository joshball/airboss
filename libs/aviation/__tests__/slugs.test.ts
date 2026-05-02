/**
 * Unit tests for `/library/*` slug-shape parsers.
 *
 * The parsers don't touch the database -- they enforce the shape of a URL
 * fragment so the route loader can fail fast with a 404 before issuing a
 * lookup. These tests cover the happy path and the most common shape
 * mismatches per parser.
 */

import { LIBRARY_REGULATIONS_KINDS } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import {
	parseAircraftSlug,
	parseCertSlug,
	parseHandbookChapter,
	parseHandbookSection,
	parseHandbookSlug,
	parseRegulationGroup,
	parseRegulationKind,
	parseRegulationSection,
} from '../src/slugs';

describe('parseRegulationKind', () => {
	it('accepts every member of the closed enum', () => {
		expect(parseRegulationKind(LIBRARY_REGULATIONS_KINDS.CFR_14)).toBe(LIBRARY_REGULATIONS_KINDS.CFR_14);
		expect(parseRegulationKind(LIBRARY_REGULATIONS_KINDS.CFR_49)).toBe(LIBRARY_REGULATIONS_KINDS.CFR_49);
		expect(parseRegulationKind(LIBRARY_REGULATIONS_KINDS.AIM)).toBe(LIBRARY_REGULATIONS_KINDS.AIM);
		expect(parseRegulationKind(LIBRARY_REGULATIONS_KINDS.AC)).toBe(LIBRARY_REGULATIONS_KINDS.AC);
		expect(parseRegulationKind(LIBRARY_REGULATIONS_KINDS.NTSB)).toBe(LIBRARY_REGULATIONS_KINDS.NTSB);
	});

	it('rejects values outside the enum', () => {
		expect(parseRegulationKind('faa')).toBeNull();
		expect(parseRegulationKind('')).toBeNull();
		expect(parseRegulationKind('14_cfr')).toBeNull();
	});
});

describe('parseRegulationGroup', () => {
	it('accepts digit-only Part numbers for CFR kinds', () => {
		expect(parseRegulationGroup(LIBRARY_REGULATIONS_KINDS.CFR_14, '91')).toBe('91');
		expect(parseRegulationGroup(LIBRARY_REGULATIONS_KINDS.CFR_49, '830')).toBe('830');
		expect(parseRegulationGroup(LIBRARY_REGULATIONS_KINDS.AC, '120')).toBe('120');
	});

	it('accepts kebab slugs for AIM and NTSB', () => {
		expect(parseRegulationGroup(LIBRARY_REGULATIONS_KINDS.AIM, 'pcg')).toBe('pcg');
		expect(parseRegulationGroup(LIBRARY_REGULATIONS_KINDS.NTSB, 'ntsb-830')).toBe('ntsb-830');
	});

	it('rejects mixed-shape inputs for CFR/AC', () => {
		expect(parseRegulationGroup(LIBRARY_REGULATIONS_KINDS.CFR_14, 'part-91')).toBeNull();
		expect(parseRegulationGroup(LIBRARY_REGULATIONS_KINDS.AC, 'AC-91')).toBeNull();
		expect(parseRegulationGroup(LIBRARY_REGULATIONS_KINDS.CFR_49, '')).toBeNull();
	});

	it('rejects uppercase / leading-hyphen / unicode for AIM and NTSB', () => {
		expect(parseRegulationGroup(LIBRARY_REGULATIONS_KINDS.AIM, 'PCG')).toBeNull();
		expect(parseRegulationGroup(LIBRARY_REGULATIONS_KINDS.NTSB, '-ntsb')).toBeNull();
		expect(parseRegulationGroup(LIBRARY_REGULATIONS_KINDS.AIM, 'pcg_part')).toBeNull();
	});
});

describe('parseRegulationSection', () => {
	it('splits a chapter.section pair', () => {
		expect(parseRegulationSection('91.103')).toEqual({ chapterCode: '91', sectionCode: '103' });
		expect(parseRegulationSection('12.1')).toEqual({ chapterCode: '12', sectionCode: '1' });
	});

	it('treats a chapter-only input as section=""', () => {
		expect(parseRegulationSection('91')).toEqual({ chapterCode: '91', sectionCode: '' });
	});

	it('rejects shape mismatches', () => {
		expect(parseRegulationSection('')).toBeNull();
		expect(parseRegulationSection('91.103.5')).toBeNull();
		expect(parseRegulationSection('91/103')).toBeNull();
	});
});

describe('parseHandbookSlug', () => {
	it('accepts kebab-shape document slugs', () => {
		expect(parseHandbookSlug('afh')).toBe('afh');
		expect(parseHandbookSlug('faa-h-8083-2')).toBe('faa-h-8083-2');
		expect(parseHandbookSlug('phak-25c')).toBe('phak-25c');
	});

	it('rejects shape mismatches', () => {
		expect(parseHandbookSlug('')).toBeNull();
		expect(parseHandbookSlug('AFH')).toBeNull();
		expect(parseHandbookSlug('-afh')).toBeNull();
	});
});

describe('parseHandbookChapter', () => {
	it('accepts numeric and letter-suffixed chapter codes', () => {
		expect(parseHandbookChapter('1')).toBe('1');
		expect(parseHandbookChapter('12')).toBe('12');
		expect(parseHandbookChapter('12A')).toBe('12A');
	});

	it('rejects shape mismatches', () => {
		expect(parseHandbookChapter('')).toBeNull();
		expect(parseHandbookChapter('1-2')).toBeNull();
		expect(parseHandbookChapter('chap.12')).toBeNull();
	});
});

describe('parseHandbookSection', () => {
	it('accepts a section code with a single dot', () => {
		expect(parseHandbookSection('103')).toBe('103');
		expect(parseHandbookSection('12.1')).toBe('12.1');
	});

	it('rejects shape mismatches', () => {
		expect(parseHandbookSection('')).toBeNull();
		expect(parseHandbookSection('12.1.3')).toBeNull();
		expect(parseHandbookSection('12 1')).toBeNull();
	});
});

describe('parseCertSlug', () => {
	it('accepts known cert applicabilities', () => {
		expect(parseCertSlug('private')).toBe('private');
		expect(parseCertSlug('instrument')).toBe('instrument');
		expect(parseCertSlug('atp')).toBe('atp');
	});

	it('rejects unknown cert slugs', () => {
		expect(parseCertSlug('PRIVATE')).toBeNull();
		expect(parseCertSlug('soaring')).toBeNull();
		expect(parseCertSlug('')).toBeNull();
	});
});

describe('parseAircraftSlug', () => {
	it('accepts kebab-shape POH/AFM slugs', () => {
		expect(parseAircraftSlug('c172s-poh')).toBe('c172s-poh');
		expect(parseAircraftSlug('poh-afm')).toBe('poh-afm');
	});

	it('rejects shape mismatches', () => {
		expect(parseAircraftSlug('')).toBeNull();
		expect(parseAircraftSlug('Cirrus_SR22')).toBeNull();
		expect(parseAircraftSlug('-poh')).toBeNull();
	});
});
