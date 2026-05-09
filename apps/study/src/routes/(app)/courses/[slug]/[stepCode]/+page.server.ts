import { requireAuth } from '@ab/auth';
import {
	courseWithCertOverlayLens,
	getCourseBySlug,
	getCourseStepByCode,
	getCourseStepsByCourse,
	getNodeView,
	getPrimaryGoal,
	pickOverlaySyllabus,
	splitContentPhases,
} from '@ab/bc-study/server';
import {
	COURSE_STATUSES,
	COURSE_STEP_LEVELS,
	type CourseStatus,
	KNOWLEDGE_NODE_KINDS,
	KNOWLEDGE_PHASE_ORDER,
	type KnowledgePhase,
	WX_DECODE_PRODUCT_SLUGS,
} from '@ab/constants';
import { db } from '@ab/db/connection';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

interface PhaseEntry {
	phase: KnowledgePhase;
	body: string | null;
}

/**
 * `/courses/[slug]/[stepCode]` step reader loader.
 *
 * Resolves: course (404 on missing/draft), step row by code (404 on missing
 * or non-step level), linked knowledge node (may be null when the YAML
 * authored a section row only -- but the schema CHECK forbids that for
 * step rows, so we expect non-null in practice). Picks the cert overlay
 * syllabus the same way the detail page does and runs the overlay lens
 * to surface the per-step cert chips.
 */
export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const { slug, stepCode } = event.params;

	const course = await getCourseBySlug(slug);
	if (!course || (course.status as CourseStatus) === COURSE_STATUSES.DRAFT) {
		error(404, `Course not found: ${slug}`);
	}

	const step = await getCourseStepByCode(course.id, stepCode);
	if (!step || step.level !== COURSE_STEP_LEVELS.STEP) {
		error(404, `Step not found: ${stepCode}`);
	}

	const [allSteps, primaryGoal] = await Promise.all([getCourseStepsByCourse(course.id), getPrimaryGoal(user.id)]);

	// Resolve breadcrumb: find the step's parent section.
	const parentSection = step.parentId !== null ? allSteps.find((s) => s.id === step.parentId) : null;

	// Resolve linked node + 7-phase body. Steps must reference a node per the
	// DB consistency CHECK; the page falls back gracefully if somehow null.
	const nodeView = step.knowledgeNodeId !== null ? await getNodeView(step.knowledgeNodeId, user.id) : null;
	const phases: PhaseEntry[] = nodeView
		? KNOWLEDGE_PHASE_ORDER.map((phase) => ({
				phase,
				body: splitContentPhases(nodeView.node.contentMd)[phase] ?? null,
			}))
		: [];

	// Cert overlay -- only run when the learner's goal pins at least one
	// syllabus. The lens runs for the whole course; the page filters it
	// down to the current step's chips by leaf id.
	const overlaySyllabusId = await pickOverlaySyllabus(primaryGoal);
	const lensResult =
		overlaySyllabusId !== null
			? await courseWithCertOverlayLens(db, user.id, {
					goal: primaryGoal,
					filters: { courseId: course.id, syllabusId: overlaySyllabusId },
				})
			: null;
	const stepLeaf = lensResult?.leaves.find((l) => l.id === step.id) ?? null;

	const nodeSlug = nodeView?.node.id ?? '';
	const isEncodedText = nodeSlug !== '' && (WX_DECODE_PRODUCT_SLUGS as readonly string[]).includes(nodeSlug);
	const isTransition = nodeView?.node.kind === KNOWLEDGE_NODE_KINDS.TRANSITION;

	// Chart stub mount: the spec ships ?chart=<slug> as the embedding
	// mechanism for this WP (the real markdown directive parser is out of
	// scope per OUT-OF-SCOPE.md). Surface the slug so the page can mount
	// the placeholder component below the body.
	const chartSlug = event.url.searchParams.get('chart');

	return {
		course: {
			id: course.id,
			slug: course.slug,
			title: course.title,
		},
		step: {
			id: step.id,
			code: step.code,
			title: step.title,
			bodyMd: step.bodyMd,
			level: step.level,
			knowledgeNodeId: step.knowledgeNodeId,
		},
		parentSection: parentSection
			? { id: parentSection.id, code: parentSection.code, title: parentSection.title }
			: null,
		node: nodeView
			? {
					id: nodeView.node.id,
					title: nodeView.node.title,
					kind: nodeView.node.kind,
					lifecycle: nodeView.node.lifecycle,
					masteryCriteria: nodeView.node.masteryCriteria,
				}
			: null,
		phases,
		stepLeaf,
		overlayActive: overlaySyllabusId !== null,
		isEncodedText,
		isTransition,
		chartSlug,
	};
};
