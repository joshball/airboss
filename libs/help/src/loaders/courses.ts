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
import type { ParsedQuery } from '../schema/help-registry';
import type { PaletteHost, SearchResult } from '../schema/result-types';
import { bucketByMatch, buildIlikePattern, type LoaderDb, truncateOneLine } from './_shared';

const LOADER_LIMIT = 20;

export async function loadCourses(
	parsed: ParsedQuery,
	host: PaletteHost,
	db: LoaderDb = defaultDb,
): Promise<readonly SearchResult[]> {
	void host;
	const needle = parsed.freeText.trim();
	if (needle.length === 0) return [];

	const pattern = buildIlikePattern(needle);
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
			snippet: truncateOneLine(r.description, 140),
			href: ROUTES.COURSE(r.slug),
			rankBucket: bucketByMatch(needle, r.slug, r.title),
		};
		out.push(result);
	}
	return out;
}
