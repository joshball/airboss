#!/usr/bin/env bun
/**
 * Seed orchestrator for the local dev DB.
 *
 * Runs phases in order, each idempotent:
 *
 *   1. users      -- better-auth rows for DEV_ACCOUNTS (scripts/db/seed-dev-users.ts)
 *   2. knowledge  -- knowledge_node + knowledge_edge from course/knowledge/**\/node.md
 *                    (scripts/build-knowledge-index.ts, full build)
 *   3. references -- authored reference rows (ACS / PTS / companion guide /
 *                    CFR titles) from course/references/*.yaml. Runs BEFORE
 *                    handbooks because the CFR manifest seeder looks up
 *                    `study.reference` rows by slug and skips Parts that
 *                    don't yet have a row (49cfr830, 49cfr1552 used to get
 *                    lost on first-time seed when this phase ran after
 *                    handbooks).
 *   4. handbooks  -- reference + reference_section + reference_figure rows
 *                    from the committed handbooks/ tree (both section-tree
 *                    and whole-doc manifest shapes; post-WP-SUB) plus per-Part
 *                    section laydown for CFR titles, attaching to the rows
 *                    that the references phase just authored.
 *                    (scripts/db/seed-references-from-manifest.ts :: seedReferencesFromManifest)
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

import { mkdirSync, openSync, writeSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEV_ACCOUNTS, DEV_DB_URL, DEV_SEED_ORIGIN_TAG, ENV_VARS } from '@ab/constants';
import { client } from '@ab/db/connection';
import { seedAsrsFromManifest } from '@ab/sources/asrs/seed';
import { seedFormsFromManifest } from '@ab/sources/forms/seed';
import { seedInfoFromManifest } from '@ab/sources/info/seed';
import { seedInterpFromManifest } from '@ab/sources/interp/seed';
import { seedNtsbFromManifest } from '@ab/sources/ntsb/seed';
import { seedNtsbAljFromManifest } from '@ab/sources/ntsb-alj/seed';
import { seedOrdersFromManifest } from '@ab/sources/orders/seed';
import { seedPlatesFromManifest } from '@ab/sources/plates/seed';
import { seedPohsFromManifest } from '@ab/sources/pohs/seed';
import { seedSafoFromManifest } from '@ab/sources/safo/seed';
import { seedSectionalsFromManifest } from '@ab/sources/sectionals/seed';
import { seedStatutesFromManifest } from '@ab/sources/statutes/seed';
import { seedTcdsFromManifest } from '@ab/sources/tcds/seed';
import { prompt } from '../lib/prompt';
import { runOrThrowPiped } from '../lib/spawn';
import { type StatusLine, startStatusLine } from '../lib/status-line';
import { migrateReferencesToStructured } from './migrate-references-to-structured';
import { type AbbySeedCounts, seedAbby } from './seed-abby';
import { seedCardsForUser } from './seed-cards';
import { seedCredentials } from './seed-credentials';
import { decideSeedGuard } from './seed-guard';
import { seedReferences } from './seed-references';
import { seedReferencesFromManifest } from './seed-references-from-manifest';
import { seedCourses } from './seed-courses';
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
	| 'courses'
	| 'abby';

const PHASES: readonly Phase[] = [
	'users',
	'knowledge',
	'references',
	'handbooks',
	'credentials',
	'syllabi',
	'credential-syllabi',
	'reference-corpus-seed',
	'migrate-references',
	'cards',
	'courses',
	'abby',
] as const;
const REPO_ROOT = resolve(import.meta.dir, '..', '..');

const ANSI_YELLOW = '[33m';
const ANSI_BOLD = '[1m';
const ANSI_RESET = '[0m';

function isPhase(value: string): value is Phase {
	return (PHASES as readonly string[]).includes(value);
}

const REPORT_DIR = resolve(REPO_ROOT, '.reports', 'seed');

/**
 * Per-phase wrapper.
 *
 * Output policy:
 *  - The terminal sees one in-place spinner line ("⠋ <phase> (12s) -- <detail>")
 *    while the phase runs, then one summary line when it finishes.
 *  - Everything else the phase wrote -- per-edition lines, skip lists, third-
 *    party noise from drizzle-kit, individual record-counts -- is captured
 *    into `.reports/seed/<phase>.log`. The log is the source of truth when
 *    something goes wrong; the terminal is for at-a-glance progress.
 *  - Status-line updates flow via `progress(detail)` passed to the phase fn.
 *    Phases call it whenever they make a unit of progress (one edition seeded,
 *    one seeder finished, etc).
 *
 * Implementation: redirect `process.stdout.write` and `process.stderr.write`
 * to write into the log fd only (i.e. _not_ the terminal). When the phase
 * resolves, restore the originals. The status line bypasses this redirect by
 * holding its own write reference, so the spinner stays visible without
 * cluttering the log.
 */
interface PhaseSummary {
	/** One-liner shown after the phase resolves. */
	readonly headline: string;
}

interface PhaseRunResult {
	readonly bytesLogged: number;
	readonly logPath: string;
	readonly summary: PhaseSummary;
}

type ProgressFn = (detail: string) => void;
type PhaseFn = (progress: ProgressFn) => Promise<PhaseSummary>;

async function runPhaseWithReport(phase: Phase, fn: PhaseFn): Promise<PhaseRunResult> {
	mkdirSync(REPORT_DIR, { recursive: true });
	const logPath = resolve(REPORT_DIR, `${phase}.log`);
	const fd = openSync(logPath, 'w');
	let bytesLogged = 0;

	const originalStdoutWrite = process.stdout.write.bind(process.stdout);
	const originalStderrWrite = process.stderr.write.bind(process.stderr);

	// While the phase runs, redirect stdout/stderr to the log file only. The
	// status line owns the terminal during this window; everything the phase
	// would have spewed lands in the per-phase log instead.
	const logOnly = ((chunk: unknown, ..._rest: unknown[]) => {
		try {
			const buf =
				typeof chunk === 'string'
					? Buffer.from(chunk, 'utf8')
					: chunk instanceof Buffer
						? chunk
						: Buffer.from(String(chunk), 'utf8');
			writeSync(fd, buf);
			bytesLogged += buf.length;
		} catch {
			// best-effort: a failing log write must not break the seed
		}
		return true;
	}) as unknown as typeof process.stdout.write;

	const status: StatusLine = startStatusLine(phase);
	process.stdout.write = logOnly;
	process.stderr.write = logOnly;
	// Bun's `console.log` doesn't always route through `process.stdout.write`;
	// it has a fast path that writes to fd 1 directly. Override the console
	// methods so per-edition `console.log` calls inside the seeders land in
	// the log file via our redirected write, not on the terminal under the
	// status line.
	const originalConsoleLog = console.log;
	const originalConsoleWarn = console.warn;
	const originalConsoleError = console.error;
	const consoleViaLog = (...args: unknown[]) => {
		const text = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
		logOnly(`${text}\n`);
	};
	console.log = consoleViaLog;
	console.warn = consoleViaLog;
	console.error = consoleViaLog;

	let summary: PhaseSummary = { headline: phase };
	try {
		summary = await fn((detail) => status.detail(detail));
	} finally {
		process.stdout.write = originalStdoutWrite;
		process.stderr.write = originalStderrWrite;
		console.log = originalConsoleLog;
		console.warn = originalConsoleWarn;
		console.error = originalConsoleError;
		status.finish();
		try {
			writeSync(fd, '');
		} catch {
			// ignore
		}
	}
	return { bytesLogged, logPath, summary };
}

async function phaseUsers(_progress: ProgressFn): Promise<PhaseSummary> {
	await runOrThrowPiped(['bun', 'scripts/db/seed-dev-users.ts'], { cwd: REPO_ROOT });
	return { headline: `${DEV_ACCOUNTS.length} dev users` };
}

async function phaseKnowledge(_progress: ProgressFn): Promise<PhaseSummary> {
	await runOrThrowPiped(['bun', 'scripts/build-knowledge-index.ts'], { cwd: REPO_ROOT });
	return { headline: 'knowledge graph rebuilt' };
}

async function phaseHandbooks(progress: ProgressFn): Promise<PhaseSummary> {
	const summary = await seedReferencesFromManifest({ progress });
	return {
		headline: `${summary.editionsProcessed} editions, ${summary.sectionsTouched} sections (${summary.sectionsChanged} changed), ${summary.figuresWritten} figures, ${summary.supersededLinks} superseded`,
	};
}

async function phaseReferences(progress: ProgressFn): Promise<PhaseSummary> {
	progress('upserting non-handbook references');
	const summary = await seedReferences();
	return { headline: `${summary.rowsUpserted} reference rows from ${summary.filesRead} file(s)` };
}

async function phaseCredentials(progress: ProgressFn): Promise<PhaseSummary> {
	progress('upserting credentials + prereqs');
	const summary = await seedCredentials();
	return {
		headline: `${summary.credentialsUpserted} credentials, ${summary.prereqsUpserted} prereqs, ${summary.syllabusLinksUpserted} links (${summary.syllabusLinksSkipped} pending)`,
	};
}

async function phaseSyllabi(progress: ProgressFn): Promise<PhaseSummary> {
	progress('upserting syllabi');
	const summary = await seedSyllabi();
	return {
		headline: `${summary.syllabiUpserted} syllabi, ${summary.nodesUpserted} nodes, ${summary.linksUpserted} graph links`,
	};
}

async function phaseCredentialSyllabi(progress: ProgressFn): Promise<PhaseSummary> {
	progress('resolving credential <-> syllabus links');
	const summary = await seedCredentials();
	return {
		headline: `${summary.syllabusLinksUpserted} resolved (${summary.syllabusLinksSkipped} still pending)`,
	};
}

async function phaseReferenceCorpusSeed(progress: ProgressFn): Promise<PhaseSummary> {
	const seeders: ReadonlyArray<readonly [string, () => Promise<CorpusSeedReport>]> = [
		['orders', seedOrdersFromManifest],
		['ntsb', seedNtsbFromManifest],
		['ntsb-alj', seedNtsbAljFromManifest],
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
	progress(`registering ${seeders.length} corpora`);
	const reports = await Promise.all(
		seeders.map(([name, run]) =>
			run()
				.then((report) => ({ name, report }) as const)
				.catch((err) => {
					throw new Error(`reference-corpus-seed: corpus '${name}' failed: ${(err as Error).message}`);
				}),
		),
	);
	let totalEntries = 0;
	let totalEditions = 0;
	for (const { name, report } of reports) {
		totalEntries += report.entriesRegistered;
		totalEditions += report.editionsRegistered;
		// Verbose breakdown only goes to the per-phase log via the redirected
		// stdout.write -- not the terminal.
		process.stdout.write(
			`  ${name.padEnd(11)}: ${report.entriesRegistered} registered, ${report.editionsRegistered} editions, ${report.skipReasons.length} skipped\n`,
		);
		for (const reason of report.skipReasons) {
			process.stdout.write(`    skip: ${reason}\n`);
		}
	}
	return { headline: `${reports.length} corpora, ${totalEntries} entries, ${totalEditions} editions` };
}

interface CorpusSeedReport {
	readonly entriesRegistered: number;
	readonly entriesAlreadyAccepted: number;
	readonly editionsRegistered: number;
	readonly skipReasons: readonly string[];
}

async function phaseMigrateReferences(progress: ProgressFn): Promise<PhaseSummary> {
	progress('reshaping legacy citations');
	const report = await migrateReferencesToStructured();
	return {
		headline: `${report.rowsMigrated}/${report.rowsScanned} migrated, ${report.citationsReshaped} reshaped, ${report.citationsAlreadyRefShape} ref-shape, ${report.syntheticReferencesCreated} synth refs`,
	};
}

async function phaseCards(progress: ProgressFn): Promise<PhaseSummary> {
	let total = 0;
	for (const account of DEV_ACCOUNTS) {
		progress(`seeding cards for ${account.email}`);
		await seedCardsForUser(account.email);
		total += 1;
	}
	return { headline: `cards for ${total} dev accounts` };
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

async function phaseCourses(progress: ProgressFn): Promise<PhaseSummary> {
	progress('seeding instructor courses from course/courses/<slug>/');
	const summary = await seedCourses();
	return {
		headline: `${summary.coursesWritten}/${summary.coursesScanned} courses written, ${summary.stepsWritten}/${summary.stepsScanned} steps written`,
	};
}

async function phaseAbby(progress: ProgressFn): Promise<PhaseSummary> {
	progress('seeding Abby + chained content');
	const counts = await seedAbby();
	// The yellow banner is verbose; route it to the per-phase log only.
	printYellowDevSeedBanner(counts);
	return {
		headline: `Abby + ${counts.cards} cards, ${counts.scenarios} scenarios, ${counts.sessions} sessions, ${counts.reviews} reviews`,
	};
}

const PHASE_FNS: Record<Phase, PhaseFn> = {
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
	courses: phaseCourses,
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

function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	const seconds = ms / 1000;
	if (seconds < 60) return `${seconds.toFixed(1)}s`;
	const minutes = Math.floor(seconds / 60);
	const remainder = seconds - minutes * 60;
	return `${minutes}m${remainder.toFixed(1)}s`;
}

/**
 * `--quick` skips the heavy reference-ingestion phases. Use it when you want
 * a fresh DB to reproduce a logic bug fast: dev users + knowledge graph +
 * Abby + cards land, but `handbooks` + `references` + `reference-corpus-seed`
 * (the multi-thousand-row registry seeders) are skipped. The migrate-references
 * phase is also skipped because it depends on `handbooks` having seeded
 * `study.reference` rows; running it without those rows would crash on
 * unresolved citations. Pair with `--only` to drill further.
 */
const QUICK_SKIP_PHASES: readonly Phase[] = [
	'handbooks',
	'references',
	'credentials',
	'syllabi',
	'credential-syllabi',
	'reference-corpus-seed',
	'migrate-references',
];

interface ParsedArgs {
	readonly target: string | undefined;
	readonly skip: ReadonlyArray<Phase>;
	readonly only: ReadonlyArray<Phase> | null;
	readonly quick: boolean;
}

function parseArgs(argv: ReadonlyArray<string>): ParsedArgs {
	let target: string | undefined;
	const skip: Phase[] = [];
	let only: Phase[] | null = null;
	let quick = false;
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === undefined) continue;
		if (arg === '--quick' || arg === '-q') {
			quick = true;
			continue;
		}
		if (arg === '--skip') {
			const value = argv[i + 1];
			if (value === undefined) throw new Error("seed-all: '--skip' requires a comma-separated phase list");
			skip.push(...parsePhaseList(value, '--skip'));
			i += 1;
			continue;
		}
		if (arg.startsWith('--skip=')) {
			skip.push(...parsePhaseList(arg.slice('--skip='.length), '--skip'));
			continue;
		}
		if (arg === '--only') {
			const value = argv[i + 1];
			if (value === undefined) throw new Error("seed-all: '--only' requires a comma-separated phase list");
			only = (only ?? []).concat(parsePhaseList(value, '--only'));
			i += 1;
			continue;
		}
		if (arg.startsWith('--only=')) {
			only = (only ?? []).concat(parsePhaseList(arg.slice('--only='.length), '--only'));
			continue;
		}
		if (arg.startsWith('-')) continue;
		// First positional = single-phase target (preserve existing behaviour).
		if (target === undefined) target = arg;
	}
	return { target, skip, only, quick };
}

function parsePhaseList(value: string, flag: string): Phase[] {
	const out: Phase[] = [];
	for (const raw of value.split(',')) {
		const name = raw.trim();
		if (name.length === 0) continue;
		if (!isPhase(name)) {
			throw new Error(`seed-all: '${flag}' got unknown phase '${name}'. Expected one of: ${PHASES.join(', ')}`);
		}
		out.push(name);
	}
	return out;
}

async function main(): Promise<void> {
	const argv = process.argv.slice(2);
	let parsed: ParsedArgs;
	try {
		parsed = parseArgs(argv);
	} catch (err) {
		process.stderr.write(`${(err as Error).message}\n`);
		process.exit(1);
	}
	const { target, skip, only, quick } = parsed;

	let phases: readonly Phase[];
	if (target !== undefined) {
		if (!isPhase(target)) {
			process.stderr.write(`seed-all: unknown phase '${target}'. Expected one of: ${PHASES.join(', ')}\n`);
			process.exit(1);
		}
		phases = [target];
	} else if (only !== null) {
		phases = only;
	} else {
		const skipSet = new Set<Phase>(skip);
		if (quick) for (const p of QUICK_SKIP_PHASES) skipSet.add(p);
		phases = PHASES.filter((p) => !skipSet.has(p));
	}

	await enforceGuard(target);

	if (quick || skip.length > 0 || only !== null) {
		const omitted = PHASES.filter((p) => !phases.includes(p));
		if (omitted.length > 0) {
			process.stdout.write(`seed-all: skipping ${omitted.join(', ')} (--quick / --skip / --only)\n`);
		}
	}

	const phaseTimings: Array<{ phase: Phase; ms: number; headline: string }> = [];
	const totalStart = performance.now();
	for (const phase of phases) {
		const phaseStart = performance.now();
		const result = await runPhaseWithReport(phase, PHASE_FNS[phase]);
		const ms = Math.round(performance.now() - phaseStart);
		phaseTimings.push({ phase, ms, headline: result.summary.headline });
		// One green check + phase + duration + summary, that's it.
		process.stdout.write(`  ✓ ${phase.padEnd(22)} ${formatDuration(ms).padStart(7)}  ${result.summary.headline}\n`);
	}
	const totalMs = Math.round(performance.now() - totalStart);

	// The last line is the wall-clock total so it always survives terminal
	// scroll truncation.
	process.stdout.write(`\nseed: done in ${formatDuration(totalMs)}  (logs: .reports/seed/)\n`);
}

main()
	.catch((err) => {
		process.stderr.write(`seed-all: ${(err as Error).stack ?? err}\n`);
		process.exitCode = 1;
	})
	.finally(() => client.end());
