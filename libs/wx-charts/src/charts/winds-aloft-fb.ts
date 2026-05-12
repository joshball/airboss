/**
 * Winds aloft (FB) grid chart renderer.
 *
 * Composes the substrate (basemap + projection + graticule + chrome +
 * layer-band composer) with a tabular text-block per FB station. No
 * collision avoidance: stations in the FAA FB grid are pre-selected at
 * non-conflicting hubs, so the renderer just stamps each block at its
 * lon/lat anchor.
 *
 * Source data shape (the spec.yaml's `bulletin` source):
 *
 *   {
 *     "validAt": "2024-05-21T18:00:00Z",
 *     "basedOn": "2024-05-21T12:00:00Z",
 *     "stations": [
 *       { "icao": "ABQ", "lat": 35.04, "lon": -106.6 },
 *       ...
 *     ],
 *     "raw": "DATA BASED ON 211200Z\nVALID 211800Z   ...\n  FT  3000  6000 ...\nABQ  ...\n..."
 *   }
 *
 * The renderer parses `raw` via parseFbGrid, then matches each parsed
 * station to its lon/lat from the `stations` lookup. Stations in the
 * bulletin without a coord lookup emit a warning + skip rendering.
 *
 * Pure function: bytes in, SVG string out. The CLI handles file I/O.
 *
 * Browser-safe: pure d3-geo + library substrate, no Node imports.
 */

import { CHART_TYPES, LAYER_BANDS } from '@ab/constants';
import { geoPath } from 'd3-geo';
import { z } from 'zod';
import { loadConusBasemapFromString, readBasemapTopoJson, renderNorthAmericaContextLayer } from '../basemap';
import { buildChrome } from '../chrome';
import { renderGraticule } from '../graticule';
import { composeChart, type LayerBandMap } from '../layers';
import { type FitTarget, lambertProjection, SVG_HEIGHT, SVG_WIDTH } from '../projection';
import type { ChartRenderInput, ChartRenderResult, ChartSpec } from '../types';
import { parseFbGrid } from '../wx/winds-aloft/parser';
import type { ParsedFbStation, WindsAloftRow } from '../wx/winds-aloft/types';

// ----------------------------------------------------------------------
// Spec schema
// ----------------------------------------------------------------------

const projectionSchema = z.object({
	kind: z.literal('lambert'),
	parallels: z.tuple([z.number(), z.number()]),
	rotate: z.tuple([z.number(), z.number()]),
});

const extentSchema = z.union([
	z.literal('conus'),
	z.literal('alaska'),
	z.literal('hawaii'),
	z.object({
		lon_min: z.number(),
		lat_min: z.number(),
		lon_max: z.number(),
		lat_max: z.number(),
	}),
]);

const windsAloftFbOptionsSchema = z.object({
	/**
	 * Altitudes (ft MSL) to render in each station block. Defaults to the
	 * FAA standard low-altitude set 3000-12000 + the FL180 mid level.
	 * Render fewer altitudes for a less-cluttered chart, or more for the
	 * full FAA set (3000, 6000, 9000, 12000, 18000, 24000, 30000, 34000, 39000).
	 */
	altitudes_ft: z.array(z.number().int().positive()).default([3000, 6000, 9000, 12000, 18000]),
	/** Show the legend (encoding key) in the footer band. Default true. */
	show_legend: z.boolean().default(true),
	/** Footer attribution; defaults to "FAA winds aloft (FB)". */
	source_attribution: z.string().optional(),
});

export const windsAloftFbSpecSchema = z.object({
	slug: z.string(),
	type: z.literal(CHART_TYPES.WINDS_ALOFT_FB),
	title: z.string().min(1),
	subtitle: z.string().optional(),
	projection: projectionSchema,
	extent: extentSchema,
	sources: z.object({
		bulletin: z.string(),
	}),
	options: windsAloftFbOptionsSchema.optional(),
});

export type WindsAloftFbSpec = z.infer<typeof windsAloftFbSpecSchema> & ChartSpec;

// ----------------------------------------------------------------------
// Source-data shape
// ----------------------------------------------------------------------

const fbStationSchema = z.object({
	icao: z.string(),
	lat: z.number(),
	lon: z.number(),
});

const fbBulletinSchema = z.object({
	validAt: z.string().optional(),
	basedOn: z.string().optional(),
	source: z.string().optional(),
	stations: z.array(fbStationSchema),
	raw: z.string().min(1),
});

type FbBulletin = z.infer<typeof fbBulletinSchema>;

// ----------------------------------------------------------------------
// Footer chrome layout
// ----------------------------------------------------------------------

const FOOTER_HEIGHT = 90;
const TOTAL_HEIGHT = SVG_HEIGHT + FOOTER_HEIGHT;

function decodeSourceText(value: Uint8Array | string): string {
	if (typeof value === 'string') return value;
	return new TextDecoder('utf-8').decode(value);
}

// ----------------------------------------------------------------------
// Renderer entry point
// ----------------------------------------------------------------------

export async function renderWindsAloftFb(input: ChartRenderInput<WindsAloftFbSpec>): Promise<ChartRenderResult> {
	const opts = windsAloftFbOptionsSchema.parse(input.spec.options ?? {});

	// 1. Parse source envelope.
	const envelopeBytes = input.sources.bulletin;
	if (envelopeBytes === undefined) {
		throw new Error("winds-aloft-fb: required source 'bulletin' missing from input.sources");
	}
	const envelopeText = decodeSourceText(envelopeBytes);
	const bulletin: FbBulletin = fbBulletinSchema.parse(JSON.parse(envelopeText));
	const parsed = parseFbGrid(bulletin.raw);
	const parserWarnings = [...parsed.warnings];

	// 2. Build station-coord lookup.
	const coordByIcao = new Map<string, { lat: number; lon: number }>();
	for (const s of bulletin.stations) {
		coordByIcao.set(s.icao.toUpperCase(), { lat: s.lat, lon: s.lon });
		// FAA FB bulletins commonly use the 3-letter form; tolerate both.
		coordByIcao.set(s.icao.replace(/^K/, '').toUpperCase(), { lat: s.lat, lon: s.lon });
	}

	// 3. Basemap.
	const basemapBytes = input.sources.basemap;
	let basemapJson: string;
	if (basemapBytes !== undefined) {
		basemapJson = decodeSourceText(basemapBytes);
	} else {
		basemapJson = await readBasemapTopoJson('winds-aloft-fb', input.basemapPath);
	}
	// Canada + Mexico context outlines (ADR 027 Option A). Optional --
	// tests may omit; CLI passes contextBasemapPath. When neither is
	// supplied, the layer renders empty and the chart still composes.
	const contextBytes = input.sources['basemap-context'];
	let contextJson: string | null = null;
	if (contextBytes !== undefined) {
		contextJson = decodeSourceText(contextBytes);
	} else if (input.contextBasemapPath !== undefined) {
		contextJson = await readBasemapTopoJson('winds-aloft-fb', input.contextBasemapPath);
	}
	const basemap = loadConusBasemapFromString(basemapJson, null, contextJson);

	// 4. Projection.
	const projection = lambertProjection({
		parallels: input.spec.projection.parallels,
		rotate: input.spec.projection.rotate,
		fitTarget: basemap.states as unknown as FitTarget,
	});
	const path = geoPath(projection);

	// 5. Project + render each station.
	const stationFragments: string[] = [];
	let renderedStationCount = 0;
	for (const station of parsed.stations) {
		const coord = coordByIcao.get(station.station.toUpperCase());
		if (coord === undefined) {
			parserWarnings.push(`${station.station}: no coord lookup; skipping render`);
			continue;
		}
		const xy = projection([coord.lon, coord.lat]);
		if (xy === null || Number.isNaN(xy[0]) || Number.isNaN(xy[1])) continue;
		stationFragments.push(renderStationBlock(station, xy[0], xy[1], opts.altitudes_ft));
		renderedStationCount += 1;
	}

	// 6. Build per-band fragments.
	const bands: LayerBandMap = {};
	bands[LAYER_BANDS.BACKGROUND] = `<rect x="0" y="0" width="${SVG_WIDTH}" height="${TOTAL_HEIGHT}" fill="#fafaf7" />
<line x1="0" y1="${SVG_HEIGHT}" x2="${SVG_WIDTH}" y2="${SVG_HEIGHT}" stroke="#d8d4c8" stroke-width="0.6" />`;
	bands[LAYER_BANDS.GRATICULE] = renderGraticule(projection);
	bands[LAYER_BANDS.NORTH_AMERICA_CONTEXT] = renderNorthAmericaContextLayer(basemap, (f) => path(f));
	bands[LAYER_BANDS.BASEMAP_FILL] = basemap.states.features
		.map((f) => `<path d="${path(f) ?? ''}" fill="#f3f1ea" stroke="none" />`)
		.join('\n');
	const interiorPath = path(basemap.stateBordersInterior);
	const outerPath = path(basemap.conusOuter);
	bands[LAYER_BANDS.BASEMAP_BORDERS] =
		`<path d="${interiorPath ?? ''}" fill="none" stroke="#bdb9ac" stroke-width="0.6" />
<path d="${outerPath ?? ''}" fill="none" stroke="#3d3a32" stroke-width="1.2" />`;
	bands[LAYER_BANDS.POINT_SYMBOLOGY] = stationFragments.join('\n');

	// Chrome.
	const chrome = buildChrome({
		title: input.spec.title,
		subtitle: input.spec.subtitle,
		rightTitle: 'CONUS - Lambert Conformal 33/45',
		sourceAttribution: opts.source_attribution ?? bulletin.source ?? 'FAA winds aloft (FB)',
		libraryVersion: input.libraryVersion,
		height: TOTAL_HEIGHT,
	});
	const legendFragment = opts.show_legend ? renderFbLegend(opts.altitudes_ft) : '';
	bands[LAYER_BANDS.CHROME] = `${chrome.titleBand}\n${legendFragment}\n${chrome.footerBand}`;

	const svg = composeChart(bands, { height: TOTAL_HEIGHT, viewBox: `0 0 ${SVG_WIDTH} ${TOTAL_HEIGHT}` });

	return {
		svg,
		meta: {
			layer_counts: {
				[LAYER_BANDS.POINT_SYMBOLOGY]: renderedStationCount,
				[LAYER_BANDS.BASEMAP_FILL]: basemap.states.features.length,
				[LAYER_BANDS.NORTH_AMERICA_CONTEXT]: basemap.northAmericaContext.features.length,
			},
			drawn_pixels: 0,
			parser_warnings: parserWarnings,
		},
	};
}

// ----------------------------------------------------------------------
// Per-station text block
// ----------------------------------------------------------------------

const STATION_BLOCK_WIDTH = 70;
const STATION_BLOCK_ROW_HEIGHT = 11;
const COLOR_FG = '#1f1d18';
const COLOR_LABEL = '#3d3a32';
const COLOR_TEMP_NEG = '#1565c0';
const COLOR_TEMP_POS = '#c62828';

function renderStationBlock(station: ParsedFbStation, cx: number, cy: number, altitudes: readonly number[]): string {
	const rowsByAlt = new Map<number, WindsAloftRow>();
	for (const r of station.rows) rowsByAlt.set(r.altitudeFt, r);

	const visibleAltitudes = altitudes.filter((a) => rowsByAlt.has(a));
	const blockHeight = STATION_BLOCK_ROW_HEIGHT * (visibleAltitudes.length + 1) + 6;
	const x0 = cx - STATION_BLOCK_WIDTH / 2;
	const y0 = cy - blockHeight / 2;

	const rowFragments = visibleAltitudes.map((alt, i) => {
		const row = rowsByAlt.get(alt);
		if (row === undefined) return '';
		const altLabel = formatAltitude(alt);
		const dirSpdLabel = formatDirSpeed(row);
		const tempLabel = formatTemp(row.temperatureC);
		const tempColor = tempColorFor(row.temperatureC);
		const yRow = y0 + STATION_BLOCK_ROW_HEIGHT * (i + 1) + 4;
		return `<text x="${x0 + 4}" y="${yRow.toFixed(1)}" font-size="8" font-family="monospace" fill="${COLOR_LABEL}">${altLabel}</text>
<text x="${x0 + 24}" y="${yRow.toFixed(1)}" font-size="8" font-family="monospace" fill="${COLOR_FG}">${dirSpdLabel}</text>
<text x="${x0 + 50}" y="${yRow.toFixed(1)}" font-size="8" font-family="monospace" fill="${tempColor}">${tempLabel}</text>`;
	});

	return `<g class="fb-station" data-station="${station.station}" transform="translate(0,0)">
  <rect x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${STATION_BLOCK_WIDTH}" height="${blockHeight.toFixed(1)}" fill="white" fill-opacity="0.92" stroke="#bdb9ac" stroke-width="0.5" rx="2" />
  <text x="${cx.toFixed(1)}" y="${(y0 + STATION_BLOCK_ROW_HEIGHT - 1).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="${COLOR_FG}">${station.station}</text>
  ${rowFragments.join('\n')}
</g>`;
}

function formatAltitude(altFt: number): string {
	if (altFt >= 18000) {
		return `FL${(altFt / 100).toFixed(0).padStart(3, '0')}`;
	}
	return (altFt / 1000).toString().padStart(3, ' ');
}

function formatDirSpeed(row: WindsAloftRow): string {
	if (row.directionDeg === null) {
		// Light and variable.
		return 'L+V';
	}
	const dirStr = String(row.directionDeg).padStart(3, '0');
	const spdStr = String(row.speedKt).padStart(2, '0');
	return `${dirStr}/${spdStr}`;
}

function formatTemp(tempC: number | null): string {
	if (tempC === null) return '   ';
	const sign = tempC < 0 ? '-' : '+';
	return `${sign}${String(Math.abs(tempC)).padStart(2, '0')}`;
}

function tempColorFor(tempC: number | null): string {
	if (tempC === null) return COLOR_LABEL;
	return tempC < 0 ? COLOR_TEMP_NEG : COLOR_TEMP_POS;
}

// ----------------------------------------------------------------------
// Footer legend
// ----------------------------------------------------------------------

function renderFbLegend(altitudes: readonly number[]): string {
	const x0 = 24;
	const y0 = SVG_HEIGHT + 5;
	const w = SVG_WIDTH - 48;
	const h = FOOTER_HEIGHT - 10;
	const altList = altitudes.map(formatAltitude).join(', ');
	return `<g class="footer-fb-legend">
  <rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="white" fill-opacity="0.94" stroke="#bdb9ac" stroke-width="0.6" rx="3" />
  <text x="${x0 + 10}" y="${y0 + 18}" font-size="10" font-weight="700" fill="#3d3a32" letter-spacing="0.6">WINDS / TEMPS ALOFT (FB)</text>
  <text x="${x0 + 10}" y="${y0 + 34}" font-size="9" fill="#3d3a32">Each station block: altitude (left) -- direction/speed (KT) -- temp (degC)</text>
  <text x="${x0 + 10}" y="${y0 + 48}" font-size="9" fill="#3d3a32">Direction in degrees true. L+V = light and variable. Temps neg above FL240 (sign implied).</text>
  <text x="${x0 + 10}" y="${y0 + 62}" font-size="9" fill="#3d3a32">Altitudes: ${altList}.</text>
  <text x="${x0 + 10}" y="${y0 + 76}" font-size="8" fill="#7a7568">Encoding rule: when wind exceeds 99 KT, FAA adds 50 to the direction code and subtracts 100 from the speed.</text>
</g>`;
}

// ----------------------------------------------------------------------
// Lazy node:fs basemap reader (server path only).
// ----------------------------------------------------------------------
