/**
 * Course-aware lens implementations (course-primitive WP, Phase 4+).
 *
 * Phase 4 shipped `courseLens` as a 2-level (section -> step) projection.
 * Phase C of course-tree-arbitrary-depth generalises the lens to walk an
 * N-level tree (`section -> lesson -> ... -> step`) via the `buildSubtree`
 * recursion. The 2-level case is the trivial recursion bottom: when no
 * `lesson` rows exist every section's children are leaves and the emitted
 * shape is byte-identical to the pre-WP output.
 *
 * The Lens contract from `./lenses` carries:
 *   - `goal: GoalRow | null` -- when null we still emit the tree shape so an
 *     anonymous browse can render the course outline; per-leaf mastery
 *     collapses to the empty state.
 *   - `filters.courseId` -- which course to render (one root per call).
 *
 * Per-step mastery flows through `getNodeEvidenceStateMap` -- the same
 * machinery the Domain lens uses for non-syllabus leaves (a course step
 * points at one knowledge node; the per-node evidence state is decoded the
 * same way the Domain lens decodes a domain leaf).
 *
 * Per-step weight is `goal_course.weight * 1.0`. The per-step weight is not
 * yet authored on `course_step` (deferred per the spec's Out-of-scope
 * section); when product reaches for it the multiplier slides in here.
 *
 * See:
 *   - docs/work-packages/course-primitive/spec.md           -- Lens behavior
 *   - docs/work-packages/course-tree-arbitrary-depth/design.md -- recursive algorithm
 *   - libs/bc/study/src/lenses.ts                           -- Lens framework + acsLens/domainLens
 *   - libs/bc/study/src/courses.ts                          -- getCourseStepsByCourse
 */

import {
	ASSESSMENT_METHOD_VALUES,
	type AssessmentMethod,
	COURSE_STEP_LEVELS,
	NODE_MASTERY_GATES,
	SYLLABUS_NODE_LEVELS,
} from '@ab/constants';
import { and, eq, inArray } from 'drizzle-orm';
import { getCourseGaps, getCourseStepsByCourse } from './courses';
import {
	type CertGap,
	computeMasteryRollup,
	type Lens,
	type LensLeaf,
	type LensLeafMastery,
	type LensLeafSources,
	type LensTreeNode,
	type MasteryRollup,
} from './lenses';
import { type GateState, getNodeEvidenceStateMap, type NodeEvidenceState } from './mastery';
import type { CourseStepRow } from './schema';
import { course, goalCourse, syllabusNode, syllabusNodeLink } from './schema';

// ---------------------------------------------------------------------------
// Course lens
// ---------------------------------------------------------------------------

export interface CourseLensFilters {
	/** Required: the course id to project. The lens emits one root per call. */
	courseId: string;
}

/**
 * Course lens. Walks the course identified by `filters.courseId` and emits
 * an N-level nested tree:
 *
 *     course (root LensTreeNode, level='course')
 *       section (level='section')
 *         [lesson (level='lesson')]*    interior, may nest further
 *           step leaf (LensLeaf, knowledgeNodeId = course_step.knowledge_node_id)
 *
 * The shape is recursive (`buildSubtree`): a non-leaf row's children are
 * partitioned into interior subtrees (placed on `children`) and direct leaf
 * rows (placed on `leaves`). The 2-level shape (no `lesson` rows) is the
 * trivial recursion bottom and produces output byte-identical to the
 * pre-WP lens.
 *
 * Per-step mastery is computed via `getNodeEvidenceStateMap` -- the same
 * any-evidence-passes semantic the Domain lens uses for non-syllabus leaves
 * (course steps live outside the FAA triad). Each step's effective weight is
 * `goal_course.weight * 1.0`; the per-interior + course rollups aggregate
 * the weighted leaves via `computeMasteryRollup`.
 *
 * Empty / browse paths:
 *   - `input.goal === null` -> emit the tree (no DB-backed goal context) with
 *     empty mastery on every leaf and `goal_course.weight = 1.0`.
 *   - Goal is set but holds no `goal_course` row for the requested course ->
 *     return the empty result (matches `acsLens` semantic when the goal has
 *     no syllabi attached).
 *   - Course id is missing or has zero steps -> return the empty result.
 *
 * Filter contract: `filters.courseId` is required. The lens does not infer
 * a course from the goal because a goal can hold many courses; the caller
 * (a route loader, a dashboard widget) picks one and passes it.
 */
export const courseLens: Lens<CourseLensFilters> = async (db, userId, input) => {
	const courseId = input.filters?.courseId;
	if (courseId === undefined || courseId === '') {
		return { tree: [], rollup: emptyRollup(), leaves: [] };
	}

	// Goal weight resolution. When the goal is null (anonymous browse) the
	// lens emits the course outline with weight=1.0 and empty per-step mastery.
	// When the goal is set we look up the matching `goal_course` row -- if no
	// row exists the goal does not consume this course, so we emit the empty
	// result (matches `acsLens`'s "goal has no syllabi" path).
	//
	// One targeted query: composite PK on (goal_id, course_id) -> at most one
	// row. Absent row means the goal does not reference this course and the
	// lens returns the empty result.
	let goalWeight = 1.0;
	if (input.goal !== null) {
		const linkRows = await db
			.select({ weight: goalCourse.weight })
			.from(goalCourse)
			.where(and(eq(goalCourse.goalId, input.goal.id), eq(goalCourse.courseId, courseId)))
			.limit(1);
		const link = linkRows[0];
		if (link === undefined) {
			return { tree: [], rollup: emptyRollup(), leaves: [] };
		}
		goalWeight = link.weight;
	}

	// Resolve the course row (display title) and the full step tree. Both are
	// scoped to the requested course id; the BC's `getCourseStepsByCourse`
	// returns rows in tree-walk order (sections / lessons before their
	// children, ordinal asc).
	const courseRows = await db.select().from(course).where(eq(course.id, courseId)).limit(1);
	const courseRow = courseRows[0];
	if (courseRow === undefined) {
		return { tree: [], rollup: emptyRollup(), leaves: [] };
	}
	const steps = await getCourseStepsByCourse(courseId, db);
	if (steps.length === 0) {
		// Course exists but has no sections / steps yet (draft authoring
		// state). Emit the course root with empty children + zero rollup so
		// callers can render "course outline coming soon."
		const root: LensTreeNode = {
			id: courseRow.id,
			level: 'course',
			title: courseRow.title,
			rollup: emptyRollup(),
			children: [],
		};
		return { tree: [root], rollup: emptyRollup(), leaves: [] };
	}

	// Group every row by parent_id once; the recursion below reads from this
	// map without a second sweep of the row list. Sections live under `null`;
	// every other row lives under its parent's id.
	const childrenByParent = groupRowsByParent(steps);

	// Per-step mastery: collect every linked knowledge node id, batch the
	// per-(user, node) evidence lookup, then decode each leaf inside the
	// recursive walk.
	const allNodeIds = steps
		.filter((s) => s.knowledgeNodeId !== null)
		.map((s) => s.knowledgeNodeId)
		.filter((id): id is string => id !== null);
	const evidenceByNode =
		input.goal !== null && allNodeIds.length > 0
			? await getNodeEvidenceStateMap(userId, allNodeIds, db)
			: new Map<string, NodeEvidenceState>();

	const allLensLeaves: LensLeaf[] = [];
	const courseRollupBuckets: Array<{ mastery: LensLeafMastery; weight: number }> = [];
	const buildLeaf = makeBuildLeaf(evidenceByNode);

	// Recurse from every section row. The course root is built outside the
	// recursion because it is a `course` row, not a `course_step` row, and
	// its display title comes from the `course` table.
	const sectionRows = childrenByParent.get(null) ?? [];
	const topLevelSubtrees: LensTreeNode[] = sectionRows.map((row) =>
		buildSubtree(row, childrenByParent, buildLeaf, goalWeight, allLensLeaves, courseRollupBuckets),
	);

	const root: LensTreeNode = {
		id: courseRow.id,
		level: 'course',
		title: courseRow.title,
		rollup: computeMasteryRollup(courseRollupBuckets),
		children: topLevelSubtrees,
	};

	return {
		tree: [root],
		rollup: computeMasteryRollup(courseRollupBuckets),
		leaves: allLensLeaves,
	};
};

// ---------------------------------------------------------------------------
// Course + cert overlay lens
// ---------------------------------------------------------------------------

export interface CourseOverlayLensFilters {
	/** The course to project (one root per call). */
	courseId: string;
	/**
	 * The cert syllabus to overlay on the course. Need NOT be referenced by
	 * the goal -- the overlay is a "what would this course look like under
	 * cert X?" projection. The lens does not gate on `goal_syllabus`
	 * presence; the cert is supplied directly by the caller.
	 */
	syllabusId: string;
}

/**
 * Course + cert overlay lens. Emits the same two-level tree as `courseLens`
 * (course root -> sections -> step leaves), with two additional pieces of
 * data:
 *
 *   1. Each `LensLeaf.sources` is set to:
 *        `{ inCourse: true, inCert: <bool>, certCode: <syllabus_node.code | undefined> }`
 *      `inCert` is true when the step's `knowledge_node_id` is reachable
 *      from any `syllabus_node_link` whose `syllabus_node` is rooted under
 *      `filters.syllabusId`. `certCode` carries the matching syllabus_node
 *      code so the UI can render the cert anchor without a second query.
 *      When a step's knowledge node is reachable from multiple cert leaves,
 *      `certCode` picks the lowest-ordinal-then-lexical-code leaf for
 *      stable output.
 *   2. `LensResult.certGaps` is populated with every cert leaf (level
 *      `'element'`, `is_leaf=true`) under `syllabusId` whose linked
 *      knowledge nodes are NOT covered by any course step. The gap list is
 *      always populated, even when the course covers every cert leaf -- in
 *      that case `certGaps` is the empty array `[]` (not `undefined`), so
 *      consumers can distinguish "checked, found zero gaps" from "no
 *      overlay was computed."
 *
 * The gap calculation is delegated to {@link getCourseGaps} so the overlay
 * lens and any non-tree consumer (a banner that says "this course leaves N
 * cert leaves uncovered") share one canonical algorithm.
 *
 * The lens accepts a `syllabusId` that the goal does NOT reference via
 * `goal_syllabus`. Useful for "what would this course look like if I were
 * pursuing PPL?" exploration.
 *
 * Returns the empty result (with `certGaps: []`) when the course id is
 * missing or when the goal is set but does not consume the course --
 * matches `courseLens`'s "goal has no goal_course row" path.
 */
export const courseWithCertOverlayLens: Lens<CourseOverlayLensFilters> = async (db, userId, input) => {
	const courseId = input.filters?.courseId;
	const syllabusId = input.filters?.syllabusId;
	if (courseId === undefined || courseId === '' || syllabusId === undefined || syllabusId === '') {
		return { tree: [], rollup: emptyRollup(), leaves: [], certGaps: [] };
	}

	// Goal weight resolution mirrors `courseLens`: anonymous browse falls
	// back to weight=1.0; a goal that does not consume the course returns
	// the empty result (with `certGaps: []`). Composite PK on
	// (goal_id, course_id) -> at most one row.
	let goalWeight = 1.0;
	if (input.goal !== null) {
		const linkRows = await db
			.select({ weight: goalCourse.weight })
			.from(goalCourse)
			.where(and(eq(goalCourse.goalId, input.goal.id), eq(goalCourse.courseId, courseId)))
			.limit(1);
		const link = linkRows[0];
		if (link === undefined) {
			return { tree: [], rollup: emptyRollup(), leaves: [], certGaps: [] };
		}
		goalWeight = link.weight;
	}

	// Resolve the course row + every step in it. `getCourseStepsByCourse`
	// returns rows in tree-walk order (sections before their child steps,
	// each parent's children sorted by ordinal).
	const courseRows = await db.select().from(course).where(eq(course.id, courseId)).limit(1);
	const courseRow = courseRows[0];
	if (courseRow === undefined) {
		return { tree: [], rollup: emptyRollup(), leaves: [], certGaps: [] };
	}
	const steps = await getCourseStepsByCourse(courseId, db);
	if (steps.length === 0) {
		// Empty course -- still compute the gap list so consumers can render
		// the cert side ("course is empty; PPL ACS still requires N leaves").
		const gaps = await getCourseGaps(input.goal?.id ?? '', courseId, syllabusId, db);
		const root: LensTreeNode = {
			id: courseRow.id,
			level: 'course',
			title: courseRow.title,
			rollup: emptyRollup(),
			children: [],
		};
		return { tree: [root], rollup: emptyRollup(), leaves: [], certGaps: gaps };
	}

	// Group every row by parent once; the recursive walk reads from this map.
	const childrenByParent = groupRowsByParent(steps);

	// Per-step mastery. Same code path as `courseLens`.
	const allNodeIds = steps
		.filter((s) => s.knowledgeNodeId !== null)
		.map((s) => s.knowledgeNodeId)
		.filter((id): id is string => id !== null);
	const evidenceByNode =
		input.goal !== null && allNodeIds.length > 0
			? await getNodeEvidenceStateMap(userId, allNodeIds, db)
			: new Map<string, NodeEvidenceState>();

	// Cert overlay: for each step's knowledge_node_id, determine whether the
	// node is reachable from a cert leaf rooted under `syllabusId`. Build
	// the lookup once via a join: every (knowledge_node_id ->
	// syllabus_node.code) pair where the cert leaf is under our syllabus.
	// When a node is reachable from multiple cert leaves we pick the lowest
	// (ordinal, code) leaf for stable output (sorted server-side, picked
	// client-side). Per spec, cert binding is leaf-only -- the renderer
	// aggregates coverage upward; we do not denormalise `sources` onto
	// interior nodes.
	const certCodeByNode = new Map<string, string>();
	if (allNodeIds.length > 0) {
		const overlayRows = await db
			.select({
				knowledgeNodeId: syllabusNodeLink.knowledgeNodeId,
				code: syllabusNode.code,
				ordinal: syllabusNode.ordinal,
			})
			.from(syllabusNodeLink)
			.innerJoin(syllabusNode, eq(syllabusNode.id, syllabusNodeLink.syllabusNodeId))
			.where(
				and(
					eq(syllabusNode.syllabusId, syllabusId),
					eq(syllabusNode.level, SYLLABUS_NODE_LEVELS.ELEMENT),
					eq(syllabusNode.isLeaf, true),
					inArray(syllabusNodeLink.knowledgeNodeId, allNodeIds),
				),
			);
		// Group by knowledge_node_id; keep the smallest (ordinal, code) leaf.
		// One pass: track the current best per node and replace on a smaller
		// (ordinal, code) tuple.
		const bestByNode = new Map<string, { ordinal: number; code: string }>();
		for (const row of overlayRows) {
			const current = bestByNode.get(row.knowledgeNodeId);
			if (
				current === undefined ||
				row.ordinal < current.ordinal ||
				(row.ordinal === current.ordinal && row.code.localeCompare(current.code) < 0)
			) {
				bestByNode.set(row.knowledgeNodeId, { ordinal: row.ordinal, code: row.code });
			}
		}
		for (const [nodeId, best] of bestByNode) {
			certCodeByNode.set(nodeId, best.code);
		}
	}

	const allLensLeaves: LensLeaf[] = [];
	const courseRollupBuckets: Array<{ mastery: LensLeafMastery; weight: number }> = [];

	// Decorate each leaf with cert-overlay provenance. Cert binding is
	// leaf-only per spec -- the renderer aggregates coverage to lessons /
	// sections during paint.
	const decorateWithSources = (row: CourseStepRow, leaf: LensLeaf): LensLeaf => {
		// row.knowledgeNodeId is non-null on a leaf row (CHECK-enforced); the
		// builder filtered the row already.
		const nodeId = row.knowledgeNodeId;
		const certCode = nodeId === null ? undefined : certCodeByNode.get(nodeId);
		const sources: LensLeafSources = {
			inCourse: true,
			inCert: certCode !== undefined,
			...(certCode !== undefined ? { certCode } : {}),
		};
		return { ...leaf, sources };
	};
	const buildLeaf = makeBuildLeaf(evidenceByNode, decorateWithSources);

	const sectionRows = childrenByParent.get(null) ?? [];
	const topLevelSubtrees: LensTreeNode[] = sectionRows.map((row) =>
		buildSubtree(row, childrenByParent, buildLeaf, goalWeight, allLensLeaves, courseRollupBuckets),
	);

	const root: LensTreeNode = {
		id: courseRow.id,
		level: 'course',
		title: courseRow.title,
		rollup: computeMasteryRollup(courseRollupBuckets),
		children: topLevelSubtrees,
	};

	const certGaps: CertGap[] = await getCourseGaps(input.goal?.id ?? '', courseId, syllabusId, db);

	return {
		tree: [root],
		rollup: computeMasteryRollup(courseRollupBuckets),
		leaves: allLensLeaves,
		certGaps,
	};
};

// ---------------------------------------------------------------------------
// Recursive tree construction
// ---------------------------------------------------------------------------

/**
 * Group every row from a course's step set by `parent_id`. Sections (root
 * rows) live under the `null` key; every other row lives under its parent's
 * id. Each per-parent list is sorted by `ordinal` so the recursive walk
 * visits children in document order regardless of the DB read order.
 *
 * Returned map is owned by the caller; the lens calls this once per render
 * and reads from it inside the recursion without re-sorting.
 */
function groupRowsByParent(rows: ReadonlyArray<CourseStepRow>): Map<string | null, CourseStepRow[]> {
	const map = new Map<string | null, CourseStepRow[]>();
	for (const row of rows) {
		const key: string | null = row.parentId;
		const list = map.get(key) ?? [];
		list.push(row);
		map.set(key, list);
	}
	for (const list of map.values()) {
		list.sort((a, b) => a.ordinal - b.ordinal);
	}
	return map;
}

/**
 * Build a single `LensLeaf` from a step row + the pre-batched evidence map.
 * Curried so the recursion can call it without re-passing the shared evidence
 * map every level. The optional `decorate` hook lets the overlay lens inject
 * `sources` onto every leaf without re-implementing the build path; per spec,
 * cert binding is leaf-only and the renderer aggregates upward.
 */
function makeBuildLeaf(
	evidenceByNode: Map<string, NodeEvidenceState>,
	decorate?: (row: CourseStepRow, leaf: LensLeaf) => LensLeaf,
): (row: CourseStepRow) => LensLeaf | null {
	return (row) => {
		// step rows are CHECK-constrained to carry a non-null knowledge_node_id;
		// the narrow keeps the type system honest and matches the pre-WP guard.
		if (row.knowledgeNodeId === null) return null;
		const evidence = evidenceByNode.get(row.knowledgeNodeId);
		const mastery = computeStepLeafMastery(evidence);
		const base: LensLeaf = {
			id: row.id,
			knowledgeNodeId: row.knowledgeNodeId,
			title: row.title,
			requiredBloom: null,
			mastery,
		};
		return decorate === undefined ? base : decorate(row, base);
	};
}

/**
 * Recursive subtree builder. Given a non-leaf row (`section` or `lesson`),
 * partitions its direct children into interior subtrees and leaf rows, then
 * emits a `LensTreeNode` with both `children` (recursed interior subtrees)
 * and `leaves` (direct leaf rows). The per-node rollup aggregates every leaf
 * reachable from the subtree weighted by `goalWeight`.
 *
 * `allLeavesSink` and `rollupSink` are passed by reference so the recursion
 * collects the full flat leaf list + course-wide rollup buckets in one pass
 * without re-walking the tree.
 *
 * Complexity: O(N) where N is the row count for the course (each row visited
 * exactly once). The recursion depth is bounded by `COURSE_TREE_MAX_DEPTH`
 * (10), enforced upstream by the seed validator; JS stack headroom is ample.
 */
function buildSubtree(
	row: CourseStepRow,
	childrenByParent: Map<string | null, CourseStepRow[]>,
	buildLeaf: (row: CourseStepRow) => LensLeaf | null,
	goalWeight: number,
	allLeavesSink: LensLeaf[],
	courseRollupSink: Array<{ mastery: LensLeafMastery; weight: number }>,
): LensTreeNode {
	const directChildren = childrenByParent.get(row.id) ?? [];
	const interiorSubtrees: LensTreeNode[] = [];
	const directLeaves: LensLeaf[] = [];
	const subtreeRollupBuckets: Array<{ mastery: LensLeafMastery; weight: number }> = [];

	for (const child of directChildren) {
		if (child.isLeaf) {
			const leaf = buildLeaf(child);
			if (leaf === null) continue;
			directLeaves.push(leaf);
			subtreeRollupBuckets.push({ mastery: leaf.mastery, weight: goalWeight });
			allLeavesSink.push(leaf);
			courseRollupSink.push({ mastery: leaf.mastery, weight: goalWeight });
			continue;
		}
		// Recurse into the interior child. The recursion writes its own
		// leaves through `allLeavesSink` + `courseRollupSink`; we collect a
		// subtree-local copy here too so this level's rollup reflects every
		// leaf under it (not just the direct ones).
		const interior = buildSubtree(child, childrenByParent, buildLeaf, goalWeight, allLeavesSink, courseRollupSink);
		interiorSubtrees.push(interior);
		collectSubtreeLeavesForRollup(interior, subtreeRollupBuckets, goalWeight);
	}

	const level: LensTreeNode['level'] = row.level === COURSE_STEP_LEVELS.LESSON ? 'lesson' : 'section';
	return {
		id: row.id,
		level,
		title: row.title,
		rollup: computeMasteryRollup(subtreeRollupBuckets),
		children: interiorSubtrees,
		leaves: directLeaves,
	};
}

/**
 * Walk a subtree and append every reachable leaf as a rollup bucket. Used by
 * `buildSubtree` so each interior node's rollup aggregates the full subtree
 * (not just its direct leaves). The shared `goalWeight` is applied uniformly
 * because course leaves do not (yet) carry a per-step weight.
 */
function collectSubtreeLeavesForRollup(
	node: LensTreeNode,
	into: Array<{ mastery: LensLeafMastery; weight: number }>,
	goalWeight: number,
): void {
	if (node.leaves !== undefined) {
		for (const leaf of node.leaves) {
			into.push({ mastery: leaf.mastery, weight: goalWeight });
		}
	}
	for (const child of node.children) {
		collectSubtreeLeavesForRollup(child, into, goalWeight);
	}
}

/**
 * Flatten a `LensTreeNode[]` into the document-order list of `LensLeaf` rows
 * reachable from anywhere in the tree. Visits each node's direct leaves
 * before recursing into its interior children, which matches the natural
 * authoring order: a section / lesson with `body_md` framing, then its leaf
 * steps, then deeper lesson groupings.
 *
 * Consumers:
 *   - prev/next navigation on the step reader (find the current leaf's index
 *     and pick `i-1` / `i+1`)
 *   - cert-overlay aggregation that wants the leaf list without a second
 *     tree walk
 *
 * Pure helper -- exported so renderer + load functions can call it without
 * re-implementing the traversal.
 */
export function flattenLeavesDepthFirst(tree: ReadonlyArray<LensTreeNode>): LensLeaf[] {
	const out: LensLeaf[] = [];
	function walk(node: LensTreeNode): void {
		if (node.leaves !== undefined) {
			for (const leaf of node.leaves) out.push(leaf);
		}
		for (const child of node.children) walk(child);
	}
	for (const node of tree) walk(node);
	return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyRollup(): MasteryRollup {
	return {
		totalLeaves: 0,
		coveredLeaves: 0,
		masteredLeaves: 0,
		masteryFraction: 0,
		coverageFraction: 0,
		byEvidenceKind: {},
	};
}

function emptyLeafMastery(): LensLeafMastery {
	return {
		mastered: false,
		covered: false,
		requiredKinds: [],
		byEvidenceKind: {},
		missingKinds: [],
	};
}

/**
 * Compute a `LensLeafMastery` for a course-step leaf. Mirrors the Domain
 * lens's per-node decoding: a course step does not carry an FAA triad, so
 * the leaf is "covered" when any evidence exists across any kind, and
 * "mastered" when at least one kind aggregates to `pass`. `requiredKinds`
 * stays empty -- the course-step layer does not declare per-kind gates;
 * those live on `knowledge_node.assessment_methods` and are surfaced through
 * the Domain lens. (A future per-step kind enforcement pass can layer on top
 * by passing the node's assessment_methods through here.)
 */
function computeStepLeafMastery(evidence: NodeEvidenceState | undefined): LensLeafMastery {
	if (evidence === undefined) return emptyLeafMastery();
	const byEvidenceKind: Partial<Record<AssessmentMethod, GateState>> = {};
	let anyEvidence = false;
	let anyPass = false;
	for (const kind of ASSESSMENT_METHOD_VALUES) {
		const gate = evidence[kind];
		byEvidenceKind[kind] = gate;
		if (gate !== NODE_MASTERY_GATES.NOT_APPLICABLE) anyEvidence = true;
		if (gate === NODE_MASTERY_GATES.PASS) anyPass = true;
	}
	return {
		mastered: anyPass,
		covered: anyEvidence,
		requiredKinds: [],
		byEvidenceKind,
		missingKinds: [],
	};
}
