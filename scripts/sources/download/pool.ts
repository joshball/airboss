/**
 * Bounded-concurrency worker pool.
 *
 * Drives a fixed-size set of async workers over an input list. Each worker
 * pulls the next index from a shared counter, awaits the per-item function,
 * and loops until the input is drained. Maximally efficient: a slow item in
 * "batch K" never blocks the start of "batch K+1" the way naive `Promise.all`
 * chunking would.
 *
 *   - Order of completion is undefined.
 *   - In-flight count is exactly `min(limit, items.length)` while work remains.
 *   - Errors thrown by `fn` propagate via `Promise.all` -> sibling workers
 *     keep running but the awaited result rejects (callers that need
 *     fault-isolation should swallow inside `fn`, as `executePlan` does for
 *     the source-downloader path).
 *
 * Co-located in `scripts/sources/download/` because it has exactly one
 * caller; lift to `@ab/utils` if a second consumer appears.
 */

export async function runPlansBounded<T>(
	items: readonly T[],
	limit: number,
	fn: (item: T) => Promise<void>,
): Promise<void> {
	if (items.length === 0) return;
	if (!Number.isInteger(limit) || limit < 1) {
		throw new Error(`runPlansBounded: limit must be a positive integer, got ${limit}`);
	}
	let cursor = 0;
	const workerCount = Math.min(limit, items.length);
	const workers = Array.from({ length: workerCount }, async () => {
		while (true) {
			const idx = cursor;
			cursor += 1;
			if (idx >= items.length) return;
			const item = items[idx];
			if (item === undefined) return;
			await fn(item);
		}
	});
	await Promise.all(workers);
}
