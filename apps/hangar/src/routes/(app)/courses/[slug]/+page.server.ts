import { existsSync } from 'node:fs';
import { rm, unlink } from 'node:fs/promises';
import { requireRole } from '@ab/auth';
import { deleteCourseStep, getCourseBySlug, getCourseStepsByCourse } from '@ab/bc-study/server';
import { COURSE_STATUS_VALUES, COURSE_STEP_LEVELS, type CourseStatus, ROLES, ROUTES } from '@ab/constants';
import { error, fail, redirect } from '@sveltejs/kit';
import { runCourseSeed } from '$lib/server/course-seed';
import { emitManifest, emitSection } from '$lib/server/course-yaml-emit';
import {
	buildSectionFilename,
	readManifest,
	readManifestRaw,
	readSections,
	sectionPathFor,
	writeManifestRaw,
	writeSectionRaw,
} from '$lib/server/course-yaml-io';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const { slug } = event.params;
	const courseRow = await getCourseBySlug(slug);
	if (courseRow === null) throw error(404, 'Course not found.');

	const manifest = await readManifest(slug);
	const sectionRecords = await readSections(slug);

	// Step rows for orphan-detection. The seed pipeline reports stale
	// rows (in DB, not in YAML) but does not delete them; the editor
	// surfaces the list with an explicit cleanupOrphans action.
	const stepRows = await getCourseStepsByCourse(courseRow.id);
	const yamlCodes = new Set<string>();
	for (const { section } of sectionRecords) {
		yamlCodes.add(section.code);
		for (const step of section.steps) yamlCodes.add(step.code);
	}
	const orphanRows = stepRows.filter((r) => !yamlCodes.has(r.code));

	return {
		courseId: courseRow.id,
		slug,
		manifest,
		sections: sectionRecords.map((r) => ({
			filename: r.filename,
			code: r.section.code,
			title: r.section.title,
			ordinal: r.section.ordinal,
			stepCount: r.section.steps.length,
		})),
		orphans: orphanRows.map((r) => ({
			id: r.id,
			code: r.code,
			level: r.level,
			title: r.title,
		})),
	};
};

async function reseedOrRevert(
	slug: string,
	revert: () => Promise<void>,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
	const result = await runCourseSeed(slug);
	if (!result.ok) {
		await revert();
		return { ok: false, status: 400, error: `Seed rejected: ${result.error}. Edits reverted.` };
	}
	return { ok: true };
}

export const actions: Actions = {
	updateManifest: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const { slug } = event.params;
		const courseRow = await getCourseBySlug(slug);
		if (courseRow === null) throw error(404, 'Course not found.');

		const form = await event.request.formData();
		const title = String(form.get('title') ?? '').trim();
		const description = String(form.get('description') ?? '');
		const statusRaw = String(form.get('status') ?? '').trim();

		if (title === '') return fail(400, { intent: 'updateManifest', error: 'Title is required.' });
		if (!(COURSE_STATUS_VALUES as readonly string[]).includes(statusRaw)) {
			return fail(400, { intent: 'updateManifest', error: 'Invalid status.' });
		}
		const status = statusRaw as CourseStatus;

		const current = await readManifest(slug);
		const backup = await readManifestRaw(slug);
		const next = { ...current, title, description, status };
		await writeManifestRaw(slug, emitManifest(next));

		const reseed = await reseedOrRevert(slug, async () => writeManifestRaw(slug, backup));
		if (!reseed.ok) return fail(reseed.status, { intent: 'updateManifest', error: reseed.error });
		return { intent: 'updateManifest', success: true };
	},

	addSection: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const { slug } = event.params;
		const courseRow = await getCourseBySlug(slug);
		if (courseRow === null) throw error(404, 'Course not found.');

		const form = await event.request.formData();
		const code = String(form.get('code') ?? '').trim();
		const title = String(form.get('title') ?? '').trim();
		const ordinalRaw = String(form.get('ordinal') ?? '').trim();
		const bodyMd = String(form.get('body_md') ?? '');

		if (code === '') return fail(400, { intent: 'addSection', error: 'Code is required.' });
		if (title === '') return fail(400, { intent: 'addSection', error: 'Title is required.' });
		const ordinal = Number.parseInt(ordinalRaw, 10);
		if (!Number.isInteger(ordinal) || ordinal < 0) {
			return fail(400, { intent: 'addSection', error: 'Ordinal must be a non-negative integer.' });
		}

		// Code uniqueness within the course (the seed pipeline catches this
		// too, but pre-flighting gives a friendlier message).
		const existing = await readSections(slug);
		if (existing.some((s) => s.section.code === code)) {
			return fail(400, { intent: 'addSection', error: `Code '${code}' already exists in this course.` });
		}
		if (existing.some((s) => s.section.ordinal === ordinal)) {
			return fail(400, { intent: 'addSection', error: `Ordinal ${ordinal} is already used in this course.` });
		}

		const filename = buildSectionFilename(code, title);
		const filePath = sectionPathFor(slug, filename);
		if (existsSync(filePath)) {
			return fail(400, { intent: 'addSection', error: `Section file '${filename}' already exists.` });
		}

		await writeSectionRaw(slug, filename, emitSection({ code, title, ordinal, body_md: bodyMd, steps: [] }));

		const reseed = await reseedOrRevert(slug, async () => unlink(filePath));
		if (!reseed.ok) return fail(reseed.status, { intent: 'addSection', error: reseed.error });

		throw redirect(303, ROUTES.HANGAR_COURSE_SECTION(slug, code));
	},

	deleteSection: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const { slug } = event.params;

		const form = await event.request.formData();
		const filename = String(form.get('filename') ?? '').trim();
		if (filename === '') return fail(400, { intent: 'deleteSection', error: 'Missing filename.' });

		const path = sectionPathFor(slug, filename);
		if (!existsSync(path)) return fail(404, { intent: 'deleteSection', error: 'Section file not found.' });

		const backup = await (await import('node:fs/promises')).readFile(path, 'utf8');
		await unlink(path);

		const reseed = await reseedOrRevert(slug, async () => writeSectionRaw(slug, filename, backup));
		if (!reseed.ok) return fail(reseed.status, { intent: 'deleteSection', error: reseed.error });

		// The seed-pipeline reports the now-orphan section + child steps but
		// does NOT delete them; the page surfaces the orphan list with an
		// explicit cleanupOrphans action.
		return { intent: 'deleteSection', success: true };
	},

	reorderSections: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const { slug } = event.params;

		const form = await event.request.formData();
		// `ordinals` is a JSON-encoded `{ <filename>: <newOrdinal> }` map.
		// The form serialises this as one hidden field for atomicity --
		// every section's ordinal is rewritten in one save.
		const raw = String(form.get('ordinals') ?? '').trim();
		if (raw === '') return fail(400, { intent: 'reorderSections', error: 'Missing ordinals payload.' });
		let map: Record<string, number>;
		try {
			const parsed: unknown = JSON.parse(raw);
			if (typeof parsed !== 'object' || parsed === null) throw new Error('not an object');
			map = {} as Record<string, number>;
			for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
				if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) throw new Error(`bad ordinal for ${k}`);
				map[k] = v;
			}
		} catch (err) {
			return fail(400, {
				intent: 'reorderSections',
				error: `Invalid ordinals payload: ${err instanceof Error ? err.message : String(err)}`,
			});
		}

		// Read every section so we can write back atomically. Backup file
		// contents before any change.
		const records = await readSections(slug);
		const backups = new Map<string, string>();
		for (const r of records) {
			const text = await (await import('node:fs/promises')).readFile(sectionPathFor(slug, r.filename), 'utf8');
			backups.set(r.filename, text);
		}

		// Validate the payload: every filename must exist, ordinals unique.
		const ordinals = new Set<number>();
		for (const r of records) {
			if (!(r.filename in map)) {
				return fail(400, { intent: 'reorderSections', error: `Missing ordinal for ${r.filename}.` });
			}
			const ord = map[r.filename];
			if (ordinals.has(ord)) {
				return fail(400, { intent: 'reorderSections', error: `Duplicate ordinal ${ord}.` });
			}
			ordinals.add(ord);
		}

		// Apply.
		for (const r of records) {
			const newOrdinal = map[r.filename];
			if (newOrdinal === r.section.ordinal) continue;
			await writeSectionRaw(slug, r.filename, emitSection({ ...r.section, ordinal: newOrdinal }));
		}

		const revert = async () => {
			for (const [filename, contents] of backups) {
				await writeSectionRaw(slug, filename, contents);
			}
		};
		const reseed = await reseedOrRevert(slug, revert);
		if (!reseed.ok) return fail(reseed.status, { intent: 'reorderSections', error: reseed.error });
		return { intent: 'reorderSections', success: true };
	},

	cleanupOrphans: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const { slug } = event.params;
		const courseRow = await getCourseBySlug(slug);
		if (courseRow === null) throw error(404, 'Course not found.');

		const stepRows = await getCourseStepsByCourse(courseRow.id);
		const sectionRecords = await readSections(slug);
		const yamlCodes = new Set<string>();
		for (const { section } of sectionRecords) {
			yamlCodes.add(section.code);
			for (const step of section.steps) yamlCodes.add(step.code);
		}

		// Sort orphans so child step rows are deleted before their parent
		// section rows (the FK on courseStep.parentId is ON DELETE CASCADE,
		// but explicit ordering keeps the cleanup observable).
		const orphans = stepRows
			.filter((r) => !yamlCodes.has(r.code))
			.sort((a, b) => {
				const aIsStep = a.level === COURSE_STEP_LEVELS.STEP ? 0 : 1;
				const bIsStep = b.level === COURSE_STEP_LEVELS.STEP ? 0 : 1;
				return aIsStep - bIsStep;
			});
		for (const o of orphans) {
			await deleteCourseStep(o.id);
		}
		return { intent: 'cleanupOrphans', success: true, removed: orphans.length };
	},
};
