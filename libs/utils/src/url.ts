/**
 * Build a query string from a record, dropping undefined/null/empty-string
 * values. Centralizes URL construction so every caller stays consistent and
 * we never forget to encode a value.
 *
 * Returns an empty string when no usable params are supplied, so callers can
 * concatenate unconditionally (e.g. `${ROUTES.FOO}${buildQuery({...})}`).
 */
export function buildQuery(params: Record<string, string | number | null | undefined>): string {
	const p = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) {
		if (v === undefined || v === null || v === '') continue;
		p.set(k, String(v));
	}
	const s = p.toString();
	return s ? `?${s}` : '';
}
