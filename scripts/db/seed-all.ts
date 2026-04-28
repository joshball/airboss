#!/usr/bin/env bun
/**
 * Seed orchestrator for the local dev DB.
 *
 * Runs phases in order, each idempotent:
 *
 *   1. users      -- better-auth rows for DEV_ACCOUNTS (scripts/db/seed-dev-users.ts)
 *   2. knowledge  -- knowledge_node + knowledge_edge from course/knowledge/**\/node.md
 *                    (scripts/build-knowledge-index.ts, full build)
 *   3. handbooks  -- reference + handbook_section + handbook_figure rows
 *                    from the committed handbooks/ tree
 *                    (scripts/db/seed-handbooks.ts :: seedHandbooks)
 *   4. references -- non-handbook reference rows (ACS / PTS / companion
 *                    guide) from course/references/*.yaml. Cert-syllabus WP.
 *   5. credentials -- credential / credential_prereq / credential_syllabus
 *                    rows from course/credentials/*.yaml. Cert-syllabus WP.
 *   6. cards      -- study.card rows from inline yaml-cards blocks for every
 *                    DEV_ACCOUNTS user (scripts/db/seed-cards.ts :: seedCardsForUser)
 *   7. abby       -- Abby's personal cards / scenarios / plan / sessions /
 *                    reviews. Uses the seed_origin marker so the rows can be
 *                    cleanly removed by `db seed:remove`.
 *
 * The dev-seed pipeline prints a yellow ANSI warning before phase 4 and is
 * gated by a production guard (see scripts/db/seed-guard.ts).
 *
 * Usage:
 *   bun scripts/db/seed-all.ts            # all phases
 *   bun scripts/db/seed-all.ts users      # only users
 *   bun scripts/db/seed-all.ts knowledge  # only knowledge graph build
 *   bun scripts/db/seed-all.ts handbooks  # only handbook ingestion -> DB
 *   bun scripts/db/seed-all.ts cards      # only card materialization
 *   bun scripts/db/seed-all.ts abby       # only Abby's content
 */

import { resolve } from 'node:path';
import { DEV_ACCOUNTS, DEV_DB_URL, DEV_SEED_ORIGIN_TAG, ENV_VARS } from '@ab/constants';
import { type AbbySeedCounts, seedAbby } from './seed-abby';
import { seedCardsForUser } from './seed-cards';
import { seedCredentials } from './seed-credentials';
import { decideSeedGuard } from './seed-guard';
import { seedHandbooks } from './seed-handbooks';
import { seedReferences } from './seed-references';

type Phase = 'users' | 'knowledge' | 'handbooks' | 'references' | 'credentials' | 'cards' | 'abby';

const PHASES: readonly Phase[] = [
	'users',
	'knowledge',
	'handbooks',
	'references',
	'credentials',
	'cards',
	'abby',
] as const;
const REPO_ROOT = resolve(import.meta.dir, '..', '..');

const ANSI_YELLOW = '[33m';
const ANSI_BOLD = '[1m';
const ANSI_RESET = '[0m';

function isPhase(value: string): value is Phase {
	return (PHASES as readonly string[]).includes(value);
}

async function runSubprocess(cmd: string[]): Promise<void> {
	const proc = Bun.spawn(cmd, { cwd: REPO_ROOT, stdio: ['inherit', 'inherit', 'inherit'] });
	const code = await proc.exited;
	if (code !== 0) {
		throw new Error(`subprocess failed (exit ${code}): ${cmd.join(' ')}`);
	}
}

async function phaseUsers(): Promise<void> {
	process.stdout.write('\n=== seed: users ===\n');
	await runSubprocess(['bun', 'scripts/db/seed-dev-users.ts']);
}

async function phaseKnowledge(): Promise<void> {
	process.stdout.write('\n=== seed: knowledge ===\n');
	await runSubprocess(['bun', 'scripts/build-knowledge-index.ts']);
}

async function phaseHandbooks(): Promise<void> {
	process.stdout.write('\n=== seed: handbooks ===\n');
	const summary = await seedHandbooks();
	process.stdout.write(
		`  ${summary.editionsProcessed} editions, ${summary.sectionsTouched} sections (${summary.sectionsChanged} changed), ${summary.figuresWritten} figures, ${summary.supersededLinks} superseded links\n`,
	);
}

async function phaseReferences(): Promise<void> {
	process.stdout.write('\n=== seed: references ===\n');
	const summary = await seedReferences();
	process.stdout.write(`  ${summary.rowsUpserted} non-handbook reference rows from ${summary.filesRead} file(s)\n`);
}

async function phaseCredentials(): Promise<void> {
	process.stdout.write('\n=== seed: credentials ===\n');
	const summary = await seedCredentials();
	process.stdout.write(
		`  ${summary.credentialsUpserted} credentials, ${summary.prereqsUpserted} prereqs, ${summary.syllabusLinksUpserted} syllabus links (${summary.syllabusLinksSkipped} skipped pending syllabi)\n`,
	);
}

async function phaseCards(): Promise<void> {
	process.stdout.write('\n=== seed: cards ===\n');
	for (const account of DEV_ACCOUNTS) {
		await seedCardsForUser(account.email);
	}
}

function printYellowDevSeedBanner(counts: AbbySeedCounts): void {
	const lines: string[] = [];
	lines.push(`${ANSI_YELLOW}${ANSI_BOLD}!! DEV SEED -- DO NOT RUN IN PRODUCTION${ANSI_RESET}`);
	lines.push(
		`${ANSI_YELLOW}   Seeding the following synthetic content tagged seed_origin='${DEV_SEED_ORIGIN_TAG}':${ANSI_RESET}`,
	);
	const formatRow = (count: number, label: string): string =>
		`${ANSI_YELLOW}     - ${String(count).padStart(3)} ${label}${ANSI_RESET}`;
	lines.push(formatRow(counts.user, 'bauth_user row  (Abby, marked via address.seed_origin)'));
	lines.push(formatRow(counts.cards, 'study.card rows (Abby personal)'));
	lines.push(formatRow(counts.scenarios, 'study.scenario rows'));
	lines.push(formatRow(counts.plans, 'study.study_plan row (active)'));
	lines.push(formatRow(counts.sessions, 'study.session rows (historical, last 7 days)'));
	lines.push(formatRow(counts.reviews, 'study.review rows'));
	lines.push(formatRow(counts.sessionItemResults, 'study.session_item_result rows'));
	lines.push('');
	lines.push(`${ANSI_YELLOW}   Remove with:    bun run db seed:remove --origin ${DEV_SEED_ORIGIN_TAG}${ANSI_RESET}`);
	lines.push(`${ANSI_YELLOW}   Verify clean:   bun run db seed:check${ANSI_RESET}`);
	process.stdout.write(`\n${lines.join('\n')}\n`);
}

async function phaseAbby(): Promise<void> {
	process.stdout.write('\n=== seed: abby ===\n');
	const counts = await seedAbby();
	printYellowDevSeedBanner(counts);
}

const PHASE_FNS: Record<Phase, () => Promise<void>> = {
	users: phaseUsers,
	knowledge: phaseKnowledge,
	handbooks: phaseHandbooks,
	references: phaseReferences,
	credentials: phaseCredentials,
	cards: phaseCards,
	abby: phaseAbby,
};

async function prompt(message: string): Promise<string> {
	process.stdout.write(message);
	for await (const line of console) return line;
	return '';
}

async function enforceGuard(target: string | undefined): Promise<void> {
	const databaseUrl = process.env[ENV_VARS.DATABASE_URL] ?? DEV_DB_URL;
	const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('-')));
	const decision = decideSeedGuard({
		databaseUrl,
		nodeEnv: process.env[ENV_VARS.NODE_ENV],
		flags,
	});

	if (decision.kind === 'allow') return;

	if (decision.kind === 'block') {
		process.stderr.write(`\nseed-all: refusing to proceed.\n  ${decision.message}\n`);
		process.exit(1);
	}

	// allow-bypass: require interactive 'yes' confirmation.
	process.stdout.write('\nWARNING: bypass flag accepted. The DATABASE_URL host or NODE_ENV looks like production.\n');
	process.stdout.write('         Are you sure you want to seed? Type "yes" to continue: ');
	const answer = (await prompt('')).trim().toLowerCase();
	if (answer !== 'yes') {
		process.stdout.write('Aborted.\n');
		process.exit(0);
	}
	void target;
}

async function main(): Promise<void> {
	const target = process.argv[2];
	const phases: readonly Phase[] = target && !target.startsWith('-') ? [target].filter(isPhase) : PHASES;

	if (target && !target.startsWith('-') && phases.length === 0) {
		process.stderr.write(`seed-all: unknown phase '${target}'. Expected one of: ${PHASES.join(', ')}\n`);
		process.exit(1);
	}

	await enforceGuard(target);

	for (const phase of phases) {
		await PHASE_FNS[phase]();
	}

	process.stdout.write('\nseed: done.\n');
}

main().catch((err) => {
	process.stderr.write(`seed-all: ${(err as Error).stack ?? err}\n`);
	process.exit(1);
});
