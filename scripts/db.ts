#!/usr/bin/env bun

/**
 * Database management dispatcher for airboss.
 *
 * Usage:
 *   bun run db <command> [flags]
 *   bun run db help                 # full command index
 *   bun run db <command> --help     # detailed help for one command
 */

import {
	DEV_DB,
	DEV_DB_HOST_PATTERN,
	DEV_DB_URL,
	DEV_SEED_ORIGIN_TAG,
	ENV_VARS,
	isProd,
	PORTS,
	SCHEMAS,
} from '@ab/constants';
import { confirmOrAbort } from './lib/prompt';
import { run, runOrThrow } from './lib/spawn';

const CONTAINER = 'airboss-db';
const DB_URL = process.env[ENV_VARS.DATABASE_URL] ?? DEV_DB_URL;
const DB_USER = DEV_DB.USER;
const DB_NAME = DEV_DB.NAME;

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('-'));
const command = positional[0];
const subTarget = positional[1];
const extraPositional = positional.slice(1);
const flags = new Set(args.filter((a) => a.startsWith('-')));
const force = flags.has('--force') || flags.has('-f');
const wantsHelp = flags.has('--help') || flags.has('-h');
const passthroughFlags = args.filter(
	(a) => a.startsWith('-') && a !== '--help' && a !== '-h' && a !== '--force' && a !== '-f',
);

async function query(sql: string): Promise<string> {
	const proc = Bun.spawn(['docker', 'exec', CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-t', '-A', '-c', sql], {
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const text = await new Response(proc.stdout).text();
	await proc.exited;
	return text.trim();
}

function assertLocalDb(): void {
	if (isProd() || !DEV_DB_HOST_PATTERN.test(DB_URL)) {
		console.error('Refusing to mutate DB: DATABASE_URL does not point at a local dev database');
		process.exit(1);
	}
}

async function doReset(): Promise<void> {
	assertLocalDb();
	await confirmOrAbort(`This will DROP and recreate "${DB_NAME}", then run the full seed. Continue?`, { force });
	// Terminate any lingering connections so DROP DATABASE doesn't fail with
	// "database is being accessed by other users" (leftover drizzle-studio,
	// crashed dev processes, abandoned postgres.js pools, etc.).
	await run([
		'docker',
		'exec',
		CONTAINER,
		'psql',
		'-U',
		DB_USER,
		'-d',
		'postgres',
		'-c',
		`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid();`,
	]);
	await run([
		'docker',
		'exec',
		CONTAINER,
		'psql',
		'-U',
		DB_USER,
		'-d',
		'postgres',
		'-c',
		`DROP DATABASE IF EXISTS ${DB_NAME};`,
	]);
	await run([
		'docker',
		'exec',
		CONTAINER,
		'psql',
		'-U',
		DB_USER,
		'-d',
		'postgres',
		'-c',
		`CREATE DATABASE ${DB_NAME};`,
	]);
	// pg_trgm is a contrib extension; the schema declares GIN trigram indexes on
	// study.card (front, back) using gin_trgm_ops. Drizzle-kit push fails the
	// CREATE INDEX if the extension is not present, so install it before push.
	// The extension is also re-declared at the top of drizzle/0000_initial.sql
	// so `bun run db migrate` against an empty DB works the same way.
	await run([
		'docker',
		'exec',
		CONTAINER,
		'psql',
		'-U',
		DB_USER,
		'-d',
		DB_NAME,
		'-c',
		'CREATE EXTENSION IF NOT EXISTS pg_trgm;',
	]);
	await run(['bunx', 'drizzle-kit', 'push']);
	await run(['bun', 'scripts/db/seed-all.ts']);
	// Final summary so the operator sees what landed.
	await run(['bun', 'scripts/db/seed-check.ts']);
}

async function doResetStudy(): Promise<void> {
	assertLocalDb();
	await confirmOrAbort(
		'This will TRUNCATE study.card, study.card_state, study.review, then re-materialize course cards. Continue?',
		{ force },
	);
	await run(['bun', 'scripts/db/reset-study.ts']);
	await run(['bun', 'scripts/db/seed-all.ts', 'cards']);
}

async function doSeed(): Promise<void> {
	// seed-all.ts owns the production guard now; do not double-gate.
	const seedArgs = ['bun', 'scripts/db/seed-all.ts'];
	if (subTarget) seedArgs.push(subTarget);
	// Forward bypass flags so the dev can opt into a non-allowlisted host.
	for (const f of passthroughFlags) seedArgs.push(f);
	await run(seedArgs);
}

async function doSeedRemove(): Promise<void> {
	const args = ['bun', 'scripts/db/seed-remove.ts'];
	// Default to the canonical tag if --origin isn't passed.
	const hasOriginFlag = passthroughFlags.some((f) => f === '--origin' || f.startsWith('--origin='));
	if (hasOriginFlag) {
		for (const f of passthroughFlags) args.push(f);
	} else {
		args.push('--origin', DEV_SEED_ORIGIN_TAG);
	}
	await run(args);
}

async function doSeedCheck(): Promise<void> {
	await run(['bun', 'scripts/db/seed-check.ts']);
}

async function doBuild(): Promise<void> {
	await run(['bun', 'scripts/build-knowledge-index.ts', ...passthroughFlags]);
}

interface BuildAllPhase {
	readonly name: string;
	readonly cmd: readonly string[];
}

const BUILD_ALL_PHASES: readonly BuildAllPhase[] = [
	// Knowledge graph must rebuild before relevance: relevance walks
	// `knowledge_node` rows and writes back to them, so the graph has to
	// reflect the current authored state first.
	{ name: 'knowledge', cmd: ['bun', 'scripts/build-knowledge-index.ts'] },
	{ name: 'relevance', cmd: ['bun', 'scripts/db/build-relevance-cache.ts'] },
];

async function doBuildAll(): Promise<void> {
	const summaries: Array<{ name: string; ms: number }> = [];
	const startedAt = Date.now();
	for (const phase of BUILD_ALL_PHASES) {
		console.log('');
		console.log(`=== build-all: ${phase.name} ===`);
		console.log(`> ${phase.cmd.join(' ')}`);
		const phaseStart = Date.now();
		await runOrThrow(phase.cmd);
		const ms = Date.now() - phaseStart;
		summaries.push({ name: phase.name, ms });
	}
	const totalMs = Date.now() - startedAt;
	console.log('');
	console.log('=== build-all: summary ===');
	for (const s of summaries) console.log(`  ${s.name.padEnd(12)} ${(s.ms / 1000).toFixed(2)}s`);
	console.log(`  ${'total'.padEnd(12)} ${(totalMs / 1000).toFixed(2)}s`);
}

async function doNew(): Promise<void> {
	const [domain, slug] = extraPositional;
	if (!domain || !slug) {
		console.error('Usage: bun run db new <domain> <slug>');
		process.exit(1);
	}
	await run(['bun', 'scripts/knowledge-new.ts', domain, slug]);
}

async function showStatus(): Promise<void> {
	console.log('\n--- DB STATUS ---');
	console.log(`Container : ${CONTAINER}`);
	console.log(`Port      : ${PORTS.DB}`);
	console.log(`URL       : ${DB_URL}`);
	console.log(`\npsql      : docker exec -it ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME}`);

	const containerProc = Bun.spawn(['docker', 'inspect', '--format', '{{.State.Status}}', CONTAINER], {
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const containerStatus = (await new Response(containerProc.stdout).text()).trim();
	await containerProc.exited;
	console.log(`\nContainer : ${containerStatus || 'not found'}`);
	if (containerStatus !== 'running') {
		console.log('DB is not running. Start it with: bun run db up');
		return;
	}

	const schemas = await query(
		"SELECT string_agg(schema_name, ', ' ORDER BY schema_name) FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast') AND schema_name NOT LIKE 'pg_%'",
	);
	console.log(`Schemas   : ${schemas || '(none)'}`);

	console.log('\n--- TABLE COUNTS ---');
	const tables: Array<[string, string]> = [
		['public.bauth_user', 'users'],
		[`${SCHEMAS.STUDY}.card`, 'cards'],
		[`${SCHEMAS.STUDY}.card_state`, 'card_states'],
		[`${SCHEMAS.STUDY}.review`, 'reviews'],
		[`${SCHEMAS.STUDY}.knowledge_node`, 'knowledge_nodes'],
		[`${SCHEMAS.STUDY}.knowledge_edge`, 'knowledge_edges'],
	];
	for (const [table, label] of tables) {
		const count = await query(`SELECT COUNT(*) FROM ${table}`).catch(() => '');
		console.log(`  ${label.padEnd(18)}: ${count || 'N/A (table missing)'}`);
	}
	console.log('');
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

interface CommandHelp {
	summary: string;
	what: string;
	why: string;
	how: string;
	links?: string[];
}

const COMMAND_HELP: Record<string, CommandHelp> = {
	status: {
		summary: 'Show DB connection info and table counts (default command)',
		what: 'Prints the container name, port, URL, running state, schemas, and row counts for the core tables (users, cards, card_state, review, knowledge_node, knowledge_edge).',
		why: 'One-shot sanity check before touching anything. Answers "is the DB up, what does it have in it, what URL am I pointing at?" without needing to open psql.',
		how: 'Uses `docker inspect` for container state and `docker exec psql -c "SELECT COUNT(*)..."` per table. Safe to run anytime -- read-only.',
		links: ['libs/constants/src/schemas.ts', 'libs/constants/src/dev.ts'],
	},
	up: {
		summary: 'Start the postgres container',
		what: 'Runs `docker compose up -d db` to bring the local Postgres container online.',
		why: 'The dev DB lives in a docker-compose service. Running this before any work that needs the DB avoids connection errors from a stopped container.',
		how: 'Thin passthrough to `docker compose up -d db`. Requires OrbStack or Docker Desktop to be running.',
		links: ['docker-compose.yml'],
	},
	down: {
		summary: 'Stop all compose containers',
		what: 'Runs `docker compose down` to stop every container in the compose file.',
		why: 'Clean way to shut down the dev environment. Not destructive -- data persists in the named volume.',
		how: 'Thin passthrough to `docker compose down`.',
	},
	push: {
		summary: 'Sync schema to the DB (drizzle-kit push)',
		what: 'Runs `drizzle-kit push` to apply the current Drizzle schema to the live DB without generating a migration.',
		why: 'Fast iteration during dev: change a schema file, push it, keep going. Never use in prod -- use `migrate` instead.',
		how: 'Reads `drizzle.config.ts`, diffs against the live DB, applies changes. Non-destructive for additive changes; prompts on destructive changes.',
		links: ['drizzle.config.ts', 'libs/bc/study/src/schema.ts', 'libs/auth/src/schema.ts'],
	},
	generate: {
		summary: 'Generate a new drizzle migration',
		what: 'Runs `drizzle-kit generate` to produce a SQL migration file under `drizzle/`.',
		why: 'For changes that need to be versioned (prod rollouts, audited schema changes). Dev typically uses `push` instead.',
		how: 'Diffs schema files against the last migration snapshot and writes a new SQL file plus a `meta/_journal.json` entry.',
	},
	migrate: {
		summary: 'Apply pending drizzle migrations',
		what: 'Runs `drizzle-kit migrate` to apply any SQL files in `drizzle/` that have not yet been recorded in the DB.',
		why: 'The production path. In dev you can usually `push` instead; use `migrate` when rehearsing a deployment.',
		how: 'Tracks applied migrations in a metadata table; skips already-applied ones.',
	},
	studio: {
		summary: 'Open drizzle-kit studio (web UI for the DB)',
		what: 'Runs `drizzle-kit studio`, which serves a browser-based table browser on a local port.',
		why: 'Sometimes a GUI is faster than psql for "what did that last seed actually insert?"',
		how: 'Reads `drizzle.config.ts`, connects to DB_URL, serves studio on its default port (drizzle decides).',
	},
	seed: {
		summary: 'Run seed orchestrator (users + knowledge + cards + abby by default)',
		what: 'Runs `scripts/db/seed-all.ts`. With no sub-target, executes all phases in order: (1) dev users via better-auth, (2) knowledge graph build from `course/knowledge/**/node.md`, (3) course-sourced study.card rows for every DEV_ACCOUNTS user, (4) Abby (canonical dev-seed test learner) plus her personal cards / scenarios / plan / sessions / reviews. Sub-targets run only that phase.\n\n  bun run db seed            # all phases\n  bun run db seed users      # only better-auth dev users\n  bun run db seed knowledge  # only knowledge_node + knowledge_edge from markdown\n  bun run db seed cards      # only course-sourced study.card rows\n  bun run db seed abby       # only Abby + her chained content',
		why: 'Single command to get a freshly-pushed DB to a usable state for dev. Every phase is idempotent -- safe to re-run at any time.',
		how: 'The orchestrator (scripts/db/seed-all.ts) shells out to `scripts/db/seed-dev-users.ts` and `scripts/build-knowledge-index.ts`, and imports `seedCardsForUser` from `scripts/db/seed-cards.ts` once per DEV_ACCOUNTS entry.',
		links: [
			'scripts/db/seed-all.ts',
			'scripts/db/seed-dev-users.ts',
			'scripts/build-knowledge-index.ts',
			'scripts/db/seed-cards.ts',
			'libs/constants/src/dev.ts',
			'docs/decisions/011-knowledge-graph-learning-system/decision.md',
			'docs/work-packages/knowledge-graph/spec.md',
		],
	},
	'seed:remove': {
		summary: 'Remove every dev-seeded row tagged with a given seed-origin marker',
		what: `Runs \`scripts/db/seed-remove.ts --origin <tag>\`. Atomically deletes (or, for \`bauth_user\`, untags) every row whose \`seed_origin\` column matches the given tag. FK order is enforced. Default tag (when no flag is passed) is the canonical \`${DEV_SEED_ORIGIN_TAG}\`.\n\n  bun run db seed:remove                                       # canonical tag\n  bun run db seed:remove --origin some-other-tag`,
		why: 'Lets a developer wipe synthetic dev content without rebuilding the whole database. Also the cleanup tool when a stray seed leaks into a non-dev DB; works in any environment so leaks can always be cleaned up.',
		how: 'Single transaction over the seeded tables in FK order. Each table is deleted by `seed_origin = <tag>` (or, for bauth_user, by `address->>seed_origin = <tag>` and the marker is stripped via jsonb subtraction so other data attached to the user survives).',
		links: ['scripts/db/seed-remove.ts', 'scripts/db/seed-tables.ts', 'libs/constants/src/dev.ts'],
	},
	'seed:check': {
		summary: 'Print a per-table count of rows that still carry a seed_origin marker',
		what: 'Runs `scripts/db/seed-check.ts`. For every seeded table, lists how many rows have a non-NULL `seed_origin`, grouped by tag. Default exits 0 (info command). Pass `--require-clean` to exit 1 when any seeded rows remain (CI gate).',
		why: '"What is in this DB right now?" -- one command answers it. Default behavior is informational so it is safe to run from any shell. The `--require-clean` flag turns it into a CI assertion that the DB has zero dev-seed rows.',
		how: 'Read-only query loop over the seeded tables. Reads `seed_origin` directly except on `bauth_user`, which uses `address->>seed_origin` since better-auth owns the table.',
		links: ['scripts/db/seed-check.ts', 'scripts/db/seed-tables.ts'],
	},
	reset: {
		summary: 'DROP + recreate DB, push schema, run full seed',
		what: 'Destroys the `airboss` database, recreates it empty, runs `drizzle-kit push` to materialize the schema, then runs the full seed orchestrator (users + knowledge + cards).\n\nRefuses to run if DATABASE_URL does not match the local dev pattern. Prompts for confirmation unless `--force` / `-f` is passed.',
		why: 'The nuclear option for "get me back to a known good state fast." Useful after schema churn, botched seeds, or when switching branches with divergent migrations. Leaves the DB ready to serve requests with dev users, the full knowledge graph, and their materialized cards.',
		how: 'Drops + creates the DB via `docker exec psql`, pushes the Drizzle schema, then delegates to `scripts/db/seed-all.ts` with no sub-target (all phases).',
		links: ['scripts/db/seed-all.ts', 'libs/constants/src/dev.ts (DEV_DB_HOST_PATTERN guards against prod)'],
	},
	'build-all': {
		summary: 'Run every authored-content build step in dependency order',
		what: 'Composite that runs each "build" phase in dependency order, idempotently:\n\n  1. knowledge   -- scripts/build-knowledge-index.ts (parses course/knowledge/**/node.md, validates the graph, upserts knowledge_node + knowledge_edge, rewrites course/knowledge/graph-index.md)\n  2. relevance   -- scripts/db/build-relevance-cache.ts (walks every active syllabus, accumulates (cert, bloom, priority) per linked knowledge node, writes to knowledge_node.relevance JSONB)\n\nPrints `=== build-all: <phase> ===` headers per phase and a final per-phase timing summary. Each phase is a live write (no --dry-run).',
		why: 'After authoring changes (new node.md files, edited frontmatter, syllabus link edits) a developer wants one command that derives every downstream artifact, in the right order, without remembering which scripts to run. `seed` covers ingest from authored content; `build-all` covers derivations from already-seeded inputs.',
		how: 'The name is intentionally hyphenated -- not `build:all` -- because this is a standalone composite, not a sub-target of `build`. Phases are defined in the `BUILD_ALL_PHASES` table in scripts/db.ts; add a phase by appending an entry. Each phase shells out via `runOrThrow`, so a phase failure aborts the composite with a non-zero exit and the failing phase name in the error.',
		links: [
			'scripts/build-knowledge-index.ts',
			'scripts/db/build-relevance-cache.ts',
			'docs/decisions/011-knowledge-graph-learning-system/decision.md',
		],
	},
	build: {
		summary: 'Build knowledge graph from course/knowledge/**/node.md',
		what: 'Runs `scripts/build-knowledge-index.ts`. Parses every `course/knowledge/**/node.md`, validates the graph (required fields, DAG on `requires`, duplicate id detection, unknown H2 detection, edge resolution), upserts `knowledge_node` and `knowledge_edge` rows, and rewrites `course/knowledge/graph-index.md`.\n\n  bun run db build                   # full build\n  bun run db build --dry-run         # validate only, no DB writes\n  bun run db build --json            # machine-readable build summary on stdout\n  bun run db build --fail-on-coverage # non-zero if any node is lifecycle=skeleton',
		why: 'Authoring lives in markdown + YAML; the graph lives in Postgres. `db build` is the bridge. `--dry-run` is what `bun run check` invokes pre-commit to catch broken frontmatter and dangling edges before they land.',
		how: 'Thin wrapper around `scripts/build-knowledge-index.ts` with flag pass-through. Validation is all-or-nothing: a single invalid node fails the whole build and leaves the DB untouched. The `bun run dev` loop also runs this automatically when sources are newer than `graph-index.md`.',
		links: [
			'scripts/build-knowledge-index.ts',
			'course/knowledge/graph-index.md',
			'docs/decisions/011-knowledge-graph-learning-system/decision.md',
			'docs/work-packages/knowledge-graph/spec.md',
		],
	},
	new: {
		summary: 'Scaffold a new knowledge-graph node',
		what: 'Runs `scripts/knowledge-new.ts <domain> <slug>`. Creates `course/knowledge/<domain>/<slug>/node.md` with a full frontmatter template (every field present, TODO-commented for unknown values) plus the seven H2 phase stubs (Context, Problem, Exploration, Principle, Application, Integration, Mastery).\n\n  bun run db new airspace vfr-weather-minimums\n  bun run db new weather cloud-types',
		why: 'Single entry point for authoring. Refuses to overwrite existing files and rejects unknown domains -- cheap guardrail against typos that would later fail validation.',
		how: 'Resolves the accepted domain set from `@ab/constants/study` (`DOMAIN_VALUES` plus graph-specific additions), writes the scaffold, exits. Follow up with `bun run db build --dry-run` to validate as you author.',
		links: ['scripts/knowledge-new.ts', 'libs/constants/src/study.ts', 'docs/work-packages/knowledge-graph/spec.md'],
	},
	'reset-study': {
		summary: 'TRUNCATE study.card/card_state/review, re-materialize cards',
		what: 'TRUNCATEs `study.card`, `study.card_state`, `study.review`, then re-runs the cards phase of the seed orchestrator. Auth users and the knowledge graph (knowledge_node/knowledge_edge) are untouched.',
		why: 'Fast "reset my review queue" loop during FSRS or scheduler work. No need to re-seed users or rebuild the knowledge graph.',
		how: 'Runs `scripts/db/reset-study.ts` (TRUNCATE CASCADE), then `scripts/db/seed-all.ts cards`.',
		links: ['scripts/db/reset-study.ts', 'scripts/db/seed-cards.ts'],
	},
	psql: {
		summary: 'Open an interactive psql shell in the DB container',
		what: 'Runs `docker exec -it airboss-db psql -U airboss -d airboss`.',
		why: 'For ad-hoc queries, quick inspection, or SQL that is too awkward for drizzle-kit studio.',
		how: 'Requires the container to be running (`bun run db up` first).',
	},
	help: {
		summary: 'Show the command index (or detailed help for one command)',
		what: '`bun run db help` prints the index of every command with its one-line summary. `bun run db <command> --help` prints a what/why/how/links block for that command only.',
		why: 'The dispatcher is the single entry point for every DB-adjacent task -- help has to be discoverable, not buried.',
		how: 'Authored in a `COMMAND_HELP` record in scripts/db.ts, one entry per command. Keep it terse and links-driven.',
		links: ['CLAUDE.md', 'scripts/db.ts'],
	},
};

function printCommandHelp(name: string): void {
	const entry = COMMAND_HELP[name];
	if (!entry) {
		console.error(`No help entry for '${name}'.`);
		process.exit(1);
	}
	console.log(`\nbun run db ${name}`);
	console.log('-'.repeat(`bun run db ${name}`.length));
	console.log(`\n  ${entry.summary}`);
	console.log(`\nWhat\n  ${entry.what.replace(/\n/g, '\n  ')}`);
	console.log(`\nWhy\n  ${entry.why.replace(/\n/g, '\n  ')}`);
	console.log(`\nHow\n  ${entry.how.replace(/\n/g, '\n  ')}`);
	if (entry.links && entry.links.length > 0) {
		console.log('\nLinks');
		for (const link of entry.links) console.log(`  - ${link}`);
	}
	console.log('');
}

interface CommandGroup {
	label: string;
	commands: readonly string[];
}

// Ordered so day-to-day dev flow reads top-down: inspect what's there,
// start/stop the container, sync the schema, seed/reset the data, then
// the meta help. Commands within a group are ordered by frequency of use.
const COMMAND_GROUPS: readonly CommandGroup[] = [
	{ label: 'Inspection', commands: ['status', 'psql', 'studio'] },
	{ label: 'Container lifecycle', commands: ['up', 'down'] },
	{ label: 'Schema', commands: ['push', 'generate', 'migrate'] },
	{ label: 'Data + content', commands: ['seed', 'seed:check', 'seed:remove', 'reset', 'reset-study'] },
	{ label: 'Knowledge authoring', commands: ['new', 'build', 'build-all'] },
	{ label: 'Utility', commands: ['help'] },
];

function printIndex(): void {
	console.log('Usage: bun run db <command> [flags]');
	console.log('       bun run db <command> --help   # detailed help for one command');
	console.log('');
	console.log('Commands:');
	const allNames = COMMAND_GROUPS.flatMap((g) => g.commands);
	const width = allNames.reduce((m, n) => Math.max(m, n.length), 0);
	for (const group of COMMAND_GROUPS) {
		console.log('');
		console.log(`  ${group.label}`);
		for (const name of group.commands) {
			const entry = COMMAND_HELP[name];
			if (!entry) continue;
			console.log(`    ${name.padEnd(width)}  ${entry.summary}`);
		}
	}
	console.log('');
	console.log('Flags:');
	console.log('  --force, -f   Skip confirmation prompts (reset, reset-study)');
	console.log('  --help, -h    Show detailed help for a command');
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const handlers: Record<string, () => Promise<void> | void> = {
	status: showStatus,
	help: printIndex,
	up: () => run(['docker', 'compose', 'up', '-d', 'db']),
	down: () => run(['docker', 'compose', 'down']),
	push: () => run(['bunx', 'drizzle-kit', 'push']),
	generate: () => run(['bunx', 'drizzle-kit', 'generate']),
	migrate: () => run(['bunx', 'drizzle-kit', 'migrate']),
	studio: () => run(['bunx', 'drizzle-kit', 'studio']),
	seed: doSeed,
	'seed:remove': doSeedRemove,
	'seed:check': doSeedCheck,
	psql: () => run(['docker', 'exec', '-it', CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME]),
	reset: doReset,
	'reset-study': doResetStudy,
	build: doBuild,
	'build-all': doBuildAll,
	new: doNew,
};

if (wantsHelp) {
	if (!command || command === 'help') {
		printIndex();
	} else {
		printCommandHelp(command);
	}
	process.exit(0);
}

const handler = command ? handlers[command] : handlers.status;
if (!handler) {
	console.error(`Unknown command: ${command}\n`);
	printIndex();
	process.exit(1);
}

await handler();
