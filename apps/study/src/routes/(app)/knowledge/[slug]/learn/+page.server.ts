import { requireAuth } from '@ab/auth';
import { getNodeView, splitContentPhases } from '@ab/bc-study';
import { KNOWLEDGE_PHASE_ORDER, type KnowledgePhase } from '@ab/constants';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

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

	return {
		node: {
			id: view.node.id,
			title: view.node.title,
			domain: view.node.domain,
		},
		phases,
	};
};
