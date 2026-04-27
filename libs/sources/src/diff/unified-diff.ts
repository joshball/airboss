/**
 * Phase 5 -- minimal unified-diff helper for `needs-review` snippets.
 *
 * Produces a small, readable hunk-style diff between two strings. Not a
 * general-purpose patch tool: the snippet is for human eyes inside the JSON
 * report, capped at a small number of context + change lines.
 *
 * Algorithm: line-based LCS, then walk the LCS to emit `=` / `-` / `+` lines,
 * then collapse to the first hunk that contains a change, with `contextLines`
 * surrounding lines on each side and a hard cap of `maxLines` total lines.
 */

export interface UnifiedDiffOptions {
	readonly contextLines?: number;
	readonly maxLines?: number;
}

const DEFAULT_CONTEXT = 2;
const DEFAULT_MAX_LINES = 12;

/**
 * Build a small unified-diff snippet between `oldText` and `newText`. Returns
 * an empty string when the inputs are equal.
 */
export function buildSnippet(oldText: string, newText: string, opts: UnifiedDiffOptions = {}): string {
	if (oldText === newText) return '';

	const context = opts.contextLines ?? DEFAULT_CONTEXT;
	const max = opts.maxLines ?? DEFAULT_MAX_LINES;

	const oldLines = oldText.split('\n');
	const newLines = newText.split('\n');
	const ops = computeLineOps(oldLines, newLines);

	// Find the first index where ops[i].op !== '='
	let firstChange = -1;
	for (let i = 0; i < ops.length; i += 1) {
		if (ops[i]?.op !== '=') {
			firstChange = i;
			break;
		}
	}
	if (firstChange === -1) return '';

	const start = Math.max(0, firstChange - context);
	const out: string[] = [];
	for (let i = start; i < ops.length && out.length < max; i += 1) {
		const op = ops[i];
		if (op === undefined) break;
		if (op.op === '=') out.push(` ${op.line}`);
		else if (op.op === '-') out.push(`-${op.line}`);
		else out.push(`+${op.line}`);
	}
	if (ops.length > start + max) {
		out.push(`... (${ops.length - (start + max)} more lines)`);
	}
	return out.join('\n');
}

interface LineOp {
	readonly op: '=' | '-' | '+';
	readonly line: string;
}

function computeLineOps(oldLines: readonly string[], newLines: readonly string[]): readonly LineOp[] {
	const m = oldLines.length;
	const n = newLines.length;

	// LCS length table.
	const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
	for (let i = m - 1; i >= 0; i -= 1) {
		for (let j = n - 1; j >= 0; j -= 1) {
			const dpRow = dp[i];
			const dpRowNext = dp[i + 1];
			if (dpRow === undefined || dpRowNext === undefined) continue;
			if (oldLines[i] === newLines[j]) {
				dpRow[j] = (dpRowNext[j + 1] ?? 0) + 1;
			} else {
				dpRow[j] = Math.max(dpRowNext[j] ?? 0, dpRow[j + 1] ?? 0);
			}
		}
	}

	const ops: LineOp[] = [];
	let i = 0;
	let j = 0;
	while (i < m && j < n) {
		if (oldLines[i] === newLines[j]) {
			ops.push({ op: '=', line: oldLines[i] ?? '' });
			i += 1;
			j += 1;
		} else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
			ops.push({ op: '-', line: oldLines[i] ?? '' });
			i += 1;
		} else {
			ops.push({ op: '+', line: newLines[j] ?? '' });
			j += 1;
		}
	}
	while (i < m) {
		ops.push({ op: '-', line: oldLines[i] ?? '' });
		i += 1;
	}
	while (j < n) {
		ops.push({ op: '+', line: newLines[j] ?? '' });
		j += 1;
	}
	return ops;
}
