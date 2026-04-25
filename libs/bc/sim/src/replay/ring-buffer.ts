/**
 * Fixed-capacity ring buffer for replay frames.
 *
 * The worker writes ~30 frames/second and only drains when the scenario
 * ends. A 3-minute scenario at 30 Hz = 5400 frames; double that to
 * 10800 to absorb step-and-debug pauses without dropping frames. When
 * the buffer is full and a new frame is written, the oldest frame is
 * silently overwritten -- the eventual tape covers the most-recent
 * window, not necessarily the entire run.
 *
 * The Phase 4 spec sets a 5 MB compressed tape budget for 3-minute
 * scenarios; longer runs drop intermediate frames to fit. This buffer
 * is the dropping policy.
 */

import type { ReplayFrame } from './types';

/** Default ring capacity; ~6 minutes at 30 Hz. */
export const DEFAULT_RING_CAPACITY = 10800;

export interface FrameRing {
	/**
	 * Internal storage. Consumers must never mutate this directly; use
	 * `pushFrame` and `drainFrames`.
	 */
	readonly slots: (ReplayFrame | null)[];
	/** Index of the next write position. */
	writeIdx: number;
	/** Total frames written since construction (may exceed capacity). */
	totalWrites: number;
	/** Capacity of the ring. */
	readonly capacity: number;
}

/** Construct an empty ring of the given capacity. */
export function createFrameRing(capacity: number = DEFAULT_RING_CAPACITY): FrameRing {
	if (!Number.isFinite(capacity) || capacity <= 0) {
		throw new Error(`createFrameRing: capacity must be positive, got ${capacity}`);
	}
	return {
		slots: new Array<ReplayFrame | null>(capacity).fill(null),
		writeIdx: 0,
		totalWrites: 0,
		capacity,
	};
}

/**
 * Append a frame to the ring. Mutates the ring in place. When the ring
 * is full, the oldest frame is overwritten.
 */
export function pushFrame(ring: FrameRing, frame: ReplayFrame): void {
	ring.slots[ring.writeIdx] = frame;
	ring.writeIdx = (ring.writeIdx + 1) % ring.capacity;
	ring.totalWrites += 1;
}

/**
 * Drain the ring into an in-order frame array. Returns frames in
 * monotonically increasing `t`. After drain the ring is empty.
 *
 * If the ring wrapped (totalWrites > capacity), the returned array
 * spans only the most-recent `capacity` frames; earlier frames are
 * unrecoverable. The caller may inspect `ring.totalWrites - ring.capacity`
 * to surface "frames dropped" telemetry.
 */
export function drainFrames(ring: FrameRing): ReplayFrame[] {
	const out: ReplayFrame[] = [];
	const wrapped = ring.totalWrites >= ring.capacity;
	if (wrapped) {
		// Read from writeIdx (the oldest still-live slot) around to writeIdx-1.
		for (let i = 0; i < ring.capacity; i += 1) {
			const idx = (ring.writeIdx + i) % ring.capacity;
			const frame = ring.slots[idx];
			if (frame !== null) out.push(frame);
		}
	} else {
		// No wrap: read 0..writeIdx in order.
		for (let i = 0; i < ring.writeIdx; i += 1) {
			const frame = ring.slots[i];
			if (frame !== null) out.push(frame);
		}
	}
	// Reset.
	ring.slots.fill(null);
	ring.writeIdx = 0;
	ring.totalWrites = 0;
	return out;
}

/** True when the ring has wrapped at least once (frames have been dropped). */
export function ringHasWrapped(ring: FrameRing): boolean {
	return ring.totalWrites > ring.capacity;
}

/** Number of frames lost to overwrite. Zero unless the ring wrapped. */
export function ringFramesDropped(ring: FrameRing): number {
	return Math.max(0, ring.totalWrites - ring.capacity);
}
