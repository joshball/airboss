/**
 * Pip-along-polyline primitive: walk a screen-space polyline at fixed
 * pixel spacing, place glyphs (triangles or semicircles) perpendicular
 * to the segment direction, choose the side via screen-space cardinal
 * target.
 *
 * This is the core symbol-placement helper for fronts (cold/warm/
 * occluded/stationary), and is reusable for jet-stream chevrons,
 * trough-line markers, ridge axis markers, dryline scallops, etc.
 *
 * Cardinal-side reasoning (per Spike 01 notes): "north pips face north"
 * holds globally even on curved fronts when we resolve the perpendicular
 * via dot product against a screen-space target vector. A
 * `+1 / -1` "left/right of motion" parameter is easy to flip wrong.
 *
 * Browser-safe: pure math + string emission, no Node imports.
 *
 * Ported from `spikes/wx-charts/01-surface-analysis/src/symbology.ts`
 * (the `renderPips` function), generalized to accept any pip spacing,
 * radius, color, and shape per call.
 */

export type PipShape = 'triangle' | 'semicircle';
export type ScreenVec = readonly [number, number];

export interface PipDef {
	shape: PipShape;
	color: string;
	/** Spacing between pips along the polyline, in pixels. */
	spacingPx?: number;
	/** Pip radius (height for triangles, semicircle radius for arcs), in pixels. */
	radiusPx?: number;
	/** Distance to push the first pip past the polyline start, in pixels. */
	startOffsetPx?: number;
	/**
	 * Screen-space target vector. The pip is placed on the side of the
	 * polyline whose perpendicular has the larger dot product against
	 * this vector. Y axis points down (screen coords).
	 */
	targetSide: ScreenVec;
}

const DEFAULT_SPACING = 28;
const DEFAULT_RADIUS = 7;

interface Segment {
	len: number;
	ax: number;
	ay: number;
	bx: number;
	by: number;
}

function buildSegments(pts: readonly (readonly [number, number])[]): { segments: Segment[]; total: number } {
	const segments: Segment[] = [];
	let total = 0;
	for (let i = 0; i < pts.length - 1; i++) {
		const [ax, ay] = pts[i];
		const [bx, by] = pts[i + 1];
		const len = Math.hypot(bx - ax, by - ay);
		segments.push({ len, ax, ay, bx, by });
		total += len;
	}
	return { segments, total };
}

function walkAlong(
	segments: readonly Segment[],
	dist: number,
): { x: number; y: number; dx: number; dy: number } | null {
	let remaining = dist;
	for (const seg of segments) {
		if (remaining <= seg.len) {
			const t = seg.len === 0 ? 0 : remaining / seg.len;
			return {
				x: seg.ax + t * (seg.bx - seg.ax),
				y: seg.ay + t * (seg.by - seg.ay),
				dx: seg.bx - seg.ax,
				dy: seg.by - seg.ay,
			};
		}
		remaining -= seg.len;
	}
	return null;
}

/**
 * Render pip glyphs along a screen-space polyline.
 * Returns the inner SVG fragment (no wrapping `<g>`); the caller wraps
 * it inside the appropriate symbology layer band.
 */
export function renderPolylinePips(pts: readonly (readonly [number, number])[], pip: PipDef): string {
	const spacing = pip.spacingPx ?? DEFAULT_SPACING;
	const radius = pip.radiusPx ?? DEFAULT_RADIUS;
	const startOffset = pip.startOffsetPx ?? 0;

	const { segments, total } = buildSegments(pts);
	if (total === 0) return '';

	const glyphs: string[] = [];
	for (let dist = startOffset + spacing / 2; dist < total; dist += spacing * 2) {
		const place = walkAlong(segments, dist);
		if (place === null) continue;
		const { x, y, dx, dy } = place;
		const len = Math.hypot(dx, dy) || 1;
		const perp1: ScreenVec = [-dy / len, dx / len];
		const perp2: ScreenVec = [dy / len, -dx / len];
		const dot1 = perp1[0] * pip.targetSide[0] + perp1[1] * pip.targetSide[1];
		const dot2 = perp2[0] * pip.targetSide[0] + perp2[1] * pip.targetSide[1];
		const [px, py] = dot1 >= dot2 ? perp1 : perp2;
		const tx = dx / len;
		const ty = dy / len;

		if (pip.shape === 'triangle') {
			const apex: [number, number] = [x + px * radius * 1.4, y + py * radius * 1.4];
			const baseHalf = radius * 0.9;
			const base1: [number, number] = [x - tx * baseHalf, y - ty * baseHalf];
			const base2: [number, number] = [x + tx * baseHalf, y + ty * baseHalf];
			glyphs.push(
				`<path d="M ${base1[0].toFixed(1)} ${base1[1].toFixed(1)} L ${apex[0].toFixed(1)} ${apex[1].toFixed(1)} L ${base2[0].toFixed(1)} ${base2[1].toFixed(1)} Z" fill="${pip.color}" stroke="${pip.color}" stroke-width="0.5" stroke-linejoin="round" />`,
			);
		} else {
			// Semicircle: pick SVG arc sweep flag that bulges toward (px, py).
			// In screen coords (Y-down), sweep-flag 1 bulges to the RIGHT of
			// motion, i.e. the side where cross < 0 (cross = tx*py - ty*px).
			const cross = tx * py - ty * px;
			const sweepFlag = cross < 0 ? 1 : 0;
			const a: [number, number] = [x - tx * radius, y - ty * radius];
			const b: [number, number] = [x + tx * radius, y + ty * radius];
			glyphs.push(
				`<path d="M ${a[0].toFixed(1)} ${a[1].toFixed(1)} A ${radius} ${radius} 0 0 ${sweepFlag} ${b[0].toFixed(1)} ${b[1].toFixed(1)} Z" fill="${pip.color}" stroke="${pip.color}" stroke-width="0.5" stroke-linejoin="round" />`,
			);
		}
	}
	return glyphs.join('\n');
}
