/**
 * Surface analysis chart renderer.
 *
 * Composes basemap + symbology layers into a single SVG. Writes
 * `spike-output.svg` and `spike-output.html` next to this script.
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { geoPath } from 'd3-geo';
import { buildConusProjection, SVG_HEIGHT, SVG_WIDTH } from './projection';
import { loadBasemap } from './basemap';
import { renderSymbology } from './symbology';
import { loadSurfaceAnalysis } from './data-load';

const ROOT = resolve(import.meta.dir, '..');
const DATA = resolve(ROOT, 'data');

function main(): void {
	// Basemap.
	const basemap = loadBasemap(resolve(DATA, 'us-states-10m.json'), resolve(DATA, 'us-nation-10m.json'));
	// Use CONUS-only state geometry to fit the projection -- the
	// us-atlas nation outline includes Alaska/Hawaii/PR which would
	// stretch the projection into a tall, thin band.
	const projection = buildConusProjection(basemap.states);
	const path = geoPath(projection);

	// Verify projection: project DCA (38.8512N, 77.0402W). Should land
	// in the mid-Atlantic region, around x ~ 870, y ~ 365 for a 1100x700
	// canvas. Logged for inspection.
	const dca = projection([-77.0402, 38.8512]);
	console.log(`DCA projects to: ${dca?.[0].toFixed(1)}, ${dca?.[1].toFixed(1)}`);
	const lax = projection([-118.4081, 33.9416]);
	console.log(`LAX projects to: ${lax?.[0].toFixed(1)}, ${lax?.[1].toFixed(1)}`);

	// Synoptic data.
	const synoptic = loadSurfaceAnalysis(resolve(DATA, 'sfc-2024-12-23-12z.json'));

	// Compose SVG layers.
	const svgBody = [
		// Background
		`<rect x="0" y="0" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#fafaf7" />`,

		// Lat/lon graticule (light gray)
		renderGraticule(projection),

		// State fills (very light)
		`<g class="states-fill">`,
		...basemap.states.features.map((f) => `<path d="${path(f) ?? ''}" fill="#f3f1ea" stroke="none" />`),
		`</g>`,

		// Interior state borders (thin gray)
		`<g class="state-borders" fill="none" stroke="#bdb9ac" stroke-width="0.6">`,
		`  <path d="${path(basemap.stateBordersInterior) ?? ''}" />`,
		`</g>`,

		// CONUS outer (coastline + Canada/Mexico borders)
		`<g class="nation" fill="none" stroke="#3d3a32" stroke-width="1.2">`,
		`  <path d="${path(basemap.conusOuter) ?? ''}" />`,
		`</g>`,

		// Symbology layers (isobars, highs/lows, fronts)
		renderSymbology(projection, synoptic),

		// Title block
		renderTitle(synoptic.title),
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
<title>Spike 01 -- Surface Analysis 2024-12-23 12Z</title>
<style>
  body { margin: 0; padding: 24px; background: #2a2a2a; color: #eee; font-family: -apple-system, system-ui, sans-serif; }
  h1 { font-size: 16px; font-weight: 500; margin: 0 0 16px; opacity: 0.7; }
  .chart { background: white; box-shadow: 0 2px 12px rgba(0,0,0,0.4); display: inline-block; }
  .chart svg { display: block; }
  p.caption { max-width: ${SVG_WIDTH}px; font-size: 13px; line-height: 1.5; opacity: 0.7; margin-top: 16px; }
</style>
</head>
<body>
<h1>Spike 01 -- Surface Analysis 2024-12-23 12Z (CONUS, Lambert Conformal Conic 33/45)</h1>
<div class="chart">${svg.replace(/^<\?xml.*?\?>\s*/, '')}</div>
<p class="caption">Throwaway prototype. Frontal positions and pressure systems hand-traced from the
WPC archive PNG for 2024-12-23 12Z. Isobar smoothing computed from a sparse pressure
field anchored on the traced highs/lows. Station data omitted in this pass. See
spike-notes.md for what was learned.</p>
</body>
</html>
`,
	);

	console.log(`Wrote spike-output.svg and spike-output.html in ${ROOT}`);
}

function renderGraticule(projection: ReturnType<typeof buildConusProjection>): string {
	const path = geoPath(projection);
	const lines: string[] = [];
	// Meridians every 10 deg from -130 to -65
	for (let lon = -130; lon <= -65; lon += 10) {
		const coords: [number, number][] = [];
		for (let lat = 20; lat <= 55; lat += 1) coords.push([lon, lat]);
		const d = path({ type: 'LineString', coordinates: coords });
		if (d) lines.push(`<path d="${d}" fill="none" stroke="#e0ddd2" stroke-width="0.4" stroke-dasharray="2 3" />`);
	}
	// Parallels every 5 deg from 25 to 50
	for (let lat = 25; lat <= 50; lat += 5) {
		const coords: [number, number][] = [];
		for (let lon = -130; lon <= -65; lon += 1) coords.push([lon, lat]);
		const d = path({ type: 'LineString', coordinates: coords });
		if (d) lines.push(`<path d="${d}" fill="none" stroke="#e0ddd2" stroke-width="0.4" stroke-dasharray="2 3" />`);
	}
	return `<g class="graticule">\n${lines.join('\n')}\n</g>`;
}

function renderTitle(title: string): string {
	return `<g class="title">
  <text x="20" y="30" font-size="14" font-weight="600" fill="#3d3a32">SURFACE ANALYSIS</text>
  <text x="20" y="48" font-size="12" fill="#7a7568">${title}</text>
</g>`;
}

main();
