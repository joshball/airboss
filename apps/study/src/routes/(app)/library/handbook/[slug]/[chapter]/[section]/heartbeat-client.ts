/**
 * Heartbeat-client transport for the handbook section reader.
 *
 * The reader's `$effect` ticks every `HANDBOOK_HEARTBEAT_INTERVAL_SEC` and
 * needs two related guarantees:
 *
 *   1. Concurrency-safe queue. A second tick fired while the first POST is
 *      still in flight (slow network, paused dev backend) must NOT race the
 *      shared queue. Two concurrent runs both writing to the same queue
 *      array can either lose deltas (the second's read sees the first's
 *      partial state) or double-count them.
 *   2. Local mirror only advances on confirmed delivery. The local
 *      `accumulatedSecondsThisLoad` adds onto the server's snapshot to
 *      keep `totalSecondsVisible` accurate within a single page-load. If
 *      the local mirror credits even when the POST 5xxs (or sendBeacon
 *      drops the bytes), the suggestion banner can fire at the wrong
 *      threshold -- local says "read", persisted says "barely started".
 *
 * Extracted from the page component so the queue + success-gate logic has a
 * single deterministic test seam without booting a DOM. The reader still
 * owns the `$effect`, the visibility/pagehide listeners, and the
 * scroll-end watcher; only the `fetch` / `sendBeacon` orchestration lives
 * here.
 */

import { HANDBOOK_HEARTBEAT_BUFFER } from '@ab/constants';

/** Result of a single delta delivery attempt. */
export type HeartbeatPostResult = { kind: 'success' } | { kind: 'failure'; reason: 'http' | 'network' };

/** A `fetch`-shape function injected for tests. */
export type HeartbeatFetch = (url: string, body: string) => Promise<HeartbeatPostResult>;

/**
 * `sendBeacon`-shape function injected for tests. Returns `true` when the
 * UA accepted the bytes for delivery, mirroring the browser API. The
 * unload-time path uses this; success here gates the local mirror just
 * like the interval-tick path gates on a 2xx response.
 */
export type HeartbeatBeacon = (url: string, body: string) => boolean;

/** External hooks the queue calls -- isolates side effects from queue logic. */
export interface HeartbeatQueueHooks {
	/** POST one delta. Resolves to `success` on 2xx, `failure` otherwise. */
	post: HeartbeatFetch;
	/** Called on confirmed-delivered delta. The reader uses this to advance the local mirror. */
	onCredit: (deltaSec: number) => void;
}

/**
 * Single-flight FIFO queue over heartbeat deltas. Collapses concurrent
 * `flush()` calls into one in-flight POST chain; appending to the queue
 * mid-flight keeps the new delta safe in the buffer until the active
 * chain reaches it. Trims to `HANDBOOK_HEARTBEAT_BUFFER` from the front
 * on consecutive failures so a long offline stretch can't grow unbounded.
 *
 * Returned object is captured by the reader's `$effect`; teardown does
 * not need to `cancel` the queue (in-flight POSTs simply drain to
 * completion on close).
 */
export interface HeartbeatQueue {
	/** Push a delta and start (or rejoin) the flush chain. */
	enqueue(deltaSec: number): void;
	/** Read-only -- exposed for tests; production code does not poke it. */
	readonly pending: readonly number[];
}

export function createHeartbeatQueue(url: string, hooks: HeartbeatQueueHooks): HeartbeatQueue {
	const pending: number[] = [];
	let inFlight = false;

	async function flush(): Promise<void> {
		if (inFlight) return;
		if (pending.length === 0) return;
		inFlight = true;
		try {
			while (pending.length > 0) {
				const next = pending[0];
				if (next === undefined) break;
				const result = await hooks.post(url, JSON.stringify({ delta: next }));
				if (result.kind === 'success') {
					pending.shift();
					hooks.onCredit(next);
					continue;
				}
				// Network or server rejected: keep the unsent tail; trim from
				// the front past the cap so a long offline stretch can't grow
				// unbounded. The local mirror does NOT advance.
				const overflow = pending.length - HANDBOOK_HEARTBEAT_BUFFER;
				if (overflow > 0) pending.splice(0, overflow);
				return;
			}
		} finally {
			inFlight = false;
		}
	}

	return {
		enqueue(deltaSec: number): void {
			pending.push(deltaSec);
			void flush();
		},
		get pending(): readonly number[] {
			return pending;
		},
	};
}

/**
 * Standard `fetch`-backed transport adapter. Returns `failure` for any
 * non-2xx (including 4xx anti-flood rejections, which the reader treats
 * the same as network failure for the purposes of the local mirror).
 */
export async function fetchHeartbeatPost(url: string, body: string): Promise<HeartbeatPostResult> {
	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body,
		});
		return response.ok ? { kind: 'success' } : { kind: 'failure', reason: 'http' };
	} catch {
		return { kind: 'failure', reason: 'network' };
	}
}

/**
 * Send a beacon-style flush for an unload-time partial delta. Returns
 * `true` when the UA queued the request (mirrors `sendBeacon`'s contract)
 * so the reader can credit the local mirror only on confirmed
 * acceptance. The fetch fallback is wired by the reader directly because
 * its success/failure check is async and the reader needs to credit
 * inside a `.then`.
 */
export function flushBeaconPartial(beacon: HeartbeatBeacon, url: string, deltaSec: number): boolean {
	return beacon(url, JSON.stringify({ delta: deltaSec }));
}
