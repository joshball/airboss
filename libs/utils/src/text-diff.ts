/**
 * Word-level LCS diff used by the handbook reader's amendment panel to
 * show learners what changed between the FAA's original text and the
 * post-errata replacement text.
 *
 * The algorithm is a classic Longest Common Subsequence over tokens.
 * Tokens preserve the whitespace that separates them so the rendered
 * output reads naturally; consecutive ops of the same kind are merged so
 * markup stays compact (one `<ins>` per insertion run, not one per word).
 *
 * Self-contained, no new dependencies. ~50-80 lines, intentionally
 * unsophisticated -- amendment text in MOSAIC addenda is at most a
 * paragraph; quadratic LCS is fine.
 */

/**
 * One contiguous span of the diff. Renderers map the kinds to whatever
 * markup they prefer; this module is presentation-agnostic.
 */
export type DiffOp = {
	kind: 'equal' | 'add' | 'remove';
	text: string;
};

/**
 * Tokenize a string into an alternating sequence of word tokens and
 * whitespace tokens. Each token is a non-empty string; concatenating
 * them reproduces the input exactly. Word-level granularity is the
 * sweet spot for prose diffs: character-level produces noisy output for
 * a renamed term, paragraph-level hides which words changed.
 */
function tokenize(input: string): string[] {
	if (input.length === 0) return [];
	// Match either a run of whitespace or a run of non-whitespace. Both
	// kinds are kept so reassembly is lossless.
	return input.match(/\s+|\S+/g) ?? [];
}

/**
 * Compute a word-level diff. Empty inputs collapse to a single op (or
 * nothing when both are empty). Whitespace is preserved verbatim.
 *
 * The complexity is O(n * m) in token count which is fine for the
 * handbook reader: errata replacement spans are paragraph-sized at
 * worst.
 */
export function wordDiff(a: string, b: string): DiffOp[] {
	if (a === b) {
		return a.length === 0 ? [] : [{ kind: 'equal', text: a }];
	}
	if (a.length === 0) return [{ kind: 'add', text: b }];
	if (b.length === 0) return [{ kind: 'remove', text: a }];

	const tokensA = tokenize(a);
	const tokensB = tokenize(b);
	const n = tokensA.length;
	const m = tokensB.length;

	// LCS DP table. `lcs[i][j]` = length of LCS for tokensA[i..] vs
	// tokensB[j..]. We walk it forwards during backtrack.
	const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
	for (let i = n - 1; i >= 0; i--) {
		for (let j = m - 1; j >= 0; j--) {
			if (tokensA[i] === tokensB[j]) {
				lcs[i][j] = (lcs[i + 1]?.[j + 1] ?? 0) + 1;
			} else {
				lcs[i][j] = Math.max(lcs[i + 1]?.[j] ?? 0, lcs[i]?.[j + 1] ?? 0);
			}
		}
	}

	const ops: DiffOp[] = [];
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		const a_i = tokensA[i] ?? '';
		const b_j = tokensB[j] ?? '';
		if (a_i === b_j) {
			pushOp(ops, 'equal', a_i);
			i++;
			j++;
		} else if ((lcs[i + 1]?.[j] ?? 0) >= (lcs[i]?.[j + 1] ?? 0)) {
			pushOp(ops, 'remove', a_i);
			i++;
		} else {
			pushOp(ops, 'add', b_j);
			j++;
		}
	}
	while (i < n) {
		pushOp(ops, 'remove', tokensA[i] ?? '');
		i++;
	}
	while (j < m) {
		pushOp(ops, 'add', tokensB[j] ?? '');
		j++;
	}
	return ops;
}

/**
 * Append a token to the running op list, merging it into the previous
 * op when the kinds match. Renderers receive at most one op per
 * contiguous insertion / deletion / preserved run.
 */
function pushOp(ops: DiffOp[], kind: DiffOp['kind'], text: string): void {
	if (text.length === 0) return;
	const last = ops[ops.length - 1];
	if (last && last.kind === kind) {
		last.text += text;
		return;
	}
	ops.push({ kind, text });
}
