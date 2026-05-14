// @browser-globals: server-only -- never imported by client .svelte
/**
 * Glossary-terms loader (DB-backed). Walks `study.reference_section` filtered
 * to `level = 'glossary'`. Returns `airboss.glossary` rows so the AIM
 * Pilot/Controller Glossary entries (and any future PCG-style glossary
 * sections) land in the airboss-content column under their own
 * discriminator -- separate from the AIM paragraph reader.
 *
 * Why this is its own loader, not part of `aim-sections.ts`: the AIM loader
 * routes through `LIBRARY_REGULATIONS_SECTION(...)`, which calls
 * `parseRegulationSection()` and 404s on the `glossary/<slug>` code shape.
 * Glossary entries need their own URL (in-app `/reference/glossary/<id>`),
 * a different result-type discriminator, and ideally a different column
 * (airboss-content vs faa-resources). Splitting the query gives all three.
 *
 * The aviation registry already publishes hand-authored glossary refs
 * (`va-aircraft`, `adm-safety`, ...) via `aviation-refs.ts`. This loader
 * complements those by surfacing DB-seeded glossary section rows that
 * the in-memory registry can't see.
 *
 * URL strategy: per `libs/sources/src/url-for-reference.ts` the canonical
 * AIM-glossary deep link is the in-app `/reference/glossary/<id>` route
 * until the flightbag origin grows a leaf glossary reader. We mirror that
 * choice here so the palette navigates to the same place a wiki-link
 * resolution would.
 *
 * Server-only -- imports `@ab/db/connection`.
 */

import { reference, referenceSection } from '@ab/bc-study';
import { REFERENCE_SECTION_LEVELS, ROUTES } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { and, eq, ilike, or, type SQL } from 'drizzle-orm';
import type { ParsedQuery } from '../schema/help-registry';
import type { PaletteHost, SearchResult } from '../schema/result-types';
import { bodySnippet, bucketByMatch, buildIlikePattern, type LoaderDb, MIN_BODY_NEEDLE_LENGTH } from './_shared';

const LOADER_LIMIT = 30;

/**
 * `reference_section.code` for an AIM glossary entry has the shape
 * `glossary/<slug>` -- the manifest validator pins this in
 * `libs/bc/study/src/manifest-validation.ts`. Strip the prefix to derive
 * the human-facing slug used as the result id when the row id isn't a
 * stable surface (it's an opaque `generateReferenceSectionId()` ULID).
 */
function slugFromCode(code: string): string {
	const idx = code.indexOf('/');
	return idx < 0 ? code : code.slice(idx + 1);
}

export async function loadGlossaryTerms(
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
			referenceTitle: reference.title,
		})
		.from(referenceSection)
		.innerJoin(reference, eq(reference.id, referenceSection.referenceId))
		.where(and(eq(referenceSection.level, REFERENCE_SECTION_LEVELS.GLOSSARY), or(...fieldMatches)))
		.orderBy(referenceSection.title)
		.limit(LOADER_LIMIT);

	const out: SearchResult[] = [];
	for (const r of rows) {
		const slug = slugFromCode(r.code);
		const result: SearchResult = {
			id: r.sectionId,
			type: 'airboss.glossary',
			title: r.title,
			subtitle: r.referenceTitle,
			snippet: bodySnippet(r.contentMd, needle),
			href: ROUTES.REFERENCE_GLOSSARY_ID(slug),
			rankBucket: bucketByMatch(needle, r.title, slug),
		};
		out.push(result);
	}
	return out;
}
