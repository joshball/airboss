/**
 * Pairwise-repulsion collision algorithm guards (per Spike 03 baseline:
 * 40 iterations, 36 px min-distance default).
 *
 * The METAR/PIREP plot grids in Phase C lean on this primitive; a
 * regression here would silently overlap glyphs, breaking the entire
 * point-symbology band. These tests pin the termination + min-distance
 * + leader-metadata invariants.
 */

import { describe, expect, it } from 'vitest';
import { type CollisionPoint, resolveCollisions } from '../point/collision';

function buildClusterPoints(count: number, regionPx: number, seed = 1): CollisionPoint[] {
	// LCG so the test is fully deterministic across runs.
	let state = seed;
	const next = (): number => {
		state = (state * 1103515245 + 12345) & 0x7fffffff;
		return state / 0x7fffffff;
	};
	const out: CollisionPoint[] = [];
	for (let i = 0; i < count; i++) {
		out.push({ id: `s${i}`, x: next() * regionPx, y: next() * regionPx });
	}
	return out;
}

describe('resolveCollisions()', () => {
	it('terminates within maxIterations even on a dense cluster', () => {
		const points = buildClusterPoints(80, 200);
		const result = resolveCollisions({ points, minDistance: 36, maxIterations: 40 });
		expect(result.iterations).toBeLessThanOrEqual(40);
	});

	it('every placed pair is either >= minDistance OR flagged in unresolved', () => {
		const points = buildClusterPoints(40, 300);
		const result = resolveCollisions({ points, minDistance: 36, maxIterations: 40 });
		const unresolvedSet = new Set(result.unresolved.map((u) => `${u.a}|${u.b}`));
		for (let i = 0; i < result.placed.length; i++) {
			for (let j = i + 1; j < result.placed.length; j++) {
				const a = result.placed[i];
				const b = result.placed[j];
				const d = Math.hypot(b.x - a.x, b.y - a.y);
				const inUnresolved = unresolvedSet.has(`${a.id}|${b.id}`) || unresolvedSet.has(`${b.id}|${a.id}`);
				expect(d >= 36 - 0.001 || inUnresolved).toBe(true);
			}
		}
	});

	it('records leader metadata for points that moved', () => {
		const points: CollisionPoint[] = [
			{ id: 'a', x: 100, y: 100 },
			{ id: 'b', x: 102, y: 100 },
		];
		const result = resolveCollisions({ points, minDistance: 36, maxIterations: 10 });
		expect(result.leaders.length).toBeGreaterThan(0);
		const leader = result.leaders[0];
		expect(leader.displaced).toBe(true);
		expect(leader.displacementPx).toBeGreaterThan(0);
		// Original anchor preserved alongside the placed coords.
		expect(typeof leader.originalX).toBe('number');
		expect(typeof leader.originalY).toBe('number');
	});

	it('leaves well-separated points untouched (no displacement)', () => {
		const points: CollisionPoint[] = [
			{ id: 'a', x: 100, y: 100 },
			{ id: 'b', x: 500, y: 100 },
			{ id: 'c', x: 100, y: 500 },
		];
		const result = resolveCollisions({ points, minDistance: 36, maxIterations: 10 });
		for (const p of result.placed) {
			expect(p.x).toBe(p.originalX);
			expect(p.y).toBe(p.originalY);
			expect(p.displaced).toBe(false);
		}
		expect(result.leaders).toHaveLength(0);
	});

	it('handles two coincident points (dist=0) without crashing', () => {
		const points: CollisionPoint[] = [
			{ id: 'a', x: 100, y: 100 },
			{ id: 'b', x: 100, y: 100 },
		];
		const result = resolveCollisions({ points, minDistance: 36, maxIterations: 10 });
		const dist = Math.hypot(result.placed[1].x - result.placed[0].x, result.placed[1].y - result.placed[0].y);
		expect(dist).toBeGreaterThan(0);
	});
});
