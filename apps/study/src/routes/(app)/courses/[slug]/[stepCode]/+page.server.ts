/**
 * Study course step reader loader (course-reader-and-editor WP, Phase 4).
 *
 * Loads the course, the step, the linked knowledge node, and (when a goal
 * with a syllabus is set) the overlay lens result. The page below it is
 * three vertical sections per spec.md "Step reader":
 *
 *   1. Step framing: title + breadcrumb + step body_md
 *   2. KnowledgeNodeBody: the 7-phase node renderer (or transition body
 *      when `node.kind === 'transition'`)
 *   3. Cert overlay surface: chip strip + section-scoped gap list (only
 *      when overlay is active for this course)
 *
 * 404 conditions:
 *   - Course slug not found
 *   - Course `status === 'draft'`
 *   - Step code not found in this course
 *   - Step row carries `level !== 'step'` (a section URL hits this and 404s
 *     -- sections are not directly readable)
 *
 * Encoded-text family detection: when the linked node's slug appears in
 * `WX_DECODE_PRODUCT_SLUGS`, the loader sets `isEncodedText: true` so the
 * page renders the Decode/Understand/Triage tab strip above the body.
 *
 * Transition detection: when the linked node's `kind === 'transition'`,
 * the loader sets `isTransition: true` so the page renders the bridge-
 * styled body instead of the 7-phase scaffold.
 */

import { requireAuth } from '@ab/auth';
import {
	type CourseRow,
	type CourseStepRow,
	courseWithCertOverlayLens,
	getCourseBySlug,
	getCourseStepByCode,
	getNodesByIds,
	getPrimaryGoal,
	type KnowledgeNodeRow,
	type LensLeaf,
	type LensResult,
	pickOverlaySyllabus,
	splitContentPhases,
} from '@ab/bc-study/server';
import {
	COURSE_STATUSES,
	COURSE_STEP_LEVELS,
	KNOWLEDGE_NODE_KINDS,
	KNOWLEDGE_PHASE_ORDER,
	type KnowledgePhase,
	WX_DECODE_PRODUCT_SLUGS,
} from '@ab/constants';
import { db } from '@ab/db/connection';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export interface CourseStepReaderData {
	course: CourseRow;
	/** The step row -- title, body_md, knowledgeNodeId, etc. */
	step: CourseStepRow;
	/** The linked knowledge node, when authored. Null when the step's
	 *  `knowledgeNodeId` is null OR the node row is missing. */
	node: KnowledgeNodeRow | null;
	/** Phases extracted from the linked node's `contentMd`, in canonical
	 *  order. Empty array when no node is linked. */
	phases: Array<{ phase: KnowledgePhase; body: string | null }>;
	/** Overlay-scoped chip data: the cert leaf this step satisfies, when any. */
	certChip: { code: string } | null;
	/** Cert leaves under the overlay's syllabus that no step in this course
	 *  covers. Empty when no overlay or no gaps. */
	certGaps: LensResult['certGaps'];
	/** True when a syllabus is overlaid for this learner's goal. Drives the
	 *  cert chip + gaps panel rendering. */
	overlayActive: boolean;
	/** True when the linked node's slug matches `WX_DECODE_PRODUCT_SLUGS`. */
	isEncodedText: boolean;
	/** True when the linked node's `kind === 'transition'`. */
	isTransition: boolean;
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const course = await getCourseBySlug(event.params.slug);
	if (course === null) throw error(404, 'Course not found.');
	if (course.status === COURSE_STATUSES.DRAFT) throw error(404, 'Course not found.');

	const step = await getCourseStepByCode(course.id, event.params.stepCode);
	if (step === null) throw error(404, 'Step not found.');
	if (step.level !== COURSE_STEP_LEVELS.STEP) throw error(404, 'Step not found.');

	const [primaryGoal, nodeRows] = await Promise.all([
		getPrimaryGoal(user.id),
		step.knowledgeNodeId !== null ? getNodesByIds([step.knowledgeNodeId]) : Promise.resolve([]),
	]);
	const node = nodeRows[0] ?? null;

	const overlaySyllabusId = await pickOverlaySyllabus(primaryGoal);
	const overlayActive = overlaySyllabusId !== null && primaryGoal !== null;

	let certGaps: LensResult['certGaps'] = [];
	let certChip: { code: string } | null = null;
	if (overlayActive && overlaySyllabusId !== null && primaryGoal !== null) {
		const lensResult = await courseWithCertOverlayLens(db, user.id, {
			goal: primaryGoal,
			filters: { courseId: course.id, syllabusId: overlaySyllabusId },
		});
		certGaps = lensResult.certGaps ?? [];

		// Find the leaf for this step in the lens result; pull its certCode.
		const matchingLeaf = lensResult.leaves.find((leaf: LensLeaf) => leaf.id === step.id);
		if (matchingLeaf?.sources?.inCert === true && matchingLeaf.sources.certCode !== undefined) {
			certChip = { code: matchingLeaf.sources.certCode };
		}
	}

	const phases =
		node !== null
			? KNOWLEDGE_PHASE_ORDER.map((phase) => ({
					phase,
					body: splitContentPhases(node.contentMd ?? '')[phase] ?? null,
				}))
			: [];

	// `knowledge_node.id` is the kebab-case slug (the table's primary key
	// is the author-assigned slug per schema.ts). Compare against the
	// constant array directly.
	const isEncodedText = node !== null && (WX_DECODE_PRODUCT_SLUGS as readonly string[]).includes(node.id);
	const isTransition = node !== null && node.kind === KNOWLEDGE_NODE_KINDS.TRANSITION;

	return {
		course,
		step,
		node,
		phases,
		certChip,
		certGaps,
		overlayActive,
		isEncodedText,
		isTransition,
	} satisfies CourseStepReaderData;
};
