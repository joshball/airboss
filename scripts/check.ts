#!/usr/bin/env bun
/**
 * Project-wide check pipeline.
 *
 * Usage:
 *   bun run check                        # default: dirty (only what's relevant to your changes; <10s typical)
 *   bun run check dirty                  # explicit: dirty (vs HEAD)
 *   bun run check branch                 # dirty (vs origin/main)
 *   bun run check quick                  # full repo, but skip svelte-check (~20s)
 *   bun run check types                  # svelte-check across all 5 apps (~120-200s)
 *   bun run check all                    # quick + types -- CI / pre-PR (~150-220s)
 *   bun run check checks                 # list every individual check with summary
 *   bun run check checks <name>          # deep what/why/how/links for one check
 *   bun run check help                   # full command index
 *
 * Flags (apply to any command):
 *   --verbose         Print failed-step output as each step finishes (no dashboard).
 *   --plain           Force plain start/finish log output even on a TTY.
 *   --scope=<scope>   (back-compat) Same as positional scope argument.
 *
 * `dirty` mode is git-aware: it only runs the checks whose domain overlaps
 * the changed files. References/help-ids/browser-globals/etc. each have a
 * `relevantWhen(dirtyFiles)` predicate; if nothing in their domain changed,
 * they don't run. Per-file linters (biome, theme-lint, test-lint, md-format)
 * run only on the changed files. Result: a typical agent-edit check is <10s.
 *
 * Runs steps in parallel. svelte-check is concurrency-capped (each one is a
 * full TS+Svelte compile per app). Per-step output is cached at
 * `.cache/check/<step>.{stdout,stderr,exit}` for post-mortem inspection.
 */

import { $ } from 'bun';
import {
	closeSync,
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dir, '..');
const CACHE_DIR = resolve(REPO_ROOT, '.cache', 'check');
const TIMINGS_PATH = resolve(CACHE_DIR, 'timings.json');
const TIMINGS_KEEP = 5;

// ---------------------------------------------------------------------------
// CLI types and parsing
// ---------------------------------------------------------------------------

type Profile = 'quick' | 'types' | 'all' | 'dirty' | 'branch';
const VALID_PROFILES: readonly Profile[] = ['quick', 'types', 'all', 'dirty', 'branch'];

interface CliArgs {
	profile: Profile;
	verbose: boolean;
	plain: boolean;
	wantsHelp: boolean;
	helpTarget: string | undefined;
	checksCommand: boolean;
	checksTarget: string | undefined;
}

function isProfile(v: string): v is Profile {
	return (VALID_PROFILES as readonly string[]).includes(v);
}

function parseArgs(argv: readonly string[]): CliArgs {
	let profile: Profile | undefined;
	let verbose = false;
	let plain = false;
	let wantsHelp = false;
	let helpTarget: string | undefined;
	let checksCommand = false;
	let checksTarget: string | undefined;

	const positional: string[] = [];
	for (let i = 0; i < argv.length; i += 1) {
		const a = argv[i] ?? '';
		if (a === '--help' || a === '-h') {
			wantsHelp = true;
		} else if (a === '--verbose') {
			verbose = true;
		} else if (a === '--plain') {
			plain = true;
		} else if (a === '--scope') {
			const next = argv[i + 1];
			if (next === undefined || next.startsWith('--') || !isProfile(next)) {
				throw new Error(`--scope requires a value (${VALID_PROFILES.join('|')}); got ${next ?? '(missing)'}`);
			}
			profile = next;
			i += 1;
		} else if (a.startsWith('--scope=')) {
			const v = a.slice('--scope='.length);
			if (!isProfile(v)) throw new Error(`Invalid --scope: ${v}. Expected ${VALID_PROFILES.join('|')}.`);
			profile = v;
		} else if (a.startsWith('-')) {
			throw new Error(`Unknown flag: ${a}. Run \`bun run check help\` for usage.`);
		} else {
			positional.push(a);
		}
	}

	const cmd = positional[0];
	if (cmd !== undefined) {
		if (cmd === 'help') {
			wantsHelp = true;
			helpTarget = positional[1];
		} else if (cmd === 'checks') {
			checksCommand = true;
			checksTarget = positional[1];
		} else if (isProfile(cmd)) {
			if (profile !== undefined && profile !== cmd) {
				throw new Error(`Conflicting profile: positional '${cmd}' vs --scope=${profile}.`);
			}
			profile = cmd;
			if (wantsHelp) helpTarget = cmd;
		} else {
			throw new Error(`Unknown command: ${cmd}. Expected ${VALID_PROFILES.join('|')}|checks|help.`);
		}
	}

	return {
		profile: profile ?? 'dirty',
		verbose,
		plain,
		wantsHelp,
		helpTarget,
		checksCommand,
		checksTarget,
	};
}

// ---------------------------------------------------------------------------
// Command help (mirrors db.ts / references.ts: what/why/how/links per command)
// ---------------------------------------------------------------------------

interface CommandHelp {
	summary: string;
	what: string;
	why: string;
	how: string;
	links?: string[];
}

const COMMAND_HELP: Record<string, CommandHelp> = {
	dirty: {
		summary: 'Default. Only checks relevant to changed files (typically <10s).',
		what: `Runs every check whose domain overlaps your dirty files. Per-file linters (biome, theme-lint, test-lint, md-format) run only on the changed files. Graph validators (references, airboss-ref, knowledge, help-ids, browser-globals, frontmatter) skip entirely if nothing in their domain changed. svelte-check:study runs only if .ts/.svelte/lib files changed; the other 4 svelte-checks skip on dirty.

  bun run check                # default
  bun run check dirty
  bun run check dirty --verbose`,
		why: 'The agent-loop default. Most edits touch a handful of files; running every check at full breadth wastes 100s+ of seconds. Only run what could plausibly fail given what you changed.',
		how: 'Unions `git diff --name-only HEAD` and `git ls-files --others --exclude-standard`. Each step has a `relevantWhen(dirty)` predicate; if it returns false, the step is skipped. Per-file linters scope down to just the changed files of the right extension. See `bun run check checks` for the predicate per step.',
		links: ['scripts/check.ts'],
	},
	branch: {
		summary: 'Like `dirty`, scoped to files changed vs origin/main.',
		what: `Same as \`dirty\` but uses the union of \`git diff --name-only <merge-base>...HEAD\` and untracked files. Broader file set; same gating rules.

  bun run check branch`,
		why: 'Pre-PR pass. Covers the full diff a reviewer will see, not just what is uncommitted right now.',
		how: 'Computes `git merge-base HEAD origin/main` and uses three-dot diff against it. Falls back to a two-dot diff against `origin/main` if no merge-base exists. Requires `origin/main` to be reasonably fresh; run `git fetch` first if your reviewer is on a newer base.',
		links: ['scripts/check.ts'],
	},
	quick: {
		summary: 'Full repo, but skip svelte-check. ~15-25s.',
		what: `Runs every check EXCEPT svelte-check at full breadth (no dirty-gating).

  bun run check quick
  bun run check quick --verbose`,
		why: "Use when you want a full pass over biome, the graph validators, and the frontmatter checks but don't want to wait for svelte-check. Useful after refactors where the dirty set doesn't capture everything.",
		how: 'Selects steps with tier `fast` or `medium`. No dirty-gating; every step runs on the full repo.',
		links: ['scripts/check.ts'],
	},
	types: {
		summary: 'svelte-check across all 5 apps (~120-200s).',
		what: `Runs only svelte-check on apps/study, sim, hangar, avionics, flightbag. Concurrency-capped at 2 to avoid CPU/heap thrashing.

  bun run check types
  bun run check types --verbose`,
		why: 'svelte-check is the slowest part of the pipeline by a wide margin (apps/study alone is ~3 minutes on a cold cache). Splitting it out lets the default profile stay fast and lets you run type checks deliberately when you have changed types, signatures, or component props.',
		how: 'Each svelte-check is `bunx svelte-check --tsconfig ./tsconfig.json` in the app directory. They run 2-at-a-time -- 5-at-a-time thrashes RAM and is slower wall-clock.',
		links: ['apps/*/tsconfig.json'],
	},
	all: {
		summary: 'quick + types. The CI / pre-PR mode.',
		what: `Runs every check at full breadth. ~150-220s on a clean machine.

  bun run check all
  bun run check all --verbose`,
		why: 'The "before pushing" mode and the CI mode. Catches everything regardless of which files you touched.',
		how: 'Spawns all steps in parallel; svelte-check is concurrency-capped to 2.',
		links: ['scripts/check.ts'],
	},
	checks: {
		summary: 'List or describe individual checks.',
		what: `\`bun run check checks\` lists every check (across every profile) with its tier and one-line summary. \`bun run check checks <name>\` prints the what/why/how/links for one check.

  bun run check checks                # full list
  bun run check checks biome          # deep dive on one check
  bun run check checks svelte-check`,
		why: 'When a check fails or is slow, you want to know what it does and why it exists -- not "biome", but "biome runs on 1767 files, here is what it catches, here is the config." This command is that lookup.',
		how: 'Authored in a STEP_HELP record in scripts/check.ts, one entry per check.',
		links: ['scripts/check.ts'],
	},
	help: {
		summary: 'Show the command index (or detailed help for one command).',
		what: '`bun run check help` prints the index. `bun run check <command> --help` prints details for one command. `bun run check checks` lists individual checks.',
		why: 'The dispatcher is the single entry point for the check pipeline. Help has to be discoverable, not buried in the npm script list.',
		how: 'Authored in a COMMAND_HELP record in scripts/check.ts, one entry per command.',
		links: ['scripts/check.ts', 'CLAUDE.md'],
	},
};

interface CommandGroup {
	label: string;
	commands: readonly string[];
}

const COMMAND_GROUPS: readonly CommandGroup[] = [
	{ label: 'Default (git-aware, fast)', commands: ['dirty', 'branch'] },
	{ label: 'Full repo', commands: ['quick', 'types', 'all'] },
	{ label: 'Inspection', commands: ['checks', 'help'] },
];

function printCommandHelp(name: string): void {
	const entry = COMMAND_HELP[name];
	if (!entry) {
		console.error(`No help entry for '${name}'. Try \`bun run check help\` for the index.`);
		process.exit(1);
	}
	console.log(`\nbun run check ${name}`);
	console.log('-'.repeat(`bun run check ${name}`.length));
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

function printCommandIndex(): void {
	console.log('Usage: bun run check [<command>] [flags]');
	console.log('       bun run check <command> --help   # details for one command');
	console.log('       bun run check checks             # list individual checks');
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
	console.log('  --verbose     Print failed-step output as each step finishes (no dashboard).');
	console.log('  --plain       Force plain start/finish log output (default on non-TTY).');
	console.log('  --help, -h    Show detailed help for a command.');
	console.log('');
	console.log('Default is `dirty` (git-aware, <10s typical). Use `all` before pushing or in CI.');
}

// ---------------------------------------------------------------------------
// Step registry
// ---------------------------------------------------------------------------

type Tier = 'fast' | 'medium' | 'heavy';

interface StepHelp {
	tier: Tier;
	scopable: boolean;
	summary: string;
	what: string;
	why: string;
	how: string;
	links?: string[];
}

const STEP_HELP: Record<string, StepHelp> = {
	biome: {
		tier: 'medium',
		scopable: true,
		summary: 'Lint + format check across all .ts/.tsx/.js/.svelte/.json/.css files',
		what: 'Runs `biome check` over 1700+ files in the repo. Catches lint violations, unused imports, formatting drift, etc. In `dirty`/`branch` scopes, runs only on changed files.',
		why: 'Biome is the project formatter and linter (per CLAUDE.md). Failing biome means non-conforming code that would fail CI.',
		how: 'Configured in `biome.json`. Run `bunx biome check --write .` to auto-fix the safe issues.',
		links: ['biome.json'],
	},
	references: {
		tier: 'fast',
		scopable: false,
		summary: 'Validate reference schema, wiki-links, help-page citations, source registry',
		what: 'Five layers of validation: reference schema gates, content wiki-link resolution, help-page validation, source registry coherence, meta.json integrity. See `bun run references validate --help` for detail.',
		why: 'The quality gate for `[[display::id]]` wiki-links across knowledge nodes, help pages, and reference paraphrases. Runs full because correctness depends on the global registry, not on which files changed.',
		how: '`bun run references validate`. Pure function over AVIATION_REFERENCES, helpRegistry, and SOURCES.',
		links: ['scripts/references.ts', 'scripts/references/validate.ts'],
	},
	'airboss-ref': {
		tier: 'fast',
		scopable: false,
		summary: 'Validate identifier shapes per ADR 019',
		what: 'Walks the source registry and validates every identifier against the airboss-ref grammar (kind/scope/id triples). Fails on malformed or duplicated ids.',
		why: 'ADR 019 phase 1 -- without identifier discipline, the cross-app reference system silently breaks at runtime.',
		how: '`bun scripts/airboss-ref.ts`. Walks the registry in-process, no external IO.',
		links: ['scripts/airboss-ref.ts', 'docs/decisions/019-source-corpus-architecture/'],
	},
	knowledge: {
		tier: 'fast',
		scopable: false,
		summary: 'Knowledge graph build dry-run',
		what: 'Reads every `course/knowledge/**/node.md`, parses front matter, validates the ADR-011 atomic-node shape, and verifies graph edges resolve. `--dry-run` skips the DB write.',
		why: 'Knowledge nodes are markdown-authored; validation here catches authoring errors (bad refs, missing required fields) before they reach the build step.',
		how: '`bun scripts/build-knowledge-index.ts --dry-run`.',
		links: ['scripts/build-knowledge-index.ts', 'docs/decisions/011-knowledge-graph-learning-system/'],
	},
	'theme-lint': {
		tier: 'fast',
		scopable: true,
		summary: 'Enforce design tokens (no hex literals in .svelte/.css)',
		what: 'Walks .svelte and .css files looking for hex color literals, raw px values where tokens exist, and other design-token violations.',
		why: 'The themes work package mandates token-based styling. theme-lint is the gate that keeps hex from creeping back in.',
		how: '`bun tools/theme-lint/bin.ts`. Scopable: pass file paths to lint just those.',
		links: ['tools/theme-lint/'],
	},
	'test-lint': {
		tier: 'fast',
		scopable: true,
		summary: 'Lint test files (no toBeTruthy on existence, etc.)',
		what: 'Walks *.test.ts files looking for known-bad assertions like `.toBeTruthy()` on existence checks, `.toBe(true)` on objects, etc.',
		why: 'Weak assertions pass without telling you what they expected. test-lint blocks them before they ship.',
		how: '`bun tools/test-lint/bin.ts`. Grandfathered legacy violations live in `tools/test-lint/ignore.txt`.',
		links: ['tools/test-lint/', 'tools/test-lint/ignore.txt'],
	},
	'help-ids': {
		tier: 'fast',
		scopable: false,
		summary: 'Validate every `helpId` prop on InfoTip / PageHelp components',
		what: 'Greps every .svelte file for `<InfoTip helpId=...>` and `<PageHelp helpId=...>` and checks each id against the help registry.',
		why: 'Mistyped helpIds silently render empty drawers. This is the static gate.',
		how: '`bun scripts/validate-help-ids.ts`. Runs full because the registry is global.',
		links: ['scripts/validate-help-ids.ts', 'libs/help/'],
	},
	'browser-globals': {
		tier: 'fast',
		scopable: false,
		summary: 'Block Buffer/process/node:* leaks into client bundles',
		what: 'Walks every browser-bundled lib (libs/{constants,utils,types,themes,ui,help,aviation,...}) and every apps/*/src/** file, blocking static imports of `node:*`, references to `Buffer`/`process` globals, and runtime imports that transitively pull in @ab/db/connection or postgres.',
		why: "happy-dom polyfills these so vitest passes green; real Firefox/Safari crashes at hydration. This is THE gate that catches the `/memory` Buffer crash class. See PR #664 and docs/agents/debug-playbooks/browser-hydration.md.",
		how: '`bun scripts/check-browser-globals.ts`. Walks every value re-export from each runtime barrel transitively.',
		links: ['scripts/check-browser-globals.ts', 'docs/agents/debug-playbooks/browser-hydration.md'],
	},
	'course-frontmatter': {
		tier: 'fast',
		scopable: false,
		summary: 'Validate front matter on course/ markdown files',
		what: 'Walks `course/**/*.md`, parses front matter, validates required fields and shape per the course content schema.',
		why: 'Course content is markdown-authored. Schema drift here breaks the loader at build time.',
		how: '`bun tools/course-frontmatter/check.ts`.',
		links: ['tools/course-frontmatter/'],
	},
	'wp-frontmatter': {
		tier: 'fast',
		scopable: false,
		summary: 'Validate front matter on docs/work-packages/**/*.md',
		what: 'Walks every work-package doc and validates front matter (status, dates, owner, etc.) against the work-package contract.',
		why: 'Work packages are the project tracking system. Schema drift here breaks the loader CLI and dashboards.',
		how: '`bun scripts/lint/wp-frontmatter.ts`.',
		links: ['scripts/lint/wp-frontmatter.ts', 'docs/work-packages/'],
	},
	'md-format': {
		tier: 'fast',
		scopable: false,
		summary: 'Markdown formatting check (table alignment, blank lines, fence langs)',
		what: 'Runs the project markdown formatter in `--check` mode. Enforces MD060 (pipe-table alignment), MD022 (blanks around headings), MD031 (blanks around fences), MD032 (blanks around lists), MD040 (fence language tags).',
		why: 'Per CLAUDE.md, all markdown is aligned-style with strict spacing. Auto-format with `bun run format:md`.',
		how: '`bun tools/md-format/bin.ts --check`. Run without `--check` to fix in place.',
		links: ['tools/md-format/'],
	},
	'svelte-check:study': {
		tier: 'heavy',
		scopable: false,
		summary: 'TypeScript + Svelte type-check on apps/study',
		what: 'Full TS program + Svelte component type-check on apps/study. Slowest single step in the pipeline (~120-200s on a cold cache) because apps/study is the largest app.',
		why: 'Type errors in Svelte components only surface here -- vitest with happy-dom ignores them.',
		how: '`bunx svelte-check --tsconfig ./tsconfig.json` from apps/study.',
		links: ['apps/study/tsconfig.json'],
	},
	'svelte-check:sim': {
		tier: 'heavy',
		scopable: false,
		summary: 'TypeScript + Svelte type-check on apps/sim',
		what: 'Full TS + Svelte type-check on apps/sim.',
		why: 'Same as svelte-check:study, scoped to apps/sim.',
		how: '`bunx svelte-check --tsconfig ./tsconfig.json` from apps/sim.',
		links: ['apps/sim/tsconfig.json'],
	},
	'svelte-check:hangar': {
		tier: 'heavy',
		scopable: false,
		summary: 'TypeScript + Svelte type-check on apps/hangar',
		what: 'Full TS + Svelte type-check on apps/hangar.',
		why: 'Same as svelte-check:study, scoped to apps/hangar.',
		how: '`bunx svelte-check --tsconfig ./tsconfig.json` from apps/hangar.',
		links: ['apps/hangar/tsconfig.json'],
	},
	'svelte-check:avionics': {
		tier: 'heavy',
		scopable: false,
		summary: 'TypeScript + Svelte type-check on apps/avionics',
		what: 'Full TS + Svelte type-check on apps/avionics.',
		why: 'Same as svelte-check:study, scoped to apps/avionics.',
		how: '`bunx svelte-check --tsconfig ./tsconfig.json` from apps/avionics.',
		links: ['apps/avionics/tsconfig.json'],
	},
	'svelte-check:flightbag': {
		tier: 'heavy',
		scopable: false,
		summary: 'TypeScript + Svelte type-check on apps/flightbag',
		what: 'Full TS + Svelte type-check on apps/flightbag.',
		why: 'Same as svelte-check:study, scoped to apps/flightbag.',
		how: '`bunx svelte-check --tsconfig ./tsconfig.json` from apps/flightbag.',
		links: ['apps/flightbag/tsconfig.json'],
	},
	'handbook-ingest': {
		tier: 'fast',
		scopable: false,
		summary: 'pytest on tools/handbook-ingest orphan-threshold suite',
		what: 'Runs `pytest tests/test_orphan_thresholds.py` in tools/handbook-ingest. Validates the orphan-classification thresholds the section extractor relies on.',
		why: 'The handbook ingest pipeline is the only Python in the repo. This is the smoke test that keeps it from regressing silently.',
		how: 'Uses `tools/handbook-ingest/.venv/bin/python` if present, else `python3`.',
		links: ['tools/handbook-ingest/', 'tools/handbook-ingest/tests/'],
	},
	'glossary-budget': {
		tier: 'fast',
		scopable: false,
		summary: 'Block glossary corpus growth past 64 KiB',
		what: 'Sums file sizes across libs/help/src/glossary/content/**/*.md and fails if total exceeds 64 KiB.',
		why: 'The glossary is eager-globbed into every page bundle. Past 64 KiB the cost stops being trivial; trim entries or move to lazy import().',
		how: 'Pure stat; no parsing.',
		links: ['libs/help/src/glossary/'],
	},
};

function printChecksIndex(): void {
	console.log('Individual checks (run via `bun run check checks <name>` for detail):');
	console.log('');
	const byTier: Record<Tier, string[]> = { fast: [], medium: [], heavy: [] };
	for (const name of Object.keys(STEP_HELP)) {
		const entry = STEP_HELP[name];
		if (!entry) continue;
		byTier[entry.tier].push(name);
	}
	const tierLabel: Record<Tier, string> = {
		fast: 'Fast (<10s each, run in `quick`)',
		medium: 'Medium (~20s, run in `quick`)',
		heavy: 'Heavy (~70-200s each, run in `types`)',
	};
	const allNames = Object.keys(STEP_HELP);
	const width = allNames.reduce((m, n) => Math.max(m, n.length), 0);
	for (const tier of ['fast', 'medium', 'heavy'] as const) {
		if (byTier[tier].length === 0) continue;
		console.log(`  ${tierLabel[tier]}`);
		for (const name of byTier[tier]) {
			const entry = STEP_HELP[name];
			if (!entry) continue;
			const scopeMark = entry.scopable ? ' [scopable]' : '';
			console.log(`    ${name.padEnd(width)}  ${entry.summary}${scopeMark}`);
		}
		console.log('');
	}
}

function printCheckDetail(name: string): void {
	const entry = STEP_HELP[name];
	if (!entry) {
		console.error(`No check named '${name}'. Run \`bun run check checks\` for the list.`);
		process.exit(1);
	}
	console.log(`\n${name}`);
	console.log('-'.repeat(name.length));
	console.log(`\n  ${entry.summary}`);
	console.log(`\nTier      ${entry.tier}${entry.scopable ? ' (scopable)' : ''}`);
	console.log(`\nWhat\n  ${entry.what.replace(/\n/g, '\n  ')}`);
	console.log(`\nWhy\n  ${entry.why.replace(/\n/g, '\n  ')}`);
	console.log(`\nHow\n  ${entry.how.replace(/\n/g, '\n  ')}`);
	if (entry.links && entry.links.length > 0) {
		console.log('\nLinks');
		for (const link of entry.links) console.log(`  - ${link}`);
	}
	console.log('');
}

// ---------------------------------------------------------------------------
// Step types
// ---------------------------------------------------------------------------

type StepStatus = 'pending' | 'running' | 'done' | 'failed';

interface StepResult {
	name: string;
	exitCode: number;
	elapsedMs: number;
	stdout: string;
	stderr: string;
	stdoutPath: string;
	stderrPath: string;
}

type StepFn = () => Promise<{ exitCode: number; stdout: string; stderr: string }>;

function ensureCacheDir(): void {
	mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Tiny semaphore for capping concurrency on a lane.
 * svelte-check is heavy (full TS program + Svelte compile per app).
 * Running 5 in parallel thrashes CPU/heap and is slower wall-clock than 2-at-a-time.
 */
function createSemaphore(max: number): { acquire(): Promise<() => void> } {
	let active = 0;
	const queue: Array<() => void> = [];
	const next = (): void => {
		if (active >= max) return;
		const fn = queue.shift();
		if (!fn) return;
		active += 1;
		fn();
	};
	return {
		acquire: () =>
			new Promise<() => void>((resolve) => {
				const release = (): void => {
					active -= 1;
					next();
				};
				const grant = (): void => resolve(release);
				queue.push(grant);
				next();
			}),
	};
}

// ---------------------------------------------------------------------------
// Timings cache (drives progress bars based on prior-run medians)
// ---------------------------------------------------------------------------

interface TimingsFile {
	steps: Record<string, number[]>;
}

function loadTimings(): TimingsFile {
	try {
		const raw = readFileSync(TIMINGS_PATH, 'utf-8');
		const parsed = JSON.parse(raw) as TimingsFile;
		if (parsed && typeof parsed === 'object' && parsed.steps) return parsed;
	} catch {
		/* fresh */
	}
	return { steps: {} };
}

function saveTimings(t: TimingsFile): void {
	try {
		writeFileSync(TIMINGS_PATH, JSON.stringify(t));
	} catch {
		/* best-effort */
	}
}

function medianMs(samples: readonly number[]): number | undefined {
	if (samples.length === 0) return undefined;
	const sorted = [...samples].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 0) {
		const lo = sorted[mid - 1] ?? 0;
		const hi = sorted[mid] ?? 0;
		return Math.round((lo + hi) / 2);
	}
	return sorted[mid] ?? 0;
}

// ---------------------------------------------------------------------------
// Reporters
// ---------------------------------------------------------------------------

interface Reporter {
	register(name: string, expectedMs: number | undefined): void;
	start(name: string): void;
	finish(name: string, exitCode: number): void;
	close(): void;
}

class LogReporter implements Reporter {
	private startTimes = new Map<string, number>();

	register(_name: string, _expectedMs: number | undefined): void {
		/* no-op */
	}

	start(name: string): void {
		this.startTimes.set(name, Date.now());
		console.log(`[start] ${name}`);
	}

	finish(name: string, exitCode: number): void {
		const start = this.startTimes.get(name) ?? Date.now();
		const dur = ((Date.now() - start) / 1000).toFixed(1);
		const sym = exitCode === 0 ? 'OK' : 'FAIL';
		console.log(`[${sym}] ${name} (${dur}s)`);
	}

	close(): void {
		/* no-op */
	}
}

interface RecordEntry {
	expectedMs?: number;
	status: StepStatus;
	startedAt?: number;
	finishedAt?: number;
	exitCode?: number;
}

class TTYReporter implements Reporter {
	private records = new Map<string, RecordEntry>();
	private order: string[] = [];
	private lastLineCount = 0;
	private timer: ReturnType<typeof setInterval> | undefined;
	private startedAt = Date.now();
	private closed = false;

	constructor() {
		this.timer = setInterval(() => this.render(), 250);
	}

	register(name: string, expectedMs: number | undefined): void {
		this.records.set(name, { expectedMs, status: 'pending' });
		this.order.push(name);
	}

	start(name: string): void {
		const r = this.records.get(name);
		if (!r) return;
		r.status = 'running';
		r.startedAt = Date.now();
		this.render();
	}

	finish(name: string, exitCode: number): void {
		const r = this.records.get(name);
		if (!r) return;
		r.status = exitCode === 0 ? 'done' : 'failed';
		r.exitCode = exitCode;
		r.finishedAt = Date.now();
		this.render();
	}

	close(): void {
		if (this.closed) return;
		this.closed = true;
		if (this.timer) clearInterval(this.timer);
		this.render();
		process.stdout.write('\n');
	}

	private clearPrevious(): void {
		if (this.lastLineCount === 0) return;
		const out = process.stdout;
		out.write(`\x1b[${this.lastLineCount}A`);
		out.write('\x1b[J');
	}

	private render(): void {
		const out = process.stdout;
		const lines: string[] = [];
		const longestName = this.order.reduce((acc, n) => Math.max(acc, n.length), 0);
		let done = 0;
		let running = 0;
		let failed = 0;
		const now = Date.now();

		for (const name of this.order) {
			const r = this.records.get(name);
			if (!r) continue;

			let symbol: string;
			let bar = '';
			let durStr = '';

			if (r.status === 'pending') {
				symbol = ' ·  ';
				durStr = '';
			} else if (r.status === 'running') {
				running += 1;
				symbol = '\x1b[36m>>> \x1b[0m';
				const elapsed = now - (r.startedAt ?? now);
				durStr = `${(elapsed / 1000).toFixed(1)}s`;
				bar = this.bar(elapsed, r.expectedMs);
			} else if (r.status === 'done') {
				done += 1;
				symbol = '\x1b[32m OK \x1b[0m';
				const elapsed = (r.finishedAt ?? now) - (r.startedAt ?? now);
				durStr = `${(elapsed / 1000).toFixed(1)}s`;
			} else {
				failed += 1;
				done += 1;
				symbol = '\x1b[31mFAIL\x1b[0m';
				const elapsed = (r.finishedAt ?? now) - (r.startedAt ?? now);
				durStr = `${(elapsed / 1000).toFixed(1)}s`;
			}

			const namePad = name.padEnd(longestName, ' ');
			const durPad = durStr.padStart(7, ' ');
			lines.push(`  ${symbol}  ${namePad}  ${durPad}  ${bar}`);
		}

		const totalElapsed = ((now - this.startedAt) / 1000).toFixed(1);
		lines.push('');
		lines.push(
			`${done}/${this.order.length} done${failed > 0 ? ` · ${failed} failed` : ''} · ${running} running · elapsed ${totalElapsed}s`,
		);

		this.clearPrevious();
		out.write(`${lines.join('\n')}\n`);
		this.lastLineCount = lines.length;
	}

	private bar(elapsedMs: number, expectedMs: number | undefined): string {
		const barWidth = 20;
		if (expectedMs === undefined || expectedMs <= 0) {
			const phase = Math.floor((elapsedMs / 100) % barWidth);
			const cells: string[] = [];
			for (let i = 0; i < barWidth; i += 1) cells.push(i === phase ? '█' : '░');
			return cells.join('');
		}
		const ratio = Math.min(1, elapsedMs / expectedMs);
		const filled = Math.round(ratio * barWidth);
		const overrun = elapsedMs > expectedMs;
		const fillChar = overrun ? '\x1b[33m█\x1b[0m' : '█';
		return fillChar.repeat(filled) + '░'.repeat(barWidth - filled);
	}
}

function pickReporter(args: CliArgs): Reporter {
	if (args.verbose || args.plain) return new LogReporter();
	if (process.stdout.isTTY) return new TTYReporter();
	return new LogReporter();
}

// ---------------------------------------------------------------------------
// Step runner
// ---------------------------------------------------------------------------

async function runStep(
	name: string,
	fn: StepFn,
	reporter: Reporter,
	semaphore?: { acquire(): Promise<() => void> },
): Promise<StepResult> {
	const release = semaphore ? await semaphore.acquire() : undefined;
	reporter.start(name);
	const start = Date.now();
	const stdoutPath = resolve(CACHE_DIR, `${name}.stdout`);
	const stderrPath = resolve(CACHE_DIR, `${name}.stderr`);
	const exitPath = resolve(CACHE_DIR, `${name}.exit`);
	try {
		const r = await fn();
		writeFileSync(stdoutPath, r.stdout);
		writeFileSync(stderrPath, r.stderr);
		writeFileSync(exitPath, String(r.exitCode));
		reporter.finish(name, r.exitCode);
		return {
			name,
			exitCode: r.exitCode,
			elapsedMs: Date.now() - start,
			stdout: r.stdout,
			stderr: r.stderr,
			stdoutPath,
			stderrPath,
		};
	} catch (err) {
		const msg = (err as Error).message ?? String(err);
		writeFileSync(stderrPath, msg);
		writeFileSync(exitPath, '99');
		reporter.finish(name, 99);
		return {
			name,
			exitCode: 99,
			elapsedMs: Date.now() - start,
			stdout: '',
			stderr: msg,
			stdoutPath,
			stderrPath,
		};
	} finally {
		release?.();
	}
}

/**
 * Run a child process and capture stdout / stderr.
 *
 * IMPORTANT: do NOT use `stdout: 'pipe'` + `new Response(stream).text()`.
 * When several chatty children run in parallel (svelte-check x5), the
 * JS-side pull loops compete and the OS pipe buffer (~64 KiB on macOS)
 * fills, blocking child writes -- the entire pipeline hangs because the
 * child is stuck waiting for someone to read while we are stuck waiting
 * for the child to exit.
 *
 * Fix: hand the OS an open file descriptor for stdout / stderr. The
 * kernel handles buffering via the regular file write path, no userland
 * back-pressure window. Each invocation gets its own temp file so
 * parallel callers don't collide.
 */
async function shellRun(
	cmd: string,
	args: readonly string[],
	cwd?: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	const tmpToken = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
	const stdoutTmp = join(tmpdir(), `airboss-check-${tmpToken}.stdout`);
	const stderrTmp = join(tmpdir(), `airboss-check-${tmpToken}.stderr`);
	const stdoutFd = openSync(stdoutTmp, 'w');
	const stderrFd = openSync(stderrTmp, 'w');
	let fdsClosed = false;
	const closeFds = (): void => {
		if (fdsClosed) return;
		fdsClosed = true;
		try {
			closeSync(stdoutFd);
		} catch {
			/* ignore */
		}
		try {
			closeSync(stderrFd);
		} catch {
			/* ignore */
		}
	};
	try {
		const proc = Bun.spawn([cmd, ...args], {
			cwd: cwd ?? REPO_ROOT,
			stdout: stdoutFd,
			stderr: stderrFd,
		});
		const exitCode = await proc.exited;
		closeFds();
		const stdout = readFileSync(stdoutTmp, 'utf-8');
		const stderr = readFileSync(stderrTmp, 'utf-8');
		return { exitCode, stdout, stderr };
	} finally {
		closeFds();
		try {
			unlinkSync(stdoutTmp);
		} catch {
			/* ignore */
		}
		try {
			unlinkSync(stderrTmp);
		} catch {
			/* ignore */
		}
	}
}

// ---------------------------------------------------------------------------
// File scope (dirty / branch profiles)
// ---------------------------------------------------------------------------

async function dirtyFiles(profile: Profile): Promise<string[]> {
	if (profile !== 'dirty' && profile !== 'branch') return [];
	let raw = '';
	if (profile === 'dirty') {
		const tracked = await $`git diff --name-only HEAD`.cwd(REPO_ROOT).text();
		const untracked = await $`git ls-files --others --exclude-standard`.cwd(REPO_ROOT).text();
		raw = `${tracked}\n${untracked}`;
	} else {
		const base = (await $`git merge-base HEAD origin/main`.cwd(REPO_ROOT).nothrow().text()).trim();
		if (base === '') {
			raw = await $`git diff --name-only origin/main`.cwd(REPO_ROOT).nothrow().text();
		} else {
			raw = await $`git diff --name-only ${base}...HEAD`.cwd(REPO_ROOT).text();
			const untracked = await $`git ls-files --others --exclude-standard`.cwd(REPO_ROOT).text();
			raw = `${raw}\n${untracked}`;
		}
	}
	const set = new Set<string>();
	for (const line of raw.split('\n')) {
		const t = line.trim();
		if (t === '') continue;
		set.add(t);
	}
	return [...set];
}

function filterByExt(files: readonly string[], exts: readonly string[]): string[] {
	return files.filter((f) => exts.some((e) => f.endsWith(e)));
}

const fileExistsCache = new Map<string, boolean>();
function fileExists(rel: string): boolean {
	const cached = fileExistsCache.get(rel);
	if (cached !== undefined) return cached;
	const result = existsSync(resolve(REPO_ROOT, rel));
	fileExistsCache.set(rel, result);
	return result;
}

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

interface StepDef {
	name: string;
	fn: StepFn;
	tier: Tier;
	lane?: 'svelte-check';
	/**
	 * On `dirty` / `branch` profiles, the step runs only if this returns true.
	 * On `quick` / `types` / `all`, the predicate is ignored (full run).
	 *
	 * Default (no predicate): always run.
	 */
	relevantWhen?: (dirty: readonly string[]) => boolean;
}

function anyMatch(dirty: readonly string[], predicate: (f: string) => boolean): boolean {
	for (const f of dirty) if (predicate(f)) return true;
	return false;
}

function startsWithAny(f: string, prefixes: readonly string[]): boolean {
	for (const p of prefixes) if (f.startsWith(p)) return true;
	return false;
}

const BROWSER_BUNDLED_LIBS: readonly string[] = [
	'libs/constants/',
	'libs/utils/',
	'libs/types/',
	'libs/themes/',
	'libs/ui/',
	'libs/help/',
	'libs/aviation/',
	'libs/audit/',
	'libs/sources/',
	'libs/activities/',
	'libs/library/',
	'libs/bc/study/',
	'libs/bc/sim/',
];

function buildStepDefs(profile: Profile, dirty: readonly string[]): StepDef[] {
	const SVELTE_APPS = ['apps/study', 'apps/sim', 'apps/hangar', 'apps/avionics', 'apps/flightbag'] as const;
	const isScoped = profile === 'dirty' || profile === 'branch';
	const defs: StepDef[] = [];

	defs.push({
		name: 'biome',
		tier: 'medium',
		relevantWhen: (d) => filterByExt(d, ['.ts', '.tsx', '.js', '.svelte', '.json', '.css']).length > 0,
		fn: async () => {
			if (!isScoped) return shellRun('bunx', ['biome', 'check', '.']);
			const files = filterByExt(dirty, ['.ts', '.tsx', '.js', '.svelte', '.json', '.css']).filter(fileExists);
			if (files.length === 0) return { exitCode: 0, stdout: 'no files in scope', stderr: '' };
			return shellRun('bunx', ['biome', 'check', ...files]);
		},
	});

	defs.push({
		name: 'references',
		tier: 'fast',
		// References scans only prose where wiki-links live: knowledge nodes,
		// help content, registry paraphrases. docs/ and course/firc/ etc. are
		// not in scope.
		relevantWhen: (d) =>
			anyMatch(
				d,
				(f) =>
					(f.startsWith('course/knowledge/') && f.endsWith('.md')) ||
					f.startsWith('libs/aviation/') ||
					f.startsWith('libs/help/') ||
					/apps\/[^/]+\/src\/lib\/help\/content\//.test(f),
			),
		fn: () => shellRun('bun', ['scripts/references.ts', 'validate']),
	});

	defs.push({
		name: 'airboss-ref',
		tier: 'fast',
		// Identifier validation runs over the source registry + ACS lessons.
		relevantWhen: (d) =>
			anyMatch(d, (f) => f.startsWith('libs/aviation/') || f.startsWith('acs/') || f.startsWith('course/')),
		fn: () => shellRun('bun', ['scripts/airboss-ref.ts']),
	});

	defs.push({
		name: 'knowledge',
		tier: 'fast',
		relevantWhen: (d) => anyMatch(d, (f) => f.startsWith('course/knowledge/') && f.endsWith('.md')),
		fn: () => shellRun('bun', ['scripts/build-knowledge-index.ts', '--dry-run']),
	});

	defs.push({
		name: 'theme-lint',
		tier: 'fast',
		relevantWhen: (d) => filterByExt(d, ['.svelte', '.css']).length > 0,
		fn: async () => {
			if (!isScoped) return shellRun('bun', ['tools/theme-lint/bin.ts']);
			const files = filterByExt(dirty, ['.svelte', '.css']).filter(fileExists);
			if (files.length === 0) return { exitCode: 0, stdout: 'no files in scope', stderr: '' };
			return shellRun('bun', ['tools/theme-lint/bin.ts', ...files]);
		},
	});

	defs.push({
		name: 'test-lint',
		tier: 'fast',
		relevantWhen: (d) => d.some((f) => /\.test\.ts$/.test(f)),
		fn: async () => {
			if (!isScoped) return shellRun('bun', ['tools/test-lint/bin.ts']);
			const files = dirty.filter((f) => /\.test\.ts$/.test(f)).filter(fileExists);
			if (files.length === 0) return { exitCode: 0, stdout: 'no files in scope', stderr: '' };
			return shellRun('bun', ['tools/test-lint/bin.ts', ...files]);
		},
	});

	defs.push({
		name: 'help-ids',
		tier: 'fast',
		// helpId props live in .svelte files; the registry lives in libs/help/.
		relevantWhen: (d) =>
			anyMatch(d, (f) => f.endsWith('.svelte') || f.startsWith('libs/help/')),
		fn: () => shellRun('bun', ['scripts/validate-help-ids.ts']),
	});

	defs.push({
		name: 'browser-globals',
		tier: 'fast',
		// Walks browser-bundled libs + apps client code. Skip if nothing in those trees changed.
		relevantWhen: (d) =>
			anyMatch(
				d,
				(f) => /apps\/[^/]+\/src\//.test(f) || startsWithAny(f, BROWSER_BUNDLED_LIBS),
			),
		fn: () => shellRun('bun', ['scripts/check-browser-globals.ts']),
	});

	defs.push({
		name: 'course-frontmatter',
		tier: 'fast',
		relevantWhen: (d) => anyMatch(d, (f) => f.startsWith('course/') && f.endsWith('.md')),
		fn: () => shellRun('bun', ['tools/course-frontmatter/check.ts']),
	});

	defs.push({
		name: 'wp-frontmatter',
		tier: 'fast',
		relevantWhen: (d) => anyMatch(d, (f) => f.startsWith('docs/work-packages/') && f.endsWith('.md')),
		fn: () => shellRun('bun', ['scripts/lint/wp-frontmatter.ts']),
	});

	defs.push({
		name: 'md-format',
		tier: 'fast',
		relevantWhen: (d) => filterByExt(d, ['.md']).length > 0,
		fn: async () => {
			if (!isScoped) return shellRun('bun', ['tools/md-format/bin.ts', '--check']);
			const files = filterByExt(dirty, ['.md']).filter(fileExists);
			if (files.length === 0) return { exitCode: 0, stdout: 'no files in scope', stderr: '' };
			return shellRun('bun', ['tools/md-format/bin.ts', '--check', ...files]);
		},
	});

	// svelte-check predicates: a file change is "relevant" to app X if it's in apps/X
	// or in any browser-bundled lib (transitively imported by all apps). On `dirty`
	// we run *only* svelte-check:study by default (it's the canonical app and the
	// other 4 are scaffolds / smaller surfaces that rarely catch unique issues).
	for (const app of SVELTE_APPS) {
		const name = `svelte-check:${app.slice('apps/'.length)}`;
		const isStudy = app === 'apps/study';
		defs.push({
			name,
			tier: 'heavy',
			lane: 'svelte-check',
			relevantWhen: (d) => {
				if (!isStudy) return false; // dirty / branch never run the non-study svelte-checks
				// A change is type-relevant for apps/study only when it's:
				//  - inside apps/study itself, or
				//  - inside a browser-bundled lib (transitively imported), or
				//  - inside libs/bc/study (study's BC), or
				//  - in libs/db/ or libs/auth/ (server types app pages import)
				// Edits to scripts/, tools/, course/, docs/, drizzle/, etc. don't trigger it.
				return anyMatch(
					d,
					(f) =>
						f.startsWith(`${app}/`) ||
						startsWithAny(f, BROWSER_BUNDLED_LIBS) ||
						f.startsWith('libs/db/') ||
						f.startsWith('libs/auth/') ||
						f.startsWith('libs/hangar-jobs/') ||
						f.startsWith('libs/hangar-sync/'),
				);
			},
			fn: () =>
				shellRun(
					'bunx',
					['svelte-check', '--tsconfig', './tsconfig.json', '--incremental'],
					resolve(REPO_ROOT, app),
				),
		});
	}

	defs.push({
		name: 'handbook-ingest',
		tier: 'fast',
		relevantWhen: (d) => anyMatch(d, (f) => f.startsWith('tools/handbook-ingest/')),
		fn: async () => {
			const venv = 'tools/handbook-ingest/.venv/bin/python';
			const py = existsSync(resolve(REPO_ROOT, venv)) ? venv : 'python3';
			return shellRun(
				py,
				['-m', 'pytest', 'tests/test_orphan_thresholds.py'],
				resolve(REPO_ROOT, 'tools/handbook-ingest'),
			);
		},
	});

	defs.push({
		name: 'glossary-budget',
		tier: 'fast',
		relevantWhen: (d) => anyMatch(d, (f) => f.startsWith('libs/help/src/glossary/')),
		fn: async () => {
			const GLOSSARY_BUDGET_BYTES = 64 * 1024;
			const glob = new Bun.Glob('libs/help/src/glossary/content/**/*.md');
			let bytes = 0;
			for await (const file of glob.scan({ cwd: REPO_ROOT })) {
				try {
					bytes += statSync(resolve(REPO_ROOT, file)).size;
				} catch {
					/* ignore */
				}
			}
			if (bytes <= GLOSSARY_BUDGET_BYTES) {
				return {
					exitCode: 0,
					stdout: `glossary corpus: ${bytes} / ${GLOSSARY_BUDGET_BYTES} bytes (OK)\n`,
					stderr: '',
				};
			}
			return {
				exitCode: 1,
				stdout: '',
				stderr:
					`glossary corpus: ${bytes} bytes exceeds budget of ${GLOSSARY_BUDGET_BYTES} bytes.\n` +
					'Eager-globbed bundle cost is no longer trivial. Either trim entries or move to lazy import().\n',
			};
		},
	});

	return defs;
}

function selectByProfile(defs: readonly StepDef[], profile: Profile, dirty: readonly string[]): StepDef[] {
	if (profile === 'all') return [...defs];
	if (profile === 'types') return defs.filter((d) => d.tier === 'heavy');
	if (profile === 'quick') return defs.filter((d) => d.tier !== 'heavy');
	// dirty / branch: every step that has a `relevantWhen` predicate that returns true.
	// Heavy svelte-checks are kept too (predicate filters to study only) so a TS edit
	// still gets type-checked.
	return defs.filter((d) => {
		if (d.relevantWhen) return d.relevantWhen(dirty);
		return d.tier !== 'heavy'; // unguarded fast/medium always run; unguarded heavy doesn't
	});
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
	ensureCacheDir();
	const args = parseArgs(process.argv.slice(2));

	if (args.checksCommand) {
		if (args.checksTarget) printCheckDetail(args.checksTarget);
		else printChecksIndex();
		return 0;
	}

	if (args.wantsHelp) {
		if (args.helpTarget) printCommandHelp(args.helpTarget);
		else printCommandIndex();
		return 0;
	}

	console.log(`check: profile=${args.profile}${args.verbose ? ' (verbose)' : ''}`);

	// SvelteKit sync prereq is needed for any profile that runs svelte-check.
	const needsSync = args.profile === 'types' || args.profile === 'all';
	if (needsSync) {
		const SVELTE_APPS = ['apps/study', 'apps/sim', 'apps/hangar', 'apps/avionics', 'apps/flightbag'] as const;
		const syncJobs = SVELTE_APPS.filter(
			(app) => !existsSync(resolve(REPO_ROOT, `${app}/.svelte-kit/tsconfig.json`)),
		).map(async (app) => {
			console.log(`svelte-kit sync (${app})...`);
			await $`cd ${app} && bunx svelte-kit sync`.cwd(REPO_ROOT).quiet();
		});
		if (syncJobs.length > 0) await Promise.all(syncJobs);
	}

	const dirty = await dirtyFiles(args.profile);
	if (args.profile === 'dirty' || args.profile === 'branch') {
		console.log(`check: ${dirty.length} file(s) in scope`);
	}

	const allDefs = buildStepDefs(args.profile, dirty);
	const defs = selectByProfile(allDefs, args.profile, dirty);

	if (defs.length === 0) {
		console.log('No checks selected.');
		return 0;
	}

	// Front-load the heavy lane so svelte-checks (when present) start first;
	// everything else slots into the remaining cores.
	defs.sort((a, b) => {
		const aHeavy = a.lane === 'svelte-check' ? 0 : 1;
		const bHeavy = b.lane === 'svelte-check' ? 0 : 1;
		return aHeavy - bHeavy;
	});

	const timings = loadTimings();
	const expectedFor = (name: string): number | undefined => medianMs(timings.steps[name] ?? []);

	const reporter = pickReporter(args);
	for (const d of defs) reporter.register(d.name, expectedFor(d.name));

	const svelteCheckSem = createSemaphore(2);
	const tasks = defs.map((d) =>
		runStep(d.name, d.fn, reporter, d.lane === 'svelte-check' ? svelteCheckSem : undefined),
	);

	let results: StepResult[];
	if (args.verbose) {
		const wrapped = tasks.map((p) =>
			p.then((r) => {
				if (r.exitCode !== 0) {
					if (r.stdout) process.stdout.write(r.stdout);
					if (r.stderr) process.stderr.write(r.stderr);
				}
				return r;
			}),
		);
		results = await Promise.all(wrapped);
	} else {
		results = await Promise.all(tasks);
	}
	reporter.close();

	for (const r of results) {
		if (r.exitCode === 0) {
			const arr = timings.steps[r.name] ?? [];
			arr.push(r.elapsedMs);
			timings.steps[r.name] = arr.slice(-TIMINGS_KEEP);
		}
	}
	saveTimings(timings);

	return summarize(results);
}

function formatElapsed(ms: number): string {
	return `${(ms / 1000).toFixed(1)}s`;
}

function summarize(results: readonly StepResult[]): number {
	console.log('\nCheck summary:');
	const longest = results.reduce((acc, r) => Math.max(acc, r.name.length), 0);
	for (const r of results) {
		const sym = r.exitCode === 0 ? 'OK' : 'FAIL';
		console.log(`  [${sym}] ${r.name.padEnd(longest, ' ')}  (${formatElapsed(r.elapsedMs)})`);
	}
	const failures = results.filter((r) => r.exitCode !== 0);
	if (failures.length === 0) {
		console.log('\nAll checks passed.');
		return 0;
	}
	console.error(`\n${failures.length} step(s) failed.`);
	for (const f of failures) {
		console.error(`\n=== ${f.name} (exit ${f.exitCode}) ===`);
		if (f.stdout) process.stdout.write(f.stdout);
		if (f.stderr) process.stderr.write(f.stderr);
	}
	console.error(`\nPer-step output cached under ${CACHE_DIR.replace(REPO_ROOT, '.')}/.`);
	return 1;
}

const exitCode = await main();
process.exit(exitCode);
