/**
 * Course BC tests. Real Postgres -- the schema CHECK on
 * `course_step_consistency_check` and the `(course_id, code)` UNIQUE on
 * `course_step` are DB-enforced; the upsert idempotency test would silently
 * pass with a stub. Mirrors the goals.test.ts shape (suite-tagged ids,
 * single beforeAll / afterAll cleanup).
 *
 * Test surface (per docs/work-packages/course-primitive/tasks.md Phase 3):
 *
 *   1. upsertCourse idempotency on slug
 *   2. upsertCourseStep idempotency on (course_id, code)
 *   3. getCourseStepsByCourse: sections in ordinal order, steps in ordinal
 *      order under each section (parent_id NULLS FIRST, ordinal asc)
 *   4. getGoalNodeUnion with a course-only goal: every step's
 *      knowledge_node_id appears with goal_course.weight
 *   5. getGoalNodeUnion with a mixed goal (course + syllabus + ad-hoc):
 *      the shared node appears once, weight = max across paths
 *
 * Note on aggregation semantic: the course-primitive spec / design refer
 * to cross-source weight as "summed". The implementation preserves the
 * shipped MAX-of-paths behavior pinned by goals.test.ts ("takes the max
 * weight when a node is reachable via multiple paths") so cross-source
 * aggregation stays consistent across goal_syllabus + goal_node + the new
 * goal_course path. If product later wants a true sum, it lands as a
 * follow-on with a coordinated update to the existing test + spec/design.
 */

import { bauthUser } from '@ab/auth/schema';
import {
	COURSE_KINDS,
	COURSE_STATUSES,
	COURSE_STEP_LEVELS,
	GOAL_SYLLABUS_WEIGHT_MAX,
	GOAL_SYLLABUS_WEIGHT_MIN,
	SYLLABUS_STATUSES,
} from '@ab/constants';
import { db } from '@ab/db/connection';
import { generateAuthId, generateSyllabusId, generateSyllabusNodeId, generateSyllabusNodeLinkId } from '@ab/utils';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	deleteCourseRow,
	deleteCourseStep,
	getCourseById,
	getCourseBySlug,
	getCourseStepByCode,
	getCourseStepsByCourse,
	getCoursesByGoal,
	listAllCourses,
	listCoursesForReader,
	pickOverlaySyllabus,
	upsertCourse,
	upsertCourseStep,
} from '../courses';
import {
	CourseAlreadyInGoalError,
	CourseNotActiveError,
	CourseNotFoundError,
	CourseNotInGoalError,
	GoalNotOwnedError,
	addGoalCourse,
	addGoalNode,
	addGoalSyllabus,
	createGoal,
	getGoalCourseLinks,
	getGoalNodeUnion,
	removeGoalCourse,
	setGoalCourseWeight,
} from '../goals';
import {
	course,
	courseStep,
	goal,
	goalCourse,
	goalSyllabus,
	knowledgeNode,
	syllabus,
	syllabusNode,
	syllabusNodeLink,
} from '../schema';

const SUITE_TAG = `course-test-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const SUITE_TOKEN = Math.floor(Math.random() * 0x100_000_000)
	.toString(16)
	.padStart(8, '0');
const slug = (s: string): string => `${s}-${SUITE_TOKEN}`;

const TEST_USER_ID = generateAuthId();

// Knowledge-node ids referenced by the course steps below. The shared node
// (`SHARED_NODE_ID`) is reachable via BOTH the test course and the test
// syllabus -- the mixed-goal scenario asserts that aggregation dedupes it.
const NODE_A_ID = `kn-${SUITE_TAG}-a`;
const NODE_B_ID = `kn-${SUITE_TAG}-b`;
const SHARED_NODE_ID = `kn-${SUITE_TAG}-shared`;
const ADHOC_NODE_ID = `kn-${SUITE_TAG}-adhoc`;

// Test syllabus + leaf -- gives the mixed-goal scenario a syllabus path
// reaching SHARED_NODE_ID via syllabus_node_link.
const SYL_ID = generateSyllabusId();
const SYL_SLUG = slug('test-syl');
const AREA_ID = generateSyllabusNodeId();
const TASK_ID = generateSyllabusNodeId();
const ELEMENT_ID = generateSyllabusNodeId();

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values({
		id: TEST_USER_ID,
		email: `${SUITE_TAG}@airboss.test`,
		name: 'Course BC Test',
		firstName: 'Course',
		lastName: 'Test',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});

	await db.insert(knowledgeNode).values(
		[NODE_A_ID, NODE_B_ID, SHARED_NODE_ID, ADHOC_NODE_ID].map((id) => ({
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

	// Syllabus + tree -- one leaf reaches SHARED_NODE_ID through
	// syllabus_node_link, exercising the cross-source dedup in test #5.
	await db.insert(syllabus).values({
		id: SYL_ID,
		slug: SYL_SLUG,
		kind: 'acs',
		title: 'Test syllabus for course union',
		edition: `faa-s-acs-${SUITE_TOKEN}`,
		status: SYLLABUS_STATUSES.ACTIVE,
		seedOrigin: SUITE_TAG,
		createdAt: now,
		updatedAt: now,
	});
	await db.insert(syllabusNode).values([
		{
			id: AREA_ID,
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
			id: TASK_ID,
			syllabusId: SYL_ID,
			parentId: AREA_ID,
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
			id: ELEMENT_ID,
			syllabusId: SYL_ID,
			parentId: TASK_ID,
			level: 'element',
			ordinal: 1,
			code: `${SUITE_TOKEN}-V.A.K1`,
			title: 'Shared Element',
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
	]);
	await db.insert(syllabusNodeLink).values({
		id: generateSyllabusNodeLinkId(),
		syllabusNodeId: ELEMENT_ID,
		knowledgeNodeId: SHARED_NODE_ID,
		weight: 1.0,
		notes: '',
		seedOrigin: SUITE_TAG,
		createdAt: now,
	});
});

afterAll(async () => {
	// Order matters: child rows (goal_node / goal_syllabus / goal_course)
	// cascade on goal delete via FK ON DELETE CASCADE, but goal_course.course_id
	// is RESTRICT, so we must clear those links before deleting courses.
	await db.delete(goal).where(eq(goal.userId, TEST_USER_ID));
	await db.delete(courseStep).where(eq(courseStep.seedOrigin, SUITE_TAG));
	await db.delete(course).where(eq(course.seedOrigin, SUITE_TAG));
	await db.delete(syllabusNodeLink).where(eq(syllabusNodeLink.seedOrigin, SUITE_TAG));
	await db.delete(syllabusNode).where(eq(syllabusNode.seedOrigin, SUITE_TAG));
	await db.delete(syllabus).where(eq(syllabus.seedOrigin, SUITE_TAG));
	await db.delete(knowledgeNode).where(eq(knowledgeNode.seedOrigin, SUITE_TAG));
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

describe('upsertCourse', () => {
	it('is idempotent on slug -- second upsert returns the same row id', async () => {
		const courseSlug = slug('idempotent-course');
		const first = await upsertCourse({
			slug: courseSlug,
			kind: COURSE_KINDS.INSTRUCTOR,
			title: 'First write',
			description: 'first',
			status: COURSE_STATUSES.ACTIVE,
			seedOrigin: SUITE_TAG,
		});
		const second = await upsertCourse({
			slug: courseSlug,
			kind: COURSE_KINDS.INSTRUCTOR,
			title: 'Updated title',
			description: 'updated',
			status: COURSE_STATUSES.ACTIVE,
			seedOrigin: SUITE_TAG,
		});
		expect(second.id).toBe(first.id);
		expect(second.slug).toBe(courseSlug);
		expect(second.title).toBe('Updated title');
		expect(second.description).toBe('updated');

		// Symmetric post-condition: exactly one row exists for the slug.
		const rows = await db.select().from(course).where(eq(course.slug, courseSlug));
		expect(rows).toHaveLength(1);
	});

	it('defaults description to empty string and status to active', async () => {
		const courseSlug = slug('defaults-course');
		const row = await upsertCourse({
			slug: courseSlug,
			kind: COURSE_KINDS.INSTRUCTOR,
			title: 'Defaults',
			seedOrigin: SUITE_TAG,
		});
		expect(row.description).toBe('');
		expect(row.status).toBe(COURSE_STATUSES.ACTIVE);
	});
});

describe('upsertCourseStep', () => {
	it('is idempotent on (course_id, code) -- second upsert returns the same row id', async () => {
		const courseSlug = slug('step-idempotent-course');
		const c = await upsertCourse({
			slug: courseSlug,
			kind: COURSE_KINDS.INSTRUCTOR,
			title: 'Step idempotent course',
			seedOrigin: SUITE_TAG,
		});
		const section = await upsertCourseStep({
			courseId: c.id,
			parentId: null,
			level: COURSE_STEP_LEVELS.SECTION,
			ordinal: 1,
			code: 's1',
			title: 'Section 1',
			bodyMd: 'first body',
			knowledgeNodeId: null,
			contentHash: 'hash-section-1',
			seedOrigin: SUITE_TAG,
		});
		const sectionAgain = await upsertCourseStep({
			courseId: c.id,
			parentId: null,
			level: COURSE_STEP_LEVELS.SECTION,
			ordinal: 1,
			code: 's1',
			title: 'Section 1 (rewritten)',
			bodyMd: 'second body',
			knowledgeNodeId: null,
			contentHash: 'hash-section-1-v2',
			seedOrigin: SUITE_TAG,
		});
		expect(sectionAgain.id).toBe(section.id);
		expect(sectionAgain.title).toBe('Section 1 (rewritten)');
		expect(sectionAgain.bodyMd).toBe('second body');
		expect(sectionAgain.contentHash).toBe('hash-section-1-v2');
		// is_leaf stays false for sections regardless of caller input.
		expect(sectionAgain.isLeaf).toBe(false);

		// Step under that section, then re-upsert.
		const step = await upsertCourseStep({
			courseId: c.id,
			parentId: section.id,
			level: COURSE_STEP_LEVELS.STEP,
			ordinal: 1,
			code: 's1.1',
			title: 'Step 1.1',
			bodyMd: 'step body',
			knowledgeNodeId: NODE_A_ID,
			contentHash: 'hash-step-1.1',
			seedOrigin: SUITE_TAG,
		});
		const stepAgain = await upsertCourseStep({
			courseId: c.id,
			parentId: section.id,
			level: COURSE_STEP_LEVELS.STEP,
			ordinal: 1,
			code: 's1.1',
			title: 'Step 1.1 (rewritten)',
			bodyMd: 'step body v2',
			knowledgeNodeId: NODE_A_ID,
			contentHash: 'hash-step-1.1-v2',
			seedOrigin: SUITE_TAG,
		});
		expect(stepAgain.id).toBe(step.id);
		expect(stepAgain.title).toBe('Step 1.1 (rewritten)');
		// Steps are leaves -- BC-set flag, never trusted from caller input.
		expect(stepAgain.isLeaf).toBe(true);
	});
});

describe('getCourseStepsByCourse', () => {
	it('returns sections before steps, each ordered by ordinal under their parent', async () => {
		const courseSlug = slug('tree-walk-course');
		const c = await upsertCourse({
			slug: courseSlug,
			kind: COURSE_KINDS.INSTRUCTOR,
			title: 'Tree walk course',
			seedOrigin: SUITE_TAG,
		});

		// Two sections, intentionally inserted out of ordinal order to prove
		// the read sorts. Each section has two child steps inserted out of
		// order.
		const s2 = await upsertCourseStep({
			courseId: c.id,
			parentId: null,
			level: COURSE_STEP_LEVELS.SECTION,
			ordinal: 2,
			code: 's2',
			title: 'Section 2',
			bodyMd: '',
			knowledgeNodeId: null,
			contentHash: 'tree-s2',
			seedOrigin: SUITE_TAG,
		});
		const s1 = await upsertCourseStep({
			courseId: c.id,
			parentId: null,
			level: COURSE_STEP_LEVELS.SECTION,
			ordinal: 1,
			code: 's1',
			title: 'Section 1',
			bodyMd: '',
			knowledgeNodeId: null,
			contentHash: 'tree-s1',
			seedOrigin: SUITE_TAG,
		});
		await upsertCourseStep({
			courseId: c.id,
			parentId: s1.id,
			level: COURSE_STEP_LEVELS.STEP,
			ordinal: 2,
			code: 's1.b',
			title: 'Step s1.b',
			bodyMd: '',
			knowledgeNodeId: NODE_A_ID,
			contentHash: 'tree-s1.b',
			seedOrigin: SUITE_TAG,
		});
		await upsertCourseStep({
			courseId: c.id,
			parentId: s1.id,
			level: COURSE_STEP_LEVELS.STEP,
			ordinal: 1,
			code: 's1.a',
			title: 'Step s1.a',
			bodyMd: '',
			knowledgeNodeId: NODE_B_ID,
			contentHash: 'tree-s1.a',
			seedOrigin: SUITE_TAG,
		});
		await upsertCourseStep({
			courseId: c.id,
			parentId: s2.id,
			level: COURSE_STEP_LEVELS.STEP,
			ordinal: 1,
			code: 's2.a',
			title: 'Step s2.a',
			bodyMd: '',
			knowledgeNodeId: SHARED_NODE_ID,
			contentHash: 'tree-s2.a',
			seedOrigin: SUITE_TAG,
		});

		const steps = await getCourseStepsByCourse(c.id);
		// Expected order: parent_id NULLS FIRST (sections before steps),
		// then ordinal ascending within each parent. Sections come back in
		// ordinal order, then the rows under s1 (smaller id ordinal-wise)
		// before rows under s2 (larger id) -- the parent_id ordering is by
		// the column's natural sort. The contract guaranteed by the BC: a
		// caller that walks the result and groups by parent_id sees the
		// children in ordinal order; sections themselves arrive before any
		// step row. Assertions below pin both shapes.
		const sectionRows = steps.filter((s) => s.level === COURSE_STEP_LEVELS.SECTION);
		expect(sectionRows.map((s) => s.code)).toEqual(['s1', 's2']);

		const s1Children = steps.filter((s) => s.parentId === s1.id);
		expect(s1Children.map((s) => s.code)).toEqual(['s1.a', 's1.b']);

		const s2Children = steps.filter((s) => s.parentId === s2.id);
		expect(s2Children.map((s) => s.code)).toEqual(['s2.a']);

		// Sanity: every section row precedes every step row in the result
		// (parent_id NULLS FIRST asc clause).
		const firstStepIdx = steps.findIndex((s) => s.level === COURSE_STEP_LEVELS.STEP);
		const lastSectionIdx = steps.map((s) => s.level).lastIndexOf(COURSE_STEP_LEVELS.SECTION);
		expect(lastSectionIdx).toBeLessThan(firstStepIdx);

		// Round-trip via getCourseBySlug.
		const fetched = await getCourseBySlug(courseSlug);
		expect(fetched?.id).toBe(c.id);
	});
});

describe('getGoalNodeUnion -- course extension', () => {
	it('walks course-only goal: every step contributes its node at goal_course.weight', async () => {
		const courseSlug = slug('course-only-goal-course');
		const c = await upsertCourse({
			slug: courseSlug,
			kind: COURSE_KINDS.INSTRUCTOR,
			title: 'Course-only goal',
			seedOrigin: SUITE_TAG,
		});
		const section = await upsertCourseStep({
			courseId: c.id,
			parentId: null,
			level: COURSE_STEP_LEVELS.SECTION,
			ordinal: 1,
			code: 's1',
			title: 'Section 1',
			bodyMd: '',
			knowledgeNodeId: null,
			contentHash: 'cog-s1',
			seedOrigin: SUITE_TAG,
		});
		await upsertCourseStep({
			courseId: c.id,
			parentId: section.id,
			level: COURSE_STEP_LEVELS.STEP,
			ordinal: 1,
			code: 's1.1',
			title: 'Step 1.1',
			bodyMd: '',
			knowledgeNodeId: NODE_A_ID,
			contentHash: 'cog-s1.1',
			seedOrigin: SUITE_TAG,
		});
		await upsertCourseStep({
			courseId: c.id,
			parentId: section.id,
			level: COURSE_STEP_LEVELS.STEP,
			ordinal: 2,
			code: 's1.2',
			title: 'Step 1.2',
			bodyMd: '',
			knowledgeNodeId: NODE_B_ID,
			contentHash: 'cog-s1.2',
			seedOrigin: SUITE_TAG,
		});

		const g = await createGoal({ userId: TEST_USER_ID, title: 'course-only goal', notesMd: '', isPrimary: false });
		const now = new Date();
		await db.insert(goalCourse).values({
			goalId: g.id,
			courseId: c.id,
			weight: 0.75,
			seedOrigin: SUITE_TAG,
			createdAt: now,
		});

		const union = await getGoalNodeUnion(g.id);
		expect(union.knowledgeNodeIds.sort()).toEqual([NODE_A_ID, NODE_B_ID].sort());
		expect(union.weights[NODE_A_ID]).toBeCloseTo(0.75);
		expect(union.weights[NODE_B_ID]).toBeCloseTo(0.75);

		// getCoursesByGoal round-trips the link.
		const courses = await getCoursesByGoal(g.id);
		expect(courses.map((cc) => cc.id)).toEqual([c.id]);
	});

	it('mixed goal (course + syllabus + ad-hoc) dedupes a node reachable via multiple sources', async () => {
		const courseSlug = slug('mixed-goal-course');
		const c = await upsertCourse({
			slug: courseSlug,
			kind: COURSE_KINDS.INSTRUCTOR,
			title: 'Mixed goal course',
			seedOrigin: SUITE_TAG,
		});
		const section = await upsertCourseStep({
			courseId: c.id,
			parentId: null,
			level: COURSE_STEP_LEVELS.SECTION,
			ordinal: 1,
			code: 's1',
			title: 'Section 1',
			bodyMd: '',
			knowledgeNodeId: null,
			contentHash: 'mx-s1',
			seedOrigin: SUITE_TAG,
		});
		// SHARED_NODE_ID is also reachable via the test syllabus_node_link
		// from beforeAll. The course path runs at goal_course.weight=2.0.
		// The syllabus path runs at goal_syllabus.weight=0.4 *
		// link_weight=1.0 = 0.4. Max-of-paths = 2.0 (course wins). The
		// adhoc path on SHARED_NODE_ID runs at 0.1; max stays 2.0.
		await upsertCourseStep({
			courseId: c.id,
			parentId: section.id,
			level: COURSE_STEP_LEVELS.STEP,
			ordinal: 1,
			code: 's1.shared',
			title: 'Shared step',
			bodyMd: '',
			knowledgeNodeId: SHARED_NODE_ID,
			contentHash: 'mx-s1.shared',
			seedOrigin: SUITE_TAG,
		});
		await upsertCourseStep({
			courseId: c.id,
			parentId: section.id,
			level: COURSE_STEP_LEVELS.STEP,
			ordinal: 2,
			code: 's1.unique',
			title: 'Course-unique step',
			bodyMd: '',
			knowledgeNodeId: NODE_A_ID,
			contentHash: 'mx-s1.unique',
			seedOrigin: SUITE_TAG,
		});

		const g = await createGoal({ userId: TEST_USER_ID, title: 'mixed goal', notesMd: '', isPrimary: false });
		const now = new Date();
		await db.insert(goalCourse).values({
			goalId: g.id,
			courseId: c.id,
			weight: 2.0,
			seedOrigin: SUITE_TAG,
			createdAt: now,
		});
		await addGoalSyllabus(g.id, TEST_USER_ID, { syllabusId: SYL_ID, weight: 0.4 });
		await addGoalNode(g.id, TEST_USER_ID, { knowledgeNodeId: SHARED_NODE_ID, weight: 0.1, notes: '' });
		await addGoalNode(g.id, TEST_USER_ID, { knowledgeNodeId: ADHOC_NODE_ID, weight: 1.5, notes: '' });

		const union = await getGoalNodeUnion(g.id);
		// Three unique nodes:
		//   - SHARED_NODE_ID (course + syllabus + adhoc paths)
		//   - NODE_A_ID (course path only)
		//   - ADHOC_NODE_ID (adhoc path only)
		expect(union.knowledgeNodeIds.sort()).toEqual([ADHOC_NODE_ID, NODE_A_ID, SHARED_NODE_ID].sort());
		// Shared node deduped: appears once. Weight = max across three
		// paths (course=2.0, syllabus=0.4, adhoc=0.1).
		expect(union.weights[SHARED_NODE_ID]).toBeCloseTo(2.0);
		expect(union.weights[NODE_A_ID]).toBeCloseTo(2.0);
		expect(union.weights[ADHOC_NODE_ID]).toBeCloseTo(1.5);
	});
});

// ---------------------------------------------------------------------------
// Reader / editor read paths (course-reader-and-editor WP, Phase 1)
// ---------------------------------------------------------------------------

describe('listCoursesForReader', () => {
	it('filters by status and sorts by title ASC', async () => {
		const activeSlug = slug('reader-active');
		const draftSlug = slug('reader-draft');
		const archivedSlug = slug('reader-archived');
		await upsertCourse({
			slug: archivedSlug,
			kind: COURSE_KINDS.INSTRUCTOR,
			title: 'Z reader-archived',
			status: COURSE_STATUSES.ARCHIVED,
			seedOrigin: SUITE_TAG,
		});
		await upsertCourse({
			slug: activeSlug,
			kind: COURSE_KINDS.INSTRUCTOR,
			title: 'A reader-active',
			status: COURSE_STATUSES.ACTIVE,
			seedOrigin: SUITE_TAG,
		});
		await upsertCourse({
			slug: draftSlug,
			kind: COURSE_KINDS.INSTRUCTOR,
			title: 'M reader-draft',
			status: COURSE_STATUSES.DRAFT,
			seedOrigin: SUITE_TAG,
		});

		const activeOnly = await listCoursesForReader(db, { statusIn: [COURSE_STATUSES.ACTIVE] });
		const activeSlugs = activeOnly.map((c) => c.slug);
		expect(activeSlugs).toContain(activeSlug);
		expect(activeSlugs).not.toContain(draftSlug);
		expect(activeSlugs).not.toContain(archivedSlug);

		const activeAndArchived = await listCoursesForReader(db, {
			statusIn: [COURSE_STATUSES.ACTIVE, COURSE_STATUSES.ARCHIVED],
		});
		const activeAndArchivedSlugs = activeAndArchived.map((c) => c.slug);
		expect(activeAndArchivedSlugs).toContain(activeSlug);
		expect(activeAndArchivedSlugs).toContain(archivedSlug);
		expect(activeAndArchivedSlugs).not.toContain(draftSlug);

		// Sort stability: titles within the suite arrive in ASC order.
		const inSuite = activeAndArchived.filter((c) => c.slug.endsWith(SUITE_TOKEN));
		const titles = inSuite.map((c) => c.title);
		const sortedTitles = [...titles].sort((a, b) => a.localeCompare(b));
		expect(titles).toEqual(sortedTitles);
	});

	it('returns every status when statusIn is omitted', async () => {
		const all = await listCoursesForReader(db);
		// At minimum, the rows planted above must appear (regardless of pre-suite content).
		const slugs = new Set(all.map((c) => c.slug));
		expect(slugs.has(slug('reader-active'))).toBe(true);
		expect(slugs.has(slug('reader-draft'))).toBe(true);
		expect(slugs.has(slug('reader-archived'))).toBe(true);
	});
});

describe('listAllCourses', () => {
	it('returns every course regardless of status, ordered by updated_at DESC', async () => {
		const all = await listAllCourses(db);
		const slugs = new Set(all.map((c) => c.slug));
		// All three suite-planted courses are present (active + draft + archived).
		expect(slugs.has(slug('reader-active'))).toBe(true);
		expect(slugs.has(slug('reader-draft'))).toBe(true);
		expect(slugs.has(slug('reader-archived'))).toBe(true);
		// updated_at descends across rows.
		for (let i = 1; i < all.length; i += 1) {
			const previous = all[i - 1];
			const current = all[i];
			if (previous && current) {
				expect(previous.updatedAt.getTime()).toBeGreaterThanOrEqual(current.updatedAt.getTime());
			}
		}
	});
});

describe('getCourseById', () => {
	it('returns the row for a known id and null for an unknown id', async () => {
		const courseSlug = slug('by-id-course');
		const c = await upsertCourse({
			slug: courseSlug,
			kind: COURSE_KINDS.INSTRUCTOR,
			title: 'By id course',
			seedOrigin: SUITE_TAG,
		});
		const row = await getCourseById(c.id);
		expect(row?.id).toBe(c.id);
		expect(row?.slug).toBe(courseSlug);

		const missing = await getCourseById('crs_does_not_exist');
		expect(missing).toBeNull();
	});
});

describe('getCourseStepByCode', () => {
	it('returns the row for a known (courseId, code) and null otherwise', async () => {
		const courseSlug = slug('step-by-code-course');
		const c = await upsertCourse({
			slug: courseSlug,
			kind: COURSE_KINDS.INSTRUCTOR,
			title: 'Step-by-code course',
			seedOrigin: SUITE_TAG,
		});
		const section = await upsertCourseStep({
			courseId: c.id,
			parentId: null,
			level: COURSE_STEP_LEVELS.SECTION,
			ordinal: 1,
			code: 'sbc-s1',
			title: 'Section',
			bodyMd: '',
			knowledgeNodeId: null,
			contentHash: 'sbc-s1-hash',
			seedOrigin: SUITE_TAG,
		});
		const step = await upsertCourseStep({
			courseId: c.id,
			parentId: section.id,
			level: COURSE_STEP_LEVELS.STEP,
			ordinal: 1,
			code: 'sbc-s1.1',
			title: 'Step 1',
			bodyMd: '',
			knowledgeNodeId: NODE_A_ID,
			contentHash: 'sbc-s1.1-hash',
			seedOrigin: SUITE_TAG,
		});

		const fetchedStep = await getCourseStepByCode(c.id, 'sbc-s1.1');
		expect(fetchedStep?.id).toBe(step.id);
		expect(fetchedStep?.knowledgeNodeId).toBe(NODE_A_ID);

		const fetchedSection = await getCourseStepByCode(c.id, 'sbc-s1');
		expect(fetchedSection?.id).toBe(section.id);

		const missing = await getCourseStepByCode(c.id, 'sbc-not-found');
		expect(missing).toBeNull();
	});
});

describe('deleteCourseStep + deleteCourseRow', () => {
	it('deleteCourseStep removes only the targeted row', async () => {
		const courseSlug = slug('del-step-course');
		const c = await upsertCourse({
			slug: courseSlug,
			kind: COURSE_KINDS.INSTRUCTOR,
			title: 'Del step course',
			seedOrigin: SUITE_TAG,
		});
		const section = await upsertCourseStep({
			courseId: c.id,
			parentId: null,
			level: COURSE_STEP_LEVELS.SECTION,
			ordinal: 1,
			code: 'ds-s1',
			title: 'Section',
			bodyMd: '',
			knowledgeNodeId: null,
			contentHash: 'ds-s1-hash',
			seedOrigin: SUITE_TAG,
		});
		const step = await upsertCourseStep({
			courseId: c.id,
			parentId: section.id,
			level: COURSE_STEP_LEVELS.STEP,
			ordinal: 1,
			code: 'ds-s1.1',
			title: 'Step',
			bodyMd: '',
			knowledgeNodeId: NODE_A_ID,
			contentHash: 'ds-s1.1-hash',
			seedOrigin: SUITE_TAG,
		});

		await deleteCourseStep(step.id);
		const remaining = await getCourseStepsByCourse(c.id);
		expect(remaining.find((r) => r.id === step.id)).toBeUndefined();
		expect(remaining.find((r) => r.id === section.id)).toBeDefined();
	});

	it('deleteCourseRow cascades to course_step rows', async () => {
		const courseSlug = slug('del-row-cascade-course');
		const c = await upsertCourse({
			slug: courseSlug,
			kind: COURSE_KINDS.INSTRUCTOR,
			title: 'Del row cascade course',
			seedOrigin: SUITE_TAG,
		});
		const section = await upsertCourseStep({
			courseId: c.id,
			parentId: null,
			level: COURSE_STEP_LEVELS.SECTION,
			ordinal: 1,
			code: 'drc-s1',
			title: 'Section',
			bodyMd: '',
			knowledgeNodeId: null,
			contentHash: 'drc-s1-hash',
			seedOrigin: SUITE_TAG,
		});
		await upsertCourseStep({
			courseId: c.id,
			parentId: section.id,
			level: COURSE_STEP_LEVELS.STEP,
			ordinal: 1,
			code: 'drc-s1.1',
			title: 'Step',
			bodyMd: '',
			knowledgeNodeId: NODE_A_ID,
			contentHash: 'drc-s1.1-hash',
			seedOrigin: SUITE_TAG,
		});

		await deleteCourseRow(c.id);
		const fetched = await getCourseById(c.id);
		expect(fetched).toBeNull();
		// All steps gone too (FK cascade).
		const orphans = await db.select().from(courseStep).where(eq(courseStep.courseId, c.id));
		expect(orphans).toHaveLength(0);
	});
});

describe('pickOverlaySyllabus', () => {
	it('returns null when goal is null', async () => {
		expect(await pickOverlaySyllabus(null)).toBeNull();
	});

	it('returns null when goal holds zero goal_syllabus rows', async () => {
		const g = await createGoal({
			userId: TEST_USER_ID,
			title: 'no-syllabi goal',
			notesMd: '',
			isPrimary: false,
		});
		const goalRow = await db.select().from(goal).where(eq(goal.id, g.id)).limit(1);
		const row = goalRow[0];
		if (!row) throw new Error('goal seed failed');
		expect(await pickOverlaySyllabus(row)).toBeNull();
	});

	it('returns the highest-weight syllabus, ties broken by syllabus_id ASC', async () => {
		// Plant a second syllabus so the tie-break path is exercised. The one
		// from beforeAll (SYL_ID) is already available; add another.
		const SECOND_SYL_ID = generateSyllabusId();
		const now = new Date();
		await db.insert(syllabus).values({
			id: SECOND_SYL_ID,
			slug: slug('test-syl-overlay-second'),
			kind: 'acs',
			title: 'Second test syllabus',
			edition: `faa-s-acs-${SUITE_TOKEN}-2`,
			status: SYLLABUS_STATUSES.ACTIVE,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		});

		const g = await createGoal({
			userId: TEST_USER_ID,
			title: 'overlay-pick goal',
			notesMd: '',
			isPrimary: false,
		});
		const goalRow = await db.select().from(goal).where(eq(goal.id, g.id)).limit(1);
		const row = goalRow[0];
		if (!row) throw new Error('goal seed failed');

		// Equal weights -- tie-break should pick the lexically smaller syllabus_id.
		await addGoalSyllabus(g.id, TEST_USER_ID, { syllabusId: SYL_ID, weight: 1.0 });
		await addGoalSyllabus(g.id, TEST_USER_ID, { syllabusId: SECOND_SYL_ID, weight: 1.0 });
		const tied = await pickOverlaySyllabus(row);
		const expectedTie = [SYL_ID, SECOND_SYL_ID].sort()[0];
		expect(tied).toBe(expectedTie);

		// Differing weights -- highest wins regardless of id order.
		const heavierSylId = SYL_ID === expectedTie ? SECOND_SYL_ID : SYL_ID;
		// We want the OPPOSITE of the tie-break winner to win on weight.
		await db
			.update(goalSyllabus)
			.set({ weight: 5.0 })
			.where(and(eq(goalSyllabus.goalId, g.id), eq(goalSyllabus.syllabusId, heavierSylId)));
		const winner = await pickOverlaySyllabus(row);
		expect(winner).toBe(heavierSylId);
	});
});

// Goal-course BC helpers (course-reader-and-editor WP review fixes). These
// own the goal-ownership check, the course-exists/active validation, the
// in-goal check, and the idempotent conflict handling that the goal
// composer's `addCourse` / `removeCourse` / `setCourseWeight` actions
// previously inlined as raw Drizzle. Real Postgres: the `goal_course`
// composite PK and the `goal_course_weight_check` CHECK are DB-enforced, so
// the conflict + range behaviour cannot be verified against a stub.
describe('addGoalCourse / removeGoalCourse / setGoalCourseWeight / getGoalCourseLinks', () => {
	async function makeActiveCourse(label: string) {
		return upsertCourse({
			slug: slug(label),
			kind: COURSE_KINDS.INSTRUCTOR,
			title: `Goal-course test ${label}`,
			status: COURSE_STATUSES.ACTIVE,
			seedOrigin: SUITE_TAG,
		});
	}

	it('addGoalCourse links a course and getGoalCourseLinks returns it with its weight', async () => {
		const g = await createGoal({ userId: TEST_USER_ID, title: 'gc-add', notesMd: '', isPrimary: false });
		const c = await makeActiveCourse('gc-add');
		const row = await addGoalCourse(g.id, TEST_USER_ID, { courseId: c.id, weight: 0.7 });
		expect(row.courseId).toBe(c.id);
		expect(row.weight).toBeCloseTo(0.7);

		const links = await getGoalCourseLinks(g.id);
		expect(links).toHaveLength(1);
		expect(links[0]?.courseId).toBe(c.id);
		expect(links[0]?.weight).toBeCloseTo(0.7);
	});

	it('addGoalCourse rejects a course that is not active', async () => {
		const g = await createGoal({ userId: TEST_USER_ID, title: 'gc-archived', notesMd: '', isPrimary: false });
		const archived = await upsertCourse({
			slug: slug('gc-archived'),
			kind: COURSE_KINDS.INSTRUCTOR,
			title: 'Archived course',
			status: COURSE_STATUSES.ARCHIVED,
			seedOrigin: SUITE_TAG,
		});
		await expect(addGoalCourse(g.id, TEST_USER_ID, { courseId: archived.id })).rejects.toBeInstanceOf(
			CourseNotActiveError,
		);
	});

	it('addGoalCourse rejects a courseId that matches no course row', async () => {
		const g = await createGoal({ userId: TEST_USER_ID, title: 'gc-missing', notesMd: '', isPrimary: false });
		await expect(addGoalCourse(g.id, TEST_USER_ID, { courseId: 'crs_does_not_exist' })).rejects.toBeInstanceOf(
			CourseNotFoundError,
		);
	});

	it('addGoalCourse rejects a course already linked to the goal (idempotent conflict)', async () => {
		const g = await createGoal({ userId: TEST_USER_ID, title: 'gc-dup', notesMd: '', isPrimary: false });
		const c = await makeActiveCourse('gc-dup');
		await addGoalCourse(g.id, TEST_USER_ID, { courseId: c.id, weight: 1.0 });
		await expect(addGoalCourse(g.id, TEST_USER_ID, { courseId: c.id, weight: 1.0 })).rejects.toBeInstanceOf(
			CourseAlreadyInGoalError,
		);
		// The duplicate attempt left exactly one link row.
		const links = await getGoalCourseLinks(g.id);
		expect(links).toHaveLength(1);
	});

	it('addGoalCourse rejects a goal owned by a different user', async () => {
		const g = await createGoal({ userId: TEST_USER_ID, title: 'gc-owner', notesMd: '', isPrimary: false });
		const c = await makeActiveCourse('gc-owner');
		await expect(addGoalCourse(g.id, generateAuthId(), { courseId: c.id })).rejects.toBeInstanceOf(GoalNotOwnedError);
	});

	it('addGoalCourse rejects an out-of-range weight before any DB write', async () => {
		const g = await createGoal({ userId: TEST_USER_ID, title: 'gc-range', notesMd: '', isPrimary: false });
		const c = await makeActiveCourse('gc-range');
		await expect(
			addGoalCourse(g.id, TEST_USER_ID, { courseId: c.id, weight: GOAL_SYLLABUS_WEIGHT_MAX + 1 }),
		).rejects.toThrow();
		await expect(
			addGoalCourse(g.id, TEST_USER_ID, { courseId: c.id, weight: GOAL_SYLLABUS_WEIGHT_MIN - 1 }),
		).rejects.toThrow();
		// No partial link was written.
		expect(await getGoalCourseLinks(g.id)).toHaveLength(0);
	});

	it('removeGoalCourse deletes the link; a second remove throws CourseNotInGoalError', async () => {
		const g = await createGoal({ userId: TEST_USER_ID, title: 'gc-remove', notesMd: '', isPrimary: false });
		const c = await makeActiveCourse('gc-remove');
		await addGoalCourse(g.id, TEST_USER_ID, { courseId: c.id, weight: 1.0 });
		await removeGoalCourse(g.id, TEST_USER_ID, c.id);
		expect(await getGoalCourseLinks(g.id)).toHaveLength(0);
		// Removing a course that is no longer in the goal must not report success.
		await expect(removeGoalCourse(g.id, TEST_USER_ID, c.id)).rejects.toBeInstanceOf(CourseNotInGoalError);
	});

	it('setGoalCourseWeight updates the weight; rejects a course not in the goal', async () => {
		const g = await createGoal({ userId: TEST_USER_ID, title: 'gc-weight', notesMd: '', isPrimary: false });
		const c = await makeActiveCourse('gc-weight');
		await addGoalCourse(g.id, TEST_USER_ID, { courseId: c.id, weight: 1.0 });
		await setGoalCourseWeight(g.id, TEST_USER_ID, c.id, 0.25);
		const links = await getGoalCourseLinks(g.id);
		expect(links[0]?.weight).toBeCloseTo(0.25);

		const other = await makeActiveCourse('gc-weight-other');
		await expect(setGoalCourseWeight(g.id, TEST_USER_ID, other.id, 0.5)).rejects.toBeInstanceOf(
			CourseNotInGoalError,
		);
	});
});
