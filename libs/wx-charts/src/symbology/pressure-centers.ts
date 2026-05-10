/**
 * High / Low pressure-center markers.
 *
 * Renders a large `H` (blue) or `L` (red) glyph at the projected
 * coordinates plus a smaller pressure-millibar value beneath.
 *
 * Browser-safe: pure SVG-string emission.
 *
 * Ported from `spikes/wx-charts/01-surface-analysis/src/symbology.ts`
 * (`renderPressureCenters`).
 */

export interface PressureCenter {
	kind: 'H' | 'L';
	/** Screen-space coordinates of the marker (caller projects lon/lat). */
	x: number;
	y: number;
	pressureMb: number;
}

const HIGH_BLUE = '#1f4ea8';
const LOW_RED = '#b8232f';

export function renderPressureCenter(center: PressureCenter): string {
	const fill = center.kind === 'H' ? HIGH_BLUE : LOW_RED;
	const label = center.kind === 'H' ? 'H' : 'L';
	return `<g class="pressure-center pressure-center-${center.kind}">
  <text x="${center.x.toFixed(1)}" y="${(center.y - 4).toFixed(1)}" text-anchor="middle" font-size="28" font-weight="700" fill="${fill}">${label}</text>
  <text x="${center.x.toFixed(1)}" y="${(center.y + 14).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="600" fill="${fill}">${center.pressureMb}</text>
</g>`;
}
