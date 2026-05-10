/**
 * Generic polygon overlay primitive for advisory + outlook charts.
 *
 * One reusable family of helpers covers AIRMET / SIGMET polygons (Phase
 * B) and forms the substrate the convective outlook + GFA cluster will
 * compose against in later phases. Each polygon is rendered as one or
 * more SVG `<path>` elements with chart-author-controlled stroke + fill
 * + dasharray, plus an optional centred text label.
 *
 * Browser-safe: pure SVG-string emission (no Node imports). Callers
 * project lon/lat to screen coords before calling these helpers.
 */

import type { GeoProjection } from 'd3-geo';

/**
 * One polygon ring in geographic (lon/lat) coords. The renderer projects
 * to screen coords. Rings are explicit so callers can build multi-part
 * polygons (a single advisory bounded by multiple disjoint regions).
 */
export type PolygonRing = ReadonlyArray<readonly [number, number]>;

export interface PolygonStyle {
	/** Stroke colour (CSS hex / named colour). */
	stroke: string;
	/** Fill colour. Use 'none' to skip the fill. */
	fill: string;
	/** Fill opacity in [0, 1]. Defaults to 0.25. */
	fillOpacity?: number;
	/** Stroke width in pixels. Defaults to 1.4. */
	strokeWidth?: number;
	/** Optional dasharray (e.g. '6 4'). */
	dasharray?: string;
	/** Optional thunderstorm glyph repetition along the boundary (Convective SIGMET). */
	thunderstormGlyph?: boolean;
}

export interface PolygonLabel {
	/** Label text (multiline -- newlines split into separate <tspan> rows). */
	text: string;
	/** Font size in pixels. Defaults to 10. */
	fontSize?: number;
	/** Label fill colour. Defaults to #3d3a32. */
	color?: string;
	/** Background halo colour. Defaults to white. */
	haloColor?: string;
}

export interface PolygonOverlay {
	/** Stable id for SVG `data-id` (used by tests + selectors). */
	id: string;
	/** One or more rings; the first is the outer boundary. */
	rings: ReadonlyArray<PolygonRing>;
	style: PolygonStyle;
	label?: PolygonLabel;
	/**
	 * Optional pre-computed centroid in lon/lat. When omitted, the
	 * label is placed at the centroid of the outer ring's projected
	 * vertices (simple arithmetic mean -- good enough for advisory
	 * polygons that are roughly convex).
	 */
	labelLonLat?: readonly [number, number];
	/** Optional CSS class suffix appended to the wrapper `<g>`. */
	classSuffix?: string;
}

export interface RenderPolygonOverlaysOptions {
	projection: GeoProjection;
}

/**
 * Render a list of polygon overlays into a single SVG fragment. Each
 * overlay becomes one `<g class="polygon-overlay polygon-{classSuffix}">`
 * containing its boundary `<path>` and (optionally) its label.
 */
export function renderPolygonOverlays(
	overlays: ReadonlyArray<PolygonOverlay>,
	options: RenderPolygonOverlaysOptions,
): string {
	const projection = options.projection;
	const fragments: string[] = [];
	for (const overlay of overlays) {
		const projectedRings = overlay.rings
			.map((ring) =>
				ring
					.map((p) => projection([p[0], p[1]]))
					.filter((p): p is [number, number] => p !== null && Number.isFinite(p[0]) && Number.isFinite(p[1])),
			)
			.filter((ring) => ring.length >= 3);
		if (projectedRings.length === 0) continue;

		const d = projectedRings
			.map((ring) => {
				const head = `M ${ring[0][0].toFixed(1)} ${ring[0][1].toFixed(1)}`;
				const tail = ring
					.slice(1)
					.map((p) => `L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
					.join(' ');
				return `${head} ${tail} Z`;
			})
			.join(' ');

		const fillOpacity = overlay.style.fillOpacity ?? 0.25;
		const strokeWidth = overlay.style.strokeWidth ?? 1.4;
		const dasharrayAttr = overlay.style.dasharray !== undefined ? ` stroke-dasharray="${overlay.style.dasharray}"` : '';
		const fillAttr =
			overlay.style.fill === 'none' ? ' fill="none"' : ` fill="${overlay.style.fill}" fill-opacity="${fillOpacity}"`;

		const thunderstorm = overlay.style.thunderstormGlyph === true ? renderThunderstormGlyphs(projectedRings[0]) : '';

		const labelFragment =
			overlay.label !== undefined
				? renderPolygonLabel(overlay.label, computeLabelXY(overlay, projection, projectedRings[0]))
				: '';

		const classSuffix = overlay.classSuffix !== undefined ? ` polygon-${overlay.classSuffix}` : '';
		fragments.push(
			`<g class="polygon-overlay${classSuffix}" data-id="${overlay.id}">
  <path d="${d}"${fillAttr} stroke="${overlay.style.stroke}" stroke-width="${strokeWidth.toFixed(1)}"${dasharrayAttr} stroke-linejoin="round" />
  ${thunderstorm}
  ${labelFragment}
</g>`,
		);
	}
	return fragments.join('\n');
}

function computeLabelXY(
	overlay: PolygonOverlay,
	projection: GeoProjection,
	projectedRing: ReadonlyArray<readonly [number, number]>,
): [number, number] {
	if (overlay.labelLonLat !== undefined) {
		const projected = projection([overlay.labelLonLat[0], overlay.labelLonLat[1]]);
		if (projected !== null && Number.isFinite(projected[0]) && Number.isFinite(projected[1])) {
			return projected;
		}
	}
	let sumX = 0;
	let sumY = 0;
	for (const p of projectedRing) {
		sumX += p[0];
		sumY += p[1];
	}
	return [sumX / projectedRing.length, sumY / projectedRing.length];
}

function renderPolygonLabel(label: PolygonLabel, xy: readonly [number, number]): string {
	const fontSize = label.fontSize ?? 10;
	const color = label.color ?? '#3d3a32';
	const halo = label.haloColor ?? 'white';
	const lines = label.text.split('\n');
	const lineHeight = fontSize + 2;
	const startY = xy[1] - ((lines.length - 1) / 2) * lineHeight;
	const tspans = lines
		.map(
			(line, i) =>
				`<tspan x="${xy[0].toFixed(1)}" y="${(startY + i * lineHeight).toFixed(1)}">${escapeXml(line)}</tspan>`,
		)
		.join('');
	// Halo + text pattern keeps labels readable over coloured fill.
	return `<text text-anchor="middle" font-size="${fontSize}" font-weight="600" fill="${color}"
        stroke="${halo}" stroke-width="${(fontSize * 0.4).toFixed(1)}" stroke-linejoin="round" paint-order="stroke">${tspans}</text>
<text text-anchor="middle" font-size="${fontSize}" font-weight="600" fill="${color}">${tspans}</text>`;
}

/**
 * Place small thunderstorm "T" glyphs at sample points along the outer
 * ring of a Convective SIGMET polygon. Visual only; not interactive.
 */
function renderThunderstormGlyphs(projectedRing: ReadonlyArray<readonly [number, number]>): string {
	const samples: Array<[number, number]> = [];
	const step = Math.max(1, Math.floor(projectedRing.length / 4));
	for (let i = 0; i < projectedRing.length; i += step) {
		samples.push([projectedRing[i][0], projectedRing[i][1]]);
		if (samples.length >= 4) break;
	}
	const out: string[] = [];
	for (const [x, y] of samples) {
		out.push(
			`<g class="tstm-glyph" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
    <text x="0" y="0" font-size="11" font-weight="800" fill="#7a0000" text-anchor="middle">TSTM</text>
  </g>`,
		);
	}
	return out.join('\n');
}

function escapeXml(value: string): string {
	return value.replace(/[&<>"']/g, (c) => {
		switch (c) {
			case '&':
				return '&amp;';
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '"':
				return '&quot;';
			case "'":
				return '&apos;';
			default:
				return c;
		}
	});
}
