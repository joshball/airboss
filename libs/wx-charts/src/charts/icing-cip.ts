/**
 * Current Icing Product (CIP) chart renderer.
 *
 * The Current Icing Product (CIP) is the Aviation Weather Center's gridded
 * blend of pilot reports, satellite, radar, and lightning data into a real-
 * time icing-probability + severity field at each flight level. Per AC 00-45H
 * Ch 5 and the AWC product page (https://aviationweather.gov/icing), the
 * primary symbology is a filled probability ramp (cyan -> blue -> purple as
 * probability rises) with optional severity contour lines.
 *
 * The renderer accepts a regular gridded scalar field of icing probability
 * (0-100 percent) with an optional companion severity field (0-1). When the
 * spec opts in to the synthetic mode (default for the bundled fixtures), the
 * renderer derives both fields from a sum of Gaussian bumps anchored at the
 * lon/lat centres declared in the source.
 *
 * Source data shape:
 *
 * ```json
 * {
 *   "issued": "2024-12-23T12:00:00Z",
 *   "altitude_ft": 9000,
 *   "centers": [
 *     { "lon": -85, "lat": 43, "amplitude": 92, "sigma": 5, "severity": 0.6 }
 *   ]
 * }
 * ```
 *
 * Pure renderer: bytes in, SVG string out. Browser-safe (no Node imports).
 */

import { CHART_TYPES, LAYER_BANDS } from '@ab/constants';
import { geoPath } from 'd3-geo';
import { z } from 'zod';
import { loadConusBasemapFromString, readBasemapTopoJson, renderNorthAmericaContextLayer } from '../basemap';
import { buildChrome } from '../chrome';
import { renderGraticule } from '../graticule';
import { composeChart, type LayerBandMap } from '../layers';
import { CHART_MARGIN, type FitTarget, lambertProjection, SVG_HEIGHT, SVG_WIDTH } from '../projection';
import { CIP_PROBABILITY_BANDS, CIP_SEVERITY_TIERS } from '../raster/palettes';
import { buildConusClipPath, sanitizeClipId } from '../symbology/clip';
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

const cipOptionsSchema = z.object({
	show_legend: z.boolean().default(true),
	show_severity_contours: z.boolean().default(true),
	source_attribution: z.string().optional(),
});

export const icingCipSpecSchema = z.object({
	slug: z.string(),
	type: z.literal(CHART_TYPES.ICING_CIP),
	title: z.string().min(1),
	subtitle: z.string().optional(),
	projection: projectionSchema,
	extent: extentSchema,
	sources: z.object({
		field: z.string(),
	}),
	options: cipOptionsSchema.optional(),
});

export type IcingCipSpec = z.infer<typeof icingCipSpecSchema> & ChartSpec;

// ------------------------------------------------------------------
// Source-data shape
// ------------------------------------------------------------------

const cipCenterSchema = z.object({
	lon: z.number(),
	lat: z.number(),
	/** Peak probability (0-100) at the bump centre. */
	amplitude: z.number().min(0).max(100),
	/** Gaussian width in degrees. */
	sigma: z.number().positive(),
	/** Peak severity (0-1) at the centre. Defaults to amplitude / 100 if omitted. */
	severity: z.number().min(0).max(1).optional(),
});

const cipSourceSchema = z.object({
	issued: z.string().optional(),
	valid_at: z.string().optional(),
	altitude_ft: z.number().int().nonnegative().optional(),
	/** Pre-computed gridded probability field (optional; synthesized if omitted). */
	probability_grid: z
		.object({
			gridLonMin: z.number(),
			gridLonMax: z.number(),
			gridLatMin: z.number(),
			gridLatMax: z.number(),
			gridWidth: z.number().int().positive(),
			gridHeight: z.number().int().positive(),
			values: z.array(z.number()),
		})
		.optional(),
	severity_grid: z
		.object({
			gridLonMin: z.number(),
			gridLonMax: z.number(),
			gridLatMin: z.number(),
			gridLatMax: z.number(),
			gridWidth: z.number().int().positive(),
			gridHeight: z.number().int().positive(),
			values: z.array(z.number()),
		})
		.optional(),
	centers: z.array(cipCenterSchema).optional(),
});

type CipSource = z.infer<typeof cipSourceSchema>;

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

/**
 * Sum-of-Gaussians scalar synthesizer used by both probability + severity
 * grids when no pre-computed grid is supplied. The same anchors drive both
 * fields so a "high probability + low severity" patch can be authored by
 * setting `severity` below the implicit amplitude/100 default.
 */
function buildSyntheticField(
	centers: ReadonlyArray<{ lon: number; lat: number; amplitude: number; sigma: number; severity?: number }>,
	mode: 'probability' | 'severity',
): ScalarGrid {
	const grid = new Array<number>(DEFAULT_GRID.width * DEFAULT_GRID.height).fill(0);
	for (let iy = 0; iy < DEFAULT_GRID.height; iy++) {
		const lat = DEFAULT_GRID.latMax - (iy / (DEFAULT_GRID.height - 1)) * (DEFAULT_GRID.latMax - DEFAULT_GRID.latMin);
		for (let ix = 0; ix < DEFAULT_GRID.width; ix++) {
			const lon = DEFAULT_GRID.lonMin + (ix / (DEFAULT_GRID.width - 1)) * (DEFAULT_GRID.lonMax - DEFAULT_GRID.lonMin);
			let v = 0;
			for (const c of centers) {
				const dLon = (lon - c.lon) * Math.cos((c.lat * Math.PI) / 180);
				const dLat = lat - c.lat;
				const distDeg = Math.hypot(dLon, dLat);
				const amp = mode === 'probability' ? c.amplitude : (c.severity ?? c.amplitude / 100);
				v += amp * Math.exp(-(distDeg * distDeg) / (2 * c.sigma * c.sigma));
			}
			grid[iy * DEFAULT_GRID.width + ix] = mode === 'probability' ? Math.min(v, 100) : Math.min(v, 1);
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

function renderProbabilityLegend(altitudeFt: number | undefined): string {
	const rowHeight = 18;
	const swatchWidth = 24;
	const padding = 10;
	const labelWidth = 110;
	const boxWidth = swatchWidth + 8 + labelWidth + padding * 2;
	const headerLines = altitudeFt !== undefined ? 2 : 1;
	const boxHeight = CIP_PROBABILITY_BANDS.length * rowHeight + padding * 2 + 14 + (headerLines - 1) * 14;
	const x0 = SVG_WIDTH - CHART_MARGIN - boxWidth;
	const y0 = SVG_HEIGHT - CHART_MARGIN - boxHeight - 24;
	const titleY = y0 + padding + 10;
	const titleFragment = `<text x="${(x0 + padding).toFixed(1)}" y="${titleY.toFixed(1)}" font-size="10" font-weight="700" fill="#3d3a32" letter-spacing="0.6">ICING PROBABILITY</text>`;
	const altitudeFragment =
		altitudeFt !== undefined
			? `<text x="${(x0 + padding).toFixed(1)}" y="${(titleY + 12).toFixed(1)}" font-size="9" font-weight="600" fill="#5a5750">FL ${Math.round(
					altitudeFt / 100,
				)
					.toString()
					.padStart(3, '0')} (${altitudeFt} ft MSL)</text>`
			: '';
	const startRowY = titleY + 4 + (altitudeFt !== undefined ? 14 : 0);
	const rows = CIP_PROBABILITY_BANDS.map((band, i) => {
		const rowY = startRowY + i * rowHeight;
		return `<g class="legend-entry">
    <rect x="${(x0 + padding).toFixed(1)}" y="${rowY.toFixed(1)}" width="${swatchWidth}" height="${(rowHeight - 4).toFixed(1)}" fill="${band.fill}" fill-opacity="${band.fillOpacity}" stroke="#3d3a32" stroke-width="0.4" />
    <text x="${(x0 + padding + swatchWidth + 8).toFixed(1)}" y="${(rowY + rowHeight - 6).toFixed(1)}" font-size="10" fill="#3d3a32">${band.label}</text>
  </g>`;
	}).join('\n');
	return `<g class="legend cip-legend">
  <rect x="${x0}" y="${y0}" width="${boxWidth}" height="${boxHeight}" fill="white" fill-opacity="0.92" stroke="#bdb9ac" stroke-width="0.6" rx="3" />
  ${titleFragment}
  ${altitudeFragment}
  ${rows}
</g>`;
}

// ------------------------------------------------------------------
// Renderer entry point
// ------------------------------------------------------------------

export async function renderIcingCip(input: ChartRenderInput<IcingCipSpec>): Promise<ChartRenderResult> {
	return renderCipFipShared(input, 'icing-cip');
}

/**
 * Shared CIP / FIP renderer body. The chart-type tag is used to label the
 * source attribution and the chrome legend; everything else is symmetric.
 */
export async function renderCipFipShared(
	input: ChartRenderInput<IcingCipSpec>,
	productKind: 'icing-cip' | 'icing-fip',
): Promise<ChartRenderResult> {
	const opts = cipOptionsSchema.parse(input.spec.options ?? {});
	const parserWarnings: string[] = [];

	// 1. Resolve source data.
	const fieldBytes = input.sources.field;
	if (fieldBytes === undefined) {
		throw new Error(`${productKind}: required source 'field' missing from input.sources`);
	}
	const fieldJson = decodeSourceText(fieldBytes);
	const sourceParsed = cipSourceSchema.parse(JSON.parse(fieldJson));

	// 2. Probability + severity grids.
	const probabilityRaw = sourceParsed.probability_grid ?? buildFromCenters(sourceParsed, 'probability');
	const severityRaw = sourceParsed.severity_grid ?? buildFromCenters(sourceParsed, 'severity');
	const probability = clampGrid(probabilityRaw, 0, 100);
	const severity = clampGrid(severityRaw, 0, 1);
	if (probability.clampCount > 0) {
		parserWarnings.push(`${productKind}: clamped ${probability.clampCount} probability cells outside [0, 100]`);
	}
	if (severity.clampCount > 0) {
		parserWarnings.push(`${productKind}: clamped ${severity.clampCount} severity cells outside [0, 1]`);
	}

	// 3. Basemap.
	const basemapBytes = input.sources.basemap;
	let basemapJson: string;
	if (basemapBytes !== undefined) {
		basemapJson = decodeSourceText(basemapBytes);
	} else {
		basemapJson = await readBasemapTopoJson('icing-cip', input.basemapPath);
	}
	// Canada + Mexico context outlines (ADR 027 Option A). Optional --
	// tests may omit; CLI passes contextBasemapPath. When neither is
	// supplied, the layer renders empty and the chart still composes.
	const contextBytes = input.sources['basemap-context'];
	let contextJson: string | null = null;
	if (contextBytes !== undefined) {
		contextJson = decodeSourceText(contextBytes);
	} else if (input.contextBasemapPath !== undefined) {
		contextJson = await readBasemapTopoJson('icing-cip', input.contextBasemapPath);
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

	// CONUS clip path: shared between filled probability bands and the
	// severity contour lines so neither bleeds past the country outline.
	const clip = buildConusClipPath({
		id: sanitizeClipId(`conus-clip-${input.spec.slug}`),
		conusPolygon: basemap.conusPolygon,
		projection,
	});

	// Filled probability bands as the raster overlay (these are vector
	// fills synthesized from a scalar grid, so they live in the raster
	// overlay band -- below borders re-stroke, above basemap fill).
	const filled = renderFilledScalarBands({
		grid: probability.grid.values,
		gridWidth: probability.grid.gridWidth,
		gridHeight: probability.grid.gridHeight,
		bands: CIP_PROBABILITY_BANDS,
		gridToLonLat: makeGridToLonLat(probability.grid),
		projection,
	});
	bands[LAYER_BANDS.RASTER_OVERLAY] = `${clip.defs}<g ${clip.clipAttr}>${filled.svg}</g>`;

	// Vector symbology: severity contour lines (optional).
	let contourCount = 0;
	if (opts.show_severity_contours) {
		const tierValues = CIP_SEVERITY_TIERS.map((t) => t.value);
		const contourResult = renderScalarContours({
			grid: severity.grid.values,
			gridWidth: severity.grid.gridWidth,
			gridHeight: severity.grid.gridHeight,
			thresholds: tierValues,
			gridToLonLat: makeGridToLonLat(severity.grid),
			projection,
			stroke: '#5a5750',
			emphasizedStroke: '#1a1a1a',
			strokeWidth: 0.8,
			emphasizedStrokeWidth: 1.4,
			emphasizeEvery: 0,
		});
		bands[LAYER_BANDS.VECTOR_SYMBOLOGY] = `<g ${clip.clipAttr}>${contourResult.svg}</g>`;
		contourCount = contourResult.contourCount;
	} else {
		bands[LAYER_BANDS.VECTOR_SYMBOLOGY] = '';
	}

	// Chrome (title + footer + legend).
	const productLabel = productKind === 'icing-cip' ? 'Current Icing Product (CIP)' : 'Forecast Icing Product (FIP)';
	const sourceAttribution =
		opts.source_attribution ??
		(productKind === 'icing-cip'
			? 'AWC CIP archive (https://aviationweather.gov/icing); hand-tuned fixture, not for ops use'
			: 'AWC FIP archive (https://aviationweather.gov/icing); hand-tuned fixture, not for ops use');
	const chrome = buildChrome({
		title: input.spec.title,
		subtitle: input.spec.subtitle ?? productLabel,
		rightTitle: 'CONUS - Lambert Conformal 33/45',
		sourceAttribution,
		libraryVersion: input.libraryVersion,
	});
	const legendFragment = opts.show_legend ? renderProbabilityLegend(sourceParsed.altitude_ft) : '';
	bands[LAYER_BANDS.CHROME] = `${chrome.titleBand}\n${legendFragment}\n${chrome.footerBand}`;

	const svg = composeChart(bands);

	return {
		svg,
		meta: {
			layer_counts: {
				[LAYER_BANDS.RASTER_OVERLAY]: filled.bandCount,
				[LAYER_BANDS.VECTOR_SYMBOLOGY]: contourCount,
				[LAYER_BANDS.BASEMAP_FILL]: basemap.states.features.length,
				[LAYER_BANDS.NORTH_AMERICA_CONTEXT]: basemap.northAmericaContext.features.length,
			},
			drawn_pixels: 0,
			parser_warnings: parserWarnings,
		},
	};
}

function buildFromCenters(source: CipSource, mode: 'probability' | 'severity'): ScalarGrid {
	const centers = source.centers ?? [];
	if (centers.length === 0) {
		// Empty grid is acceptable -- the chart renders empty bands + chrome.
		return {
			gridLonMin: DEFAULT_GRID.lonMin,
			gridLonMax: DEFAULT_GRID.lonMax,
			gridLatMin: DEFAULT_GRID.latMin,
			gridLatMax: DEFAULT_GRID.latMax,
			gridWidth: DEFAULT_GRID.width,
			gridHeight: DEFAULT_GRID.height,
			values: new Array<number>(DEFAULT_GRID.width * DEFAULT_GRID.height).fill(0),
		};
	}
	return buildSyntheticField(centers, mode);
}

function makeGridToLonLat(grid: ScalarGrid): (gx: number, gy: number) => [number, number] {
	return (gx, gy) => {
		const lon = grid.gridLonMin + (gx / (grid.gridWidth - 1)) * (grid.gridLonMax - grid.gridLonMin);
		const lat = grid.gridLatMax - (gy / (grid.gridHeight - 1)) * (grid.gridLatMax - grid.gridLatMin);
		return [lon, lat];
	};
}
