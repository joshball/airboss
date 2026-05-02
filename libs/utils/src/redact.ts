/**
 * Recursive redactor for audit-rendered payloads. Walks any JSON-shaped value
 * and replaces values whose key matches a "sensitive" pattern (`token`,
 * `secret`, `password`, `cookie`, `key`, `authorization`) with the constant
 * `REDACTED_PLACEHOLDER`. Defense-in-depth for surfaces that render arbitrary
 * `metadata` blobs from `audit_log` rows -- the BC has no schema constraint
 * on what gets written into `metadata`, and a future caller could plant a
 * session token or temp-file path that an admin reader would otherwise see
 * verbatim.
 *
 * Closes chunk-6 security MIN: audit-detail page ships full `before` / `after`
 * / `metadata` payloads with no field allowlist.
 */

export const REDACTED_PLACEHOLDER = '[REDACTED]';

const SENSITIVE_KEY_RE = /token|secret|password|cookie|authorization|bearer|api[_-]?key|private[_-]?key/i;

/** True when the key name suggests a credential / session payload. */
export function isSensitiveKey(key: string): boolean {
	return SENSITIVE_KEY_RE.test(key);
}

/**
 * Recursively walk `value` and return a structural copy with every value
 * under a sensitive key replaced by `REDACTED_PLACEHOLDER`. Arrays are walked
 * element-by-element; primitives pass through untouched. The implementation
 * guards against cycles by tracking visited objects -- audit payloads are
 * always JSON, but defense-in-depth costs us one Set lookup per node.
 */
export function redactSensitive<T>(value: T): T {
	const seen = new WeakSet<object>();
	function walk(v: unknown): unknown {
		if (v === null || typeof v !== 'object') return v;
		if (seen.has(v as object)) return v; // cycle short-circuit
		seen.add(v as object);
		if (Array.isArray(v)) return v.map(walk);
		const out: Record<string, unknown> = {};
		for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
			out[k] = isSensitiveKey(k) ? REDACTED_PLACEHOLDER : walk(val);
		}
		return out;
	}
	return walk(value) as T;
}
