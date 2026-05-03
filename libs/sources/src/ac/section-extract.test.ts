/**
 * Unit tests for the AC section-tree extractor (WP-AC-PROMOTE).
 *
 * The extractor is content-shape: it takes the pdftotext-rendered AC body
 * markdown and produces a chapter / section / subsection tree. These tests
 * cover each strategy branch + the FAA edge cases that the regex pipeline
 * encountered during the WP authoring (paragraphs ending in `:`, titles
 * that wrap to a second line, mid-paragraph numeric callouts that look
 * like sub-paragraph headings, AC 25-7's chapter-only carve-out, and
 * appendix containers with their own internal numbering).
 */

import { describe, expect, it } from 'vitest';
import { extractAcSections } from './section-extract.ts';

describe('extractAcSections', () => {
	it('returns an empty section list for unstructured bodies', () => {
		const body = 'Some prose with no recognisable structure.\n\nAnother paragraph.';
		const result = extractAcSections(body, { docSlug: 'unknown' });
		expect(result.strategy).toBe('unstructured');
		expect(result.sections).toHaveLength(0);
	});

	it('parses chapter-style ACs into chapter -> section -> subsection', () => {
		// Mirrors AC 00-6B / AC 61-98D shape: `CHAPTER N. TITLE` (uppercase) +
		// dotted-decimal sub-paragraphs.
		const body = [
			'CHAPTER 1.  GENERAL',
			'',
			'1.1   Purpose. This AC provides guidance.',
			'',
			'1.1.1   Scope. The scope is limited to part 91.',
			'',
			'1.2   Audience. The primary audience is GA pilots.',
			'',
			'CHAPTER 2.  REVIEW',
			'',
			'2.1   Recent Experience. Pilots must be current.',
		].join('\n');
		const result = extractAcSections(body, { docSlug: '61-98' });
		expect(result.strategy).toBe('chapter-tree');
		const chapterCodes = result.sections.filter((s) => s.level === 'chapter').map((s) => s.code);
		expect(chapterCodes).toEqual(['1', '2']);
		const sectionCodes = result.sections.filter((s) => s.level === 'section').map((s) => s.code);
		expect(sectionCodes).toEqual(['1.1', '1.2', '2.1']);
		const subsectionCodes = result.sections.filter((s) => s.level === 'subsection').map((s) => s.code);
		expect(subsectionCodes).toEqual(['1.1.1']);
	});

	it('parses flat-paragraph ACs into synthetic chapters per L1 paragraph', () => {
		// Mirrors AC 91-21.1D shape: `   N TITLE.` (leading spaces, uppercase
		// title, period terminator, body on same line).
		const body = [
			'   1 PURPOSE OF THIS ADVISORY CIRCULAR (AC). This AC provides aircraft owners.',
			'',
			'   2 AUDIENCE. This AC is for aircraft owners, operators, and the flying public.',
			'',
			'   3 WHERE YOU CAN FIND THIS AC. You can find this AC on the FAA website.',
			'',
			' 6.1 Section 91.21. The first sub-paragraph of paragraph 6 sits at this depth.',
		].join('\n');
		const result = extractAcSections(body, { docSlug: '91-21-1' });
		expect(result.strategy).toBe('flat-paragraph');
		const chapters = result.sections.filter((s) => s.level === 'chapter');
		expect(chapters.map((c) => c.code)).toEqual(['1', '2', '3']);
		expect(chapters[0]?.title).toBe('PURPOSE OF THIS ADVISORY CIRCULAR (AC)');
	});

	it('accepts a colon-terminator on FAA RELATED-READING headings', () => {
		// AC 61-65J §6 ends with `:` instead of `.`; the regex must accept both.
		const body = [
			'   1 PURPOSE. The first paragraph.',
			'',
			'   6 RELATED READING MATERIAL (current editions):',
			'',
			'      • AC 60-28, FAA English Language Standard.',
			'',
			'   7 SUMMARY OF CHANGES. Many things changed.',
		].join('\n');
		const result = extractAcSections(body, { docSlug: '61-65' });
		const codes = result.sections.filter((s) => s.level === 'chapter').map((s) => s.code);
		expect(codes).toContain('6');
	});

	it('accepts titles that wrap to a second line (no in-line period)', () => {
		// AC 61-65J §10 / §26: heading wraps -- `10 COMPLETION OF GROUND
		// TRAINING OR A HOME-STUDY` followed by `CURRICULUM.` on the next
		// line. The regex matches the first line; the title is captured
		// without the wrap segment. Use consecutive numbering so the
		// monotonic-jump filter (max +5) doesn't reject the wrapped item.
		const body = [
			'   1 PURPOSE. Standard opener.',
			'',
			'   2 AUDIENCE. The next paragraph.',
			'',
			'   3 COMPLETION OF GROUND TRAINING OR A HOME-STUDY',
			'     CURRICULUM.',
			'',
			'3.1 General. Body text.',
		].join('\n');
		const result = extractAcSections(body, { docSlug: '61-65' });
		const ch3 = result.sections.find((s) => s.code === '3' && s.level === 'chapter');
		expect(ch3).toBeDefined();
		expect(ch3?.title).toBe('COMPLETION OF GROUND TRAINING OR A HOME-STUDY');
	});

	it('captures titles with internal `:` punctuation (e.g. STUDENT ... PROCESS: IACRA)', () => {
		// AC 61-65J §18 has `STUDENT PILOT APPLICATION PROCESS: IACRA`
		// followed by `. A person who...`; the colon must NOT terminate the
		// title -- only `:` at end-of-line OR `.` followed by space does.
		// Strategy detection requires 3+ flat-L1 hits and monotonic numbering,
		// so we walk consecutive numbers to engage flat-paragraph mode.
		const body = [
			'   1 PURPOSE. Opener.',
			'',
			'   2 AUDIENCE. Pilots.',
			'',
			'   3 STUDENT PILOT APPLICATION PROCESS: IACRA. A person who meets the eligibility requirements may register.',
			'',
			'   4 OTHER. Body.',
		].join('\n');
		const result = extractAcSections(body, { docSlug: '61-65' });
		const ch3 = result.sections.find((s) => s.code === '3');
		expect(ch3?.title).toBe('STUDENT PILOT APPLICATION PROCESS: IACRA');
	});

	it('rejects mid-paragraph numeric references that look like sub-paragraphs', () => {
		// AC 61-98D Chapter 2 has stall-speed callouts deeply indented like
		// `                  1.3 VSO. However...` which are inline references,
		// not headings. The 6-space indent cap in SUBPARA_RE excludes them.
		const body = [
			'CHAPTER 2.  REVIEW',
			'',
			'2.1   General. Body discussing stall speeds.',
			'',
			'                  1.3 VSO. However, aircraft are usually slowed.',
			'                  1.3 times the stall speed or minimum steady flight speed.',
		].join('\n');
		const result = extractAcSections(body, { docSlug: '61-98' });
		const subsections = result.sections.filter((s) => s.level === 'subsection');
		expect(subsections).toHaveLength(0);
	});

	it('honors chapterOnly: true for AC 25-7D-style engineering docs', () => {
		// AC 25-7D is the 600-page transport-cert flight test guide. The spec
		// punts: keep section-tree depth at chapter-only because sub-paragraph
		// numbering is engineering noise, not pilot-facing learning content.
		const body = [
			'Chapter 1. Introduction',
			'',
			'1.1   General. The certification process.',
			'',
			'1.1.1   Scope. The scope is broad.',
			'',
			'Chapter 2. General',
			'',
			'2.1   Demonstrations. Pilots demonstrate procedures.',
		].join('\n');
		const result = extractAcSections(body, { docSlug: '25-7', chapterOnly: true });
		expect(result.strategy).toBe('chapter-only');
		const chapterCount = result.sections.filter((s) => s.level === 'chapter').length;
		const sectionCount = result.sections.filter((s) => s.level !== 'chapter').length;
		expect(chapterCount).toBe(2);
		expect(sectionCount).toBe(0);
	});

	it('emits appendix containers as chapter-level rows with `appendix-<id>` codes', () => {
		// AC 91-79A: `APPENDIX 1. SUGGESTED PROCEDURES AND TRAINING INFORMATION`
		// appears mid-document; the extractor treats it as a chapter peer with
		// code `appendix-1` so the reader can render appendix-specific chrome.
		const body = [
			'1. PURPOSE. This advisory circular.',
			'',
			'2. AUDIENCE. Pilots and flightcrews.',
			'',
			'    APPENDIX 1. SUGGESTED PROCEDURES AND TRAINING INFORMATION',
			'',
			'1. ORGANIZATION. This appendix divides the discussion.',
			'2. DEFINITIONS. The following are definitions.',
		].join('\n');
		const result = extractAcSections(body, { docSlug: '91-79' });
		expect(result.strategy).toBe('mixed-paragraph');
		const appendixContainers = result.sections.filter((s) => s.level === 'chapter' && s.code.startsWith('appendix-'));
		expect(appendixContainers).toHaveLength(1);
		expect(appendixContainers[0]?.code).toBe('appendix-1');
		expect(appendixContainers[0]?.level).toBe('chapter');
		// Appendix 1's restart-at-1 child paragraphs should attach as sections
		// under the appendix container (not as new top-level chapters).
		const appendixChildren = result.sections.filter((s) => s.parentCode === 'appendix-1');
		expect(appendixChildren.length).toBeGreaterThan(0);
		expect(appendixChildren.every((s) => s.level === 'section')).toBe(true);
	});

	it('skips TOC-leader lines (dotted-leader page references)', () => {
		// FAA TOCs use `<title> .................... <page>` lines that look
		// superficially like headings but are TOC entries. They must not
		// produce section rows; the strategy detector engages flat-paragraph
		// only against the body's actual heading lines.
		const body = [
			'                                         CONTENTS',
			'1    Purpose of This Advisory Circular .................................................................................. 1',
			'2    Audience ........................................................................................................................ 1',
			'3    Where You Can Find This AC ........................................................................................... 1',
			'',
			'   1 PURPOSE OF THIS ADVISORY CIRCULAR. The first body paragraph.',
			'   2 AUDIENCE. The second.',
			'   3 WHERE YOU CAN FIND THIS AC. The third.',
		].join('\n');
		const result = extractAcSections(body, { docSlug: '61-65' });
		const chapterCodes = result.sections.filter((s) => s.level === 'chapter').map((s) => s.code);
		expect(chapterCodes).toEqual(['1', '2', '3']);
	});

	it('produces deterministic content hashes for unchanged input', () => {
		const body = ['CHAPTER 1.  GENERAL', '', '1.1   Purpose. This AC provides guidance.'].join('\n');
		const a = extractAcSections(body, { docSlug: 'test' });
		const b = extractAcSections(body, { docSlug: 'test' });
		expect(a.sections.map((s) => s.contentHash)).toEqual(b.sections.map((s) => s.contentHash));
	});

	it('preserves all content across sections (no body text dropped)', () => {
		const body = [
			'CHAPTER 1.  GENERAL',
			'',
			'Chapter 1 introductory text.',
			'',
			'1.1   Purpose. This AC provides guidance.',
			'',
			'Sub-paragraph body.',
			'',
			'CHAPTER 2.  REVIEW',
			'',
			'Chapter 2 prose.',
		].join('\n');
		const result = extractAcSections(body, { docSlug: 'test' });
		const totalContent = result.sections.map((s) => s.bodyMd).join('\n');
		// Each unique substring from the input should appear in the joined
		// section bodies. The chapter heading lines themselves are part of
		// the section content (the section starts at the heading line).
		expect(totalContent).toContain('Chapter 1 introductory text.');
		expect(totalContent).toContain('Sub-paragraph body.');
		expect(totalContent).toContain('Chapter 2 prose.');
	});
});
