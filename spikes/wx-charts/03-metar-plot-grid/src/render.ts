/**
 * METAR plot-grid composer. Reads the ingested METAR JSON, runs
 * collision avoidance, composes the SVG.
 *
 * Layer order (Spike 2's layer-band contract):
 *   1. background-fill
 *   2. graticule
 *   3. basemap-fill (state polygons)
 *   4. basemap-borders (interior + outer)
 *   5. point-symbology (49 station-model glyphs + leader lines + halos)
 *   6. chrome (title band, legend)
 *
 * Spike 3 has no raster overlay so the basemap-re-stroke band is empty;
 * the contract still holds for future composition with Spike 2's radar.
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { geoPath, type GeoProjection } from 'd3-geo';
import { loadBasemap } from './basemap';
import { buildConusProjection, SVG_HEIGHT, SVG_WIDTH, TITLE_BAND_HEIGHT } from './projection';
import { resolveCollisions, type PlacedGlyph } from './collision';
import { renderStationModel } from './station-model';
import { ceilingFtAgl, flightCategory, summarizeCover, type ParsedMetar, type FlightCategory } from './metar';

const ROOT = resolve(import.meta.dir, '..');
const DATA = resolve(ROOT, 'data');

interface IngestEnvelope {
	targetTimestamp: string;
	source: string;
	fetchedAt: string;
	count: number;
	observations: ReadonlyArray<{
		station: { icao: string; asos: string; lat: number; lon: number; region: string };
		raw: string;
		parsed: ParsedMetar;
		observedAt: string;
		deltaMinutes: number;
	}>;
}

function loadObservations(): IngestEnvelope {
	return JSON.parse(readFileSync(resolve(DATA, 'metars-2024-01-13-12z.json'), 'utf8')) as IngestEnvelope;
}

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

function renderTitle(envelope: IngestEnvelope): string {
	const ts = envelope.targetTimestamp.replace('T', ' ').replace(':00:00Z', 'Z');
	return `<g class="title">
		<rect x="0" y="0" width="${SVG_WIDTH}" height="${TITLE_BAND_HEIGHT}" fill="#fafaf7" />
		<line x1="0" y1="${TITLE_BAND_HEIGHT}" x2="${SVG_WIDTH}" y2="${TITLE_BAND_HEIGHT}" stroke="#d8d4c8" stroke-width="0.6" />
		<text x="24" y="26" font-size="16" font-weight="700" fill="#3d3a32" letter-spacing="1.2">SURFACE OBSERVATIONS</text>
		<text x="24" y="46" font-size="12" fill="#7a7568">${ts}  --  ${envelope.count} ASOS stations  --  IEM archive</text>
		<text x="${SVG_WIDTH - 24}" y="26" text-anchor="end" font-size="11" font-weight="600" fill="#7a7568">CONUS  --  Lambert Conformal 33/45  --  temps degF</text>
		<text x="${SVG_WIDTH - 24}" y="46" text-anchor="end" font-size="11" fill="#a09b8d">spike prototype  --  not for ops use</text>
	</g>`;
}

/**
 * Glyph legend showing the station-model layout. Bottom-left area.
 */
function renderLegend(): string {
	const x0 = 24;
	const y0 = SVG_HEIGHT - 138;
	const W = 320;
	const H = 116;
	const legendCx = x0 + 200;
	const legendCy = y0 + 60;
	// Build a fake parsed METAR for the demo glyph
	const demo: ParsedMetar = {
		station: 'KDEM',
		day: 13,
		hour: 12,
		minute: 0,
		wind: { directionDeg: 270, speedKt: 25, gustKt: null, variable: false, calm: false },
		visibilitySM: 4,
		weather: ['-RA'],
		clouds: [{ cover: 'OVC', heightFtAgl: 1500 }],
		tempC: 5,
		dewpointC: 3,
		altimeterInHg: 30.05,
		cavok: false,
		raw: '',
	};
	const demoSvg = renderStationModel({ parsed: demo, cx: legendCx, cy: legendCy });
	return `<g class="legend">
		<rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="white" fill-opacity="0.94" stroke="#bdb9ac" stroke-width="0.6" rx="3" />
		<text x="${x0 + 10}" y="${y0 + 18}" font-size="10" font-weight="700" fill="#3d3a32" letter-spacing="0.6">STATION MODEL</text>
		<text x="${x0 + 10}" y="${y0 + 36}" font-size="9" fill="#3d3a32">temp degF (top-L)</text>
		<text x="${x0 + 10}" y="${y0 + 50}" font-size="9" fill="#3d3a32">dewpt degF (bot-L)</text>
		<text x="${x0 + 10}" y="${y0 + 64}" font-size="9" fill="#3d3a32">vis SM (left)</text>
		<text x="${x0 + 10}" y="${y0 + 78}" font-size="9" fill="#3d3a32">wx (left of circle)</text>
		<text x="${x0 + 10}" y="${y0 + 92}" font-size="9" fill="#3d3a32">altimeter (top-R)</text>
		<text x="${x0 + 10}" y="${y0 + 106}" font-size="9" fill="#3d3a32">wind: from -> shaft, KT in barbs (NH)</text>
		${demoSvg}
		<text x="${legendCx - 30}" y="${y0 + 100}" font-size="8" fill="#7a7568">demo: 25KT/W, OVC1500, -RA, 5C/3C, A3005</text>
	</g>`;
}

/**
 * Flight-category swatches. Bottom-right.
 */
function renderCategoryLegend(): string {
	const items: ReadonlyArray<{ cat: FlightCategory; color: string; def: string }> = [
		{ cat: 'VFR', color: '#9ca3af', def: 'ceil >3000 + vis >5SM' },
		{ cat: 'MVFR', color: '#1565c0', def: 'ceil 1000-3000 or vis 3-5' },
		{ cat: 'IFR', color: '#c62828', def: 'ceil 500-1000 or vis 1-3' },
		{ cat: 'LIFR', color: '#6a1b9a', def: 'ceil <500 or vis <1' },
	];
	const W = 260;
	const H = items.length * 18 + 24;
	const x0 = SVG_WIDTH - 24 - W;
	const y0 = SVG_HEIGHT - 24 - H;
	const rows: string[] = [];
	for (let i = 0; i < items.length; i += 1) {
		const it = items[i];
		const y = y0 + 30 + i * 18;
		const ringStr = it.cat === 'VFR' ? '' : `<circle cx="${x0 + 22}" cy="${y - 4}" r="6.5" fill="none" stroke="${it.color}" stroke-width="1.4" />`;
		rows.push(
			`${ringStr}<text x="${x0 + 38}" y="${y}" font-size="9" font-weight="600" fill="#3d3a32">${it.cat}</text>
			<text x="${x0 + 78}" y="${y}" font-size="9" fill="#7a7568">${it.def}</text>`,
		);
	}
	return `<g class="cat-legend">
		<rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="white" fill-opacity="0.94" stroke="#bdb9ac" stroke-width="0.6" rx="3" />
		<text x="${x0 + 10}" y="${y0 + 18}" font-size="10" font-weight="700" fill="#3d3a32" letter-spacing="0.6">FLIGHT CATEGORY  (RING COLOR)</text>
		${rows.join('\n')}
	</g>`;
}

function main(): void {
	const basemap = loadBasemap(resolve(DATA, 'us-states-10m.json'));
	const projection = buildConusProjection(basemap.states);
	const path = geoPath(projection);

	const envelope = loadObservations();
	console.log(`loaded ${envelope.count} observations for ${envelope.targetTimestamp}`);

	// Project lat/lon to chart coords
	const positions = envelope.observations
		.map((o) => {
			const xy = projection([o.station.lon, o.station.lat]);
			return xy ? { obs: o, x: xy[0], y: xy[1] } : null;
		})
		.filter((p): p is { obs: IngestEnvelope['observations'][number]; x: number; y: number } => p !== null);

	console.log(`projected ${positions.length} stations onto chart`);

	// Collision avoidance
	const placed = resolveCollisions(
		positions.map((p) => ({ stationKey: p.obs.station.icao, x: p.x, y: p.y })),
	);
	const placedByKey = new Map<string, PlacedGlyph>();
	for (const p of placed) placedByKey.set(p.stationKey, p);

	const displacedCount = placed.filter((p) => p.displaced).length;
	console.log(`collision-avoidance: ${displacedCount}/${placed.length} stations displaced from true position`);

	// Categorize stations for stats
	const catCounts: Record<FlightCategory, number> = { VFR: 0, MVFR: 0, IFR: 0, LIFR: 0 };
	for (const p of positions) {
		const c = flightCategory(ceilingFtAgl(p.obs.parsed.clouds), p.obs.parsed.visibilitySM);
		catCounts[c] += 1;
	}
	console.log(`category counts: VFR=${catCounts.VFR} MVFR=${catCounts.MVFR} IFR=${catCounts.IFR} LIFR=${catCounts.LIFR}`);

	// Render leaders for displaced glyphs
	const leaders: string[] = [];
	for (const p of placed) {
		if (!p.displaced) continue;
		leaders.push(
			`<line x1="${p.trueX.toFixed(1)}" y1="${p.trueY.toFixed(1)}" x2="${p.drawX.toFixed(1)}" y2="${p.drawY.toFixed(1)}" stroke="#a09b8d" stroke-width="0.5" stroke-dasharray="1.5 1.5" />`,
			`<circle cx="${p.trueX.toFixed(1)}" cy="${p.trueY.toFixed(1)}" r="1.2" fill="#7a7568" />`,
		);
	}

	// Render station model glyphs in displacement order
	const glyphs: string[] = [];
	for (const p of positions) {
		const placed = placedByKey.get(p.obs.station.icao);
		if (!placed) continue;
		glyphs.push(renderStationModel({ parsed: p.obs.parsed, cx: placed.drawX, cy: placed.drawY }));
	}

	const svgBody = [
		// 1. Background
		`<rect x="0" y="0" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#fafaf7" />`,

		// 2. Graticule
		renderGraticule(projection),

		// 3. State fills
		`<g class="states-fill">`,
		...basemap.states.features.map((f) => `<path d="${path(f) ?? ''}" fill="#f3f1ea" stroke="none" />`),
		`</g>`,

		// 4. State borders + outer coastline
		`<g class="state-borders" fill="none" stroke="#bdb9ac" stroke-width="0.6">
			<path d="${path(basemap.stateBordersInterior) ?? ''}" />
		</g>`,
		`<g class="nation" fill="none" stroke="#3d3a32" stroke-width="1.2">
			<path d="${path(basemap.conusOuter) ?? ''}" />
		</g>`,

		// 5. Point symbology -- leader lines first (so they sit under glyphs), then glyphs
		`<g class="leaders">${leaders.join('')}</g>`,
		`<g class="stations">${glyphs.join('')}</g>`,

		// 6. Chrome
		renderTitle(envelope),
		renderLegend(),
		renderCategoryLegend(),
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
<title>Spike 03 -- METAR Plot Grid 2024-01-13 12Z</title>
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
<h1>Spike 03 -- Surface Observations 2024-01-13 12Z (CONUS, Lambert Conformal Conic 33/45)</h1>
<div class="chart">${svg.replace(/^<\?xml.*?\?>\s*/, '')}</div>
<p class="caption">Throwaway prototype. Source: IEM ASOS archive METARs for ${envelope.count} CONUS stations
on 2024-01-13, observation closest to 12:00Z per station. METAR strings parsed by a minimal
in-spike parser (~250 lines TS); see <code>src/metar.ts</code> for the field set covered.
Station-model glyphs follow FMH-1 layout: temperature top-L (degF), dewpoint bottom-L,
altimeter top-R (kollsman digits), visibility left, present-weather code left of cloud
circle, cloud cover encoded as circle fill (FEW/SCT/BKN/OVC), wind shaft + barbs from
center pointing in the wind FROM direction with barbs on left side (Northern Hemisphere
convention). A teaching ring around the cloud circle encodes flight category
(MVFR=blue, IFR=red, LIFR=purple). See <code>spike-notes.md</code>.</p>
</body>
</html>
`,
	);
	console.log(`Wrote spike-output.svg (${(svg.length / 1024).toFixed(1)} KB)`);
}

main();

// silence unused
void summarizeCover;
