/**
 * `sectionUrlFor` -- map a `study.reference_section` row (kind / slug / edition
 * / code / parent) to the flightbag reader URL it should render at, or to the
 * reason no URL exists.
 *
 * This is the structural map for the integration coverage sweep
 * (`tests/integration/flightbag-coverage.spec.ts`). The e2e
 * `representative-pages.spec.ts` spec embeds a `buildSectionUrl` that strips
 * front-matter rows / range rows etc. -- intentionally lenient so the rep
 * sample stays small and noise-free. This helper is the opposite: classify
 * every row, and route either to a URL, to "covered by parent" (a real reader
 * URL we already hit), or to "no route" (no reader exists yet -- captured but
 * not asserted).
 *
 * Decisions encoded here mirror what each route's loader actually accepts:
 *
 *   handbook   chapter '0' -> URL (we hit it deliberately to surface the
 *              front-matter bug); chapter.section -> URL; deeper -> parent
 *              section URL.
 *   AIM        chapter / chapter-section / chapter-section-paragraph -> URL;
 *              `appendix-*` / `pcg/*` / `glossary/*` -> no-route.
 *   CFR        `<part>` -> Part landing URL; `<part>.<digits>` -> section URL;
 *              `subpart-*`, range codes, dotted appendix -> parent (Part
 *              landing).
 *   AC         single chapter segment -> chapter URL; `<chapter>.<section>`
 *              -> section URL; deeper -> parent.
 *   ACS / PTS  publication landing for the publication row; area/task
 *              metadata is keyed off the row's parent ordinal so we keep the
 *              shape simple here -- the integration spec walks the publication
 *              landing for these (per-task URLs need the area/task metadata
 *              the seeder writes, which isn't in this helper's input shape).
 *              Element rows -> parent (the task body renders the element).
 *   SAFO / InFO / NTSB / POH / PCG: no-route -- the readers don't exist yet.
 *   OTHER:     no-route.
 *
 * Pure function. No DB access. Mirrors what `+page.server.ts` files accept;
 * any change to a route's `[param]` shape requires a matching change here.
 */

import {
	REFERENCE_KINDS,
	REFERENCE_SECTION_LEVELS,
	type ReferenceKind,
	type ReferenceSectionLevel,
	ROUTES,
} from '@ab/constants';
import { shortHandbookEdition } from '../routes/reader-url';

export type SectionUrlResult =
	| { readonly kind: 'url'; readonly url: string }
	| { readonly kind: 'covered-by-parent'; readonly parentUrl: string; readonly reason: string }
	| { readonly kind: 'no-route'; readonly reason: string };

export interface SectionUrlInput {
	readonly kind: ReferenceKind;
	readonly documentSlug: string;
	readonly edition: string;
	readonly code: string;
	readonly parentId: string | null;
	/**
	 * Optional row level (`'chapter'`, `'section'`, `'paragraph'`, `'area'`,
	 * `'task'`, `'element'`, `'appendix'`, `'glossary'`, ...). When present we
	 * key off it for corpora where the level disambiguates URL shape (AIM
	 * appendix vs paragraph, ACS task vs element). Pass `null` if unknown --
	 * the helper falls back to code-shape parsing.
	 */
	readonly level: ReferenceSectionLevel | null;
}

const AIM_NO_READER_LEVELS: ReadonlySet<ReferenceSectionLevel> = new Set([
	REFERENCE_SECTION_LEVELS.APPENDIX,
	REFERENCE_SECTION_LEVELS.GLOSSARY,
]);

// CFR section: `<part>.<digits>` only. Anything else (`subpart-X`, dotted
// appendix `121.1300-Appendix-A`, ranged `91.1-91.99`) is rejected and
// routed back to the Part landing.
const CFR_NUMERIC_SECTION = /^[0-9]+\.([0-9]+)$/;

// CFR slug -- `<title>cfr<part>` (e.g. `14cfr91`).
const CFR_SLUG = /^([0-9]+)cfr(.+)$/;

// AC `documentSlug` is `ac-<doc>` (e.g. `ac-61-65`). Edition is `AC 61-65J`;
// the trailing letter is the rev.
const AC_REV_LETTER = /([a-z])$/i;

/**
 * Map a `study.reference_section` row to its flightbag reader URL (or to the
 * reason the integration sweep should not assert on it).
 *
 * Three outcomes:
 *
 *  - `url` -- we render this section at a deep-linkable URL. The coverage
 *    spec hits it directly.
 *  - `covered-by-parent` -- there's no leaf reader, but a parent URL covers
 *    the same content (e.g. CFR ranges -> Part landing). The coverage spec
 *    hits the parent URL, deduped across siblings.
 *  - `no-route` -- no reader exists for this row's corpus at all. Captured
 *    in the skipped count of the run report but not asserted.
 */
export function sectionUrlFor(args: SectionUrlInput): SectionUrlResult {
	const { kind, documentSlug, edition, code, level } = args;

	switch (kind) {
		case REFERENCE_KINDS.HANDBOOK:
			return handbookUrl(documentSlug, edition, code);
		case REFERENCE_KINDS.AIM:
			return aimUrl(code, level);
		case REFERENCE_KINDS.CFR:
			return cfrUrl(documentSlug, code);
		case REFERENCE_KINDS.AC:
			return acUrl(documentSlug, edition, code);
		case REFERENCE_KINDS.ACS:
		case REFERENCE_KINDS.PTS:
			return acsUrl(documentSlug, level);
		case REFERENCE_KINDS.SAFO:
			return { kind: 'no-route', reason: 'no flightbag SAFO reader yet (WP-SAFO-INFO)' };
		case REFERENCE_KINDS.INFO:
			return { kind: 'no-route', reason: 'no flightbag InFO reader yet (WP-SAFO-INFO)' };
		case REFERENCE_KINDS.NTSB:
			return { kind: 'no-route', reason: 'no flightbag NTSB-ALJ reader yet (WP-NTSB-ALJ)' };
		case REFERENCE_KINDS.POH:
			return { kind: 'no-route', reason: 'no flightbag POH reader yet -- POH umbrella references only' };
		case REFERENCE_KINDS.PCG:
			return { kind: 'no-route', reason: 'no flightbag Pilot/Controller Glossary reader yet' };
		case REFERENCE_KINDS.OTHER:
			return { kind: 'no-route', reason: 'OTHER kind -- no canonical reader' };
	}
}

function handbookUrl(documentSlug: string, edition: string, code: string): SectionUrlResult {
	const shortEdition = shortHandbookEdition(edition);
	const segments = code.split('.');
	const chapter = segments[0];
	const section = segments[1];

	if (!chapter) {
		// Empty code -- shouldn't happen for handbook rows, but handle defensively.
		return { kind: 'no-route', reason: 'handbook row has no code' };
	}

	if (segments.length === 1) {
		// Whole-chapter row -- handbook chapter URL.
		return {
			kind: 'url',
			url: ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER(documentSlug, shortEdition, chapter),
		};
	}

	if (segments.length === 2 && section) {
		// Chapter.section -- handbook section URL. Chapter '0' (front-matter)
		// is INCLUDED here intentionally: the reader 404s these today, and
		// the integration sweep is here to surface that bug.
		return {
			kind: 'url',
			url: ROUTES.FLIGHTBAG_HANDBOOK_SECTION(documentSlug, shortEdition, chapter, section),
		};
	}

	// Deeper subsection (`1.2.3+`). The reader only handles two segments;
	// fall back to the chapter URL the row sits under.
	return {
		kind: 'covered-by-parent',
		parentUrl: ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER(documentSlug, shortEdition, chapter),
		reason: 'handbook subsection (3+ segments) -- reader covers the chapter',
	};
}

function aimUrl(code: string, level: ReferenceSectionLevel | null): SectionUrlResult {
	if (level !== null && AIM_NO_READER_LEVELS.has(level)) {
		return { kind: 'no-route', reason: 'AIM appendix/glossary -- no flightbag reader' };
	}
	if (/^appendix-/i.test(code) || /^pcg\//i.test(code) || /^glossary\//i.test(code)) {
		return { kind: 'no-route', reason: 'AIM appendix/glossary -- no flightbag reader' };
	}
	const parts = code.split('-');
	const chapter = parts[0];
	const section = parts[1];
	const paragraph = parts[2];

	if (parts.length === 1 && chapter) {
		return { kind: 'url', url: ROUTES.FLIGHTBAG_AIM_CHAPTER(chapter) };
	}
	if (parts.length === 2 && chapter && section) {
		return { kind: 'url', url: ROUTES.FLIGHTBAG_AIM_SECTION(chapter, section) };
	}
	if (parts.length === 3 && chapter && section && paragraph) {
		return { kind: 'url', url: ROUTES.FLIGHTBAG_AIM_PARAGRAPH(chapter, section, paragraph) };
	}
	if (parts.length >= 4 && chapter && section && paragraph) {
		// Sub-paragraph (`5-1-7-a`). Reader handles 3 segments; cover via
		// paragraph URL.
		return {
			kind: 'covered-by-parent',
			parentUrl: ROUTES.FLIGHTBAG_AIM_PARAGRAPH(chapter, section, paragraph),
			reason: 'AIM sub-paragraph (4+ segments) -- reader covers the parent paragraph',
		};
	}
	return { kind: 'no-route', reason: 'AIM code shape not handled by any reader route' };
}

function cfrUrl(documentSlug: string, code: string): SectionUrlResult {
	const slugMatch = CFR_SLUG.exec(documentSlug);
	if (!slugMatch) {
		return { kind: 'no-route', reason: `CFR documentSlug shape not recognised: ${documentSlug}` };
	}
	const title = slugMatch[1];
	const part = slugMatch[2];
	if (!title || !part) {
		return { kind: 'no-route', reason: `CFR slug missing title or part: ${documentSlug}` };
	}

	// Part row -- the reference row's code equals the Part number.
	if (code === part) {
		return { kind: 'url', url: ROUTES.FLIGHTBAG_CFR_PART(title, part) };
	}

	// Strict numeric section: `<part>.<digits>`.
	const sectionMatch = CFR_NUMERIC_SECTION.exec(code);
	if (sectionMatch?.[1]) {
		return { kind: 'url', url: ROUTES.FLIGHTBAG_CFR_SECTION(title, part, sectionMatch[1]) };
	}

	// Subpart wrappers (`subpart-A`), dotted appendices (`121.1300-Appendix-A`),
	// section-range rows (`91.1-91.99`): no leaf reader. Route to the Part
	// landing, which the coverage sweep will hit deduped.
	return {
		kind: 'covered-by-parent',
		parentUrl: ROUTES.FLIGHTBAG_CFR_PART(title, part),
		reason: 'CFR non-numeric code (subpart wrapper / range / appendix) -- reader covers the Part landing',
	};
}

function acUrl(documentSlug: string, edition: string, code: string): SectionUrlResult {
	const docNumber = documentSlug.startsWith('ac-') ? documentSlug.slice('ac-'.length) : documentSlug;
	const revMatch = AC_REV_LETTER.exec(edition);
	const revLetter = revMatch?.[1];
	if (!revLetter) {
		return { kind: 'no-route', reason: `AC edition "${edition}" has no trailing revision letter` };
	}
	const rev = revLetter.toLowerCase();

	const segments = code.split('.');
	const chapter = segments[0];
	const section = segments[1];

	if (!chapter) {
		return { kind: 'no-route', reason: 'AC row has no code' };
	}

	if (segments.length === 1) {
		return { kind: 'url', url: ROUTES.FLIGHTBAG_AC_CHAPTER(docNumber, rev, chapter) };
	}
	if (segments.length === 2 && section) {
		return { kind: 'url', url: ROUTES.FLIGHTBAG_AC_SECTION(docNumber, rev, chapter, section) };
	}
	// Deeper subsection -- reader covers parent section.
	return {
		kind: 'covered-by-parent',
		parentUrl:
			section !== undefined
				? ROUTES.FLIGHTBAG_AC_SECTION(docNumber, rev, chapter, section)
				: ROUTES.FLIGHTBAG_AC_CHAPTER(docNumber, rev, chapter),
		reason: 'AC subsection (3+ segments) -- reader covers the parent section',
	};
}

function acsUrl(documentSlug: string, level: ReferenceSectionLevel | null): SectionUrlResult {
	// The publication landing renders the area + task tree for the whole
	// ACS. The per-task reader at /acs/[doc]/area/[area]/task/[task] requires
	// area_padded + task_letter metadata that lives on the row but isn't in
	// this helper's input shape. Until the metadata flows through, route
	// every ACS row to the publication landing (covered-by-parent).
	const publicationUrl = ROUTES.FLIGHTBAG_ACS(documentSlug);
	if (level === REFERENCE_SECTION_LEVELS.PUBLICATION || level === null) {
		// The publication row itself maps directly to the landing URL.
		return { kind: 'url', url: publicationUrl };
	}
	if (level === REFERENCE_SECTION_LEVELS.ELEMENT) {
		return {
			kind: 'covered-by-parent',
			parentUrl: publicationUrl,
			reason: 'ACS element row -- task body renders the element bullets',
		};
	}
	// Area or task -- no helper-input shape to build the URL; covered by the
	// publication landing's TOC.
	return {
		kind: 'covered-by-parent',
		parentUrl: publicationUrl,
		reason: `ACS ${level ?? 'row'} -- task URL needs area_padded + task_letter metadata not in helper input`,
	};
}
