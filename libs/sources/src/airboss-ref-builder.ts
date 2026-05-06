/**
 * `airboss-ref:` URI builders -- one per corpus.
 *
 * Source of truth for the URI shape: ADR 019 §1.1 + the per-corpus locator
 * parsers (regs/locator.ts, aim/locator.ts, ac/locator.ts, acs/locator.ts,
 * handbooks/locator.ts, etc.). Seeders call these to compute the canonical
 * URI at insert time so it can be persisted on `study.reference_section`
 * (the stage-5 deep-link work; see WP `stage5-citation-deeplink`).
 *
 * Symmetric with the in-app reverse direction `urlForReference()`: the
 * builders here go (row data) -> URI; that helper goes URI -> flightbag URL.
 *
 * Whole-doc handbooks land at `handbooks/<doc>/<edition>` (no section
 * fragment). Whole-doc AC / NTSB ALJ / SAFO / InFO follow the same pattern --
 * the URI names the document; the depth-0 row is its sole section.
 *
 * Pure functions; no DB access, no side effects.
 */

const SCHEME_PREFIX = 'airboss-ref:';

/** Build a handbooks URI. Code is dotted in seeders (`"12.3.2"`); URI uses slashes. */
export function airbossRefForHandbookSection(documentSlug: string, edition: string, code: string): string {
	const path = code.split('.').join('/');
	return `${SCHEME_PREFIX}handbooks/${documentSlug}/${edition}/${path}`;
}

/** Whole-doc handbook URI (no section fragment). */
export function airbossRefForWholeDocHandbook(documentSlug: string, edition: string): string {
	return `${SCHEME_PREFIX}handbooks/${documentSlug}/${edition}`;
}

/**
 * Build a CFR URI. Title comes from the manifest (`"14"`/`"49"`); part is the
 * second hyphen-separated segment of the documentSlug (e.g. `"14cfr91"` ->
 * part `"91"`). Section is the section code as authored (`"91.103"` ->
 * `"91/103"` in the URI).
 */
/**
 * Build a CFR Subpart URI. `airboss-ref:regs/cfr-14/91/subpart-A`. Subpart
 * letter is uppercased to match the publisher form (Subpart A, B, ...).
 */
export function airbossRefForCfrSubpart(title: number | string, part: string, subpartLetter: string): string {
	return `${SCHEME_PREFIX}regs/cfr-${title}/${part}/subpart-${subpartLetter.toUpperCase()}`;
}

export function airbossRefForCfrSection(title: number | string, sectionCode: string): string {
	// `91.103` -> `91/103`; `91.103(b)(1)(i)` -> `91/103/b/1/i`. Match the
	// shape that `parseRegsLocator` round-trips: dots become slashes; paren
	// chains for paragraph levels also become slashes.
	const normalized = sectionCode.replace(/[.()]/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
	const dash = normalized.indexOf('/');
	if (dash <= 0) {
		throw new Error(`CFR section code "${sectionCode}" has no part prefix; expected "<part>.<section>".`);
	}
	return `${SCHEME_PREFIX}regs/cfr-${title}/${normalized}`;
}

/**
 * Build an AIM URI. Code is dashed in the manifest (`"5-2-1"`) and stays
 * dashed in the URI (matches `parseAimLocator` and the flightbag route
 * params).
 */
export function airbossRefForAimEntry(code: string): string {
	return `${SCHEME_PREFIX}aim/${code}`;
}

/**
 * Build an AC URI. Whole-doc form: `airboss-ref:ac/<doc>/<rev>`. Section
 * form: `airboss-ref:ac/<doc>/<rev>/section-<n>`. The `<doc>` segment is the
 * AC document number ("61-65"); the `<rev>` segment is the revision letter
 * lowercased ("j") -- callers normalise.
 */
export function airbossRefForAcDocument(docNumber: string, revision: string): string {
	return `${SCHEME_PREFIX}ac/${docNumber}/${revision.toLowerCase()}`;
}

export function airbossRefForAcSection(docNumber: string, revision: string, sectionNumber: string): string {
	return `${SCHEME_PREFIX}ac/${docNumber}/${revision.toLowerCase()}/section-${sectionNumber}`;
}

/**
 * Build an ACS URI. Per `libs/sources/src/acs/locator.ts`, the URI format is:
 *
 *   <slug>                                              whole publication
 *   <slug>/area-<NN>                                    area (2-digit zero-padded)
 *   <slug>/area-<NN>/task-<x>                           task (single lowercase letter)
 *   <slug>/area-<NN>/task-<x>/elem-<triad><NN>          element (e.g. `elem-k01`)
 */
export function airbossRefForAcsPublication(slug: string): string {
	return `${SCHEME_PREFIX}acs/${slug}`;
}

export function airbossRefForAcsArea(slug: string, areaPadded: string): string {
	return `${SCHEME_PREFIX}acs/${slug}/area-${areaPadded}`;
}

export function airbossRefForAcsTask(slug: string, areaPadded: string, taskLetter: string): string {
	return `${SCHEME_PREFIX}acs/${slug}/area-${areaPadded}/task-${taskLetter.toLowerCase()}`;
}

export function airbossRefForAcsElement(
	slug: string,
	areaPadded: string,
	taskLetter: string,
	triad: string,
	elementOrdinal: string,
): string {
	return `${SCHEME_PREFIX}acs/${slug}/area-${areaPadded}/task-${taskLetter.toLowerCase()}/elem-${triad.toLowerCase()}${elementOrdinal}`;
}

/** NTSB ALJ ruling URIs. Whole-doc form is the case number; section form adds the section code. */
export function airbossRefForNtsbAljDocument(caseNumber: string): string {
	return `${SCHEME_PREFIX}ntsb-alj/${caseNumber}`;
}

export function airbossRefForNtsbAljSection(caseNumber: string, sectionCode: string): string {
	return `${SCHEME_PREFIX}ntsb-alj/${caseNumber}/${sectionCode}`;
}

/** SAFO bulletin URI -- whole-doc only. */
export function airbossRefForSafo(safoId: string): string {
	return `${SCHEME_PREFIX}safo/${safoId}`;
}

/** InFO bulletin URI -- whole-doc only. */
export function airbossRefForInfo(infoId: string): string {
	return `${SCHEME_PREFIX}info/${infoId}`;
}

/**
 * Generic fallback for whole-doc rows whose corpus has no dedicated builder
 * yet (Chief Counsel interpretations, PTS, POH, etc.). Encodes the corpus
 * name + documentSlug; the URL dispatcher falls back to FLIGHTBAG_HOME for
 * unrecognised corpora, but the URI itself is well-formed and parses through
 * `parseIdentifier`.
 */
export function airbossRefForGenericDocument(corpus: string, documentSlug: string, edition?: string): string {
	const tail = edition === undefined ? documentSlug : `${documentSlug}/${edition}`;
	return `${SCHEME_PREFIX}${corpus}/${tail}`;
}
