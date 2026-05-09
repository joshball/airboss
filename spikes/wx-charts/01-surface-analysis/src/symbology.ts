/**
 * Symbology renderers: pressure centers, fronts, isobars.
 *
 * All emit SVG strings. Each renderer is a candidate primitive for the
 * production symbology library; intentionally pure (projection in,
 * string out) so they're testable.
 */

import type { GeoProjection } from 'd3-geo';
import type { Front, PressureCenter, SurfaceAnalysisData } from './data-load';
import { renderIsobars } from './isobars';

export function renderSymbology(projection: GeoProjection, data: SurfaceAnalysisData): string {
	return [
		renderIsobars(projection, data),
		renderFronts(projection, data.fronts),
		renderPressureCenters(projection, data.centers),
	].join('\n');
}

// --- Pressure centers (Hi/Lo) ---

function renderPressureCenters(projection: GeoProjection, centers: PressureCenter[]): string {
	const items = centers.map((c) => {
		const pos = projection([c.lon, c.lat]);
		if (!pos) return '';
		const [x, y] = pos;
		const fill = c.kind === 'H' ? '#1f4ea8' : '#b8232f';
		const label = c.kind === 'H' ? 'H' : 'L';
		return `
  <g class="center-${c.kind}">
    <text x="${x}" y="${y - 4}" text-anchor="middle" font-size="28" font-weight="700" fill="${fill}">${label}</text>
    <text x="${x}" y="${y + 14}" text-anchor="middle" font-size="11" font-weight="600" fill="${fill}">${c.pressureMb}</text>
  </g>`;
	});
	return `<g class="pressure-centers">${items.join('')}</g>`;
}

// --- Fronts ---

const FRONT_PIP_SPACING_PX = 28;
const FRONT_PIP_RADIUS = 7;

function renderFronts(projection: GeoProjection, fronts: Front[]): string {
	return `<g class="fronts">${fronts.map((f) => renderFront(projection, f)).join('\n')}</g>`;
}

function renderFront(projection: GeoProjection, front: Front): string {
	const pts = front.points
		.map((p) => projection(p))
		.filter((p): p is [number, number] => p !== null && !Number.isNaN(p[0]));
	if (pts.length < 2) return '';
	const linePath = polylineToPath(pts);

	switch (front.kind) {
		case 'cold':
			return renderColdFront(linePath, pts);
		case 'warm':
			return renderWarmFront(linePath, pts);
		case 'occluded':
			return renderOccludedFront(linePath, pts);
		case 'stationary':
			return renderStationaryFront(linePath, pts);
		default:
			return '';
	}
}

function renderColdFront(linePath: string, pts: [number, number][]): string {
	const pips = renderPips(pts, 'triangle', '#1f4ea8', 'forward');
	return `<g class="front-cold">
  <path d="${linePath}" fill="none" stroke="#1f4ea8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
  ${pips}
</g>`;
}

function renderWarmFront(linePath: string, pts: [number, number][]): string {
	const pips = renderPips(pts, 'semicircle', '#b8232f', 'forward');
	return `<g class="front-warm">
  <path d="${linePath}" fill="none" stroke="#b8232f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
  ${pips}
</g>`;
}

function renderOccludedFront(linePath: string, pts: [number, number][]): string {
	// Alternating triangles + semicircles, all on the same side, purple.
	const triangles = renderPips(pts, 'triangle', '#6a1f8f', 'forward', 0);
	const semis = renderPips(pts, 'semicircle', '#6a1f8f', 'forward', FRONT_PIP_SPACING_PX);
	return `<g class="front-occluded">
  <path d="${linePath}" fill="none" stroke="#6a1f8f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
  ${triangles}
  ${semis}
</g>`;
}

function renderStationaryFront(linePath: string, pts: [number, number][]): string {
	// Triangles on one side (blue, "cold" side), semicircles on the
	// opposite side (red, "warm" side).
	const triangles = renderPips(pts, 'triangle', '#1f4ea8', 'forward', 0, +1);
	const semis = renderPips(pts, 'semicircle', '#b8232f', 'forward', FRONT_PIP_SPACING_PX, -1);
	return `<g class="front-stationary">
  <path d="${linePath}" fill="none" stroke="#1f4ea8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
  <path d="${linePath}" fill="none" stroke="#b8232f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="0" opacity="0" />
  ${triangles}
  ${semis}
</g>`;
}

function polylineToPath(pts: [number, number][]): string {
	return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
}

/**
 * Walk along the polyline at fixed pixel spacing, placing pip glyphs
 * (triangles or semicircles) perpendicular to the segment direction.
 *
 * `side`: +1 for left of motion, -1 for right of motion.
 *   FAA convention: cold/warm pips go in the direction of motion
 *   (both "forward"); we put the glyph on the +1 side by default.
 */
function renderPips(
	pts: [number, number][],
	shape: 'triangle' | 'semicircle',
	color: string,
	_facing: 'forward',
	startOffset = 0,
	side: 1 | -1 = 1,
): string {
	const segments: { len: number; ax: number; ay: number; bx: number; by: number }[] = [];
	let total = 0;
	for (let i = 0; i < pts.length - 1; i++) {
		const [ax, ay] = pts[i];
		const [bx, by] = pts[i + 1];
		const len = Math.hypot(bx - ax, by - ay);
		segments.push({ len, ax, ay, bx, by });
		total += len;
	}
	if (total === 0) return '';

	const glyphs: string[] = [];
	for (let dist = startOffset + FRONT_PIP_SPACING_PX / 2; dist < total; dist += FRONT_PIP_SPACING_PX * 2) {
		const place = walkAlong(segments, dist);
		if (!place) continue;
		const { x, y, dx, dy } = place;
		// perpendicular unit vector on chosen side
		const len = Math.hypot(dx, dy) || 1;
		const px = (-dy / len) * side;
		const py = (dx / len) * side;
		// position glyph centered on (x,y) sitting on top of line, on the chosen side
		if (shape === 'triangle') {
			// Equilateral-ish triangle. Apex on the perpendicular side.
			const apex: [number, number] = [x + px * FRONT_PIP_RADIUS * 1.4, y + py * FRONT_PIP_RADIUS * 1.4];
			const tx = dx / len;
			const ty = dy / len;
			const baseHalf = FRONT_PIP_RADIUS * 0.9;
			const base1: [number, number] = [x - tx * baseHalf, y - ty * baseHalf];
			const base2: [number, number] = [x + tx * baseHalf, y + ty * baseHalf];
			glyphs.push(
				`<path d="M ${base1[0].toFixed(1)} ${base1[1].toFixed(1)} L ${apex[0].toFixed(1)} ${apex[1].toFixed(1)} L ${base2[0].toFixed(1)} ${base2[1].toFixed(1)} Z" fill="${color}" stroke="${color}" stroke-width="0.5" stroke-linejoin="round" />`,
			);
		} else {
			// Semicircle: use SVG arc. Diameter sits along the line, bulge points perpendicular.
			const tx = dx / len;
			const ty = dy / len;
			const r = FRONT_PIP_RADIUS;
			const a: [number, number] = [x - tx * r, y - ty * r];
			const b: [number, number] = [x + tx * r, y + ty * r];
			// Sweep flag: 1 for the side where +perpendicular points.
			// We bulge toward (px,py); for SVG arc, sweep-flag 1 = clockwise,
			// which depends on direction. Easier: emit two arcs and pick. Here
			// we compute via cross product.
			const sweepFlag = side === 1 ? 0 : 1;
			glyphs.push(
				`<path d="M ${a[0].toFixed(1)} ${a[1].toFixed(1)} A ${r} ${r} 0 0 ${sweepFlag} ${b[0].toFixed(1)} ${b[1].toFixed(1)} Z" fill="${color}" stroke="${color}" stroke-width="0.5" stroke-linejoin="round" />`,
			);
		}
	}
	return glyphs.join('\n');
}

function walkAlong(
	segments: { len: number; ax: number; ay: number; bx: number; by: number }[],
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
