/**
 * Radar mosaic chart composer.
 *
 * Layer order (bottom to top):
 *   1. Background fill
 *   2. Lat/lon graticule (very pale)
 *   3. State fills (very pale)
 *   4. Interior state borders (thin gray)
 *   5. Outer coastline + Canada/Mexico borders (darker)
 *   6. WARPED RADAR RASTER via SVG <image>, alpha 0.78
 *   7. State borders re-stroked at low opacity above the raster, so
 *      cells don't completely hide them
 *   8. Major airports as small markers (visual landmarks for readers)
 *   9. Title band + reflectivity legend
 *
 * The radar layer is intentionally semi-transparent. A pure raster
 * overlay at full opacity would obliterate the basemap; at alpha 0.78
 * the colors stay legible while state outlines remain visible underneath.
 *
 * Pedagogical note (from the spike brief): leave the radar as a single
 * composable layer. Future overlays -- echo-intensity legend hover,
 * motion vectors, supercell markers, hail-core annotations -- attach
 * ABOVE the raster, not baked into it. The render order here makes
 * that trivial: insert new groups between layers 6 and 9.
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { geoPath, type GeoProjection } from 'd3-geo';
import { loadBasemap } from './basemap';
import { buildConusProjection, SVG_HEIGHT, SVG_WIDTH, TITLE_BAND_HEIGHT } from './projection';

const ROOT = resolve(import.meta.dir, '..');
const DATA = resolve(ROOT, 'data');

interface Airport {
	icao: string;
	lon: number;
	lat: number;
}

// Major hubs as visual landmarks. Not exhaustive -- 12 representative
// airports lets the viewer orient without cluttering the radar.
const AIRPORTS: readonly Airport[] = [
	{ icao: 'SEA', lon: -122.3088, lat: 47.4502 },
	{ icao: 'SFO', lon: -122.375, lat: 37.6189 },
	{ icao: 'LAX', lon: -118.4081, lat: 33.9416 },
	{ icao: 'PHX', lon: -112.0078, lat: 33.4342 },
	{ icao: 'DEN', lon: -104.6737, lat: 39.8617 },
	{ icao: 'DFW', lon: -97.0403, lat: 32.8998 },
	{ icao: 'IAH', lon: -95.3414, lat: 29.9844 },
	{ icao: 'MSP', lon: -93.2218, lat: 44.882 },
	{ icao: 'ORD', lon: -87.9048, lat: 41.9742 },
	{ icao: 'ATL', lon: -84.4277, lat: 33.6407 },
	{ icao: 'JFK', lon: -73.7781, lat: 40.6413 },
	{ icao: 'MIA', lon: -80.2906, lat: 25.7959 },
];

// NWS-style legend stops, matching the IEM PLTE indices 7..21.
// Each row: dBZ value, hex color, label-on-axis? (only labelled stops
// get a number drawn under them, to keep the bar from getting busy).
const LEGEND_STOPS: ReadonlyArray<{ dbz: number; hex: string; label: boolean }> = [
	{ dbz: 5, hex: '#00ECEC', label: true },
	{ dbz: 10, hex: '#01A0F6', label: false },
	{ dbz: 15, hex: '#0000F6', label: true },
	{ dbz: 20, hex: '#00FF00', label: false },
	{ dbz: 25, hex: '#00C800', label: true },
	{ dbz: 30, hex: '#009000', label: false },
	{ dbz: 35, hex: '#FFFF00', label: true },
	{ dbz: 40, hex: '#E7C000', label: false },
	{ dbz: 45, hex: '#FF9000', label: true },
	{ dbz: 50, hex: '#FF0000', label: false },
	{ dbz: 55, hex: '#D60000', label: true },
	{ dbz: 60, hex: '#C00000', label: false },
	{ dbz: 65, hex: '#FF00FF', label: true },
	{ dbz: 70, hex: '#9955C9', label: false },
	{ dbz: 75, hex: '#FFFFFF', label: true },
];

function renderGraticule(projection: GeoProjection): string {
	const path = geoPath(projection);
	const lines: string[] = [];
	for (let lon = -130; lon <= -65; lon += 10) {
		const coords: [number, number][] = [];
		for (let lat = 20; lat <= 55; lat += 1) coords.push([lon, lat]);
		const d = path({ type: 'LineString', coordinates: coords });
		if (d) lines.push(`<path d="${d}" fill="none" stroke="#e0ddd2" stroke-width="0.4" stroke-dasharray="2 3" />`);
	}
	for (let lat = 25; lat <= 50; lat += 5) {
		const coords: [number, number][] = [];
		for (let lon = -130; lon <= -65; lon += 1) coords.push([lon, lat]);
		const d = path({ type: 'LineString', coordinates: coords });
		if (d) lines.push(`<path d="${d}" fill="none" stroke="#e0ddd2" stroke-width="0.4" stroke-dasharray="2 3" />`);
	}
	return `<g class="graticule">\n${lines.join('\n')}\n</g>`;
}

function renderAirports(projection: GeoProjection): string {
	const out: string[] = [];
	for (const a of AIRPORTS) {
		const xy = projection([a.lon, a.lat]);
		if (!xy) continue;
		const [x, y] = xy;
		// Halo + dot + label. White stroke under the label keeps it legible
		// when it falls over a colored radar cell.
		out.push(
			`<g class="airport">
				<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="white" stroke="#3d3a32" stroke-width="0.8" />
				<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.6" fill="#3d3a32" />
				<text x="${(x + 7).toFixed(1)}" y="${(y - 5).toFixed(1)}" font-size="9" font-weight="600" fill="#3d3a32"
				      stroke="white" stroke-width="2.5" stroke-linejoin="round" paint-order="stroke">${a.icao}</text>
				<text x="${(x + 7).toFixed(1)}" y="${(y - 5).toFixed(1)}" font-size="9" font-weight="600" fill="#3d3a32">${a.icao}</text>
			</g>`,
		);
	}
	return `<g class="airports">\n${out.join('\n')}\n</g>`;
}

function renderTitle(): string {
	return `<g class="title">
		<rect x="0" y="0" width="${SVG_WIDTH}" height="${TITLE_BAND_HEIGHT}" fill="#fafaf7" />
		<line x1="0" y1="${TITLE_BAND_HEIGHT}" x2="${SVG_WIDTH}" y2="${TITLE_BAND_HEIGHT}" stroke="#d8d4c8" stroke-width="0.6" />
		<text x="24" y="26" font-size="16" font-weight="700" fill="#3d3a32" letter-spacing="1.2">RADAR MOSAIC</text>
		<text x="24" y="46" font-size="12" fill="#7a7568">2024-05-21 22:00Z  --  NEXRAD Composite Reflectivity (n0r, IEM archive)</text>
		<text x="${SVG_WIDTH - 24}" y="26" text-anchor="end" font-size="11" font-weight="600" fill="#7a7568">CONUS  --  Lambert Conformal 33/45</text>
		<text x="${SVG_WIDTH - 24}" y="46" text-anchor="end" font-size="11" fill="#a09b8d">spike prototype  --  not for ops use</text>
	</g>`;
}

function renderLegend(): string {
	// Positioned bottom-right inside the chart area.
	const W = 360;
	const H = 56;
	const x0 = SVG_WIDTH - 24 - W;
	const y0 = SVG_HEIGHT - 24 - H;
	const cellW = W / LEGEND_STOPS.length;
	const cells: string[] = [];
	for (let i = 0; i < LEGEND_STOPS.length; i += 1) {
		const stop = LEGEND_STOPS[i];
		const cx = x0 + i * cellW;
		cells.push(`<rect x="${cx.toFixed(1)}" y="${(y0 + 16).toFixed(1)}" width="${cellW.toFixed(2)}" height="14" fill="${stop.hex}" />`);
		if (stop.label) {
			cells.push(
				`<text x="${(cx + cellW / 2).toFixed(1)}" y="${(y0 + 44).toFixed(1)}" text-anchor="middle" font-size="9" fill="#3d3a32">${stop.dbz}</text>`,
			);
		}
	}
	return `<g class="legend">
		<rect x="${x0 - 10}" y="${y0 - 4}" width="${W + 20}" height="${H + 12}" fill="white" fill-opacity="0.92" stroke="#bdb9ac" stroke-width="0.6" rx="3" />
		<text x="${x0}" y="${y0 + 10}" font-size="10" font-weight="700" fill="#3d3a32" letter-spacing="0.6">REFLECTIVITY (dBZ)</text>
		${cells.join('\n		')}
	</g>`;
}

function main(): void {
	const basemap = loadBasemap(resolve(DATA, 'us-states-10m.json'));
	const projection = buildConusProjection(basemap.states);
	const path = geoPath(projection);

	// Diagnostic projection check (matches Spike 1's sanity output).
	const dca = projection([-77.0402, 38.8512]);
	const lax = projection([-118.4081, 33.9416]);
	console.log(`DCA -> ${dca?.[0].toFixed(1)}, ${dca?.[1].toFixed(1)}`);
	console.log(`LAX -> ${lax?.[0].toFixed(1)}, ${lax?.[1].toFixed(1)}`);

	// Embed warped radar PNG as a data URI. Full canvas extent because
	// the warp script wrote it at SVG_WIDTH x SVG_HEIGHT in projected
	// coordinates -- so x=0 y=0 is the chart top-left corner.
	const warpedBytes = readFileSync(resolve(DATA, 'n0r_202405212200.warped.png'));
	const warpedB64 = warpedBytes.toString('base64');

	const svgBody = [
		// 1. Background
		`<rect x="0" y="0" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#fafaf7" />`,

		// 2. Graticule
		renderGraticule(projection),

		// 3. State fills
		`<g class="states-fill">`,
		...basemap.states.features.map((f) => `<path d="${path(f) ?? ''}" fill="#f3f1ea" stroke="none" />`),
		`</g>`,

		// 4. Interior state borders (under raster -- visible through alpha)
		`<g class="state-borders" fill="none" stroke="#bdb9ac" stroke-width="0.6">
			<path d="${path(basemap.stateBordersInterior) ?? ''}" />
		</g>`,

		// 5. Outer coastline + Canada/Mexico
		`<g class="nation" fill="none" stroke="#3d3a32" stroke-width="1.2">
			<path d="${path(basemap.conusOuter) ?? ''}" />
		</g>`,

		// 6. RADAR LAYER -- semi-transparent so basemap reads through
		`<g class="radar">
			<image x="0" y="0" width="${SVG_WIDTH}" height="${SVG_HEIGHT}"
			       opacity="0.78"
			       preserveAspectRatio="none"
			       href="data:image/png;base64,${warpedB64}" />
		</g>`,

		// 7. State borders re-stroked, very faintly, ABOVE the raster.
		// This "tops up" the borders inside high-DBZ cells where the
		// 78%-alpha raster has dimmed them.
		`<g class="state-borders-top" fill="none" stroke="#3d3a32" stroke-width="0.4" opacity="0.35">
			<path d="${path(basemap.stateBordersInterior) ?? ''}" />
		</g>`,
		// Outer coastline gets the same treatment so the CONUS edge
		// doesn't disappear inside the broad squall line on this date.
		`<g class="nation-top" fill="none" stroke="#3d3a32" stroke-width="0.8" opacity="0.55">
			<path d="${path(basemap.conusOuter) ?? ''}" />
		</g>`,

		// 8. Airports
		renderAirports(projection),

		// 9. Title + legend
		renderTitle(),
		renderLegend(),
	].join('\n');

	const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" font-family="-apple-system, system-ui, sans-serif">
${svgBody}
</svg>
`;

	writeFileSync(resolve(ROOT, 'spike-output.svg'), svg);
	writeFileSync(
		resolve(ROOT, 'spike-output.html'),
		`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Spike 02 -- Radar Mosaic 2024-05-21 22Z</title>
<style>
  body { margin: 0; padding: 24px; background: #2a2a2a; color: #eee; font-family: -apple-system, system-ui, sans-serif; }
  h1 { font-size: 16px; font-weight: 500; margin: 0 0 16px; opacity: 0.7; }
  .chart { background: white; box-shadow: 0 2px 12px rgba(0,0,0,0.4); display: inline-block; }
  .chart svg { display: block; }
  p.caption { max-width: ${SVG_WIDTH}px; font-size: 13px; line-height: 1.5; opacity: 0.7; margin-top: 16px; }
  p.caption code { background: rgba(255,255,255,0.08); padding: 1px 5px; border-radius: 3px; }
</style>
</head>
<body>
<h1>Spike 02 -- Radar Mosaic 2024-05-21 22Z (CONUS, Lambert Conformal Conic 33/45)</h1>
<div class="chart">${svg.replace(/^<\?xml.*?\?>\s*/, '')}</div>
<p class="caption">Throwaway prototype. Source: IEM NEXRAD composite reflectivity n0r product
for 2024-05-21 22:00Z, re-projected from EPSG:4326 (Plate Carree) into Lambert Conformal
Conic 33/45 by inverting the projection per output pixel and sampling the source PNG. The
NWS reflectivity color ramp is preserved end-to-end (we use the IEM-supplied palette as-is;
no re-coloring). Embedded into the SVG via the <code>&lt;image&gt;</code> element so the
file remains a single self-contained artifact. See <code>spike-notes.md</code>.</p>
</body>
</html>
`,
	);

	console.log(`Wrote spike-output.svg (${(svg.length / 1024).toFixed(1)} KB) and spike-output.html in ${ROOT}`);
}

main();
