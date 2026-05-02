/**
 * Slug-shape parsers for `/library/*` route loaders.
 *
 * Every `parseX` returns the typed value when the input is a syntactically
 * valid slug for that surface, or `null` for a shape mismatch. Shape checks
 * stop at "is this a plausible URL fragment?" -- DB lookups (does this
 * reference exist?) stay in the route loader. The split keeps the parsers
 * pure (no DB, no I/O) and trivially testable.
 *
 * Naming convention: every slug here is lowercase kebab (`a-z`, `0-9`, `-`).
 * Section codes accept a single dot (`91.103`). No uppercase, no underscores,
 * no Unicode -- callers reject anything else with a 404.
 */

import {
	CERT_APPLICABILITY_VALUES,
	type CertApplicability,
	LIBRARY_REGULATIONS_KIND_VALUES,
	LIBRARY_REGULATIONS_KINDS,
	type LibraryRegulationsKind,
} from '@ab/constants';

/**
 * Lowercase slug shape: at least one letter/digit, then any mix of
 * letters/digits/hyphens. Matches the kebab slugs used across
 * `course/references/*.yaml` (e.g. `ac-91-23`, `faa-h-8083-2`, `aih`).
 */
const SLUG_SHAPE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * Digits-only shape used for CFR Part numbers (`91`, `135`) and AC series
 * keys (`00`, `61`, `120`).
 */
const DIGITS_SHAPE = /^\d+$/;

/**
 * Handbook chapter codes are typically a number (`1`, `12`) and may grow
 * letter suffixes for handbooks that re-issue chapters (`12A`). Stay
 * permissive on shape -- DB lookup is the real gate.
 */
const CHAPTER_SHAPE = /^[a-z0-9]+$/i;

/**
 * Section codes carry a single dot (`91.103`, `12.1`). Both halves are
 * digits in practice; allow alphanumeric so a future re-ingestion that
 * carries a letter suffix (`91.103a`) still resolves.
 */
const SECTION_SHAPE = /^[a-z0-9]+(?:\.[a-z0-9]+)?$/i;

/**
 * Parse a `/library/regulations/[kind]` URL fragment into a
 * {@link LibraryRegulationsKind}. Returns `null` for any string outside
 * the closed enum.
 */
export function parseRegulationKind(input: string): LibraryRegulationsKind | null {
	return (LIBRARY_REGULATIONS_KIND_VALUES as readonly string[]).includes(input)
		? (input as LibraryRegulationsKind)
		: null;
}

/**
 * Parse a `/library/regulations/[kind]/[group]` URL fragment. Group shape
 * depends on the regulations kind:
 *
 *   - `14-cfr` / `49-cfr`: digits-only Part number (`91`, `830`).
 *   - `ac`: digits-only series key (`00`, `60`, `61`, `90`, `91`, `120`, `150`).
 *   - `aim` / `ntsb`: a slug-shaped reference document slug (e.g. `pcg`, `ntsb`).
 *
 * Returns the group string unchanged on success, `null` on shape mismatch.
 */
export function parseRegulationGroup(kind: LibraryRegulationsKind, input: string): string | null {
	switch (kind) {
		case LIBRARY_REGULATIONS_KINDS.CFR_14:
		case LIBRARY_REGULATIONS_KINDS.CFR_49:
		case LIBRARY_REGULATIONS_KINDS.AC:
			return DIGITS_SHAPE.test(input) ? input : null;
		case LIBRARY_REGULATIONS_KINDS.AIM:
		case LIBRARY_REGULATIONS_KINDS.NTSB:
			return SLUG_SHAPE.test(input) ? input : null;
	}
}

/**
 * Parse a `/library/regulations/[kind]/[group]/[section]` URL fragment into
 * a chapter / section pair. The leaf reader treats the section URL segment
 * as `<chapter>.<section>` (e.g. `91.103` -> chapter `91`, section `103`)
 * but a chapter-only URL (`91`) is also valid and resolves with an empty
 * section. Returns `null` for shape mismatches.
 */
export function parseRegulationSection(input: string): { chapterCode: string; sectionCode: string } | null {
	if (!SECTION_SHAPE.test(input)) return null;
	const dotIndex = input.indexOf('.');
	if (dotIndex < 0) return { chapterCode: input, sectionCode: '' };
	return {
		chapterCode: input.slice(0, dotIndex),
		sectionCode: input.slice(dotIndex + 1),
	};
}

/**
 * Parse a `/library/handbook/[slug]` URL fragment. Handbook document
 * slugs are kebab-shape (`afh`, `faa-h-8083-2`); shape validation stops
 * the loader from issuing a DB query for an obviously malformed URL.
 * Returns the slug unchanged on success, `null` on shape mismatch.
 */
export function parseHandbookSlug(input: string): string | null {
	return SLUG_SHAPE.test(input) ? input : null;
}

/**
 * Parse a `/library/handbook/[slug]/[chapter]` URL fragment. Chapter codes
 * are alphanumeric (`1`, `12`, `12A` for re-issued chapters). Returns the
 * chapter code unchanged on success, `null` on shape mismatch.
 */
export function parseHandbookChapter(input: string): string | null {
	return CHAPTER_SHAPE.test(input) ? input : null;
}

/**
 * Parse a `/library/handbook/[slug]/[chapter]/[section]` URL fragment.
 * Section codes follow the same `<chapter>.<section>` shape used by the
 * regulations leaf reader, except the URL only carries the trailing
 * subsection -- the chapter comes from the parent route. Returns the
 * section code unchanged on success, `null` on shape mismatch.
 */
export function parseHandbookSection(input: string): string | null {
	return SECTION_SHAPE.test(input) ? input : null;
}

/**
 * Parse a `/library/cert/[cert]` URL fragment into a {@link CertApplicability}.
 * Returns `null` for any string outside the closed enum.
 */
export function parseCertSlug(input: string): CertApplicability | null {
	return (CERT_APPLICABILITY_VALUES as readonly string[]).includes(input) ? (input as CertApplicability) : null;
}

/**
 * Parse a `/library/aircraft/[slug]` URL fragment. POH/AFM slugs follow
 * the same kebab shape as handbook slugs (`poh-afm`). Returns the slug
 * unchanged on success, `null` on shape mismatch.
 */
export function parseAircraftSlug(input: string): string | null {
	return SLUG_SHAPE.test(input) ? input : null;
}
