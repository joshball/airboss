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
 *   - deleteCourse:   remove the entire course/courses/<slug>/ dir, re-run
 *   - cleanupOrphans: DELETE the orphan rows the seed reported
 *
 * Every save backs up the YAML before writing; on seed failure the backup
 * is restored and the form returns a `seed failed: <message>` error.
 *
 * Path-traversal hardening: the `[slug]` route param + the `filename` /
 * `code` form fields are validated against `course-path-safety.ts` guards
 * before any path construction -- an authoring-role account is privilege
 * containment, not input validation.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRole } from '@ab/auth';
import {
	type CourseRow,
	type CourseStepRow,
	countGoalsReferencingCourse,
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
	COURSE_TITLE_MAX_LENGTH,
	type CourseStatus,
	ROLES,
	ROUTES,
} from '@ab/constants';
import { db } from '@ab/db/connection';
import { error, fail, redirect } from '@sveltejs/kit';
import { parse } from 'yaml';
import { assertResolvedUnder, assertSafeSlug, isSafeCode, isSafeSectionFilename } from '$lib/server/course-path-safety';
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

/**
 * Parsed on-disk section, including the inline step list. The orphan
 * detection needs the full step set; the editor section list only needs
 * the summary fields.
 */
interface ParsedDiskSection {
	entry: SectionListEntry;
	stepCodes: string[];
}

/**
 * Read + parse every `sections/*.yaml` for a slug. Returns one entry per
 * valid file with the section summary AND the set of inline step codes
 * (recursively, lessons + steps). Malformed files are skipped (they
 * surface as seed errors). The slug is assumed already validated by
 * `assertSafeSlug`.
 */
function loadDiskSections(slug: string): ParsedDiskSection[] {
	const dir = sectionsDir(slug);
	if (!existsSync(dir)) return [];
	const filenames = readdirSync(dir)
		.filter((f) => f.endsWith('.yaml'))
		.sort();
	const result: ParsedDiskSection[] = [];
	for (const filename of filenames) {
		const raw = readFileSync(resolve(dir, filename), 'utf8');
		const parsed = courseSectionSchema.safeParse(parse(raw));
		if (!parsed.success) continue; // malformed section file -- skip; surfaces in seed errors
		const stepCodes: string[] = [];
		const collect = (nodes: ReadonlyArray<{ code: string; level?: string; steps?: unknown }>): void => {
			for (const node of nodes) {
				stepCodes.push(node.code);
				if (node.level === COURSE_STEP_LEVELS.LESSON && Array.isArray(node.steps)) {
					collect(node.steps as Array<{ code: string; level?: string; steps?: unknown }>);
				}
			}
		};
		collect(parsed.data.steps);
		result.push({
			entry: {
				filename,
				code: parsed.data.code,
				title: parsed.data.title,
				ordinal: parsed.data.ordinal,
				stepCount: parsed.data.steps.length,
			},
			stepCodes,
		});
	}
	result.sort((a, b) => a.entry.ordinal - b.entry.ordinal);
	return result;
}

function loadSectionsFromDisk(slug: string): SectionListEntry[] {
	return loadDiskSections(slug).map((s) => s.entry);
}

/**
 * Detect orphan `course_step` rows: DB rows whose code is present in
 * neither the section files NOR their inline steps/lessons. Shared by the
 * loader (which surfaces the orphan panel) and `cleanupOrphans` (which
 * deletes them) so the two cannot drift -- before this, the loader only
 * looked at section codes and silently hid orphan step rows.
 */
function detectOrphans(slug: string, dbSteps: ReadonlyArray<CourseStepRow>): OrphanEntry[] {
	const sections = loadDiskSections(slug);
	const codesOnDisk = new Set<string>();
	for (const section of sections) {
		codesOnDisk.add(section.entry.code);
		for (const code of section.stepCodes) codesOnDisk.add(code);
	}
	return dbSteps
		.filter((row) => !codesOnDisk.has(row.code))
		.map((row) => ({ id: row.id, code: row.code, title: row.title }));
}

/**
 * Map an unexpected (non-`CourseSeedError`) failure to a generic
 * client-facing message and log the detail server-side. Raw DB / driver
 * error text must never reach the browser.
 */
function genericFailure(intent: string, err: unknown) {
	console.error(`[hangar/courses] ${intent} unexpected failure:`, err);
	return fail(400, { intent, error: 'Action failed unexpectedly. Check server logs.' });
}

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const slug = event.params.slug;
	assertSafeSlug(slug);
	const course = await getCourseBySlug(slug);
	if (course === null) throw error(404, 'Course not found.');

	const sections = loadSectionsFromDisk(slug);
	// Detect orphan course_step rows: rows present in DB but absent from the
	// on-disk section files (sections + inline lessons/steps). The hangar
	// UI surfaces them for cleanup.
	const dbSteps = await getCourseStepsByCourse(course.id);
	const orphans = detectOrphans(slug, dbSteps);

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
 * `seed failed: <msg>` form error. Revert failures are collected and
 * surfaced so the user knows the disk is in a partially-mutated state.
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
		// Revert every mutation. Collect any revert failure so the user is
		// told the disk is in a partially-mutated state.
		const revertFailures: string[] = [];
		for (const [path, content] of backups) {
			try {
				if (content === null) {
					if (existsSync(path)) await unlink(path);
				} else {
					await writeFile(path, content, 'utf8');
				}
			} catch (revertErr) {
				console.error(`[hangar/courses] revert failed for ${path}:`, revertErr);
				revertFailures.push(path);
			}
		}
		const isSeedError = err instanceof CourseSeedError;
		if (!isSeedError) {
			console.error(`[hangar/courses] ${payload.intent} unexpected failure:`, err);
		}
		const detail = isSeedError ? err.message : 'unexpected error (see server logs)';
		let message = `seed failed: ${detail}`;
		if (revertFailures.length > 0) {
			message += `; WARNING: ${revertFailures.length} file(s) could not be reverted -- run 'git checkout course/courses/${payload.slug}' to restore`;
		}
		return fail(400, { intent: payload.intent, error: message });
	}
}

export const actions: Actions = {
	updateManifest: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const slug = event.params.slug;
		assertSafeSlug(slug);
		const form = await event.request.formData();
		const title = String(form.get('title') ?? '').trim();
		const description = String(form.get('description') ?? '');
		const statusRaw = String(form.get('status') ?? COURSE_STATUSES.ACTIVE);
		if (title === '') return fail(400, { intent: 'updateManifest', error: 'Title is required.' });
		if (title.length > COURSE_TITLE_MAX_LENGTH) {
			return fail(400, {
				intent: 'updateManifest',
				error: `Title must be ${COURSE_TITLE_MAX_LENGTH} characters or fewer.`,
			});
		}
		if (!(COURSE_STATUS_VALUES as readonly string[]).includes(statusRaw)) {
			return fail(400, { intent: 'updateManifest', error: 'Invalid status.' });
		}
		const status = statusRaw as CourseStatus;

		const path = manifestPath(slug);
		assertResolvedUnder(COURSES_DIR, path);
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
		assertSafeSlug(slug);
		const form = await event.request.formData();
		const code = String(form.get('code') ?? '').trim();
		const title = String(form.get('title') ?? '').trim();
		const ordinalRaw = Number.parseInt(String(form.get('ordinal') ?? ''), 10);
		const bodyMd = String(form.get('body_md') ?? '');

		if (code === '') return fail(400, { intent: 'addSection', error: 'Code is required.' });
		if (!isSafeCode(code)) {
			return fail(400, { intent: 'addSection', error: 'Code must be lowercase alphanumeric with dots or hyphens.' });
		}
		if (title === '') return fail(400, { intent: 'addSection', error: 'Title is required.' });
		if (title.length > COURSE_TITLE_MAX_LENGTH) {
			return fail(400, { intent: 'addSection', error: `Title must be ${COURSE_TITLE_MAX_LENGTH} characters or fewer.` });
		}
		if (!Number.isFinite(ordinalRaw) || ordinalRaw < 0) {
			return fail(400, { intent: 'addSection', error: 'Ordinal must be a non-negative integer.' });
		}

		// Pre-validate ordinal uniqueness against the existing sections so the
		// user gets a friendly field-level message rather than a raw seed error
		// after a write-then-revert.
		const existingSections = loadSectionsFromDisk(slug);
		if (existingSections.some((s) => s.ordinal === ordinalRaw)) {
			return fail(400, { intent: 'addSection', error: 'Ordinal already used by another section.' });
		}

		const dir = sectionsDir(slug);
		mkdirSync(dir, { recursive: true });
		const filename = `${code}-${title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')}.yaml`;
		// `code` is allowlisted and `title` is regex-scrubbed, so the filename
		// is a bare basename -- assert the resolved path to be belt-and-braces.
		const path = resolve(dir, filename);
		assertResolvedUnder(dir, path);
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
		assertSafeSlug(slug);
		const form = await event.request.formData();
		const filename = String(form.get('filename') ?? '').trim();
		if (filename === '') return fail(400, { intent: 'deleteSection', error: 'Missing filename.' });
		if (!isSafeSectionFilename(filename)) {
			return fail(400, { intent: 'deleteSection', error: 'Invalid section filename.' });
		}
		// Allowlist: the filename must be one of the section files actually on
		// disk. The UI only ever offers real filenames; a crafted request that
		// names something else is rejected.
		const onDisk = new Set(loadSectionsFromDisk(slug).map((s) => s.filename));
		if (!onDisk.has(filename)) {
			return fail(404, { intent: 'deleteSection', error: 'Section file not found.' });
		}

		const path = resolve(sectionsDir(slug), filename);
		assertResolvedUnder(sectionsDir(slug), path);
		return runSave({
			slug,
			intent: 'deleteSection',
			writes: [{ type: 'delete', path }],
		});
	},

	deleteCourse: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const slug = event.params.slug;
		assertSafeSlug(slug);
		const course = await getCourseBySlug(slug);
		if (course === null) return fail(404, { intent: 'deleteCourse', error: 'Course not found.' });

		// Check for blocking `goal_course` references BEFORE destroying the
		// YAML directory. The `goal_course.course_id` FK is RESTRICT; deleting
		// the directory first and discovering the FK block second left disk
		// and DB inconsistent. Detect the block up front and bail with the
		// directory intact.
		const referencingGoals = await countGoalsReferencingCourse(course.id);
		if (referencingGoals > 0) {
			return fail(400, {
				intent: 'deleteCourse',
				error: `Course is referenced by ${referencingGoals} goal(s); remove it from those goals first.`,
			});
		}

		const dir = resolve(COURSES_DIR, slug);
		assertResolvedUnder(COURSES_DIR, dir);
		try {
			await deleteCourseRow(course.id);
		} catch (err) {
			return genericFailure('deleteCourse', err);
		}
		// Remove the YAML directory only after the DB row delete succeeded.
		if (existsSync(dir)) {
			rmSync(dir, { recursive: true, force: true });
		}
		throw redirect(303, ROUTES.HANGAR_COURSES);
	},

	cleanupOrphans: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const slug = event.params.slug;
		assertSafeSlug(slug);
		const course = await getCourseBySlug(slug);
		if (course === null) return fail(404, { intent: 'cleanupOrphans', error: 'Course not found.' });

		// Re-detect orphans (POST might race a competing edit) using the same
		// shared detection the loader's panel uses, then delete every orphan
		// row inside one transaction so cleanup is all-or-nothing.
		const dbSteps = await getCourseStepsByCourse(course.id);
		const orphanRows = detectOrphans(slug, dbSteps);
		try {
			await db.transaction(async (tx) => {
				for (const row of orphanRows) {
					await deleteCourseStep(row.id, tx);
				}
			});
		} catch (err) {
			return genericFailure('cleanupOrphans', err);
		}
		return { intent: 'cleanupOrphans', success: true, removed: orphanRows.length };
	},
};
