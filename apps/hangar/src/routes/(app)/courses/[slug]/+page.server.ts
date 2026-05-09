/**
 * Hangar course manifest editor (course-reader-and-editor WP, Phase 6).
 *
 * Loads one course by slug from the YAML directory. Surfaces the manifest
 * fields for editing + the section list for reorder / delete / navigate.
 *
 * Form actions per design.md "Hangar editor: write flow":
 *   - updateManifest: re-emit manifest.yaml with form deltas, re-run seed
 *   - addSection:     create sections/<file>.yaml, re-run seed
 *   - deleteSection:  remove sections/<file>.yaml, re-run seed (orphans
 *                     surface for cleanup)
 *   - reorderSections: re-emit each section file with new ordinal, re-run
 *   - deleteCourse:   remove the entire course/courses/<slug>/ dir, re-run
 *   - cleanupOrphans: DELETE the orphan rows the seed reported
 *
 * Every save backs up the YAML before writing; on seed failure the backup
 * is restored and the form returns a `seed failed: <message>` error.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRole } from '@ab/auth';
import {
	type CourseRow,
	type CourseStepRow,
	courseManifestSchema,
	courseSectionSchema,
	deleteCourseRow,
	deleteCourseStep,
	getCourseBySlug,
	getCourseStepsByCourse,
} from '@ab/bc-study/server';
import {
	COURSE_STATUS_VALUES,
	COURSE_STATUSES,
	COURSE_STEP_LEVELS,
	type CourseStatus,
	ROLES,
	ROUTES,
} from '@ab/constants';
import { error, fail, redirect } from '@sveltejs/kit';
import { parse } from 'yaml';
import { COURSES_DIR, CourseSeedError, runCourseSeed } from '$lib/server/course-seed';
import { emitManifest, emitSection } from '$lib/server/course-yaml-emit';
import type { Actions, PageServerLoad } from './$types';

export interface SectionListEntry {
	filename: string;
	code: string;
	title: string;
	ordinal: number;
	stepCount: number;
}

export interface OrphanEntry {
	id: string;
	code: string;
	title: string;
}

export interface CourseEditorData {
	course: CourseRow;
	sections: SectionListEntry[];
	orphans: OrphanEntry[];
}

function sectionsDir(slug: string): string {
	return resolve(COURSES_DIR, slug, 'sections');
}

function manifestPath(slug: string): string {
	return resolve(COURSES_DIR, slug, 'manifest.yaml');
}

function loadSectionsFromDisk(slug: string): SectionListEntry[] {
	const dir = sectionsDir(slug);
	if (!existsSync(dir)) return [];
	const filenames = readdirSync(dir)
		.filter((f) => f.endsWith('.yaml'))
		.sort();
	const entries: SectionListEntry[] = [];
	for (const filename of filenames) {
		const raw = readFileSync(resolve(dir, filename), 'utf8');
		const parsed = courseSectionSchema.safeParse(parse(raw));
		if (!parsed.success) continue; // malformed section file -- skip; surfaces in seed errors
		entries.push({
			filename,
			code: parsed.data.code,
			title: parsed.data.title,
			ordinal: parsed.data.ordinal,
			stepCount: parsed.data.steps.length,
		});
	}
	entries.sort((a, b) => a.ordinal - b.ordinal);
	return entries;
}

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const slug = event.params.slug;
	const course = await getCourseBySlug(slug);
	if (course === null) throw error(404, 'Course not found.');

	const sections = loadSectionsFromDisk(slug);
	// Detect orphan course_step rows: rows present in DB but no matching
	// section file on disk. The hangar UI surfaces them for cleanup.
	const dbSteps = await getCourseStepsByCourse(course.id);
	const sectionCodesOnDisk = new Set(sections.map((s) => s.code));
	const orphans: OrphanEntry[] = dbSteps
		.filter((row) => row.level === COURSE_STEP_LEVELS.SECTION && !sectionCodesOnDisk.has(row.code))
		.map((row: CourseStepRow) => ({ id: row.id, code: row.code, title: row.title }));

	return { course, sections, orphans } satisfies CourseEditorData;
};

interface RunSavePayload {
	slug: string;
	intent: string;
	/** All write operations to perform before re-running the seed. Each
	 *  carries its own backup so a seed failure can revert atomically. */
	writes: Array<{
		type: 'write' | 'delete';
		path: string;
		content?: string;
	}>;
}

/**
 * Apply a batch of YAML writes/deletes, run the seed, return the form
 * outcome. On seed failure: restore every backup and return a
 * `seed failed: <msg>` form error.
 */
async function runSave(payload: RunSavePayload) {
	const backups = new Map<string, string | null>();
	// Snapshot every target's current content before any mutation.
	for (const op of payload.writes) {
		if (existsSync(op.path)) {
			backups.set(op.path, readFileSync(op.path, 'utf8'));
		} else {
			backups.set(op.path, null);
		}
	}

	try {
		for (const op of payload.writes) {
			if (op.type === 'write' && op.content !== undefined) {
				await writeFile(op.path, op.content, 'utf8');
			} else if (op.type === 'delete') {
				await unlink(op.path);
			}
		}
		await runCourseSeed(payload.slug);
		return { intent: payload.intent, success: true } as const;
	} catch (err) {
		// Revert every mutation. Skip ops whose backup says "did not exist
		// before" if the file was created during the failed run.
		for (const [path, content] of backups) {
			if (content === null) {
				if (existsSync(path)) {
					await unlink(path).catch(() => {});
				}
			} else {
				await writeFile(path, content, 'utf8').catch(() => {});
			}
		}
		const message = err instanceof CourseSeedError ? err.message : err instanceof Error ? err.message : String(err);
		return fail(400, { intent: payload.intent, error: `seed failed: ${message}` });
	}
}

export const actions: Actions = {
	updateManifest: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const slug = event.params.slug;
		const form = await event.request.formData();
		const title = String(form.get('title') ?? '').trim();
		const description = String(form.get('description') ?? '');
		const statusRaw = String(form.get('status') ?? COURSE_STATUSES.ACTIVE);
		if (title === '') return fail(400, { intent: 'updateManifest', error: 'Title is required.' });
		if (!(COURSE_STATUS_VALUES as readonly string[]).includes(statusRaw)) {
			return fail(400, { intent: 'updateManifest', error: 'Invalid status.' });
		}
		const status = statusRaw as CourseStatus;

		const path = manifestPath(slug);
		if (!existsSync(path)) return fail(404, { intent: 'updateManifest', error: 'Manifest file missing.' });

		// Re-parse the existing manifest to preserve fields the form doesn't
		// touch (kind, etc.). Then merge form deltas.
		const existingRaw = await readFile(path, 'utf8');
		const parsed = courseManifestSchema.safeParse(parse(existingRaw));
		if (!parsed.success) {
			return fail(400, {
				intent: 'updateManifest',
				error: 'Existing manifest failed schema parse; fix on disk first.',
			});
		}
		const next = emitManifest({
			slug: parsed.data.slug,
			kind: parsed.data.kind,
			title,
			status,
			description,
		});
		return runSave({
			slug,
			intent: 'updateManifest',
			writes: [{ type: 'write', path, content: next }],
		});
	},

	addSection: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const slug = event.params.slug;
		const form = await event.request.formData();
		const code = String(form.get('code') ?? '').trim();
		const title = String(form.get('title') ?? '').trim();
		const ordinalRaw = Number.parseInt(String(form.get('ordinal') ?? ''), 10);
		const bodyMd = String(form.get('body_md') ?? '');

		if (code === '') return fail(400, { intent: 'addSection', error: 'Code is required.' });
		if (title === '') return fail(400, { intent: 'addSection', error: 'Title is required.' });
		if (!Number.isFinite(ordinalRaw) || ordinalRaw < 0) {
			return fail(400, { intent: 'addSection', error: 'Ordinal must be a non-negative integer.' });
		}

		const dir = sectionsDir(slug);
		mkdirSync(dir, { recursive: true });
		const filename = `${code}-${title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')}.yaml`;
		const path = resolve(dir, filename);
		if (existsSync(path)) {
			return fail(400, { intent: 'addSection', error: `Section file ${filename} already exists.` });
		}
		const content = emitSection({
			code,
			ordinal: ordinalRaw,
			title,
			body_md: bodyMd,
			steps: [],
		});
		return runSave({
			slug,
			intent: 'addSection',
			writes: [{ type: 'write', path, content }],
		});
	},

	deleteSection: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const slug = event.params.slug;
		const form = await event.request.formData();
		const filename = String(form.get('filename') ?? '').trim();
		if (filename === '') return fail(400, { intent: 'deleteSection', error: 'Missing filename.' });

		const path = resolve(sectionsDir(slug), filename);
		if (!existsSync(path)) {
			return fail(404, { intent: 'deleteSection', error: 'Section file not found.' });
		}
		return runSave({
			slug,
			intent: 'deleteSection',
			writes: [{ type: 'delete', path }],
		});
	},

	deleteCourse: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const slug = event.params.slug;
		const course = await getCourseBySlug(slug);
		if (course === null) return fail(404, { intent: 'deleteCourse', error: 'Course not found.' });

		// Remove the YAML directory first; then drop the DB row directly
		// (the seed pipeline does not auto-delete orphans). The
		// `goal_course.course_id` FK is RESTRICT, so a course in any
		// goal rejects this with a Postgres error -- caught below.
		const dir = resolve(COURSES_DIR, slug);
		if (existsSync(dir)) {
			rmSync(dir, { recursive: true, force: true });
		}
		try {
			await deleteCourseRow(course.id);
		} catch (err) {
			// Restore-by-recreating-files isn't realistic at this point (we
			// already nuked the dir); surface the FK violation so the user
			// can clean up the goal_course rows first. The git-tracked YAML
			// can be `git checkout`-ed back.
			const message = err instanceof Error ? err.message : String(err);
			return fail(400, {
				intent: 'deleteCourse',
				error: `delete blocked: ${message}. Restore the YAML directory with git if you cancel.`,
			});
		}
		throw redirect(303, ROUTES.HANGAR_COURSES);
	},

	cleanupOrphans: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const slug = event.params.slug;
		const course = await getCourseBySlug(slug);
		if (course === null) return fail(404, { intent: 'cleanupOrphans', error: 'Course not found.' });

		// Re-detect orphans (POST might race a competing edit) and delete
		// any course_step row whose code is not present in the on-disk
		// section files.
		const sections = loadSectionsFromDisk(slug);
		const codesOnDisk = new Set(sections.map((s) => s.code));
		// Add inline step codes too -- a section file's steps belong on disk.
		for (const section of sections) {
			const path = resolve(sectionsDir(slug), section.filename);
			const raw = readFileSync(path, 'utf8');
			const parsed = courseSectionSchema.safeParse(parse(raw));
			if (parsed.success) {
				for (const step of parsed.data.steps) codesOnDisk.add(step.code);
			}
		}
		const dbSteps = await getCourseStepsByCourse(course.id);
		const orphanRows = dbSteps.filter((r) => !codesOnDisk.has(r.code));
		for (const row of orphanRows) {
			await deleteCourseStep(row.id);
		}
		return { intent: 'cleanupOrphans', success: true, removed: orphanRows.length };
	},
};
