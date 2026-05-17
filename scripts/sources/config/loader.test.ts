/**
 * Tests for the YAML config loader. Validates that every shipped YAML at
 * `scripts/sources/config/` parses + matches the count + URL expectations
 * the spec locked in.
 */

import { describe, expect, it } from 'vitest';
import {
	listHandbookSlugs,
	loadAcConfig,
	loadAcsConfig,
	loadAimConfig,
	loadHandbookConfig,
	loadHandbooksExtrasConfig,
	loadRegsConfig,
} from './loader';

describe('loadAcConfig', () => {
	it('loads 13 AC entries', () => {
		const ac = loadAcConfig();
		expect(ac.entries).toHaveLength(13);
		expect(ac.base_url).toBe('https://www.faa.gov/documentLibrary/media/Advisory_Circular');
	});
	it('includes AC 00-45H (Aviation Weather Services)', () => {
		const ac = loadAcConfig();
		const e = ac.entries.find((entry) => entry.doc_id === 'ac-00-45-h');
		expect(e?.edition).toBe('H');
		expect(e?.url).toBe('https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_00-45H.pdf');
		expect(e?.filename).toBe('AC_00-45H.pdf');
	});
	it('preserves the AC 91-21-1D dot-in-filename oddity', () => {
		const ac = loadAcConfig();
		const e = ac.entries.find((entry) => entry.doc_id === 'ac-91-21-1d');
		expect(e?.filename).toBe('AC_91.21-1D.pdf');
	});
});

describe('loadAcsConfig', () => {
	it('loads 5 ACS entries (matches the pre-WP ACS_TARGETS array)', () => {
		const acs = loadAcsConfig();
		expect(acs.entries).toHaveLength(5);
	});
});

describe('loadHandbooksExtrasConfig', () => {
	it('loads 1 entry (faa-mtn-tips -- only residual after Wave 2 promotion)', () => {
		const ex = loadHandbooksExtrasConfig();
		// Wave 2 (2026-05-03) promoted every FAA-H-* handbook (incl. 8083-2 RMH
		// and 8083-16 IPH) to the chapter-aware Class A2 pipeline at
		// `scripts/sources/config/handbooks/<slug>.yaml`. Only the 1999
		// mountain-flying pamphlet stays here because its OCR is unusable and
		// the chapter-aware pipeline doesn't yet support `body_override`. See
		// the YAML header comment for the full promotion / removal log.
		expect(ex.entries).toHaveLength(1);
		const ids = ex.entries.map((e) => e.doc_id).sort();
		expect(ids).toEqual(['faa-mtn-tips']);
	});
});

describe('loadAimConfig', () => {
	it('loads the AIM URL inventory with ch0 and 5 appendices', () => {
		const aim = loadAimConfig();
		expect(aim.continuous_edition).toBe(true);
		expect(aim.whole_doc.url).toBe('https://www.faa.gov/air_traffic/publications/media/aim.pdf');
		expect(aim.chapter_html.chapter_count).toBe(12);
		expect(aim.chapter_html.sections_per_chapter).toEqual([1, 2, 3, 5, 7, 6, 5, 7, 1, 1, 2, 8]);
		expect(aim.chapter_html.chapter_0_section_url_override).toBe(
			'https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap0_info_eoc.html',
		);
		expect(aim.appendix_html.appendix_count).toBe(5);
	});
	it('total section count is 48 (1 + 2 + 3 + 5 + 7 + 6 + 5 + 7 + 1 + 1 + 2 + 8)', () => {
		const aim = loadAimConfig();
		const total = aim.chapter_html.sections_per_chapter.reduce((a, b) => a + b, 0);
		expect(total).toBe(48);
	});
});

describe('loadRegsConfig', () => {
	it('loads ECFR base + 3 title entries (14 full, 49 part 830, 49 part 1552)', () => {
		const regs = loadRegsConfig();
		expect(regs.ecfr_base).toBe('https://www.ecfr.gov/api/versioner/v1/full');
		expect(regs.titles).toHaveLength(3);
		expect(regs.titles[0]?.title).toBe('14');
		expect(regs.titles[0]?.parts).toEqual([]);
		expect(regs.titles[1]?.parts).toEqual(['830']);
		expect(regs.titles[2]?.parts).toEqual(['1552']);
	});
});

describe('loadHandbookConfig', () => {
	it('loads PHAK with two-hop chapter_pdfs (Class A1 -- no ancillaries)', () => {
		const phak = loadHandbookConfig('phak');
		expect(phak.document_slug).toBe('phak');
		expect(phak.edition).toBe('FAA-H-8083-25C');
		expect(phak.whole_doc?.url).toContain('faa-h-8083-25c.pdf');
		expect(phak.chapter_pdfs).toBeDefined();
		expect(phak.chapter_pdfs?.chapter_count).toBe(17);
		// Two-hop scrape: index_url + chapter_page_pattern present.
		expect(phak.chapter_pdfs && 'index_url' in phak.chapter_pdfs && phak.chapter_pdfs.index_url).toContain('/phak');
		expect(
			phak.chapter_pdfs && 'chapter_page_pattern' in phak.chapter_pdfs && phak.chapter_pdfs.chapter_page_pattern,
		).toBe('chapter-{N}-');
		expect(phak.chapter_pdfs?.ancillary).toEqual([]);
	});
	it('loads AFH with direct chapter_pdfs and 3 ancillaries (Class A2)', () => {
		const afh = loadHandbookConfig('afh');
		expect(afh.chapter_pdfs?.chapter_count).toBe(18);
		expect(afh.chapter_pdfs?.file_ordinal_offset).toBe(1);
		expect(afh.chapter_pdfs && 'direct_pattern' in afh.chapter_pdfs && afh.chapter_pdfs.direct_pattern).toContain(
			'{NN}_afh_ch{N}.pdf',
		);
		expect(afh.chapter_pdfs?.ancillary).toHaveLength(3);
		expect(afh.chapter_pdfs?.ancillary.map((a) => a.kind).sort()).toEqual(['front', 'glossary', 'index']);
	});
	it('loads AVWX without chapter_pdfs (Class C)', () => {
		const avwx = loadHandbookConfig('avwx');
		expect(avwx.whole_doc?.url).toContain('FAA-H-8083-28B.pdf');
		expect(avwx.chapter_pdfs).toBeUndefined();
		expect(avwx.excluded_assets).toEqual([]);
	});
	it('handbook configs all carry an excluded_assets field (default empty)', () => {
		for (const slug of listHandbookSlugs()) {
			const hb = loadHandbookConfig(slug);
			expect(Array.isArray(hb.excluded_assets)).toBe(true);
		}
	});
});
