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
import { renderStations } from './stations';

export function renderSymbology(projection: GeoProjection, data: SurfaceAnalysisData): string {
	return [
		renderIsobars(projection, data),
		renderFronts(projection, data.fronts),
		renderStations(projection, data.stations ?? []),
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

	// Cardinal direction -> screen-space target vector for pip side.
	// Y axis points down in screen coords.
	const cardinalToScreen: Record<NonNullable<Front['pipSide']>, [number, number]> = {
		N: [0, -1],
		S: [0, 1],
		E: [1, 0],
		W: [-1, 0],
	};

	const defaultPipSide: Record<Front['kind'], NonNullable<Front['pipSide']>> = {
		cold: 'S', // cold front bulges south/southeast typically
		warm: 'N', // warm front bulges north (toward cold air being displaced)
		occluded: 'N',
		stationary: 'N',
	};
	const target = cardinalToScreen[front.pipSide ?? defaultPipSide[front.kind]];

	switch (front.kind) {
		case 'cold':
			return renderColdFront(linePath, pts, target);
		case 'warm':
			return renderWarmFront(linePath, pts, target);
		case 'occluded':
			return renderOccludedFront(linePath, pts, target);
		case 'stationary':
			return renderStationaryFront(linePath, pts, target);
		default:
			return '';
	}
}

type ScreenVec = [number, number];

function renderColdFront(linePath: string, pts: [number, number][], target: ScreenVec): string {
	const pips = renderPips(pts, 'triangle', '#1f4ea8', 0, target);
	return `<g class="front-cold">
  <path d="${linePath}" fill="none" stroke="#1f4ea8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
  ${pips}
</g>`;
}

function renderWarmFront(linePath: string, pts: [number, number][], target: ScreenVec): string {
	const pips = renderPips(pts, 'semicircle', '#b8232f', 0, target);
	return `<g class="front-warm">
  <path d="${linePath}" fill="none" stroke="#b8232f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
  ${pips}
</g>`;
}

function renderOccludedFront(linePath: string, pts: [number, number][], target: ScreenVec): string {
	// Alternating triangles + semicircles, all on the same side, purple.
	const triangles = renderPips(pts, 'triangle', '#6a1f8f', 0, target);
	const semis = renderPips(pts, 'semicircle', '#6a1f8f', FRONT_PIP_SPACING_PX, target);
	return `<g class="front-occluded">
  <path d="${linePath}" fill="none" stroke="#6a1f8f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
  ${triangles}
  ${semis}
</g>`;
}

function renderStationaryFront(linePath: string, pts: [number, number][], target: ScreenVec): string {
	// Triangles (blue, cold-side) on the chosen target side; semicircles
	// (red, warm-side) on the opposite side, offset by pipSpacing.
	const oppTarget: ScreenVec = [-target[0], -target[1]];
	const triangles = renderPips(pts, 'triangle', '#1f4ea8', 0, target);
	const semis = renderPips(pts, 'semicircle', '#b8232f', FRONT_PIP_SPACING_PX, oppTarget);
	return `<g class="front-stationary">
  <path d="${linePath}" fill="none" stroke="#1f4ea8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${FRONT_PIP_SPACING_PX} ${FRONT_PIP_SPACING_PX}" />
  <path d="${linePath}" fill="none" stroke="#b8232f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${FRONT_PIP_SPACING_PX} ${FRONT_PIP_SPACING_PX}" stroke-dashoffset="${FRONT_PIP_SPACING_PX}" />
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
 * `targetScreen`: a screen-space vector indicating which side to place
 * the pip on. For each segment, we compute the two perpendicular unit
 * vectors and pick the one with positive dot product against the target.
 * This makes "north pips face north" hold globally, even on curved fronts.
 */
function renderPips(
	pts: [number, number][],
	shape: 'triangle' | 'semicircle',
	color: string,
	startOffset = 0,
	targetScreen: ScreenVec = [0, -1],
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
		const len = Math.hypot(dx, dy) || 1;
		// Two candidate perpendicular unit vectors.
		const perp1: ScreenVec = [-dy / len, dx / len];
		const perp2: ScreenVec = [dy / len, -dx / len];
		// Pick the one with larger dot product against target.
		const dot1 = perp1[0] * targetScreen[0] + perp1[1] * targetScreen[1];
		const dot2 = perp2[0] * targetScreen[0] + perp2[1] * targetScreen[1];
		const [px, py] = dot1 >= dot2 ? perp1 : perp2;
		const tx = dx / len;
		const ty = dy / len;

		if (shape === 'triangle') {
			const apex: [number, number] = [x + px * FRONT_PIP_RADIUS * 1.4, y + py * FRONT_PIP_RADIUS * 1.4];
			const baseHalf = FRONT_PIP_RADIUS * 0.9;
			const base1: [number, number] = [x - tx * baseHalf, y - ty * baseHalf];
			const base2: [number, number] = [x + tx * baseHalf, y + ty * baseHalf];
			glyphs.push(
				`<path d="M ${base1[0].toFixed(1)} ${base1[1].toFixed(1)} L ${apex[0].toFixed(1)} ${apex[1].toFixed(1)} L ${base2[0].toFixed(1)} ${base2[1].toFixed(1)} Z" fill="${color}" stroke="${color}" stroke-width="0.5" stroke-linejoin="round" />`,
			);
		} else {
			// Semicircle. Pick the SVG arc sweep flag that bulges toward (px, py).
			// Cross product of segment-tangent x perpendicular tells us
			// whether the perpendicular is "left" or "right" of the segment
			// in screen coords (Y-down). cross = tx*py - ty*px.
			// For SVG arc with sweep-flag 1 (clockwise), the arc bulges to
			// the LEFT of the segment direction in standard math (Y-up); in
			// screen coords (Y-down) sweep-flag 1 bulges to the RIGHT of
			// motion, i.e. into the perpendicular where cross < 0.
			const cross = tx * py - ty * px;
			const sweepFlag = cross < 0 ? 1 : 0;
			const r = FRONT_PIP_RADIUS;
			const a: [number, number] = [x - tx * r, y - ty * r];
			const b: [number, number] = [x + tx * r, y + ty * r];
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
