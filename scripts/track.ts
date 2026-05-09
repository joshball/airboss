#!/usr/bin/env bun

/**
 * Top-level tracking dispatcher. ADR 025.
 *
 * Single entry point for the airboss tracking system. Composes the existing
 * verbs (`wp`, `bug`, `tracking:generate`, `archive:*`, `format:md`,
 * `log:pr`) into a workflow-shaped CLI:
 *
 *   bun run track                  # alias for `track help`
 *   bun run track help             # commands index + when-to-use
 *   bun run track status           # full dashboard
 *   bun run track next             # what to work on, with reasoning
 *   bun run track ship <wp-id>     # walk -> sign-off -> ship -> regen -> format -> log
 *   bun run track generate         # emit BOARD/ROADMAPs/SHIPPED
 *   bun run track format           # markdown formatter (dirty by default)
 *   bun run track archive          # rolling archive (dry-run by default)
 *   bun run track log <pr>         # emit one log entry
 *
 * Power-user CLIs (`bun run wp`, `bun run bug`) keep their direct entry
 * points; this dispatcher does NOT shadow them.
 *
 * See docs/platform/TRACKING.md for the long-form explainer.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { loadAllBugs } from './lib/bug-loader';
import { bold, dim, green, red, yellow } from './lib/colors';
import { loadAllLogEntries } from './lib/log-loader';
import { confirmOrAbort, prompt } from './lib/prompt';
import { isShipped, loadAllWorkPackages } from './lib/wp-loader';

let cachedRepoRoot: string | null = null;

function repoRoot(): string {
	if (cachedRepoRoot !== null) return cachedRepoRoot;
	let dir = import.meta.dirname;
	for (let i = 0; i < 16; i += 1) {
		const candidate = join(dir, 'package.json');
		try {
			const json = JSON.parse(readFileSync(candidate, 'utf8')) as { name?: string };
			if (json.name === 'airboss') {
				cachedRepoRoot = dir;
				return dir;
			}
		} catch {
			// continue walking up
		}
		const parent = resolve(dir, '..');
		if (parent === dir) break;
		dir = parent;
	}
	throw new Error('track: unable to locate repo root');
}

function runBun(scriptArgs: readonly string[], opts: { quiet?: boolean } = {}): number {
	const result = spawnSync('bun', scriptArgs, {
		cwd: repoRoot(),
		stdio: opts.quiet === true ? 'pipe' : 'inherit',
	});
	return result.status ?? 1;
}

function runBunCapture(scriptArgs: readonly string[]): { stdout: string; stderr: string; exit: number } {
	const result = spawnSync('bun', scriptArgs, {
		cwd: repoRoot(),
		encoding: 'utf8',
	});
	return {
		stdout: result.stdout,
		stderr: result.stderr,
		exit: result.status ?? 1,
	};
}

// ---- help ----------------------------------------------------------------

function commandHelp(): number {
	const help = [
		bold('airboss tracking system'),
		'',
		'Frontmatter-driven system for managing work, bugs, and shipped PRs. Files',
		'on disk are the source of truth. Aggregator views (BOARD/ROADMAP/SHIPPED)',
		'are derived. The hangar /roadmap UI reads the same data the CLI does.',
		'',
		bold('Three nouns'),
		'',
		`  ${bold('Work packages')}  docs/work-packages/<id>/         Features, projects.`,
		`                                                  Has spec.md + optional`,
		`                                                  tasks.md, test-plan.md,`,
		`                                                  design.md, user-stories.md.`,
		`  ${bold('Bugs')}           docs/bugs/<id>.md                Known broken things.`,
		`                                                  Promote to a WP only when the`,
		`                                                  fix needs design.`,
		`  ${bold('Log entries')}    docs/log/YYYY-MM-DD-PR-NNN-*.md  One per merged PR.`,
		`                                                  Drives SHIPPED.md.`,
		'',
		bold('Top-level commands'),
		'',
		`  ${bold('bun run track')}            ${dim('Workflow-shaped umbrella. Run with no args for help.')}`,
		`  ${bold('bun run wp')}               ${dim('Work-package CLI: list / show / set / next / blocked.')}`,
		`  ${bold('bun run bug')}              ${dim('Bug CLI: list / show / new / set / index.')}`,
		'',
		bold('track subcommands'),
		'',
		`  ${green('status')}              Full dashboard: WP counts by state, open bugs (with`,
		`                      blocking flag), recent PRs, and hints based on what`,
		`                      it sees. The "where am I?" command.`,
		'',
		`  ${green('next')}                Lists WPs that are signed-off + dependencies-shipped +`,
		`                      awaiting your walkthrough. The "what should I do?"`,
		`                      command. Prints reasoning per candidate.`,
		'',
		`  ${green('ship [wp-id] [-y]')}   Walk a WP through the closure flow:`,
		`                        1. Confirms you walked the test plan (prompt)`,
		`                        2. Sets human_review_status: signed-off`,
		`                        3. Sets status: shipped (auto-fills shipped_date)`,
		`                        4. Regenerates BOARD/ROADMAPs/SHIPPED`,
		`                        5. Formats changed markdown`,
		`                      With no <wp-id>, picks interactively from the next`,
		`                      list. ${bold('--yes')} skips the confirmation prompt.`,
		'',
		`  ${green('generate')}            Re-emit derived views (docs/work/BOARD.md,`,
		`                      docs/work/SHIPPED.md, docs/products/{app}/ROADMAP.md).`,
		`                      Run after any frontmatter mutation; lint will fail`,
		`                      bun run check if these are out of date.`,
		'',
		`  ${green('format')} [paths]      Markdown formatter (table alignment, blank lines`,
		`                      around headings/lists/fences, fence language tags).`,
		`                      No args = format all dirty .md files.`,
		`                      Pass paths to format specific files. ${bold('--check')} for CI.`,
		'',
		`  ${green('archive')} [--apply]   Rolling archive of session-scoped docs older than`,
		`                      60 days. Default is dry-run. ${bold('--apply')} executes the`,
		`                      git mv into docs/.archive/<dir>/<year>/. ${bold('--days N')}`,
		`                      overrides the threshold.`,
		'',
		`  ${green('log <pr-number>')}     Emit one log entry from \`gh pr view <pr>\` into`,
		`                      docs/log/. Run after every merge to keep SHIPPED.md`,
		`                      fresh.`,
		'',
		`  ${green('help')}                This index.`,
		'',
		bold('wp subcommands (power-user CLI)'),
		'',
		`  ${green('list')} [filters]      All WPs in a table. Filters compose with AND:`,
		`                        --product study | hangar | sim | flightbag |`,
		`                                  avionics | platform | course | none`,
		`                        --category product | feature | content | docs |`,
		`                                   platform`,
		`                        --status draft | signed-off | in-flight |`,
		`                                 shipped | abandoned | superseded`,
		`                        --human-review pending | walked | signed-off`,
		`                        --agent-review pending | done`,
		`                        --tag <name>`,
		`                      Output: default human table, ${bold('--json')}, ${bold('--md')}.`,
		'',
		`  ${green('show <wp-id>')}        Render the WP. ${bold('--section spec | tasks | test-plan')}`,
		`                      to render only one sub-doc.`,
		'',
		`  ${green('next')}                Same heuristic as ${bold('track next')} but as a plain table.`,
		`  ${green('blocked')}             WPs whose depends_on includes a non-shipped WP.`,
		'',
		`  ${green('set <id> <field>')}    Mutate a whitelisted frontmatter field. Whitelist:`,
		`      <value>           status, agent_review_status, human_review_status,`,
		`                        category, product, owner, shipped_date,`,
		`                        shipped_prs, depends_on, unblocks, tags`,
		`                      Aliases: human-review, agent-review, shipped-date,`,
		`                               shipped-prs, depends-on`,
		`                      ${red('LINT BLOCKS agent commits that touch human_review_status.')}`,
		`                      ${red('LINT BLOCKS status: shipped without human-review: signed-off.')}`,
		'',
		bold('bug subcommands (power-user CLI)'),
		'',
		`  ${green('list')} [filters]      All bugs. Filters: --product, --severity, --status, --tag.`,
		`                      Output: default table, ${bold('--json')}, ${bold('--md')}.`,
		`  ${green('show <bug-id>')}       Render one bug.`,
		`  ${green('new <slug>')}          Scaffold docs/bugs/<slug>.md with placeholder frontmatter.`,
		`                      Flags: --title, --product, --severity.`,
		`  ${green('set <id> <field>')}    Mutate. Whitelist: status, severity, fix_pr, fix_wp, tags.`,
		`      <value>`,
		`  ${green('index')}               Regenerate docs/bugs/INDEX.md.`,
		'',
		bold('Common workflows'),
		'',
		`  ${dim('# Daily orientation')}`,
		`  bun run track status                ${dim('# where am I?')}`,
		`  bun run track next                  ${dim('# what should I work on?')}`,
		'',
		`  ${dim('# Browse work by theme (cross-cuts products)')}`,
		`  bun run wp list --category content --status '!shipped'`,
		`  bun run wp list --tag references`,
		'',
		`  ${dim('# Walk a test plan and ship it (the closure flow)')}`,
		`  bun run track ship                  ${dim('# interactive: pick from list')}`,
		`  bun run track ship some-wp-id       ${dim('# explicit, with prompt')}`,
		`  bun run track ship some-wp-id -y    ${dim('# skip confirmation')}`,
		'',
		`  ${dim('# After merging a PR')}`,
		`  bun run track log 712               ${dim('# emit docs/log/2026-...-PR-712-...md')}`,
		'',
		`  ${dim('# Surface a bug for later')}`,
		`  bun run bug new bug-flightbag-toc-collapse`,
		`  bun run bug list --status open --severity blocking`,
		'',
		`  ${dim('# Mutating frontmatter directly')}`,
		`  bun run wp set some-id status in-flight`,
		`  bun run wp set some-id tags '["refs", "ingestion"]'`,
		`  bun run wp set some-id human-review walked              ${red('# YOU ONLY')}`,
		'',
		`  ${dim('# Periodic housekeeping (monthly-ish)')}`,
		`  bun run track archive               ${dim('# preview what would archive')}`,
		`  bun run track archive --apply       ${dim('# execute')}`,
		`  bun run track generate              ${dim('# rebuild BOARD/ROADMAP/SHIPPED')}`,
		'',
		bold('Where the contracts live'),
		'',
		`  ${dim('Schema:')}     libs/types/src/{work-package,bug}.ts`,
		`  ${dim('Vocab:')}      libs/constants/src/{work-package,bug}.ts`,
		`  ${dim('Lint:')}       scripts/lint/wp-frontmatter.ts (in bun run check)`,
		`  ${dim('Loader:')}     scripts/lib/{wp,bug,log}-loader.ts`,
		`  ${dim('Generator:')}  scripts/tracking/generate.ts`,
		`  ${dim('In-app:')}     /roadmap (hangar) reads the same loaders`,
		'',
		bold('Long-form explainer + design rationale'),
		'',
		'  docs/platform/TRACKING.md       Full system overview, every command, every',
		'                                  workflow, design rationale, FAQs.',
		'  docs/decisions/025-wp-frontmatter-contract/decision.md',
		'                                  ADR 025: the frontmatter contract that',
		'                                  underpins everything.',
		'',
	];
	console.log(help.join('\n'));
	return 0;
}

// ---- status --------------------------------------------------------------

interface StatusCounts {
	draft: number;
	signedOff: number;
	inFlight: number;
	shipped: number;
	abandoned: number;
	superseded: number;
	invalid: number;
	humanReviewPending: number;
	openBugs: number;
	openBlockingBugs: number;
}

function gatherStatusCounts(): StatusCounts {
	const wps = loadAllWorkPackages();
	const bugs = loadAllBugs();
	const counts: StatusCounts = {
		draft: 0,
		signedOff: 0,
		inFlight: 0,
		shipped: 0,
		abandoned: 0,
		superseded: 0,
		invalid: 0,
		humanReviewPending: 0,
		openBugs: 0,
		openBlockingBugs: 0,
	};
	for (const wp of wps) {
		const fm = wp.frontmatter;
		if (fm === null) {
			counts.invalid += 1;
			continue;
		}
		switch (fm.status) {
			case 'draft':
				counts.draft += 1;
				break;
			case 'signed-off':
				counts.signedOff += 1;
				break;
			case 'in-flight':
				counts.inFlight += 1;
				break;
			case 'shipped':
				counts.shipped += 1;
				break;
			case 'abandoned':
				counts.abandoned += 1;
				break;
			case 'superseded':
				counts.superseded += 1;
				break;
		}
		if (fm.human_review_status === 'pending' && fm.status !== 'draft' && fm.status !== 'abandoned') {
			counts.humanReviewPending += 1;
		}
	}
	for (const bug of bugs) {
		const fm = bug.frontmatter;
		if (fm === null) continue;
		if (fm.status === 'open') {
			counts.openBugs += 1;
			if (fm.severity === 'blocking') counts.openBlockingBugs += 1;
		}
	}
	return counts;
}

function commandStatus(): number {
	const counts = gatherStatusCounts();
	const root = repoRoot();
	const logEntries = loadAllLogEntries(root);
	// Loader already returns reverse-chrono.
	const recent = logEntries.slice(0, 5);

	console.log(bold('Work packages'));
	console.log('');
	const fmt = (label: string, n: number, color: (s: string) => string) => {
		const num = color(String(n).padStart(4));
		console.log(`  ${num}  ${label}`);
	};
	fmt('draft', counts.draft, dim);
	fmt('signed-off', counts.signedOff, yellow);
	fmt('in-flight', counts.inFlight, green);
	fmt('shipped', counts.shipped, dim);
	if (counts.abandoned > 0) fmt('abandoned', counts.abandoned, dim);
	if (counts.superseded > 0) fmt('superseded', counts.superseded, dim);
	if (counts.invalid > 0) fmt('invalid frontmatter', counts.invalid, red);
	console.log('');
	fmt('awaiting your walkthrough', counts.humanReviewPending, yellow);

	console.log('');
	console.log(bold('Bugs'));
	console.log('');
	fmt('open', counts.openBugs, counts.openBugs > 0 ? yellow : dim);
	if (counts.openBlockingBugs > 0) fmt('open + blocking', counts.openBlockingBugs, red);

	console.log('');
	console.log(bold('Recent PRs (last 5)'));
	console.log('');
	if (recent.length === 0) {
		console.log(`  ${dim('(no log entries yet -- bun run track log <pr-number>)')}`);
	} else {
		for (const entry of recent) {
			console.log(`  ${dim(entry.date)}  ${dim(`#${entry.pr}`)}  ${entry.title}`);
		}
	}

	console.log('');
	console.log(bold('Hints'));
	console.log('');
	if (counts.humanReviewPending > 0) {
		console.log(`  ${yellow('->')} Walk a test plan: ${bold('bun run track next')}`);
	}
	if (counts.openBlockingBugs > 0) {
		console.log(`  ${red('->')} Blocking bugs open: ${bold('bun run bug list --severity blocking --status open')}`);
	}
	if (counts.invalid > 0) {
		console.log(`  ${red('->')} Fix invalid frontmatter: ${bold('bun run check')}`);
	}
	console.log('');
	return 0;
}

// ---- next ----------------------------------------------------------------

function commandNext(): number {
	// Composite of `bun run wp next` plus reasoning about why each candidate
	// is unblocked. Today the underlying CLI prints a table; we add prose.
	const wps = loadAllWorkPackages();
	const shippedIds = new Set(wps.filter(isShipped).map((p) => p.id));
	const candidates = wps.filter((wp) => {
		const fm = wp.frontmatter;
		if (fm === null) return false;
		if (fm.status !== 'signed-off') return false;
		if (fm.human_review_status !== 'pending') return false;
		for (const dep of fm.depends_on) {
			if (!shippedIds.has(dep)) return false;
		}
		return true;
	});

	if (candidates.length === 0) {
		console.log(dim('No work packages are signed-off + unblocked + awaiting your walkthrough.'));
		console.log('');
		console.log('Try one of:');
		console.log(`  ${bold('bun run wp list --status draft')}        ${dim('# WPs that need spec signoff')}`);
		console.log(`  ${bold('bun run wp blocked')}                    ${dim('# WPs waiting on deps')}`);
		console.log(`  ${bold('bun run wp list --status in-flight')}    ${dim('# WPs you started walking')}`);
		return 0;
	}

	console.log(bold(`${candidates.length} work package${candidates.length === 1 ? '' : 's'} ready to walk:`));
	console.log('');
	for (const wp of candidates) {
		const fm = wp.frontmatter;
		if (fm === null) continue;
		console.log(`  ${green('•')} ${bold(wp.id)}`);
		console.log(`    ${fm.title}`);
		console.log(`    ${dim(`product=${fm.product}  category=${fm.category}`)}`);
		const why: string[] = [];
		if (fm.depends_on.length === 0) {
			why.push('no dependencies');
		} else {
			why.push(`${fm.depends_on.length} dep${fm.depends_on.length === 1 ? '' : 's'} shipped`);
		}
		console.log(`    ${dim(`(${why.join(', ')})`)}`);
		console.log('');
	}
	console.log(`Walk it: ${bold(`bun run track ship <wp-id>`)}`);
	console.log(`Or read the test plan first: ${bold(`bun run wp show <wp-id> --section test-plan`)}`);
	return 0;
}

// ---- ship ----------------------------------------------------------------

interface ShipFlags {
	yes: boolean;
}

function parseShipFlags(argv: readonly string[]): { id: string | null; flags: ShipFlags } {
	let id: string | null = null;
	const flags: ShipFlags = { yes: false };
	for (const arg of argv) {
		if (arg === '--yes' || arg === '-y') {
			flags.yes = true;
			continue;
		}
		if (arg.startsWith('--')) {
			console.error(`track ship: unknown flag "${arg}"`);
			process.exit(1);
		}
		if (id !== null) {
			console.error(`track ship: only one wp-id allowed`);
			process.exit(1);
		}
		id = arg;
	}
	return { id, flags };
}

/** Interactive picker: when `bun run track ship` is invoked with no id, list
 * the unblocked + signed-off + human-review-pending candidates and let the
 * user pick one by number. Returns the chosen id, or null if the user aborts. */
async function pickShipCandidate(): Promise<string | null> {
	const wps = loadAllWorkPackages();
	const shippedIds = new Set(wps.filter(isShipped).map((p) => p.id));
	const candidates = wps.filter((wp) => {
		const fm = wp.frontmatter;
		if (fm === null) return false;
		if (fm.status !== 'signed-off') return false;
		if (fm.human_review_status !== 'pending') return false;
		for (const dep of fm.depends_on) {
			if (!shippedIds.has(dep)) return false;
		}
		return true;
	});

	if (candidates.length === 0) {
		console.log(dim('No work packages are ready to ship (signed-off + unblocked + awaiting walkthrough).'));
		console.log('');
		console.log(`Try ${bold('bun run track next')} for ideas, or pass an id explicitly.`);
		return null;
	}

	console.log(bold(`Ready to ship (${candidates.length}):`));
	console.log('');
	candidates.forEach((wp, i) => {
		const fm = wp.frontmatter;
		if (fm === null) return;
		console.log(`  ${green(`${i + 1}.`)} ${bold(wp.id)}`);
		console.log(`     ${fm.title}`);
		console.log(`     ${dim(`product=${fm.product}  category=${fm.category}`)}`);
	});
	console.log('');
	const answer = (await prompt(`Pick one (1-${candidates.length}, or q to quit): `)).trim();
	if (answer === '' || answer.toLowerCase() === 'q') {
		console.log('Aborted.');
		return null;
	}
	const idx = Number.parseInt(answer, 10);
	if (!Number.isFinite(idx) || idx < 1 || idx > candidates.length) {
		console.error(red(`Invalid choice "${answer}".`));
		return null;
	}
	const chosen = candidates[idx - 1];
	if (chosen === undefined) return null;
	return chosen.id;
}

async function commandShip(argv: readonly string[]): Promise<number> {
	const { id: argId, flags } = parseShipFlags(argv);
	let id = argId;
	if (id === null) {
		const picked = await pickShipCandidate();
		if (picked === null) return 0;
		id = picked;
		console.log('');
	}
	const wps = loadAllWorkPackages();
	const wp = wps.find((p) => p.id === id);
	if (wp === undefined) {
		console.error(`track ship: no work package found with id "${id}"`);
		return 1;
	}
	const fm = wp.frontmatter;
	if (fm === null) {
		console.error(`track ship: ${id} has invalid frontmatter`);
		for (const err of wp.validation_errors) console.error(`  [${err.field}] ${err.message}`);
		return 1;
	}
	if (fm.status === 'shipped') {
		console.log(yellow(`${id} is already shipped (${fm.shipped_date}).`));
		return 0;
	}

	console.log(bold(`Shipping ${id}`));
	console.log(`  title:    ${fm.title}`);
	console.log(`  product:  ${fm.product}`);
	console.log(`  category: ${fm.category}`);
	console.log(`  status:   ${fm.status}  ->  shipped`);
	console.log(`  human:    ${fm.human_review_status}  ->  signed-off`);
	console.log('');
	const testPlanPath = join(dirname(wp.specPath), 'test-plan.md');
	if (existsSync(testPlanPath)) {
		console.log(dim(`Test plan: ${testPlanPath}`));
		console.log(dim('Read it: bun run wp show <wp-id> --section test-plan'));
	} else {
		console.log(yellow('No test-plan.md exists for this WP.'));
	}
	console.log('');

	if (!flags.yes) {
		await confirmOrAbort('Walked the test plan and everything passed?');
	}

	// Step 1: human-review = signed-off
	console.log(dim('Setting human_review_status = signed-off...'));
	const a = runBunCapture(['scripts/wp.ts', 'set', id, 'human-review', 'signed-off']);
	if (a.exit !== 0) {
		console.error(red(`failed to set human-review: ${a.stderr.trim()}`));
		return 1;
	}

	// Step 2: status = shipped (auto-sets shipped_date)
	console.log(dim('Setting status = shipped (auto-sets shipped_date)...'));
	const b = runBunCapture(['scripts/wp.ts', 'set', id, 'status', 'shipped']);
	if (b.exit !== 0) {
		console.error(red(`failed to set status: ${b.stderr.trim()}`));
		return 1;
	}
	process.stdout.write(b.stderr); // surface the auto-shipped_date notice

	// Step 3: regenerate views
	console.log(dim('Regenerating tracking views...'));
	const g = runBun(['scripts/tracking/generate.ts'], { quiet: true });
	if (g !== 0) {
		console.error(red('failed to regenerate views; run `bun run track generate` to retry'));
		return 1;
	}

	// Step 4: format any newly-changed markdown
	console.log(dim('Formatting changed markdown...'));
	const f = runBun(['tools/md-format/bin.ts'], { quiet: true });
	if (f !== 0) {
		console.error(yellow('md-format reported changes; review and re-run if needed'));
	}

	console.log('');
	console.log(green(`✓ ${id} shipped.`));
	console.log('');
	console.log('Stage and commit:');
	console.log('');
	const specRel = wp.specPath.startsWith(repoRoot()) ? wp.specPath.slice(repoRoot().length + 1) : wp.specPath;
	console.log(bold(`  git add ${specRel} docs/work/BOARD.md docs/work/SHIPPED.md docs/products/*/ROADMAP.md`));
	console.log(bold(`  git commit -m "ship ${id}"`));
	console.log('');
	console.log(`After merge: ${bold(`bun run track log <pr-number>`)} to record the PR.`);
	return 0;
}

// ---- thin pass-throughs --------------------------------------------------

function commandGenerate(argv: readonly string[]): number {
	return runBun(['scripts/tracking/generate.ts', ...argv]);
}

function commandFormat(argv: readonly string[]): number {
	return runBun(['tools/md-format/bin.ts', ...argv]);
}

function commandArchive(argv: readonly string[]): number {
	return runBun(['scripts/tracking/archive.ts', ...argv]);
}

function commandLog(argv: readonly string[]): number {
	return runBun(['scripts/log-pr.ts', ...argv]);
}

// ---- dispatch ------------------------------------------------------------

const argv = process.argv.slice(2);
const [head, ...rest] = argv;
let exitCode = 0;
switch (head) {
	case undefined:
	case 'help':
	case '--help':
	case '-h':
		exitCode = commandHelp();
		break;
	case 'status':
		exitCode = commandStatus();
		break;
	case 'next':
		exitCode = commandNext();
		break;
	case 'ship':
		exitCode = await commandShip(rest);
		break;
	case 'generate':
		exitCode = commandGenerate(rest);
		break;
	case 'format':
		exitCode = commandFormat(rest);
		break;
	case 'archive':
		exitCode = commandArchive(rest);
		break;
	case 'log':
		exitCode = commandLog(rest);
		break;
	default:
		console.error(`track: unknown command "${head}"`);
		commandHelp();
		exitCode = 1;
}
process.exit(exitCode);
