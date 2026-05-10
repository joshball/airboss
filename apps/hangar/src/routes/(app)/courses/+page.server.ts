/**
 * Hangar courses index loader (course-reader-and-editor WP, Phase 6).
 *
 * Lists every course regardless of status -- the editor must surface
 * drafts + archived courses. Default sort is updated_at DESC so the most
 * recently edited course lands at the top. Status filter via `?status=`
 * query param.
 *
 * Each row carries the section count (a cheap aggregation via
 * getCourseStepsByCourse + level filter; total steps = sections + leaves
 * but the count we display is "sections" since steps are always inside
 * sections).
 */

import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRole } from '@ab/auth';
import { type CourseRow, getCourseStepsByCourse, listAllCourses } from '@ab/bc-study/server';
import {
	COURSE_KINDS,
	COURSE_STATUS_VALUES,
	COURSE_STATUSES,
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

	// Per-row section count. One read per course (the BC's
	// `getCourseStepsByCourse` returns sections + steps in one query).
	// At single-digit course count the cost is trivial; at scale we'd
	// batch via a count-by-course query.
	const rows: CourseAdminRow[] = await Promise.all(
		filtered.map(async (course) => {
			const steps = await getCourseStepsByCourse(course.id);
			const sectionCount = steps.filter((s) => s.parentId === null).length;
			return { course, sectionCount };
		}),
	);

	return {
		rows,
		statusFilter: statusFilter ?? null,
	};
};

const COURSE_SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

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
				error: 'Slug must match ^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$.',
			});
		}
		if (title === '') {
			return fail(400, { intent: 'createCourse', error: 'Title is required.' });
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
			if (err instanceof CourseSeedError) {
				return fail(400, { intent: 'createCourse', error: `seed failed: ${err.message}` });
			}
			throw err;
		}

		throw redirect(303, ROUTES.HANGAR_COURSE(slug));
	},
};
