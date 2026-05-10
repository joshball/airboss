/**
 * CVA (Ceiling and Visibility Analysis) chart renderer.
 *
 * Per AC 00-45H Ch 5 + AIM 7-1-6 + AWC CVA product
 * (https://aviationweather.gov/cva), the CVA shows current ceiling and
 * visibility flight categories (VFR / MVFR / IFR / LIFR) across CONUS as
 * colored polygons or per-station shaded dots. The product is a snapshot
 * of "where is it currently VFR / IFR" derived from the METAR observation
 * network.
 *
 * Per the Phase D tasks decision (option b -- per-station shaded dots from
 * METAR-derived flight category), the renderer parses each METAR via the
 * Phase C parser, derives the flight category via `computeFlightCategory`,
 * and emits a coloured station dot per observation. Optional polygon
 * overlays (passed in via the source `polygons` field) provide CONUS-wide
 * area shading when the author has hand-traced the category boundaries
 * from the AWC CVA snapshot. The chrome legend lists the four categories
 * with their AIM 7-1-6 thresholds.
 *
 * Source data shape (single JSON file -- mirrors the METAR plot grid envelope):
 *
 * ```json
 * {
 *   "targetTimestamp": "2024-01-13T12:00:00Z",
 *   "source": "...",
 *   "count": 49,
 *   "observations": [
 *     {
 *       "station": { "icao": "KSEA", "lat": 47.45, "lon": -122.31, ... },
 *       "raw": "KSEA 131153Z 09015G22KT 10SM SCT240 ..."
 *     },
 *     ...
 *   ],
 *   "polygons": [   // optional CVA area polygons
 *     {
 *       "id": "CVA-VFR-1",
 *       "category": "VFR",
 *       "rings": [[[lon, lat], ...]]
 *     },
 *     ...
 *   ]
 * }
 * ```
 *
 * Pure renderer: bytes in, SVG string out. Browser-safe (no Node imports).
 */

import { CHART_TYPES, FAA_FLIGHT_CATEGORIES, type FaaFlightCategory, LAYER_BANDS } from '@ab/constants';
import { geoPath } from 'd3-geo';
import { z } from 'zod';
import { loadConusBasemapFromString } from '../basemap';
import { buildChrome } from '../chrome';
import { renderGraticule } from '../graticule';
import { composeChart, type LayerBandMap } from '../layers';
import { CHART_MARGIN, type FitTarget, lambertProjection, SVG_HEIGHT, SVG_WIDTH } from '../projection';
import { FLIGHT_CATEGORY_FILL } from '../raster/palettes';
import { type PolygonOverlay, renderPolygonOverlays } from '../symbology/polygons';
import type { ChartRenderInput, ChartRenderResult, ChartSpec } from '../types';
import { parseMetar } from '../wx/metar/parser';
import { computeFlightCategory } from '../wx/rules';

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

const cvaOptionsSchema = z.object({
	show_legend: z.boolean().default(true),
	show_station_labels: z.boolean().default(true),
	show_polygons: z.boolean().default(true),
	dot_radius_px: z.number().positive().default(7),
	source_attribution: z.string().optional(),
});

export const cvaSpecSchema = z.object({
	slug: z.string(),
	type: z.literal(CHART_TYPES.CVA),
	title: z.string().min(1),
	subtitle: z.string().optional(),
	projection: projectionSchema,
	extent: extentSchema,
	sources: z.object({
		observations: z.string(),
	}),
	options: cvaOptionsSchema.optional(),
});

export type CvaSpec = z.infer<typeof cvaSpecSchema> & ChartSpec;

// ------------------------------------------------------------------
// Source-data shapes
// ------------------------------------------------------------------

const stationSchema = z.object({
	icao: z.string(),
	lat: z.number(),
	lon: z.number(),
	asos: z.string().optional(),
	region: z.string().optional(),
});

const observationSchema = z.object({
	station: stationSchema,
	raw: z.string(),
});

const categorySchema = z.enum([
	FAA_FLIGHT_CATEGORIES.VFR,
	FAA_FLIGHT_CATEGORIES.MVFR,
	FAA_FLIGHT_CATEGORIES.IFR,
	FAA_FLIGHT_CATEGORIES.LIFR,
]);

const ringSchema = z.array(z.tuple([z.number(), z.number()])).min(3);

const cvaPolygonSchema = z.object({
	id: z.string().min(1),
	category: categorySchema,
	label: z.string().optional(),
	labelLonLat: z.tuple([z.number(), z.number()]).optional(),
	rings: z.array(ringSchema).min(1),
});

const cvaSourceSchema = z.object({
	targetTimestamp: z.string().optional(),
	source: z.string().optional(),
	count: z.number().int().nonnegative().optional(),
	observations: z.array(observationSchema),
	polygons: z.array(cvaPolygonSchema).optional(),
});

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
		throw new Error('cva: cannot read basemap file -- no process.getBuiltinModule available');
	}
	const fs = getBuiltin('node:fs') as NodeFs;
	return fs.promises.readFile(path, 'utf8');
}

interface CategoryDot {
	icao: string;
	x: number;
	y: number;
	category: FaaFlightCategory;
}

function renderCategoryDot(dot: CategoryDot, options: { dotRadiusPx: number; showLabel: boolean }): string {
	const palette = FLIGHT_CATEGORY_FILL[dot.category];
	const label = options.showLabel
		? `<text x="${dot.x.toFixed(1)}" y="${(dot.y + options.dotRadiusPx + 9).toFixed(1)}" text-anchor="middle" font-size="8" font-weight="500" fill="#3d3a32">${dot.icao.replace(/^K/, '')}</text>`
		: '';
	return `<g class="cva-dot" data-station="${dot.icao}" data-category="${dot.category}">
  <circle cx="${dot.x.toFixed(1)}" cy="${dot.y.toFixed(1)}" r="${options.dotRadiusPx.toFixed(1)}" fill="${palette.fill}" fill-opacity="0.85" stroke="${palette.stroke}" stroke-width="1.4" />
  ${label}
</g>`;
}

function renderCategoryLegend(activeCategories: ReadonlySet<FaaFlightCategory>): string {
	const ordered: FaaFlightCategory[] = [
		FAA_FLIGHT_CATEGORIES.VFR,
		FAA_FLIGHT_CATEGORIES.MVFR,
		FAA_FLIGHT_CATEGORIES.IFR,
		FAA_FLIGHT_CATEGORIES.LIFR,
	];
	const entries: Array<{ category: FaaFlightCategory; entry: (typeof FLIGHT_CATEGORY_FILL)[string] }> = [];
	for (const cat of ordered) {
		if (!activeCategories.has(cat)) continue;
		entries.push({ category: cat, entry: FLIGHT_CATEGORY_FILL[cat] });
	}
	if (entries.length === 0) return '';
	const rowHeight = 18;
	const swatchWidth = 24;
	const padding = 10;
	const labelWidth = 280;
	const boxWidth = swatchWidth + 8 + labelWidth + padding * 2;
	const boxHeight = entries.length * rowHeight + padding * 2 + 14;
	const x0 = SVG_WIDTH - CHART_MARGIN - boxWidth;
	const y0 = SVG_HEIGHT - CHART_MARGIN - boxHeight - 24;
	const titleFragment = `<text x="${(x0 + padding).toFixed(1)}" y="${(y0 + padding + 10).toFixed(1)}" font-size="10" font-weight="700" fill="#3d3a32" letter-spacing="0.6">FLIGHT CATEGORY (AIM 7-1-6)</text>`;
	const rows = entries
		.map(({ category, entry }, i) => {
			const rowY = y0 + padding + 14 + i * rowHeight;
			return `<g class="legend-entry">
    <circle cx="${(x0 + padding + swatchWidth / 2).toFixed(1)}" cy="${(rowY + (rowHeight - 4) / 2).toFixed(1)}" r="6" fill="${entry.fill}" fill-opacity="0.85" stroke="${entry.stroke}" stroke-width="1.4" />
    <text x="${(x0 + padding + swatchWidth + 8).toFixed(1)}" y="${(rowY + rowHeight - 6).toFixed(1)}" font-size="10" fill="#3d3a32"><tspan font-weight="700">${category}</tspan> ${entry.label.slice(category.length + 1)}</text>
  </g>`;
		})
		.join('\n');
	return `<g class="legend cva-legend">
  <rect x="${x0}" y="${y0}" width="${boxWidth}" height="${boxHeight}" fill="white" fill-opacity="0.92" stroke="#bdb9ac" stroke-width="0.6" rx="3" />
  ${titleFragment}
  ${rows}
</g>`;
}

// ------------------------------------------------------------------
// Renderer entry point
// ------------------------------------------------------------------

export async function renderCva(input: ChartRenderInput<CvaSpec>): Promise<ChartRenderResult> {
	const opts = cvaOptionsSchema.parse(input.spec.options ?? {});
	const parserWarnings: string[] = [];

	// 1. Resolve source data.
	const observationsBytes = input.sources.observations;
	if (observationsBytes === undefined) {
		throw new Error("cva: required source 'observations' missing from input.sources");
	}
	const observationsJson = decodeSourceText(observationsBytes);
	const sourceParsed = cvaSourceSchema.parse(JSON.parse(observationsJson));

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

	// 4. Parse each METAR -> derive flight category -> per-station dot.
	const dots: CategoryDot[] = [];
	const activeCategories = new Set<FaaFlightCategory>();
	for (const obs of sourceParsed.observations) {
		let parsed: ReturnType<typeof parseMetar>;
		try {
			parsed = parseMetar(obs.raw);
		} catch (err) {
			parserWarnings.push(
				`cva: failed to parse METAR for ${obs.station.icao}: ${err instanceof Error ? err.message : String(err)}`,
			);
			continue;
		}
		const category = computeFlightCategory(parsed);
		const xy = projection([obs.station.lon, obs.station.lat]);
		if (xy === null || !Number.isFinite(xy[0]) || !Number.isFinite(xy[1])) {
			parserWarnings.push(
				`cva: station ${obs.station.icao} did not project (lon=${obs.station.lon}, lat=${obs.station.lat})`,
			);
			continue;
		}
		activeCategories.add(category);
		dots.push({
			icao: obs.station.icao,
			x: xy[0],
			y: xy[1],
			category,
		});
	}

	// 5. Optional CVA polygon overlays from source.
	const polygonOverlays: PolygonOverlay[] = [];
	const polygons = sourceParsed.polygons ?? [];
	if (opts.show_polygons) {
		for (const polygon of polygons) {
			const palette = FLIGHT_CATEGORY_FILL[polygon.category];
			activeCategories.add(polygon.category);
			polygonOverlays.push({
				id: polygon.id,
				rings: polygon.rings,
				style: {
					stroke: palette.stroke,
					fill: palette.fill,
					fillOpacity: palette.fillOpacity,
				},
				label: polygon.label !== undefined ? { text: polygon.label } : undefined,
				labelLonLat: polygon.labelLonLat,
				classSuffix: `cva-${polygon.category.toLowerCase()}`,
			});
		}
	}

	// 6. Layer bands.
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

	// CVA polygons go in vector-symbology so they sit beneath the dot
	// overlay; per-station dots overlay on top in point-symbology.
	bands[LAYER_BANDS.VECTOR_SYMBOLOGY] = renderPolygonOverlays(polygonOverlays, { projection });
	bands[LAYER_BANDS.POINT_SYMBOLOGY] = dots
		.map((dot) => renderCategoryDot(dot, { dotRadiusPx: opts.dot_radius_px, showLabel: opts.show_station_labels }))
		.join('\n');

	// Chrome.
	const chrome = buildChrome({
		title: input.spec.title,
		subtitle: input.spec.subtitle,
		rightTitle: 'CONUS - CVA',
		rightSubtitle: sourceParsed.targetTimestamp !== undefined ? `Valid ${sourceParsed.targetTimestamp}` : undefined,
		sourceAttribution:
			opts.source_attribution ??
			sourceParsed.source ??
			'AWC Ceiling and Visibility Analysis (https://aviationweather.gov/cva)',
		libraryVersion: input.libraryVersion,
	});
	const legendFragment = opts.show_legend ? renderCategoryLegend(activeCategories) : '';
	bands[LAYER_BANDS.CHROME] = `${chrome.titleBand}\n${legendFragment}\n${chrome.footerBand}`;

	const svg = composeChart(bands);

	return {
		svg,
		meta: {
			layer_counts: {
				[LAYER_BANDS.VECTOR_SYMBOLOGY]: polygonOverlays.length,
				[LAYER_BANDS.POINT_SYMBOLOGY]: dots.length,
				[LAYER_BANDS.BASEMAP_FILL]: basemap.states.features.length,
			},
			drawn_pixels: 0,
			parser_warnings: parserWarnings,
		},
	};
}
