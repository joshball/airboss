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
 *     overlay chip / gap list -- the legacy 7-phase reader, unchanged.
 *   - Non-leaf row (`level='section'` or `'lesson'`): renders a landing
 *     page composed of the row's `body_md` framing + a list of children
 *     (title + level badge + truncated body + link).
 *
 * Prev/next computed from the course's depth-first leaf flatten
 * (`flattenLeavesDepthFirst`). For a leaf row, prev/next are the adjacent
 * leaves. For a non-leaf row, "next" is the first-leaf-descendant of the
 * subtree; "prev" is the leaf immediately preceding that first descendant
 * in the flat list.
 *
 * 404 conditions:
 *   - Course slug not found
 *   - Course `status === 'draft'`
 *   - Step code not found in this course
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
import { flattenLeavesDepthFirst } from '@ab/bc-study';
import {
	type CourseRow,
	type CourseStepRow,
	courseLens,
	courseWithCertOverlayLens,
	getCourseBySlug,
	getCourseStepByCode,
	getCourseStepsByCourse,
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
	type CourseStepLevel,
	KNOWLEDGE_NODE_KINDS,
	KNOWLEDGE_PHASE_ORDER,
	type KnowledgePhase,
	WX_DECODE_PRODUCT_SLUGS,
} from '@ab/constants';
import { db } from '@ab/db/connection';
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
	/** body_md truncated to ~200 chars (whole-word boundary). */
	bodyPreview: string;
}

/** Prev/next link data shipped to the client. */
export interface PrevNextLink {
	code: string;
	title: string;
}

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
	/** True when a syllabus is overlaid for this learner's goal. Drives the
	 *  cert chip + gaps panel rendering. */
	overlayActive: boolean;
	/** True when the linked node's slug matches `WX_DECODE_PRODUCT_SLUGS`. */
	isEncodedText: boolean;
	/** True when the linked node's `kind === 'transition'`. */
	isTransition: boolean;
}

const BODY_PREVIEW_MAX = 200;

/**
 * Truncate a body_md preview to ~200 chars, breaking at a word boundary
 * when the cut falls inside a word. Strips leading whitespace. Returns
 * the original string when it's already <= the cap.
 */
function previewBody(body: string): string {
	const trimmed = body.trim();
	if (trimmed.length <= BODY_PREVIEW_MAX) return trimmed;
	const slice = trimmed.slice(0, BODY_PREVIEW_MAX);
	const lastSpace = slice.lastIndexOf(' ');
	const head = lastSpace > BODY_PREVIEW_MAX / 2 ? slice.slice(0, lastSpace) : slice;
	return `${head.trimEnd()}...`;
}

/**
 * Walk the parent chain from `row` upward and return an ordered list of
 * ancestors (root-first, NOT including `row` itself). Cap iterations at
 * the row count as a defensive cycle guard.
 */
function buildBreadcrumbs(row: CourseStepRow, rowById: Map<string, CourseStepRow>): BreadcrumbCrumb[] {
	const chain: BreadcrumbCrumb[] = [];
	let parentId = row.parentId;
	const safety = rowById.size;
	for (let i = 0; i < safety && parentId !== null; i += 1) {
		const ancestor = rowById.get(parentId);
		if (ancestor === undefined) break;
		chain.push({ code: ancestor.code, title: ancestor.title, level: ancestor.level as CourseStepLevel });
		parentId = ancestor.parentId;
	}
	chain.reverse();
	return chain;
}

/**
 * Compute prev/next leaf links for the current row. For leaf rows, the
 * current row's id is the lookup key; for non-leaf rows, find the first
 * leaf descendant of the subtree as the "current position" -- "next" then
 * points at that first descendant and "prev" at the leaf preceding it.
 *
 * Returns `{ prev: null, next: null }` when the leaf list is empty.
 */
function computePrevNext(
	current: CourseStepRow,
	rowById: Map<string, CourseStepRow>,
	leaves: ReadonlyArray<LensLeaf>,
): { prev: PrevNextLink | null; next: PrevNextLink | null } {
	if (leaves.length === 0) return { prev: null, next: null };

	let positionIndex = leaves.findIndex((leaf) => leaf.id === current.id);
	let currentIsLeaf = positionIndex !== -1;

	if (!currentIsLeaf) {
		// Non-leaf: find the first leaf descendant of `current`. Build a
		// descendant-id set by walking children from the row map.
		const descendantIds = new Set<string>();
		const queue: string[] = [current.id];
		const safety = rowById.size;
		for (let visited = 0; visited < safety && queue.length > 0; visited += 1) {
			const id = queue.shift();
			if (id === undefined) break;
			descendantIds.add(id);
			for (const row of rowById.values()) {
				if (row.parentId === id) queue.push(row.id);
			}
		}
		// First leaf descendant in document order = first leaf in `leaves`
		// whose id is in the descendant set. For "next" we use that leaf; for
		// "prev" we use the leaf at (firstDescendantIndex - 1).
		positionIndex = leaves.findIndex((leaf) => descendantIds.has(leaf.id));
		if (positionIndex === -1) {
			// Subtree contains no leaves (defensive -- seed validator rejects
			// this, but it can happen during a partial seed mid-edit).
			return { prev: null, next: null };
		}
		// For non-leaf, the "current" leaf is the first descendant; "next"
		// IS that descendant (clicking next on a lesson landing enters the
		// lesson's first leaf). "prev" is the leaf BEFORE the first
		// descendant.
		const next = leaves[positionIndex];
		const prev = positionIndex > 0 ? leaves[positionIndex - 1] : null;
		const nextRow = rowById.get(next.id);
		const prevRow = prev !== null ? rowById.get(prev.id) : null;
		return {
			prev:
				prevRow !== undefined && prevRow !== null ? { code: prevRow.code, title: prev?.title ?? prevRow.title } : null,
			next: nextRow !== undefined ? { code: nextRow.code, title: next.title } : null,
		};
	}

	// Leaf: prev/next are the adjacent leaves in document order.
	const prevLeaf = positionIndex > 0 ? leaves[positionIndex - 1] : null;
	const nextLeaf = positionIndex < leaves.length - 1 ? leaves[positionIndex + 1] : null;
	const prevRow = prevLeaf !== null ? (rowById.get(prevLeaf.id) ?? null) : null;
	const nextRow = nextLeaf !== null ? (rowById.get(nextLeaf.id) ?? null) : null;
	return {
		prev: prevLeaf !== null && prevRow !== null ? { code: prevRow.code, title: prevLeaf.title } : null,
		next: nextLeaf !== null && nextRow !== null ? { code: nextRow.code, title: nextLeaf.title } : null,
	};
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const course = await getCourseBySlug(event.params.slug);
	if (course === null) throw error(404, 'Course not found.');
	if (course.status === COURSE_STATUSES.DRAFT) throw error(404, 'Course not found.');

	const step = await getCourseStepByCode(course.id, event.params.stepCode);
	if (step === null) throw error(404, 'Step not found.');
	const isLeaf = step.level === COURSE_STEP_LEVELS.STEP;

	const [primaryGoal, nodeRows, allSteps] = await Promise.all([
		getPrimaryGoal(user.id),
		isLeaf && step.knowledgeNodeId !== null ? getNodesByIds([step.knowledgeNodeId]) : Promise.resolve([]),
		getCourseStepsByCourse(course.id),
	]);
	const node = isLeaf ? (nodeRows[0] ?? null) : null;

	const overlaySyllabusId = await pickOverlaySyllabus(primaryGoal);
	const overlayActive = overlaySyllabusId !== null && primaryGoal !== null;

	let certGaps: LensResult['certGaps'] = [];
	let certChip: { code: string } | null = null;
	// Run a lens pass to get the flattened leaf list for prev/next. Use the
	// overlay lens when an overlay is active (it also yields certChip /
	// certGaps in the same call); otherwise the cheaper plain course lens.
	const lensResult: LensResult =
		overlayActive && overlaySyllabusId !== null && primaryGoal !== null
			? await courseWithCertOverlayLens(db, user.id, {
					goal: primaryGoal,
					filters: { courseId: course.id, syllabusId: overlaySyllabusId },
				})
			: await courseLens(db, user.id, {
					goal: primaryGoal,
					filters: { courseId: course.id },
				});

	if (overlayActive) {
		certGaps = lensResult.certGaps ?? [];
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

	// Build helpers off the full step list.
	const rowById = new Map<string, CourseStepRow>();
	for (const row of allSteps) rowById.set(row.id, row);

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

	const breadcrumbs = buildBreadcrumbs(step, rowById);
	const leafList = flattenLeavesDepthFirst(lensResult.tree);
	const { prev, next } = computePrevNext(step, rowById, leafList);

	// `knowledge_node.id` is the kebab-case slug (the table's primary key
	// is the author-assigned slug per schema.ts). Compare against the
	// constant array directly.
	const isEncodedText = node !== null && (WX_DECODE_PRODUCT_SLUGS as readonly string[]).includes(node.id);
	const isTransition = node !== null && node.kind === KNOWLEDGE_NODE_KINDS.TRANSITION;

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
		isEncodedText,
		isTransition,
	} satisfies CourseStepReaderData;
};
