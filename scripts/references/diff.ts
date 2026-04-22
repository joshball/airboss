#!/usr/bin/env bun
/**
 * Reference diff.
 *
 * Runs an extraction without writing, compares the result to the committed
 * `*-generated.ts` files, and prints a human-readable diff of what would
 * change. The yearly-refresh workflow runs this after dropping the new
 * source file in; the output is the review artifact.
 *
 * `extractedAt` is excluded from comparison per spec -- regenerating with
 * no source changes should show no diffs.
 *
 * CLI:
 *   bun scripts/references/diff.ts              All source types.
 *   bun scripts/references/diff.ts cfr          Only cfr-generated.ts.
 */

import type { VerbatimBlock } from '@ab/aviation';
import { readExistingGenerated, runExtract } from './extract';
import { scanContent } from './scan';

interface DiffOptions {
	sourceTypeFilter?: string;
}

function parseArgs(argv: readonly string[]): DiffOptions {
	const opts: DiffOptions = {};
	if (argv.length === 0) return opts;
	const first = argv[0];
	if (first === '--help' || first === '-h') {
		console.log('Usage: bun scripts/references/diff.ts [<source-type>]');
		process.exit(0);
	}
	if (first?.startsWith('-')) {
		throw new Error(`Unknown argument: ${first}`);
	}
	opts.sourceTypeFilter = first;
	return opts;
}

interface VerbatimDiff {
	id: string;
	kind: 'added' | 'removed' | 'changed';
	oldText?: string;
	newText?: string;
	oldSourceVersion?: string;
	newSourceVersion?: string;
}

function diffBlocks(existing: Record<string, VerbatimBlock>, fresh: Record<string, VerbatimBlock>): VerbatimDiff[] {
	const out: VerbatimDiff[] = [];
	const allIds = new Set<string>([...Object.keys(existing), ...Object.keys(fresh)]);
	for (const id of Array.from(allIds).sort()) {
		const e = existing[id];
		const f = fresh[id];
		if (!e && f) {
			out.push({ id, kind: 'added', newText: f.text, newSourceVersion: f.sourceVersion });
			continue;
		}
		if (e && !f) {
			out.push({ id, kind: 'removed', oldText: e.text, oldSourceVersion: e.sourceVersion });
			continue;
		}
		if (!e || !f) continue;
		if (e.text !== f.text || e.sourceVersion !== f.sourceVersion) {
			out.push({
				id,
				kind: 'changed',
				oldText: e.text,
				newText: f.text,
				oldSourceVersion: e.sourceVersion,
				newSourceVersion: f.sourceVersion,
			});
		}
	}
	return out;
}

/** Unified diff with 3 lines of context. */
function unifiedDiff(oldText: string, newText: string): string {
	const oldLines = oldText.split('\n');
	const newLines = newText.split('\n');
	// Longest-common-subsequence driven diff. Keep it small: these texts are
	// short enough (~paragraphs) that an O(n*m) LCS is fine.
	const lcs = computeLcs(oldLines, newLines);
	const hunks = hunksFromLcs(oldLines, newLines, lcs, 3);
	return hunks.join('\n');
}

function computeLcs(a: readonly string[], b: readonly string[]): number[][] {
	const m = a.length;
	const n = b.length;
	const table: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
	for (let i = 0; i < m; i += 1) {
		for (let j = 0; j < n; j += 1) {
			const row = table[i + 1];
			const prevRow = table[i];
			if (!row || !prevRow) continue;
			if (a[i] === b[j]) {
				row[j + 1] = (prevRow[j] ?? 0) + 1;
			} else {
				row[j + 1] = Math.max(prevRow[j + 1] ?? 0, row[j] ?? 0);
			}
		}
	}
	return table;
}

function hunksFromLcs(
	a: readonly string[],
	b: readonly string[],
	table: readonly number[][],
	context: number,
): string[] {
	// Walk the table backwards to produce ops.
	type Op = { kind: 'equal' | 'add' | 'del'; aLine?: string; bLine?: string };
	const ops: Op[] = [];
	let i = a.length;
	let j = b.length;
	while (i > 0 && j > 0) {
		if (a[i - 1] === b[j - 1]) {
			ops.push({ kind: 'equal', aLine: a[i - 1], bLine: b[j - 1] });
			i -= 1;
			j -= 1;
		} else if ((table[i - 1]?.[j] ?? 0) >= (table[i]?.[j - 1] ?? 0)) {
			ops.push({ kind: 'del', aLine: a[i - 1] });
			i -= 1;
		} else {
			ops.push({ kind: 'add', bLine: b[j - 1] });
			j -= 1;
		}
	}
	while (i > 0) {
		ops.push({ kind: 'del', aLine: a[i - 1] });
		i -= 1;
	}
	while (j > 0) {
		ops.push({ kind: 'add', bLine: b[j - 1] });
		j -= 1;
	}
	ops.reverse();

	// Stitch into hunks with `context` lines of context.
	const lines: string[] = [];
	let pending: string[] = [];
	let equalRun = 0;
	let inHunk = false;

	for (const op of ops) {
		if (op.kind === 'equal') {
			if (!inHunk) {
				pending.push(` ${op.aLine ?? ''}`);
				if (pending.length > context) pending.shift();
			} else {
				equalRun += 1;
				lines.push(` ${op.aLine ?? ''}`);
				if (equalRun >= context * 2) {
					// Close the hunk; emit trailing context already collected.
					inHunk = false;
					pending = lines.slice(-context);
					equalRun = 0;
					lines.push('---');
				}
			}
		} else {
			if (!inHunk) {
				inHunk = true;
				lines.push(...pending);
				pending = [];
				equalRun = 0;
			}
			if (op.kind === 'del') {
				lines.push(`-${op.aLine ?? ''}`);
			} else {
				lines.push(`+${op.bLine ?? ''}`);
			}
		}
	}
	return lines;
}

if (import.meta.main) {
	const options = parseArgs(process.argv.slice(2));
	const { manifest } = scanContent();

	const result = await runExtract({
		manifest,
		dryRun: true,
		sourceTypeFilter: options.sourceTypeFilter,
	});

	if (result.errors.length > 0) {
		for (const e of result.errors) console.error(`error: ${e.id}: ${e.reason}`);
		console.error('diff: extraction errors above; diff is incomplete.');
	}

	const sourceTypes = Object.keys(result.perSourceType);
	if (options.sourceTypeFilter && !sourceTypes.includes(options.sourceTypeFilter)) {
		// Still diff against existing file in case this is a removal-only case.
		sourceTypes.push(options.sourceTypeFilter);
	}

	let totalChanged = 0;
	let totalAdded = 0;
	let totalRemoved = 0;

	for (const sourceType of sourceTypes) {
		const existing = readExistingGenerated(sourceType);
		const fresh = result.perSourceType[sourceType] ?? {};
		const diffs = diffBlocks(existing, fresh);
		if (diffs.length === 0) {
			console.log(`[${sourceType}] no changes`);
			continue;
		}
		console.log(`[${sourceType}] ${diffs.length} change(s):`);
		for (const d of diffs) {
			totalChanged += d.kind === 'changed' ? 1 : 0;
			totalAdded += d.kind === 'added' ? 1 : 0;
			totalRemoved += d.kind === 'removed' ? 1 : 0;
			if (d.kind === 'added') {
				console.log(`  + ${d.id} (new, sourceVersion=${d.newSourceVersion})`);
			} else if (d.kind === 'removed') {
				console.log(`  - ${d.id} (removed, was sourceVersion=${d.oldSourceVersion})`);
			} else {
				console.log(`  ~ ${d.id}`);
				if (d.oldSourceVersion !== d.newSourceVersion) {
					console.log(`    sourceVersion: ${d.oldSourceVersion} -> ${d.newSourceVersion}`);
				}
				const unified = unifiedDiff(d.oldText ?? '', d.newText ?? '');
				for (const line of unified.split('\n')) {
					console.log(`    ${line}`);
				}
			}
		}
	}

	console.log(
		`diff: ${totalChanged} changed, ${totalAdded} added, ${totalRemoved} removed across ${sourceTypes.length} source type(s).`,
	);
}
