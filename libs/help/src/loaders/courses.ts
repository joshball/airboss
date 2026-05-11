// @browser-globals: server-only -- never imported by client .svelte
/**
 * Courses loader (DB-backed). Walks `study.course` and matches needle
 * against `slug` + `title` + `description`. Returns `airboss.course` rows
 * for the Airboss Content column.
 *
 * Why DB rather than filesystem: courses are seeded into `study.course`
 * from `course/courses/<slug>/manifest.yaml` by the build pipeline; the DB
 * row is the canonical fact and includes the lifecycle status. Filesystem
 * scans would require Node built-ins and miss the status filter.
 *
 * Server-only -- imports `@ab/db/connection`.
 */

import { course } from '@ab/bc-study';
import { COURSE_STATUSES, ROUTES } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { and, ilike, ne, or } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { ParsedQuery } from '../schema/help-registry';
import type { PaletteHost, RankBucket, SearchResult } from '../schema/result-types';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

const LOADER_LIMIT = 20;

function bucketFor(needle: string, slug: string, title: string): RankBucket {
	if (needle.length === 0) return 4;
	const n = needle.toLowerCase();
	if (slug.toLowerCase() === n) return 1;
	if (title.toLowerCase() === n) return 1;
	if (slug.toLowerCase().startsWith(n)) return 2;
	if (title.toLowerCase().startsWith(n)) return 2;
	if (title.toLowerCase().includes(n) || slug.toLowerCase().includes(n)) return 3;
	return 5;
}

function escapePattern(s: string): string {
	return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function snippet(description: string): string {
	const oneLine = description.replace(/\s+/g, ' ').trim();
	return oneLine.length <= 140 ? oneLine : `${oneLine.slice(0, 137)}…`;
}

export async function loadCourses(
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
			id: course.id,
			slug: course.slug,
			title: course.title,
			description: course.description,
			status: course.status,
		})
		.from(course)
		.where(
			and(
				ne(course.status, COURSE_STATUSES.ARCHIVED),
				or(ilike(course.slug, pattern), ilike(course.title, pattern), ilike(course.description, pattern)),
			),
		)
		.orderBy(course.title)
		.limit(LOADER_LIMIT);

	const out: SearchResult[] = [];
	for (const r of rows) {
		const result: SearchResult = {
			id: r.id,
			type: 'airboss.course',
			title: r.title,
			subtitle: `Course - ${r.slug}`,
			snippet: snippet(r.description),
			href: ROUTES.COURSE(r.slug),
			rankBucket: bucketFor(needle, r.slug, r.title),
		};
		out.push(result);
	}
	return out;
}
