/**
 * URI-to-URL bridge for `airboss-ref:` identifiers -> flightbag reader URLs.
 *
 * Source of truth: `docs/platform/REFERENCES.md` ("Routing layer -- where URL
 * strings live"). This helper lives in `libs/sources/` because it owns the
 * `airboss-ref:` URI scheme and the per-corpus locator parsers; it dispatches
 * into `ROUTES.FLIGHTBAG_*` from `libs/constants/` for the URL templates.
 *
 * Citation surfaces in study, sim, hangar, etc. import `urlForReference` from
 * `@ab/sources`; never construct a flightbag URL inline. New corpora add a
 * dispatch branch here when the flightbag reader gains a route for them.
 */

import { ROUTES } from '@ab/constants';
import { parseAcLocator } from './ac/locator.ts';
import { parseAcsLocator } from './acs/locator.ts';
import { parseAimLocator } from './aim/locator.ts';
import { parseHandbooksLocator } from './handbooks/locator.ts';
import { parseNtsbAljLocator } from './ntsb-alj/locator.ts';
import { isParseError, parseIdentifier } from './parser.ts';
import { parseRegsLocator } from './regs/locator.ts';
import type { SourceId } from './types.ts';

/**
 * Map an `airboss-ref:` identifier to a flightbag reader URL path. Returns the
 * path only (no origin); callers prefix with the flightbag origin via
 * `siblingOrigin` when the link crosses app boundaries.
 *
 * Behavior:
 *
 * - Recognised corpora (handbooks / aim / regs / ac / acs) map to the deepest
 *   route the locator supports. A handbooks URI with only `<doc>/<edition>`
 *   maps to `FLIGHTBAG_HANDBOOK`; one with `<doc>/<edition>/<chapter>` maps to
 *   `FLIGHTBAG_HANDBOOK_CHAPTER`; etc.
 * - When the URI parses but the locator can't be turned into a flightbag URL
 *   (e.g. handbooks figure / table that have no reader page yet, AIM glossary
 *   entry, AC change, ACS element), the function returns `FLIGHTBAG_HOME` as a
 *   fallback. Future routes will narrow this.
 * - When the URI fails to parse OR the corpus is not yet covered by flightbag,
 *   the function returns `FLIGHTBAG_HOME`. Callers are responsible for
 *   validation upstream; this helper is forgiving so a malformed citation
 *   chip still navigates somewhere useful.
 */
export function urlForReference(uri: SourceId): string {
	const parsed = parseIdentifier(uri);
	if (isParseError(parsed)) {
		return ROUTES.FLIGHTBAG_HOME;
	}

	switch (parsed.corpus) {
		case 'handbooks':
			return urlForHandbooks(parsed.locator);
		case 'aim':
			return urlForAim(parsed.locator);
		case 'regs':
			return urlForRegs(parsed.locator);
		case 'ac':
			return urlForAc(parsed.locator);
		case 'acs':
			return urlForAcs(parsed.locator);
		case 'ntsb-alj':
			return urlForNtsbAlj(parsed.locator);
		default:
			return ROUTES.FLIGHTBAG_HOME;
	}
}

function urlForHandbooks(locator: string): string {
	const result = parseHandbooksLocator(locator);
	if (result.kind === 'error') return ROUTES.FLIGHTBAG_HOME;
	const hb = result.handbooks;
	if (hb === undefined) return ROUTES.FLIGHTBAG_HOME;
	if (hb.chapter !== undefined && hb.section !== undefined) {
		return ROUTES.FLIGHTBAG_HANDBOOK_SECTION(hb.doc, hb.edition, hb.chapter, hb.section);
	}
	if (hb.chapter !== undefined) {
		return ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER(hb.doc, hb.edition, hb.chapter);
	}
	return ROUTES.FLIGHTBAG_HANDBOOK(hb.doc, hb.edition);
}

function urlForAim(locator: string): string {
	const result = parseAimLocator(locator);
	if (result.kind === 'error') return ROUTES.FLIGHTBAG_HOME;
	const aim = result.aim;
	if (aim === undefined) return ROUTES.FLIGHTBAG_HOME;
	if (aim.chapter !== undefined && aim.section !== undefined && aim.paragraph !== undefined) {
		return ROUTES.FLIGHTBAG_AIM_PARAGRAPH(aim.chapter, aim.section, aim.paragraph);
	}
	if (aim.chapter !== undefined && aim.section !== undefined) {
		return ROUTES.FLIGHTBAG_AIM_SECTION(aim.chapter, aim.section);
	}
	if (aim.chapter !== undefined) {
		return ROUTES.FLIGHTBAG_AIM_CHAPTER(aim.chapter);
	}
	// Glossary entries / appendices fall back to the AIM landing.
	return ROUTES.FLIGHTBAG_AIM;
}

function urlForRegs(locator: string): string {
	const result = parseRegsLocator(locator);
	if (result.kind === 'error') return ROUTES.FLIGHTBAG_HOME;
	const regs = result.regs;
	if (regs === undefined) return ROUTES.FLIGHTBAG_HOME;
	if (regs.section === undefined) {
		// Whole-Part / subpart shapes route to the Part landing (umbrella card
		// + section TOC when ingested).
		return ROUTES.FLIGHTBAG_CFR_PART(regs.title, regs.part);
	}
	return ROUTES.FLIGHTBAG_CFR_SECTION(regs.title, regs.part, regs.section);
}

function urlForAc(locator: string): string {
	const result = parseAcLocator(locator);
	if (result.kind === 'error') return ROUTES.FLIGHTBAG_HOME;
	const ac = result.ac;
	if (ac === undefined) return ROUTES.FLIGHTBAG_HOME;
	// `section-<n>` URI carries one number; in the DB the AC chapter row's
	// code is that number. Route to the chapter view.
	if (ac.section !== undefined) {
		return ROUTES.FLIGHTBAG_AC_CHAPTER(ac.docNumber, ac.revision, ac.section);
	}
	// Change identifiers route to the whole-doc landing for now.
	return ROUTES.FLIGHTBAG_AC(ac.docNumber, ac.revision);
}

function urlForAcs(locator: string): string {
	const result = parseAcsLocator(locator);
	if (result.kind === 'error') return ROUTES.FLIGHTBAG_HOME;
	const acs = result.acs;
	if (acs === undefined) return ROUTES.FLIGHTBAG_HOME;
	if (acs.area !== undefined && acs.task !== undefined) {
		return ROUTES.FLIGHTBAG_ACS_TASK(acs.slug, acs.area, acs.task);
	}
	// Whole-publication and area-only ACS URIs route to the publication landing.
	if (acs.slug !== undefined) {
		return ROUTES.FLIGHTBAG_ACS(acs.slug);
	}
	return ROUTES.FLIGHTBAG_HOME;
}

function urlForNtsbAlj(locator: string): string {
	const result = parseNtsbAljLocator(locator);
	if (result.kind === 'error') return ROUTES.FLIGHTBAG_HOME;
	const ntsbAlj = result.ntsbAlj;
	if (ntsbAlj === undefined) return ROUTES.FLIGHTBAG_HOME;
	if (ntsbAlj.section !== undefined) {
		return ROUTES.FLIGHTBAG_NTSB_ALJ_SECTION(ntsbAlj.caseNumber, ntsbAlj.section);
	}
	return ROUTES.FLIGHTBAG_NTSB_ALJ(ntsbAlj.caseNumber);
}
