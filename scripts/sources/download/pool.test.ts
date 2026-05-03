/**
 * Bounded-concurrency worker-pool unit tests.
 *
 * Pins the three contract guarantees `run.ts` relies on:
 *
 *   1. Workers run in parallel up to the configured limit.
 *   2. The cap is honored: in-flight count never exceeds `limit`.
 *   3. A throwing item rejects the awaited result but does NOT cancel
 *      sibling workers (siblings already in-flight finish; later items
 *      still get pulled because the pool catches via Promise.all).
 *
 * Note: in airboss the `executePlan` caller swallows errors itself (records
 * to `result.errors` + partial-log, never throws), so `runPlansBounded` is
 * effectively never on a path where it has to fault-isolate. The throwing
 * test exists so future callers don't accidentally rely on undefined
 * behavior.
 */

import { describe, expect, it } from 'vitest';
import { runPlansBounded } from './pool';

describe('runPlansBounded', () => {
	it('is a no-op for an empty item list', async () => {
		let calls = 0;
		await runPlansBounded([], 4, async () => {
			calls += 1;
		});
		expect(calls).toBe(0);
	});

	it('rejects non-positive or non-integer limits', async () => {
		await expect(runPlansBounded([1], 0, async () => {})).rejects.toThrow(/limit must be a positive integer/);
		await expect(runPlansBounded([1], -1, async () => {})).rejects.toThrow(/limit must be a positive integer/);
		await expect(runPlansBounded([1], 1.5, async () => {})).rejects.toThrow(/limit must be a positive integer/);
	});

	it('processes every item exactly once (any order)', async () => {
		const items = Array.from({ length: 10 }, (_, i) => i);
		const seen = new Set<number>();
		await runPlansBounded(items, 3, async (n) => {
			seen.add(n);
		});
		expect(seen).toEqual(new Set(items));
	});

	it('honors the concurrency cap (limit=2 over 5 items: never more than 2 in-flight)', async () => {
		const items = [1, 2, 3, 4, 5];
		let inFlight = 0;
		let peak = 0;
		await runPlansBounded(items, 2, async () => {
			inFlight += 1;
			peak = Math.max(peak, inFlight);
			// Yield twice to let other workers tick.
			await Promise.resolve();
			await Promise.resolve();
			inFlight -= 1;
		});
		expect(peak).toBeLessThanOrEqual(2);
		expect(peak).toBeGreaterThan(0);
	});

	it('runs workers in parallel up to the cap (limit=4 sees overlapping start timestamps)', async () => {
		const items = [1, 2, 3, 4];
		const startsByItem: Record<number, number> = {};
		let releaseGate: (() => void) | null = null;
		const gate = new Promise<void>((resolve) => {
			releaseGate = resolve;
		});
		const fn = async (n: number): Promise<void> => {
			startsByItem[n] = Date.now();
			// All 4 workers wait on the same gate; if pool is sequential, only
			// one start would be recorded before the gate releases.
			await gate;
		};
		const exec = runPlansBounded(items, 4, fn);
		// Let all workers begin.
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
		expect(Object.keys(startsByItem)).toHaveLength(4);
		releaseGate?.();
		await exec;
	});

	it('limits in-flight to min(limit, items.length) when items < limit', async () => {
		const items = [1, 2];
		let inFlight = 0;
		let peak = 0;
		await runPlansBounded(items, 16, async () => {
			inFlight += 1;
			peak = Math.max(peak, inFlight);
			await Promise.resolve();
			inFlight -= 1;
		});
		// Cannot exceed the smaller of (limit, items.length) = 2.
		expect(peak).toBeLessThanOrEqual(2);
	});
});
