/**
 * Surface analysis chart renderer.
 *
 * Composes the substrate (basemap + projection + chrome + layer-band
 * composer) with surface-analysis-specific symbology (isobars, fronts,
 * pressure centers, optional sparse station model) into a single SVG.
 *
 * Source data shape:
 *   - `fronts`: JSON file with `centers` (H/L positions + pressureMb),
 *     `fronts` (kind + lon/lat polyline + optional pip-side cardinal),
 *     and optional `stations` for the sparse overlay.
 *   - `pressure_grid` (optional): pre-computed regular SLP grid; when
 *     omitted, the renderer synthesizes a Gaussian-bump field from the
 *     marked H/L centers (per spike 01's approach).
 *   - `metar_observations` (optional): CSV of station obs for the
 *     sparse overlay; when omitted, only the embedded `stations`
 *     array (if present) is rendered.
 *
 * Pure function: bytes in, SVG string out. The CLI handles file I/O.
 *
 * Browser-safe: pure d3-geo + library substrate, no Node imports.
 * (The CLI lives in scripts/charts.ts and exclusively imports this
 * module's value exports via @ab/wx-charts/server.)
 */

import { CHART_TYPES, LAYER_BANDS } from '@ab/constants';
import { geoPath } from 'd3-geo';
import { z } from 'zod';
import { loadConusBasemapFromString } from '../basemap';
import { buildChrome } from '../chrome';
import { renderGraticule } from '../graticule';
import { composeChart, type LayerBandMap } from '../layers';
import { type FitTarget, lambertProjection } from '../projection';
import { renderScalarContours } from '../symbology/contours';
import { type FrontDef, type PipSide, renderFront } from '../symbology/fronts';
import { renderPressureCenter } from '../symbology/pressure-centers';
import { renderStationModel, type SkyCover } from '../symbology/station-model';
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

const surfaceAnalysisOptionsSchema = z.object({
	station_density: z.enum(['hubs', 'full', 'none']).default('hubs'),
	isobar_interval_mb: z.number().int().positive().default(4),
	emphasize_every_mb: z.number().int().positive().default(8),
	show_h_l_markers: z.boolean().default(true),
	source_attribution: z.string().optional(),
});

export const surfaceAnalysisSpecSchema = z.object({
	slug: z.string(),
	type: z.literal(CHART_TYPES.SURFACE_ANALYSIS),
	title: z.string().min(1),
	subtitle: z.string().optional(),
	projection: projectionSchema,
	extent: extentSchema,
	sources: z.object({
		fronts: z.string(),
		pressure_grid: z.string().optional(),
		metar_observations: z.string().optional(),
	}),
	options: surfaceAnalysisOptionsSchema.optional(),
});

export type SurfaceAnalysisSpec = z.infer<typeof surfaceAnalysisSpecSchema> & ChartSpec;

// ------------------------------------------------------------------
// Source-data shapes
// ------------------------------------------------------------------

const pressureCenterSchema = z.object({
	kind: z.enum(['H', 'L']),
	lon: z.number(),
	lat: z.number(),
	pressureMb: z.number(),
});

const frontSchema = z.object({
	kind: z.enum(['cold', 'warm', 'occluded', 'stationary']),
	points: z.array(z.tuple([z.number(), z.number()])).min(2),
	pipSide: z.enum(['N', 'S', 'E', 'W']).optional(),
});

const stationObSchema = z.object({
	id: z.string(),
	lon: z.number(),
	lat: z.number(),
	tempF: z.number().optional(),
	dewF: z.number().optional(),
	pressureMb: z.number().optional(),
	windDir: z.number().nullable().optional(),
	windKt: z.number().nullable().optional(),
	skyCover: z.enum(['CLR', 'FEW', 'SCT', 'BKN', 'OVC']).optional(),
});

const surfaceAnalysisSourceSchema = z.object({
	title: z.string().optional(),
	validTimeIso: z.string().optional(),
	centers: z.array(pressureCenterSchema),
	fronts: z.array(frontSchema),
	stations: z.array(stationObSchema).optional(),
});

type SurfaceAnalysisSource = z.infer<typeof surfaceAnalysisSourceSchema>;

const pressureGridSchema = z.object({
	gridLonMin: z.number(),
	gridLonMax: z.number(),
	gridLatMin: z.number(),
	gridLatMax: z.number(),
	gridWidth: z.number().int().positive(),
	gridHeight: z.number().int().positive(),
	values: z.array(z.number()),
});

type PressureGrid = z.infer<typeof pressureGridSchema>;

// ------------------------------------------------------------------
// Defaults for synthesized pressure field (per spike 01).
// ------------------------------------------------------------------

const DEFAULT_GRID = {
	lonMin: -130,
	lonMax: -65,
	latMin: 22,
	latMax: 52,
	width: 130,
	height: 60,
} as const;

const BACKGROUND_SLP = 1015;
const ISOBAR_REFERENCE_MB = 1012;
const CENTER_SIGMA_DEG = 7;

function decodeSourceText(value: Uint8Array | string): string {
	if (typeof value === 'string') return value;
	return new TextDecoder('utf-8').decode(value);
}

function buildSyntheticPressureField(centers: SurfaceAnalysisSource['centers']): PressureGrid {
	const grid = new Array<number>(DEFAULT_GRID.width * DEFAULT_GRID.height);
	for (let iy = 0; iy < DEFAULT_GRID.height; iy++) {
		const lat = DEFAULT_GRID.latMax - (iy / (DEFAULT_GRID.height - 1)) * (DEFAULT_GRID.latMax - DEFAULT_GRID.latMin);
		for (let ix = 0; ix < DEFAULT_GRID.width; ix++) {
			const lon = DEFAULT_GRID.lonMin + (ix / (DEFAULT_GRID.width - 1)) * (DEFAULT_GRID.lonMax - DEFAULT_GRID.lonMin);
			let p = BACKGROUND_SLP;
			for (const c of centers) {
				const dLon = (lon - c.lon) * Math.cos((c.lat * Math.PI) / 180);
				const dLat = lat - c.lat;
				const distDeg = Math.hypot(dLon, dLat);
				const amp = c.pressureMb - BACKGROUND_SLP;
				p += amp * Math.exp(-(distDeg * distDeg) / (2 * CENTER_SIGMA_DEG * CENTER_SIGMA_DEG));
			}
			grid[iy * DEFAULT_GRID.width + ix] = p;
		}
	}
	return {
		gridLonMin: DEFAULT_GRID.lonMin,
		gridLonMax: DEFAULT_GRID.lonMax,
		gridLatMin: DEFAULT_GRID.latMin,
		gridLatMax: DEFAULT_GRID.latMax,
		gridWidth: DEFAULT_GRID.width,
		gridHeight: DEFAULT_GRID.height,
		values: grid,
	};
}

function buildIsobarThresholds(grid: number[], intervalMb: number): number[] {
	let minVal = Number.POSITIVE_INFINITY;
	let maxVal = Number.NEGATIVE_INFINITY;
	for (const v of grid) {
		if (v < minVal) minVal = v;
		if (v > maxVal) maxVal = v;
	}
	const lowestLevel = Math.ceil((minVal - ISOBAR_REFERENCE_MB) / intervalMb) * intervalMb + ISOBAR_REFERENCE_MB;
	const highestLevel = Math.floor((maxVal - ISOBAR_REFERENCE_MB) / intervalMb) * intervalMb + ISOBAR_REFERENCE_MB;
	const levels: number[] = [];
	for (let lvl = lowestLevel; lvl <= highestLevel; lvl += intervalMb) levels.push(lvl);
	return levels;
}

// ------------------------------------------------------------------
// Renderer entry point
// ------------------------------------------------------------------

export async function renderSurfaceAnalysis(input: ChartRenderInput<SurfaceAnalysisSpec>): Promise<ChartRenderResult> {
	const opts = surfaceAnalysisOptionsSchema.parse(input.spec.options ?? {});

	// 1. Parse source data.
	const frontsBytes = input.sources.fronts;
	if (frontsBytes === undefined) {
		throw new Error("surface-analysis: required source 'fronts' missing from input.sources");
	}
	const frontsJson = decodeSourceText(frontsBytes);
	const sourceParsed = surfaceAnalysisSourceSchema.parse(JSON.parse(frontsJson));

	// 2. Pressure grid: pre-computed if supplied, else synthesized from centers.
	let pressureGrid: PressureGrid;
	const gridBytes = input.sources.pressure_grid;
	if (gridBytes !== undefined) {
		const gridJson = decodeSourceText(gridBytes);
		pressureGrid = pressureGridSchema.parse(JSON.parse(gridJson));
	} else {
		pressureGrid = buildSyntheticPressureField(sourceParsed.centers);
	}

	// 3. Basemap (read by CLI; passed in as a string-bearing source key
	//    when the renderer is exercised from a test, or read from disk
	//    by the CLI before invocation).
	const basemapBytes = input.sources.basemap;
	let basemapJson: string;
	if (basemapBytes !== undefined) {
		basemapJson = decodeSourceText(basemapBytes);
	} else {
		// CLI path: read from input.basemapPath via lazy node:fs.
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
	bands[LAYER_BANDS.BACKGROUND] = '<rect x="0" y="0" width="1200" height="780" fill="#fafaf7" />';
	bands[LAYER_BANDS.GRATICULE] = renderGraticule(projection);
	bands[LAYER_BANDS.BASEMAP_FILL] = basemap.states.features
		.map((f) => `<path d="${path(f) ?? ''}" fill="#f3f1ea" stroke="none" />`)
		.join('\n');
	const interiorPath = path(basemap.stateBordersInterior);
	const outerPath = path(basemap.conusOuter);
	bands[LAYER_BANDS.BASEMAP_BORDERS] =
		`<path d="${interiorPath ?? ''}" fill="none" stroke="#bdb9ac" stroke-width="0.6" />
<path d="${outerPath ?? ''}" fill="none" stroke="#3d3a32" stroke-width="1.2" />`;

	// Vector symbology: isobars + fronts.
	const thresholds = buildIsobarThresholds(pressureGrid.values, opts.isobar_interval_mb);
	const contourResult = renderScalarContours({
		grid: pressureGrid.values,
		gridWidth: pressureGrid.gridWidth,
		gridHeight: pressureGrid.gridHeight,
		thresholds,
		gridToLonLat: (gx, gy) => {
			const lon =
				pressureGrid.gridLonMin +
				(gx / (pressureGrid.gridWidth - 1)) * (pressureGrid.gridLonMax - pressureGrid.gridLonMin);
			const lat =
				pressureGrid.gridLatMax -
				(gy / (pressureGrid.gridHeight - 1)) * (pressureGrid.gridLatMax - pressureGrid.gridLatMin);
			return [lon, lat];
		},
		projection,
		emphasizeEvery: opts.emphasize_every_mb,
	});
	const frontFragments = sourceParsed.fronts.map((f) => {
		const projectedPoints = f.points
			.map((p) => projection([p[0], p[1]]))
			.filter((p): p is [number, number] => p !== null && !Number.isNaN(p[0]));
		const def: FrontDef = {
			kind: f.kind,
			points: projectedPoints,
			pipSide: f.pipSide as PipSide | undefined,
		};
		return renderFront(def);
	});
	bands[LAYER_BANDS.VECTOR_SYMBOLOGY] = `${contourResult.svg}\n${frontFragments.join('\n')}`;

	// Point symbology: pressure centers + optional sparse station model.
	const centerFragments = opts.show_h_l_markers
		? sourceParsed.centers.map((c) => {
				const pos = projection([c.lon, c.lat]);
				if (pos === null) return '';
				return renderPressureCenter({ kind: c.kind, x: pos[0], y: pos[1], pressureMb: c.pressureMb });
			})
		: [];
	const stationFragments =
		opts.station_density === 'none' || sourceParsed.stations === undefined
			? []
			: sourceParsed.stations.map((s) => {
					const pos = projection([s.lon, s.lat]);
					if (pos === null) return '';
					return renderStationModel({
						id: s.id,
						x: pos[0],
						y: pos[1],
						tempF: s.tempF,
						dewF: s.dewF,
						pressureMb: s.pressureMb,
						windDir: s.windDir,
						windKt: s.windKt,
						skyCover: s.skyCover as SkyCover | undefined,
					});
				});
	bands[LAYER_BANDS.POINT_SYMBOLOGY] = [...centerFragments, ...stationFragments].join('\n');

	// Chrome.
	const chrome = buildChrome({
		title: input.spec.title,
		subtitle: input.spec.subtitle,
		rightTitle: 'CONUS - Lambert Conformal 33/45',
		sourceAttribution: opts.source_attribution ?? sourceParsed.title ?? 'WPC Surface Analysis',
		libraryVersion: input.libraryVersion,
	});
	bands[LAYER_BANDS.CHROME] = `${chrome.titleBand}\n${chrome.footerBand}`;

	const svg = composeChart(bands);

	return {
		svg,
		meta: {
			layer_counts: {
				[LAYER_BANDS.VECTOR_SYMBOLOGY]: contourResult.contourCount + frontFragments.length,
				[LAYER_BANDS.POINT_SYMBOLOGY]: centerFragments.length + stationFragments.length,
				[LAYER_BANDS.BASEMAP_FILL]: basemap.states.features.length,
			},
			drawn_pixels: 0,
			parser_warnings: [],
		},
	};
}

// ------------------------------------------------------------------
// Lazy node:fs basemap reader (server path only).
// ------------------------------------------------------------------

type GetBuiltinModule = (spec: string) => unknown;
type NodeFs = { promises: { readFile: (path: string, encoding: 'utf8') => Promise<string> } };

async function readBasemapFile(path: string): Promise<string> {
	const proc = (typeof process !== 'undefined' ? process : undefined) as
		| (NodeJS.Process & { getBuiltinModule?: GetBuiltinModule })
		| undefined;
	const getBuiltin = proc?.getBuiltinModule;
	if (typeof getBuiltin !== 'function') {
		throw new Error('surface-analysis: cannot read basemap file -- no process.getBuiltinModule available');
	}
	const fs = getBuiltin('node:fs') as NodeFs;
	return fs.promises.readFile(path, 'utf8');
}

// Tests can pass an in-memory basemap JSON via input.sources.basemap
// (an opt-in key not in the spec schema; render reads it directly via
// the Record<string, ...> indexed access). Production CLI path uses
// input.basemapPath and the lazy node:fs reader above.
