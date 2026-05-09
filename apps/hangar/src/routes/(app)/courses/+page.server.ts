import { existsSync, mkdirSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRole } from '@ab/auth';
import { deleteCourseRow, getCourseBySlug, getSectionCountsByCourseIds, listAllCourses } from '@ab/bc-study/server';
import {
	COURSE_KIND_VALUES,
	COURSE_KINDS,
	COURSE_SLUG_REGEX,
	COURSE_STATUS_VALUES,
	COURSE_STATUSES,
	COURSES_DIR_RELATIVE,
	type CourseKind,
	type CourseStatus,
	ROLES,
	ROUTES,
} from '@ab/constants';
import { fail, redirect } from '@sveltejs/kit';
import { runCourseSeed } from '$lib/server/course-seed';
import { emitManifest } from '$lib/server/course-yaml-emit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);

	const courses = await listAllCourses();
	const sectionCounts = await getSectionCountsByCourseIds(courses.map((c) => c.id));

	const status = event.url.searchParams.get('status') ?? 'all';
	const filtered = status === 'all' ? courses : courses.filter((c) => c.status === status);

	// Sort by most recently updated first per spec.
	filtered.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

	return {
		courses: filtered.map((c) => ({
			id: c.id,
			slug: c.slug,
			title: c.title,
			description: c.description,
			kind: c.kind as CourseKind,
			status: c.status as CourseStatus,
			sectionCount: sectionCounts[c.id] ?? 0,
			updatedAt: c.updatedAt.toISOString(),
		})),
		statusFilter: status,
	};
};

export const actions: Actions = {
	createCourse: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const form = await event.request.formData();
		const slug = String(form.get('slug') ?? '').trim();
		const title = String(form.get('title') ?? '').trim();
		const description = String(form.get('description') ?? '');
		const kindRaw = String(form.get('kind') ?? COURSE_KINDS.INSTRUCTOR);
		const statusRaw = String(form.get('status') ?? COURSE_STATUSES.DRAFT);

		if (!COURSE_SLUG_REGEX.test(slug)) {
			return fail(400, {
				intent: 'createCourse',
				error: 'Slug must match ^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$',
			});
		}
		if (title === '') {
			return fail(400, { intent: 'createCourse', error: 'Title is required.' });
		}
		if (!(COURSE_KIND_VALUES as readonly string[]).includes(kindRaw)) {
			return fail(400, { intent: 'createCourse', error: 'Invalid kind.' });
		}
		const kind = kindRaw as CourseKind;
		if (kind === COURSE_KINDS.PERSONAL) {
			return fail(400, {
				intent: 'createCourse',
				error: 'Personal courses cannot be authored from the hangar (reserved per spec).',
			});
		}
		if (!(COURSE_STATUS_VALUES as readonly string[]).includes(statusRaw)) {
			return fail(400, { intent: 'createCourse', error: 'Invalid status.' });
		}
		const status = statusRaw as CourseStatus;

		const courseDir = resolve(COURSES_DIR_RELATIVE, slug);
		if (existsSync(courseDir)) {
			return fail(400, { intent: 'createCourse', error: `Course directory '${slug}' already exists.` });
		}
		// Slug uniqueness backstop (DB UNIQUE).
		if ((await getCourseBySlug(slug)) !== null) {
			return fail(400, { intent: 'createCourse', error: `Course slug '${slug}' is already in use.` });
		}

		// Create the directory + manifest. Sections start empty.
		mkdirSync(courseDir, { recursive: true });
		mkdirSync(resolve(courseDir, 'sections'), { recursive: true });
		const manifestPath = resolve(courseDir, 'manifest.yaml');
		await writeFile(manifestPath, emitManifest({ slug, kind, title, status, description }));

		const result = await runCourseSeed(slug);
		if (!result.ok) {
			// Roll back the on-disk creation -- nothing else has touched the DB
			// because the seed throws before writing.
			await rm(courseDir, { recursive: true, force: true });
			return fail(400, { intent: 'createCourse', error: `Seed rejected: ${result.error}` });
		}

		throw redirect(303, ROUTES.HANGAR_COURSE(slug));
	},

	deleteCourse: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const form = await event.request.formData();
		const slug = String(form.get('slug') ?? '').trim();
		if (slug === '') return fail(400, { intent: 'deleteCourse', error: 'Missing slug.' });

		const courseRow = await getCourseBySlug(slug);
		if (courseRow === null) {
			return fail(404, { intent: 'deleteCourse', error: 'Course not found.' });
		}

		const courseDir = resolve(COURSES_DIR_RELATIVE, slug);
		if (existsSync(courseDir)) {
			await rm(courseDir, { recursive: true, force: true });
		}

		// Delete the orphan course row + cascading course_step rows. The
		// goal_course FK is RESTRICT -- a course still in any goal will
		// reject this delete with a Postgres FK error; the action surfaces
		// that as a banner so the user can clean up the goals first.
		try {
			await deleteCourseRow(courseRow.id);
		} catch (err) {
			return fail(400, {
				intent: 'deleteCourse',
				error: `Cannot delete -- the course is still linked from one or more goals. Remove it from those goals first. (${
					err instanceof Error ? err.message : String(err)
				})`,
			});
		}

		return { intent: 'deleteCourse', success: true };
	},
};
