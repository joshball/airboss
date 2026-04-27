/**
 * Phase 6 -- handbooks locator parser.
 *
 * Source of truth: ADR 019 §1.2 ("Handbooks") + the WP at
 * `docs/work-packages/reference-handbook-ingestion/`.
 *
 * Accepts every shape ADR 019 §1.2 lists for the `handbooks` corpus:
 *
 *   <doc>/<edition>                                  whole handbook (resolves to chapter index)
 *   <doc>/<edition>/<chapter>                        chapter
 *   <doc>/<edition>/<chapter>/<section>              section
 *   <doc>/<edition>/<chapter>/<section>/<subsection> subsection
 *   <doc>/<edition>/<chapter>/<section>/para-<N>     paragraph (resolves to section)
 *   <doc>/<edition>/<chapter>/intro                  chapter intro
 *   <doc>/<edition>/fig-<N>-<M>                      figure (parses, no registry entry)
 *   <doc>/<edition>/tbl-<N>-<M>                      table (parses, no registry entry)
 *
 * Returns a `ParsedLocator` with the structured `handbooks` payload (per
 * `libs/sources/src/types.ts`) so downstream consumers (resolver, renderer)
 * don't re-parse the slash-separated string.
 */

import type { LocatorError, ParsedHandbooksLocator, ParsedLocator } from '../types.ts';

/**
 * Enumerated handbook doc slugs. Adding a new handbook means adding here AND
 * extending `DOC_EDITIONS` in `resolver.ts`.
 */
export const HANDBOOK_DOC_SLUGS: readonly string[] = ['phak', 'afh', 'avwx'];

const EDITION_PATTERN = /^[0-9]{4}-[0-9]{1,3}[a-z]?$/i;
const CHAPTER_PATTERN = /^[1-9][0-9]{0,2}$/;
const SECTION_NUMBER_PATTERN = /^[1-9][0-9]{0,2}$/;
const SUBSECTION_PATTERN = /^[1-9][0-9]{0,2}$/;
const PARAGRAPH_PATTERN = /^para-[1-9][0-9]{0,3}$/;
const FIGURE_PATTERN = /^fig-[0-9]{1,3}-[0-9]{1,3}$/;
const TABLE_PATTERN = /^tbl-[0-9]{1,3}-[0-9]{1,3}$/;
const INTRO_LITERAL = 'intro';

function err(message: string): LocatorError {
	return { kind: 'error', message };
}

/**
 * Parse a `handbooks` corpus locator. The locator is the segment after
 * `airboss-ref:handbooks/`, stripped of `?at=...`. Returns a `ParsedLocator`
 * with the `handbooks` payload on success.
 */
export function parseHandbooksLocator(locator: string): ParsedLocator | LocatorError {
	if (locator.length === 0) {
		return err('handbooks locator is empty');
	}

	const segments = locator.split('/');

	const doc = segments[0] ?? '';
	if (doc.length === 0) {
		return err('handbooks locator missing doc slug');
	}
	if (!HANDBOOK_DOC_SLUGS.includes(doc)) {
		return err(`handbooks locator doc "${doc}" is not one of: ${HANDBOOK_DOC_SLUGS.join(', ')}`);
	}

	const edition = segments[1] ?? '';
	if (edition.length === 0) {
		return err(`handbooks locator missing edition (e.g. "${doc}/8083-25C/...")`);
	}
	if (!EDITION_PATTERN.test(edition)) {
		return err(`handbooks locator edition "${edition}" is malformed (expected e.g. "8083-25C")`);
	}

	// Whole handbook reference: <doc>/<edition>
	if (segments.length === 2) {
		const handbooks: ParsedHandbooksLocator = { doc, edition };
		return { kind: 'ok', segments, handbooks };
	}

	const third = segments[2] ?? '';

	// Figure / table reference: <doc>/<edition>/fig-N-M or tbl-N-M
	if (third.startsWith('fig-')) {
		if (!FIGURE_PATTERN.test(third)) {
			return err(`handbooks locator figure "${third}" is malformed (expected "fig-<N>-<M>")`);
		}
		if (segments.length > 3) {
			return err(`handbooks locator has unexpected segments after figure: "${segments.slice(3).join('/')}"`);
		}
		const handbooks: ParsedHandbooksLocator = { doc, edition, figure: third };
		return { kind: 'ok', segments, handbooks };
	}
	if (third.startsWith('tbl-')) {
		if (!TABLE_PATTERN.test(third)) {
			return err(`handbooks locator table "${third}" is malformed (expected "tbl-<N>-<M>")`);
		}
		if (segments.length > 3) {
			return err(`handbooks locator has unexpected segments after table: "${segments.slice(3).join('/')}"`);
		}
		const handbooks: ParsedHandbooksLocator = { doc, edition, table: third };
		return { kind: 'ok', segments, handbooks };
	}

	// Chapter reference: <doc>/<edition>/<chapter>
	if (!CHAPTER_PATTERN.test(third)) {
		return err(`handbooks locator chapter "${third}" is malformed (expected digits)`);
	}
	const chapter = third;

	if (segments.length === 3) {
		const handbooks: ParsedHandbooksLocator = { doc, edition, chapter };
		return { kind: 'ok', segments, handbooks };
	}

	const fourth = segments[3] ?? '';

	// Intro: <doc>/<edition>/<chapter>/intro
	if (fourth === INTRO_LITERAL) {
		if (segments.length > 4) {
			return err(`handbooks locator has unexpected segments after intro: "${segments.slice(4).join('/')}"`);
		}
		const handbooks: ParsedHandbooksLocator = { doc, edition, chapter, section: INTRO_LITERAL };
		return { kind: 'ok', segments, handbooks };
	}

	// Section: <doc>/<edition>/<chapter>/<section>
	if (!SECTION_NUMBER_PATTERN.test(fourth)) {
		return err(`handbooks locator section "${fourth}" is malformed (expected digits or "intro")`);
	}
	const section = fourth;

	if (segments.length === 4) {
		const handbooks: ParsedHandbooksLocator = { doc, edition, chapter, section };
		return { kind: 'ok', segments, handbooks };
	}

	const fifth = segments[4] ?? '';

	// Paragraph: <doc>/<edition>/<chapter>/<section>/para-N
	if (fifth.startsWith('para-')) {
		if (!PARAGRAPH_PATTERN.test(fifth)) {
			return err(`handbooks locator paragraph "${fifth}" is malformed (expected "para-<N>")`);
		}
		if (segments.length > 5) {
			return err(`handbooks locator has unexpected segments after paragraph: "${segments.slice(5).join('/')}"`);
		}
		const handbooks: ParsedHandbooksLocator = { doc, edition, chapter, section, paragraph: fifth };
		return { kind: 'ok', segments, handbooks };
	}

	// Subsection: <doc>/<edition>/<chapter>/<section>/<subsection>
	if (!SUBSECTION_PATTERN.test(fifth)) {
		return err(`handbooks locator subsection "${fifth}" is malformed (expected digits or "para-<N>")`);
	}
	if (segments.length > 5) {
		return err(`handbooks locator has unexpected segments after subsection: "${segments.slice(5).join('/')}"`);
	}
	const handbooks: ParsedHandbooksLocator = { doc, edition, chapter, section, subsection: fifth };
	return { kind: 'ok', segments, handbooks };
}
