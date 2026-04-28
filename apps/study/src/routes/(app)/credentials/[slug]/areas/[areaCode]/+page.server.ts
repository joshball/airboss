import { requireAuth } from '@ab/auth';
import {
	CredentialNotFoundError,
	type CredentialRow,
	getCitationsForSyllabusNode,
	getCredentialBySlug,
	getCredentialPrimarySyllabus,
	getKnowledgeNodesForSyllabusLeaf,
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

	const tasksWithElements: TaskView[] = await Promise.all(
		areaView.tasks.map(async (task) => {
			const elements = areaView.elements.filter((e) => e.parentId === task.id);
			const elementViews: ElementView[] = await Promise.all(
				elements.map(async (element) => {
					const [citations, linkedNodes] = await Promise.all([
						getCitationsForSyllabusNode(element.id),
						getKnowledgeNodesForSyllabusLeaf(element.id),
					]);
					return { element, citations, linkedNodes };
				}),
			);
			return { task, elements: elementViews };
		}),
	);

	return {
		credential,
		syllabus,
		area: areaView.area,
		tasks: tasksWithElements,
	} satisfies AreaDrillData;
};
