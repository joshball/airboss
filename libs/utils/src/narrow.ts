/**
 * Enum-narrowing helpers for untrusted inputs (query params, form fields,
 * JSON bodies).
 *
 * Replaces 12+ copies of hand-rolled `narrow<T>` / `narrowDomain` /
 * `parseDomain` / `parseMode` / `coerceEnum` flagged in the 2026-04-22 full
 * codebase review. Use one of these two helpers instead of rolling a new
 * one:
 *
 *   - `narrow(value, allowed)`        -> `T | undefined`  (no default;
 *                                                          caller decides
 *                                                          how to handle
 *                                                          "not in set")
 *   - `narrow(value, allowed, fallback)` -> `T`            (always returns
 *                                                          a member;
 *                                                          useful when the
 *                                                          caller wants a
 *                                                          default value)
 *
 * The helper treats `null` / `undefined` / non-string input the same as
 * "value not in set" so `URL.searchParams.get()` can be passed through
 * directly.
 */

export function narrow<T extends string>(value: unknown, allowed: readonly T[]): T | undefined;
export function narrow<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T;
export function narrow<T extends string>(value: unknown, allowed: readonly T[], fallback?: T): T | undefined {
	if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
		return value as T;
	}
	return fallback;
}
