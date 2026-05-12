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
import type { ParsedQuery } from '../schema/help-registry';
import type { PaletteHost, SearchResult } from '../schema/result-types';
import { bucketByMatch, buildIlikePattern, type LoaderDb } from './_shared';

const LOADER_LIMIT = 15;

export async function loadPlans(
	parsed: ParsedQuery,
	host: PaletteHost,
	db: LoaderDb = defaultDb,
): Promise<readonly SearchResult[]> {
	if (!host.userId) return [];
	const needle = parsed.freeText.trim();
	if (needle.length === 0) return [];

	const pattern = buildIlikePattern(needle);
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
			rankBucket: bucketByMatch(needle, r.title),
			source: 'index',
		};
		out.push(result);
	}
	return out;
}
