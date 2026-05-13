/**
 * DB-level course_step_consistency_check tests
 * (course-tree-arbitrary-depth WP Phase A; test-plan.md T1.x).
 *
 * Runs against the local dev Postgres. The 3-arm CHECK predicate is
 * DB-enforced; mocking it out would silently pass on a stub. Each test
 * inserts (via Drizzle) or attempts to insert (via raw SQL, when the
 * Drizzle type would forbid the illegal shape pre-emptively) a single
 * course_step row and asserts either success or the constraint
 * violation that the predicate is meant to catch.
 *
 * Tests use suite-tagged ids + a single afterAll cleanup, mirroring
 * the shape of __tests__/courses.test.ts.
 */

import { bauthUser } from '@ab/auth/schema';
import { COURSE_KINDS, COURSE_STATUSES, COURSE_STEP_LEVELS } from '@ab/constants';
import { db } from '@ab/db/connection';
import { generateAuthId } from '@ab/utils';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { upsertCourse, upsertCourseStep } from '../courses';
import { course, courseStep, knowledgeNode } from '../schema';

const SUITE_TAG = `course-check-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const SUITE_TOKEN = Math.floor(Math.random() * 0x100_000_000)
	.toString(16)
	.padStart(8, '0');
const slug = (s: string): string => `${s}-${SUITE_TOKEN}`;

const TEST_USER_ID = generateAuthId();
const NODE_A_ID = `kn-${SUITE_TAG}-a`;
const NODE_B_ID = `kn-${SUITE_TAG}-b`;

let testCourseId = '';

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values({
		id: TEST_USER_ID,
		email: `${SUITE_TAG}@airboss.test`,
		name: 'Course CHECK Test',
		firstName: 'Course',
		lastName: 'Test',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});
	await db.insert(knowledgeNode).values(
		[NODE_A_ID, NODE_B_ID].map((id) => ({
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

	const c = await upsertCourse({
		slug: slug('check-course'),
		kind: COURSE_KINDS.INSTRUCTOR,
		title: 'CHECK constraint test course',
		seedOrigin: SUITE_TAG,
		status: COURSE_STATUSES.ACTIVE,
	});
	testCourseId = c.id;
});

afterAll(async () => {
	await db.delete(courseStep).where(eq(courseStep.seedOrigin, SUITE_TAG));
	await db.delete(course).where(eq(course.seedOrigin, SUITE_TAG));
	await db.delete(knowledgeNode).where(eq(knowledgeNode.seedOrigin, SUITE_TAG));
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

describe('course_step_consistency_check -- legal shapes accepted', () => {
	it('accepts a section row (parent NULL, no node, not leaf)', async () => {
		const row = await upsertCourseStep({
			courseId: testCourseId,
			parentId: null,
			level: COURSE_STEP_LEVELS.SECTION,
			ordinal: 1,
			code: 'sec-legal',
			title: 'Section legal',
			bodyMd: '',
			knowledgeNodeId: null,
			contentHash: 'hash-section-legal',
			seedOrigin: SUITE_TAG,
		});
		expect(row.level).toBe(COURSE_STEP_LEVELS.SECTION);
		expect(row.isLeaf).toBe(false);
		expect(row.parentId).toBeNull();
		expect(row.knowledgeNodeId).toBeNull();
	});

	it('accepts a lesson row (parent set, no node, not leaf)', async () => {
		const section = await upsertCourseStep({
			courseId: testCourseId,
			parentId: null,
			level: COURSE_STEP_LEVELS.SECTION,
			ordinal: 2,
			code: 'sec-for-lesson',
			title: 'Parent for lesson',
			bodyMd: '',
			knowledgeNodeId: null,
			contentHash: 'hash-sec-for-lesson',
			seedOrigin: SUITE_TAG,
		});
		const lesson = await upsertCourseStep({
			courseId: testCourseId,
			parentId: section.id,
			level: COURSE_STEP_LEVELS.LESSON,
			ordinal: 1,
			code: 'lesson-legal',
			title: 'Lesson legal',
			bodyMd: '',
			knowledgeNodeId: null,
			contentHash: 'hash-lesson-legal',
			seedOrigin: SUITE_TAG,
		});
		expect(lesson.level).toBe(COURSE_STEP_LEVELS.LESSON);
		expect(lesson.isLeaf).toBe(false);
		expect(lesson.parentId).toBe(section.id);
		expect(lesson.knowledgeNodeId).toBeNull();
	});

	it('accepts a step row (parent set, node set, is leaf)', async () => {
		const section = await upsertCourseStep({
			courseId: testCourseId,
			parentId: null,
			level: COURSE_STEP_LEVELS.SECTION,
			ordinal: 3,
			code: 'sec-for-step',
			title: 'Parent for step',
			bodyMd: '',
			knowledgeNodeId: null,
			contentHash: 'hash-sec-for-step',
			seedOrigin: SUITE_TAG,
		});
		const step = await upsertCourseStep({
			courseId: testCourseId,
			parentId: section.id,
			level: COURSE_STEP_LEVELS.STEP,
			ordinal: 1,
			code: 'step-legal',
			title: 'Step legal',
			bodyMd: '',
			knowledgeNodeId: NODE_A_ID,
			contentHash: 'hash-step-legal',
			seedOrigin: SUITE_TAG,
		});
		expect(step.level).toBe(COURSE_STEP_LEVELS.STEP);
		expect(step.isLeaf).toBe(true);
		expect(step.parentId).toBe(section.id);
		expect(step.knowledgeNodeId).toBe(NODE_A_ID);
	});

	it('accepts a step row whose parent is a lesson (3-level chain)', async () => {
		const section = await upsertCourseStep({
			courseId: testCourseId,
			parentId: null,
			level: COURSE_STEP_LEVELS.SECTION,
			ordinal: 4,
			code: 'sec-for-3lev',
			title: 'Three-level section',
			bodyMd: '',
			knowledgeNodeId: null,
			contentHash: 'hash-sec-for-3lev',
			seedOrigin: SUITE_TAG,
		});
		const lesson = await upsertCourseStep({
			courseId: testCourseId,
			parentId: section.id,
			level: COURSE_STEP_LEVELS.LESSON,
			ordinal: 1,
			code: 'lesson-for-3lev',
			title: 'Three-level lesson',
			bodyMd: '',
			knowledgeNodeId: null,
			contentHash: 'hash-lesson-for-3lev',
			seedOrigin: SUITE_TAG,
		});
		const step = await upsertCourseStep({
			courseId: testCourseId,
			parentId: lesson.id,
			level: COURSE_STEP_LEVELS.STEP,
			ordinal: 1,
			code: 'step-under-lesson',
			title: 'Step under lesson',
			bodyMd: '',
			knowledgeNodeId: NODE_B_ID,
			contentHash: 'hash-step-under-lesson',
			seedOrigin: SUITE_TAG,
		});
		expect(step.parentId).toBe(lesson.id);
		expect(step.isLeaf).toBe(true);
	});
});

interface PgCheckError {
	readonly name?: string;
	readonly message?: string;
	readonly constraint_name?: string;
	readonly code?: string;
}

interface InsertFailure {
	readonly message: string;
	readonly constraintName: string;
}

/**
 * Helper that issues a raw INSERT and resolves with the inner Postgres
 * error (or null when the insert unexpectedly succeeds). The raw form is
 * used here because the upsert path validates `level` against the
 * constants enum before any DB round-trip, which would block us from
 * exercising the DB CHECK directly. Drizzle wraps the postgres error in
 * a `Failed query` outer with the real PostgresError on `.cause`; we
 * unwrap to expose `constraint_name` for the assertions.
 */
async function tryInsert(
	id: string,
	level: string,
	parentId: string | null,
	knowledgeNodeId: string | null,
	isLeaf: boolean,
	codeValue: string,
): Promise<InsertFailure | null> {
	try {
		await db.execute(sql`
			INSERT INTO study.course_step
				(id, course_id, parent_id, level, ordinal, code, title, body_md, knowledge_node_id, is_leaf, seed_origin, created_at, updated_at)
			VALUES
				(${id}, ${testCourseId}, ${parentId}, ${level}, 99, ${codeValue}, 'illegal', '', ${knowledgeNodeId}, ${isLeaf}, ${SUITE_TAG}, NOW(), NOW())
		`);
		return null;
	} catch (err) {
		const outer = err as Error & { cause?: PgCheckError };
		const cause = outer.cause ?? {};
		return {
			message: cause.message ?? outer.message,
			constraintName: cause.constraint_name ?? '',
		};
	}
}

describe('course_step_consistency_check -- illegal shapes rejected', () => {
	let validSectionId = '';

	beforeAll(async () => {
		// Parent section for the negative cases that need a non-NULL parent.
		const sec = await upsertCourseStep({
			courseId: testCourseId,
			parentId: null,
			level: COURSE_STEP_LEVELS.SECTION,
			ordinal: 10,
			code: 'sec-for-negatives',
			title: 'Parent for negatives',
			bodyMd: '',
			knowledgeNodeId: null,
			contentHash: 'hash-sec-for-negatives',
			seedOrigin: SUITE_TAG,
		});
		validSectionId = sec.id;
	});

	it('rejects a leaf step missing knowledge_node_id', async () => {
		const fail = await tryInsert(
			`cst-bad-step-no-node-${SUITE_TOKEN}`,
			COURSE_STEP_LEVELS.STEP,
			validSectionId,
			null,
			true,
			`bad-step-no-node-${SUITE_TOKEN}`,
		);
		expect(fail).not.toBeNull();
		expect(fail?.constraintName).toBe('course_step_consistency_check');
	});

	it('rejects a non-leaf lesson carrying a knowledge_node_id', async () => {
		const fail = await tryInsert(
			`cst-bad-lesson-node-${SUITE_TOKEN}`,
			COURSE_STEP_LEVELS.LESSON,
			validSectionId,
			NODE_A_ID,
			false,
			`bad-lesson-node-${SUITE_TOKEN}`,
		);
		expect(fail).not.toBeNull();
		expect(fail?.constraintName).toBe('course_step_consistency_check');
	});

	it('rejects a section with a non-null parent', async () => {
		const fail = await tryInsert(
			`cst-bad-section-parent-${SUITE_TOKEN}`,
			COURSE_STEP_LEVELS.SECTION,
			validSectionId,
			null,
			false,
			`bad-section-parent-${SUITE_TOKEN}`,
		);
		expect(fail).not.toBeNull();
		expect(fail?.constraintName).toBe('course_step_consistency_check');
	});

	it('rejects a lesson with NULL parent', async () => {
		const fail = await tryInsert(
			`cst-bad-lesson-orphan-${SUITE_TOKEN}`,
			COURSE_STEP_LEVELS.LESSON,
			null,
			null,
			false,
			`bad-lesson-orphan-${SUITE_TOKEN}`,
		);
		expect(fail).not.toBeNull();
		expect(fail?.constraintName).toBe('course_step_consistency_check');
	});

	it('rejects a step row flagged is_leaf=false', async () => {
		const fail = await tryInsert(
			`cst-bad-step-not-leaf-${SUITE_TOKEN}`,
			COURSE_STEP_LEVELS.STEP,
			validSectionId,
			NODE_A_ID,
			false,
			`bad-step-not-leaf-${SUITE_TOKEN}`,
		);
		expect(fail).not.toBeNull();
		expect(fail?.constraintName).toBe('course_step_consistency_check');
	});

	it('rejects a section flagged is_leaf=true', async () => {
		const fail = await tryInsert(
			`cst-bad-section-leaf-${SUITE_TOKEN}`,
			COURSE_STEP_LEVELS.SECTION,
			null,
			null,
			true,
			`bad-section-leaf-${SUITE_TOKEN}`,
		);
		expect(fail).not.toBeNull();
		expect(fail?.constraintName).toBe('course_step_consistency_check');
	});

	it('rejects an unknown level value', async () => {
		const fail = await tryInsert(
			`cst-bad-unknown-level-${SUITE_TOKEN}`,
			'module',
			validSectionId,
			null,
			false,
			`bad-unknown-level-${SUITE_TOKEN}`,
		);
		expect(fail).not.toBeNull();
		// Either CHECK is acceptable here. Postgres does not promise an
		// evaluation order across multiple table-level CHECKs; in practice
		// the consistency check fires first because the unknown level
		// doesn't match any of its three arms, but the level-enum check
		// would also reject 'module'. The point is that 'module' is
		// rejected, not which CHECK happened to win the race.
		expect(['course_step_consistency_check', 'course_step_level_check']).toContain(fail?.constraintName ?? '');
	});
});
