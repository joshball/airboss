/**
 * Prog chart (forecast surface analysis) renderer.
 *
 * The Prog chart is the forecast counterpart to the surface analysis.
 * Per AC 00-45H Ch 5, the WPC issues 12 / 24 / 36 / 48-hour Surface
 * Prognostic Charts (SIGWX progs) showing forecast positions of fronts,
 * pressure systems, and hazard polygons (turbulence, icing, IFR
 * conditions) at the forecast valid time. The renderer reuses the same
 * substrate as `surface-analysis` (basemap + projection + isobars +
 * fronts + pressure centers) and adds an optional hazard-polygon layer
 * for the forecast turbulence / icing / IFR areas the SIGWX prog
 * commonly carries.
 *
 * Source data shape (single JSON file):
 *   - `centers`: H/L positions + pressureMb (forecast position)
 *   - `fronts`: kind + lon/lat polyline + pip-side cardinal (forecast)
 *   - `hazards` (optional): forecast turbulence / icing / IFR polygons
 *   - `validTimeIso` (optional): ISO timestamp of the forecast valid time
 *   - `forecastHours` (optional): forecast lead-time in hours (12/24/36/48)
 *
 * Pure function: bytes in, SVG string out. Browser-safe (no Node imports).
 */

import { CHART_TYPES, LAYER_BANDS } from '@ab/constants';
import { geoPath } from 'd3-geo';
import { z } from 'zod';
import { loadConusBasemapFromString, readBasemapTopoJson, renderNorthAmericaContextLayer } from '../basemap';
import { buildChrome } from '../chrome';
import { renderGraticule } from '../graticule';
import { composeChart, type LayerBandMap } from '../layers';
import { CHART_MARGIN, type FitTarget, lambertProjection, SVG_HEIGHT, SVG_WIDTH } from '../projection';
import { PROG_HAZARD_PALETTE, type ProgHazardKind } from '../raster/palettes';
import { buildConusClipPath, sanitizeClipId } from '../symbology/clip';
import { renderScalarContours } from '../symbology/contours';
import { type FrontDef, type PipSide, renderFront } from '../symbology/fronts';
import { type PolygonOverlay, renderPolygonOverlays } from '../symbology/polygons';
import { renderPressureCenter } from '../symbology/pressure-centers';
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

const progChartOptionsSchema = z.object({
	isobar_interval_mb: z.number().int().positive().default(4),
	emphasize_every_mb: z.number().int().positive().default(8),
	show_h_l_markers: z.boolean().default(true),
	show_hazards: z.boolean().default(true),
	show_legend: z.boolean().default(true),
	source_attribution: z.string().optional(),
});

export const progChartSpecSchema = z.object({
	slug: z.string(),
	type: z.literal(CHART_TYPES.PROG_CHART),
	title: z.string().min(1),
	subtitle: z.string().optional(),
	projection: projectionSchema,
	extent: extentSchema,
	sources: z.object({
		forecast: z.string(),
	}),
	options: progChartOptionsSchema.optional(),
});

export type ProgChartSpec = z.infer<typeof progChartSpecSchema> & ChartSpec;

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

const hazardKindSchema = z.enum(['turbulence', 'icing', 'ifr']);

const ringSchema = z.array(z.tuple([z.number(), z.number()])).min(3);

const hazardSchema = z.object({
	id: z.string().min(1),
	kind: hazardKindSchema,
	label: z.string().optional(),
	labelLonLat: z.tuple([z.number(), z.number()]).optional(),
	rings: z.array(ringSchema).min(1),
});

const progSourceSchema = z.object({
	title: z.string().optional(),
	validTimeIso: z.string().optional(),
	forecastHours: z.number().int().nonnegative().optional(),
	centers: z.array(pressureCenterSchema),
	fronts: z.array(frontSchema),
	hazards: z.array(hazardSchema).optional(),
});

type ProgSource = z.infer<typeof progSourceSchema>;

// ------------------------------------------------------------------
// Defaults for synthesized pressure field
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

interface PressureGrid {
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

function buildSyntheticPressureField(centers: ProgSource['centers']): PressureGrid {
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

function renderHazardLegend(activeKinds: ReadonlySet<ProgHazardKind>): string {
	const ordered: ProgHazardKind[] = ['turbulence', 'icing', 'ifr'];
	const entries: Array<{ kind: ProgHazardKind; entry: (typeof PROG_HAZARD_PALETTE)[ProgHazardKind] }> = [];
	for (const kind of ordered) {
		if (!activeKinds.has(kind)) continue;
		const entry = PROG_HAZARD_PALETTE[kind];
		entries.push({ kind, entry });
	}
	if (entries.length === 0) return '';
	const rowHeight = 18;
	const swatchWidth = 24;
	const padding = 10;
	const labelWidth = 200;
	const boxWidth = swatchWidth + 8 + labelWidth + padding * 2;
	const boxHeight = entries.length * rowHeight + padding * 2 + 14;
	const x0 = SVG_WIDTH - CHART_MARGIN - boxWidth;
	const y0 = SVG_HEIGHT - CHART_MARGIN - boxHeight - 24;
	const titleFragment = `<text x="${(x0 + padding).toFixed(1)}" y="${(y0 + padding + 10).toFixed(1)}" font-size="10" font-weight="700" fill="#3d3a32" letter-spacing="0.6">FORECAST HAZARDS</text>`;
	const rows = entries
		.map(({ entry }, i) => {
			const rowY = y0 + padding + 14 + i * rowHeight;
			return `<g class="legend-entry">
    <rect x="${(x0 + padding).toFixed(1)}" y="${rowY.toFixed(1)}" width="${swatchWidth}" height="${(rowHeight - 4).toFixed(1)}" fill="${entry.fill}" fill-opacity="${entry.fillOpacity}" stroke="${entry.stroke}" stroke-width="1.4" stroke-dasharray="${entry.dasharray}" />
    <text x="${(x0 + padding + swatchWidth + 8).toFixed(1)}" y="${(rowY + rowHeight - 6).toFixed(1)}" font-size="10" fill="#3d3a32">${entry.label}</text>
  </g>`;
		})
		.join('\n');
	return `<g class="legend prog-chart-legend">
  <rect x="${x0}" y="${y0}" width="${boxWidth}" height="${boxHeight}" fill="white" fill-opacity="0.92" stroke="#bdb9ac" stroke-width="0.6" rx="3" />
  ${titleFragment}
  ${rows}
</g>`;
}

// ------------------------------------------------------------------
// Renderer entry point
// ------------------------------------------------------------------

export async function renderProgChart(input: ChartRenderInput<ProgChartSpec>): Promise<ChartRenderResult> {
	const opts = progChartOptionsSchema.parse(input.spec.options ?? {});

	// 1. Parse source data.
	const forecastBytes = input.sources.forecast;
	if (forecastBytes === undefined) {
		throw new Error("prog-chart: required source 'forecast' missing from input.sources");
	}
	const forecastJson = decodeSourceText(forecastBytes);
	const sourceParsed = progSourceSchema.parse(JSON.parse(forecastJson));

	// 2. Pressure grid -- always synthesized from forecast centers (no
	//    pre-computed grid input for prog charts; the SIGWX prog operates
	//    on coarse forecast positions, not gridded analysis output).
	const pressureGrid = buildSyntheticPressureField(sourceParsed.centers);

	// 3. Basemap.
	const basemapBytes = input.sources.basemap;
	let basemapJson: string;
	if (basemapBytes !== undefined) {
		basemapJson = decodeSourceText(basemapBytes);
	} else {
		basemapJson = await readBasemapTopoJson('prog-chart', input.basemapPath);
	}

	// Canada + Mexico context outlines (ADR 027 Option A). Optional --
	// tests may omit; CLI passes contextBasemapPath. When neither is
	// supplied, the layer renders empty and the chart still composes.
	const contextBytes = input.sources['basemap-context'];
	let contextJson: string | null = null;
	if (contextBytes !== undefined) {
		contextJson = decodeSourceText(contextBytes);
	} else if (input.contextBasemapPath !== undefined) {
		contextJson = await readBasemapTopoJson('prog-chart', input.contextBasemapPath);
	}
	const basemap = loadConusBasemapFromString(basemapJson, null, contextJson);

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
	bands[LAYER_BANDS.NORTH_AMERICA_CONTEXT] = renderNorthAmericaContextLayer(basemap, (f) => path(f));
	bands[LAYER_BANDS.BASEMAP_FILL] = basemap.states.features
		.map((f) => `<path d="${path(f) ?? ''}" fill="#f3f1ea" stroke="none" />`)
		.join('\n');
	const interiorPath = path(basemap.stateBordersInterior);
	const outerPath = path(basemap.conusOuter);
	bands[LAYER_BANDS.BASEMAP_BORDERS] =
		`<path d="${interiorPath ?? ''}" fill="none" stroke="#bdb9ac" stroke-width="0.6" />
<path d="${outerPath ?? ''}" fill="none" stroke="#3d3a32" stroke-width="1.2" />`;

	// Hazard polygons go in the raster overlay band so subsequent vector
	// (isobars + fronts) and point (H/L) symbology layer on top of them.
	const hazards = sourceParsed.hazards ?? [];
	const hazardOverlays: PolygonOverlay[] = [];
	const activeHazards = new Set<ProgHazardKind>();
	if (opts.show_hazards) {
		for (const hazard of hazards) {
			const palette = PROG_HAZARD_PALETTE[hazard.kind];
			activeHazards.add(hazard.kind);
			hazardOverlays.push({
				id: hazard.id,
				rings: hazard.rings,
				style: {
					stroke: palette.stroke,
					fill: palette.fill,
					fillOpacity: palette.fillOpacity,
					dasharray: palette.dasharray,
				},
				label: hazard.label !== undefined ? { text: hazard.label } : undefined,
				labelLonLat: hazard.labelLonLat,
				classSuffix: `prog-${hazard.kind}`,
			});
		}
	}
	bands[LAYER_BANDS.RASTER_OVERLAY] = renderPolygonOverlays(hazardOverlays, { projection });

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
	// Clip the vector-symbology band to the CONUS union polygon (see
	// surface-analysis for full rationale; same fix for the SIGWX prog
	// substrate).
	const clip = buildConusClipPath({
		id: sanitizeClipId(`conus-clip-${input.spec.slug}`),
		conusPolygon: basemap.conusPolygon,
		projection,
	});
	bands[LAYER_BANDS.VECTOR_SYMBOLOGY] =
		`${clip.defs}<g ${clip.clipAttr}>${contourResult.svg}\n${frontFragments.join('\n')}</g>`;

	// Point symbology: pressure centers (H / L markers).
	const centerFragments = opts.show_h_l_markers
		? sourceParsed.centers.map((c) => {
				const pos = projection([c.lon, c.lat]);
				if (pos === null) return '';
				return renderPressureCenter({ kind: c.kind, x: pos[0], y: pos[1], pressureMb: c.pressureMb });
			})
		: [];
	bands[LAYER_BANDS.POINT_SYMBOLOGY] = centerFragments.join('\n');

	// Chrome -- title indicates "FORECAST" prominently per AC 00-45H.
	const forecastHrLabel =
		sourceParsed.forecastHours !== undefined
			? `${sourceParsed.forecastHours.toString().padStart(2, '0')}HR PROG`
			: 'PROG';
	const chrome = buildChrome({
		title: input.spec.title,
		subtitle: input.spec.subtitle,
		rightTitle: `CONUS - ${forecastHrLabel}`,
		rightSubtitle: sourceParsed.validTimeIso !== undefined ? `Valid ${sourceParsed.validTimeIso}` : undefined,
		sourceAttribution: opts.source_attribution ?? sourceParsed.title ?? 'WPC Surface Prognostic Chart archive',
		libraryVersion: input.libraryVersion,
	});
	const legendFragment = opts.show_legend ? renderHazardLegend(activeHazards) : '';
	bands[LAYER_BANDS.CHROME] = `${chrome.titleBand}\n${legendFragment}\n${chrome.footerBand}`;

	const svg = composeChart(bands);

	return {
		svg,
		meta: {
			layer_counts: {
				[LAYER_BANDS.RASTER_OVERLAY]: hazardOverlays.length,
				[LAYER_BANDS.VECTOR_SYMBOLOGY]: contourResult.contourCount + frontFragments.length,
				[LAYER_BANDS.POINT_SYMBOLOGY]: centerFragments.length,
				[LAYER_BANDS.BASEMAP_FILL]: basemap.states.features.length,
				[LAYER_BANDS.NORTH_AMERICA_CONTEXT]: basemap.northAmericaContext.features.length,
			},
			drawn_pixels: 0,
			parser_warnings: [],
		},
	};
}
