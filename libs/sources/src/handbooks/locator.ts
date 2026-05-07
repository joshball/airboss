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
 *
 * The first three (`phak`, `afh`, `avwx`) are chapter-aware Class A/C handbooks
 * with per-chapter PDFs and section-level extraction. The remainder are
 * whole-doc-only Class C handbooks ingested via the `handbooks-extras`
 * pipeline (`libs/sources/src/handbooks-extras/`); they have no chapter splits
 * and only the `<doc>/<edition>` whole-doc locator form has a registry entry.
 */
export const HANDBOOK_DOC_SLUGS: readonly string[] = [
	'phak',
	'afh',
	'avwx',
	'risk-management',
	'aviation-instructor',
	'ifh',
	'iph',
	'tips-mountain-flying',
];

// Edition slug shapes accepted under the `handbooks` corpus:
//   - FAA H-numbered handbooks: `8083-25C`, `8083-3C`, `8083-9` (the bulk).
//   - Non-H-numbered FAA-published handbooks/pamphlets: `<slug>-<year>` style
//     (e.g. `mtn-2003` for the Tips on Mountain Flying pamphlet, which has
//     no FAA H designator). The slug component is `[a-z][a-z0-9-]{0,15}` so
//     it stays bounded without dictating individual slugs.
const EDITION_PATTERN = /^([0-9]{4}-[0-9]{1,3}[a-z]?|[a-z][a-z0-9-]{0,15}-[0-9]{4})$/i;
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
 * Predicate for the registry-aware path-grammar disambiguation per ADR 019
 * amendment 2026-05 §1: returns true when `candidate` is a known edition
 * slug for `doc` in the registry. The handbooks resolver supplies a
 * predicate backed by `HANDBOOK_DOC_EDITIONS`; tests that exercise the
 * locator parser in isolation can pass a simple `Set`-backed predicate or
 * use the default below.
 */
export type IsKnownEdition = (doc: string, candidate: string) => boolean;

/**
 * Default known-edition predicate when the caller did not supply one. Falls
 * back to the syntactic edition-shape regex so bare locator-parser callers
 * (tests, the migration script) still work without registry wiring. The
 * production resolver overrides with a registry-aware predicate.
 */
const defaultIsKnownEdition: IsKnownEdition = (_doc, candidate) => EDITION_PATTERN.test(candidate);

/**
 * Parse a `handbooks` corpus locator. The locator is the segment after
 * `airboss-ref:handbooks/`, stripped of `?at=...`. Returns a `ParsedLocator`
 * with the `handbooks` payload on success.
 *
 * Per ADR 019 amendment 2026-05 §1, the segment immediately following
 * `<slug>` is matched against the registry's known editions for that slug
 * via the `isKnownEdition` predicate. If it matches, treat as the edition
 * pin; otherwise treat as the start of the chapter locator (and resolve
 * the edition implicitly to current downstream).
 */
export function parseHandbooksLocator(locator: string, isKnownEdition?: IsKnownEdition): ParsedLocator | LocatorError {
	if (locator.length === 0) {
		return err('handbooks locator is empty');
	}

	const segments = locator.split('/');
	const editionPredicate = isKnownEdition ?? defaultIsKnownEdition;

	const doc = segments[0] ?? '';
	if (doc.length === 0) {
		return err('handbooks locator missing doc slug');
	}
	if (!HANDBOOK_DOC_SLUGS.includes(doc)) {
		return err(`handbooks locator doc "${doc}" is not one of: ${HANDBOOK_DOC_SLUGS.join(', ')}`);
	}

	// Whole-doc reference with no edition (`<doc>` only). Per amendment §1,
	// this resolves to the current edition.
	if (segments.length === 1) {
		const handbooks: ParsedHandbooksLocator = { doc, edition: '' };
		return { kind: 'ok', segments, handbooks };
	}

	const second = segments[1] ?? '';
	let edition = '';
	let consumedEditionSegment = false;

	if (second.length === 0) {
		return err(`handbooks locator has empty segment after doc slug "${doc}"`);
	}

	if (editionPredicate(doc, second)) {
		edition = second;
		consumedEditionSegment = true;
	} else if (EDITION_PATTERN.test(second)) {
		// Looks like an edition slug syntactically but registry has not heard
		// of it. Reject with the original "malformed edition" message so
		// authors who typoed an edition pin still get a useful error.
		return err(`handbooks locator edition "${second}" is not a known edition for doc "${doc}"`);
	} else {
		// Not an edition; treat as the start of the chapter locator (i.e.
		// segments[1] = chapter). Edition resolves to current downstream.
		edition = '';
		consumedEditionSegment = false;
	}

	// If the second segment was consumed as the edition, the chapter / figure
	// / table starts at index 2. Otherwise it starts at index 1.
	const tailStart = consumedEditionSegment ? 2 : 1;

	// Whole handbook reference: <doc>/<edition> (no further segments).
	if (consumedEditionSegment && segments.length === 2) {
		const handbooks: ParsedHandbooksLocator = { doc, edition };
		return { kind: 'ok', segments, handbooks };
	}

	// Tail offsets: with edition consumed, chapter is at tailStart=2; without
	// edition, chapter is at tailStart=1. The expected segment count is
	// `tailStart + offset` where offset 1 = chapter, 2 = section/intro, etc.
	const third = segments[tailStart] ?? '';
	const expectAfterChapter = tailStart + 1; // index where 'fourth' lives

	// Figure / table reference: <doc>[/<edition>]/fig-N-M or tbl-N-M
	if (third.startsWith('fig-')) {
		if (!FIGURE_PATTERN.test(third)) {
			return err(`handbooks locator figure "${third}" is malformed (expected "fig-<N>-<M>")`);
		}
		if (segments.length > tailStart + 1) {
			return err(
				`handbooks locator has unexpected segments after figure: "${segments.slice(tailStart + 1).join('/')}"`,
			);
		}
		const handbooks: ParsedHandbooksLocator = { doc, edition, figure: third };
		return { kind: 'ok', segments, handbooks };
	}
	if (third.startsWith('tbl-')) {
		if (!TABLE_PATTERN.test(third)) {
			return err(`handbooks locator table "${third}" is malformed (expected "tbl-<N>-<M>")`);
		}
		if (segments.length > tailStart + 1) {
			return err(`handbooks locator has unexpected segments after table: "${segments.slice(tailStart + 1).join('/')}"`);
		}
		const handbooks: ParsedHandbooksLocator = { doc, edition, table: third };
		return { kind: 'ok', segments, handbooks };
	}

	// Chapter reference: <doc>[/<edition>]/<chapter>
	if (!CHAPTER_PATTERN.test(third)) {
		return err(`handbooks locator chapter "${third}" is malformed (expected digits)`);
	}
	const chapter = third;

	if (segments.length === tailStart + 1) {
		const handbooks: ParsedHandbooksLocator = { doc, edition, chapter };
		return { kind: 'ok', segments, handbooks };
	}

	const fourth = segments[expectAfterChapter] ?? '';

	// Intro: <doc>[/<edition>]/<chapter>/intro
	if (fourth === INTRO_LITERAL) {
		if (segments.length > expectAfterChapter + 1) {
			return err(
				`handbooks locator has unexpected segments after intro: "${segments.slice(expectAfterChapter + 1).join('/')}"`,
			);
		}
		const handbooks: ParsedHandbooksLocator = { doc, edition, chapter, section: INTRO_LITERAL };
		return { kind: 'ok', segments, handbooks };
	}

	// Section: <doc>[/<edition>]/<chapter>/<section>
	if (!SECTION_NUMBER_PATTERN.test(fourth)) {
		return err(`handbooks locator section "${fourth}" is malformed (expected digits or "intro")`);
	}
	const section = fourth;

	if (segments.length === expectAfterChapter + 1) {
		const handbooks: ParsedHandbooksLocator = { doc, edition, chapter, section };
		return { kind: 'ok', segments, handbooks };
	}

	const fifth = segments[expectAfterChapter + 1] ?? '';

	// Paragraph: <doc>[/<edition>]/<chapter>/<section>/para-N
	if (fifth.startsWith('para-')) {
		if (!PARAGRAPH_PATTERN.test(fifth)) {
			return err(`handbooks locator paragraph "${fifth}" is malformed (expected "para-<N>")`);
		}
		if (segments.length > expectAfterChapter + 2) {
			return err(
				`handbooks locator has unexpected segments after paragraph: "${segments.slice(expectAfterChapter + 2).join('/')}"`,
			);
		}
		const handbooks: ParsedHandbooksLocator = { doc, edition, chapter, section, paragraph: fifth };
		return { kind: 'ok', segments, handbooks };
	}

	// Subsection: <doc>[/<edition>]/<chapter>/<section>/<subsection>
	if (!SUBSECTION_PATTERN.test(fifth)) {
		return err(`handbooks locator subsection "${fifth}" is malformed (expected digits or "para-<N>")`);
	}
	if (segments.length > expectAfterChapter + 2) {
		return err(
			`handbooks locator has unexpected segments after subsection: "${segments.slice(expectAfterChapter + 2).join('/')}"`,
		);
	}
	const handbooks: ParsedHandbooksLocator = { doc, edition, chapter, section, subsection: fifth };
	return { kind: 'ok', segments, handbooks };
}
