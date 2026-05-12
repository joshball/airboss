/**
 * SPC convective outlook chart renderer.
 *
 * Per AC 00-45H Ch 5 + the NWS Storm Prediction Center
 * (https://www.spc.noaa.gov/products/outlook/), the SPC issues categorical
 * convective outlooks for Day 1 / Day 2 / Day 3+ showing tier polygons
 * across CONUS. Six tiers from "general thunderstorm" through "high risk":
 *
 *   TSTM (general thunder) -> MRGL -> SLGT -> ENH -> MDT -> HIGH
 *
 * The renderer overlays each tier polygon with the canonical SPC color
 * palette and stacks them by tier index so the outermost (lowest risk)
 * tier sits at the back and the innermost (highest risk) tier sits on
 * top. The chrome legend lists the active tiers and the day selector.
 *
 * Source data shape (single JSON file):
 *
 * ```json
 * {
 *   "issued": "2024-05-21T12:00:00Z",
 *   "valid_from": "2024-05-21T12:00:00Z",
 *   "valid_to": "2024-05-22T12:00:00Z",
 *   "day": 1,
 *   "polygons": [
 *     {
 *       "id": "SPC-TSTM-1",
 *       "tier": "tstm",
 *       "label": "TSTM",
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
import { loadConusBasemapFromString, readBasemapTopoJson, renderNorthAmericaContextLayer } from '../basemap';
import { buildChrome } from '../chrome';
import { renderGraticule } from '../graticule';
import { composeChart, type LayerBandMap } from '../layers';
import { CHART_MARGIN, type FitTarget, lambertProjection, SVG_HEIGHT, SVG_WIDTH } from '../projection';
import { CONVECTIVE_OUTLOOK_PALETTE, CONVECTIVE_OUTLOOK_TIERS, type ConvectiveOutlookTier } from '../raster/palettes';
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

const convectiveOutlookOptionsSchema = z.object({
	show_legend: z.boolean().default(true),
	show_labels: z.boolean().default(true),
	source_attribution: z.string().optional(),
});

export const convectiveOutlookSpecSchema = z.object({
	slug: z.string(),
	type: z.literal(CHART_TYPES.CONVECTIVE_OUTLOOK),
	title: z.string().min(1),
	subtitle: z.string().optional(),
	projection: projectionSchema,
	extent: extentSchema,
	sources: z.object({
		outlook: z.string(),
	}),
	options: convectiveOutlookOptionsSchema.optional(),
});

export type ConvectiveOutlookSpec = z.infer<typeof convectiveOutlookSpecSchema> & ChartSpec;

// ------------------------------------------------------------------
// Source-data shape
// ------------------------------------------------------------------

const tierSchema = z.enum([
	CONVECTIVE_OUTLOOK_TIERS.TSTM,
	CONVECTIVE_OUTLOOK_TIERS.MRGL,
	CONVECTIVE_OUTLOOK_TIERS.SLGT,
	CONVECTIVE_OUTLOOK_TIERS.ENH,
	CONVECTIVE_OUTLOOK_TIERS.MDT,
	CONVECTIVE_OUTLOOK_TIERS.HIGH,
]);

const ringSchema = z.array(z.tuple([z.number(), z.number()])).min(3);

const polygonSchema = z.object({
	id: z.string().min(1),
	tier: tierSchema,
	label: z.string().optional(),
	labelLonLat: z.tuple([z.number(), z.number()]).optional(),
	rings: z.array(ringSchema).min(1),
});

const outlookSourceSchema = z.object({
	issued: z.string().optional(),
	valid_from: z.string().optional(),
	valid_to: z.string().optional(),
	day: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
	polygons: z.array(polygonSchema),
});

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function decodeSourceText(value: Uint8Array | string): string {
	if (typeof value === 'string') return value;
	return new TextDecoder('utf-8').decode(value);
}

function renderTierLegend(activeTiers: ReadonlySet<ConvectiveOutlookTier>, day: number | undefined): string {
	// Walk in canonical SPC tier order (lowest risk -> highest risk).
	const ordered: ConvectiveOutlookTier[] = [
		CONVECTIVE_OUTLOOK_TIERS.TSTM,
		CONVECTIVE_OUTLOOK_TIERS.MRGL,
		CONVECTIVE_OUTLOOK_TIERS.SLGT,
		CONVECTIVE_OUTLOOK_TIERS.ENH,
		CONVECTIVE_OUTLOOK_TIERS.MDT,
		CONVECTIVE_OUTLOOK_TIERS.HIGH,
	];
	const entries: Array<{
		tier: ConvectiveOutlookTier;
		entry: (typeof CONVECTIVE_OUTLOOK_PALETTE)[ConvectiveOutlookTier];
	}> = [];
	for (const tier of ordered) {
		if (!activeTiers.has(tier)) continue;
		entries.push({ tier, entry: CONVECTIVE_OUTLOOK_PALETTE[tier] });
	}
	if (entries.length === 0) return '';
	const rowHeight = 18;
	const swatchWidth = 24;
	const padding = 10;
	const labelWidth = 220;
	const boxWidth = swatchWidth + 8 + labelWidth + padding * 2;
	const headerLines = day !== undefined ? 2 : 1;
	const boxHeight = entries.length * rowHeight + padding * 2 + 14 + (headerLines - 1) * 14;
	const x0 = SVG_WIDTH - CHART_MARGIN - boxWidth;
	const y0 = SVG_HEIGHT - CHART_MARGIN - boxHeight - 24;
	const titleY = y0 + padding + 10;
	const titleFragment = `<text x="${(x0 + padding).toFixed(1)}" y="${titleY.toFixed(1)}" font-size="10" font-weight="700" fill="#3d3a32" letter-spacing="0.6">SPC CATEGORICAL RISK</text>`;
	const dayFragment =
		day !== undefined
			? `<text x="${(x0 + padding).toFixed(1)}" y="${(titleY + 12).toFixed(1)}" font-size="9" font-weight="600" fill="#5a5750">Day ${day} convective outlook</text>`
			: '';
	const startRowY = titleY + 4 + (day !== undefined ? 14 : 0);
	const rows = entries
		.map(({ entry }, i) => {
			const rowY = startRowY + i * rowHeight;
			return `<g class="legend-entry">
    <rect x="${(x0 + padding).toFixed(1)}" y="${rowY.toFixed(1)}" width="${swatchWidth}" height="${(rowHeight - 4).toFixed(1)}" fill="${entry.fill}" fill-opacity="${entry.fillOpacity}" stroke="${entry.stroke}" stroke-width="1.4" />
    <text x="${(x0 + padding + swatchWidth + 8).toFixed(1)}" y="${(rowY + rowHeight - 6).toFixed(1)}" font-size="10" fill="#3d3a32">${entry.label}</text>
  </g>`;
		})
		.join('\n');
	return `<g class="legend convective-outlook-legend">
  <rect x="${x0}" y="${y0}" width="${boxWidth}" height="${boxHeight}" fill="white" fill-opacity="0.92" stroke="#bdb9ac" stroke-width="0.6" rx="3" />
  ${titleFragment}
  ${dayFragment}
  ${rows}
</g>`;
}

// ------------------------------------------------------------------
// Renderer entry point
// ------------------------------------------------------------------

export async function renderConvectiveOutlook(
	input: ChartRenderInput<ConvectiveOutlookSpec>,
): Promise<ChartRenderResult> {
	const opts = convectiveOutlookOptionsSchema.parse(input.spec.options ?? {});

	// 1. Resolve source data.
	const outlookBytes = input.sources.outlook;
	if (outlookBytes === undefined) {
		throw new Error("convective-outlook: required source 'outlook' missing from input.sources");
	}
	const outlookJson = decodeSourceText(outlookBytes);
	const sourceParsed = outlookSourceSchema.parse(JSON.parse(outlookJson));

	// 2. Basemap.
	const basemapBytes = input.sources.basemap;
	let basemapJson: string;
	if (basemapBytes !== undefined) {
		basemapJson = decodeSourceText(basemapBytes);
	} else {
		basemapJson = await readBasemapTopoJson('convective-outlook', input.basemapPath);
	}
	// Canada + Mexico context outlines (ADR 027 Option A). Optional --
	// tests may omit; CLI passes contextBasemapPath. When neither is
	// supplied, the layer renders empty and the chart still composes.
	const contextBytes = input.sources['basemap-context'];
	let contextJson: string | null = null;
	if (contextBytes !== undefined) {
		contextJson = decodeSourceText(contextBytes);
	} else if (input.contextBasemapPath !== undefined) {
		contextJson = await readBasemapTopoJson('convective-outlook', input.contextBasemapPath);
	}
	const basemap = loadConusBasemapFromString(basemapJson, null, contextJson);

	// 3. Projection.
	const projection = lambertProjection({
		parallels: input.spec.projection.parallels,
		rotate: input.spec.projection.rotate,
		fitTarget: basemap.states as unknown as FitTarget,
	});
	const path = geoPath(projection);

	// 4. Sort polygons by tier order so the outermost (lowest risk) tier
	//    is drawn first and inner tiers stack on top -- this matches the
	//    canonical SPC outlook PNG.
	const sortedPolygons = [...sourceParsed.polygons].sort((a, b) => {
		return CONVECTIVE_OUTLOOK_PALETTE[a.tier].order - CONVECTIVE_OUTLOOK_PALETTE[b.tier].order;
	});

	// 5. Build polygon overlays.
	const overlays: PolygonOverlay[] = [];
	const activeTiers = new Set<ConvectiveOutlookTier>();
	for (const polygon of sortedPolygons) {
		const palette = CONVECTIVE_OUTLOOK_PALETTE[polygon.tier];
		activeTiers.add(polygon.tier);
		overlays.push({
			id: polygon.id,
			rings: polygon.rings,
			style: {
				stroke: palette.stroke,
				fill: palette.fill,
				fillOpacity: palette.fillOpacity,
			},
			label: opts.show_labels && polygon.label !== undefined ? { text: polygon.label } : undefined,
			labelLonLat: polygon.labelLonLat,
			classSuffix: `spc-${polygon.tier}`,
		});
	}

	// 6. Layer bands.
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

	bands[LAYER_BANDS.VECTOR_SYMBOLOGY] = renderPolygonOverlays(overlays, { projection });

	// Chrome (title + footer + legend).
	const dayLabel = sourceParsed.day !== undefined ? `Day ${sourceParsed.day}` : 'Day 1';
	const chrome = buildChrome({
		title: input.spec.title,
		subtitle: input.spec.subtitle,
		rightTitle: `CONUS - SPC ${dayLabel}`,
		rightSubtitle: sourceParsed.valid_to !== undefined ? `Valid through ${sourceParsed.valid_to}` : undefined,
		sourceAttribution:
			opts.source_attribution ?? 'NWS Storm Prediction Center (https://www.spc.noaa.gov/products/outlook/)',
		libraryVersion: input.libraryVersion,
	});
	const legendFragment = opts.show_legend ? renderTierLegend(activeTiers, sourceParsed.day) : '';
	bands[LAYER_BANDS.CHROME] = `${chrome.titleBand}\n${legendFragment}\n${chrome.footerBand}`;

	const svg = composeChart(bands);

	return {
		svg,
		meta: {
			layer_counts: {
				[LAYER_BANDS.VECTOR_SYMBOLOGY]: overlays.length,
				[LAYER_BANDS.BASEMAP_FILL]: basemap.states.features.length,
				[LAYER_BANDS.NORTH_AMERICA_CONTEXT]: basemap.northAmericaContext.features.length,
			},
			drawn_pixels: 0,
			parser_warnings: [],
		},
	};
}
