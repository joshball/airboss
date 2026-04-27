/**
 * Phase 7 -- AIM locator parser.
 *
 * Source of truth: ADR 019 §1.2 ("AIM") + the WP at
 * `docs/work-packages/reference-aim-ingestion/`.
 *
 * Accepts every shape ADR 019 §1.2 lists for the `aim` corpus:
 *
 *   <chapter>                                  chapter (e.g. 5)
 *   <chapter>-<section>                        section (e.g. 5-1)
 *   <chapter>-<section>-<paragraph>            paragraph (e.g. 5-1-7)
 *   glossary/<slug>                            glossary entry
 *   appendix-<N>                               appendix
 *
 * Pin format: `?at=YYYY-MM` (e.g. `?at=2026-09`). The pin is stripped before
 * `parseAimLocator` is called; this module only sees the locator portion.
 *
 * Returns a `ParsedLocator` with the structured `aim` payload (per
 * `libs/sources/src/types.ts`) so downstream consumers (resolver, renderer)
 * don't re-parse the slash-and-dash-separated string.
 */

import type { LocatorError, ParsedAimLocator, ParsedLocator } from '../types.ts';

const CHAPTER_PATTERN = /^[1-9][0-9]?$/;
const SECTION_PATTERN = /^[1-9][0-9]?$/;
const PARAGRAPH_PATTERN = /^[1-9][0-9]{0,2}$/;
const APPENDIX_PATTERN = /^appendix-[1-9][0-9]?$/;
const GLOSSARY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NUMERIC_TRIPLET_PATTERN = /^[0-9]+(?:-[0-9]+)*$/;

const GLOSSARY_LITERAL = 'glossary';
const APPENDIX_PREFIX = 'appendix-';

function err(message: string): LocatorError {
	return { kind: 'error', message };
}

/**
 * Parse an `aim` corpus locator. The locator is the segment after
 * `airboss-ref:aim/`, stripped of `?at=...`. Returns a `ParsedLocator` with
 * the `aim` payload on success.
 */
export function parseAimLocator(locator: string): ParsedLocator | LocatorError {
	if (locator.length === 0) {
		return err('aim locator is empty');
	}

	const segments = locator.split('/');
	const first = segments[0] ?? '';

	// Glossary: glossary/<slug>
	if (first === GLOSSARY_LITERAL) {
		if (segments.length === 1) {
			return err('aim locator missing glossary slug (expected "glossary/<slug>")');
		}
		if (segments.length > 2) {
			return err(`aim locator has unexpected segments after glossary slug: "${segments.slice(2).join('/')}"`);
		}
		const slug = segments[1] ?? '';
		if (slug.length === 0) {
			return err('aim locator glossary slug is empty');
		}
		if (!GLOSSARY_SLUG_PATTERN.test(slug)) {
			return err(`aim locator glossary slug "${slug}" is malformed (expected kebab-case lowercase)`);
		}
		const aim: ParsedAimLocator = { glossarySlug: slug };
		return { kind: 'ok', segments, aim };
	}

	// Appendix: appendix-<N>
	if (first.startsWith(APPENDIX_PREFIX)) {
		if (segments.length > 1) {
			return err(`aim locator has unexpected segments after appendix: "${segments.slice(1).join('/')}"`);
		}
		if (!APPENDIX_PATTERN.test(first)) {
			return err(`aim locator appendix "${first}" is malformed (expected "appendix-<N>")`);
		}
		const aim: ParsedAimLocator = { appendix: first.slice(APPENDIX_PREFIX.length) };
		return { kind: 'ok', segments, aim };
	}

	// Numeric form: <chapter> | <chapter>-<section> | <chapter>-<section>-<paragraph>
	if (segments.length > 1) {
		return err(`aim locator has unexpected segments after numeric component: "${segments.slice(1).join('/')}"`);
	}
	if (!NUMERIC_TRIPLET_PATTERN.test(first)) {
		return err(
			`aim locator "${first}" is malformed (expected "<chapter>", "<chapter>-<section>", or "<chapter>-<section>-<paragraph>")`,
		);
	}

	const parts = first.split('-');
	if (parts.length === 0 || parts.length > 3) {
		return err(`aim locator "${first}" has wrong number of dash-separated parts (expected 1-3)`);
	}

	const chapter = parts[0] ?? '';
	if (!CHAPTER_PATTERN.test(chapter)) {
		return err(`aim locator chapter "${chapter}" is malformed (expected digits 1-99)`);
	}

	if (parts.length === 1) {
		const aim: ParsedAimLocator = { chapter };
		return { kind: 'ok', segments, aim };
	}

	const section = parts[1] ?? '';
	if (!SECTION_PATTERN.test(section)) {
		return err(`aim locator section "${section}" is malformed (expected digits 1-99)`);
	}

	if (parts.length === 2) {
		const aim: ParsedAimLocator = { chapter, section };
		return { kind: 'ok', segments, aim };
	}

	const paragraph = parts[2] ?? '';
	if (!PARAGRAPH_PATTERN.test(paragraph)) {
		return err(`aim locator paragraph "${paragraph}" is malformed (expected digits 1-999)`);
	}

	const aim: ParsedAimLocator = { chapter, section, paragraph };
	return { kind: 'ok', segments, aim };
}
