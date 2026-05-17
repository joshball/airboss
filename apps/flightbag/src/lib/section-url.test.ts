import { REFERENCE_KINDS, REFERENCE_SECTION_LEVELS, ROUTES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { sectionUrlFor } from './section-url';

describe('sectionUrlFor -- handbook', () => {
	it('maps a chapter-only code to FLIGHTBAG_HANDBOOK_CHAPTER (with FAA-H- stripped)', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.HANDBOOK,
			documentSlug: 'phak',
			edition: 'FAA-H-8083-25C',
			code: '4',
			parentId: null,
			level: REFERENCE_SECTION_LEVELS.CHAPTER,
		});
		expect(result).toEqual({ kind: 'url', url: ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER('phak', '8083-25C', '4') });
	});

	it('maps a chapter.section code to FLIGHTBAG_HANDBOOK_SECTION', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.HANDBOOK,
			documentSlug: 'phak',
			edition: 'FAA-H-8083-25C',
			code: '4.2',
			parentId: 'rs_X',
			level: REFERENCE_SECTION_LEVELS.SECTION,
		});
		expect(result).toEqual({ kind: 'url', url: ROUTES.FLIGHTBAG_HANDBOOK_SECTION('phak', '8083-25C', '4', '2') });
	});

	it('maps a front-matter row to the dedicated FLIGHTBAG_HANDBOOK_FRONT_MATTER leaf URL', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.HANDBOOK,
			documentSlug: 'avwx',
			edition: 'FAA-H-8083-28A',
			code: '0.2',
			parentId: null,
			level: REFERENCE_SECTION_LEVELS.FRONT_MATTER,
		});
		expect(result).toEqual({
			kind: 'url',
			url: ROUTES.FLIGHTBAG_HANDBOOK_FRONT_MATTER('avwx', '8083-28A', '0.2'),
		});
	});

	it('routes every front-matter code (0.1..0.6) to its own front-matter leaf', () => {
		for (const code of ['0.1', '0.3', '0.6']) {
			const result = sectionUrlFor({
				kind: REFERENCE_KINDS.HANDBOOK,
				documentSlug: 'phak',
				edition: 'FAA-H-8083-25C',
				code,
				parentId: null,
				level: REFERENCE_SECTION_LEVELS.FRONT_MATTER,
			});
			expect(result).toEqual({
				kind: 'url',
				url: ROUTES.FLIGHTBAG_HANDBOOK_FRONT_MATTER('phak', '8083-25C', code),
			});
		}
	});

	it('routes deeper subsections back to their chapter URL (covered-by-parent)', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.HANDBOOK,
			documentSlug: 'phak',
			edition: 'FAA-H-8083-25C',
			code: '4.2.3',
			parentId: 'rs_X',
			level: REFERENCE_SECTION_LEVELS.SUBSECTION,
		});
		expect(result).toEqual({
			kind: 'covered-by-parent',
			parentUrl: ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER('phak', '8083-25C', '4'),
			reason: 'handbook subsection (3+ segments) -- reader covers the chapter',
		});
	});
});

describe('sectionUrlFor -- AIM', () => {
	it('maps a single-segment code to FLIGHTBAG_AIM_CHAPTER', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.AIM,
			documentSlug: 'aim',
			edition: '2026-04',
			code: '5',
			parentId: null,
			level: REFERENCE_SECTION_LEVELS.CHAPTER,
		});
		expect(result).toEqual({ kind: 'url', url: ROUTES.FLIGHTBAG_AIM_CHAPTER('5') });
	});

	it('maps a chapter-section code to FLIGHTBAG_AIM_SECTION', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.AIM,
			documentSlug: 'aim',
			edition: '2026-04',
			code: '5-1',
			parentId: 'rs_X',
			level: REFERENCE_SECTION_LEVELS.SECTION,
		});
		expect(result).toEqual({ kind: 'url', url: ROUTES.FLIGHTBAG_AIM_SECTION('5', '1') });
	});

	it('maps a chapter-section-paragraph code to FLIGHTBAG_AIM_PARAGRAPH', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.AIM,
			documentSlug: 'aim',
			edition: '2026-04',
			code: '5-1-7',
			parentId: 'rs_X',
			level: REFERENCE_SECTION_LEVELS.PARAGRAPH,
		});
		expect(result).toEqual({ kind: 'url', url: ROUTES.FLIGHTBAG_AIM_PARAGRAPH('5', '1', '7') });
	});

	it('returns no-route for AIM appendix rows', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.AIM,
			documentSlug: 'aim',
			edition: '2026-04',
			code: 'appendix-1',
			parentId: null,
			level: REFERENCE_SECTION_LEVELS.APPENDIX,
		});
		expect(result.kind).toBe('no-route');
	});

	it('returns no-route for AIM glossary rows (level-based)', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.AIM,
			documentSlug: 'aim',
			edition: '2026-04',
			code: 'g-airport',
			parentId: null,
			level: REFERENCE_SECTION_LEVELS.GLOSSARY,
		});
		expect(result.kind).toBe('no-route');
	});

	it('covers sub-paragraph rows under their AIM paragraph URL', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.AIM,
			documentSlug: 'aim',
			edition: '2026-04',
			code: '5-1-7-a',
			parentId: 'rs_X',
			level: REFERENCE_SECTION_LEVELS.SUBPARAGRAPH,
		});
		expect(result).toEqual({
			kind: 'covered-by-parent',
			parentUrl: ROUTES.FLIGHTBAG_AIM_PARAGRAPH('5', '1', '7'),
			reason: 'AIM sub-paragraph (4+ segments) -- reader covers the parent paragraph',
		});
	});
});

describe('sectionUrlFor -- CFR', () => {
	it('maps a Part code to FLIGHTBAG_CFR_PART', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.CFR,
			documentSlug: '14cfr91',
			edition: 'current',
			code: '91',
			parentId: null,
			level: REFERENCE_SECTION_LEVELS.PART,
		});
		expect(result).toEqual({ kind: 'url', url: ROUTES.FLIGHTBAG_CFR_PART('14', '91') });
	});

	it('maps a numeric section to FLIGHTBAG_CFR_SECTION', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.CFR,
			documentSlug: '14cfr91',
			edition: 'current',
			code: '91.103',
			parentId: 'rs_X',
			level: REFERENCE_SECTION_LEVELS.SECTION,
		});
		expect(result).toEqual({ kind: 'url', url: ROUTES.FLIGHTBAG_CFR_SECTION('14', '91', '103') });
	});

	it('covers subpart wrappers under the Part landing', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.CFR,
			documentSlug: '14cfr91',
			edition: 'current',
			code: 'subpart-B',
			parentId: 'rs_X',
			level: REFERENCE_SECTION_LEVELS.SUBPART,
		});
		expect(result).toEqual({
			kind: 'covered-by-parent',
			parentUrl: ROUTES.FLIGHTBAG_CFR_PART('14', '91'),
			reason: 'CFR non-numeric code (subpart wrapper / range / appendix) -- reader covers the Part landing',
		});
	});

	it('covers dotted/ranged section codes under the Part landing', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.CFR,
			documentSlug: '14cfr121',
			edition: 'current',
			code: '121.1300-Appendix-A',
			parentId: 'rs_X',
			level: REFERENCE_SECTION_LEVELS.SECTION,
		});
		expect(result.kind).toBe('covered-by-parent');
		if (result.kind === 'covered-by-parent') {
			expect(result.parentUrl).toBe(ROUTES.FLIGHTBAG_CFR_PART('14', '121'));
		}
	});

	it('returns no-route for a malformed CFR slug', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.CFR,
			documentSlug: 'not-a-cfr-slug',
			edition: 'current',
			code: '1',
			parentId: null,
			level: REFERENCE_SECTION_LEVELS.SECTION,
		});
		expect(result.kind).toBe('no-route');
	});
});

describe('sectionUrlFor -- AC', () => {
	it('maps a single-segment code to FLIGHTBAG_AC_CHAPTER (strips ac- prefix, lowercases rev)', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.AC,
			documentSlug: 'ac-61-65',
			edition: 'AC 61-65J',
			code: '1',
			parentId: null,
			level: REFERENCE_SECTION_LEVELS.CHAPTER,
		});
		expect(result).toEqual({ kind: 'url', url: ROUTES.FLIGHTBAG_AC_CHAPTER('61-65', 'j', '1') });
	});

	it('maps a chapter.section code to FLIGHTBAG_AC_SECTION', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.AC,
			documentSlug: 'ac-61-65',
			edition: 'AC 61-65J',
			code: '1.2',
			parentId: 'rs_X',
			level: REFERENCE_SECTION_LEVELS.SECTION,
		});
		expect(result).toEqual({ kind: 'url', url: ROUTES.FLIGHTBAG_AC_SECTION('61-65', 'j', '1', '2') });
	});

	it('covers deeper AC subsections under their section URL', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.AC,
			documentSlug: 'ac-61-65',
			edition: 'AC 61-65J',
			code: '1.2.3',
			parentId: 'rs_X',
			level: REFERENCE_SECTION_LEVELS.SUBSECTION,
		});
		expect(result).toEqual({
			kind: 'covered-by-parent',
			parentUrl: ROUTES.FLIGHTBAG_AC_SECTION('61-65', 'j', '1', '2'),
			reason: 'AC subsection (3+ segments) -- reader covers the parent section',
		});
	});

	it('returns no-route when the AC edition has no trailing revision letter', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.AC,
			documentSlug: 'ac-99-99',
			edition: '99-99',
			code: '1',
			parentId: null,
			level: REFERENCE_SECTION_LEVELS.CHAPTER,
		});
		expect(result.kind).toBe('no-route');
	});
});

describe('sectionUrlFor -- ACS / PTS', () => {
	it('maps a publication row to FLIGHTBAG_ACS', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.ACS,
			documentSlug: 'ppl-airplane-acs-6c',
			edition: 'FAA-S-ACS-6C',
			code: 'ppl-airplane-acs-6c',
			parentId: null,
			level: REFERENCE_SECTION_LEVELS.PUBLICATION,
		});
		expect(result).toEqual({ kind: 'url', url: ROUTES.FLIGHTBAG_ACS('ppl-airplane-acs-6c') });
	});

	it('covers ACS task rows under the publication landing', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.ACS,
			documentSlug: 'ppl-airplane-acs-6c',
			edition: 'FAA-S-ACS-6C',
			code: 'I.A',
			parentId: 'rs_X',
			level: REFERENCE_SECTION_LEVELS.TASK,
		});
		expect(result.kind).toBe('covered-by-parent');
	});

	it('covers ACS element rows under the publication landing', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.ACS,
			documentSlug: 'ppl-airplane-acs-6c',
			edition: 'FAA-S-ACS-6C',
			code: 'PA.I.A.K1',
			parentId: 'rs_X',
			level: REFERENCE_SECTION_LEVELS.ELEMENT,
		});
		expect(result).toEqual({
			kind: 'covered-by-parent',
			parentUrl: ROUTES.FLIGHTBAG_ACS('ppl-airplane-acs-6c'),
			reason: 'ACS element row -- task body renders the element bullets',
		});
	});

	it('routes PTS rows the same way as ACS', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.PTS,
			documentSlug: 'cfi-airplane-pts',
			edition: 'FAA-S-8081-6D',
			code: 'cfi-airplane-pts',
			parentId: null,
			level: REFERENCE_SECTION_LEVELS.PUBLICATION,
		});
		expect(result).toEqual({ kind: 'url', url: ROUTES.FLIGHTBAG_ACS('cfi-airplane-pts') });
	});
});

describe('sectionUrlFor -- no-route corpora', () => {
	it('returns no-route for SAFO', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.SAFO,
			documentSlug: 'safo-23001',
			edition: '2026-04',
			code: '23001',
			parentId: null,
			level: REFERENCE_SECTION_LEVELS.DOCUMENT,
		});
		expect(result.kind).toBe('no-route');
	});

	it('returns no-route for InFO', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.INFO,
			documentSlug: 'info-25001',
			edition: '2026-04',
			code: '25001',
			parentId: null,
			level: REFERENCE_SECTION_LEVELS.DOCUMENT,
		});
		expect(result.kind).toBe('no-route');
	});

	it('returns no-route for NTSB', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.NTSB,
			documentSlug: 'ntsb',
			edition: 'archive',
			code: 'CASE-1',
			parentId: null,
			level: null,
		});
		expect(result.kind).toBe('no-route');
	});

	it('returns no-route for POH', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.POH,
			documentSlug: 'poh-afm',
			edition: 'aircraft-specific',
			code: 'doc-1',
			parentId: null,
			level: null,
		});
		expect(result.kind).toBe('no-route');
	});

	it('returns no-route for PCG', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.PCG,
			documentSlug: 'pcg',
			edition: '2026-04',
			code: 'entry',
			parentId: null,
			level: null,
		});
		expect(result.kind).toBe('no-route');
	});

	it('returns no-route for OTHER', () => {
		const result = sectionUrlFor({
			kind: REFERENCE_KINDS.OTHER,
			documentSlug: 'jeppesen-faa-charts',
			edition: 'current',
			code: 'chart-1',
			parentId: null,
			level: null,
		});
		expect(result.kind).toBe('no-route');
	});
});
