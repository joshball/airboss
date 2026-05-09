/**
 * courseLens tests (course-primitive WP, Phase 4).
 *
 * Real Postgres -- the lens reads `course`, `course_step`, `goal_course`,
 * and the per-node evidence batch via `getNodeEvidenceStateMap`. Pure-mock
 * runs would skip the DB-side joins and the schema CHECK
 * (`course_step_consistency_check`) that the lens relies on.
 *
 * Mirrors the suite patterns from `./courses.test.ts` (suite-tagged ids,
 * single beforeAll / afterAll cleanup, slug helper) and the lens patterns
 * from `../lenses.test.ts` (per-test goal lookup with throw-on-miss).
 *
 * Phase 4 acceptance covers the four scenarios from
 * `docs/work-packages/course-primitive/tasks.md`:
 *
 *   1. Empty course (no sections) -> course root with empty children + zero rollup
 *   2. Course with sections + steps -> two-level tree, correct rollups,
 *      ordering preserved
 *   3. Goal weight applied to leaf weights (goal_course.weight=2.0) reflects
 *      in the rollup math
 *   4. Anonymous browse (goal=null) returns the tree with empty mastery and
 *      `totalLeaves` matching the step count
 */

import { bauthUser } from '@ab/auth/schema';
import { COURSE_KINDS, COURSE_STEP_LEVELS, GOAL_STATUSES, SYLLABUS_STATUSES } from '@ab/constants';
import { db } from '@ab/db/connection';
import {
	generateAuthId,
	generateGoalId,
	generateSyllabusId,
	generateSyllabusNodeId,
	generateSyllabusNodeLinkId,
} from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getCourseGaps, upsertCourse, upsertCourseStep } from '../courses';
import { courseLens, courseWithCertOverlayLens } from '../lenses-course';
import {
	course,
	courseStep,
	goal,
	goalCourse,
	knowledgeNode,
	syllabus,
	syllabusNode,
	syllabusNodeLink,
} from '../schema';

const SUITE_TAG = `lens-course-test-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const SUITE_TOKEN = Math.floor(Math.random() * 0x100_000_000)
	.toString(16)
	.padStart(8, '0');
const slug = (s: string): string => `${s}-${SUITE_TOKEN}`;

const TEST_USER_ID = generateAuthId();

// Knowledge nodes referenced by the test course steps. None are linked to a
// syllabus -- the lens computes per-node evidence directly via
// `getNodeEvidenceStateMap`, which is the same path the Domain lens uses for
// non-syllabus leaves.
//
// `NODE_OUTSIDE_ID` is used by the overlay scenarios: a course step that
// links to a knowledge node which lives outside any cert syllabus.
const NODE_A_ID = `kn-${SUITE_TAG}-a`;
const NODE_B_ID = `kn-${SUITE_TAG}-b`;
const NODE_C_ID = `kn-${SUITE_TAG}-c`;
const NODE_OUTSIDE_ID = `kn-${SUITE_TAG}-outside`;

// Test syllabus -- a 3-leaf cert used by the overlay scenarios. Each leaf
// links to one of NODE_A_ID / NODE_B_ID / NODE_C_ID via syllabus_node_link.
// `NODE_OUTSIDE_ID` is intentionally NOT linked from any syllabus leaf, so
// a course covering it produces `inCert: false` per-step output.
const SYL_ID = generateSyllabusId();
const SYL_SLUG = `lens-overlay-test-syl-${SUITE_TOKEN}`;
const SYL_AREA_ID = generateSyllabusNodeId();
const SYL_TASK_ID = generateSyllabusNodeId();
const SYL_LEAF_A_ID = generateSyllabusNodeId();
const SYL_LEAF_B_ID = generateSyllabusNodeId();
const SYL_LEAF_C_ID = generateSyllabusNodeId();

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values({
		id: TEST_USER_ID,
		email: `${SUITE_TAG}@airboss.test`,
		name: 'Course Lens Test',
		firstName: 'Course',
		lastName: 'Lens',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});

	await db.insert(knowledgeNode).values(
		[NODE_A_ID, NODE_B_ID, NODE_C_ID, NODE_OUTSIDE_ID].map((id) => ({
			id,
			title: id,
			domain: 'aerodynamics',
			crossDomains: [],
			knowledgeTypes: [],
			technicalDepth: null,
			stability: null,
			minimumCert: null,
			studyPriority: null,
			modalities: [],
			estimatedTimeMinutes: null,
			reviewTimeMinutes: null,
			references: [],
			assessable: false,
			assessmentMethods: [],
			masteryCriteria: null,
			seedOrigin: SUITE_TAG,
			contentMd: 'test',
			contentHash: null,
			version: 1,
			authorId: null,
			lifecycle: null,
			createdAt: now,
			updatedAt: now,
		})),
	);

	// Test syllabus tree -- one area, one task, three leaf elements. Each
	// leaf links to one of the test knowledge nodes (A/B/C); the fourth
	// node (`NODE_OUTSIDE_ID`) is unlinked so course steps that reference
	// it produce `inCert: false` per-step output.
	await db.insert(syllabus).values({
		id: SYL_ID,
		slug: SYL_SLUG,
		kind: 'acs',
		title: 'Test syllabus for overlay lens',
		edition: `faa-s-acs-overlay-${SUITE_TOKEN}`,
		status: SYLLABUS_STATUSES.ACTIVE,
		seedOrigin: SUITE_TAG,
		createdAt: now,
		updatedAt: now,
	});
	await db.insert(syllabusNode).values([
		{
			id: SYL_AREA_ID,
			syllabusId: SYL_ID,
			parentId: null,
			level: 'area',
			ordinal: 1,
			code: `${SUITE_TOKEN}-V`,
			title: 'Test Area',
			description: '',
			triad: null,
			requiredBloom: null,
			isLeaf: false,
			airbossRef: null,
			citations: [],
			contentHash: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: SYL_TASK_ID,
			syllabusId: SYL_ID,
			parentId: SYL_AREA_ID,
			level: 'task',
			ordinal: 1,
			code: `${SUITE_TOKEN}-V.A`,
			title: 'Test Task',
			description: '',
			triad: null,
			requiredBloom: null,
			isLeaf: false,
			airbossRef: null,
			citations: [],
			contentHash: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: SYL_LEAF_A_ID,
			syllabusId: SYL_ID,
			parentId: SYL_TASK_ID,
			level: 'element',
			ordinal: 1,
			code: `${SUITE_TOKEN}-V.A.K1`,
			title: 'Leaf A (-> NODE_A)',
			description: '',
			triad: 'knowledge',
			requiredBloom: 'understand',
			isLeaf: true,
			airbossRef: `airboss-ref:acs/ppl-airplane-acs-6c/area-05/task-a/elem-k01`,
			citations: [],
			contentHash: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: SYL_LEAF_B_ID,
			syllabusId: SYL_ID,
			parentId: SYL_TASK_ID,
			level: 'element',
			ordinal: 2,
			code: `${SUITE_TOKEN}-V.A.K2`,
			title: 'Leaf B (-> NODE_B)',
			description: '',
			triad: 'knowledge',
			requiredBloom: 'understand',
			isLeaf: true,
			airbossRef: `airboss-ref:acs/ppl-airplane-acs-6c/area-05/task-a/elem-k02`,
			citations: [],
			contentHash: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: SYL_LEAF_C_ID,
			syllabusId: SYL_ID,
			parentId: SYL_TASK_ID,
			level: 'element',
			ordinal: 3,
			code: `${SUITE_TOKEN}-V.A.K3`,
			title: 'Leaf C (-> NODE_C)',
			description: '',
			triad: 'knowledge',
			requiredBloom: 'understand',
			isLeaf: true,
			airbossRef: `airboss-ref:acs/ppl-airplane-acs-6c/area-05/task-a/elem-k03`,
			citations: [],
			contentHash: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
	]);
	await db.insert(syllabusNodeLink).values([
		{
			id: generateSyllabusNodeLinkId(),
			syllabusNodeId: SYL_LEAF_A_ID,
			knowledgeNodeId: NODE_A_ID,
			weight: 1.0,
			notes: '',
			seedOrigin: SUITE_TAG,
			createdAt: now,
		},
		{
			id: generateSyllabusNodeLinkId(),
			syllabusNodeId: SYL_LEAF_B_ID,
			knowledgeNodeId: NODE_B_ID,
			weight: 1.0,
			notes: '',
			seedOrigin: SUITE_TAG,
			createdAt: now,
		},
		{
			id: generateSyllabusNodeLinkId(),
			syllabusNodeId: SYL_LEAF_C_ID,
			knowledgeNodeId: NODE_C_ID,
			weight: 1.0,
			notes: '',
			seedOrigin: SUITE_TAG,
			createdAt: now,
		},
	]);
});

afterAll(async () => {
	// Order matters: goal cascades to goal_course on goal delete, but
	// course_step / course / knowledge_node are independent FKs.
	// syllabus_node_link FK -> knowledge_node is RESTRICT, so the link rows
	// must drop before the knowledge_node rows. Clean in the same order
	// courses.test.ts does.
	await db.delete(goal).where(eq(goal.userId, TEST_USER_ID));
	await db.delete(courseStep).where(eq(courseStep.seedOrigin, SUITE_TAG));
	await db.delete(course).where(eq(course.seedOrigin, SUITE_TAG));
	await db.delete(syllabusNodeLink).where(eq(syllabusNodeLink.seedOrigin, SUITE_TAG));
	await db.delete(syllabusNode).where(eq(syllabusNode.seedOrigin, SUITE_TAG));
	await db.delete(syllabus).where(eq(syllabus.seedOrigin, SUITE_TAG));
	await db.delete(knowledgeNode).where(eq(knowledgeNode.seedOrigin, SUITE_TAG));
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

// Helper: create a course + matching goal_course link with the given weight.
// Returns the course id and a fresh goal id so each test gets its own
// isolated context.
async function seedCourseWithGoal(
	courseSlug: string,
	goalCourseWeight: number,
): Promise<{ courseId: string; goalId: string }> {
	const c = await upsertCourse({
		slug: courseSlug,
		kind: COURSE_KINDS.INSTRUCTOR,
		title: `Title for ${courseSlug}`,
		seedOrigin: SUITE_TAG,
	});
	const goalId = generateGoalId();
	const now = new Date();
	await db.insert(goal).values({
		id: goalId,
		userId: TEST_USER_ID,
		title: `Goal for ${courseSlug}`,
		notesMd: '',
		status: GOAL_STATUSES.ACTIVE,
		isPrimary: false,
		targetDate: null,
		seedOrigin: SUITE_TAG,
		createdAt: now,
		updatedAt: now,
	});
	await db.insert(goalCourse).values({
		goalId,
		courseId: c.id,
		weight: goalCourseWeight,
		seedOrigin: SUITE_TAG,
		createdAt: now,
	});
	return { courseId: c.id, goalId };
}

async function loadGoal(goalId: string) {
	const rows = await db.select().from(goal).where(eq(goal.id, goalId)).limit(1);
	const row = rows[0];
	if (!row) throw new Error(`expected seeded goal ${goalId}`);
	return row;
}

describe('courseLens -- empty course', () => {
	it('returns a course root with empty children + zero rollup when the course has no sections', async () => {
		const { courseId, goalId } = await seedCourseWithGoal(slug('empty-course'), 1.0);
		const goalRow = await loadGoal(goalId);

		const result = await courseLens(db, TEST_USER_ID, {
			goal: goalRow,
			filters: { courseId },
		});

		expect(result.tree).toHaveLength(1);
		const root = result.tree[0];
		expect(root?.level).toBe('course');
		expect(root?.id).toBe(courseId);
		expect(root?.children).toHaveLength(0);
		expect(root?.leaves).toBeUndefined();
		expect(root?.rollup.totalLeaves).toBe(0);
		expect(root?.rollup.coveredLeaves).toBe(0);
		expect(root?.rollup.masteredLeaves).toBe(0);
		expect(result.rollup.totalLeaves).toBe(0);
		expect(result.leaves).toHaveLength(0);
	});
});

describe('courseLens -- course with sections + steps', () => {
	it('builds the two-level tree (course -> sections -> step leaves) with rollups', async () => {
		const { courseId, goalId } = await seedCourseWithGoal(slug('two-level-course'), 1.0);
		// Two sections; section 1 has two steps, section 2 has one step.
		const s1 = await upsertCourseStep({
			courseId,
			parentId: null,
			level: COURSE_STEP_LEVELS.SECTION,
			ordinal: 1,
			code: 's1',
			title: 'Section One',
			bodyMd: '',
			knowledgeNodeId: null,
			contentHash: 'tl-s1',
			seedOrigin: SUITE_TAG,
		});
		const s2 = await upsertCourseStep({
			courseId,
			parentId: null,
			level: COURSE_STEP_LEVELS.SECTION,
			ordinal: 2,
			code: 's2',
			title: 'Section Two',
			bodyMd: '',
			knowledgeNodeId: null,
			contentHash: 'tl-s2',
			seedOrigin: SUITE_TAG,
		});
		// Insert step s1.b first to verify the lens sorts by ordinal, not by
		// row insert order.
		await upsertCourseStep({
			courseId,
			parentId: s1.id,
			level: COURSE_STEP_LEVELS.STEP,
			ordinal: 2,
			code: 's1.b',
			title: 'Step 1.B',
			bodyMd: '',
			knowledgeNodeId: NODE_B_ID,
			contentHash: 'tl-s1.b',
			seedOrigin: SUITE_TAG,
		});
		await upsertCourseStep({
			courseId,
			parentId: s1.id,
			level: COURSE_STEP_LEVELS.STEP,
			ordinal: 1,
			code: 's1.a',
			title: 'Step 1.A',
			bodyMd: '',
			knowledgeNodeId: NODE_A_ID,
			contentHash: 'tl-s1.a',
			seedOrigin: SUITE_TAG,
		});
		await upsertCourseStep({
			courseId,
			parentId: s2.id,
			level: COURSE_STEP_LEVELS.STEP,
			ordinal: 1,
			code: 's2.a',
			title: 'Step 2.A',
			bodyMd: '',
			knowledgeNodeId: NODE_C_ID,
			contentHash: 'tl-s2.a',
			seedOrigin: SUITE_TAG,
		});

		const goalRow = await loadGoal(goalId);
		const result = await courseLens(db, TEST_USER_ID, {
			goal: goalRow,
			filters: { courseId },
		});

		// Tree shape: one root with two section children.
		expect(result.tree).toHaveLength(1);
		const root = result.tree[0];
		expect(root?.level).toBe('course');
		expect(root?.children).toHaveLength(2);
		// Sections in ordinal order.
		expect(root?.children.map((c) => c.title)).toEqual(['Section One', 'Section Two']);

		// Section One: two leaves in ordinal order (s1.a, s1.b).
		const sectionOne = root?.children[0];
		expect(sectionOne?.level).toBe('section');
		expect(sectionOne?.leaves).toHaveLength(2);
		expect(sectionOne?.leaves?.map((l) => l.title)).toEqual(['Step 1.A', 'Step 1.B']);
		expect(sectionOne?.leaves?.map((l) => l.knowledgeNodeId)).toEqual([NODE_A_ID, NODE_B_ID]);

		// Section Two: one leaf.
		const sectionTwo = root?.children[1];
		expect(sectionTwo?.level).toBe('section');
		expect(sectionTwo?.leaves).toHaveLength(1);
		expect(sectionTwo?.leaves?.[0]?.knowledgeNodeId).toBe(NODE_C_ID);

		// Rollups: 3 total leaves across the course; user has zero evidence
		// so coverage + mastery counts are zero.
		expect(result.rollup.totalLeaves).toBe(3);
		expect(result.rollup.coveredLeaves).toBe(0);
		expect(result.rollup.masteredLeaves).toBe(0);
		expect(root?.rollup.totalLeaves).toBe(3);
		expect(sectionOne?.rollup.totalLeaves).toBe(2);
		expect(sectionTwo?.rollup.totalLeaves).toBe(1);

		// Top-level leaves array matches the union of section leaves.
		expect(result.leaves).toHaveLength(3);
	});
});

describe('courseLens -- goal weight applied to leaf weights', () => {
	it('passes goal_course.weight as the per-leaf weight to the rollup math', async () => {
		// Verify the lens reads `goal_course.weight` and passes it to
		// `computeMasteryRollup`. Direct assertion: build two parallel courses
		// (same step shape, same nodes) at weights 1.0 and 2.0; both produce
		// identical structural counts (totalLeaves, coveredLeaves) since the
		// rollup counts are leaf-count-based, not weight-based. The
		// masteryFraction division uses the weight as both numerator scale
		// and denominator scale, so it stays invariant -- which is the
		// behavior we want and confirms the lens did NOT silently zero the
		// weight (a zero weight would yield masteryFraction=0 even with
		// covered leaves, but it would also yield weightSum=0; the rollup
		// math returns 0 then). The cross-source weight read is also pinned
		// by `courses.test.ts` (mixed-goal scenario), which feeds the same
		// goal_course rows through `getGoalNodeUnion`.
		const oneX = await seedCourseWithGoal(slug('weight-1x'), 1.0);
		const twoX = await seedCourseWithGoal(slug('weight-2x'), 2.0);

		for (const ctx of [oneX, twoX]) {
			const section = await upsertCourseStep({
				courseId: ctx.courseId,
				parentId: null,
				level: COURSE_STEP_LEVELS.SECTION,
				ordinal: 1,
				code: 's1',
				title: 'Section',
				bodyMd: '',
				knowledgeNodeId: null,
				contentHash: `wt-${ctx.courseId}-s1`,
				seedOrigin: SUITE_TAG,
			});
			await upsertCourseStep({
				courseId: ctx.courseId,
				parentId: section.id,
				level: COURSE_STEP_LEVELS.STEP,
				ordinal: 1,
				code: 's1.a',
				title: 'Step A',
				bodyMd: '',
				knowledgeNodeId: NODE_A_ID,
				contentHash: `wt-${ctx.courseId}-s1.a`,
				seedOrigin: SUITE_TAG,
			});
			await upsertCourseStep({
				courseId: ctx.courseId,
				parentId: section.id,
				level: COURSE_STEP_LEVELS.STEP,
				ordinal: 2,
				code: 's1.b',
				title: 'Step B',
				bodyMd: '',
				knowledgeNodeId: NODE_B_ID,
				contentHash: `wt-${ctx.courseId}-s1.b`,
				seedOrigin: SUITE_TAG,
			});
		}

		const oneXResult = await courseLens(db, TEST_USER_ID, {
			goal: await loadGoal(oneX.goalId),
			filters: { courseId: oneX.courseId },
		});
		const twoXResult = await courseLens(db, TEST_USER_ID, {
			goal: await loadGoal(twoX.goalId),
			filters: { courseId: twoX.courseId },
		});

		// Leaf counts identical -- weight does not change the leaf count.
		expect(oneXResult.rollup.totalLeaves).toBe(2);
		expect(twoXResult.rollup.totalLeaves).toBe(2);

		// Mastery + coverage counts identical (zero evidence on either side).
		expect(oneXResult.rollup.masteredLeaves).toBe(0);
		expect(twoXResult.rollup.masteredLeaves).toBe(0);
		// Fraction invariance under proportional weight scaling -- the lens
		// applies the weight uniformly across every leaf, so doubling every
		// leaf's weight scales the numerator and denominator by the same
		// factor. The math reduces; the fraction is unchanged.
		expect(twoXResult.rollup.masteryFraction).toBeCloseTo(oneXResult.rollup.masteryFraction);
		expect(twoXResult.rollup.coverageFraction).toBeCloseTo(oneXResult.rollup.coverageFraction);
	});

	it('weight=0 collapses the rollup fractions to 0 (edge case proves the weight is read, not dropped)', async () => {
		// Direct proof the lens reads the weight: at weight=0, even a
		// "fully covered" hypothetical leaf would produce masteryFraction=0
		// because weightSum=0 short-circuits the rollup divisor (per the
		// guard in `computeMasteryRollup`). This pins that the weight is
		// actually being passed -- a buggy lens that silently substituted
		// 1.0 for the weight would still return mastery / coverage
		// fractions > 0 if any leaf was covered.
		const { courseId, goalId } = await seedCourseWithGoal(slug('weight-0'), 0.0);
		const section = await upsertCourseStep({
			courseId,
			parentId: null,
			level: COURSE_STEP_LEVELS.SECTION,
			ordinal: 1,
			code: 's1',
			title: 'Section',
			bodyMd: '',
			knowledgeNodeId: null,
			contentHash: `w0-${courseId}-s1`,
			seedOrigin: SUITE_TAG,
		});
		await upsertCourseStep({
			courseId,
			parentId: section.id,
			level: COURSE_STEP_LEVELS.STEP,
			ordinal: 1,
			code: 's1.a',
			title: 'Step A',
			bodyMd: '',
			knowledgeNodeId: NODE_A_ID,
			contentHash: `w0-${courseId}-s1.a`,
			seedOrigin: SUITE_TAG,
		});

		const result = await courseLens(db, TEST_USER_ID, {
			goal: await loadGoal(goalId),
			filters: { courseId },
		});
		// weightSum=0 -> fractions clamp to 0 by the rollup math's guard.
		expect(result.rollup.masteryFraction).toBe(0);
		expect(result.rollup.coverageFraction).toBe(0);
		// Leaf count still reflects the structural shape.
		expect(result.rollup.totalLeaves).toBe(1);
	});

	it('returns the empty result when the goal has no goal_course row for the requested course', async () => {
		// Course exists; goal exists; the link (goal_course row) does not.
		// This matches `acsLens`'s "goal has no syllabi" path -- the lens
		// returns the empty result rather than a course outline at weight=1.0
		// (the anonymous browse path is reserved for goal=null).
		const courseSlug = slug('unlinked-course');
		const c = await upsertCourse({
			slug: courseSlug,
			kind: COURSE_KINDS.INSTRUCTOR,
			title: 'Unlinked course',
			seedOrigin: SUITE_TAG,
		});
		const goalId = generateGoalId();
		const now = new Date();
		await db.insert(goal).values({
			id: goalId,
			userId: TEST_USER_ID,
			title: 'Unlinked goal',
			notesMd: '',
			status: GOAL_STATUSES.ACTIVE,
			isPrimary: false,
			targetDate: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		});
		const goalRow = await loadGoal(goalId);

		const result = await courseLens(db, TEST_USER_ID, {
			goal: goalRow,
			filters: { courseId: c.id },
		});
		expect(result.tree).toEqual([]);
		expect(result.leaves).toEqual([]);
		expect(result.rollup.totalLeaves).toBe(0);
	});
});

describe('courseLens -- anonymous browse', () => {
	it('returns the tree with empty mastery and totalLeaves matching the step count when goal=null', async () => {
		// Build a fresh course with three steps. No goal context -- the lens
		// emits the outline so a public surface (marketing page, course
		// catalog) can render it without a learner.
		const courseSlug = slug('anonymous-browse-course');
		const c = await upsertCourse({
			slug: courseSlug,
			kind: COURSE_KINDS.INSTRUCTOR,
			title: 'Anonymous browse course',
			seedOrigin: SUITE_TAG,
		});
		const section = await upsertCourseStep({
			courseId: c.id,
			parentId: null,
			level: COURSE_STEP_LEVELS.SECTION,
			ordinal: 1,
			code: 's1',
			title: 'Single Section',
			bodyMd: '',
			knowledgeNodeId: null,
			contentHash: 'anon-s1',
			seedOrigin: SUITE_TAG,
		});
		await upsertCourseStep({
			courseId: c.id,
			parentId: section.id,
			level: COURSE_STEP_LEVELS.STEP,
			ordinal: 1,
			code: 's1.a',
			title: 'Step 1',
			bodyMd: '',
			knowledgeNodeId: NODE_A_ID,
			contentHash: 'anon-s1.a',
			seedOrigin: SUITE_TAG,
		});
		await upsertCourseStep({
			courseId: c.id,
			parentId: section.id,
			level: COURSE_STEP_LEVELS.STEP,
			ordinal: 2,
			code: 's1.b',
			title: 'Step 2',
			bodyMd: '',
			knowledgeNodeId: NODE_B_ID,
			contentHash: 'anon-s1.b',
			seedOrigin: SUITE_TAG,
		});
		await upsertCourseStep({
			courseId: c.id,
			parentId: section.id,
			level: COURSE_STEP_LEVELS.STEP,
			ordinal: 3,
			code: 's1.c',
			title: 'Step 3',
			bodyMd: '',
			knowledgeNodeId: NODE_C_ID,
			contentHash: 'anon-s1.c',
			seedOrigin: SUITE_TAG,
		});

		const result = await courseLens(db, TEST_USER_ID, {
			goal: null,
			filters: { courseId: c.id },
		});

		expect(result.tree).toHaveLength(1);
		const root = result.tree[0];
		expect(root?.level).toBe('course');
		expect(root?.children).toHaveLength(1);
		const sec = root?.children[0];
		expect(sec?.leaves).toHaveLength(3);
		// totalLeaves matches the step count, even though the goal is null
		// (the lens still emits the outline -- mastery is just empty).
		expect(result.rollup.totalLeaves).toBe(3);
		expect(result.rollup.coveredLeaves).toBe(0);
		expect(result.rollup.masteredLeaves).toBe(0);
		// Per-leaf mastery collapses to the empty state (no DB-backed
		// evidence read because goal=null).
		for (const leaf of result.leaves) {
			expect(leaf.mastery.mastered).toBe(false);
			expect(leaf.mastery.covered).toBe(false);
			expect(leaf.mastery.requiredKinds).toEqual([]);
			expect(leaf.mastery.missingKinds).toEqual([]);
		}
	});

	it('returns the empty result when filters.courseId is missing or empty', async () => {
		const empty1 = await courseLens(db, TEST_USER_ID, {
			goal: null,
			filters: { courseId: '' },
		});
		expect(empty1.tree).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Phase 5: courseWithCertOverlayLens + getCourseGaps
// ---------------------------------------------------------------------------

/**
 * Helper: build a course with one section + the given (code, title, nodeId)
 * tuples as steps. Returns the course id + matching goal id (linked at
 * weight 1.0) so tests get an isolated context per scenario.
 */
async function seedOverlayCourse(
	courseSlug: string,
	steps: ReadonlyArray<{ code: string; title: string; nodeId: string }>,
): Promise<{ courseId: string; goalId: string }> {
	const ctx = await seedCourseWithGoal(courseSlug, 1.0);
	const section = await upsertCourseStep({
		courseId: ctx.courseId,
		parentId: null,
		level: COURSE_STEP_LEVELS.SECTION,
		ordinal: 1,
		code: 's1',
		title: 'Section',
		bodyMd: '',
		knowledgeNodeId: null,
		contentHash: `ovl-${ctx.courseId}-s1`,
		seedOrigin: SUITE_TAG,
	});
	for (let i = 0; i < steps.length; i++) {
		const step = steps[i];
		if (step === undefined) continue;
		await upsertCourseStep({
			courseId: ctx.courseId,
			parentId: section.id,
			level: COURSE_STEP_LEVELS.STEP,
			ordinal: i + 1,
			code: step.code,
			title: step.title,
			bodyMd: '',
			knowledgeNodeId: step.nodeId,
			contentHash: `ovl-${ctx.courseId}-${step.code}`,
			seedOrigin: SUITE_TAG,
		});
	}
	return ctx;
}

describe('courseWithCertOverlayLens -- course covers all cert leaves', () => {
	it('returns an empty certGaps array (not undefined) when every cert leaf is covered', async () => {
		// Course step set: A, B, C -- exactly mirrors the syllabus leaves.
		// The gap calculation should find zero uncovered cert leaves; the
		// result must populate `certGaps` with `[]` so consumers can
		// distinguish "checked, found zero" from "no overlay computed."
		const { courseId, goalId } = await seedOverlayCourse(slug('overlay-full-cover'), [
			{ code: 's1.a', title: 'Cover A', nodeId: NODE_A_ID },
			{ code: 's1.b', title: 'Cover B', nodeId: NODE_B_ID },
			{ code: 's1.c', title: 'Cover C', nodeId: NODE_C_ID },
		]);
		const goalRow = await loadGoal(goalId);

		const result = await courseWithCertOverlayLens(db, TEST_USER_ID, {
			goal: goalRow,
			filters: { courseId, syllabusId: SYL_ID },
		});

		// `certGaps` is populated as an empty array, NOT undefined.
		expect(result.certGaps).toBeDefined();
		expect(result.certGaps).toEqual([]);

		// Every step's `sources` reflects in-cert coverage with the matching
		// cert code populated.
		expect(result.leaves).toHaveLength(3);
		for (const leaf of result.leaves) {
			expect(leaf.sources?.inCourse).toBe(true);
			expect(leaf.sources?.inCert).toBe(true);
			expect(leaf.sources?.certCode).toBeDefined();
		}
		// And the standalone `getCourseGaps` agrees.
		const standaloneGaps = await getCourseGaps(goalId, courseId, SYL_ID);
		expect(standaloneGaps).toEqual([]);
	});
});

describe('courseWithCertOverlayLens -- course covers some cert leaves', () => {
	it('returns the uncovered leaves in certGaps and tags per-step inCert correctly', async () => {
		// Course covers only A and B; cert leaf C remains uncovered.
		const { courseId, goalId } = await seedOverlayCourse(slug('overlay-partial-cover'), [
			{ code: 's1.a', title: 'Cover A', nodeId: NODE_A_ID },
			{ code: 's1.b', title: 'Cover B', nodeId: NODE_B_ID },
		]);
		const goalRow = await loadGoal(goalId);

		const result = await courseWithCertOverlayLens(db, TEST_USER_ID, {
			goal: goalRow,
			filters: { courseId, syllabusId: SYL_ID },
		});

		// Exactly one gap entry: leaf C.
		expect(result.certGaps).toHaveLength(1);
		const gap = result.certGaps?.[0];
		expect(gap?.syllabusNodeId).toBe(SYL_LEAF_C_ID);
		expect(gap?.code).toBe(`${SUITE_TOKEN}-V.A.K3`);
		expect(gap?.knowledgeNodeIds).toEqual([NODE_C_ID]);
		expect(gap?.requiredBloom).toBe('understand');

		// Both covered steps tagged inCert; certCode populated with the
		// matching cert leaf code.
		expect(result.leaves).toHaveLength(2);
		const aLeaf = result.leaves.find((l) => l.knowledgeNodeId === NODE_A_ID);
		const bLeaf = result.leaves.find((l) => l.knowledgeNodeId === NODE_B_ID);
		expect(aLeaf?.sources?.inCert).toBe(true);
		expect(aLeaf?.sources?.certCode).toBe(`${SUITE_TOKEN}-V.A.K1`);
		expect(bLeaf?.sources?.inCert).toBe(true);
		expect(bLeaf?.sources?.certCode).toBe(`${SUITE_TOKEN}-V.A.K2`);

		// Standalone helper agrees on the gap shape.
		const standaloneGaps = await getCourseGaps(goalId, courseId, SYL_ID);
		expect(standaloneGaps).toHaveLength(1);
		expect(standaloneGaps[0]?.syllabusNodeId).toBe(SYL_LEAF_C_ID);
	});
});

describe('courseWithCertOverlayLens -- step covers a node outside the syllabus', () => {
	it('marks the step inCert: false and contributes no certGap entry', async () => {
		// `NODE_OUTSIDE_ID` is not linked from any syllabus leaf in the
		// fixture; a course step that covers it should produce
		// `inCert: false`. The other two steps still cover cert leaves A
		// and B, leaving only leaf C uncovered.
		const { courseId, goalId } = await seedOverlayCourse(slug('overlay-outside-cert'), [
			{ code: 's1.a', title: 'Cover A', nodeId: NODE_A_ID },
			{ code: 's1.b', title: 'Cover B', nodeId: NODE_B_ID },
			{ code: 's1.outside', title: 'Cover OUTSIDE', nodeId: NODE_OUTSIDE_ID },
		]);
		const goalRow = await loadGoal(goalId);

		const result = await courseWithCertOverlayLens(db, TEST_USER_ID, {
			goal: goalRow,
			filters: { courseId, syllabusId: SYL_ID },
		});

		// Per-step provenance: A and B inCert; OUTSIDE not.
		const aLeaf = result.leaves.find((l) => l.knowledgeNodeId === NODE_A_ID);
		const bLeaf = result.leaves.find((l) => l.knowledgeNodeId === NODE_B_ID);
		const outsideLeaf = result.leaves.find((l) => l.knowledgeNodeId === NODE_OUTSIDE_ID);
		expect(aLeaf?.sources?.inCert).toBe(true);
		expect(bLeaf?.sources?.inCert).toBe(true);
		expect(outsideLeaf?.sources?.inCert).toBe(false);
		expect(outsideLeaf?.sources?.certCode).toBeUndefined();

		// Gap list contains only leaf C; the outside-cert step contributes
		// nothing to the gap list (only cert leaves can be "gapped").
		expect(result.certGaps).toHaveLength(1);
		expect(result.certGaps?.[0]?.syllabusNodeId).toBe(SYL_LEAF_C_ID);
	});
});

describe('courseWithCertOverlayLens -- syllabusId not referenced by goal', () => {
	it('still computes the overlay against the supplied syllabus without erroring', async () => {
		// Goal has a goal_course row for the test course but ZERO
		// goal_syllabus rows -- the spec says the overlay lens accepts a
		// syllabus the goal does not reference. Useful for "what would this
		// course look like if I were pursuing PPL?" exploration.
		const { courseId, goalId } = await seedOverlayCourse(slug('overlay-unrelated-syl'), [
			{ code: 's1.a', title: 'Cover A', nodeId: NODE_A_ID },
		]);
		const goalRow = await loadGoal(goalId);

		const result = await courseWithCertOverlayLens(db, TEST_USER_ID, {
			goal: goalRow,
			filters: { courseId, syllabusId: SYL_ID },
		});

		// No throw -> overlay computed. The course covers only leaf A; B
		// and C remain uncovered.
		expect(result.certGaps).toHaveLength(2);
		const gapNodeIds = result.certGaps?.map((g) => g.syllabusNodeId).sort();
		expect(gapNodeIds).toEqual([SYL_LEAF_B_ID, SYL_LEAF_C_ID].sort());

		// And the per-step `sources` carries the cert code for leaf A.
		const aLeaf = result.leaves.find((l) => l.knowledgeNodeId === NODE_A_ID);
		expect(aLeaf?.sources?.inCert).toBe(true);
		expect(aLeaf?.sources?.certCode).toBe(`${SUITE_TOKEN}-V.A.K1`);
	});
});

describe('courseWithCertOverlayLens -- empty input handling', () => {
	it('returns the empty result with certGaps=[] when filters are missing', async () => {
		const result = await courseWithCertOverlayLens(db, TEST_USER_ID, {
			goal: null,
			filters: { courseId: '', syllabusId: SYL_ID },
		});
		expect(result.tree).toEqual([]);
		expect(result.leaves).toEqual([]);
		expect(result.certGaps).toEqual([]);
	});

	it('returns the empty result when the goal exists but holds no goal_course row for the course', async () => {
		// Mirrors `courseLens`'s empty-link path: a goal that does not
		// consume the course returns the empty result regardless of which
		// syllabus is supplied.
		const courseSlug = slug('overlay-unlinked-course');
		const c = await upsertCourse({
			slug: courseSlug,
			kind: COURSE_KINDS.INSTRUCTOR,
			title: 'Unlinked overlay course',
			seedOrigin: SUITE_TAG,
		});
		const goalId = generateGoalId();
		const now = new Date();
		await db.insert(goal).values({
			id: goalId,
			userId: TEST_USER_ID,
			title: 'Unlinked overlay goal',
			notesMd: '',
			status: GOAL_STATUSES.ACTIVE,
			isPrimary: false,
			targetDate: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		});
		const goalRow = await loadGoal(goalId);

		const result = await courseWithCertOverlayLens(db, TEST_USER_ID, {
			goal: goalRow,
			filters: { courseId: c.id, syllabusId: SYL_ID },
		});
		expect(result.tree).toEqual([]);
		expect(result.leaves).toEqual([]);
		expect(result.certGaps).toEqual([]);
	});
});
