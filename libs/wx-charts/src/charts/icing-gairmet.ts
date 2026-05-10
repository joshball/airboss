/**
 * G-AIRMET icing chart renderer.
 *
 * Composes the substrate (basemap + projection + chrome) with polygon
 * overlays styled per icing-intensity tier (light / light-mod / moderate /
 * severe) per AC 00-45H Ch 5 and Aviation Weather Handbook (FAA-H-8083-28)
 * Ch 19. The G-AIRMET product evolved from the legacy AIRMET Zulu (icing)
 * by partitioning the forecast into discrete severity polygons rather than
 * a single airmet bound; the pedagogy here is "you read the COLOUR for
 * severity, not the polygon presence."
 *
 * Source data shape (single JSON file):
 *
 * ```json
 * {
 *   "issued": "2024-12-23T12:00:00Z",
 *   "valid_from": "2024-12-23T12:00:00Z",
 *   "valid_to": "2024-12-23T15:00:00Z",
 *   "areas": [
 *     {
 *       "id": "GA-ICE-1",
 *       "intensity": "icing-moderate",
 *       "type": "mixed",
 *       "altLow": 6000,
 *       "altHigh": 14000,
 *       "label": "MOD MX ICE\\n060-140",
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
import { ICING_INTENSITY_PALETTE } from '../raster/palettes';
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

const icingGairmetOptionsSchema = z.object({
	show_legend: z.boolean().default(true),
	show_labels: z.boolean().default(true),
	source_attribution: z.string().optional(),
});

export const icingGairmetSpecSchema = z.object({
	slug: z.string(),
	type: z.literal(CHART_TYPES.ICING_GAIRMET),
	title: z.string().min(1),
	subtitle: z.string().optional(),
	projection: projectionSchema,
	extent: extentSchema,
	sources: z.object({
		areas: z.string(),
	}),
	options: icingGairmetOptionsSchema.optional(),
});

export type IcingGairmetSpec = z.infer<typeof icingGairmetSpecSchema> & ChartSpec;

// ------------------------------------------------------------------
// Source-data shape
// ------------------------------------------------------------------

const intensitySchema = z.enum(['icing-light', 'icing-light-mod', 'icing-moderate', 'icing-severe']);
const icingTypeSchema = z.enum(['rime', 'clear', 'mixed', 'unspecified']);

const ringSchema = z.array(z.tuple([z.number(), z.number()])).min(3);

const areaSchema = z.object({
	id: z.string().min(1),
	intensity: intensitySchema,
	type: icingTypeSchema.optional(),
	altLow: z.number().int().nonnegative().optional(),
	altHigh: z.number().int().nonnegative().optional(),
	label: z.string().optional(),
	labelLonLat: z.tuple([z.number(), z.number()]).optional(),
	rings: z.array(ringSchema).min(1),
});

const areasSourceSchema = z.object({
	issued: z.string().optional(),
	valid_from: z.string().optional(),
	valid_to: z.string().optional(),
	areas: z.array(areaSchema),
});

type IcingIntensity = z.infer<typeof intensitySchema>;

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
		throw new Error('icing-gairmet: cannot read basemap file -- no process.getBuiltinModule available');
	}
	const fs = getBuiltin('node:fs') as NodeFs;
	return fs.promises.readFile(path, 'utf8');
}

function renderActiveLegend(activeIntensities: ReadonlySet<IcingIntensity>): string {
	const ordered: IcingIntensity[] = ['icing-light', 'icing-light-mod', 'icing-moderate', 'icing-severe'];
	const entries: Array<{ intensity: IcingIntensity; entry: (typeof ICING_INTENSITY_PALETTE)[string] }> = [];
	for (const intensity of ordered) {
		if (!activeIntensities.has(intensity)) continue;
		const entry = ICING_INTENSITY_PALETTE[intensity];
		if (entry !== undefined) entries.push({ intensity, entry });
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
	const titleFragment = `<text x="${(x0 + padding).toFixed(1)}" y="${(y0 + padding + 10).toFixed(1)}" font-size="10" font-weight="700" fill="#3d3a32" letter-spacing="0.6">ICING SEVERITY</text>`;
	const rows = entries
		.map(({ entry }, i) => {
			const rowY = y0 + padding + 14 + i * rowHeight;
			return `<g class="legend-entry">
    <rect x="${(x0 + padding).toFixed(1)}" y="${rowY.toFixed(1)}" width="${swatchWidth}" height="${(rowHeight - 4).toFixed(1)}" fill="${entry.fill}" fill-opacity="${entry.fillOpacity}" stroke="${entry.stroke}" stroke-width="1.4" />
    <text x="${(x0 + padding + swatchWidth + 8).toFixed(1)}" y="${(rowY + rowHeight - 6).toFixed(1)}" font-size="10" fill="#3d3a32">${entry.label}</text>
  </g>`;
		})
		.join('\n');
	return `<g class="legend icing-gairmet-legend">
  <rect x="${x0}" y="${y0}" width="${boxWidth}" height="${boxHeight}" fill="white" fill-opacity="0.92" stroke="#bdb9ac" stroke-width="0.6" rx="3" />
  ${titleFragment}
  ${rows}
</g>`;
}

// ------------------------------------------------------------------
// Renderer entry point
// ------------------------------------------------------------------

export async function renderIcingGairmet(input: ChartRenderInput<IcingGairmetSpec>): Promise<ChartRenderResult> {
	const opts = icingGairmetOptionsSchema.parse(input.spec.options ?? {});

	// 1. Resolve source data.
	const areasBytes = input.sources.areas;
	if (areasBytes === undefined) {
		throw new Error("icing-gairmet: required source 'areas' missing from input.sources");
	}
	const areasJson = decodeSourceText(areasBytes);
	const sourceParsed = areasSourceSchema.parse(JSON.parse(areasJson));

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

	// 4. Build polygon overlays per area.
	const overlays: PolygonOverlay[] = [];
	const activeIntensities = new Set<IcingIntensity>();
	for (const area of sourceParsed.areas) {
		const palette = ICING_INTENSITY_PALETTE[area.intensity];
		if (palette === undefined) continue;
		activeIntensities.add(area.intensity);
		overlays.push({
			id: area.id,
			rings: area.rings,
			style: {
				stroke: palette.stroke,
				fill: palette.fill,
				fillOpacity: palette.fillOpacity,
				dasharray: palette.dasharray,
			},
			label: opts.show_labels && area.label !== undefined ? { text: area.label } : undefined,
			labelLonLat: area.labelLonLat,
			classSuffix: area.intensity,
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

	bands[LAYER_BANDS.VECTOR_SYMBOLOGY] = renderPolygonOverlays(overlays, { projection });

	// Chrome (title + footer + legend).
	const chrome = buildChrome({
		title: input.spec.title,
		subtitle: input.spec.subtitle,
		rightTitle: 'CONUS - Lambert Conformal 33/45',
		sourceAttribution: opts.source_attribution ?? 'AWC G-AIRMET (icing) archive',
		libraryVersion: input.libraryVersion,
	});
	const legendFragment = opts.show_legend ? renderActiveLegend(activeIntensities) : '';
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
