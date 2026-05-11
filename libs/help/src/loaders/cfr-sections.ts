// @browser-globals: server-only -- never imported by client .svelte
/**
 * CFR-sections loader (DB-backed). Walks `study.reference_section` joined to
 * `study.reference` where `reference.kind = 'cfr'` and matches the needle
 * against the section's `code` + `title` + `content_md`. Returns
 * `faa.cfr.sect` rows clustered under the parent CFR Part (`parentDocCode`).
 *
 * Server-only -- imports `@ab/db/connection`. Wire through the
 * `/api/palette/search` endpoint, then merge into `searchGrouped()`'s
 * `injected` arg.
 *
 * CFR `code` shape: `"91.103"`, `"91.103(b)"`, `"91.103(b)(1)(i)"`. The
 * flightbag route emits `/cfr/<title>/<part>/<section>`; for the in-app
 * library link this loader uses `LIBRARY_REGULATIONS_SECTION` with
 * `kind='cfr'` and the parent reference's documentSlug as the group.
 */

import { reference, referenceSection } from '@ab/bc-study';
import { LIBRARY_REGULATIONS_KINDS, REFERENCE_KINDS, ROUTES } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { and, eq, ilike, or } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { ParsedQuery } from '../schema/help-registry';
import type { PaletteHost, RankBucket, SearchResult } from '../schema/result-types';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

const LOADER_LIMIT = 30;
const CFR_KIND = LIBRARY_REGULATIONS_KINDS.CFR_14;

function bucketFor(needle: string, code: string, title: string): RankBucket {
	if (needle.length === 0) return 4;
	const n = needle.toLowerCase();
	if (code.toLowerCase() === n) return 1;
	if (code.toLowerCase().startsWith(n)) return 2;
	if (title.toLowerCase() === n) return 1;
	if (title.toLowerCase().startsWith(n)) return 2;
	if (title.toLowerCase().includes(n)) return 3;
	return 5;
}

function escapePattern(s: string): string {
	return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function bodySnippet(body: string, needle: string): string {
	if (body.length === 0) return '';
	const idx = needle.length > 0 ? body.toLowerCase().indexOf(needle.toLowerCase()) : -1;
	const start = idx < 0 ? 0 : Math.max(0, idx - 30);
	const end = Math.min(body.length, start + 140);
	const slice = body.slice(start, end).replace(/\s+/g, ' ').trim();
	return start === 0 ? slice : `…${slice}`;
}

export async function loadCfrSections(
	parsed: ParsedQuery,
	host: PaletteHost,
	db: Db = defaultDb,
): Promise<readonly SearchResult[]> {
	void host;
	const needle = parsed.freeText.trim();
	if (needle.length === 0) return [];

	const pattern = `%${escapePattern(needle)}%`;
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
		.where(
			and(
				eq(reference.kind, REFERENCE_KINDS.CFR),
				or(
					ilike(referenceSection.code, pattern),
					ilike(referenceSection.title, pattern),
					ilike(referenceSection.contentMd, pattern),
				),
			),
		)
		.orderBy(reference.documentSlug, referenceSection.code)
		.limit(LOADER_LIMIT);

	const out: SearchResult[] = [];
	for (const r of rows) {
		const result: SearchResult = {
			id: r.sectionId,
			type: 'faa.cfr.sect',
			title: `14 CFR §${r.code} - ${r.title}`,
			subtitle: `${r.documentSlug.toUpperCase()} - ${r.referenceTitle}`,
			snippet: bodySnippet(r.contentMd, needle),
			href: ROUTES.LIBRARY_REGULATIONS_SECTION(CFR_KIND, r.documentSlug, r.code),
			rankBucket: bucketFor(needle, r.code, r.title),
			parentDocCode: r.documentSlug,
		};
		out.push(result);
	}
	return out;
}
