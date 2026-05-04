import { requireAuth } from '@ab/auth';
import {
	CredentialNotFoundError,
	type CredentialRow,
	getCitationsForSyllabusNodes,
	getCredentialBySlug,
	getCredentialPrimarySyllabus,
	getKnowledgeNodesForSyllabusLeaves,
	getSyllabusArea,
	getSyllabusBySlug,
	type KnowledgeNodeRow,
	type SyllabusNodeRow,
	SyllabusNotFoundError,
	type SyllabusRow,
} from '@ab/bc-study';
import { QUERY_PARAMS } from '@ab/constants';
import type { StructuredCitation } from '@ab/types';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export interface ElementView {
	element: SyllabusNodeRow;
	citations: StructuredCitation[];
	linkedNodes: Array<{ node: KnowledgeNodeRow; weight: number }>;
}

export interface TaskView {
	task: SyllabusNodeRow;
	elements: ElementView[];
}

export interface AreaDrillData {
	credential: CredentialRow;
	syllabus: SyllabusRow;
	area: SyllabusNodeRow;
	tasks: TaskView[];
}

export const load: PageServerLoad = async (event) => {
	requireAuth(event);
	const { slug, areaCode } = event.params;

	let credential: CredentialRow;
	try {
		credential = await getCredentialBySlug(slug);
	} catch (err) {
		if (err instanceof CredentialNotFoundError) {
			throw error(404, `Credential '${slug}' not found.`);
		}
		throw err;
	}

	const editionParam = event.url.searchParams.get(QUERY_PARAMS.EDITION);
	let syllabus: SyllabusRow | null = null;
	if (editionParam !== null && editionParam !== '') {
		try {
			syllabus = await getSyllabusBySlug(editionParam);
		} catch {
			syllabus = null;
		}
	}
	if (syllabus === null) {
		syllabus = await getCredentialPrimarySyllabus(credential.id);
	}
	if (syllabus === null) {
		throw error(404, `No syllabus available for ${credential.title}.`);
	}

	let areaView: Awaited<ReturnType<typeof getSyllabusArea>>;
	try {
		areaView = await getSyllabusArea(syllabus.id, areaCode);
	} catch (err) {
		if (err instanceof SyllabusNotFoundError) {
			throw error(404, `Area '${areaCode}' not found in ${syllabus.title}.`);
		}
		throw err;
	}

	// Batched citation + linked-node lookups: pull all element citations and
	// linked-node rows for the entire area in two queries instead of two per
	// element. See `getCitationsForSyllabusNodes` and
	// `getKnowledgeNodesForSyllabusLeaves` in `@ab/bc-study/syllabi.ts`.
	// Closes the chunk-1 perf MAJOR / backend MAJOR triple-nested N+1
	// (review-tail-2026-05).
	const elementIds = areaView.elements.map((e) => e.id);
	const [citationsByElement, linkedNodesByElement] = await Promise.all([
		getCitationsForSyllabusNodes(elementIds),
		getKnowledgeNodesForSyllabusLeaves(elementIds),
	]);

	const tasksWithElements: TaskView[] = areaView.tasks.map((task) => {
		const elements = areaView.elements.filter((e) => e.parentId === task.id);
		const elementViews: ElementView[] = elements.map((element) => ({
			element,
			citations: citationsByElement.get(element.id) ?? [],
			linkedNodes: linkedNodesByElement.get(element.id) ?? [],
		}));
		return { task, elements: elementViews };
	});

	return {
		credential,
		syllabus,
		area: areaView.area,
		tasks: tasksWithElements,
	} satisfies AreaDrillData;
};
