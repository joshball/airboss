/**
 * Unit tests for the section-reader heartbeat client. Pins three
 * invariants that the chunk-1 correctness tail flagged:
 *
 *   1. The local mirror only advances on confirmed delivery (success
 *      response). Pre-fix the reader credited
 *      `accumulatedSecondsThisLoad += elapsedSec` before / regardless of
 *      whether the POST succeeded -- the local count drifted above the
 *      server's authoritative count whenever a delta was rejected by the
 *      anti-flood floor or 5xx'd, and the suggestion banner could fire
 *      at the wrong threshold.
 *   2. Failed deltas stay queued for retry instead of getting dropped.
 *   3. The queue is single-flight: appending mid-flight does not double-
 *      count or skip deltas.
 *
 * No DOM, no DB, no real fetch -- the queue is a pure transport adapter
 * around a `post` function. We feed it scripted `success` / `failure`
 * results and assert on credit + queue invariants.
 */

import { HANDBOOK_HEARTBEAT_BUFFER } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { createHeartbeatQueue, type HeartbeatPostResult, type HeartbeatQueueHooks } from './heartbeat-client';

const HEARTBEAT_URL = '/library/handbook/foo/1/2/heartbeat';

/**
 * Build a queue whose `post` returns scripted results in order. Records
 * every (url, body) pair the queue actually sent, plus every credit it
 * fired. Last script entry repeats forever so callers don't have to size
 * the array exactly.
 */
function scriptedQueue(results: readonly HeartbeatPostResult[]) {
	const sent: { url: string; body: string }[] = [];
	const credited: number[] = [];
	let nextResultIdx = 0;
	const post = async (url: string, body: string): Promise<HeartbeatPostResult> => {
		sent.push({ url, body });
		const result = results[Math.min(nextResultIdx, results.length - 1)];
		nextResultIdx++;
		if (!result) throw new Error('script exhausted');
		return result;
	};
	const hooks: HeartbeatQueueHooks = {
		post,
		onCredit: (deltaSec) => credited.push(deltaSec),
	};
	const queue = createHeartbeatQueue(HEARTBEAT_URL, hooks);
	return { queue, sent, credited };
}

describe('createHeartbeatQueue', () => {
	it('credits the local mirror on a successful POST', async () => {
		const { queue, credited, sent } = scriptedQueue([{ kind: 'success' }]);
		queue.enqueue(30);
		// Drain microtasks: the queue.flush is fire-and-forget.
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(credited).toEqual([30]);
		expect(sent).toHaveLength(1);
		expect(sent[0]?.url).toBe(HEARTBEAT_URL);
		expect(JSON.parse(sent[0]?.body ?? '{}')).toEqual({ delta: 30 });
		expect(queue.pending).toHaveLength(0);
	});

	it('does NOT credit on a failed POST (regression: chunk-1 correctness MINOR)', async () => {
		// The original review finding: `tick()` increments accumulators
		// before/regardless of whether the POST succeeds. After the fix the
		// queue refuses to credit on `failure`.
		const { queue, credited, sent } = scriptedQueue([{ kind: 'failure', reason: 'http' }]);
		queue.enqueue(30);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(credited).toEqual([]);
		expect(sent).toHaveLength(1);
		// Delta is held for retry on the next enqueue/flush.
		expect(queue.pending).toEqual([30]);
	});

	it('does NOT credit on a network failure', async () => {
		const { queue, credited } = scriptedQueue([{ kind: 'failure', reason: 'network' }]);
		queue.enqueue(45);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(credited).toEqual([]);
		expect(queue.pending).toEqual([45]);
	});

	it('drains buffered deltas in FIFO once delivery resumes', async () => {
		// First two POSTs fail (offline stretch); deltas held for retry.
		// Third POST succeeds and the queue must drain BOTH backlog deltas
		// in FIFO order, crediting each once.
		const { queue, credited } = scriptedQueue([
			{ kind: 'failure', reason: 'network' },
			{ kind: 'success' },
			{ kind: 'success' },
		]);
		queue.enqueue(30);
		// Drain microtask so first POST completes (failure, queue holds delta)
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(queue.pending).toEqual([30]);
		queue.enqueue(20);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(credited).toEqual([30, 20]);
		expect(queue.pending).toHaveLength(0);
	});

	it('trims the queue from the front past the buffer cap', async () => {
		// Every POST fails; verify the queue does not grow unbounded. The
		// trim is FIFO (drop the oldest) so a recovery burst sends the
		// most recent reads, not a multi-hour-old delta.
		const { queue } = scriptedQueue([{ kind: 'failure', reason: 'network' }]);
		const overcap = HANDBOOK_HEARTBEAT_BUFFER + 5;
		for (let i = 1; i <= overcap; i++) {
			queue.enqueue(i);
			// Yield so each enqueue's flush attempt completes (and fails)
			// before the next one races it.
			// Two microtask drains -- the queue's flush awaits the post and
			// then trims; both happen within microtask scheduling.
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
		// The trim path keeps the cap as the upper bound, dropping the
		// oldest (smallest) values.
		expect(queue.pending.length).toBeLessThanOrEqual(HANDBOOK_HEARTBEAT_BUFFER);
		// The most recent delta is preserved.
		expect(queue.pending.includes(overcap)).toBe(true);
	});

	it('is single-flight: a second enqueue while flushing does not double-post the first delta', async () => {
		// Schedule the first post to take longer than the second enqueue.
		// Without the inFlight gate, both calls would observe `pending`
		// mid-mutation and either lose deltas or double-count them.
		const sent: { url: string; body: string }[] = [];
		const credited: number[] = [];
		let resolveFirstPost: (result: HeartbeatPostResult) => void = () => {};
		const post = (url: string, body: string): Promise<HeartbeatPostResult> => {
			sent.push({ url, body });
			if (sent.length === 1) {
				return new Promise<HeartbeatPostResult>((resolve) => {
					resolveFirstPost = resolve;
				});
			}
			return Promise.resolve({ kind: 'success' });
		};
		const hooks: HeartbeatQueueHooks = {
			post,
			onCredit: (deltaSec) => credited.push(deltaSec),
		};
		const queue = createHeartbeatQueue(HEARTBEAT_URL, hooks);

		queue.enqueue(30); // starts flush, post #1 hangs
		// Yield so flush begins (post #1 issued).
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(sent).toHaveLength(1);

		queue.enqueue(20); // single-flight: appends to pending, does not start a second flush
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(sent).toHaveLength(1); // STILL one POST in flight
		// Now resolve the first post; the in-flight loop should drain delta #2 next.
		resolveFirstPost({ kind: 'success' });
		// Drain twice: once to credit #1 + start #2, once to credit #2.
		await new Promise((resolve) => setTimeout(resolve, 0));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(sent).toHaveLength(2);
		expect(credited).toEqual([30, 20]);
		expect(queue.pending).toHaveLength(0);
	});

	it('serializes the body as `{ delta }` JSON', async () => {
		const { queue, sent } = scriptedQueue([{ kind: 'success' }]);
		queue.enqueue(45);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(JSON.parse(sent[0]?.body ?? '{}')).toEqual({ delta: 45 });
	});
});
