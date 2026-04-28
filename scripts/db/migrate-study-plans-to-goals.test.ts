/**
 * Tests for the study_plan -> Goal migration. Real Postgres -- the
 * partial UNIQUE on `goal (user_id) WHERE is_primary=true` is enforced
 * by the DB, and the migration's "don't overwrite an existing primary"
 * guard wouldn't catch a regression without a real round-trip.
 */

import { bauthUser } from '@ab/auth/schema';
import { credential, credentialSyllabus, goal, goalSyllabus, studyPlan, syllabus } from '@ab/bc-study';
import {
	CREDENTIAL_STATUSES,
	DEPTH_PREFERENCES,
	GOAL_STATUSES,
	PLAN_STATUSES,
	SESSION_MODES,
	SYLLABUS_PRIMACY,
	SYLLABUS_STATUSES,
} from '@ab/constants';
import { db } from '@ab/db/connection';
import { generateAuthId, generateCredentialId, generateStudyPlanId, generateSyllabusId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIGRATION_SEED_ORIGIN, migrateStudyPlansToGoals } from './migrate-study-plans-to-goals';

const SUITE_TAG = `migrate-plans-test-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const SUITE_TOKEN = Math.floor(Math.random() * 0x100_000_000)
	.toString(16)
	.padStart(8, '0');
const slugify = (s: string): string => `${s}-${SUITE_TOKEN}`;

const USER_EMPTY = generateAuthId();
const USER_SINGLE = generateAuthId();
const USER_MULTI = generateAuthId();
const USER_NO_SYLLABUS = generateAuthId();
const USER_ALREADY_MIGRATED = generateAuthId();
const USER_HAS_PRIMARY = generateAuthId();

const TEST_USER_IDS: ReadonlyArray<string> = [
	USER_EMPTY,
	USER_SINGLE,
	USER_MULTI,
	USER_NO_SYLLABUS,
	USER_ALREADY_MIGRATED,
	USER_HAS_PRIMARY,
];

const PPL_CRED_ID = generateCredentialId();
const PPL_CRED_SLUG = slugify('private');
const PPL_SYL_ID = generateSyllabusId();
const PPL_SYL_SLUG = slugify('ppl-acs');

const IR_CRED_ID = generateCredentialId();
const IR_CRED_SLUG = slugify('instrument');
const IR_SYL_ID = generateSyllabusId();
const IR_SYL_SLUG = slugify('ir-acs');

// Credential without a primary syllabus -- exercises the skip path.
const CFI_CRED_ID = generateCredentialId();
const CFI_CRED_SLUG = slugify('cfi');

const PLAN_EMPTY_ID = generateStudyPlanId();
const PLAN_SINGLE_ID = generateStudyPlanId();
const PLAN_MULTI_ID = generateStudyPlanId();
const PLAN_NO_SYL_ID = generateStudyPlanId();
const PLAN_ALREADY_ID = generateStudyPlanId();
const PLAN_HAS_PRIMARY_ID = generateStudyPlanId();

beforeAll(async () => {
	const now = new Date();
	const users = [USER_EMPTY, USER_SINGLE, USER_MULTI, USER_NO_SYLLABUS, USER_ALREADY_MIGRATED, USER_HAS_PRIMARY].map(
		(id, idx) => ({
			id,
			email: `${SUITE_TAG}-${idx}@airboss.test`,
			name: `Test ${idx}`,
			firstName: 'Test',
			lastName: `User${idx}`,
			emailVerified: true,
			role: 'learner' as const,
			createdAt: now,
			updatedAt: now,
		}),
	);
	await db.insert(bauthUser).values(users);

	await db.insert(credential).values([
		{
			id: PPL_CRED_ID,
			slug: PPL_CRED_SLUG,
			kind: 'pilot-cert',
			title: 'Private Pilot',
			category: 'airplane',
			class: 'single-engine-land',
			regulatoryBasis: [],
			status: CREDENTIAL_STATUSES.ACTIVE,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: IR_CRED_ID,
			slug: IR_CRED_SLUG,
			kind: 'pilot-cert',
			title: 'Instrument Rating',
			category: 'airplane',
			class: null,
			regulatoryBasis: [],
			status: CREDENTIAL_STATUSES.ACTIVE,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: CFI_CRED_ID,
			slug: CFI_CRED_SLUG,
			kind: 'instructor-cert',
			title: 'Certified Flight Instructor',
			category: 'airplane',
			class: null,
			regulatoryBasis: [],
			status: CREDENTIAL_STATUSES.ACTIVE,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
	]);

	await db.insert(syllabus).values([
		{
			id: PPL_SYL_ID,
			slug: PPL_SYL_SLUG,
			kind: 'acs',
			title: 'Test PPL ACS',
			edition: `faa-s-acs-25-${SUITE_TOKEN}`,
			status: SYLLABUS_STATUSES.ACTIVE,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: IR_SYL_ID,
			slug: IR_SYL_SLUG,
			kind: 'acs',
			title: 'Test IR ACS',
			edition: `faa-s-acs-26-${SUITE_TOKEN}`,
			status: SYLLABUS_STATUSES.ACTIVE,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
	]);

	await db.insert(credentialSyllabus).values([
		{
			credentialId: PPL_CRED_ID,
			syllabusId: PPL_SYL_ID,
			primacy: SYLLABUS_PRIMACY.PRIMARY,
			seedOrigin: SUITE_TAG,
			createdAt: now,
		},
		{
			credentialId: IR_CRED_ID,
			syllabusId: IR_SYL_ID,
			primacy: SYLLABUS_PRIMACY.PRIMARY,
			seedOrigin: SUITE_TAG,
			createdAt: now,
		},
	]);

	const basePlan = {
		status: PLAN_STATUSES.ACTIVE,
		focusDomains: [],
		skipDomains: [],
		skipNodes: [],
		depthPreference: DEPTH_PREFERENCES.WORKING,
		sessionLength: 8,
		defaultMode: SESSION_MODES.MIXED,
		seedOrigin: SUITE_TAG,
		createdAt: now,
		updatedAt: now,
		goalMigratedAt: null,
	};

	await db.insert(studyPlan).values([
		{
			...basePlan,
			id: PLAN_EMPTY_ID,
			userId: USER_EMPTY,
			title: 'Empty cert goals',
			certGoals: [],
		},
		{
			...basePlan,
			id: PLAN_SINGLE_ID,
			userId: USER_SINGLE,
			title: 'Single cert -- PPL only',
			certGoals: [PPL_CRED_SLUG],
		},
		{
			...basePlan,
			id: PLAN_MULTI_ID,
			userId: USER_MULTI,
			title: 'Multi cert -- PPL + IR',
			certGoals: [PPL_CRED_SLUG, IR_CRED_SLUG],
		},
		{
			...basePlan,
			id: PLAN_NO_SYL_ID,
			userId: USER_NO_SYLLABUS,
			title: 'CFI only -- no primary syllabus seeded',
			certGoals: [CFI_CRED_SLUG, PPL_CRED_SLUG],
		},
		{
			...basePlan,
			id: PLAN_ALREADY_ID,
			userId: USER_ALREADY_MIGRATED,
			title: 'Already migrated',
			certGoals: [PPL_CRED_SLUG],
			goalMigratedAt: now,
		},
		{
			...basePlan,
			id: PLAN_HAS_PRIMARY_ID,
			userId: USER_HAS_PRIMARY,
			title: 'User already has manual primary',
			certGoals: [PPL_CRED_SLUG],
		},
	]);

	// Pre-existing manual primary goal for USER_HAS_PRIMARY.
	await db.insert(goal).values({
		id: `goal_test_existing_primary_${SUITE_TOKEN}`,
		userId: USER_HAS_PRIMARY,
		title: 'Pre-existing primary',
		notesMd: '',
		status: GOAL_STATUSES.ACTIVE,
		isPrimary: true,
		targetDate: null,
		seedOrigin: SUITE_TAG,
		createdAt: now,
		updatedAt: now,
	});
});

afterAll(async () => {
	await db.delete(goalSyllabus).where(eq(goalSyllabus.seedOrigin, MIGRATION_SEED_ORIGIN));
	await db.delete(goalSyllabus).where(eq(goalSyllabus.seedOrigin, SUITE_TAG));
	await db.delete(goal).where(eq(goal.seedOrigin, MIGRATION_SEED_ORIGIN));
	await db.delete(goal).where(eq(goal.seedOrigin, SUITE_TAG));
	await db.delete(studyPlan).where(eq(studyPlan.seedOrigin, SUITE_TAG));
	await db.delete(credentialSyllabus).where(eq(credentialSyllabus.seedOrigin, SUITE_TAG));
	await db.delete(syllabus).where(eq(syllabus.seedOrigin, SUITE_TAG));
	await db.delete(credential).where(eq(credential.seedOrigin, SUITE_TAG));
	for (const id of [USER_EMPTY, USER_SINGLE, USER_MULTI, USER_NO_SYLLABUS, USER_ALREADY_MIGRATED, USER_HAS_PRIMARY]) {
		await db.delete(bauthUser).where(eq(bauthUser.id, id));
	}
});

describe('migrateStudyPlansToGoals', () => {
	it('migrates a single-cert plan into one goal + one goal_syllabus', async () => {
		const report = await migrateStudyPlansToGoals({
			onlyUserIds: TEST_USER_IDS,
		});
		expect(report.plansScanned).toBe(6);
		// 4 plans migrated (single/multi/no-syl/has-primary), 1 already-migrated, 1 empty-cert-goals.
		expect(report.plansMigrated).toBe(4);
		expect(report.plansAlreadyMigrated).toBe(1);
		expect(report.plansSkippedNoCertGoals).toBe(1);
		expect(report.goalsCreated).toBe(4);
		// PPL+IR for multi (2), PPL for single (1), PPL for no-syl (1, CFI skipped), PPL for has-primary (1) = 5
		expect(report.goalSyllabiCreated).toBe(5);
		expect(report.certsSkippedNoPrimarySyllabus).toBe(1);
		const goalsForUser = await db.select().from(goal).where(eq(goal.userId, USER_SINGLE));
		expect(goalsForUser.length).toBe(1);
		expect(goalsForUser[0]?.seedOrigin).toBe(MIGRATION_SEED_ORIGIN);
		expect(goalsForUser[0]?.title).toBe('Single cert -- PPL only');
		expect(goalsForUser[0]?.isPrimary).toBe(true); // user had no prior primary

		const links = await db
			.select()
			.from(goalSyllabus)
			.where(eq(goalSyllabus.goalId, goalsForUser[0]?.id ?? ''));
		expect(links.length).toBe(1);
		expect(links[0]?.syllabusId).toBe(PPL_SYL_ID);
		expect(links[0]?.weight).toBe(1.0);

		const planRow = (await db.select().from(studyPlan).where(eq(studyPlan.id, PLAN_SINGLE_ID)))[0];
		expect(planRow?.goalMigratedAt).not.toBeNull();
	});

	it('migrates a multi-cert plan into one goal with one goal_syllabus per cert', async () => {
		const goalsForUser = await db.select().from(goal).where(eq(goal.userId, USER_MULTI));
		expect(goalsForUser.length).toBe(1);
		const links = await db
			.select()
			.from(goalSyllabus)
			.where(eq(goalSyllabus.goalId, goalsForUser[0]?.id ?? ''));
		expect(links.length).toBe(2);
		const syllabusIds = links.map((l) => l.syllabusId).sort();
		expect(syllabusIds).toEqual([PPL_SYL_ID, IR_SYL_ID].sort());
	});

	it('skips a cert that has no primary syllabus, but creates the goal for the rest', async () => {
		const goalsForUser = await db.select().from(goal).where(eq(goal.userId, USER_NO_SYLLABUS));
		expect(goalsForUser.length).toBe(1);
		const links = await db
			.select()
			.from(goalSyllabus)
			.where(eq(goalSyllabus.goalId, goalsForUser[0]?.id ?? ''));
		// Only PPL has a primary syllabus; CFI does not.
		expect(links.length).toBe(1);
		expect(links[0]?.syllabusId).toBe(PPL_SYL_ID);
	});

	it('skips a plan with empty cert_goals but stamps goal_migrated_at', async () => {
		const goalsForUser = await db.select().from(goal).where(eq(goal.userId, USER_EMPTY));
		expect(goalsForUser.length).toBe(0);
		const planRow = (await db.select().from(studyPlan).where(eq(studyPlan.id, PLAN_EMPTY_ID)))[0];
		expect(planRow?.goalMigratedAt).not.toBeNull();
	});

	it('does not overwrite an existing primary goal', async () => {
		const goalsForUser = await db.select().from(goal).where(eq(goal.userId, USER_HAS_PRIMARY));
		// One pre-existing manual + one migrated.
		expect(goalsForUser.length).toBe(2);
		const migrated = goalsForUser.find((g) => g.seedOrigin === MIGRATION_SEED_ORIGIN);
		const preExisting = goalsForUser.find((g) => g.seedOrigin === SUITE_TAG);
		expect(migrated?.isPrimary).toBe(false);
		expect(preExisting?.isPrimary).toBe(true);
	});

	it('skips already-migrated plans', async () => {
		const goalsForUser = await db.select().from(goal).where(eq(goal.userId, USER_ALREADY_MIGRATED));
		expect(goalsForUser.length).toBe(0);
	});

	it('is idempotent: re-running creates no new rows', async () => {
		const goalsBefore = await db.select().from(goal).where(eq(goal.seedOrigin, MIGRATION_SEED_ORIGIN));
		const linksBefore = await db.select().from(goalSyllabus).where(eq(goalSyllabus.seedOrigin, MIGRATION_SEED_ORIGIN));
		const report = await migrateStudyPlansToGoals({
			onlyUserIds: TEST_USER_IDS,
		});
		expect(report.plansMigrated).toBe(0);
		expect(report.goalsCreated).toBe(0);
		expect(report.goalSyllabiCreated).toBe(0);
		const goalsAfter = await db.select().from(goal).where(eq(goal.seedOrigin, MIGRATION_SEED_ORIGIN));
		const linksAfter = await db.select().from(goalSyllabus).where(eq(goalSyllabus.seedOrigin, MIGRATION_SEED_ORIGIN));
		expect(goalsAfter.length).toBe(goalsBefore.length);
		expect(linksAfter.length).toBe(linksBefore.length);
	});
});
