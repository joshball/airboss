/**
 * Hangar section editor (course-reader-and-editor WP, Phase 7).
 *
 * Loads one section file (`course/courses/<slug>/sections/<file>.yaml`) and
 * surfaces:
 *   - section metadata (code, title, ordinal, body_md)
 *   - inline step list (each step's code, title, ordinal, body_md, knowledge_node_id)
 *   - the knowledge-node picker data (filtered by lifecycle)
 *
 * Steps are inline inside the section file. Every save action re-emits the
 * entire section YAML; the file is the unit of write.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRole } from '@ab/auth';
import {
	type CourseRow,
	type CourseSection,
	type CourseStep,
	courseSectionSchema,
	getCourseBySlug,
	listNodesForBrowse,
} from '@ab/bc-study/server';
import { COURSE_STEP_LEVELS, ROLES } from '@ab/constants';
import { error, fail } from '@sveltejs/kit';
import { parse } from 'yaml';
import type { PickerNode } from '$lib/components/knowledge-node-picker-types';
import { COURSES_DIR, CourseSeedError, runCourseSeed } from '$lib/server/course-seed';
import { emitSection, sectionToEmitInput } from '$lib/server/course-yaml-emit';
import type { Actions, PageServerLoad } from './$types';

export interface SectionEditorData {
	course: CourseRow;
	section: CourseSection;
	sectionFilename: string;
	pickerNodes: PickerNode[];
}

function sectionsDir(slug: string): string {
	return resolve(COURSES_DIR, slug, 'sections');
}

/**
 * Find the section YAML file inside the course's sections/ dir whose
 * `code` matches the URL param. Filenames don't have to match the code
 * (the seed pipeline keys on YAML content, not filename); the lookup
 * scans every file.
 */
function findSectionFile(slug: string, code: string): { filename: string; section: CourseSection } | null {
	const dir = sectionsDir(slug);
	if (!existsSync(dir)) return null;
	for (const filename of readdirSync(dir)) {
		if (!filename.endsWith('.yaml')) continue;
		const raw = readFileSync(resolve(dir, filename), 'utf8');
		const parsed = courseSectionSchema.safeParse(parse(raw));
		if (parsed.success && parsed.data.code === code) {
			return { filename, section: parsed.data };
		}
	}
	return null;
}

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const slug = event.params.slug;
	const code = event.params.code;
	const course = await getCourseBySlug(slug);
	if (course === null) throw error(404, 'Course not found.');

	const found = findSectionFile(slug, code);
	if (found === null) throw error(404, 'Section not found.');

	// Picker data: the existing knowledge-browse helper. The full result
	// could be large; the picker UI filters client-side. Future: paginate.
	const pickerRows = await listNodesForBrowse({});
	const pickerNodes: PickerNode[] = pickerRows.map((row) => ({
		id: row.id,
		title: row.title,
		domain: row.domain,
		lifecycle: row.lifecycle ?? null,
	}));

	return {
		course,
		section: found.section,
		sectionFilename: found.filename,
		pickerNodes,
	} satisfies SectionEditorData;
};

interface SaveSectionPayload {
	intent: string;
	slug: string;
	filename: string;
	section: CourseSection;
}

/**
 * Apply a section file rewrite + run the seed. On seed failure restores
 * the previous file content from an in-memory backup.
 */
async function saveSection({ intent, slug, filename, section }: SaveSectionPayload) {
	const path = resolve(sectionsDir(slug), filename);
	const backup = existsSync(path) ? readFileSync(path, 'utf8') : null;
	try {
		// `sectionToEmitInput` walks the recursive CourseTreeNode shape and
		// round-trips both leaf steps (the editor's authoring surface) and
		// lesson interiors (read-only in the UI today; nested-lesson editing
		// is in the OUT-OF-SCOPE.md "Hangar editor UI" follow-up). A save
		// that touches only leaf steps preserves the surrounding lesson
		// structure untouched -- the editor never crashes on a section with
		// nested content.
		const next = emitSection(sectionToEmitInput(section));
		await writeFile(path, next, 'utf8');
		await runCourseSeed(slug);
		return { intent, success: true } as const;
	} catch (err) {
		if (backup !== null) await writeFile(path, backup, 'utf8').catch(() => {});
		const message = err instanceof CourseSeedError ? err.message : err instanceof Error ? err.message : String(err);
		return fail(400, { intent, error: `seed failed: ${message}` });
	}
}

function parseStepFromForm(form: FormData): {
	code: string;
	title: string;
	body_md: string;
	knowledge_node_id: string;
	ordinal: number;
} | null {
	const code = String(form.get('code') ?? '').trim();
	const title = String(form.get('title') ?? '').trim();
	const body_md = String(form.get('body_md') ?? '');
	const knowledge_node_id = String(form.get('knowledge_node_id') ?? '').trim();
	const ordinal = Number.parseInt(String(form.get('ordinal') ?? ''), 10);
	if (code === '' || title === '' || knowledge_node_id === '' || !Number.isFinite(ordinal) || ordinal < 0) {
		return null;
	}
	return { code, title, body_md, knowledge_node_id, ordinal };
}

export const actions: Actions = {
	updateSection: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const slug = event.params.slug;
		const code = event.params.code;
		const form = await event.request.formData();
		const title = String(form.get('title') ?? '').trim();
		const body_md = String(form.get('body_md') ?? '');
		const ordinal = Number.parseInt(String(form.get('ordinal') ?? ''), 10);
		if (title === '') return fail(400, { intent: 'updateSection', error: 'Title is required.' });
		if (!Number.isFinite(ordinal) || ordinal < 0) {
			return fail(400, { intent: 'updateSection', error: 'Ordinal must be a non-negative integer.' });
		}

		const found = findSectionFile(slug, code);
		if (found === null) return fail(404, { intent: 'updateSection', error: 'Section not found.' });
		const next: CourseSection = { ...found.section, title, body_md, ordinal };
		return saveSection({ intent: 'updateSection', slug, filename: found.filename, section: next });
	},

	addStep: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const slug = event.params.slug;
		const code = event.params.code;
		const form = await event.request.formData();
		const stepInput = parseStepFromForm(form);
		if (stepInput === null) {
			return fail(400, {
				intent: 'addStep',
				error: 'All step fields are required (code, title, knowledge_node_id, ordinal).',
			});
		}

		const found = findSectionFile(slug, code);
		if (found === null) return fail(404, { intent: 'addStep', error: 'Section not found.' });

		// Reject duplicate code within the section. Course-wide duplicate-code
		// check fires inside the seed pipeline when we re-run it; this is the
		// inner-section duplicate, friendlier message.
		if (found.section.steps.some((s) => s.code === stepInput.code)) {
			return fail(400, { intent: 'addStep', error: `Step code ${stepInput.code} already exists in this section.` });
		}

		const newStep: CourseStep = {
			code: stepInput.code,
			ordinal: stepInput.ordinal,
			title: stepInput.title,
			body_md: stepInput.body_md,
			knowledge_node_id: stepInput.knowledge_node_id,
		};
		const next: CourseSection = { ...found.section, steps: [...found.section.steps, newStep] };
		return saveSection({ intent: 'addStep', slug, filename: found.filename, section: next });
	},

	updateStep: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const slug = event.params.slug;
		const code = event.params.code;
		const form = await event.request.formData();
		const originalCode = String(form.get('originalCode') ?? '').trim();
		const stepInput = parseStepFromForm(form);
		if (stepInput === null || originalCode === '') {
			return fail(400, { intent: 'updateStep', error: 'All step fields required.' });
		}

		const found = findSectionFile(slug, code);
		if (found === null) return fail(404, { intent: 'updateStep', error: 'Section not found.' });
		// Only match leaf steps; lessons are read-only in the hangar UI today
		// (course-tree-arbitrary-depth WP, "Hangar editor UI" follow-up).
		const idx = found.section.steps.findIndex((s) => s.code === originalCode && s.level !== COURSE_STEP_LEVELS.LESSON);
		if (idx === -1) return fail(404, { intent: 'updateStep', error: 'Step not found.' });

		const updatedStep: CourseStep = {
			code: stepInput.code,
			ordinal: stepInput.ordinal,
			title: stepInput.title,
			body_md: stepInput.body_md,
			knowledge_node_id: stepInput.knowledge_node_id,
		};
		const newSteps = [...found.section.steps];
		newSteps[idx] = updatedStep;
		const next: CourseSection = { ...found.section, steps: newSteps };
		return saveSection({ intent: 'updateStep', slug, filename: found.filename, section: next });
	},

	deleteStep: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const slug = event.params.slug;
		const code = event.params.code;
		const form = await event.request.formData();
		const stepCode = String(form.get('stepCode') ?? '').trim();
		if (stepCode === '') return fail(400, { intent: 'deleteStep', error: 'Missing stepCode.' });

		const found = findSectionFile(slug, code);
		if (found === null) return fail(404, { intent: 'deleteStep', error: 'Section not found.' });
		// Refuse to delete a lesson interior via this action (the UI only
		// surfaces leaf steps; a lesson code reaching here would be a YAML
		// hand-edit). Keep lessons; drop matching leaf steps.
		const newSteps = found.section.steps.filter((s) => {
			const isLesson = s.level === COURSE_STEP_LEVELS.LESSON;
			if (isLesson) return true; // never delete lesson rows via this action
			return s.code !== stepCode;
		});
		if (newSteps.length === found.section.steps.length) {
			return fail(404, { intent: 'deleteStep', error: 'Step not found.' });
		}
		const next: CourseSection = { ...found.section, steps: newSteps };
		return saveSection({ intent: 'deleteStep', slug, filename: found.filename, section: next });
	},
};
