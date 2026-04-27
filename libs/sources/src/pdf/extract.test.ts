/**
 * Hermetic tests for the PDF extractor.
 *
 * Uses `tests/fixtures/pdf/sample.pdf` -- a small (~1 KB) hand-crafted 2-page
 * PDF that ships in the repo. No network, no external assets.
 *
 * Tests that need real-world layout edge cases live separately as opt-in
 * integration tests guarded by AIRBOSS_E2E_PDF=1; they read from the local
 * cache at $AIRBOSS_HANDBOOK_CACHE.
 */

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	PdfNotFoundError,
	PdftotextNotInstalledError,
	__resetAvailabilityCache,
	extractPdf,
	extractPdfPages,
	extractPdfText,
} from './extract.ts';

const FIXTURE = join(import.meta.dir, '../../../../tests/fixtures/pdf/sample.pdf');

describe('extractPdf', () => {
	it('extracts both pages of the fixture', () => {
		const doc = extractPdf(FIXTURE);
		expect(doc.source).toBe(FIXTURE);
		expect(doc.pageCount).toBe(2);
		expect(doc.pages.length).toBe(2);
		expect(doc.pages[0].pageNumber).toBe(1);
		expect(doc.pages[1].pageNumber).toBe(2);
	});

	it('preserves test markers in extracted text', () => {
		const doc = extractPdf(FIXTURE);
		expect(doc.pages[0].text).toContain('AIRBOSS-PDF-TEST');
		expect(doc.pages[0].text).toContain('PAGE');
		expect(doc.pages[0].text).toContain('ONE');
		expect(doc.pages[1].text).toContain('AIRBOSS-PDF-TEST');
		expect(doc.pages[1].text).toContain('PAGE');
		expect(doc.pages[1].text).toContain('TWO');
	});

	it('preserves the FAA edition slug pattern', () => {
		// The fixture intentionally embeds an ACS slug + effective date so that
		// `findAcsEditionSlug` and `findEffectiveDate` (in identify.test.ts)
		// have a real input to scan.
		const doc = extractPdf(FIXTURE);
		const allText = doc.pages.map((p) => p.text).join('\n');
		expect(allText).toMatch(/FAA-S-ACS-25/);
	});

	it('respects firstPage / lastPage bounds', () => {
		const onlyPage2 = extractPdf(FIXTURE, { firstPage: 2, lastPage: 2 });
		expect(onlyPage2.pages.length).toBe(1);
		expect(onlyPage2.pages[0].pageNumber).toBe(2);
		expect(onlyPage2.pages[0].text).toContain('TWO');
	});

	it('rejects out-of-bounds page ranges', () => {
		expect(() => extractPdf(FIXTURE, { firstPage: 5, lastPage: 5 })).toThrow(
			/page range 5\.\.5 is out of bounds/,
		);
		expect(() => extractPdf(FIXTURE, { firstPage: 2, lastPage: 1 })).toThrow();
	});

	it('throws PdfNotFoundError for missing files', () => {
		expect(() => extractPdf('/nonexistent/path/to/file.pdf')).toThrow(PdfNotFoundError);
	});

	it('throws PdftotextNotInstalledError when binary is missing', () => {
		__resetAvailabilityCache();
		expect(() => extractPdf(FIXTURE, { binary: '/no/such/binary/pdftotext' })).toThrow(
			PdftotextNotInstalledError,
		);
		__resetAvailabilityCache();
	});

	it('exposes metadata fields when present', () => {
		// The fixture is hand-crafted minimal -- metadata may be empty. Just
		// verify the field is shaped correctly (an object with optional keys).
		const doc = extractPdf(FIXTURE);
		expect(typeof doc.metadata).toBe('object');
	});
});

describe('extractPdfText', () => {
	it('returns all pages joined with double newlines', () => {
		const text = extractPdfText(FIXTURE);
		expect(text).toContain('AIRBOSS-PDF-TEST');
		expect(text).toContain('FAA-S-ACS-25');
		// Both pages present
		expect(text.match(/AIRBOSS-PDF-TEST/g)?.length).toBe(2);
	});
});

describe('extractPdfPages', () => {
	it('handles inclusive ranges', () => {
		const pages = extractPdfPages(FIXTURE, { first: 1, last: 2 });
		expect(pages.length).toBe(2);
		expect(pages[0].pageNumber).toBe(1);
		expect(pages[1].pageNumber).toBe(2);
	});

	it('handles non-contiguous page lists', () => {
		const pages = extractPdfPages(FIXTURE, [2, 1]);
		// Returns pages in the requested order, each with its page number
		expect(pages.length).toBe(2);
		expect(pages[0].pageNumber).toBe(2);
		expect(pages[0].text).toContain('TWO');
		expect(pages[1].pageNumber).toBe(1);
		expect(pages[1].text).toContain('ONE');
	});

	it('handles single-page list', () => {
		const pages = extractPdfPages(FIXTURE, [1]);
		expect(pages.length).toBe(1);
		expect(pages[0].pageNumber).toBe(1);
	});
});

describe('mode selection', () => {
	it('accepts each mode without error', () => {
		expect(() => extractPdf(FIXTURE, { mode: 'layout' })).not.toThrow();
		expect(() => extractPdf(FIXTURE, { mode: 'raw' })).not.toThrow();
		expect(() => extractPdf(FIXTURE, { mode: 'simple' })).not.toThrow();
	});
});
