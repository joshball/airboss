/**
 * Legend renderer for category / scale / ramp legends.
 *
 * v1 supports a categorical legend (color swatch + label rows) used by
 * convective outlook tiers, advisory types, and flight-category surfaces.
 * Continuous-ramp legends (NWS reflectivity, IR satellite) extend this
 * shape in Phase B.
 *
 * Browser-safe: pure SVG-string emission.
 */

export interface LegendEntry {
	color: string;
	label: string;
}

export interface LegendDef {
	/** Top-left anchor of the legend box, in screen coords. */
	x: number;
	y: number;
	entries: readonly LegendEntry[];
	title?: string;
	/** Row height in pixels. Defaults to 16. */
	rowHeightPx?: number;
	/** Swatch width in pixels. Defaults to 18. */
	swatchWidthPx?: number;
}

const DEFAULT_ROW = 16;
const DEFAULT_SWATCH = 18;

export function renderLegend(def: LegendDef): string {
	const rowHeight = def.rowHeightPx ?? DEFAULT_ROW;
	const swatchWidth = def.swatchWidthPx ?? DEFAULT_SWATCH;

	const titleFragment =
		def.title !== undefined && def.title.length > 0
			? `<text x="${def.x.toFixed(1)}" y="${(def.y + 11).toFixed(1)}" font-size="10" font-weight="700" fill="#3d3a32">${def.title}</text>`
			: '';
	const titleOffset = def.title !== undefined && def.title.length > 0 ? rowHeight : 0;

	const rows = def.entries.map((entry, i) => {
		const rowY = def.y + titleOffset + i * rowHeight;
		const swatchX = def.x;
		const swatchY = rowY;
		const labelX = def.x + swatchWidth + 6;
		const labelY = rowY + rowHeight - 5;
		return `<g class="legend-entry">
    <rect x="${swatchX.toFixed(1)}" y="${swatchY.toFixed(1)}" width="${swatchWidth}" height="${(rowHeight - 4).toFixed(1)}" fill="${entry.color}" stroke="#3d3a32" stroke-width="0.4" />
    <text x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" font-size="10" fill="#3d3a32">${entry.label}</text>
  </g>`;
	});

	return `<g class="legend">
  ${titleFragment}
  ${rows.join('\n')}
</g>`;
}
