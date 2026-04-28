import { requireAuth } from '@ab/auth';
import {
	addGoalNode,
	addGoalSyllabus,
	archiveGoal,
	type GoalNodeRow,
	GoalNotFoundError,
	GoalNotOwnedError,
	type GoalRow,
	type GoalSyllabusRow,
	getCredentialSyllabi,
	getGoalNodes,
	getGoalSyllabi,
	getOwnedGoal,
	listCredentials,
	listNodesWithFacets,
	removeGoalNode,
	removeGoalSyllabus,
	type SyllabusRow,
	setGoalNodeWeight,
	setGoalSyllabusWeight,
	setPrimaryGoal,
	updateGoal,
} from '@ab/bc-study';
import {
	CREDENTIAL_STATUSES,
	GOAL_STATUS_VALUES,
	GOAL_SYLLABUS_WEIGHT_MAX,
	GOAL_SYLLABUS_WEIGHT_MIN,
	type GoalStatus,
	ROUTES,
	SYLLABUS_PRIMACY,
} from '@ab/constants';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export interface SyllabusOption {
	id: string;
	credentialTitle: string;
	syllabusTitle: string;
}

export interface GoalDetailData {
	goal: GoalRow;
	syllabi: GoalSyllabusRow[];
	syllabusTitleById: Record<string, string>;
	nodes: GoalNodeRow[];
	availableSyllabi: SyllabusOption[];
	availableNodes: Array<{ id: string; title: string; domain: string }>;
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const { id } = event.params;

	let goal: GoalRow;
	try {
		goal = await getOwnedGoal(id, user.id);
	} catch (err) {
		if (err instanceof GoalNotFoundError || err instanceof GoalNotOwnedError) {
			throw error(404, `Goal '${id}' not found.`);
		}
		throw err;
	}

	const [syllabi, nodes] = await Promise.all([getGoalSyllabi(goal.id), getGoalNodes(goal.id)]);

	// Build available-syllabi list -- every credential's primary syllabus,
	// minus those already on the goal.
	const credentials = await listCredentials({ status: CREDENTIAL_STATUSES.ACTIVE });
	const availableSyllabi: SyllabusOption[] = [];
	const presentSyllabusIds = new Set(syllabi.map((s) => s.syllabusId));
	const allSyllabusRows: SyllabusRow[] = [];
	for (const cred of credentials) {
		const credSyl = await getCredentialSyllabi(cred.id, { primacy: SYLLABUS_PRIMACY.PRIMARY });
		for (const item of credSyl) {
			allSyllabusRows.push(item.syllabus);
			if (!presentSyllabusIds.has(item.syllabus.id)) {
				availableSyllabi.push({
					id: item.syllabus.id,
					credentialTitle: cred.title,
					syllabusTitle: item.syllabus.title,
				});
			}
		}
	}

	const syllabusTitleById: Record<string, string> = {};
	for (const row of allSyllabusRows) {
		syllabusTitleById[row.id] = row.title;
	}

	// Lightweight node-picker default: list 25 most-recent nodes the user
	// hasn't already added. Refines by ?q= search term in the future.
	const presentNodeIds = new Set(nodes.map((n) => n.knowledgeNodeId));
	const candidateNodes = await listNodesWithFacets({});
	const availableNodes = candidateNodes.rows
		.filter((n) => !presentNodeIds.has(n.id))
		.slice(0, 25)
		.map((n) => ({ id: n.id, title: n.title, domain: n.domain }));

	return {
		goal,
		syllabi,
		syllabusTitleById,
		nodes,
		availableSyllabi,
		availableNodes,
	} satisfies GoalDetailData;
};

function clampWeight(raw: string): number {
	const value = Number.parseFloat(raw);
	if (!Number.isFinite(value)) return 1.0;
	return Math.max(GOAL_SYLLABUS_WEIGHT_MIN, Math.min(GOAL_SYLLABUS_WEIGHT_MAX, value));
}

export const actions: Actions = {
	update: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const title = String(form.get('title') ?? '').trim();
		const notesMd = String(form.get('notesMd') ?? '');
		const targetDateRaw = String(form.get('targetDate') ?? '').trim();

		if (title === '') return fail(400, { intent: 'update', error: 'Title is required.' });
		if (targetDateRaw !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(targetDateRaw)) {
			return fail(400, { intent: 'update', error: 'Target date must be YYYY-MM-DD or empty.' });
		}

		try {
			await updateGoal(event.params.id, user.id, {
				title,
				notesMd,
				targetDate: targetDateRaw === '' ? null : targetDateRaw,
			});
		} catch (err) {
			if (err instanceof GoalNotFoundError || err instanceof GoalNotOwnedError) {
				throw error(404, 'Goal not found.');
			}
			throw err;
		}
		throw redirect(303, ROUTES.GOAL(event.params.id));
	},

	setStatus: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const statusRaw = String(form.get('status') ?? '');
		if (!(GOAL_STATUS_VALUES as readonly string[]).includes(statusRaw)) {
			return fail(400, { intent: 'setStatus', error: 'Invalid status.' });
		}
		const status = statusRaw as GoalStatus;
		try {
			await updateGoal(event.params.id, user.id, { status });
		} catch (err) {
			if (err instanceof GoalNotFoundError || err instanceof GoalNotOwnedError) {
				throw error(404, 'Goal not found.');
			}
			throw err;
		}
		return { intent: 'setStatus', success: true };
	},

	makePrimary: async (event) => {
		const user = requireAuth(event);
		try {
			await setPrimaryGoal(event.params.id, user.id);
		} catch (err) {
			if (err instanceof GoalNotFoundError || err instanceof GoalNotOwnedError) {
				throw error(404, 'Goal not found.');
			}
			throw err;
		}
		return { intent: 'makePrimary', success: true };
	},

	archive: async (event) => {
		const user = requireAuth(event);
		try {
			await archiveGoal(event.params.id, user.id);
		} catch (err) {
			if (err instanceof GoalNotFoundError || err instanceof GoalNotOwnedError) {
				throw error(404, 'Goal not found.');
			}
			throw err;
		}
		throw redirect(303, ROUTES.GOALS);
	},

	addSyllabus: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const syllabusId = String(form.get('syllabusId') ?? '').trim();
		if (syllabusId === '') return fail(400, { intent: 'addSyllabus', error: 'Pick a syllabus.' });
		try {
			await addGoalSyllabus(event.params.id, user.id, { syllabusId, weight: 1.0 });
		} catch (err) {
			if (err instanceof GoalNotFoundError || err instanceof GoalNotOwnedError) {
				throw error(404, 'Goal not found.');
			}
			throw err;
		}
		return { intent: 'addSyllabus', success: true };
	},

	removeSyllabus: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const syllabusId = String(form.get('syllabusId') ?? '').trim();
		if (syllabusId === '') return fail(400, { intent: 'removeSyllabus', error: 'Missing syllabusId.' });
		try {
			await removeGoalSyllabus(event.params.id, user.id, syllabusId);
		} catch (err) {
			if (err instanceof GoalNotFoundError || err instanceof GoalNotOwnedError) {
				throw error(404, 'Goal not found.');
			}
			throw err;
		}
		return { intent: 'removeSyllabus', success: true };
	},

	setSyllabusWeight: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const syllabusId = String(form.get('syllabusId') ?? '').trim();
		const weight = clampWeight(String(form.get('weight') ?? '1'));
		if (syllabusId === '') return fail(400, { intent: 'setSyllabusWeight', error: 'Missing syllabusId.' });
		try {
			await setGoalSyllabusWeight(event.params.id, user.id, syllabusId, weight);
		} catch (err) {
			if (err instanceof GoalNotFoundError || err instanceof GoalNotOwnedError) {
				throw error(404, 'Goal not found.');
			}
			throw err;
		}
		return { intent: 'setSyllabusWeight', success: true };
	},

	addNode: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const knowledgeNodeId = String(form.get('knowledgeNodeId') ?? '').trim();
		const notes = String(form.get('notes') ?? '');
		if (knowledgeNodeId === '') return fail(400, { intent: 'addNode', error: 'Pick a node.' });
		try {
			await addGoalNode(event.params.id, user.id, { knowledgeNodeId, weight: 1.0, notes });
		} catch (err) {
			if (err instanceof GoalNotFoundError || err instanceof GoalNotOwnedError) {
				throw error(404, 'Goal not found.');
			}
			throw err;
		}
		return { intent: 'addNode', success: true };
	},

	removeNode: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const knowledgeNodeId = String(form.get('knowledgeNodeId') ?? '').trim();
		if (knowledgeNodeId === '') return fail(400, { intent: 'removeNode', error: 'Missing knowledgeNodeId.' });
		try {
			await removeGoalNode(event.params.id, user.id, knowledgeNodeId);
		} catch (err) {
			if (err instanceof GoalNotFoundError || err instanceof GoalNotOwnedError) {
				throw error(404, 'Goal not found.');
			}
			throw err;
		}
		return { intent: 'removeNode', success: true };
	},

	setNodeWeight: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const knowledgeNodeId = String(form.get('knowledgeNodeId') ?? '').trim();
		const weight = clampWeight(String(form.get('weight') ?? '1'));
		if (knowledgeNodeId === '') return fail(400, { intent: 'setNodeWeight', error: 'Missing knowledgeNodeId.' });
		try {
			await setGoalNodeWeight(event.params.id, user.id, knowledgeNodeId, weight);
		} catch (err) {
			if (err instanceof GoalNotFoundError || err instanceof GoalNotOwnedError) {
				throw error(404, 'Goal not found.');
			}
			throw err;
		}
		return { intent: 'setNodeWeight', success: true };
	},
};
