/**
 * Hangar courses index loader (course-reader-and-editor WP, Phase 6).
 *
 * Lists every course regardless of status -- the editor must surface
 * drafts + archived courses. Default sort is updated_at DESC so the most
 * recently edited course lands at the top. Status filter via `?status=`
 * query param.
 *
 * Each row carries the section count via one grouped `countSectionsByCourse`
 * query rather than an N+1 of `getCourseStepsByCourse` per course.
 */

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRole } from '@ab/auth';
import { type CourseRow, countSectionsByCourse, listAllCourses } from '@ab/bc-study/server';
import {
	COURSE_KINDS,
	COURSE_SLUG_REGEX,
	COURSE_SLUG_REGEX_SOURCE,
	COURSE_STATUS_VALUES,
	COURSE_STATUSES,
	COURSE_TITLE_MAX_LENGTH,
	type CourseStatus,
	QUERY_PARAMS,
	ROLES,
	ROUTES,
} from '@ab/constants';
import { db } from '@ab/db/connection';
import { narrow } from '@ab/utils';
import { fail, redirect } from '@sveltejs/kit';
import { COURSES_DIR, CourseSeedError, runCourseSeed } from '$lib/server/course-seed';
import { emitManifest } from '$lib/server/course-yaml-emit';
import type { Actions, PageServerLoad } from './$types';

export interface CourseAdminRow {
	course: CourseRow;
	sectionCount: number;
}

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);

	const statusFilter = narrow<CourseStatus>(event.url.searchParams.get(QUERY_PARAMS.STATUS), COURSE_STATUS_VALUES);

	const allCourses = await listAllCourses(db);
	const filtered = statusFilter !== undefined ? allCourses.filter((c) => c.status === statusFilter) : allCourses;

	// Per-row section count via ONE grouped query (count-by-course), not an
	// N+1 of `getCourseStepsByCourse` per course.
	const sectionCounts = await countSectionsByCourse(filtered.map((c) => c.id));
	const rows: CourseAdminRow[] = filtered.map((course) => ({
		course,
		sectionCount: sectionCounts.get(course.id) ?? 0,
	}));

	return {
		rows,
		statusFilter: statusFilter ?? null,
	};
};

export const actions: Actions = {
	createCourse: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const form = await event.request.formData();
		const slug = String(form.get('slug') ?? '').trim();
		const title = String(form.get('title') ?? '').trim();
		const description = String(form.get('description') ?? '');
		const statusRaw = String(form.get('status') ?? COURSE_STATUSES.ACTIVE);

		if (slug === '' || !COURSE_SLUG_REGEX.test(slug)) {
			return fail(400, {
				intent: 'createCourse',
				error: `Slug must match ${COURSE_SLUG_REGEX_SOURCE}.`,
			});
		}
		if (title === '') {
			return fail(400, { intent: 'createCourse', error: 'Title is required.' });
		}
		if (title.length > COURSE_TITLE_MAX_LENGTH) {
			return fail(400, {
				intent: 'createCourse',
				error: `Title must be ${COURSE_TITLE_MAX_LENGTH} characters or fewer.`,
			});
		}
		const status = (COURSE_STATUS_VALUES as readonly string[]).includes(statusRaw)
			? (statusRaw as CourseStatus)
			: COURSE_STATUSES.ACTIVE;

		const dir = resolve(COURSES_DIR, slug);
		if (existsSync(dir)) {
			return fail(400, { intent: 'createCourse', error: `Course directory ${slug} already exists.` });
		}

		// Create the directory + manifest.yaml + empty sections/ subdir.
		mkdirSync(dir, { recursive: true });
		mkdirSync(resolve(dir, 'sections'), { recursive: true });
		const manifest = emitManifest({
			slug,
			kind: COURSE_KINDS.INSTRUCTOR,
			title,
			status,
			description,
		});
		await writeFile(resolve(dir, 'manifest.yaml'), manifest, 'utf8');

		try {
			await runCourseSeed(slug);
		} catch (err) {
			// On seed failure remove the freshly created directory so a retry
			// with the same slug is not wedged by the `existsSync` guard above.
			// The guard proved the directory was absent before this action ran,
			// so an unconditional remove of `dir` is safe.
			rmSync(dir, { recursive: true, force: true });
			if (err instanceof CourseSeedError) {
				return fail(400, { intent: 'createCourse', error: `seed failed: ${err.message}` });
			}
			console.error('[hangar/courses] createCourse unexpected failure:', err);
			return fail(400, {
				intent: 'createCourse',
				error: 'Course creation failed unexpectedly. Check server logs.',
			});
		}

		throw redirect(303, ROUTES.HANGAR_COURSE(slug));
	},
};
