// @browser-globals: server-only -- never imported by client .svelte
/**
 * AIM-sections loader (DB-backed). Walks `study.reference_section` joined to
 * `study.reference` where `reference.kind = 'aim'`. Returns `faa.aim` rows
 * clustered under the parent AIM reference (via `parentDocCode`).
 *
 * The aviation registry already publishes one row per AIM chapter / section
 * (see `libs/aviation/src/references/aim-docs.ts`). This loader complements
 * those by surfacing FTS-style matches against AIM paragraph bodies that the
 * in-memory registry can't see.
 *
 * Server-only -- imports `@ab/db/connection`.
 */

import { reference, referenceSection } from '@ab/bc-study';
import { LIBRARY_REGULATIONS_KINDS, REFERENCE_KINDS, ROUTES } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { and, eq, ilike, or, type SQL } from 'drizzle-orm';
import type { ParsedQuery } from '../schema/help-registry';
import type { PaletteHost, SearchResult } from '../schema/result-types';
import { bodySnippet, bucketByMatch, buildIlikePattern, type LoaderDb, MIN_BODY_NEEDLE_LENGTH } from './_shared';

const LOADER_LIMIT = 30;
const AIM_KIND = LIBRARY_REGULATIONS_KINDS.AIM;

export async function loadAimSections(
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
		.where(and(eq(reference.kind, REFERENCE_KINDS.AIM), or(...fieldMatches)))
		.orderBy(reference.documentSlug, referenceSection.code)
		.limit(LOADER_LIMIT);

	const out: SearchResult[] = [];
	for (const r of rows) {
		const result: SearchResult = {
			id: r.sectionId,
			type: 'faa.aim',
			title: `AIM ${r.code} - ${r.title}`,
			subtitle: r.referenceTitle,
			snippet: bodySnippet(r.contentMd, needle),
			href: ROUTES.LIBRARY_REGULATIONS_SECTION(AIM_KIND, r.documentSlug, r.code),
			rankBucket: bucketByMatch(needle, r.code, r.title),
			parentDocCode: r.documentSlug,
		};
		out.push(result);
	}
	return out;
}
