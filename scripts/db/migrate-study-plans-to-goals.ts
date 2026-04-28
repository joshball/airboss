#!/usr/bin/env bun

/**
 * Study plan -> Goal migration (cert-syllabus WP phase 22c).
 *
 * Walks every existing `study_plan` row. For each plan whose
 * `goal_migrated_at` is null and whose `cert_goals` array is non-empty:
 *
 *   1. Create one `goal` row owned by the plan's `user_id`.
 *      - title derived from the plan title (or a fallback).
 *      - status = active.
 *      - is_primary defaults to false here. If the user has no other
 *        primary goal yet, the new goal is flipped to primary atomically
 *        inside the same transaction. We do NOT clear an existing
 *        primary -- the migration is conservative: per-user existing
 *        intent wins.
 *      - seed_origin = MIGRATION_SEED_ORIGIN so the row is identifiable
 *        and removable via the standard dev-seed cleanup paths.
 *   2. For each cert slug in `study_plan.cert_goals`, look up the
 *      credential and its primary syllabus via the credentials BC
 *      (`getCredentialBySlug` / `getCredentialPrimarySyllabus`). If
 *      found, insert a `goal_syllabus(goal_id, syllabus_id, weight=1.0)`
 *      row. If not found (cert has no credential row, or credential has
 *      no primary syllabus seeded yet), log and skip that cert.
 *   3. Stamp `study_plan.goal_migrated_at = now()` so re-runs are
 *      idempotent.
 *
 * Cert-agnostic plans (`cert_goals` empty / null) are skipped entirely
 * (no goal row created); the plan's `goal_migrated_at` is still stamped
 * so the migration does not re-process them on the next run.
 *
 * The existing `study_plan.cert_goals` column is intentionally NOT
 * cleared: the engine continues reading it directly until a follow-on
 * WP cuts the engine over to `getDerivedCertGoals(userId)`.
 *
 * Idempotency: a row is processed when `goal_migrated_at IS NULL`.
 * Re-running on a fully-migrated DB writes nothing.
 *
 * Usage:
 *   bun scripts/db/migrate-study-plans-to-goals.ts
 *   bun scripts/db/migrate-study-plans-to-goals.ts --dry-run
 */

import { credential, credentialSyllabus, goal, goalSyllabus, studyPlan, syllabus } from '@ab/bc-study';
import { GOAL_STATUSES, SYLLABUS_PRIMACY } from '@ab/constants';
import { db as defaultDb } from '@ab/db';
import { generateGoalId } from '@ab/utils';
import { and, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/** Stamped on every goal + goal_syllabus row produced by this migration. */
export const MIGRATION_SEED_ORIGIN = 'migrate-study-plans-to-goals-v1' as const;

export interface MigrationOptions {
	dryRun?: boolean;
	/**
	 * Restrict the migration to a specific set of `study_plan.user_id`
	 * values. Used by the test fixture so its run doesn't touch
	 * production rows; production runs leave this undefined.
	 */
	onlyUserIds?: ReadonlyArray<string>;
}

export interface MigrationReport {
	plansScanned: number;
	plansAlreadyMigrated: number;
	plansSkippedNoCertGoals: number;
	plansMigrated: number;
	goalsCreated: number;
	goalSyllabiCreated: number;
	certsSkippedNoCredential: number;
	certsSkippedNoPrimarySyllabus: number;
	skippedDetails: Array<{ planId: string; cert: string; reason: 'no-credential' | 'no-primary-syllabus' }>;
}

interface CertResolution {
	cert: string;
	syllabusId: string | null;
	reason: 'ok' | 'no-credential' | 'no-primary-syllabus';
}

/**
 * Resolve a cert slug -> primary syllabus id, returning a typed result
 * that the migration uses to decide whether to insert a goal_syllabus
 * link or to log + skip.
 */
async function resolveCertToPrimarySyllabus(certSlug: string, db: Db): Promise<CertResolution> {
	const credRows = await db
		.select({ id: credential.id })
		.from(credential)
		.where(eq(credential.slug, certSlug))
		.limit(1);
	const credRow = credRows[0];
	if (!credRow) return { cert: certSlug, syllabusId: null, reason: 'no-credential' };
	const sylRows = await db
		.select({ syllabusId: credentialSyllabus.syllabusId })
		.from(credentialSyllabus)
		.innerJoin(syllabus, eq(syllabus.id, credentialSyllabus.syllabusId))
		.where(
			and(eq(credentialSyllabus.credentialId, credRow.id), eq(credentialSyllabus.primacy, SYLLABUS_PRIMACY.PRIMARY)),
		)
		.limit(1);
	const sylRow = sylRows[0];
	if (!sylRow) return { cert: certSlug, syllabusId: null, reason: 'no-primary-syllabus' };
	return { cert: certSlug, syllabusId: sylRow.syllabusId, reason: 'ok' };
}

/**
 * Walk every un-migrated study_plan row and materialise goals +
 * goal_syllabus rows. Idempotent via study_plan.goal_migrated_at.
 */
export async function migrateStudyPlansToGoals(
	options: MigrationOptions = {},
	db: Db = defaultDb,
): Promise<MigrationReport> {
	const dryRun = options.dryRun ?? false;
	const report: MigrationReport = {
		plansScanned: 0,
		plansAlreadyMigrated: 0,
		plansSkippedNoCertGoals: 0,
		plansMigrated: 0,
		goalsCreated: 0,
		goalSyllabiCreated: 0,
		certsSkippedNoCredential: 0,
		certsSkippedNoPrimarySyllabus: 0,
		skippedDetails: [],
	};

	const allPlansRaw = await db.select().from(studyPlan);
	const allPlans =
		options.onlyUserIds === undefined
			? allPlansRaw
			: allPlansRaw.filter((p) => options.onlyUserIds?.includes(p.userId) ?? false);
	report.plansScanned = allPlans.length;

	for (const plan of allPlans) {
		if (plan.goalMigratedAt !== null) {
			report.plansAlreadyMigrated += 1;
			continue;
		}
		const certGoals = plan.certGoals ?? [];
		if (certGoals.length === 0) {
			report.plansSkippedNoCertGoals += 1;
			if (!dryRun) {
				await db.update(studyPlan).set({ goalMigratedAt: new Date() }).where(eq(studyPlan.id, plan.id));
			}
			continue;
		}

		const resolutions: CertResolution[] = [];
		for (const cert of certGoals) {
			resolutions.push(await resolveCertToPrimarySyllabus(cert, db));
		}
		const linkable = resolutions.filter((r) => r.reason === 'ok' && r.syllabusId !== null);
		for (const r of resolutions) {
			if (r.reason === 'no-credential') {
				report.certsSkippedNoCredential += 1;
				report.skippedDetails.push({ planId: plan.id, cert: r.cert, reason: 'no-credential' });
			} else if (r.reason === 'no-primary-syllabus') {
				report.certsSkippedNoPrimarySyllabus += 1;
				report.skippedDetails.push({ planId: plan.id, cert: r.cert, reason: 'no-primary-syllabus' });
			}
		}

		const newGoalId = generateGoalId();
		const goalTitle = deriveGoalTitle(plan.title, certGoals);

		if (dryRun) {
			report.plansMigrated += 1;
			report.goalsCreated += 1;
			report.goalSyllabiCreated += linkable.length;
			continue;
		}

		await db.transaction(async (tx) => {
			// Determine whether this should be the user's primary goal:
			// only flip primary if the user does not already have one. The
			// migration is conservative; never overwrites an existing
			// primary (e.g. if the user already created a goal manually
			// before the migration ran).
			const existingPrimary = await tx
				.select({ id: goal.id })
				.from(goal)
				.where(and(eq(goal.userId, plan.userId), eq(goal.isPrimary, true)))
				.limit(1);
			const isPrimary = existingPrimary.length === 0;

			const now = new Date();
			await tx.insert(goal).values({
				id: newGoalId,
				userId: plan.userId,
				title: goalTitle,
				notesMd: '',
				status: GOAL_STATUSES.ACTIVE,
				isPrimary,
				targetDate: null,
				seedOrigin: MIGRATION_SEED_ORIGIN,
				createdAt: now,
				updatedAt: now,
			});
			report.goalsCreated += 1;

			for (const r of linkable) {
				if (r.syllabusId === null) continue;
				await tx.insert(goalSyllabus).values({
					goalId: newGoalId,
					syllabusId: r.syllabusId,
					weight: 1.0,
					seedOrigin: MIGRATION_SEED_ORIGIN,
					createdAt: now,
				});
				report.goalSyllabiCreated += 1;
			}

			await tx.update(studyPlan).set({ goalMigratedAt: now }).where(eq(studyPlan.id, plan.id));
		});

		report.plansMigrated += 1;
	}

	return report;
}

/**
 * Derive a goal title from the plan title plus the certs it targets.
 * Plan titles in the dev seed are descriptive (e.g. "PPL VFR weather +
 * airspace focus"); reuse them so the goal carries continuity. Fall
 * back to a cert-list-based title if the plan title is empty.
 */
function deriveGoalTitle(planTitle: string, certGoals: readonly string[]): string {
	const trimmed = planTitle.trim();
	if (trimmed.length > 0) return trimmed;
	if (certGoals.length === 0) return 'Migrated Goal';
	return `Goal: ${[...certGoals].sort().join(', ')}`;
}

async function main(): Promise<void> {
	const args = new Set(process.argv.slice(2));
	const dryRun = args.has('--dry-run');
	const report = await migrateStudyPlansToGoals({ dryRun });
	const tag = dryRun ? '(dry-run) ' : '';
	process.stdout.write(
		`${tag}migrate-study-plans-to-goals: scanned ${report.plansScanned}, already-migrated ${report.plansAlreadyMigrated}, skipped (no cert_goals) ${report.plansSkippedNoCertGoals}, migrated ${report.plansMigrated}\n`,
	);
	process.stdout.write(
		`  goals created: ${report.goalsCreated}; goal_syllabus rows created: ${report.goalSyllabiCreated}\n`,
	);
	process.stdout.write(
		`  certs skipped (no credential): ${report.certsSkippedNoCredential}; certs skipped (no primary syllabus): ${report.certsSkippedNoPrimarySyllabus}\n`,
	);
	for (const d of report.skippedDetails) {
		process.stdout.write(`    skipped: plan=${d.planId} cert=${d.cert} reason=${d.reason}\n`);
	}
}

if (import.meta.main) {
	main().catch((err) => {
		process.stderr.write(`migrate-study-plans-to-goals: ${(err as Error).stack ?? err}\n`);
		process.exit(1);
	});
}
