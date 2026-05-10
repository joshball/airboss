/**
 * GTG (Graphical Turbulence Guidance) chart renderer.
 *
 * GTG is the operational NOAA gridded turbulence forecast served by the
 * Aviation Weather Center (AWC). It renders as a contoured scalar field
 * over a single altitude band (low FL010-180, mid FL180-260, high
 * FL260-450), with severity tiers (smooth -> light -> light-moderate ->
 * moderate -> moderate-severe -> severe) shaded per FAA-style ramp.
 *
 * The source data shape is a regular lon/lat grid of severity index
 * values (NWS turbulence index, typically 0..1 normalized, or
 * EDR-equivalent buckets). The renderer uses `d3-contour` to compute
 * threshold polygons and emits one filled `<path>` per tier.
 *
 * Renderer composition:
 *
 *   - basemap fill / borders
 *   - filled severity polygons (vector-symbology layer)
 *   - basemap re-stroke (re-applies state borders over the filled tiers
 *     so coastlines stay readable)
 *   - chrome (title + altitude-band right-title + severity-ramp legend)
 *
 * Pure renderer: bytes in, SVG string out. Browser-safe.
 *
 * Reference docs:
 *   - AWC GTG product page (https://aviationweather.gov/turbulence/gtg)
 *   - AC 00-45H Chapter 5 -- Turbulence reporting and graphical products
 *   - FMH-1 turbulence intensity definitions
 */

import { CHART_TYPES, LAYER_BANDS } from '@ab/constants';
import { contours } from 'd3-contour';
import { geoPath } from 'd3-geo';
import { z } from 'zod';
import { loadConusBasemapFromString } from '../basemap';
import { buildChrome } from '../chrome';
import { renderGraticule } from '../graticule';
import { composeChart, type LayerBandMap } from '../layers';
import { CHART_MARGIN, type FitTarget, lambertProjection, SVG_HEIGHT, SVG_WIDTH } from '../projection';
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

const altitudeBandSchema = z.enum(['low', 'mid', 'high']);

const turbulenceGtgOptionsSchema = z.object({
	altitude_band: altitudeBandSchema.default('mid'),
	show_legend: z.boolean().default(true),
	show_isopleths: z.boolean().default(true),
	source_attribution: z.string().optional(),
});

export const turbulenceGtgSpecSchema = z.object({
	slug: z.string(),
	type: z.literal(CHART_TYPES.TURBULENCE_GTG),
	title: z.string().min(1),
	subtitle: z.string().optional(),
	projection: projectionSchema,
	extent: extentSchema,
	sources: z.object({
		intensity_grid: z.string(),
	}),
	options: turbulenceGtgOptionsSchema.optional(),
});

export type TurbulenceGtgSpec = z.infer<typeof turbulenceGtgSpecSchema> & ChartSpec;

// ------------------------------------------------------------------
// Source-data shape
// ------------------------------------------------------------------

const intensityGridSchema = z.object({
	gridLonMin: z.number(),
	gridLonMax: z.number(),
	gridLatMin: z.number(),
	gridLatMax: z.number(),
	gridWidth: z.number().int().positive(),
	gridHeight: z.number().int().positive(),
	/** Single altitude band the grid was sampled at, e.g. "FL180-FL260" or "FL300". */
	altitudeLabel: z.string().optional(),
	/**
	 * Severity values laid out row-major: `values[iy * gridWidth + ix]`.
	 * Convention: row 0 corresponds to gridLatMax (north edge); row
	 * gridHeight-1 to gridLatMin. Column 0 corresponds to gridLonMin
	 * (west edge); column gridWidth-1 to gridLonMax. Values are EDR-
	 * equivalent severity bucket indices in [0, 5]:
	 *   0 = smooth, 1 = light, 2 = light-moderate, 3 = moderate,
	 *   4 = moderate-severe, 5 = severe.
	 */
	values: z.array(z.number()),
});

type IntensityGrid = z.infer<typeof intensityGridSchema>;

// ------------------------------------------------------------------
// Severity ramp (FAA-style five-tier turbulence intensity).
// ------------------------------------------------------------------

interface SeverityRampStop {
	threshold: number;
	fill: string;
	fillOpacity: number;
	label: string;
}

/**
 * Threshold = the lower bound for the tier. d3-contour `thresholds`
 * yields polygons at the supplied isoline values; we render a filled
 * band between consecutive thresholds. The first tier (smooth) is
 * deliberately not rendered -- empty fill keeps the basemap visible.
 */
const GTG_SEVERITY_RAMP: readonly SeverityRampStop[] = [
	{ threshold: 1, fill: '#a8d8a8', fillOpacity: 0.35, label: 'Light' },
	{ threshold: 2, fill: '#f6df85', fillOpacity: 0.4, label: 'Light-Moderate' },
	{ threshold: 3, fill: '#f0a060', fillOpacity: 0.45, label: 'Moderate' },
	{ threshold: 4, fill: '#d9533a', fillOpacity: 0.5, label: 'Moderate-Severe' },
	{ threshold: 5, fill: '#a02020', fillOpacity: 0.55, label: 'Severe' },
];

const ALTITUDE_BAND_LABEL: Record<'low' | 'mid' | 'high', string> = {
	low: 'FL010-FL180 (Low)',
	mid: 'FL180-FL260 (Mid)',
	high: 'FL260-FL450 (High)',
};

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function decodeSourceText(value: Uint8Array | string): string {
	if (typeof value === 'string') return value;
	return new TextDecoder('utf-8').decode(value);
}

type GetBuiltinModule = (spec: string) => unknown;
type NodeFs = { promises: { readFile: (path: string, encoding: 'utf8') => Promise<string> } };

async function readBasemapFile(path: string): Promise<string> {
	const proc = (typeof process !== 'undefined' ? process : undefined) as
		| (NodeJS.Process & { getBuiltinModule?: GetBuiltinModule })
		| undefined;
	const getBuiltin = proc?.getBuiltinModule;
	if (typeof getBuiltin !== 'function') {
		throw new Error('turbulence-gtg: cannot read basemap file -- no process.getBuiltinModule available');
	}
	const fs = getBuiltin('node:fs') as NodeFs;
	return fs.promises.readFile(path, 'utf8');
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

function renderSeverityRampLegend(altitudeLabel: string): string {
	const rowHeight = 18;
	const swatchWidth = 24;
	const padding = 10;
	const labelWidth = 200;
	const boxWidth = swatchWidth + 8 + labelWidth + padding * 2;
	const boxHeight = (GTG_SEVERITY_RAMP.length + 1) * rowHeight + padding * 2 + 14;
	const x0 = SVG_WIDTH - CHART_MARGIN - boxWidth;
	const y0 = SVG_HEIGHT - CHART_MARGIN - boxHeight - 24;
	const titleFragment = `<text x="${(x0 + padding).toFixed(1)}" y="${(y0 + padding + 10).toFixed(1)}" font-size="10" font-weight="700" fill="#3d3a32" letter-spacing="0.6">GTG SEVERITY</text>`;
	const rows = GTG_SEVERITY_RAMP.map((stop, i) => {
		const rowY = y0 + padding + 14 + i * rowHeight;
		return `<g class="legend-entry">
    <rect x="${(x0 + padding).toFixed(1)}" y="${rowY.toFixed(1)}" width="${swatchWidth}" height="${(rowHeight - 4).toFixed(1)}" fill="${stop.fill}" fill-opacity="${stop.fillOpacity}" stroke="#3d3a32" stroke-width="0.6" />
    <text x="${(x0 + padding + swatchWidth + 8).toFixed(1)}" y="${(rowY + rowHeight - 6).toFixed(1)}" font-size="10" fill="#3d3a32">${escapeXml(stop.label)}</text>
  </g>`;
	}).join('\n');
	const altitudeY = y0 + padding + 14 + GTG_SEVERITY_RAMP.length * rowHeight + 12;
	const altitudeFragment = `<text x="${(x0 + padding).toFixed(1)}" y="${altitudeY.toFixed(1)}" font-size="10" fill="#3d3a32" font-style="italic">Altitude: ${escapeXml(altitudeLabel)}</text>`;
	return `<g class="legend gtg-legend">
  <rect x="${x0}" y="${y0}" width="${boxWidth}" height="${boxHeight}" fill="white" fill-opacity="0.92" stroke="#bdb9ac" stroke-width="0.6" rx="3" />
  ${titleFragment}
  ${rows}
  ${altitudeFragment}
</g>`;
}

interface FilledTierResult {
	svg: string;
	tierCount: number;
}

function gridIndexToLonLat(grid: IntensityGrid, gx: number, gy: number): [number, number] {
	const lon = grid.gridLonMin + (gx / (grid.gridWidth - 1)) * (grid.gridLonMax - grid.gridLonMin);
	const lat = grid.gridLatMax - (gy / (grid.gridHeight - 1)) * (grid.gridLatMax - grid.gridLatMin);
	return [lon, lat];
}

function renderFilledSeverityTiers(
	grid: IntensityGrid,
	projection: ReturnType<typeof lambertProjection>,
): FilledTierResult {
	const path = geoPath(projection);
	const thresholds = GTG_SEVERITY_RAMP.map((s) => s.threshold);
	const contourGen = contours().size([grid.gridWidth, grid.gridHeight]).thresholds(thresholds);
	const polys = contourGen(grid.values as unknown as number[]);

	const elements: string[] = [];
	let drawnTiers = 0;
	for (const poly of polys) {
		const stop = GTG_SEVERITY_RAMP.find((s) => Math.abs(s.threshold - poly.value) < 1e-6);
		if (stop === undefined) continue;
		const lonLatPolygons = poly.coordinates.map((polygon) =>
			polygon.map((ring) => ring.map(([gx, gy]) => gridIndexToLonLat(grid, gx, gy))),
		);
		// A contour at threshold T is the >=T region; render as filled polygons.
		for (const polygon of lonLatPolygons) {
			const d = path({ type: 'Polygon', coordinates: polygon as [number, number][][] });
			if (d === null || d.length === 0) continue;
			elements.push(
				`<path class="gtg-tier gtg-tier-${stop.threshold}" d="${d}" fill="${stop.fill}" fill-opacity="${stop.fillOpacity}" stroke="${stop.fill}" stroke-width="0.4" stroke-opacity="0.8" />`,
			);
			drawnTiers += 1;
		}
	}

	return { svg: elements.join('\n'), tierCount: drawnTiers };
}

function renderIsopleths(grid: IntensityGrid, projection: ReturnType<typeof lambertProjection>): string {
	const path = geoPath(projection);
	const thresholds = GTG_SEVERITY_RAMP.map((s) => s.threshold);
	const contourGen = contours().size([grid.gridWidth, grid.gridHeight]).thresholds(thresholds);
	const polys = contourGen(grid.values as unknown as number[]);

	const out: string[] = [];
	for (const poly of polys) {
		const lonLatRings = poly.coordinates.map((polygon) =>
			polygon.map((ring) => ring.map(([gx, gy]) => gridIndexToLonLat(grid, gx, gy))),
		);
		for (const polygon of lonLatRings) {
			const d = path({ type: 'MultiLineString', coordinates: polygon as [number, number][][] });
			if (d === null) continue;
			out.push(`<path d="${d}" fill="none" stroke="#3d3a32" stroke-width="0.4" stroke-opacity="0.45" />`);
		}
	}
	return out.join('\n');
}

// ------------------------------------------------------------------
// Renderer entry point
// ------------------------------------------------------------------

export async function renderTurbulenceGtg(input: ChartRenderInput<TurbulenceGtgSpec>): Promise<ChartRenderResult> {
	const opts = turbulenceGtgOptionsSchema.parse(input.spec.options ?? {});

	// 1. Resolve source data.
	const gridBytes = input.sources.intensity_grid;
	if (gridBytes === undefined) {
		throw new Error("turbulence-gtg: required source 'intensity_grid' missing from input.sources");
	}
	const gridJson = decodeSourceText(gridBytes);
	const grid = intensityGridSchema.parse(JSON.parse(gridJson));
	if (grid.values.length !== grid.gridWidth * grid.gridHeight) {
		throw new Error(
			`turbulence-gtg: grid value count ${grid.values.length} does not match gridWidth*gridHeight ${grid.gridWidth * grid.gridHeight}`,
		);
	}

	// 2. Basemap.
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

	// 4. Filled severity tiers.
	const tierResult = renderFilledSeverityTiers(grid, projection);
	const isoplethFragment = opts.show_isopleths ? renderIsopleths(grid, projection) : '';

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

	// Filled severity tiers go in vector-symbology so they sit above the
	// basemap-borders band but below any future point overlays. Re-stroke
	// is the canonical "borders re-drawn over fill at low opacity" band.
	bands[LAYER_BANDS.VECTOR_SYMBOLOGY] = `${tierResult.svg}\n${isoplethFragment}`;
	bands[LAYER_BANDS.BASEMAP_RE_STROKE] =
		`<path d="${interiorPath ?? ''}" fill="none" stroke="#bdb9ac" stroke-width="0.4" stroke-opacity="0.6" />
<path d="${outerPath ?? ''}" fill="none" stroke="#3d3a32" stroke-width="1.0" stroke-opacity="0.7" />`;

	const altitudeLabel = grid.altitudeLabel ?? ALTITUDE_BAND_LABEL[opts.altitude_band];
	const chrome = buildChrome({
		title: input.spec.title,
		subtitle: input.spec.subtitle,
		rightTitle: 'CONUS - Lambert Conformal 33/45',
		rightSubtitle: altitudeLabel,
		sourceAttribution: opts.source_attribution ?? 'AWC GTG (Graphical Turbulence Guidance); not for ops use',
		libraryVersion: input.libraryVersion,
	});
	const legendFragment = opts.show_legend ? renderSeverityRampLegend(altitudeLabel) : '';
	bands[LAYER_BANDS.CHROME] = `${chrome.titleBand}\n${legendFragment}\n${chrome.footerBand}`;

	const svg = composeChart(bands);

	return {
		svg,
		meta: {
			layer_counts: {
				[LAYER_BANDS.VECTOR_SYMBOLOGY]: tierResult.tierCount,
				[LAYER_BANDS.BASEMAP_FILL]: basemap.states.features.length,
			},
			drawn_pixels: 0,
			parser_warnings: [],
		},
	};
}
