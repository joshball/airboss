/**
 * Point-glyph collision avoidance.
 *
 * Pairwise repulsion in screen space: for each iteration, every pair
 * within `minDistance` is pushed apart by half the deficit along the
 * vector between them. Terminates when no pair moves OR after
 * `maxIterations`.
 *
 * After the run, each input point is annotated with its placed position,
 * its original position, and a `displaced: boolean` marker. Pairs that
 * remain inside `minDistance` after the run are listed in `unresolved`
 * so the renderer can mark them with `data-collision="unresolved"`.
 *
 * Defaults match the Spike 03 baseline (40 iterations, 36 px min
 * distance).
 *
 * Browser-safe: pure math, no Node imports.
 */

export interface CollisionPoint {
	id: string;
	/** Original screen-space coordinates. */
	x: number;
	y: number;
}

export interface CollisionInput {
	points: readonly CollisionPoint[];
	minDistance?: number;
	maxIterations?: number;
}

export interface PlacedPoint {
	id: string;
	originalX: number;
	originalY: number;
	x: number;
	y: number;
	displaced: boolean;
	displacementPx: number;
}

export interface CollisionResult {
	placed: PlacedPoint[];
	unresolved: Array<{ a: string; b: string; distance: number }>;
	iterations: number;
	/** Subset of `placed` that moved -- useful for `renderLeaderLines`. */
	leaders: PlacedPoint[];
}

const DEFAULT_MIN_DISTANCE = 36;
const DEFAULT_MAX_ITERATIONS = 40;
const MOVEMENT_EPSILON = 0.5;

export function resolveCollisions(input: CollisionInput): CollisionResult {
	const minDistance = input.minDistance ?? DEFAULT_MIN_DISTANCE;
	const maxIterations = input.maxIterations ?? DEFAULT_MAX_ITERATIONS;
	const minSquared = minDistance * minDistance;

	const placed: PlacedPoint[] = input.points.map((p) => ({
		id: p.id,
		originalX: p.x,
		originalY: p.y,
		x: p.x,
		y: p.y,
		displaced: false,
		displacementPx: 0,
	}));

	let iterations = 0;
	for (let iter = 0; iter < maxIterations; iter++) {
		iterations = iter + 1;
		let moved = false;
		for (let i = 0; i < placed.length; i++) {
			for (let j = i + 1; j < placed.length; j++) {
				const a = placed[i];
				const b = placed[j];
				const dx = b.x - a.x;
				const dy = b.y - a.y;
				const distSq = dx * dx + dy * dy;
				if (distSq >= minSquared) continue;
				const dist = Math.sqrt(distSq);
				// Coincident points: nudge along an arbitrary axis.
				const ux = dist === 0 ? 1 : dx / dist;
				const uy = dist === 0 ? 0 : dy / dist;
				const overlap = minDistance - dist;
				const push = overlap / 2;
				a.x -= ux * push;
				a.y -= uy * push;
				b.x += ux * push;
				b.y += uy * push;
				moved = true;
			}
		}
		if (!moved) break;
	}

	for (const p of placed) {
		const ddx = p.x - p.originalX;
		const ddy = p.y - p.originalY;
		const d = Math.hypot(ddx, ddy);
		p.displacementPx = d;
		p.displaced = d > MOVEMENT_EPSILON;
	}

	const unresolved: CollisionResult['unresolved'] = [];
	for (let i = 0; i < placed.length; i++) {
		for (let j = i + 1; j < placed.length; j++) {
			const a = placed[i];
			const b = placed[j];
			const dist = Math.hypot(b.x - a.x, b.y - a.y);
			if (dist + 0.001 < minDistance) {
				unresolved.push({ a: a.id, b: b.id, distance: dist });
			}
		}
	}

	const leaders = placed.filter((p) => p.displaced);

	return { placed, unresolved, iterations, leaders };
}
