import { requireAuth } from '@ab/auth';
import {
	addGoalCourse,
	addGoalNode,
	addGoalSyllabus,
	archiveGoal,
	type CourseRow,
	type GoalCourseRow,
	type GoalNodeRow,
	GoalNotFoundError,
	GoalNotOwnedError,
	type GoalRow,
	type GoalSyllabusRow,
	getCourseById,
	getCredentialSyllabi,
	getGoalCourses,
	getGoalNodes,
	getGoalSyllabi,
	getOwnedGoal,
	goalHasCourse,
	listAllCourses,
	listCredentials,
	listNodesWithFacets,
	removeGoalCourse,
	removeGoalNode,
	removeGoalSyllabus,
	type SyllabusRow,
	setGoalCourseWeight,
	setGoalNodeWeight,
	setGoalSyllabusWeight,
	setPrimaryGoal,
	updateGoal,
} from '@ab/bc-study/server';
import {
	COURSE_STATUSES,
	CREDENTIAL_STATUSES,
	GOAL_NOTES_MAX_LENGTH,
	GOAL_STATUS_VALUES,
	GOAL_SYLLABUS_WEIGHT_MAX,
	GOAL_SYLLABUS_WEIGHT_MIN,
	GOAL_TITLE_MAX_LENGTH,
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

export interface CourseOption {
	id: string;
	slug: string;
	title: string;
}

export interface GoalDetailData {
	goal: GoalRow;
	syllabi: GoalSyllabusRow[];
	syllabusTitleById: Record<string, string>;
	nodes: GoalNodeRow[];
	availableSyllabi: SyllabusOption[];
	availableNodes: Array<{ id: string; title: string; domain: string }>;
	courses: GoalCourseRow[];
	courseTitleById: Record<string, string>;
	courseSlugById: Record<string, string>;
	availableCourses: CourseOption[];
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const { id } = event.params;

	let goal: GoalRow;
	try {
		goal = await getOwnedGoal(id, user.id);
	} catch (err) {
		if (err instanceof GoalNotFoundError || err instanceof GoalNotOwnedError) {
			throw error(404, 'Goal not found.');
		}
		throw err;
	}

	const [syllabi, nodes, goalCourses, allCourses] = await Promise.all([
		getGoalSyllabi(goal.id),
		getGoalNodes(goal.id),
		getGoalCourses(goal.id),
		listAllCourses(),
	]);

	// Build available-syllabi list -- every credential's primary syllabus,
	// minus those already on the goal. Parallelize the per-credential reads
	// instead of awaiting each in sequence -- closes the chunk-1 perf MAJOR /
	// backend MAJOR sequential `for...of await` N+1 (review-tail-2026-05).
	const credentials = await listCredentials({ status: CREDENTIAL_STATUSES.ACTIVE });
	const availableSyllabi: SyllabusOption[] = [];
	const presentSyllabusIds = new Set(syllabi.map((s) => s.syllabusId));
	const allSyllabusRows: SyllabusRow[] = [];
	const perCredSyllabi = await Promise.all(
		credentials.map(async (cred) => ({
			cred,
			items: await getCredentialSyllabi(cred.id, { primacy: SYLLABUS_PRIMACY.PRIMARY }),
		})),
	);
	for (const { cred, items } of perCredSyllabi) {
		for (const item of items) {
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

	// Course composition (course-reader-and-editor WP, Phase 5).
	// `goalCourses` carries the link rows (with weight). `availableCourses`
	// is the picker list -- every active course not already in the goal.
	// Drafts are excluded from the picker (matches the goal_syllabus tab's
	// "active credentials only" filter); archived courses also excluded so
	// the user only NEW-adds active courses (per spec.md edge cases).
	const goalCourseIds = new Set(goalCourses.map((gc) => gc.courseId));
	const courseTitleById: Record<string, string> = {};
	const courseSlugById: Record<string, string> = {};
	for (const c of allCourses) {
		courseTitleById[c.id] = c.title;
		courseSlugById[c.id] = c.slug;
	}
	const availableCourses: CourseOption[] = allCourses
		.filter((c) => c.status === COURSE_STATUSES.ACTIVE && !goalCourseIds.has(c.id))
		.map((c) => ({ id: c.id, slug: c.slug, title: c.title }));

	return {
		goal,
		syllabi,
		syllabusTitleById,
		nodes,
		availableSyllabi,
		availableNodes,
		courses: goalCourses,
		courseTitleById,
		courseSlugById,
		availableCourses,
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
		if (title.length > GOAL_TITLE_MAX_LENGTH) {
			return fail(400, {
				intent: 'update',
				error: `Title must be ${GOAL_TITLE_MAX_LENGTH} characters or fewer.`,
			});
		}
		if (notesMd.length > GOAL_NOTES_MAX_LENGTH) {
			return fail(400, {
				intent: 'update',
				error: `Notes must be ${GOAL_NOTES_MAX_LENGTH} characters or fewer.`,
			});
		}
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
		throw redirect(303, ROUTES.PROGRAM_GOAL(event.params.id));
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
		throw redirect(303, ROUTES.PROGRAM_GOALS);
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

	// Course composition (course-reader-and-editor WP, Phase 5).
	// Mirrors the addSyllabus / removeSyllabus / setSyllabusWeight shape
	// line-for-line. Ownership is enforced via `getOwnedGoal` before any
	// `goal_course` mutation.

	addCourse: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const courseId = String(form.get('courseId') ?? '').trim();
		if (courseId === '') return fail(400, { intent: 'addCourse', error: 'Pick a course.' });
		let goal: GoalRow;
		try {
			goal = await getOwnedGoal(event.params.id, user.id);
		} catch (err) {
			if (err instanceof GoalNotFoundError || err instanceof GoalNotOwnedError) {
				throw error(404, 'Goal not found.');
			}
			throw err;
		}
		const targetCourse: CourseRow | null = await getCourseById(courseId);
		if (targetCourse === null) {
			return fail(400, { intent: 'addCourse', error: 'Course not found.' });
		}
		if (targetCourse.status !== COURSE_STATUSES.ACTIVE) {
			return fail(400, { intent: 'addCourse', error: 'Course is not active.' });
		}
		if (await goalHasCourse(goal.id, courseId)) {
			return fail(400, { intent: 'addCourse', error: 'Course already in goal.' });
		}
		await addGoalCourse(goal.id, courseId, 1.0);
		return { intent: 'addCourse', success: true };
	},

	removeCourse: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const courseId = String(form.get('courseId') ?? '').trim();
		if (courseId === '') return fail(400, { intent: 'removeCourse', error: 'Missing courseId.' });
		let goal: GoalRow;
		try {
			goal = await getOwnedGoal(event.params.id, user.id);
		} catch (err) {
			if (err instanceof GoalNotFoundError || err instanceof GoalNotOwnedError) {
				throw error(404, 'Goal not found.');
			}
			throw err;
		}
		await removeGoalCourse(goal.id, courseId);
		return { intent: 'removeCourse', success: true };
	},

	setCourseWeight: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const courseId = String(form.get('courseId') ?? '').trim();
		const weight = clampWeight(String(form.get('weight') ?? '1'));
		if (courseId === '') return fail(400, { intent: 'setCourseWeight', error: 'Missing courseId.' });
		let goal: GoalRow;
		try {
			goal = await getOwnedGoal(event.params.id, user.id);
		} catch (err) {
			if (err instanceof GoalNotFoundError || err instanceof GoalNotOwnedError) {
				throw error(404, 'Goal not found.');
			}
			throw err;
		}
		if (!(await goalHasCourse(goal.id, courseId))) {
			return fail(400, { intent: 'setCourseWeight', error: 'Course is not in this goal.' });
		}
		await setGoalCourseWeight(goal.id, courseId, weight);
		return { intent: 'setCourseWeight', success: true };
	},
};
