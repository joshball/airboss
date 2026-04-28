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
 *   5a. reference-corpus-seed -- manifest-driven registry seeding for the
 *                    small / irregular corpora that have no derivative-tree
 *                    ingestion pipeline yet (orders, ntsb). Reads
 *                    libs/sources/src/<corpus>/manifest.yaml and patches the
 *                    in-process `@ab/sources` registry so authored
 *                    `airboss-ref:orders/...` and `airboss-ref:ntsb/...`
 *                    URLs validate clean. ADR 019 §1.2, §2.6.
 *   5b. migrate-references -- reshape every legacy LegacyCitation entry on
 *                    knowledge_node.references into a uniform
 *                    StructuredCitation, resolving against the seeded
 *                    `study.reference` registry. Idempotent on
 *                    `references_v2_migrated`. Cert-syllabus WP phase 17.
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
import { seedAsrsFromManifest } from '@ab/sources/asrs/seed';
import { seedFormsFromManifest } from '@ab/sources/forms/seed';
import { seedInfoFromManifest } from '@ab/sources/info/seed';
import { seedInterpFromManifest } from '@ab/sources/interp/seed';
import { seedNtsbFromManifest } from '@ab/sources/ntsb/seed';
import { seedOrdersFromManifest } from '@ab/sources/orders/seed';
import { seedPlatesFromManifest } from '@ab/sources/plates/seed';
import { seedPohsFromManifest } from '@ab/sources/pohs/seed';
import { seedSafoFromManifest } from '@ab/sources/safo/seed';
import { seedSectionalsFromManifest } from '@ab/sources/sectionals/seed';
import { seedStatutesFromManifest } from '@ab/sources/statutes/seed';
import { seedTcdsFromManifest } from '@ab/sources/tcds/seed';
import { prompt } from '../lib/prompt';
import { runOrThrow } from '../lib/spawn';
import { migrateReferencesToStructured } from './migrate-references-to-structured';
import { type AbbySeedCounts, seedAbby } from './seed-abby';
import { seedCardsForUser } from './seed-cards';
import { seedCredentials } from './seed-credentials';
import { decideSeedGuard } from './seed-guard';
import { seedHandbooks } from './seed-handbooks';
import { seedReferences } from './seed-references';
import { seedSyllabi } from './seed-syllabi';

type Phase =
	| 'users'
	| 'knowledge'
	| 'handbooks'
	| 'references'
	| 'credentials'
	| 'syllabi'
	| 'credential-syllabi'
	| 'reference-corpus-seed'
	| 'migrate-references'
	| 'cards'
	| 'abby';

const PHASES: readonly Phase[] = [
	'users',
	'knowledge',
	'handbooks',
	'references',
	'credentials',
	'syllabi',
	'credential-syllabi',
	'reference-corpus-seed',
	'migrate-references',
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

async function phaseUsers(): Promise<void> {
	process.stdout.write('\n=== seed: users ===\n');
	await runOrThrow(['bun', 'scripts/db/seed-dev-users.ts'], { cwd: REPO_ROOT });
}

async function phaseKnowledge(): Promise<void> {
	process.stdout.write('\n=== seed: knowledge ===\n');
	await runOrThrow(['bun', 'scripts/build-knowledge-index.ts'], { cwd: REPO_ROOT });
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

async function phaseSyllabi(): Promise<void> {
	process.stdout.write('\n=== seed: syllabi ===\n');
	const summary = await seedSyllabi();
	process.stdout.write(
		`  ${summary.syllabiUpserted} syllabi, ${summary.nodesUpserted} nodes, ${summary.linksUpserted} knowledge-graph links (${summary.linksSkipped} skipped)\n`,
	);
}

async function phaseCredentialSyllabi(): Promise<void> {
	// Re-run the credential seed AFTER syllabi land so credential_syllabus
	// rows the first credential pass deferred can resolve.
	process.stdout.write('\n=== seed: credential <-> syllabus links ===\n');
	const summary = await seedCredentials();
	process.stdout.write(
		`  ${summary.syllabusLinksUpserted} resolved (${summary.syllabusLinksSkipped} still pending syllabi authoring)\n`,
	);
}

async function phaseReferenceCorpusSeed(): Promise<void> {
	// Manifest-driven registry seeding for the small / irregular corpora that
	// don't have a derivative-tree ingestion pipeline yet. Each corpus's
	// `seedXFromManifest` reads `libs/sources/src/<corpus>/manifest.yaml` and
	// patches `__sources_internal__` + `__editions_internal__` so authored
	// `airboss-ref:<corpus>/...` URLs resolve clean during the migrate-references
	// pass that follows. Idempotent: re-runs leave the registry unchanged.
	process.stdout.write('\n=== seed: reference corpus (irregular corpora) ===\n');
	const seeders: ReadonlyArray<readonly [string, () => Promise<CorpusSeedReport>]> = [
		['orders', seedOrdersFromManifest],
		['ntsb', seedNtsbFromManifest],
		['interp', seedInterpFromManifest],
		['pohs', seedPohsFromManifest],
		['sectionals', seedSectionalsFromManifest],
		['plates', seedPlatesFromManifest],
		['statutes', seedStatutesFromManifest],
		['forms', seedFormsFromManifest],
		['info', seedInfoFromManifest],
		['safo', seedSafoFromManifest],
		['tcds', seedTcdsFromManifest],
		['asrs', seedAsrsFromManifest],
	] as const;
	for (const [name, run] of seeders) {
		const report = await run();
		const padded = name.padEnd(11);
		process.stdout.write(
			`  ${padded}: ${report.entriesRegistered} registered (${report.entriesAlreadyAccepted} already accepted), ${report.editionsRegistered} editions, ${report.skipReasons.length} skipped\n`,
		);
		for (const reason of report.skipReasons) {
			process.stdout.write(`    skip: ${reason}\n`);
		}
	}
}

interface CorpusSeedReport {
	readonly entriesRegistered: number;
	readonly entriesAlreadyAccepted: number;
	readonly editionsRegistered: number;
	readonly skipReasons: readonly string[];
}

async function phaseMigrateReferences(): Promise<void> {
	// Reshape every legacy LegacyCitation entry on `knowledge_node.references`
	// into a uniform StructuredCitation, resolving each entry against the now-
	// seeded `study.reference` registry. Idempotent on `references_v2_migrated`;
	// re-runs are no-ops once every row is flipped to true.
	process.stdout.write('\n=== seed: migrate references -> StructuredCitation ===\n');
	const report = await migrateReferencesToStructured();
	process.stdout.write(
		`  scanned ${report.rowsScanned}, already-migrated ${report.rowsAlreadyMigrated}, migrated ${report.rowsMigrated}\n`,
	);
	process.stdout.write(
		`  citations reshaped ${report.citationsReshaped}, already-structured ${report.citationsAlreadyStructured}, synthetic refs created ${report.syntheticReferencesCreated}\n`,
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
	syllabi: phaseSyllabi,
	'credential-syllabi': phaseCredentialSyllabi,
	'reference-corpus-seed': phaseReferenceCorpusSeed,
	'migrate-references': phaseMigrateReferences,
	cards: phaseCards,
	abby: phaseAbby,
};

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
