/**
 * Bounded async pool used by the check pipeline (and a candidate for any
 * future caller that needs "run N at a time, in input order").
 *
 * Lives in `scripts/lib/` so it can be unit-tested without dragging in the
 * CLI surface (`scripts/check.ts` imports `bun`, which isn't loadable
 * under vitest's node environment).
 */

/**
 * Run `fn(item, index)` for each item in `items`, with at most `limit`
 * tasks in flight at once. Results come back in input order.
 *
 * If any task rejects, the returned promise rejects with the FIRST error
 * after all currently in-flight tasks settle. No further work starts once
 * an error is observed.
 *
 * Example: cap svelte-check at 3 because 5 in parallel exceeds the default
 * V8 old-space heap.
 */
export async function runWithConcurrency<T, R>(
	items: readonly T[],
	limit: number,
	fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	if (!Number.isFinite(limit) || limit < 1) {
		throw new Error(`runWithConcurrency: limit must be a positive integer, got ${limit}`);
	}
	const cap = Math.min(Math.floor(limit), items.length);
	const results: R[] = new Array<R>(items.length);
	let nextIndex = 0;
	let firstError: unknown;
	const workers: Promise<void>[] = [];
	const worker = async (): Promise<void> => {
		while (true) {
			if (firstError !== undefined) return;
			const i = nextIndex;
			if (i >= items.length) return;
			nextIndex += 1;
			const item = items[i] as T;
			try {
				results[i] = await fn(item, i);
			} catch (err) {
				if (firstError === undefined) firstError = err;
				return;
			}
		}
	};
	for (let i = 0; i < cap; i += 1) workers.push(worker());
	await Promise.all(workers);
	if (firstError !== undefined) throw firstError;
	return results;
}

/**
 * Resolve a positive-integer concurrency cap from an env value, falling
 * back to `defaultCap` when missing, empty, or garbage. The env var is a
 * tuning knob; we never want a typo to abort the pipeline.
 */
export function resolvePositiveIntEnv(envValue: string | undefined, defaultValue: number): number {
	if (envValue === undefined || envValue === '') return defaultValue;
	const parsed = Number.parseInt(envValue, 10);
	if (!Number.isFinite(parsed) || parsed < 1) return defaultValue;
	return parsed;
}
