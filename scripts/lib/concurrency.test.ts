/**
 * Unit tests for the bounded async pool used to cap svelte-check concurrency.
 *
 * Why this matters: running all 5 svelte-checks in parallel exceeds the
 * default V8 old-space heap and OOMs. The pool keeps in-flight work to
 * `limit`, returns results in input order, and propagates the first error.
 * If any of those guarantees regresses we get either silent OOMs (cap
 * broken), summary rows in the wrong order (order broken), or a green
 * pipeline that should have failed (error swallowed).
 */

import { describe, expect, it } from 'vitest';
import { resolvePositiveIntEnv, runWithConcurrency } from './concurrency';

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
	let resolve!: (v: T) => void;
	let reject!: (e: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

describe('runWithConcurrency', () => {
	it('caps concurrent in-flight tasks at the requested limit', async () => {
		const items = [0, 1, 2, 3, 4, 5, 6, 7];
		const limit = 3;
		let inFlight = 0;
		let peak = 0;
		const gates = items.map(() => deferred<void>());

		const promise = runWithConcurrency(items, limit, async (_item, index) => {
			inFlight += 1;
			if (inFlight > peak) peak = inFlight;
			await gates[index]?.promise;
			inFlight -= 1;
			return index;
		});

		// Yield enough microtasks for the pool to spin up its workers and saturate the cap.
		for (let i = 0; i < 10; i += 1) await Promise.resolve();
		expect(inFlight).toBe(limit);

		// Drain in deterministic order so peak stays at `limit`.
		for (const g of gates) {
			g.resolve();
			await Promise.resolve();
			await Promise.resolve();
		}

		await promise;
		expect(peak).toBe(limit);
	});

	it('returns results in input order regardless of completion order', async () => {
		// Reverse order: later items finish first.
		const delays = [40, 30, 20, 10, 0];
		const results = await runWithConcurrency(delays, 3, async (ms, index) => {
			await new Promise((resolve) => setTimeout(resolve, ms));
			return `item-${index}`;
		});
		expect(results).toEqual(['item-0', 'item-1', 'item-2', 'item-3', 'item-4']);
	});

	it('propagates the first thrown error after in-flight tasks settle', async () => {
		const sentinel = new Error('boom');
		await expect(
			runWithConcurrency([0, 1, 2, 3, 4], 2, async (_item, index) => {
				if (index === 1) throw sentinel;
				await new Promise((resolve) => setTimeout(resolve, 5));
				return index;
			}),
		).rejects.toBe(sentinel);
	});

	it('handles an empty input list without spawning workers', async () => {
		const results = await runWithConcurrency<number, number>([], 3, async () => {
			throw new Error('should never run');
		});
		expect(results).toEqual([]);
	});

	it('caps the worker pool at items.length when limit exceeds it', async () => {
		const items = [0, 1];
		let inFlight = 0;
		let peak = 0;
		const results = await runWithConcurrency(items, 10, async (item) => {
			inFlight += 1;
			if (inFlight > peak) peak = inFlight;
			await new Promise((resolve) => setTimeout(resolve, 5));
			inFlight -= 1;
			return item;
		});
		expect(results).toEqual([0, 1]);
		expect(peak).toBeLessThanOrEqual(2);
	});

	it('rejects with a clear error when limit is invalid', async () => {
		await expect(runWithConcurrency([1, 2], 0, async (n) => n)).rejects.toThrow(/positive integer/);
		await expect(runWithConcurrency([1, 2], Number.NaN, async (n) => n)).rejects.toThrow(/positive integer/);
	});
});

describe('resolvePositiveIntEnv', () => {
	it('returns the default when env var is unset', () => {
		expect(resolvePositiveIntEnv(undefined, 3)).toBe(3);
	});

	it('returns the default when env var is empty', () => {
		expect(resolvePositiveIntEnv('', 3)).toBe(3);
	});

	it('parses a valid integer override', () => {
		expect(resolvePositiveIntEnv('5', 3)).toBe(5);
		expect(resolvePositiveIntEnv('1', 3)).toBe(1);
	});

	it('falls back to the default for non-numeric or non-positive values', () => {
		expect(resolvePositiveIntEnv('abc', 3)).toBe(3);
		expect(resolvePositiveIntEnv('0', 3)).toBe(3);
		expect(resolvePositiveIntEnv('-2', 3)).toBe(3);
	});
});
