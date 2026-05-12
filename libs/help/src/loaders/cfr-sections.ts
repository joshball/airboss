// @browser-globals: server-only -- never imported by client .svelte
/**
 * CFR-sections loader (DB-backed). Walks `study.reference_section` joined to
 * `study.reference` where `reference.kind = 'cfr'` and matches the needle
 * against the section's `code` + `title` + `content_md`. Returns
 * `faa.cfr.sect` rows clustered under the parent CFR Part (`clusterKey`).
 *
 * Title discrimination: `reference.kind` is a single value covering 14 CFR
 * AND 49 CFR. The CFR seeder convention builds `documentSlug` as
 * `${title}cfr${partKey}` (e.g. `14cfr91`, `49cfr175`). The leading numeric
 * prefix is the title; this loader parses it off the slug to route to the
 * correct title in `LIBRARY_REGULATIONS_KINDS` + format the title prefix.
 *
 * Server-only -- imports `@ab/db/connection`. Wire through the
 * `/api/palette/search` endpoint, then merge into `searchGrouped()`'s
 * `injected` arg.
 */

import { reference, referenceSection } from '@ab/bc-study';
import {
	LIBRARY_REGULATIONS_KIND_LABELS,
	LIBRARY_REGULATIONS_KINDS,
	type LibraryRegulationsKind,
	REFERENCE_KINDS,
	ROUTES,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { and, eq, ilike, or, type SQL } from 'drizzle-orm';
import type { ParsedQuery } from '../schema/help-registry';
import type { PaletteHost, SearchResult } from '../schema/result-types';
import { bodySnippet, bucketByMatch, buildIlikePattern, type LoaderDb, MIN_BODY_NEEDLE_LENGTH } from './_shared';

const LOADER_LIMIT = 30;

export async function loadCfrSections(
	parsed: ParsedQuery,
	host: PaletteHost,
	db: LoaderDb = defaultDb,
): Promise<readonly SearchResult[]> {
	void host;
	const needle = parsed.freeText.trim();
	if (needle.length === 0) return [];

	const pattern = buildIlikePattern(needle);
	const fieldMatches: SQL[] = [ilike(referenceSection.code, pattern), ilike(referenceSection.title, pattern)];
	if (needle.length >= MIN_BODY_NEEDLE_LENGTH) {
		fieldMatches.push(ilike(referenceSection.contentMd, pattern));
	}

	const rows = await db
		.select({
			sectionId: referenceSection.id,
			code: referenceSection.code,
			title: referenceSection.title,
			contentMd: referenceSection.contentMd,
			documentSlug: reference.documentSlug,
			referenceTitle: reference.title,
		})
		.from(referenceSection)
		.innerJoin(reference, eq(reference.id, referenceSection.referenceId))
		.where(and(eq(reference.kind, REFERENCE_KINDS.CFR), or(...fieldMatches)))
		.orderBy(reference.documentSlug, referenceSection.code)
		.limit(LOADER_LIMIT);

	const out: SearchResult[] = [];
	for (const r of rows) {
		const cfrKind = cfrTitleFromSlug(r.documentSlug);
		const titlePrefix = LIBRARY_REGULATIONS_KIND_LABELS[cfrKind];
		const result: SearchResult = {
			id: r.sectionId,
			type: 'faa.cfr.sect',
			title: `${titlePrefix} §${r.code} - ${r.title}`,
			subtitle: `${r.documentSlug.toUpperCase()} - ${r.referenceTitle}`,
			snippet: bodySnippet(r.contentMd, needle),
			href: ROUTES.LIBRARY_REGULATIONS_SECTION(cfrKind, r.documentSlug, r.code),
			rankBucket: bucketByMatch(needle, r.code, r.title),
			clusterKey: r.documentSlug,
		};
		out.push(result);
	}
	return out;
}

/**
 * Parse the title number off a CFR `documentSlug` and resolve to the matching
 * `LIBRARY_REGULATIONS_KINDS` value. Returns CFR_14 as the default when the
 * slug shape doesn't match the seeder convention (a future "5 CFR" or test
 * fixture won't break the loader, just defaults to Title 14 routing).
 */
function cfrTitleFromSlug(documentSlug: string): LibraryRegulationsKind {
	if (documentSlug.startsWith('49')) return LIBRARY_REGULATIONS_KINDS.CFR_49;
	return LIBRARY_REGULATIONS_KINDS.CFR_14;
}
