/**
 * Chapter-preamble surfacing rules.
 *
 * The handbook + AC chapter pages surface a chapter's preamble (the depth-0
 * chapter row's body markdown) inline before the section list whenever the
 * chapter row carries any content -- markdown body, figures, or both. This
 * matches what the FAA puts at the top of each chapter in the print PDF.
 *
 * The route uses this exact predicate; this test pins it so a future refactor
 * can't silently regress the "chapter 1 has a preamble; chapter 2 doesn't"
 * rendering split across the corpus.
 *
 * Both handbook and AC chapter pages share the rule -- the test fixtures
 * cover one row per shape per corpus.
 */

import { describe, expect, test } from 'vitest';
import { hasChapterPreamble } from './chapter-preamble';

describe('hasChapterPreamble', () => {
	test('chapter with markdown body: surfaces preamble', () => {
		expect(hasChapterPreamble({ contentMd: '# Intro\n\nThe NAS has classes A through G.', figures: [] })).toBe(true);
	});

	test('chapter with body + figures: surfaces preamble', () => {
		expect(hasChapterPreamble({ contentMd: 'See figure 1-1.', figures: [{ id: 'f1' }] })).toBe(true);
	});

	test('chapter with only figures (no body): surfaces preamble', () => {
		// Some PHAK chapters lead with a figure-only intro spread.
		expect(hasChapterPreamble({ contentMd: '', figures: [{ id: 'f1' }] })).toBe(true);
	});

	test('chapter with only whitespace body and no figures: no preamble', () => {
		expect(hasChapterPreamble({ contentMd: '   \n\n  ', figures: [] })).toBe(false);
	});

	test('chapter with empty body and no figures: no preamble', () => {
		expect(hasChapterPreamble({ contentMd: '', figures: [] })).toBe(false);
	});

	test('AC chapter with body and a figure: surfaces preamble', () => {
		// AC ingest follows the same shape as handbook chapters; the same
		// predicate applies.
		expect(hasChapterPreamble({ contentMd: 'Background.', figures: [{ id: 'f1' }] })).toBe(true);
	});
});
