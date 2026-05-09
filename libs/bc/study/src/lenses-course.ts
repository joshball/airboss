/**
 * Course-aware lens implementations (course-primitive WP, Phase 4+).
 *
 * Phase 4 ships `courseLens` -- the single-course tree projection that
 * mirrors how `acsLens` walks a syllabus and `domainLens` walks the goal's
 * reachable knowledge nodes. Phase 5 layers `courseWithCertOverlayLens` and
 * `getCourseGaps` on top to cross-reference course coverage against a cert
 * syllabus.
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
 *   - docs/work-packages/course-primitive/spec.md  -- Lens behavior section
 *   - docs/work-packages/course-primitive/design.md -- Lens extensions
 *   - libs/bc/study/src/lenses.ts                   -- Lens framework + acsLens/domainLens
 *   - libs/bc/study/src/courses.ts                  -- getCourseStepsByCourse
 */

import {
	ASSESSMENT_METHOD_VALUES,
	type AssessmentMethod,
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
 * Course lens. Walks the course identified by `filters.courseId` and emits a
 * two-level tree:
 *
 *     course (root LensTreeNode, level='course')
 *       section (level='section')
 *         step leaf (LensLeaf, knowledgeNodeId = course_step.knowledge_node_id)
 *
 * Per-step mastery is computed via `getNodeEvidenceStateMap` -- the same
 * any-evidence-passes semantic the Domain lens uses for non-syllabus leaves
 * (course steps live outside the FAA triad). Each step's effective weight is
 * `goal_course.weight * 1.0`; the section + course rollups aggregate the
 * weighted leaves via `computeMasteryRollup`.
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
	// returns rows in tree-walk order (sections before steps, ordinal asc).
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

	// Group rows: sections (parent_id NULL) and steps under each section.
	const sectionRows: CourseStepRow[] = [];
	const stepsBySection = new Map<string, CourseStepRow[]>();
	for (const row of steps) {
		if (row.parentId === null) {
			sectionRows.push(row);
		} else {
			const list = stepsBySection.get(row.parentId) ?? [];
			list.push(row);
			stepsBySection.set(row.parentId, list);
		}
	}
	// Sort sections by ordinal (DB query already returned in order, but the
	// section/step partition does not preserve the cross-parent ordering).
	sectionRows.sort((a, b) => a.ordinal - b.ordinal);

	// Per-step mastery: collect every linked knowledge node id, batch the
	// per-(user, node) evidence lookup, then decode each leaf.
	const allNodeIds = steps
		.filter((s) => s.knowledgeNodeId !== null)
		.map((s) => s.knowledgeNodeId)
		.filter((id): id is string => id !== null);
	const evidenceByNode =
		input.goal !== null && allNodeIds.length > 0
			? await getNodeEvidenceStateMap(userId, allNodeIds, db)
			: new Map<string, NodeEvidenceState>();

	const allLensLeaves: LensLeaf[] = [];
	const sectionTreeNodes: LensTreeNode[] = [];
	const courseRollupBuckets: Array<{ mastery: LensLeafMastery; weight: number }> = [];

	for (const section of sectionRows) {
		const childSteps = (stepsBySection.get(section.id) ?? []).slice().sort((a, b) => a.ordinal - b.ordinal);
		const sectionLeaves: LensLeaf[] = [];
		const sectionRollupBuckets: Array<{ mastery: LensLeafMastery; weight: number }> = [];

		for (const step of childSteps) {
			// step.knowledgeNodeId is non-null on every step row (DB CHECK
			// `course_step_consistency_check` enforces it); narrow defensively.
			if (step.knowledgeNodeId === null) continue;
			const evidence = evidenceByNode.get(step.knowledgeNodeId);
			const mastery = computeStepLeafMastery(evidence);
			const leaf: LensLeaf = {
				id: step.id,
				knowledgeNodeId: step.knowledgeNodeId,
				title: step.title,
				requiredBloom: null,
				mastery,
			};
			sectionLeaves.push(leaf);
			sectionRollupBuckets.push({ mastery, weight: goalWeight });
			allLensLeaves.push(leaf);
			courseRollupBuckets.push({ mastery, weight: goalWeight });
		}

		sectionTreeNodes.push({
			id: section.id,
			level: 'section',
			title: section.title,
			rollup: computeMasteryRollup(sectionRollupBuckets),
			children: [],
			leaves: sectionLeaves,
		});
	}

	const root: LensTreeNode = {
		id: courseRow.id,
		level: 'course',
		title: courseRow.title,
		rollup: computeMasteryRollup(courseRollupBuckets),
		children: sectionTreeNodes,
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

	// Group rows: sections (parent_id NULL) and steps under each section.
	const sectionRows: CourseStepRow[] = [];
	const stepsBySection = new Map<string, CourseStepRow[]>();
	for (const row of steps) {
		if (row.parentId === null) {
			sectionRows.push(row);
		} else {
			const list = stepsBySection.get(row.parentId) ?? [];
			list.push(row);
			stepsBySection.set(row.parentId, list);
		}
	}
	sectionRows.sort((a, b) => a.ordinal - b.ordinal);

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
	// client-side).
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
	const sectionTreeNodes: LensTreeNode[] = [];
	const courseRollupBuckets: Array<{ mastery: LensLeafMastery; weight: number }> = [];

	for (const section of sectionRows) {
		const childSteps = (stepsBySection.get(section.id) ?? []).slice().sort((a, b) => a.ordinal - b.ordinal);
		const sectionLeaves: LensLeaf[] = [];
		const sectionRollupBuckets: Array<{ mastery: LensLeafMastery; weight: number }> = [];

		for (const step of childSteps) {
			if (step.knowledgeNodeId === null) continue;
			const evidence = evidenceByNode.get(step.knowledgeNodeId);
			const mastery = computeStepLeafMastery(evidence);
			const certCode = certCodeByNode.get(step.knowledgeNodeId);
			const sources: LensLeafSources = {
				inCourse: true,
				inCert: certCode !== undefined,
				...(certCode !== undefined ? { certCode } : {}),
			};
			const leaf: LensLeaf = {
				id: step.id,
				knowledgeNodeId: step.knowledgeNodeId,
				title: step.title,
				requiredBloom: null,
				mastery,
				sources,
			};
			sectionLeaves.push(leaf);
			sectionRollupBuckets.push({ mastery, weight: goalWeight });
			allLensLeaves.push(leaf);
			courseRollupBuckets.push({ mastery, weight: goalWeight });
		}

		sectionTreeNodes.push({
			id: section.id,
			level: 'section',
			title: section.title,
			rollup: computeMasteryRollup(sectionRollupBuckets),
			children: [],
			leaves: sectionLeaves,
		});
	}

	const root: LensTreeNode = {
		id: courseRow.id,
		level: 'course',
		title: courseRow.title,
		rollup: computeMasteryRollup(courseRollupBuckets),
		children: sectionTreeNodes,
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
