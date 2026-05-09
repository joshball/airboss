import { readFile } from 'node:fs/promises';
import { requireRole } from '@ab/auth';
import type { CourseSection, CourseStep } from '@ab/bc-study';
import { getCourseBySlug, listNodesForBrowse } from '@ab/bc-study/server';
import { ROLES, ROUTES } from '@ab/constants';
import { error, fail, redirect } from '@sveltejs/kit';
import { runCourseSeed } from '$lib/server/course-seed';
import { emitSection } from '$lib/server/course-yaml-emit';
import { readSectionByCode, readSections, sectionPathFor, writeSectionRaw } from '$lib/server/course-yaml-io';
import type { Actions, PageServerLoad } from './$types';

interface KnowledgeNodeOption {
	readonly id: string;
	readonly title: string;
	readonly domain: string;
	readonly lifecycle: string;
}

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const { slug, code } = event.params;
	const courseRow = await getCourseBySlug(slug);
	if (courseRow === null) throw error(404, 'Course not found.');

	const record = await readSectionByCode(slug, code);
	if (record === null) throw error(404, 'Section not found.');

	// Picker data: every knowledge node, with lifecycle so the UI can
	// hide archived rows by default + offer an "include archived"
	// toggle. Keep the projection narrow so the wire payload stays
	// small (~50 nodes today, bounded growth).
	const allNodes = await listNodesForBrowse({});
	const knowledgeNodes: KnowledgeNodeOption[] = allNodes.map((n) => ({
		id: n.id,
		title: n.title,
		domain: n.domain,
		lifecycle: n.lifecycle,
	}));

	return {
		slug,
		section: {
			code: record.section.code,
			ordinal: record.section.ordinal,
			title: record.section.title,
			body_md: record.section.body_md,
			steps: record.section.steps.map((s) => ({
				code: s.code,
				ordinal: s.ordinal,
				title: s.title,
				body_md: s.body_md,
				knowledge_node_id: s.knowledge_node_id ?? '',
			})),
		},
		filename: record.filename,
		knowledgeNodes,
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

async function loadAndCheckSection(
	slug: string,
	code: string,
): Promise<{ section: CourseSection; filename: string; backup: string }> {
	const record = await readSectionByCode(slug, code);
	if (record === null) throw error(404, 'Section not found.');
	const backup = await readFile(sectionPathFor(slug, record.filename), 'utf8');
	return { section: record.section, filename: record.filename, backup };
}

function parseOrdinal(raw: string): number | null {
	const n = Number.parseInt(raw, 10);
	if (!Number.isInteger(n) || n < 0) return null;
	return n;
}

export const actions: Actions = {
	updateSection: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const { slug, code } = event.params;
		const form = await event.request.formData();
		const title = String(form.get('title') ?? '').trim();
		const bodyMd = String(form.get('body_md') ?? '');
		const ordinalRaw = String(form.get('ordinal') ?? '').trim();

		if (title === '') return fail(400, { intent: 'updateSection', error: 'Title is required.' });
		const ordinal = parseOrdinal(ordinalRaw);
		if (ordinal === null) {
			return fail(400, { intent: 'updateSection', error: 'Ordinal must be a non-negative integer.' });
		}

		const { section, filename, backup } = await loadAndCheckSection(slug, code);

		// Ordinal collision check across other sections in the course.
		if (ordinal !== section.ordinal) {
			const all = await readSections(slug);
			if (all.some((s) => s.section.ordinal === ordinal && s.section.code !== code)) {
				return fail(400, { intent: 'updateSection', error: `Ordinal ${ordinal} is already used in this course.` });
			}
		}

		const next = { ...section, title, body_md: bodyMd, ordinal };
		await writeSectionRaw(slug, filename, emitSection(next));

		const reseed = await reseedOrRevert(slug, async () => writeSectionRaw(slug, filename, backup));
		if (!reseed.ok) return fail(reseed.status, { intent: 'updateSection', error: reseed.error });
		return { intent: 'updateSection', success: true };
	},

	addStep: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const { slug, code } = event.params;
		const form = await event.request.formData();
		const stepCode = String(form.get('code') ?? '').trim();
		const title = String(form.get('title') ?? '').trim();
		const ordinalRaw = String(form.get('ordinal') ?? '').trim();
		const bodyMd = String(form.get('body_md') ?? '');
		const knowledgeNodeId = String(form.get('knowledge_node_id') ?? '').trim();

		if (stepCode === '') return fail(400, { intent: 'addStep', error: 'Code is required.' });
		if (title === '') return fail(400, { intent: 'addStep', error: 'Title is required.' });
		const ordinal = parseOrdinal(ordinalRaw);
		if (ordinal === null) return fail(400, { intent: 'addStep', error: 'Ordinal must be a non-negative integer.' });
		if (knowledgeNodeId === '') {
			return fail(400, { intent: 'addStep', error: 'Pick a knowledge node for this step.' });
		}

		const { section, filename, backup } = await loadAndCheckSection(slug, code);

		// Course-wide code uniqueness (matches the seed validator rule).
		const all = await readSections(slug);
		const allCodes = new Set<string>();
		for (const r of all) {
			allCodes.add(r.section.code);
			for (const s of r.section.steps) allCodes.add(s.code);
		}
		if (allCodes.has(stepCode)) {
			return fail(400, { intent: 'addStep', error: `Code '${stepCode}' is already used in this course.` });
		}
		if (section.steps.some((s) => s.ordinal === ordinal)) {
			return fail(400, { intent: 'addStep', error: `Ordinal ${ordinal} is already used in this section.` });
		}

		const newStep: CourseStep = {
			code: stepCode,
			ordinal,
			title,
			body_md: bodyMd,
			knowledge_node_id: knowledgeNodeId,
		};
		const next = { ...section, steps: [...section.steps, newStep] };
		await writeSectionRaw(slug, filename, emitSection(next));

		const reseed = await reseedOrRevert(slug, async () => writeSectionRaw(slug, filename, backup));
		if (!reseed.ok) return fail(reseed.status, { intent: 'addStep', error: reseed.error });
		return { intent: 'addStep', success: true };
	},

	updateStep: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const { slug, code } = event.params;
		const form = await event.request.formData();
		const stepCode = String(form.get('code') ?? '').trim();
		const title = String(form.get('title') ?? '').trim();
		const ordinalRaw = String(form.get('ordinal') ?? '').trim();
		const bodyMd = String(form.get('body_md') ?? '');
		const knowledgeNodeId = String(form.get('knowledge_node_id') ?? '').trim();

		if (stepCode === '') return fail(400, { intent: 'updateStep', error: 'Missing step code.' });
		if (title === '') return fail(400, { intent: 'updateStep', error: 'Title is required.' });
		const ordinal = parseOrdinal(ordinalRaw);
		if (ordinal === null) {
			return fail(400, { intent: 'updateStep', error: 'Ordinal must be a non-negative integer.' });
		}
		if (knowledgeNodeId === '') {
			return fail(400, { intent: 'updateStep', error: 'Pick a knowledge node for this step.' });
		}

		const { section, filename, backup } = await loadAndCheckSection(slug, code);
		const stepIdx = section.steps.findIndex((s) => s.code === stepCode);
		if (stepIdx < 0) return fail(404, { intent: 'updateStep', error: 'Step not found in this section.' });

		// Ordinal collision check inside this section (allow same ordinal for
		// the step itself).
		if (
			ordinal !== section.steps[stepIdx].ordinal &&
			section.steps.some((s, i) => i !== stepIdx && s.ordinal === ordinal)
		) {
			return fail(400, { intent: 'updateStep', error: `Ordinal ${ordinal} is already used in this section.` });
		}

		const updatedStep: CourseStep = {
			...section.steps[stepIdx],
			ordinal,
			title,
			body_md: bodyMd,
			knowledge_node_id: knowledgeNodeId,
		};
		const nextSteps = [...section.steps];
		nextSteps[stepIdx] = updatedStep;
		const next = { ...section, steps: nextSteps };
		await writeSectionRaw(slug, filename, emitSection(next));

		const reseed = await reseedOrRevert(slug, async () => writeSectionRaw(slug, filename, backup));
		if (!reseed.ok) return fail(reseed.status, { intent: 'updateStep', error: reseed.error });
		return { intent: 'updateStep', success: true };
	},

	deleteStep: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const { slug, code } = event.params;
		const form = await event.request.formData();
		const stepCode = String(form.get('code') ?? '').trim();
		if (stepCode === '') return fail(400, { intent: 'deleteStep', error: 'Missing step code.' });

		const { section, filename, backup } = await loadAndCheckSection(slug, code);
		const next = { ...section, steps: section.steps.filter((s) => s.code !== stepCode) };
		if (next.steps.length === section.steps.length) {
			return fail(404, { intent: 'deleteStep', error: 'Step not found in this section.' });
		}
		await writeSectionRaw(slug, filename, emitSection(next));

		const reseed = await reseedOrRevert(slug, async () => writeSectionRaw(slug, filename, backup));
		if (!reseed.ok) return fail(reseed.status, { intent: 'deleteStep', error: reseed.error });
		return { intent: 'deleteStep', success: true };
	},

	reorderSteps: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const { slug, code } = event.params;
		const form = await event.request.formData();
		const raw = String(form.get('ordinals') ?? '').trim();
		if (raw === '') return fail(400, { intent: 'reorderSteps', error: 'Missing ordinals payload.' });
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
				intent: 'reorderSteps',
				error: `Invalid ordinals payload: ${err instanceof Error ? err.message : String(err)}`,
			});
		}

		const { section, filename, backup } = await loadAndCheckSection(slug, code);

		const ordinals = new Set<number>();
		for (const s of section.steps) {
			if (!(s.code in map)) {
				return fail(400, { intent: 'reorderSteps', error: `Missing ordinal for step '${s.code}'.` });
			}
			const ord = map[s.code];
			if (ordinals.has(ord)) {
				return fail(400, { intent: 'reorderSteps', error: `Duplicate ordinal ${ord}.` });
			}
			ordinals.add(ord);
		}

		const next = {
			...section,
			steps: section.steps.map((s) => ({ ...s, ordinal: map[s.code] })),
		};
		await writeSectionRaw(slug, filename, emitSection(next));

		const reseed = await reseedOrRevert(slug, async () => writeSectionRaw(slug, filename, backup));
		if (!reseed.ok) return fail(reseed.status, { intent: 'reorderSteps', error: reseed.error });
		return { intent: 'reorderSteps', success: true };
	},

	// Convenience: the manifest page links here on add-section redirect; this
	// action lets the user jump back to the course view.
	backToCourse: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const { slug } = event.params;
		throw redirect(303, ROUTES.HANGAR_COURSE(slug));
	},
};
