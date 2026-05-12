/**
 * AIRMET / SIGMET / Convective SIGMET overlay chart renderer.
 *
 * Composes the substrate (basemap + projection + chrome) with polygon
 * overlays styled per advisory family (AIRMET Sierra/Tango/Zulu, SIGMET,
 * Convective SIGMET), plus a chrome legend listing the active advisory
 * families.
 *
 * Source data shape (single JSON file):
 *
 * ```json
 * {
 *   "issued": "2024-12-23T12:00:00Z",
 *   "advisories": [
 *     {
 *       "id": "WAUS43-KKCI-SIERRA-1",
 *       "kind": "airmet-sierra",
 *       "label": "AIRMET S\nIFR / Mtn Obscn\nValid 12-18Z",
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
import { ADVISORY_PALETTE } from '../raster/palettes';
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

const airmetSigmetOptionsSchema = z.object({
	show_legend: z.boolean().default(true),
	show_labels: z.boolean().default(true),
	source_attribution: z.string().optional(),
});

export const airmetSigmetSpecSchema = z.object({
	slug: z.string(),
	type: z.literal(CHART_TYPES.ADVISORY_OVERLAY),
	title: z.string().min(1),
	subtitle: z.string().optional(),
	projection: projectionSchema,
	extent: extentSchema,
	sources: z.object({
		advisories: z.string(),
	}),
	options: airmetSigmetOptionsSchema.optional(),
});

export type AirmetSigmetSpec = z.infer<typeof airmetSigmetSpecSchema> & ChartSpec;

// ------------------------------------------------------------------
// Source-data shape
// ------------------------------------------------------------------

const advisoryKindSchema = z.enum(['airmet-sierra', 'airmet-tango', 'airmet-zulu', 'sigmet', 'convective-sigmet']);

const ringSchema = z.array(z.tuple([z.number(), z.number()])).min(3);

const advisorySchema = z.object({
	id: z.string().min(1),
	kind: advisoryKindSchema,
	label: z.string().optional(),
	labelLonLat: z.tuple([z.number(), z.number()]).optional(),
	rings: z.array(ringSchema).min(1),
});

const advisoriesSourceSchema = z.object({
	issued: z.string().optional(),
	advisories: z.array(advisorySchema),
});

type AdvisoryKind = z.infer<typeof advisoryKindSchema>;

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function decodeSourceText(value: Uint8Array | string): string {
	if (typeof value === 'string') return value;
	return new TextDecoder('utf-8').decode(value);
}

function renderActiveLegend(activeKinds: ReadonlySet<AdvisoryKind>): string {
	const entries: Array<{ kind: AdvisoryKind; entry: (typeof ADVISORY_PALETTE)[string] }> = [];
	for (const kind of activeKinds) {
		const entry = ADVISORY_PALETTE[kind];
		if (entry !== undefined) entries.push({ kind, entry });
	}
	if (entries.length === 0) return '';
	const rowHeight = 18;
	const swatchWidth = 24;
	const padding = 10;
	const labelWidth = 220;
	const boxWidth = swatchWidth + 8 + labelWidth + padding * 2;
	const boxHeight = entries.length * rowHeight + padding * 2 + 14;
	const x0 = SVG_WIDTH - CHART_MARGIN - boxWidth;
	const y0 = SVG_HEIGHT - CHART_MARGIN - boxHeight - 24; // leave room for chrome footer
	const titleFragment = `<text x="${(x0 + padding).toFixed(1)}" y="${(y0 + padding + 10).toFixed(1)}" font-size="10" font-weight="700" fill="#3d3a32" letter-spacing="0.6">ACTIVE ADVISORIES</text>`;
	const rows = entries
		.map(({ entry }, i) => {
			const rowY = y0 + padding + 14 + i * rowHeight;
			const dasharrayAttr = entry.dasharray !== undefined ? ` stroke-dasharray="${entry.dasharray}"` : '';
			return `<g class="legend-entry">
    <rect x="${(x0 + padding).toFixed(1)}" y="${rowY.toFixed(1)}" width="${swatchWidth}" height="${(rowHeight - 4).toFixed(1)}" fill="${entry.fill}" fill-opacity="${entry.fillOpacity}" stroke="${entry.stroke}" stroke-width="1.4"${dasharrayAttr} />
    <text x="${(x0 + padding + swatchWidth + 8).toFixed(1)}" y="${(rowY + rowHeight - 6).toFixed(1)}" font-size="10" fill="#3d3a32">${entry.label}</text>
  </g>`;
		})
		.join('\n');
	return `<g class="legend advisory-legend">
  <rect x="${x0}" y="${y0}" width="${boxWidth}" height="${boxHeight}" fill="white" fill-opacity="0.92" stroke="#bdb9ac" stroke-width="0.6" rx="3" />
  ${titleFragment}
  ${rows}
</g>`;
}

// ------------------------------------------------------------------
// Renderer entry point
// ------------------------------------------------------------------

export async function renderAirmetSigmet(input: ChartRenderInput<AirmetSigmetSpec>): Promise<ChartRenderResult> {
	const opts = airmetSigmetOptionsSchema.parse(input.spec.options ?? {});

	// 1. Resolve source data.
	const advisoriesBytes = input.sources.advisories;
	if (advisoriesBytes === undefined) {
		throw new Error("airmet-sigmet: required source 'advisories' missing from input.sources");
	}
	const advisoriesJson = decodeSourceText(advisoriesBytes);
	const sourceParsed = advisoriesSourceSchema.parse(JSON.parse(advisoriesJson));

	// 2. Basemap (test seam matches surface-analysis).
	const basemapBytes = input.sources.basemap;
	let basemapJson: string;
	if (basemapBytes !== undefined) {
		basemapJson = decodeSourceText(basemapBytes);
	} else {
		basemapJson = await readBasemapTopoJson('airmet-sigmet', input.basemapPath);
	}
	// Canada + Mexico context outlines (ADR 027 Option A). Optional --
	// tests may omit; CLI passes contextBasemapPath. When neither is
	// supplied, the layer renders empty and the chart still composes.
	const contextBytes = input.sources['basemap-context'];
	let contextJson: string | null = null;
	if (contextBytes !== undefined) {
		contextJson = decodeSourceText(contextBytes);
	} else if (input.contextBasemapPath !== undefined) {
		contextJson = await readBasemapTopoJson('airmet-sigmet', input.contextBasemapPath);
	}
	const basemap = loadConusBasemapFromString(basemapJson, null, contextJson);

	// 3. Projection.
	const projection = lambertProjection({
		parallels: input.spec.projection.parallels,
		rotate: input.spec.projection.rotate,
		fitTarget: basemap.states as unknown as FitTarget,
	});
	const path = geoPath(projection);

	// 4. Build polygon overlays per advisory.
	const overlays: PolygonOverlay[] = [];
	const activeKinds = new Set<AdvisoryKind>();
	for (const advisory of sourceParsed.advisories) {
		const palette = ADVISORY_PALETTE[advisory.kind];
		if (palette === undefined) continue;
		activeKinds.add(advisory.kind);
		overlays.push({
			id: advisory.id,
			rings: advisory.rings,
			style: {
				stroke: palette.stroke,
				fill: palette.fill,
				fillOpacity: palette.fillOpacity,
				dasharray: palette.dasharray,
				thunderstormGlyph: advisory.kind === 'convective-sigmet',
			},
			label: opts.show_labels && advisory.label !== undefined ? { text: advisory.label } : undefined,
			labelLonLat: advisory.labelLonLat,
			classSuffix: advisory.kind,
		});
	}

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

	// Vector symbology -- the polygon overlays themselves.
	bands[LAYER_BANDS.VECTOR_SYMBOLOGY] = renderPolygonOverlays(overlays, { projection });

	// Chrome (title + footer + legend).
	const chrome = buildChrome({
		title: input.spec.title,
		subtitle: input.spec.subtitle,
		rightTitle: 'CONUS - Lambert Conformal 33/45',
		sourceAttribution: opts.source_attribution ?? 'AWC AIRMET / SIGMET archive',
		libraryVersion: input.libraryVersion,
	});
	const legendFragment = opts.show_legend ? renderActiveLegend(activeKinds) : '';
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
