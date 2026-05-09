/**
 * Glyph collision avoidance for the dense-station-model layer.
 *
 * Strategy: simple iterative pairwise repulsion. Each station's glyph
 * has an effective "occupied disc" radius; if two glyphs are within
 * 2*radius of each other, both get pushed apart along their connecting
 * vector. We iterate ~30 passes; usually converges in <10 for the
 * Northeast cluster.
 *
 * After displacement we draw a thin leader line from each displaced
 * glyph's drawing position back to its original (true geographic)
 * position so the reader can still associate a glyph with its station.
 *
 * This is a simple scope-cut spike implementation. A production version
 * would either:
 *  - use a force-directed layout library (d3-force) that handles 100+
 *    stations with nicer convergence
 *  - density-tier the station list (drop secondary stations in dense
 *    clusters at small zoom levels)
 *  - draw a "smart leader" that elbows around adjacent glyphs
 */

export interface PlacedGlyph {
	stationKey: string;
	trueX: number;
	trueY: number;
	drawX: number;
	drawY: number;
	displaced: boolean;
}

export interface CollisionConfig {
	minDistance: number; // px
	maxIterations: number;
	jitterEpsilon: number; // px, to break perfectly-stacked positions
}

const DEFAULT_CONFIG: CollisionConfig = {
	minDistance: 36,
	maxIterations: 40,
	jitterEpsilon: 0.3,
};

export function resolveCollisions(
	inputs: ReadonlyArray<{ stationKey: string; x: number; y: number }>,
	config: Partial<CollisionConfig> = {},
): PlacedGlyph[] {
	const cfg = { ...DEFAULT_CONFIG, ...config };
	const placed: PlacedGlyph[] = inputs.map((p) => ({
		stationKey: p.stationKey,
		trueX: p.x,
		trueY: p.y,
		drawX: p.x,
		drawY: p.y,
		displaced: false,
	}));

	for (let iter = 0; iter < cfg.maxIterations; iter += 1) {
		let moved = false;
		for (let i = 0; i < placed.length; i += 1) {
			for (let j = i + 1; j < placed.length; j += 1) {
				const a = placed[i];
				const b = placed[j];
				const dx = b.drawX - a.drawX;
				const dy = b.drawY - a.drawY;
				let d = Math.sqrt(dx * dx + dy * dy);
				if (d > cfg.minDistance) continue;
				if (d === 0) {
					// Identical positions -- jitter
					const angle = Math.random() * Math.PI * 2;
					const ex = Math.cos(angle) * cfg.jitterEpsilon;
					const ey = Math.sin(angle) * cfg.jitterEpsilon;
					a.drawX -= ex;
					a.drawY -= ey;
					b.drawX += ex;
					b.drawY += ey;
					d = cfg.jitterEpsilon * 2;
				}
				const overlap = cfg.minDistance - d;
				const nx = dx / d;
				const ny = dy / d;
				const push = overlap / 2 + 0.1;
				a.drawX -= nx * push;
				a.drawY -= ny * push;
				b.drawX += nx * push;
				b.drawY += ny * push;
				moved = true;
			}
		}
		if (!moved) break;
	}

	for (const p of placed) {
		const dx = p.drawX - p.trueX;
		const dy = p.drawY - p.trueY;
		if (dx * dx + dy * dy > 0.5) p.displaced = true;
	}
	return placed;
}
