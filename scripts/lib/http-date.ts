/**
 * RFC 7231 / RFC 1123 HTTP-date comparison helper.
 *
 * Used by the source-download freshness check: we treat a cached file as fresh
 * when the remote `Last-Modified` header is NOT newer than the value recorded
 * in the per-doc manifest. Returns `false` if either string fails `Date.parse`.
 */
export function isLaterHttpDate(candidate: string, baseline: string): boolean {
	const c = Date.parse(candidate);
	const b = Date.parse(baseline);
	if (Number.isNaN(c) || Number.isNaN(b)) return false;
	return c > b;
}
