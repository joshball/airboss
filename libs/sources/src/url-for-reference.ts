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
import {
	airbossRefForAcDocument,
	airbossRefForAcsPublication,
	airbossRefForWholeDocHandbook,
} from './airboss-ref-builder.ts';
import { parseHandbooksLocator } from './handbooks/locator.ts';
import { parseInfoLocator } from './info/locator.ts';
import { parseNtsbAljLocator } from './ntsb-alj/locator.ts';
import { isParseError, parseIdentifier } from './parser.ts';
import { parseRegsLocator } from './regs/locator.ts';
import { parseSafoLocator } from './safo/locator.ts';
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
		case 'safo':
			return urlForSafo(parsed.locator);
		case 'info':
			return urlForInfo(parsed.locator);
		default:
			return ROUTES.FLIGHTBAG_HOME;
	}
}

/**
 * The handbook section/edition `airboss-ref:` URIs persisted on
 * `study.reference_section.airboss_ref` carry the full FAA edition
 * designation (`FAA-H-8083-16B`). The handbooks locator grammar -- and the
 * flightbag `/handbook/[slug]/[edition]` route -- use the short form
 * (`8083-16B`, the designation minus the `FAA-H-` prefix; mirrors
 * `shortHandbookEdition()` in the flightbag app). Normalise the edition
 * segment (index 1 of the locator) to the short form before parsing so a
 * stored URI resolves to a real reader URL instead of falling back to home.
 */
function normalizeHandbookLocator(locator: string): string {
	const segments = locator.split('/');
	const edition = segments[1];
	if (edition !== undefined && edition.startsWith('FAA-H-')) {
		segments[1] = edition.slice('FAA-H-'.length);
		return segments.join('/');
	}
	return locator;
}

function urlForHandbooks(rawLocator: string): string {
	const locator = normalizeHandbookLocator(rawLocator);
	const result = parseHandbooksLocator(locator);
	if (result.kind === 'error') return ROUTES.FLIGHTBAG_HOME;
	const hb = result.handbooks;
	if (hb === undefined) return ROUTES.FLIGHTBAG_HOME;
	// A bare `handbooks/<slug>` locator (no edition pin) is malformed for the
	// reader: every flightbag handbook route requires an edition segment so
	// the URL deep-links to a specific cached edition. Without an edition the
	// helper would emit `/handbook/<slug>/` which 404s; fall back to home so
	// the citation chip lands somewhere useful.
	if (hb.edition === '') return ROUTES.FLIGHTBAG_HOME;
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

/**
 * NTSB-ALJ ruling URLs route to the per-case landing. The flightbag does not
 * yet implement an `/ntsb-alj/[caseNumber]` route -- citations to ALJ rulings
 * pre-`/ntsb-alj/` ingest fall through to the flightbag home so the chip
 * doesn't 404. Once the route lands the URL helper switches to the real path.
 */
function urlForNtsbAlj(locator: string): string {
	const result = parseNtsbAljLocator(locator);
	if (result.kind === 'error') return ROUTES.FLIGHTBAG_HOME;
	const ntsbAlj = result.ntsbAlj;
	if (ntsbAlj === undefined) return ROUTES.FLIGHTBAG_HOME;
	// Routes don't exist in the flightbag yet -- fall back to home so the
	// citation chip lands somewhere instead of 404'ing.
	void ntsbAlj;
	return ROUTES.FLIGHTBAG_HOME;
}

/**
 * SAFO bulletin URLs would route to the per-bulletin landing, but the
 * flightbag does not yet implement an `/safo/[id]` route. Citations fall
 * through to home until that surface lands.
 */
function urlForSafo(locator: string): string {
	const result = parseSafoLocator(locator);
	if (result.kind === 'error') return ROUTES.FLIGHTBAG_HOME;
	const safo = result.safo;
	if (safo === undefined) return ROUTES.FLIGHTBAG_HOME;
	void safo;
	return ROUTES.FLIGHTBAG_HOME;
}

/**
 * InFO bulletin URLs would route to the per-bulletin landing, but the
 * flightbag does not yet implement an `/info/[id]` route. Citations fall
 * through to home until that surface lands.
 */
function urlForInfo(locator: string): string {
	const result = parseInfoLocator(locator);
	if (result.kind === 'error') return ROUTES.FLIGHTBAG_HOME;
	const info = result.info;
	if (info === undefined) return ROUTES.FLIGHTBAG_HOME;
	void info;
	return ROUTES.FLIGHTBAG_HOME;
}

/**
 * Minimal structural row shape consumed by {@link urlForReferenceRow}.
 *
 * The full `ReferenceRow` (`study.reference.$inferSelect`, re-exported from
 * `@ab/bc-study`) structurally satisfies this type, so every projection /
 * component caller passes its row directly. The shim deliberately depends on
 * a structural shape rather than importing `@ab/bc-study`: `libs/sources` is
 * a foundational lib that `@ab/bc-study` itself depends on, and a back-edge
 * (even a type-only one) would form a package cycle and break apps that
 * bundle `@ab/sources` without `@ab/bc-study` (e.g. `apps/avionics`).
 */
export interface ReferenceRowFields {
	readonly kind: string;
	readonly documentSlug: string;
	readonly edition: string;
}

/**
 * Row-shaped sibling of {@link urlForReference}. Thin shim for callers that
 * hold a `study.reference` row instead of an `airboss-ref:` URI string -- the
 * library-card projection, the handbook svelte components, the handbook tree
 * builder. Accepts any value with the `kind` / `documentSlug` / `edition`
 * fields ({@link ReferenceRowFields}); a full `ReferenceRow` satisfies it.
 *
 * The shim builds the corpus-appropriate whole-document `airboss-ref:` URI
 * from the row's `kind` / `documentSlug` / `edition` fields and delegates to
 * `urlForReference()`, so all per-corpus kind-switching, edition validation,
 * and malformed-input fallback stay in one place.
 *
 * Mapping per `study.reference.kind`:
 *
 * - `handbook` -> `airboss-ref:handbooks/<slug>/<edition>` -> `FLIGHTBAG_HANDBOOK(slug, edition)`.
 * - `cfr`      -> `airboss-ref:regs/cfr-<title>/<part>`    -> `FLIGHTBAG_CFR_PART(title, part)`.
 *               The CFR `documentSlug` is the seeder shape `<title>cfr<part>`
 *               (`14cfr91`, `49cfr830`); the title prefix is parsed off.
 * - `aim` / `pcg` -> `FLIGHTBAG_AIM` directly. The AIM `airboss-ref:` grammar
 *               has no whole-document locator (the locator after `aim/` is
 *               required), so the row shim short-circuits to the AIM landing.
 * - `ac`       -> `airboss-ref:ac/<docNumber>/<revision>`  -> `FLIGHTBAG_AC(doc, rev)`.
 *               The AC `documentSlug` is `ac-<docNumber>`; `edition` is the
 *               revision letter.
 * - `acs`      -> `airboss-ref:acs/<slug>`                 -> `FLIGHTBAG_ACS(slug)`.
 * - every other kind (`pts`, `poh`, `ntsb`, `safo`, `info`, `other`) ->
 *               `FLIGHTBAG_HOME`. These corpora have no flightbag reader
 *               route today; PTS publications are not registered ACS slugs.
 *               The fallback matches `urlForReference()` for the same corpora.
 *
 * Pure: no DB access, no side effects. The row argument carries every field
 * the shim reads. Returns a path only -- callers crossing app origins prefix
 * with `siblingOrigin(url, HOST_PREFIXES.FLIGHTBAG)`.
 *
 * See `docs/work-packages/flightbag-citation-url-migration/` (Phase A) and
 * the citations pattern doc `docs/ingestion-pipeline/reference-citations-pattern.md`.
 */
export function urlForReferenceRow(row: ReferenceRowFields): string {
	switch (row.kind) {
		case 'handbook':
			// `edition` is required by the flightbag handbook routes; an empty
			// edition produces a malformed URI that `urlForReference()` already
			// falls back to home for.
			return urlForReference(airbossRefForWholeDocHandbook(row.documentSlug, row.edition) as SourceId);
		case 'cfr': {
			const parsed = parseCfrDocumentSlug(row.documentSlug);
			if (parsed === null) return ROUTES.FLIGHTBAG_HOME;
			return ROUTES.FLIGHTBAG_CFR_PART(parsed.title, parsed.part);
		}
		case 'aim':
		case 'pcg':
			// No whole-document AIM `airboss-ref:` locator exists; route to the
			// AIM landing directly.
			return ROUTES.FLIGHTBAG_AIM;
		case 'ac': {
			// `documentSlug` is `ac-<docNumber>` (`ac-61-65`); `edition` is the
			// full FAA label (`AC 61-65J`, or `AC 60-22` with no revision). The
			// AC URI revision segment is the trailing letter(s) of the label,
			// lowercased; absent when the AC has no revision.
			const docNumber = row.documentSlug.replace(/^ac-/, '');
			const revision = acRevisionFromEdition(row.edition, docNumber);
			if (revision === null) {
				// No revision -- route to the whole-AC landing via its document
				// slug; the flightbag AC route requires a revision segment, so
				// fall back to home when the label carries none.
				return ROUTES.FLIGHTBAG_HOME;
			}
			return urlForReference(airbossRefForAcDocument(docNumber, revision) as SourceId);
		}
		case 'acs':
			return urlForReference(airbossRefForAcsPublication(row.documentSlug) as SourceId);
		default:
			// `pts`, `poh`, `ntsb`, `safo`, `info`, `other` -- no flightbag
			// reader route. PTS publications predate the ACS and are not
			// registered ACS slugs, so they fall back to home alongside the
			// other unrouted corpora; the underlying `urlForReference()` would
			// reject a PTS slug as a non-registered ACS publication anyway.
			return ROUTES.FLIGHTBAG_HOME;
	}
}

/**
 * Parse a CFR `documentSlug` of the seeder shape `<title>cfr<part>`
 * (`14cfr91`, `49cfr830`) into its title + part. Returns `null` when the
 * slug does not match the convention so the caller can fall back to home.
 */
function parseCfrDocumentSlug(documentSlug: string): { title: string; part: string } | null {
	const match = /^(14|49)cfr(\d{1,4})$/.exec(documentSlug);
	if (match === null) return null;
	const title = match[1];
	const part = match[2];
	if (title === undefined || part === undefined) return null;
	return { title, part };
}

/**
 * Extract the AC revision segment from a `study.reference.edition` label.
 *
 * AC editions are stored as the full FAA label -- `AC 61-65J`, `AC 00-6B`,
 * or `AC 60-22` (no revision). The AC `airboss-ref:` URI revision segment is
 * the trailing alpha suffix, lowercased. Returns `null` when the label
 * carries no revision letter so the caller can fall back gracefully.
 */
function acRevisionFromEdition(edition: string, docNumber: string): string | null {
	// Strip the leading "AC " label and the doc number prefix; whatever
	// trailing alpha remains is the revision.
	const trimmed = edition.replace(/^AC\s+/i, '').trim();
	const withoutDoc = trimmed.startsWith(docNumber) ? trimmed.slice(docNumber.length) : trimmed;
	const match = /^([A-Za-z]+)$/.exec(withoutDoc);
	if (match === null || match[1] === undefined) return null;
	return match[1].toLowerCase();
}
