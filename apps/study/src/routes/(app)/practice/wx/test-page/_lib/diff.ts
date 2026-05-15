/**
 * Token-level METAR diff for the `/practice/wx/test-page` sandbox's
 * compare-against-expected mode.
 *
 * Browser-safe: pure functions, no imports. The author pastes an expected
 * METAR string; `diffMetarTokens` walks both token streams and tags each
 * position so the page can colour matches green and mismatches red.
 *
 * The diff is positional (token N of A vs token N of B) rather than a full
 * LCS alignment: METARs are short, fixed-order token streams, and a
 * positional diff makes "the engine put the gust group where you didn't
 * expect one" obvious without alignment ambiguity.
 */

/** One row of the positional diff. */
export interface MetarDiffRow {
	/** Token from the engine output (`null` when expected has extra tokens). */
	actual: string | null;
	/** Token from the pasted expected string (`null` when actual has extra). */
	expected: string | null;
	/** True when `actual === expected` and both are present. */
	match: boolean;
}

/** Split a METAR into whitespace-delimited tokens, dropping empty entries. */
export function metarTokens(raw: string): string[] {
	return raw
		.trim()
		.split(/\s+/)
		.filter((t) => t.length > 0);
}

/**
 * Positionally diff two METAR strings. The result has one row per token
 * position up to the longer of the two streams.
 */
export function diffMetarTokens(actual: string, expected: string): MetarDiffRow[] {
	const a = metarTokens(actual);
	const b = metarTokens(expected);
	const rows: MetarDiffRow[] = [];
	const len = Math.max(a.length, b.length);
	for (let i = 0; i < len; i += 1) {
		const actualToken = i < a.length ? (a[i] ?? null) : null;
		const expectedToken = i < b.length ? (b[i] ?? null) : null;
		rows.push({
			actual: actualToken,
			expected: expectedToken,
			match: actualToken !== null && actualToken === expectedToken,
		});
	}
	return rows;
}

/** True when every row matches -- the engine output equals the expected. */
export function diffIsClean(rows: MetarDiffRow[]): boolean {
	return rows.length > 0 && rows.every((r) => r.match);
}
