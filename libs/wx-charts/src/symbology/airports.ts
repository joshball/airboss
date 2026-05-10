/**
 * Airport marker renderer.
 *
 * Used by Phase D charts (GFA TAF panels) and the substrate's optional
 * airport overlay. A single airport renders as a small filled square
 * (FAA convention for a "primary" airport on a chart) with a label to
 * the upper-right.
 *
 * Browser-safe: pure SVG-string emission.
 */

export interface AirportMarker {
	id: string;
	/** Screen-space coordinates of the marker (caller projects lon/lat). */
	x: number;
	y: number;
	label?: string;
	/** Marker size in pixels (square edge length). Defaults to 4. */
	sizePx?: number;
	/** Marker fill color. Defaults to FAA dark teal. */
	fill?: string;
	/** Label font size. Defaults to 9 px. */
	labelFontSize?: number;
}

const DEFAULT_FILL = '#2a4a4a';
const DEFAULT_SIZE = 4;
const DEFAULT_LABEL_FONT = 9;

export function renderAirport(marker: AirportMarker): string {
	const size = marker.sizePx ?? DEFAULT_SIZE;
	const fill = marker.fill ?? DEFAULT_FILL;
	const labelFontSize = marker.labelFontSize ?? DEFAULT_LABEL_FONT;
	const half = size / 2;
	const x = marker.x - half;
	const y = marker.y - half;
	const labelStr = marker.label ?? marker.id;
	const labelFragment =
		labelStr.length > 0
			? `<text x="${(marker.x + size).toFixed(1)}" y="${(marker.y - 2).toFixed(1)}" font-size="${labelFontSize}" font-weight="600" fill="#3d3a32">${labelStr}</text>`
			: '';
	return `<g class="airport-marker" data-id="${marker.id}">
  <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${size}" height="${size}" fill="${fill}" stroke="none" />
  ${labelFragment}
</g>`;
}
