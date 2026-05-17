/**
 * Study course step reader loader (course-reader-and-editor WP, Phase 4;
 * course-tree-arbitrary-depth WP, Phase D).
 *
 * Loads the course, the row at the given step code, the linked knowledge
 * node when the row is a leaf, the breadcrumb chain (course -> ancestors
 * -> current), and (when a goal with a syllabus is set) the overlay lens
 * result. The page renders one of two shapes:
 *
 *   - Leaf row (`is_leaf=true`, `level='step'`): renders the step framing
 *     + knowledge-node phases + (optional) encoded-text tab strip + cert
 *     overlay chip / gap list.
 *   - Non-leaf row (`level='section'` or `'lesson'`): renders a landing
 *     page composed of the row's `body_md` framing + a list of children.
 *
 * Prev/next computed from the course's depth-first leaf flatten. When no
 * overlay is active the loader skips the lens entirely and derives the
 * leaf list directly from the already-fetched step rows -- the lens pass
 * is reserved for the overlay path that genuinely needs `certGaps`.
 *
 * 404 conditions:
 *   - Course slug not found
 *   - Course `status === 'draft'` (centralised in getReaderVisibleCourseBySlug)
 *   - Step code not found in this course
 *
 * `renderMode` is a single discriminant the page reads instead of two
 * independent booleans -- encoded-text and transition rendering are
 * mutually exclusive treatments; transition wins when both apply.
 */

import { requireAuth } from '@ab/auth';
import { buildAncestorChain, computePrevNextLeaves, flattenLeafRowsDepthFirst, flattenLeavesDepthFirst } from '@ab/bc-study';
import {
	type CourseRow,
	type CourseStepRow,
	courseWithCertOverlayLens,
	getCourseStepByCode,
	getCourseStepsByCourse,
	getNodesByIds,
	getPrimaryGoal,
	getReaderVisibleCourseBySlug,
	type KnowledgeNodeRow,
	type LensResult,
	type PrevNextLeaf,
	pickOverlaySyllabus,
	splitContentPhases,
} from '@ab/bc-study/server';
import {
	type CourseStepLevel,
	KNOWLEDGE_NODE_KINDS,
	KNOWLEDGE_PHASE_ORDER,
	type KnowledgePhase,
	WX_DECODE_PRODUCT_SLUGS,
} from '@ab/constants';
import { db } from '@ab/db/connection';
import { stripMarkdown, truncatePlainText } from '@ab/utils';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** One ancestor link in the breadcrumb chain (course -> ... -> current). */
export interface BreadcrumbCrumb {
	/** Step code, used in the URL (`/courses/<slug>/<code>`). */
	code: string;
	/** Display title for this crumb. */
	title: string;
	/** Section / lesson / step. Section / lesson render as landing pages. */
	level: CourseStepLevel;
}

/** A child of a non-leaf row, displayed on the landing list. */
export interface LandingChild {
	id: string;
	code: string;
	title: string;
	level: CourseStepLevel;
	/** body_md truncated to ~200 plain-text chars (whole-word boundary). */
	bodyPreview: string;
}

/** Prev/next link data shipped to the client. */
export interface PrevNextLink {
	code: string;
	title: string;
}

/**
 * How the leaf body should render. Exclusive: a node that is both a
 * transition and an encoded-text slug renders the transition bridge only.
 */
export type StepRenderMode = 'transition' | 'encoded-text' | 'phases';

export interface CourseStepReaderData {
	course: CourseRow;
	/** The row at the URL's step code -- may be a section / lesson / leaf. */
	step: CourseStepRow;
	/** True when the row is a leaf (renders the knowledge-node phases). */
	isLeaf: boolean;
	/** The linked knowledge node, when authored. Null when the row is a
	 *  non-leaf interior OR when the leaf's `knowledgeNodeId` is null OR
	 *  the node row is missing. */
	node: KnowledgeNodeRow | null;
	/** Phases extracted from the linked node's `contentMd`, in canonical
	 *  order. Empty array when no node is linked. */
	phases: Array<{ phase: KnowledgePhase; body: string | null }>;
	/** Direct children of the current row, used by the landing UI. Empty
	 *  for leaves. */
	children: LandingChild[];
	/** Breadcrumb chain from the course root to (but not including) the
	 *  current row. Each crumb links to its landing URL. */
	breadcrumbs: BreadcrumbCrumb[];
	/** Previous leaf in document order, or null at the start of the course. */
	prev: PrevNextLink | null;
	/** Next leaf in document order, or null at the end of the course. */
	next: PrevNextLink | null;
	/** Overlay-scoped chip data: the cert leaf this step satisfies, when any. */
	certChip: { code: string } | null;
	/** Cert leaves under the overlay's syllabus that no step in this course
	 *  covers. Empty when no overlay or no gaps. */
	certGaps: LensResult['certGaps'];
	/** True when a syllabus is overlaid for this learner's goal. */
	overlayActive: boolean;
	/** Single discriminant for how the leaf body renders. */
	renderMode: StepRenderMode;
}

const BODY_PREVIEW_MAX = 200;

/**
 * Build a plain-text body preview: strip Markdown first (so the cut never
 * lands inside a `[link]` / `**bold**` token), then truncate on a code-point
 * boundary at a word break.
 */
function previewBody(body: string): string {
	return truncatePlainText(stripMarkdown(body), BODY_PREVIEW_MAX);
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const course = await getReaderVisibleCourseBySlug(event.params.slug);
	if (course === null) throw error(404, 'Course not found.');

	const step = await getCourseStepByCode(course.id, event.params.stepCode);
	if (step === null) throw error(404, 'Step not found.');
	// Read `is_leaf` directly from the row -- the canonical "study-able row"
	// filter that generalises across N-level trees.
	const isLeaf = step.isLeaf;

	const [primaryGoal, nodeRows, allSteps] = await Promise.all([
		getPrimaryGoal(user.id),
		isLeaf && step.knowledgeNodeId !== null ? getNodesByIds([step.knowledgeNodeId]) : Promise.resolve([]),
		getCourseStepsByCourse(course.id),
	]);
	const node = isLeaf ? (nodeRows[0] ?? null) : null;

	const overlaySyllabusId = await pickOverlaySyllabus(primaryGoal);
	// `pickOverlaySyllabus` returns null whenever `primaryGoal` is null, so a
	// non-null `overlaySyllabusId` already implies a non-null goal.
	const overlayActive = overlaySyllabusId !== null;

	let certGaps: LensResult['certGaps'] = [];
	let certChip: { code: string } | null = null;
	let leafList: PrevNextLeaf[];

	if (overlayActive && overlaySyllabusId !== null && primaryGoal !== null) {
		// Overlay path: the lens yields certChip / certGaps AND the leaf list
		// for prev/next in one pass.
		const lensResult = await courseWithCertOverlayLens(db, user.id, {
			goal: primaryGoal,
			filters: { courseId: course.id, syllabusId: overlaySyllabusId },
		});
		certGaps = lensResult.certGaps ?? [];
		const matchingLeaf = lensResult.leaves.find((leaf) => leaf.id === step.id);
		if (matchingLeaf?.sources?.inCert === true && matchingLeaf.sources.certCode !== undefined) {
			certChip = { code: matchingLeaf.sources.certCode };
		}
		leafList = flattenLeavesDepthFirst(lensResult.tree);
	} else {
		// No overlay: prev/next is pure tree topology. Derive the leaf list
		// from the already-fetched rows -- no second course-tree query, no
		// gap calculation the page would discard.
		leafList = flattenLeafRowsDepthFirst(
			allSteps.map((row) => ({
				id: row.id,
				parentId: row.parentId,
				ordinal: row.ordinal,
				title: row.title,
				isLeaf: row.isLeaf,
			})),
		);
	}

	// Hoist the split: `splitContentPhases` parses the whole node body once,
	// then the map reads from the cached result rather than re-parsing per
	// phase.
	const phaseSplit = node !== null ? splitContentPhases(node.contentMd ?? '') : null;
	const phases =
		phaseSplit !== null
			? KNOWLEDGE_PHASE_ORDER.map((phase) => ({ phase, body: phaseSplit[phase] ?? null }))
			: [];

	// Direct children of the current row (sorted by ordinal). Only populated
	// for non-leaf rows; leaves have no children at the schema level.
	const children: LandingChild[] = [];
	if (!isLeaf) {
		const childRows = allSteps.filter((row) => row.parentId === step.id).sort((a, b) => a.ordinal - b.ordinal);
		for (const child of childRows) {
			children.push({
				id: child.id,
				code: child.code,
				title: child.title,
				level: child.level as CourseStepLevel,
				bodyPreview: previewBody(child.bodyMd),
			});
		}
	}

	// Breadcrumbs via the shared BC tree-walk helper.
	const ancestorChain = buildAncestorChain(
		step.id,
		allSteps.map((row) => ({ id: row.id, parentId: row.parentId, code: row.code, title: row.title, level: row.level })),
	);
	const breadcrumbs: BreadcrumbCrumb[] = ancestorChain.map((c) => ({
		code: c.code,
		title: c.title,
		level: c.level as CourseStepLevel,
	}));

	// Prev/next: map the lens-pure result back onto course-step codes.
	const codeById = new Map<string, string>();
	for (const row of allSteps) codeById.set(row.id, row.code);
	const prevNext = computePrevNextLeaves(
		step.id,
		allSteps.map((row) => ({ id: row.id, parentId: row.parentId })),
		leafList,
	);
	const toLink = (leaf: { id: string; title: string } | null): PrevNextLink | null => {
		if (leaf === null) return null;
		const code = codeById.get(leaf.id);
		if (code === undefined) return null;
		return { code, title: leaf.title };
	};
	const prev = toLink(prevNext.prev);
	const next = toLink(prevNext.next);

	// `knowledge_node.id` is the kebab-case slug (the table's primary key is
	// the author-assigned slug). Compare against the constant array directly.
	const isEncodedText = node !== null && (WX_DECODE_PRODUCT_SLUGS as readonly string[]).includes(node.id);
	const isTransition = node !== null && node.kind === KNOWLEDGE_NODE_KINDS.TRANSITION;
	// Exclusive: a node that is both a transition and an encoded-text slug
	// renders the transition bridge only -- the two are incoherent together.
	const renderMode: StepRenderMode = isTransition ? 'transition' : isEncodedText ? 'encoded-text' : 'phases';

	return {
		course,
		step,
		isLeaf,
		node,
		phases,
		children,
		breadcrumbs,
		prev,
		next,
		certChip,
		certGaps,
		overlayActive,
		renderMode,
	} satisfies CourseStepReaderData;
};
