/**
 * `readerUrlFor` -- map a `study.reference` row to the deepest in-app reader
 * route the flightbag supports for that corpus.
 *
 * Lives in its own file so the BUCKET_DEFS / loader can import it AND a
 * Vitest unit can exercise it without standing up a SvelteKit page module.
 */

import { REFERENCE_KINDS, type ReferenceKind, ROUTES } from '@ab/constants';

/**
 * Strip the `FAA-H-` prefix from a handbook edition so the URL grammar
 * matches the `airboss-ref:` URI shape (which is `8083-25C`, not the DB's
 * `FAA-H-8083-25C`). Non-FAA-H editions (e.g. `mtn-2003`) pass through.
 *
 * Exposed so handbook loaders can use the same canonicalisation when building
 * deep links and when reversing URI -> DB lookups.
 */
export function shortHandbookEdition(edition: string): string {
	if (edition.startsWith('FAA-H-')) return edition.slice('FAA-H-'.length);
	return edition;
}

export function readerUrlFor(kind: ReferenceKind, documentSlug: string, edition: string): string | null {
	switch (kind) {
		case REFERENCE_KINDS.HANDBOOK:
			return ROUTES.FLIGHTBAG_HANDBOOK(documentSlug, shortHandbookEdition(edition));
		case REFERENCE_KINDS.AIM:
			return ROUTES.FLIGHTBAG_AIM;
		case REFERENCE_KINDS.CFR: {
			const match = documentSlug.match(/^(\d+)cfr(.+)$/);
			if (!match) return null;
			const title = match[1];
			const part = match[2];
			if (title === undefined || part === undefined) return null;
			return ROUTES.FLIGHTBAG_CFR_PART(title, part);
		}
		case REFERENCE_KINDS.AC: {
			// `documentSlug` is `ac-61-65`; strip the leading `ac-` prefix to get
			// the FAA doc number used in the URL (`61-65`). Edition is the AC
			// revision (`AC 61-65J`); pull the trailing letter.
			const docNumber = documentSlug.startsWith('ac-') ? documentSlug.slice('ac-'.length) : documentSlug;
			const revisionLetter = edition.match(/[A-Z]$/i)?.[0] ?? '';
			if (revisionLetter === '') return null;
			return ROUTES.FLIGHTBAG_AC(docNumber, revisionLetter.toLowerCase());
		}
		case REFERENCE_KINDS.ACS:
		case REFERENCE_KINDS.PTS:
			return ROUTES.FLIGHTBAG_ACS(documentSlug);
		case REFERENCE_KINDS.PCG:
		case REFERENCE_KINDS.NTSB:
		case REFERENCE_KINDS.POH:
		case REFERENCE_KINDS.OTHER:
			return null;
	}
}
