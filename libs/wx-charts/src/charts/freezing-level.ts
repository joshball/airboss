/**
 * Freezing-level forecast chart renderer.
 *
 * The NWS / NCEP freezing-level forecast publishes the height of the lowest
 * 0 degC isotherm in feet MSL on a regular grid covering CONUS. Per AC 00-45H
 * Ch 5 and AC 00-6B Ch 17, the canonical symbology is filled altitude bands
 * (purple at low altitudes, ramping through blue / green / orange to deep
 * orange at higher altitudes) plus contour lines at common pilot decision
 * levels (typically every 2000 ft).
 *
 * The renderer accepts a regular gridded scalar field of altitude (feet MSL)
 * with an optional sum-of-Gaussians synthesizer for the bundled fixture
 * (low altitudes at northern latitudes, high altitudes at southern latitudes).
 *
 * Source data shape:
 *
 * ```json
 * {
 *   "issued": "2024-12-23T12:00:00Z",
 *   "valid_at": "2024-12-23T12:00:00Z",
 *   "altitude_grid": { ... pre-computed grid ... },
 *   "synth": { "north_floor_ft": 1000, "south_ceiling_ft": 16000, "tilt_deg": 12 }
 * }
 * ```
 *
 * Pure renderer: bytes in, SVG string out. Browser-safe (no Node imports).
 */

import { CHART_TYPES, LAYER_BANDS } from '@ab/constants';
import { geoPath } from 'd3-geo';
import { z } from 'zod';
import { loadConusBasemapFromString } from '../basemap';
import { buildChrome } from '../chrome';
import { renderGraticule } from '../graticule';
import { composeChart, type LayerBandMap } from '../layers';
import { CHART_MARGIN, type FitTarget, lambertProjection, SVG_HEIGHT, SVG_WIDTH } from '../projection';
import {
	FREEZING_LEVEL_BANDS,
	FREEZING_LEVEL_EMPHASIZED_LINE_STROKE,
	FREEZING_LEVEL_LINE_STROKE,
} from '../raster/palettes';
import { renderFilledScalarBands, renderScalarContours } from '../symbology/contours';
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

const freezingLevelOptionsSchema = z.object({
	show_legend: z.boolean().default(true),
	show_contours: z.boolean().default(true),
	contour_interval_ft: z.number().int().positive().default(2000),
	source_attribution: z.string().optional(),
});

export const freezingLevelSpecSchema = z.object({
	slug: z.string(),
	type: z.literal(CHART_TYPES.FREEZING_LEVEL),
	title: z.string().min(1),
	subtitle: z.string().optional(),
	projection: projectionSchema,
	extent: extentSchema,
	sources: z.object({
		field: z.string(),
	}),
	options: freezingLevelOptionsSchema.optional(),
});

export type FreezingLevelSpec = z.infer<typeof freezingLevelSpecSchema> & ChartSpec;

// ------------------------------------------------------------------
// Source-data shape
// ------------------------------------------------------------------

const altitudeGridSchema = z.object({
	gridLonMin: z.number(),
	gridLonMax: z.number(),
	gridLatMin: z.number(),
	gridLatMax: z.number(),
	gridWidth: z.number().int().positive(),
	gridHeight: z.number().int().positive(),
	values: z.array(z.number()),
});

/**
 * Sum-of-Gaussians-on-a-tilted-plane synthesizer parameters. The fixture
 * shows freezing levels low at northern latitudes (cold) and high at
 * southern latitudes (warm); a small set of Gaussian bumps represents
 * trough / ridge influences on the otherwise-monotonic latitude tilt.
 */
const synthSchema = z.object({
	north_floor_ft: z.number().nonnegative().default(1500),
	south_ceiling_ft: z.number().nonnegative().default(15500),
	bumps: z
		.array(
			z.object({
				lon: z.number(),
				lat: z.number(),
				/** Bump amplitude in feet; negative = cold pool, positive = warm tongue. */
				amplitude_ft: z.number(),
				sigma: z.number().positive(),
			}),
		)
		.optional(),
});

const freezingLevelSourceSchema = z.object({
	issued: z.string().optional(),
	valid_at: z.string().optional(),
	altitude_grid: altitudeGridSchema.optional(),
	synth: synthSchema.optional(),
});

type FreezingLevelSource = z.infer<typeof freezingLevelSourceSchema>;

// ------------------------------------------------------------------
// Defaults for synthesized fields
// ------------------------------------------------------------------

const DEFAULT_GRID = {
	lonMin: -130,
	lonMax: -65,
	latMin: 22,
	latMax: 52,
	width: 80,
	height: 38,
} as const;

interface ScalarGrid {
	gridLonMin: number;
	gridLonMax: number;
	gridLatMin: number;
	gridLatMax: number;
	gridWidth: number;
	gridHeight: number;
	values: number[];
}

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
		throw new Error('freezing-level: cannot read basemap file -- no process.getBuiltinModule available');
	}
	const fs = getBuiltin('node:fs') as NodeFs;
	return fs.promises.readFile(path, 'utf8');
}

function buildSyntheticAltitudeField(
	synth: NonNullable<FreezingLevelSource['synth']> | { north_floor_ft: number; south_ceiling_ft: number },
): ScalarGrid {
	const northFloor = synth.north_floor_ft;
	const southCeiling = synth.south_ceiling_ft;
	const bumps = 'bumps' in synth ? (synth.bumps ?? []) : [];
	const values = new Array<number>(DEFAULT_GRID.width * DEFAULT_GRID.height);
	for (let iy = 0; iy < DEFAULT_GRID.height; iy++) {
		const lat = DEFAULT_GRID.latMax - (iy / (DEFAULT_GRID.height - 1)) * (DEFAULT_GRID.latMax - DEFAULT_GRID.latMin);
		// Linear ramp: latMax -> northFloor, latMin -> southCeiling.
		const fraction = (DEFAULT_GRID.latMax - lat) / (DEFAULT_GRID.latMax - DEFAULT_GRID.latMin);
		const baseAlt = northFloor + fraction * (southCeiling - northFloor);
		for (let ix = 0; ix < DEFAULT_GRID.width; ix++) {
			const lon = DEFAULT_GRID.lonMin + (ix / (DEFAULT_GRID.width - 1)) * (DEFAULT_GRID.lonMax - DEFAULT_GRID.lonMin);
			let v = baseAlt;
			for (const b of bumps) {
				const dLon = (lon - b.lon) * Math.cos((b.lat * Math.PI) / 180);
				const dLat = lat - b.lat;
				const distDeg = Math.hypot(dLon, dLat);
				v += b.amplitude_ft * Math.exp(-(distDeg * distDeg) / (2 * b.sigma * b.sigma));
			}
			values[iy * DEFAULT_GRID.width + ix] = Math.max(0, v);
		}
	}
	return {
		gridLonMin: DEFAULT_GRID.lonMin,
		gridLonMax: DEFAULT_GRID.lonMax,
		gridLatMin: DEFAULT_GRID.latMin,
		gridLatMax: DEFAULT_GRID.latMax,
		gridWidth: DEFAULT_GRID.width,
		gridHeight: DEFAULT_GRID.height,
		values,
	};
}

function clampGrid(grid: ScalarGrid, min: number, max: number): { grid: ScalarGrid; clampCount: number } {
	let clampCount = 0;
	const out = grid.values.slice();
	for (let i = 0; i < out.length; i++) {
		const v = out[i];
		if (v < min) {
			out[i] = min;
			clampCount += 1;
		} else if (v > max) {
			out[i] = max;
			clampCount += 1;
		}
	}
	return { grid: { ...grid, values: out }, clampCount };
}

function makeGridToLonLat(grid: ScalarGrid): (gx: number, gy: number) => [number, number] {
	return (gx, gy) => {
		const lon = grid.gridLonMin + (gx / (grid.gridWidth - 1)) * (grid.gridLonMax - grid.gridLonMin);
		const lat = grid.gridLatMax - (gy / (grid.gridHeight - 1)) * (grid.gridLatMax - grid.gridLatMin);
		return [lon, lat];
	};
}

function buildContourThresholds(grid: number[], intervalFt: number): number[] {
	let minVal = Number.POSITIVE_INFINITY;
	let maxVal = Number.NEGATIVE_INFINITY;
	for (const v of grid) {
		if (v < minVal) minVal = v;
		if (v > maxVal) maxVal = v;
	}
	const lowest = Math.ceil(minVal / intervalFt) * intervalFt;
	const highest = Math.floor(maxVal / intervalFt) * intervalFt;
	const levels: number[] = [];
	for (let lvl = lowest; lvl <= highest; lvl += intervalFt) levels.push(lvl);
	return levels;
}

function renderAltitudeLegend(): string {
	const rowHeight = 18;
	const swatchWidth = 24;
	const padding = 10;
	const labelWidth = 100;
	const boxWidth = swatchWidth + 8 + labelWidth + padding * 2;
	const boxHeight = FREEZING_LEVEL_BANDS.length * rowHeight + padding * 2 + 14;
	const x0 = SVG_WIDTH - CHART_MARGIN - boxWidth;
	const y0 = SVG_HEIGHT - CHART_MARGIN - boxHeight - 24;
	const titleFragment = `<text x="${(x0 + padding).toFixed(1)}" y="${(y0 + padding + 10).toFixed(1)}" font-size="10" font-weight="700" fill="#3d3a32" letter-spacing="0.6">FREEZING LEVEL (MSL)</text>`;
	// Render bottom-up so the deepest band is at the top of the legend
	// (matches the symbology stacking and reads naturally as an altitude
	// scale: high at top, low at bottom).
	const reversed = [...FREEZING_LEVEL_BANDS].reverse();
	const rows = reversed
		.map((band, i) => {
			const rowY = y0 + padding + 14 + i * rowHeight;
			return `<g class="legend-entry">
    <rect x="${(x0 + padding).toFixed(1)}" y="${rowY.toFixed(1)}" width="${swatchWidth}" height="${(rowHeight - 4).toFixed(1)}" fill="${band.fill}" fill-opacity="${band.fillOpacity}" stroke="#3d3a32" stroke-width="0.4" />
    <text x="${(x0 + padding + swatchWidth + 8).toFixed(1)}" y="${(rowY + rowHeight - 6).toFixed(1)}" font-size="10" fill="#3d3a32">${band.label}</text>
  </g>`;
		})
		.join('\n');
	return `<g class="legend freezing-level-legend">
  <rect x="${x0}" y="${y0}" width="${boxWidth}" height="${boxHeight}" fill="white" fill-opacity="0.92" stroke="#bdb9ac" stroke-width="0.6" rx="3" />
  ${titleFragment}
  ${rows}
</g>`;
}

// ------------------------------------------------------------------
// Renderer entry point
// ------------------------------------------------------------------

export async function renderFreezingLevel(input: ChartRenderInput<FreezingLevelSpec>): Promise<ChartRenderResult> {
	const opts = freezingLevelOptionsSchema.parse(input.spec.options ?? {});
	const parserWarnings: string[] = [];

	// 1. Resolve source data.
	const fieldBytes = input.sources.field;
	if (fieldBytes === undefined) {
		throw new Error("freezing-level: required source 'field' missing from input.sources");
	}
	const fieldJson = decodeSourceText(fieldBytes);
	const sourceParsed = freezingLevelSourceSchema.parse(JSON.parse(fieldJson));

	// 2. Altitude grid: pre-computed if supplied, else synthesize from the
	//    `synth` parameters (or sensible defaults).
	let altitudeRaw: ScalarGrid;
	if (sourceParsed.altitude_grid !== undefined) {
		altitudeRaw = sourceParsed.altitude_grid;
	} else {
		const synth = sourceParsed.synth ?? { north_floor_ft: 1500, south_ceiling_ft: 15500 };
		altitudeRaw = buildSyntheticAltitudeField(synth);
	}
	const altitude = clampGrid(altitudeRaw, 0, 30000);
	if (altitude.clampCount > 0) {
		parserWarnings.push(`freezing-level: clamped ${altitude.clampCount} altitude cells outside [0, 30000] ft`);
	}

	// 3. Basemap.
	const basemapBytes = input.sources.basemap;
	let basemapJson: string;
	if (basemapBytes !== undefined) {
		basemapJson = decodeSourceText(basemapBytes);
	} else {
		basemapJson = await readBasemapFile(input.basemapPath);
	}
	const basemap = loadConusBasemapFromString(basemapJson);

	// 4. Projection.
	const projection = lambertProjection({
		parallels: input.spec.projection.parallels,
		rotate: input.spec.projection.rotate,
		fitTarget: basemap.states as unknown as FitTarget,
	});
	const path = geoPath(projection);

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

	// Filled altitude bands as the raster overlay.
	const filled = renderFilledScalarBands({
		grid: altitude.grid.values,
		gridWidth: altitude.grid.gridWidth,
		gridHeight: altitude.grid.gridHeight,
		bands: FREEZING_LEVEL_BANDS,
		gridToLonLat: makeGridToLonLat(altitude.grid),
		projection,
	});
	bands[LAYER_BANDS.RASTER_OVERLAY] = filled.svg;

	// Vector symbology: line contours at every contour_interval_ft step.
	let contourCount = 0;
	if (opts.show_contours) {
		const thresholds = buildContourThresholds(altitude.grid.values, opts.contour_interval_ft);
		const contourResult = renderScalarContours({
			grid: altitude.grid.values,
			gridWidth: altitude.grid.gridWidth,
			gridHeight: altitude.grid.gridHeight,
			thresholds,
			gridToLonLat: makeGridToLonLat(altitude.grid),
			projection,
			stroke: FREEZING_LEVEL_LINE_STROKE,
			emphasizedStroke: FREEZING_LEVEL_EMPHASIZED_LINE_STROKE,
			strokeWidth: 0.55,
			emphasizedStrokeWidth: 1.0,
			emphasizeEvery: opts.contour_interval_ft * 2,
		});
		bands[LAYER_BANDS.VECTOR_SYMBOLOGY] = contourResult.svg;
		contourCount = contourResult.contourCount;
	} else {
		bands[LAYER_BANDS.VECTOR_SYMBOLOGY] = '';
	}

	// Chrome.
	const chrome = buildChrome({
		title: input.spec.title,
		subtitle: input.spec.subtitle ?? 'Freezing Level Forecast (height of lowest 0 degC isotherm, ft MSL)',
		rightTitle: 'CONUS - Lambert Conformal 33/45',
		sourceAttribution:
			opts.source_attribution ?? 'NCEP / NWS gridded freezing-level forecast (hand-tuned fixture, not for ops use)',
		libraryVersion: input.libraryVersion,
	});
	const legendFragment = opts.show_legend ? renderAltitudeLegend() : '';
	bands[LAYER_BANDS.CHROME] = `${chrome.titleBand}\n${legendFragment}\n${chrome.footerBand}`;

	const svg = composeChart(bands);

	return {
		svg,
		meta: {
			layer_counts: {
				[LAYER_BANDS.RASTER_OVERLAY]: filled.bandCount,
				[LAYER_BANDS.VECTOR_SYMBOLOGY]: contourCount,
				[LAYER_BANDS.BASEMAP_FILL]: basemap.states.features.length,
			},
			drawn_pixels: 0,
			parser_warnings: parserWarnings,
		},
	};
}
