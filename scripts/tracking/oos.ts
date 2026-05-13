#!/usr/bin/env bun
/**
 * Out-of-scope extraction tooling. See docs/agents/wp-out-of-scope-extraction.md.
 *
 * Two sub-commands are dispatched here:
 *
 *   bun scripts/tracking/oos.ts audit
 *     Read-only report. Lists WPs with "Out of scope" / "Deferred" sections in
 *     spec.md or tasks.md but no OUT-OF-SCOPE.md. Exits 0 either way; this is a
 *     surface, not a gate.
 *
 *   bun scripts/tracking/oos.ts pick [--n=3]
 *     Emits a self-contained prompt the user can paste into a fresh `claude`
 *     session. Picks the N most-recently-shipped WPs needing extraction
 *     (sorted by the most recent commit timestamp on any file in the WP
 *     directory). Defaults to 3.
 *
 * Lives next to generate.ts because both consume the WP loader and write
 * markdown-shaped output. Not browser-bundled.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { bold, dim, green, red, yellow } from '../lib/colors';
import { loadAllWorkPackages } from '../lib/wp-loader';

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/** A heading line in a markdown file that signals an out-of-scope / deferred
 * section. Matches `## Out of scope`, `## Out (explicitly...)`, `## Deferred`,
 * `### Out of scope`, etc. Case-insensitive on the keyword. */
const OOS_HEADING_RE = /^#{2,6}\s+(?:out\s*(?:of\s*scope|\s*\(explicit)|deferred)\b/im;

/** Returns true if the file at `path` contains an OOS-shaped heading. Missing
 * files return false (treated as "no OOS section"). */
function fileHasOosSection(path: string): boolean {
	if (!existsSync(path)) return false;
	let source: string;
	try {
		source = readFileSync(path, 'utf8');
	} catch {
		return false;
	}
	return OOS_HEADING_RE.test(source);
}

interface WpExtractionState {
	id: string;
	dir: string;
	hasOosFile: boolean;
	hasOosInSpec: boolean;
	hasOosInTasks: boolean;
	mostRecentCommitTs: number;
	isShipped: boolean;
	isUmbrella: boolean;
}

/** Umbrella WPs (`type: umbrella` in frontmatter) are program-level
 * coordination docs. Per-item OOS extraction targets the sub-packages, not
 * the umbrella, so the umbrella is skipped from "needs extraction" counts.
 * See docs/agents/wp-out-of-scope-extraction.md "Umbrella WPs". */
function isUmbrellaWp(rawFrontmatter: Record<string, unknown> | null): boolean {
	if (rawFrontmatter === null) return false;
	return rawFrontmatter.type === 'umbrella';
}

function gatherStates(): WpExtractionState[] {
	const wps = loadAllWorkPackages();
	const states: WpExtractionState[] = [];
	for (const wp of wps) {
		const dir = dirname(wp.specPath);
		const oosPath = join(dir, 'OUT-OF-SCOPE.md');
		const specPath = join(dir, 'spec.md');
		const tasksPath = join(dir, 'tasks.md');
		const fm = wp.frontmatter;
		const isShipped = fm !== null && fm.status === 'shipped';
		states.push({
			id: wp.id,
			dir,
			hasOosFile: existsSync(oosPath),
			hasOosInSpec: fileHasOosSection(specPath),
			hasOosInTasks: fileHasOosSection(tasksPath),
			mostRecentCommitTs: mostRecentCommitTimestamp(dir),
			isShipped,
			isUmbrella: isUmbrellaWp(wp.rawFrontmatter),
		});
	}
	return states;
}

/** Return the unix-second timestamp of the most recent commit that touched any
 * file under `dir`. Returns 0 if git isn't available or the dir has no
 * history (new dir). */
function mostRecentCommitTimestamp(dir: string): number {
	const result = spawnSync('git', ['log', '-1', '--format=%ct', '--', dir], {
		encoding: 'utf8',
	});
	if (result.status !== 0) return 0;
	const trimmed = result.stdout.trim();
	if (trimmed === '') return 0;
	const n = Number.parseInt(trimmed, 10);
	return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------
// audit
// ---------------------------------------------------------------------------

function commandAudit(): number {
	const states = gatherStates();
	// Umbrella WPs are coordination docs; per-item OOS extraction targets the
	// sub-packages, not the umbrella. Skip them from the "needs extraction"
	// tally so the audit measures the work that actually needs to happen.
	const needsExtraction = states.filter((s) => !s.hasOosFile && (s.hasOosInSpec || s.hasOosInTasks) && !s.isUmbrella);
	const haveFile = states.filter((s) => s.hasOosFile);
	const noOosNoFile = states.filter((s) => !s.hasOosFile && !s.hasOosInSpec && !s.hasOosInTasks && !s.isUmbrella);
	const umbrellas = states.filter((s) => s.isUmbrella);

	console.log(bold('Out-of-scope extraction audit'));
	console.log('');
	console.log(`  ${green(String(haveFile.length).padStart(4))}  WPs with OUT-OF-SCOPE.md (extraction satisfied)`);
	console.log(
		`  ${yellow(String(needsExtraction.length).padStart(4))}  WPs with deferred items but no OUT-OF-SCOPE.md ${dim('(needs extraction)')}`,
	);
	console.log(
		`  ${dim(String(noOosNoFile.length).padStart(4))}  WPs with no OOS section in spec/tasks ${dim('(consider creating an empty OUT-OF-SCOPE.md)')}`,
	);
	console.log(
		`  ${dim(String(umbrellas.length).padStart(4))}  umbrella WPs ${dim('(skipped; per-item OOS lives on sub-packages)')}`,
	);
	console.log('');

	if (needsExtraction.length === 0) {
		console.log(green('All WPs with deferred items have been extracted.'));
		console.log('');
		console.log(dim(`Tip: ${bold('bun run track oos-pick')} also creates an empty OUT-OF-SCOPE.md`));
		console.log(dim('     for WPs with no deferred items, signaling extraction was checked.'));
		return 0;
	}

	console.log(bold(`WPs needing extraction (${needsExtraction.length}):`));
	console.log('');

	// Sort by most-recent commit, newest first, so the user sees recent shipped
	// work at the top (most likely to be fresh in their head).
	const sorted = [...needsExtraction].sort((a, b) => b.mostRecentCommitTs - a.mostRecentCommitTs);
	for (const s of sorted) {
		const sources: string[] = [];
		if (s.hasOosInSpec) sources.push('spec.md');
		if (s.hasOosInTasks) sources.push('tasks.md');
		const shippedTag = s.isShipped ? green(' [shipped]') : '';
		const dateTag = s.mostRecentCommitTs > 0 ? dim(` (${formatDate(s.mostRecentCommitTs)})`) : '';
		console.log(`  ${yellow('•')} ${bold(s.id)}${shippedTag}${dateTag}`);
		console.log(`    ${dim(`sources: ${sources.join(', ')}`)}`);
	}

	console.log('');
	console.log(`Grind down the queue: ${bold('bun run track oos-pick')}`);
	console.log(`Discipline doc: ${dim('docs/agents/wp-out-of-scope-extraction.md')}`);
	console.log(`Template:       ${dim('docs/agents/wp-out-of-scope-template.md')}`);
	return 0;
}

function formatDate(unixSeconds: number): string {
	const d = new Date(unixSeconds * 1000);
	return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// pick
// ---------------------------------------------------------------------------

interface PickFlags {
	n: number;
}

function parsePickFlags(argv: readonly string[]): PickFlags {
	const flags: PickFlags = { n: 3 };
	for (const arg of argv) {
		if (arg.startsWith('--n=')) {
			const v = Number.parseInt(arg.slice('--n='.length), 10);
			if (!Number.isFinite(v) || v < 1) {
				console.error(red(`oos pick: --n must be a positive integer (got "${arg.slice('--n='.length)}")`));
				process.exit(1);
			}
			flags.n = v;
			continue;
		}
		if (arg === '--help' || arg === '-h') {
			console.log('Usage: bun run track oos-pick [--n=3]');
			console.log('');
			console.log('Emits a self-contained prompt for the N most-recently-shipped WPs needing');
			console.log('extraction. Default N=3. Paste the prompt into a fresh `claude` session.');
			process.exit(0);
		}
		console.error(red(`oos pick: unknown arg "${arg}"`));
		process.exit(1);
	}
	return flags;
}

function commandPick(argv: readonly string[]): number {
	const flags = parsePickFlags(argv);
	const states = gatherStates();
	// Skip umbrella WPs -- per-item OOS extraction targets the sub-packages.
	const candidates = states.filter((s) => !s.hasOosFile && (s.hasOosInSpec || s.hasOosInTasks) && !s.isUmbrella);

	if (candidates.length === 0) {
		console.log(green('No WPs need extraction. The discipline is satisfied.'));
		console.log('');
		console.log(dim('Run `bun run track oos-audit` to confirm counts.'));
		return 0;
	}

	// Prefer shipped WPs (the spec is settled; deferral context is concrete).
	// Within shipped, sort by most-recent commit timestamp descending. Fall back
	// to non-shipped if the shipped queue is empty.
	const shipped = candidates.filter((s) => s.isShipped).sort((a, b) => b.mostRecentCommitTs - a.mostRecentCommitTs);
	const unshipped = candidates.filter((s) => !s.isShipped).sort((a, b) => b.mostRecentCommitTs - a.mostRecentCommitTs);
	const ordered = [...shipped, ...unshipped];
	const picked = ordered.slice(0, flags.n);

	const promptLines: string[] = [];
	const noun = picked.length === 1 ? '1 work package' : `${picked.length} work packages`;
	promptLines.push(
		`You have been asked to extract out-of-scope content for ${noun}`,
		'into per-WP OUT-OF-SCOPE.md files. The discipline is documented at',
		'docs/agents/wp-out-of-scope-extraction.md (read this FIRST). The',
		'template is at docs/agents/wp-out-of-scope-template.md.',
		'',
		`The ${picked.length === 1 ? 'WP' : `${picked.length} WPs`} to process:`,
		'',
	);
	picked.forEach((s, i) => {
		promptLines.push(`${i + 1}. docs/work-packages/${s.id}/`);
	});
	promptLines.push(
		'',
		'For each WP:',
		'',
		'1. Read spec.md and tasks.md fully (you will need the rationale to fill',
		'   in the "Why" sections)',
		'2. Extract the "Out of scope" / "Deferred" items into a new',
		'   OUT-OF-SCOPE.md per the template',
		'3. Replace the in-place "Out of scope" sections in spec.md / tasks.md',
		'   with a one-line pointer to OUT-OF-SCOPE.md',
		'4. For each item: classify as Deferred / Rejected / Follow-on WP. Fill',
		'   in the trigger and implementation pattern from your reading of the',
		'   spec, design.md, ADR references, and prior conversation context',
		'   visible in commit messages on the WP directory',
		'5. Open one PR per WP. Title format: `docs(wp): extract out-of-scope -- <slug>`',
		'',
		'If a WP has no deferred items, still create OUT-OF-SCOPE.md stating',
		'"This WP has no deferred items." This signals the extraction was',
		'checked.',
		'',
		'Run `bun run check branch` and `bun run track format <files>`',
		'before each commit. Stage individually. No AI attribution.',
	);

	const prompt = promptLines.join('\n');
	console.log(prompt);
	return 0;
}

// ---------------------------------------------------------------------------
// dispatch
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const [head, ...rest] = argv;
let exitCode = 0;
switch (head) {
	case 'audit':
		exitCode = commandAudit();
		break;
	case 'pick':
		exitCode = commandPick(rest);
		break;
	case undefined:
	case 'help':
	case '--help':
	case '-h':
		console.log('Usage:');
		console.log('  bun scripts/tracking/oos.ts audit          # report WPs needing extraction');
		console.log('  bun scripts/tracking/oos.ts pick [--n=3]   # emit a paste-into-claude prompt');
		console.log('');
		console.log('See docs/agents/wp-out-of-scope-extraction.md for the discipline.');
		break;
	default:
		console.error(red(`oos: unknown sub-command "${head}"`));
		exitCode = 1;
}
process.exit(exitCode);
