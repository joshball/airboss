/**
 * Helpers shared by the `/library/*` 301 handlers in the study app.
 *
 * Per ADR 023 + `wp-flightbag-reader-ux` Phase 2, the flightbag owns the
 * canonical reference-reader URL space. Every legacy `/library/*` route in
 * study is a `+server.ts` 301 to its flightbag equivalent. These helpers keep
 * the URL-shape mapping in one place.
 */

import type { ReferenceRow } from '@ab/bc-study';
import {
	LIBRARY_REGULATIONS_KINDS,
	type LibraryRegulationsKind,
	REFERENCE_KINDS,
	type ReferenceKind,
	ROUTES,
} from '@ab/constants';

/**
 * Strip the `FAA-H-` prefix from a handbook edition so the URL grammar
 * matches the `airboss-ref:` URI shape (which is `8083-25C`, not the DB's
 * `FAA-H-8083-25C`). Non-FAA-H editions (e.g. `mtn-2003`) pass through.
 *
 * Mirrors the same helper in `apps/flightbag/src/routes/reader-url.ts`.
 */
export function shortHandbookEdition(edition: string): string {
	if (edition.startsWith('FAA-H-')) return edition.slice('FAA-H-'.length);
	return edition;
}

/**
 * Build the flightbag URL for a `study.reference` row. Returns null for
 * reference kinds that don't have a per-doc landing in the flightbag yet
 * (POH, NTSB, etc.) -- the caller then falls back to `FLIGHTBAG_HOME`.
 */
export function flightbagUrlForReference(ref: Pick<ReferenceRow, 'kind' | 'documentSlug' | 'edition'>): string | null {
	const kind = ref.kind as ReferenceKind;
	switch (kind) {
		case REFERENCE_KINDS.HANDBOOK:
			return ROUTES.FLIGHTBAG_HANDBOOK(ref.documentSlug, shortHandbookEdition(ref.edition));
		case REFERENCE_KINDS.AIM:
			return ROUTES.FLIGHTBAG_AIM;
		case REFERENCE_KINDS.CFR: {
			const match = ref.documentSlug.match(/^(\d+)cfr(.+)$/);
			if (!match) return null;
			const title = match[1];
			const part = match[2];
			if (title === undefined || part === undefined) return null;
			return ROUTES.FLIGHTBAG_CFR_PART(title, part);
		}
		case REFERENCE_KINDS.AC: {
			const docNumber = ref.documentSlug.startsWith('ac-') ? ref.documentSlug.slice('ac-'.length) : ref.documentSlug;
			const revisionLetter = ref.edition.match(/[A-Z]$/i)?.[0] ?? '';
			if (revisionLetter === '') return null;
			return ROUTES.FLIGHTBAG_AC(docNumber, revisionLetter.toLowerCase());
		}
		case REFERENCE_KINDS.ACS:
		case REFERENCE_KINDS.PTS:
			return ROUTES.FLIGHTBAG_ACS(ref.documentSlug);
		case REFERENCE_KINDS.SAFO:
		case REFERENCE_KINDS.INFO:
		case REFERENCE_KINDS.PCG:
		case REFERENCE_KINDS.NTSB:
		case REFERENCE_KINDS.POH:
		case REFERENCE_KINDS.OTHER:
			return null;
	}
}

/**
 * Map a `LIBRARY_REGULATIONS_KINDS` slug to its flightbag URL family. Returns
 * the flightbag base path for that kind (e.g. CFR -> `/cfr/<title>/<part>`,
 * AIM -> `/aim/<chapter>`, AC -> `/ac/<doc>/<rev>`). Per ADR 023 the flightbag
 * doesn't host an "advisory NTSB" surface today, so NTSB falls through to
 * `FLIGHTBAG_HOME` -- the loader can then attach a `?topic=` filter once the
 * catalog supports topic filtering.
 */
export function flightbagPathForRegulationGroup(kind: LibraryRegulationsKind, group: string): string {
	switch (kind) {
		case LIBRARY_REGULATIONS_KINDS.CFR_14:
			return ROUTES.FLIGHTBAG_CFR_PART('14', group);
		case LIBRARY_REGULATIONS_KINDS.CFR_49:
			return ROUTES.FLIGHTBAG_CFR_PART('49', group);
		case LIBRARY_REGULATIONS_KINDS.AIM:
			return ROUTES.FLIGHTBAG_AIM_CHAPTER(group);
		case LIBRARY_REGULATIONS_KINDS.AC: {
			// AC group is the AC doc number; revision letter must be derived from
			// the reference row, which the redirect handler doesn't have.
			// Return the catalog filtered to AC kind via a topic search.
			return ROUTES.FLIGHTBAG_HOME;
		}
		case LIBRARY_REGULATIONS_KINDS.NTSB:
			return ROUTES.FLIGHTBAG_HOME;
	}
}
