import { requireAuth } from '@ab/auth';
import {
	getNodeProgress,
	getNodeView,
	recordPhaseCompleted,
	recordPhaseVisited,
	splitContentPhases,
} from '@ab/bc-study';
import { KNOWLEDGE_PHASE_ORDER, KNOWLEDGE_PHASE_VALUES, type KnowledgePhase, QUERY_PARAMS } from '@ab/constants';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/**
 * Extract activity ids from a phase body. Authoring convention (see
 * `course/knowledge/performance/crosswind-component/node.md`): activities are
 * referenced as backtick-quoted `activity:<id>` tokens inside markdown lists.
 * Pulling them here keeps the client-side renderer decoupled from the
 * activity registry.
 */
function extractActivityIds(body: string | null): string[] {
	if (!body) return [];
	const ids = new Set<string>();
	const regex = /`activity:([a-z][a-z0-9-]*)`/g;
	let match = regex.exec(body);
	while (match !== null) {
		ids.add(match[1]);
		match = regex.exec(body);
	}
	return Array.from(ids);
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const slug = event.params.slug;

	const view = await getNodeView(slug, user.id);
	if (!view) {
		error(404, `Knowledge node not found: ${slug}`);
	}

	const phaseBodies = splitContentPhases(view.node.contentMd);

	const phases: Array<{ phase: KnowledgePhase; body: string | null; activityIds: string[] }> =
		KNOWLEDGE_PHASE_ORDER.map((phase) => ({
			phase,
			body: phaseBodies[phase] ?? null,
			activityIds: extractActivityIds(phaseBodies[phase] ?? null),
		}));

	const progress = await getNodeProgress(user.id, view.node.id);

	// Deep-link support: `?step=<named-slug>`. Narrow against the known phase
	// set; an unknown or missing value falls back to the learner's last phase
	// (resume), else the first phase in the canonical order (Context).
	const stepParam = event.url.searchParams.get(QUERY_PARAMS.STEP);
	const isKnownPhase = (v: string | null): v is KnowledgePhase =>
		v !== null && (KNOWLEDGE_PHASE_VALUES as readonly string[]).includes(v);

	const resumePhase = isKnownPhase(progress.lastPhase) ? progress.lastPhase : null;
	const initialPhase: KnowledgePhase = isKnownPhase(stepParam) ? stepParam : (resumePhase ?? KNOWLEDGE_PHASE_ORDER[0]);

	return {
		node: {
			id: view.node.id,
			title: view.node.title,
			domain: view.node.domain,
		},
		phases,
		initialPhase,
		progress,
	};
};

function parsePhase(raw: FormDataEntryValue | null): KnowledgePhase | null {
	if (typeof raw !== 'string') return null;
	return (KNOWLEDGE_PHASE_VALUES as readonly string[]).includes(raw) ? (raw as KnowledgePhase) : null;
}

export const actions: Actions = {
	visitPhase: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const phase = parsePhase(form.get('phase'));
		if (!phase) return fail(400, { error: 'invalid phase' });
		await recordPhaseVisited(user.id, event.params.slug, phase);
		return { success: true as const, intent: 'visitPhase' as const, phase };
	},
	completePhase: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const phase = parsePhase(form.get('phase'));
		if (!phase) return fail(400, { error: 'invalid phase' });
		await recordPhaseCompleted(user.id, event.params.slug, phase);
		return { success: true as const, intent: 'completePhase' as const, phase };
	},
};
