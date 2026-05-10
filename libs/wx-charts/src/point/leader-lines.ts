/**
 * Leader-line renderer for displaced collision-resolved points.
 *
 * Each entry in `displaced` carries an original anchor + a placed
 * position; we emit a thin dashed line from the original anchor to the
 * placed position so a learner can trace the displacement back to the
 * true coords. Used by METAR / PIREP plot grid charts (Phase C).
 *
 * Browser-safe: pure SVG-string emission, no Node imports.
 */

import type { PlacedPoint } from './collision';

export interface LeaderLineOptions {
	stroke?: string;
	strokeWidth?: number;
	dashArray?: string;
}

const DEFAULT_STROKE = '#a09b8d';
const DEFAULT_STROKE_WIDTH = 0.6;
const DEFAULT_DASH = '2 2';

/**
 * Emit one `<line>` per displaced point, from its original (lon/lat -
 * projected) anchor to its placed (post-collision) position.
 */
export function renderLeaderLines(displaced: readonly PlacedPoint[], options: LeaderLineOptions = {}): string {
	const stroke = options.stroke ?? DEFAULT_STROKE;
	const strokeWidth = options.strokeWidth ?? DEFAULT_STROKE_WIDTH;
	const dashArray = options.dashArray ?? DEFAULT_DASH;

	if (displaced.length === 0) return '';

	const lines = displaced.map((p) => {
		const x1 = p.originalX.toFixed(2);
		const y1 = p.originalY.toFixed(2);
		const x2 = p.x.toFixed(2);
		const y2 = p.y.toFixed(2);
		return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-dasharray="${dashArray}" data-leader-for="${p.id}" />`;
	});
	return lines.join('\n');
}
