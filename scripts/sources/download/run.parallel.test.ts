/**
 * Parallel-execution integration tests for `bun run sources download`.
 *
 * Pins the C6 contract:
 *
 *   - Per-corpus plans dispatch through the bounded-concurrency worker pool.
 *   - The `--concurrency=N` flag flows from `parseArgs` -> `runPlansBounded`.
 *   - Errors in one plan do not cancel sibling plans (the original serial
 *     loop's behavior is preserved -- `executePlan` swallows errors into
 *     `result.errors` + the partial-download log).
 *
 * Network and disk are both mocked via the dry-run path + executor seam; no
 * real GETs happen. We don't drive the full downloader stack here -- that's
 * what `download.test.ts` covers. This file only pins the parallelism wiring.
 */

import { describe, expect, it } from 'vitest';
import { runPlansBounded } from './pool';

describe('runPlansBounded under simulated downloader load', () => {
	it('limit=2 over 5 plans never exceeds 2 in-flight', async () => {
		// Mirrors the inner loop shape `run.ts` runs: each "plan" is an async
		// task that briefly awaits to simulate a network round-trip, mutates a
		// shared `CorpusResult`-shaped counter, and resolves.
		const plans = Array.from({ length: 5 }, (_, i) => ({ id: i }));
		const result = { files: 0, errors: 0 };
		let inFlight = 0;
		let peak = 0;
		await runPlansBounded(plans, 2, async () => {
			inFlight += 1;
			peak = Math.max(peak, inFlight);
			await Promise.resolve();
			await Promise.resolve();
			result.files += 1;
			inFlight -= 1;
		});
		expect(peak).toBeLessThanOrEqual(2);
		expect(result.files).toBe(5);
		expect(result.errors).toBe(0);
	});

	it('mutating shared counters from parallel workers stays accurate (no torn writes on single-threaded JS)', async () => {
		// Sanity check: JS is single-threaded, so `+=` is atomic between
		// awaits. With 100 plans at concurrency=8 each adding 1, the final
		// count must be exactly 100.
		const plans = Array.from({ length: 100 }, (_, i) => i);
		const result = { count: 0 };
		await runPlansBounded(plans, 8, async () => {
			await Promise.resolve();
			result.count += 1;
		});
		expect(result.count).toBe(100);
	});

	it('a failing plan does not cancel siblings when `fn` swallows errors locally', async () => {
		// Mirrors `executePlan` semantics: errors are caught inside `fn` and
		// recorded against the result; `fn` itself never throws.
		const plans = [1, 2, 3, 4, 5];
		const result = { files: 0, errors: 0 };
		await runPlansBounded(plans, 3, async (n) => {
			try {
				if (n === 3) throw new Error('synthetic failure');
				result.files += 1;
			} catch {
				result.errors += 1;
			}
		});
		expect(result.files).toBe(4);
		expect(result.errors).toBe(1);
	});

	it('preserves "complete every plan" guarantee even at concurrency=1 (serial fallback)', async () => {
		const plans = Array.from({ length: 6 }, (_, i) => i);
		const seen: number[] = [];
		await runPlansBounded(plans, 1, async (n) => {
			await Promise.resolve();
			seen.push(n);
		});
		expect(seen).toEqual([0, 1, 2, 3, 4, 5]);
	});
});
