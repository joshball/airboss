#!/usr/bin/env bun

/**
 * Work-package frontmatter lint. ADR 025.
 *
 * Two responsibilities:
 *
 * 1. Validate every `docs/work-packages/<slug>/spec.md` against the schema
 *    in `@ab/types`. Reports each failure with file path + field name.
 *    Exits non-zero on any validation error.
 *
 * 2. Detect agent writes to the user-only `human_review_status` field.
 *    `git config user.email` is compared against `WP_HUMAN_REVIEWER_EMAIL`.
 *    For non-user authors, `git diff --cached -U0` against HEAD is scanned
 *    for any change to the `human_review_status:` line in any spec.md;
 *    such changes are rejected.
 *
 * Wired into `bun run check` (see scripts/check.ts).
 *
 * Phase 2 of `tracking-system-overhaul` backfills the 99 existing WPs.
 * Until then, the lint will report many failures; that is expected and is
 * the punch list for the backfill.
 */

import { spawnSync } from 'node:child_process';
import { WP_HUMAN_REVIEWER_EMAIL } from '@ab/constants';
import { loadAllWorkPackages } from '../lib/wp-loader';

interface LintFailure {
	specPath: string;
	field: string;
	message: string;
}

/** Phase 1 grace rule: WPs whose frontmatter does not yet carry the new
 * required fields (`agent_review_status`, `human_review_status`, `created`)
 * are reported as "needs Phase 2 backfill" warnings rather than hard failures.
 * They are exempt from blocking `bun run check` until Phase 2 lands.
 *
 * Once a WP author opts in by adding any of the new fields, full schema
 * validation kicks in (so partial migrations cannot regress silently). */
function isLegacyUnmigrated(rawFrontmatter: Record<string, unknown> | null): boolean {
	if (rawFrontmatter === null) return true;
	// `created` was already a common field on legacy WPs, so it does not
	// signal migration. Only the new ADR-025-specific fields do.
	const hasMigratedField =
		'agent_review_status' in rawFrontmatter || 'human_review_status' in rawFrontmatter || 'category' in rawFrontmatter;
	return !hasMigratedField;
}

interface LintReport {
	failures: LintFailure[];
	legacyCount: number;
}

function lintFrontmatter(): LintReport {
	const failures: LintFailure[] = [];
	let legacyCount = 0;
	const packages = loadAllWorkPackages();
	for (const wp of packages) {
		if (wp.validation_errors.length === 0) continue;
		if (isLegacyUnmigrated(wp.rawFrontmatter)) {
			legacyCount += 1;
			continue;
		}
		for (const err of wp.validation_errors) {
			failures.push({ specPath: wp.specPath, field: err.field, message: err.message });
		}
	}
	return { failures, legacyCount };
}

/** Returns the configured git user.email, or null if git or the config is
 * unavailable (CI environments without a configured user). The lint treats
 * a missing email as "not the user" and applies the agent rule. */
function readGitUserEmail(): string | null {
	const result = spawnSync('git', ['config', 'user.email'], { encoding: 'utf8' });
	if (result.status !== 0) return null;
	const email = result.stdout.trim();
	return email.length === 0 ? null : email;
}

interface DiffHunk {
	file: string;
	addedLines: string[];
	removedLines: string[];
}

/** Parse `git diff -U0 HEAD --` output into per-file added/removed line sets.
 * Only files matching `docs/work-packages/<slug>/spec.md` are tracked; the
 * rest are ignored. */
function readSpecDiffHunks(): DiffHunk[] {
	const result = spawnSync('git', ['diff', '-U0', 'HEAD', '--', 'docs/work-packages'], { encoding: 'utf8' });
	if (result.status !== 0) {
		// No prior commit (fresh repo) or git unavailable -- nothing to compare.
		return [];
	}
	const hunks: DiffHunk[] = [];
	let current: DiffHunk | null = null;
	for (const line of result.stdout.split('\n')) {
		if (line.startsWith('+++ b/')) {
			const file = line.slice('+++ b/'.length);
			current = { file, addedLines: [], removedLines: [] };
			hunks.push(current);
			continue;
		}
		if (current === null) continue;
		if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) continue;
		if (line.startsWith('+')) current.addedLines.push(line.slice(1));
		else if (line.startsWith('-')) current.removedLines.push(line.slice(1));
	}
	return hunks.filter((h) => /^docs\/work-packages\/[^/]+\/spec\.md$/.test(h.file));
}

const HUMAN_REVIEW_LINE = /^\s*human_review_status\s*:/;

function detectHumanReviewMutations(): LintFailure[] {
	const failures: LintFailure[] = [];
	for (const hunk of readSpecDiffHunks()) {
		const addedHumanReview = hunk.addedLines.some((l) => HUMAN_REVIEW_LINE.test(l));
		const removedHumanReview = hunk.removedLines.some((l) => HUMAN_REVIEW_LINE.test(l));
		if (addedHumanReview || removedHumanReview) {
			failures.push({
				specPath: hunk.file,
				field: 'human_review_status',
				message:
					'human_review_status is user-controlled. Only the human reviewer ' +
					`(git user.email == ${WP_HUMAN_REVIEWER_EMAIL}) may change this field. ` +
					'Revert the change and let the user mark the WP walked / signed-off.',
			});
		}
	}
	return failures;
}

function reportFailures(failures: LintFailure[]): void {
	for (const f of failures) {
		console.error(`  ${f.specPath}\n    [${f.field}] ${f.message}`);
	}
}

function main(): void {
	const { failures: schemaFailures, legacyCount } = lintFrontmatter();

	const gitEmail = readGitUserEmail();
	const isHumanReviewer = gitEmail === WP_HUMAN_REVIEWER_EMAIL;
	const ownershipFailures = isHumanReviewer ? [] : detectHumanReviewMutations();

	if (schemaFailures.length > 0) {
		console.error(`wp-frontmatter: ${schemaFailures.length} schema failure(s):`);
		reportFailures(schemaFailures);
	}
	if (ownershipFailures.length > 0) {
		console.error(`\nwp-frontmatter: ${ownershipFailures.length} ownership failure(s):`);
		reportFailures(ownershipFailures);
		console.error(`\n  Detected committer email: ${gitEmail ?? '(unset)'}`);
		console.error(`  human_review_status is reserved for ${WP_HUMAN_REVIEWER_EMAIL}.`);
	}

	if (legacyCount > 0) {
		console.log(
			`wp-frontmatter: ${legacyCount} legacy WP(s) still need Phase 2 backfill (not blocking; run 'bun run wp list' for status).`,
		);
	}

	if (schemaFailures.length === 0 && ownershipFailures.length === 0) {
		console.log('wp-frontmatter: ok');
		return;
	}
	process.exit(1);
}

main();
