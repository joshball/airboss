/**
 * Graphical Forecasts for Aviation (GFA) chart renderer.
 *
 * Per AC 00-45H Ch 5 + AWC product page (https://aviationweather.gov/gfa),
 * the GFA is the AWC's CONUS-wide graphical forecast product replacing the
 * legacy Area Forecast (FA) text product. It shows clouds, precipitation,
 * surface visibility, and IFR conditions across CONUS, partitioned into
 * altitude bands (SFC-180 for low-altitude piston / turbo-prop ops; 180-450
 * for jet ops).
 *
 * The renderer takes a polygon bundle keyed by polygon kind (cloud cover,
 * precipitation type, IFR / MVFR area) and overlays them on the substrate
 * with the canonical AWC polygon palette (`GFA_PALETTE`). The chrome
 * legend lists the active polygon families for the rendered altitude band.
 *
 * Source data shape (single JSON file):
 *
 * ```json
 * {
 *   "issued": "2024-12-23T12:00:00Z",
 *   "valid_at": "2024-12-23T15:00:00Z",
 *   "altitude_band": "SFC-180",
 *   "polygons": [
 *     {
 *       "id": "GFA-CLOUD-1",
 *       "kind": "clouds_bkn_ovc",
 *       "label": "BKN OVC\n040-180",
 *       "rings": [[[lon, lat], ...]]
 *     },
 *     ...
 *   ]
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
import { GFA_PALETTE, type GfaPolygonKind } from '../raster/palettes';
import { type PolygonOverlay, renderPolygonOverlays } from '../symbology/polygons';
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

/**
 * Altitude band selector per the AWC GFA product. SFC-180 covers low-
 * altitude piston / turbo-prop ops (surface to 18,000 ft MSL); 180-450
 * covers jet ops (FL180 to FL450).
 */
const ALTITUDE_BANDS = ['SFC-180', '180-450'] as const;
const altitudeBandSchema = z.enum(ALTITUDE_BANDS);

const gfaOptionsSchema = z.object({
	show_legend: z.boolean().default(true),
	show_labels: z.boolean().default(true),
	source_attribution: z.string().optional(),
});

export const gfaSpecSchema = z.object({
	slug: z.string(),
	type: z.literal(CHART_TYPES.GFA),
	title: z.string().min(1),
	subtitle: z.string().optional(),
	projection: projectionSchema,
	extent: extentSchema,
	sources: z.object({
		polygons: z.string(),
	}),
	options: gfaOptionsSchema.optional(),
});

export type GfaSpec = z.infer<typeof gfaSpecSchema> & ChartSpec;

// ------------------------------------------------------------------
// Source-data shape
// ------------------------------------------------------------------

const polygonKindSchema = z.enum([
	'clouds_few_sct',
	'clouds_bkn_ovc',
	'precip_rain',
	'precip_snow',
	'precip_mixed',
	'precip_tstm',
	'ifr_area',
	'mvfr_area',
]);

const ringSchema = z.array(z.tuple([z.number(), z.number()])).min(3);

const polygonSchema = z.object({
	id: z.string().min(1),
	kind: polygonKindSchema,
	label: z.string().optional(),
	labelLonLat: z.tuple([z.number(), z.number()]).optional(),
	rings: z.array(ringSchema).min(1),
});

const gfaSourceSchema = z.object({
	issued: z.string().optional(),
	valid_at: z.string().optional(),
	altitude_band: altitudeBandSchema.optional(),
	polygons: z.array(polygonSchema),
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
		throw new Error('gfa: cannot read basemap file -- no process.getBuiltinModule available');
	}
	const fs = getBuiltin('node:fs') as NodeFs;
	return fs.promises.readFile(path, 'utf8');
}

/**
 * Z-order for GFA polygon kinds. Lower index drawn first (back); higher
 * index layered on top. Cloud polygons sit at the back; precipitation
 * areas above them; IFR / MVFR area shading on top so the operationally
 * critical "where can't I fly VFR" overlay is unmissable.
 */
const POLYGON_DRAW_ORDER: Record<GfaPolygonKind, number> = {
	clouds_few_sct: 0,
	clouds_bkn_ovc: 1,
	precip_rain: 2,
	precip_snow: 3,
	precip_mixed: 4,
	precip_tstm: 5,
	mvfr_area: 6,
	ifr_area: 7,
};

function renderGfaLegend(activeKinds: ReadonlySet<GfaPolygonKind>, altitudeBand: string | undefined): string {
	// Walk in z-order so the legend rows match the visual stack.
	const ordered = Object.entries(POLYGON_DRAW_ORDER)
		.sort((a, b) => a[1] - b[1])
		.map(([k]) => k as GfaPolygonKind);
	const entries: Array<{ kind: GfaPolygonKind; entry: (typeof GFA_PALETTE)[GfaPolygonKind] }> = [];
	for (const kind of ordered) {
		if (!activeKinds.has(kind)) continue;
		entries.push({ kind, entry: GFA_PALETTE[kind] });
	}
	if (entries.length === 0) return '';
	const rowHeight = 16;
	const swatchWidth = 24;
	const padding = 10;
	const labelWidth = 200;
	const boxWidth = swatchWidth + 8 + labelWidth + padding * 2;
	const headerLines = altitudeBand !== undefined ? 2 : 1;
	const boxHeight = entries.length * rowHeight + padding * 2 + 14 + (headerLines - 1) * 14;
	const x0 = SVG_WIDTH - CHART_MARGIN - boxWidth;
	const y0 = SVG_HEIGHT - CHART_MARGIN - boxHeight - 24;
	const titleY = y0 + padding + 10;
	const titleFragment = `<text x="${(x0 + padding).toFixed(1)}" y="${titleY.toFixed(1)}" font-size="10" font-weight="700" fill="#3d3a32" letter-spacing="0.6">GFA POLYGONS</text>`;
	const altitudeFragment =
		altitudeBand !== undefined
			? `<text x="${(x0 + padding).toFixed(1)}" y="${(titleY + 12).toFixed(1)}" font-size="9" font-weight="600" fill="#5a5750">Altitude: ${altitudeBand}</text>`
			: '';
	const startRowY = titleY + 4 + (altitudeBand !== undefined ? 14 : 0);
	const rows = entries
		.map(({ entry }, i) => {
			const rowY = startRowY + i * rowHeight;
			const dasharrayAttr = entry.dasharray !== undefined ? ` stroke-dasharray="${entry.dasharray}"` : '';
			return `<g class="legend-entry">
    <rect x="${(x0 + padding).toFixed(1)}" y="${rowY.toFixed(1)}" width="${swatchWidth}" height="${(rowHeight - 4).toFixed(1)}" fill="${entry.fill}" fill-opacity="${entry.fillOpacity}" stroke="${entry.stroke}" stroke-width="1.2"${dasharrayAttr} />
    <text x="${(x0 + padding + swatchWidth + 8).toFixed(1)}" y="${(rowY + rowHeight - 5).toFixed(1)}" font-size="9" fill="#3d3a32">${entry.label}</text>
  </g>`;
		})
		.join('\n');
	return `<g class="legend gfa-legend">
  <rect x="${x0}" y="${y0}" width="${boxWidth}" height="${boxHeight}" fill="white" fill-opacity="0.92" stroke="#bdb9ac" stroke-width="0.6" rx="3" />
  ${titleFragment}
  ${altitudeFragment}
  ${rows}
</g>`;
}

// ------------------------------------------------------------------
// Renderer entry point
// ------------------------------------------------------------------

export async function renderGfa(input: ChartRenderInput<GfaSpec>): Promise<ChartRenderResult> {
	const opts = gfaOptionsSchema.parse(input.spec.options ?? {});

	// 1. Resolve source data.
	const polygonsBytes = input.sources.polygons;
	if (polygonsBytes === undefined) {
		throw new Error("gfa: required source 'polygons' missing from input.sources");
	}
	const polygonsJson = decodeSourceText(polygonsBytes);
	const sourceParsed = gfaSourceSchema.parse(JSON.parse(polygonsJson));

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

	// 4. Build polygon overlays per polygon, sorted into z-order so cloud
	//    layers sit at the back and IFR / MVFR overlays on top.
	const sortedPolygons = [...sourceParsed.polygons].sort((a, b) => {
		const aOrder = POLYGON_DRAW_ORDER[a.kind];
		const bOrder = POLYGON_DRAW_ORDER[b.kind];
		return aOrder - bOrder;
	});
	const overlays: PolygonOverlay[] = [];
	const activeKinds = new Set<GfaPolygonKind>();
	for (const polygon of sortedPolygons) {
		const palette = GFA_PALETTE[polygon.kind];
		activeKinds.add(polygon.kind);
		overlays.push({
			id: polygon.id,
			rings: polygon.rings,
			style: {
				stroke: palette.stroke,
				fill: palette.fill,
				fillOpacity: palette.fillOpacity,
				dasharray: palette.dasharray,
			},
			label: opts.show_labels && polygon.label !== undefined ? { text: polygon.label } : undefined,
			labelLonLat: polygon.labelLonLat,
			classSuffix: `gfa-${polygon.kind.replace(/_/g, '-')}`,
		});
	}

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

	// All polygon overlays go in vector-symbology, drawn in z-order
	// (cloud back, precipitation middle, IFR/MVFR front).
	bands[LAYER_BANDS.VECTOR_SYMBOLOGY] = renderPolygonOverlays(overlays, { projection });

	// Chrome (title + footer + legend).
	const altitudeBandLabel = sourceParsed.altitude_band ?? 'SFC-180';
	const chrome = buildChrome({
		title: input.spec.title,
		subtitle: input.spec.subtitle,
		rightTitle: `CONUS GFA ${altitudeBandLabel}`,
		rightSubtitle: sourceParsed.valid_at !== undefined ? `Valid ${sourceParsed.valid_at}` : undefined,
		sourceAttribution:
			opts.source_attribution ?? 'AWC Graphical Forecasts for Aviation (https://aviationweather.gov/gfa)',
		libraryVersion: input.libraryVersion,
	});
	const legendFragment = opts.show_legend ? renderGfaLegend(activeKinds, sourceParsed.altitude_band) : '';
	bands[LAYER_BANDS.CHROME] = `${chrome.titleBand}\n${legendFragment}\n${chrome.footerBand}`;

	const svg = composeChart(bands);

	return {
		svg,
		meta: {
			layer_counts: {
				[LAYER_BANDS.VECTOR_SYMBOLOGY]: overlays.length,
				[LAYER_BANDS.BASEMAP_FILL]: basemap.states.features.length,
			},
			drawn_pixels: 0,
			parser_warnings: [],
		},
	};
}
