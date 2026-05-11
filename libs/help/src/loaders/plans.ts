// @browser-globals: server-only -- never imported by client .svelte
/**
 * Plans loader (DB-backed, user-scoped). Walks `study.study_plan` filtered
 * by the current user. Matches needle against the plan `title`. Returns
 * `mine.plan` rows for the My Stuff column.
 *
 * Empty when host has no `userId`.
 *
 * Server-only -- imports `@ab/db/connection`.
 */

import { studyPlan } from '@ab/bc-study';
import { ROUTES } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { and, desc, eq, ilike } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { ParsedQuery } from '../schema/help-registry';
import type { PaletteHost, RankBucket, SearchResult } from '../schema/result-types';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

const LOADER_LIMIT = 15;

function bucketFor(needle: string, title: string): RankBucket {
	if (needle.length === 0) return 4;
	const n = needle.toLowerCase();
	if (title.toLowerCase() === n) return 1;
	if (title.toLowerCase().startsWith(n)) return 2;
	if (title.toLowerCase().includes(n)) return 3;
	return 5;
}

function escapePattern(s: string): string {
	return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export async function loadPlans(
	parsed: ParsedQuery,
	host: PaletteHost,
	db: Db = defaultDb,
): Promise<readonly SearchResult[]> {
	if (!host.userId) return [];
	const needle = parsed.freeText.trim();
	if (needle.length === 0) return [];

	const pattern = `%${escapePattern(needle)}%`;
	const rows = await db
		.select({
			id: studyPlan.id,
			title: studyPlan.title,
			status: studyPlan.status,
		})
		.from(studyPlan)
		.where(and(eq(studyPlan.userId, host.userId), ilike(studyPlan.title, pattern)))
		.orderBy(desc(studyPlan.updatedAt))
		.limit(LOADER_LIMIT);

	const out: SearchResult[] = [];
	for (const r of rows) {
		const result: SearchResult = {
			id: r.id,
			type: 'mine.plan',
			title: r.title,
			subtitle: `Plan - ${r.status}`,
			href: ROUTES.PROGRAM_PLAN(r.id),
			rankBucket: bucketFor(needle, r.title),
			source: 'index',
		};
		out.push(result);
	}
	return out;
}
