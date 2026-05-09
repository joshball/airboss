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

import { ASSESSMENT_METHOD_VALUES, type AssessmentMethod, NODE_MASTERY_GATES } from '@ab/constants';
import { and, eq } from 'drizzle-orm';
import { getCourseStepsByCourse } from './courses';
import {
	computeMasteryRollup,
	type Lens,
	type LensLeaf,
	type LensLeafMastery,
	type LensTreeNode,
	type MasteryRollup,
} from './lenses';
import { type GateState, getNodeEvidenceStateMap, type NodeEvidenceState } from './mastery';
import type { CourseStepRow } from './schema';
import { course, goalCourse } from './schema';

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
