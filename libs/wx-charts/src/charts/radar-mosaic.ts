/**
 * Radar mosaic chart renderer.
 *
 * Composes the substrate (basemap + projection + chrome + layer-band
 * composer) with a warped raster overlay (NEXRAD composite reflectivity)
 * and a re-stroked basemap above the raster, plus airport landmarks and
 * the NWS reflectivity legend.
 *
 * Source data shape:
 *   - `radar_png`: source raster bytes (e.g., the IEM n0r product)
 *   - `radar_world`: ESRI worldfile text alongside the PNG
 *
 * Pure renderer: bytes in, SVG string out. The CLI handles file I/O. The
 * sharp-based warp is the only Node-touching call -- it is server-only
 * and the renderer is consequently re-exported from
 * `@ab/wx-charts/server` (not the runtime barrel).
 *
 * Layer order (bottom -> top), per spec.md "Layer band contract":
 *   background          chart background fill
 *   graticule           dashed lat/lon lines
 *   basemap-fill        state polygon fills
 *   basemap-borders     interior + outer borders (under raster)
 *   raster-overlay      warped radar PNG embedded as <image>
 *   basemap-re-stroke   borders re-drawn at low opacity above raster
 *   point-symbology     airport landmarks
 *   chrome              title / footer / legend
 */

import { CHART_TYPES, LAYER_BANDS } from '@ab/constants';
import { geoPath } from 'd3-geo';
import { z } from 'zod';
import { loadConusBasemapFromString } from '../basemap';
import { buildChrome } from '../chrome';
import { renderGraticule } from '../graticule';
import { composeChart, type LayerBandMap } from '../layers';
import {
	CHART_MARGIN,
	type FitTarget,
	lambertProjection,
	SVG_HEIGHT,
	SVG_WIDTH,
	TITLE_BAND_HEIGHT,
} from '../projection';
import { isReflectivityNoData, NWS_REFLECTIVITY_STOPS } from '../raster/palettes';
import { warpRaster } from '../raster/warp';
import { parseWorldFile } from '../raster/worldfile';
import { renderAirport } from '../symbology/airports';
import type { ChartRenderInput, ChartRenderResult, ChartSpec } from '../types';

// ------------------------------------------------------------------
// Spec schema
// ------------------------------------------------------------------

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

const sourceBoundsSchema = z.object({
	lon_min: z.number(),
	lat_min: z.number(),
	lon_max: z.number(),
	lat_max: z.number(),
});

const radarMosaicOptionsSchema = z.object({
	raster_opacity: z.number().min(0).max(1).default(0.78),
	show_airports: z.boolean().default(true),
	show_legend: z.boolean().default(true),
	source_attribution: z.string().optional(),
	/** Restrict source sampling to a geographic bounding box (Plate Carree only). */
	source_bounds: sourceBoundsSchema.optional(),
});

export const radarMosaicSpecSchema = z.object({
	slug: z.string(),
	type: z.literal(CHART_TYPES.RADAR_MOSAIC),
	title: z.string().min(1),
	subtitle: z.string().optional(),
	projection: projectionSchema,
	extent: extentSchema,
	sources: z.object({
		radar_png: z.string(),
		radar_world: z.string(),
	}),
	options: radarMosaicOptionsSchema.optional(),
});

export type RadarMosaicSpec = z.infer<typeof radarMosaicSpecSchema> & ChartSpec;

// ------------------------------------------------------------------
// Default landmark airports for the chart's point-symbology overlay.
// Hand-picked hubs evenly distributed across CONUS so a reader can
// orient quickly. Same set as spike 02; not exhaustive.
// ------------------------------------------------------------------

interface Airport {
	icao: string;
	lon: number;
	lat: number;
}

const LANDMARK_AIRPORTS: readonly Airport[] = [
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

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function decodeSourceText(value: Uint8Array | string): string {
	if (typeof value === 'string') return value;
	return new TextDecoder('utf-8').decode(value);
}

function decodeSourceBytes(value: Uint8Array | string): Uint8Array {
	if (typeof value === 'string') return new TextEncoder().encode(value);
	return value;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('base64');
}

function renderReflectivityLegend(): string {
	// Bottom-right within the chart area, above the chrome footer.
	const legendWidth = 360;
	const legendHeight = 56;
	const x0 = SVG_WIDTH - CHART_MARGIN - legendWidth;
	const y0 = SVG_HEIGHT - CHART_MARGIN - legendHeight - 24; // leave room for chrome footer
	const cellW = legendWidth / NWS_REFLECTIVITY_STOPS.length;
	const cells: string[] = [];
	for (let i = 0; i < NWS_REFLECTIVITY_STOPS.length; i += 1) {
		const stop = NWS_REFLECTIVITY_STOPS[i];
		const cx = x0 + i * cellW;
		cells.push(
			`<rect x="${cx.toFixed(1)}" y="${(y0 + 16).toFixed(1)}" width="${cellW.toFixed(2)}" height="14" fill="${stop.hex}" />`,
		);
		if (stop.label) {
			cells.push(
				`<text x="${(cx + cellW / 2).toFixed(1)}" y="${(y0 + 44).toFixed(1)}" text-anchor="middle" font-size="9" fill="#3d3a32">${stop.dbz}</text>`,
			);
		}
	}
	return `<g class="legend reflectivity-legend">
  <rect x="${x0 - 10}" y="${y0 - 4}" width="${legendWidth + 20}" height="${legendHeight + 12}" fill="white" fill-opacity="0.92" stroke="#bdb9ac" stroke-width="0.6" rx="3" />
  <text x="${x0}" y="${y0 + 10}" font-size="10" font-weight="700" fill="#3d3a32" letter-spacing="0.6">REFLECTIVITY (dBZ)</text>
  ${cells.join('\n  ')}
</g>`;
}

// ------------------------------------------------------------------
// Lazy basemap reader (server path only, mirrors surface-analysis).
// ------------------------------------------------------------------

type GetBuiltinModule = (spec: string) => unknown;
type NodeFs = { promises: { readFile: (path: string, encoding: 'utf8') => Promise<string> } };

async function readBasemapFile(path: string): Promise<string> {
	const proc = (typeof process !== 'undefined' ? process : undefined) as
		| (NodeJS.Process & { getBuiltinModule?: GetBuiltinModule })
		| undefined;
	const getBuiltin = proc?.getBuiltinModule;
	if (typeof getBuiltin !== 'function') {
		throw new Error('radar-mosaic: cannot read basemap file -- no process.getBuiltinModule available');
	}
	const fs = getBuiltin('node:fs') as NodeFs;
	return fs.promises.readFile(path, 'utf8');
}

// ------------------------------------------------------------------
// Renderer entry point
// ------------------------------------------------------------------

export async function renderRadarMosaic(input: ChartRenderInput<RadarMosaicSpec>): Promise<ChartRenderResult> {
	const opts = radarMosaicOptionsSchema.parse(input.spec.options ?? {});

	// 1. Resolve source bytes.
	const radarPng = input.sources.radar_png;
	const radarWorld = input.sources.radar_world;
	if (radarPng === undefined) {
		throw new Error("radar-mosaic: required source 'radar_png' missing from input.sources");
	}
	if (radarWorld === undefined) {
		throw new Error("radar-mosaic: required source 'radar_world' missing from input.sources");
	}
	const pngBytes = decodeSourceBytes(radarPng);
	const worldFile = parseWorldFile(decodeSourceText(radarWorld));

	// 2. Basemap (test seam matches surface-analysis: pass via input.sources.basemap).
	const basemapBytes = input.sources.basemap;
	let basemapJson: string;
	if (basemapBytes !== undefined) {
		basemapJson = decodeSourceText(basemapBytes);
	} else {
		basemapJson = await readBasemapFile(input.basemapPath);
	}
	const basemap = loadConusBasemapFromString(basemapJson);

	// 3. Projection.
	const projection = lambertProjection({
		parallels: input.spec.projection.parallels,
		rotate: input.spec.projection.rotate,
		fitTarget: basemap.states as unknown as FitTarget,
	});
	const path = geoPath(projection);

	// 4. Warp the raster against the target projection.
	// Compute source bounds from the worldfile when not explicitly set
	// in the spec. For Plate Carree, this gives the geographic extent
	// of the source raster.
	const warpResult = await warpRaster({
		pngBytes,
		worldFile,
		targetProjection: projection,
		targetWidth: SVG_WIDTH,
		targetHeight: SVG_HEIGHT,
		sourceBounds:
			opts.source_bounds !== undefined
				? {
						minX: opts.source_bounds.lon_min,
						maxX: opts.source_bounds.lon_max,
						minY: opts.source_bounds.lat_min,
						maxY: opts.source_bounds.lat_max,
					}
				: undefined,
		noDataFilter: isReflectivityNoData,
	});
	const warpedB64 = uint8ArrayToBase64(warpResult.pngBytes);

	// 5. Layer bands.
	const bands: LayerBandMap = {};
	bands[LAYER_BANDS.BACKGROUND] = `<rect x="0" y="0" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#fafaf7" />`;
	bands[LAYER_BANDS.GRATICULE] = renderGraticule(projection);
	bands[LAYER_BANDS.BASEMAP_FILL] = basemap.states.features
		.map((f) => `<path d="${path(f) ?? ''}" fill="#f3f1ea" stroke="none" />`)
		.join('\n');
	const interiorPath = path(basemap.stateBordersInterior);
	const outerPath = path(basemap.conusOuter);
	bands[LAYER_BANDS.BASEMAP_BORDERS] =
		`<path d="${interiorPath ?? ''}" fill="none" stroke="#bdb9ac" stroke-width="0.6" />
<path d="${outerPath ?? ''}" fill="none" stroke="#3d3a32" stroke-width="1.2" />`;

	// Raster overlay -- semi-transparent so basemap reads through.
	bands[LAYER_BANDS.RASTER_OVERLAY] =
		`<image x="0" y="${TITLE_BAND_HEIGHT}" width="${SVG_WIDTH}" height="${SVG_HEIGHT - TITLE_BAND_HEIGHT}"
       opacity="${opts.raster_opacity}"
       preserveAspectRatio="none"
       href="data:image/png;base64,${warpedB64}" />`;

	// Re-stroke borders above the raster so cells don't fully hide them.
	bands[LAYER_BANDS.BASEMAP_RE_STROKE] =
		`<path d="${interiorPath ?? ''}" fill="none" stroke="#3d3a32" stroke-width="0.4" opacity="0.35" />
<path d="${outerPath ?? ''}" fill="none" stroke="#3d3a32" stroke-width="0.8" opacity="0.55" />`;

	// Point symbology -- landmark airports.
	const airportFragments = opts.show_airports
		? LANDMARK_AIRPORTS.map((a) => {
				const pos = projection([a.lon, a.lat]);
				if (pos === null) return '';
				return renderAirport({ id: a.icao, x: pos[0], y: pos[1], label: a.icao });
			})
		: [];
	bands[LAYER_BANDS.POINT_SYMBOLOGY] = airportFragments.join('\n');

	// Chrome (title + footer + legend).
	const chrome = buildChrome({
		title: input.spec.title,
		subtitle: input.spec.subtitle,
		rightTitle: 'CONUS - Lambert Conformal 33/45',
		sourceAttribution: opts.source_attribution ?? 'IEM NEXRAD composite reflectivity (n0r)',
		libraryVersion: input.libraryVersion,
	});
	const legendFragment = opts.show_legend ? renderReflectivityLegend() : '';
	bands[LAYER_BANDS.CHROME] = `${chrome.titleBand}\n${legendFragment}\n${chrome.footerBand}`;

	const svg = composeChart(bands);

	return {
		svg,
		meta: {
			layer_counts: {
				[LAYER_BANDS.RASTER_OVERLAY]: 1,
				[LAYER_BANDS.POINT_SYMBOLOGY]: airportFragments.length,
				[LAYER_BANDS.BASEMAP_FILL]: basemap.states.features.length,
			},
			drawn_pixels: warpResult.drawn,
			parser_warnings: [],
		},
	};
}
