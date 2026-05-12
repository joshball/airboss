/**
 * G-AIRMET Turbulence chart renderer.
 *
 * Composes the substrate (basemap + projection + chrome) with turbulence
 * area polygons drawn per AC 00-45H Chapter 5 conventions: severity by
 * fill colour (light = thin orange, moderate = orange, severe = red),
 * altitude band noted in the polygon label, valid-time noted in chrome.
 *
 * G-AIRMETs are graphical airmen's meteorological information products
 * issued by the Aviation Weather Center (AWC). The turbulence variant
 * supersedes the textual AIRMET Tango for graphical advisory purposes:
 * each polygon is a distinct hazard area with severity, altitude span,
 * and a valid period (typically 3-hour increments out to T+12).
 *
 * This renderer is deliberately a sibling of the AIRMET / SIGMET overlay
 * (`charts/airmet-sigmet.ts`) -- both consume polygon symbology via
 * `symbology/polygons.ts`, but G-AIRMET turbulence carries its own
 * severity-tier semantics (three-tier ramp) plus altitude band labels
 * and a single valid-time block per chart frame.
 *
 * Source data shape (single JSON file):
 *
 * ```json
 * {
 *   "issued": "2024-12-23T12:00:00Z",
 *   "valid": "2024-12-23T12:00:00Z/2024-12-23T15:00:00Z",
 *   "areas": [
 *     {
 *       "id": "G-AIRMET-TURB-1",
 *       "severity": "moderate",
 *       "topFl": 240,
 *       "bottomFl": 80,
 *       "label": "MOD TURB\nFL080-FL240",
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

const turbulenceGairmetOptionsSchema = z.object({
	show_legend: z.boolean().default(true),
	show_labels: z.boolean().default(true),
	source_attribution: z.string().optional(),
});

export const turbulenceGairmetSpecSchema = z.object({
	slug: z.string(),
	type: z.literal(CHART_TYPES.TURBULENCE_GAIRMET),
	title: z.string().min(1),
	subtitle: z.string().optional(),
	projection: projectionSchema,
	extent: extentSchema,
	sources: z.object({
		areas: z.string(),
	}),
	options: turbulenceGairmetOptionsSchema.optional(),
});

export type TurbulenceGairmetSpec = z.infer<typeof turbulenceGairmetSpecSchema> & ChartSpec;

// ------------------------------------------------------------------
// Source-data shape
// ------------------------------------------------------------------

const turbulenceSeveritySchema = z.enum(['light', 'moderate', 'severe']);

const ringSchema = z.array(z.tuple([z.number(), z.number()])).min(3);

const turbulenceAreaSchema = z.object({
	id: z.string().min(1),
	severity: turbulenceSeveritySchema,
	/** Top of the hazard layer (flight level, e.g. 240 = FL240). */
	topFl: z.number().int().nonnegative(),
	/** Bottom of the hazard layer (flight level; 0 = surface). */
	bottomFl: z.number().int().nonnegative(),
	label: z.string().optional(),
	labelLonLat: z.tuple([z.number(), z.number()]).optional(),
	rings: z.array(ringSchema).min(1),
});

const turbulenceAreasSourceSchema = z.object({
	issued: z.string().optional(),
	valid: z.string().optional(),
	areas: z.array(turbulenceAreaSchema),
});

type TurbulenceSeverity = z.infer<typeof turbulenceSeveritySchema>;

// ------------------------------------------------------------------
// Severity palette (AC 00-45H Chapter 5 convention).
// ------------------------------------------------------------------

interface SeverityPaletteEntry {
	stroke: string;
	fill: string;
	fillOpacity: number;
	dasharray?: string;
	label: string;
}

const TURBULENCE_SEVERITY_PALETTE: Record<TurbulenceSeverity, SeverityPaletteEntry> = {
	light: {
		stroke: '#c47a1f',
		fill: '#ffe1b8',
		fillOpacity: 0.32,
		dasharray: '4 3',
		label: 'Light Turbulence',
	},
	moderate: {
		stroke: '#a64500',
		fill: '#ff9a4d',
		fillOpacity: 0.32,
		label: 'Moderate Turbulence',
	},
	severe: {
		stroke: '#7a0000',
		fill: '#ff3a2a',
		fillOpacity: 0.38,
		label: 'Severe Turbulence',
	},
};

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function decodeSourceText(value: Uint8Array | string): string {
	if (typeof value === 'string') return value;
	return new TextDecoder('utf-8').decode(value);
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

function renderSeverityLegend(
	activeSeverities: ReadonlySet<TurbulenceSeverity>,
	validPeriod: string | undefined,
): string {
	const orderedSeverities: TurbulenceSeverity[] = ['light', 'moderate', 'severe'];
	const entries = orderedSeverities
		.filter((s) => activeSeverities.has(s))
		.map((severity) => ({ severity, entry: TURBULENCE_SEVERITY_PALETTE[severity] }));
	if (entries.length === 0) return '';
	const rowHeight = 18;
	const swatchWidth = 24;
	const padding = 10;
	const labelWidth = 200;
	const boxWidth = swatchWidth + 8 + labelWidth + padding * 2;
	const validPrefix = 'Valid ';
	const validRow = validPeriod !== undefined ? 1 : 0;
	const boxHeight = (entries.length + validRow) * rowHeight + padding * 2 + 14;
	const x0 = SVG_WIDTH - CHART_MARGIN - boxWidth;
	const y0 = SVG_HEIGHT - CHART_MARGIN - boxHeight - 24;
	const titleFragment = `<text x="${(x0 + padding).toFixed(1)}" y="${(y0 + padding + 10).toFixed(1)}" font-size="10" font-weight="700" fill="#3d3a32" letter-spacing="0.6">TURBULENCE INTENSITY</text>`;
	const rows = entries
		.map(({ entry }, i) => {
			const rowY = y0 + padding + 14 + i * rowHeight;
			const dasharrayAttr = entry.dasharray !== undefined ? ` stroke-dasharray="${entry.dasharray}"` : '';
			return `<g class="legend-entry">
    <rect x="${(x0 + padding).toFixed(1)}" y="${rowY.toFixed(1)}" width="${swatchWidth}" height="${(rowHeight - 4).toFixed(1)}" fill="${entry.fill}" fill-opacity="${entry.fillOpacity}" stroke="${entry.stroke}" stroke-width="1.4"${dasharrayAttr} />
    <text x="${(x0 + padding + swatchWidth + 8).toFixed(1)}" y="${(rowY + rowHeight - 6).toFixed(1)}" font-size="10" fill="#3d3a32">${escapeXml(entry.label)}</text>
  </g>`;
		})
		.join('\n');
	const validFragment =
		validPeriod !== undefined
			? `<text x="${(x0 + padding).toFixed(1)}" y="${(y0 + padding + 14 + entries.length * rowHeight + 12).toFixed(1)}" font-size="10" fill="#3d3a32" font-style="italic">${escapeXml(validPrefix)}${escapeXml(validPeriod)}</text>`
			: '';
	return `<g class="legend turbulence-legend">
  <rect x="${x0}" y="${y0}" width="${boxWidth}" height="${boxHeight}" fill="white" fill-opacity="0.92" stroke="#bdb9ac" stroke-width="0.6" rx="3" />
  ${titleFragment}
  ${rows}
  ${validFragment}
</g>`;
}

function defaultLabelText(area: { severity: TurbulenceSeverity; topFl: number; bottomFl: number }): string {
	const severityShort: Record<TurbulenceSeverity, string> = { light: 'LGT', moderate: 'MOD', severe: 'SEV' };
	const top = `FL${String(area.topFl).padStart(3, '0')}`;
	const bottom = area.bottomFl === 0 ? 'SFC' : `FL${String(area.bottomFl).padStart(3, '0')}`;
	return `${severityShort[area.severity]} TURB\n${bottom}-${top}`;
}

// ------------------------------------------------------------------
// Renderer entry point
// ------------------------------------------------------------------

export async function renderTurbulenceGairmet(
	input: ChartRenderInput<TurbulenceGairmetSpec>,
): Promise<ChartRenderResult> {
	const opts = turbulenceGairmetOptionsSchema.parse(input.spec.options ?? {});

	// 1. Resolve source data.
	const areasBytes = input.sources.areas;
	if (areasBytes === undefined) {
		throw new Error("turbulence-gairmet: required source 'areas' missing from input.sources");
	}
	const areasJson = decodeSourceText(areasBytes);
	const sourceParsed = turbulenceAreasSourceSchema.parse(JSON.parse(areasJson));

	// 2. Basemap (test seam matches surface-analysis / airmet-sigmet).
	const basemapBytes = input.sources.basemap;
	let basemapJson: string;
	if (basemapBytes !== undefined) {
		basemapJson = decodeSourceText(basemapBytes);
	} else {
		basemapJson = await readBasemapTopoJson('turbulence-gairmet', input.basemapPath);
	}
	// Canada + Mexico context outlines (ADR 027 Option A). Optional --
	// tests may omit; CLI passes contextBasemapPath. When neither is
	// supplied, the layer renders empty and the chart still composes.
	const contextBytes = input.sources['basemap-context'];
	let contextJson: string | null = null;
	if (contextBytes !== undefined) {
		contextJson = decodeSourceText(contextBytes);
	} else if (input.contextBasemapPath !== undefined) {
		contextJson = await readBasemapTopoJson('turbulence-gairmet', input.contextBasemapPath);
	}
	const basemap = loadConusBasemapFromString(basemapJson, null, contextJson);

	// 3. Projection.
	const projection = lambertProjection({
		parallels: input.spec.projection.parallels,
		rotate: input.spec.projection.rotate,
		fitTarget: basemap.states as unknown as FitTarget,
	});
	const path = geoPath(projection);

	// 4. Build polygon overlays per turbulence area.
	const overlays: PolygonOverlay[] = [];
	const activeSeverities = new Set<TurbulenceSeverity>();
	for (const area of sourceParsed.areas) {
		const palette = TURBULENCE_SEVERITY_PALETTE[area.severity];
		activeSeverities.add(area.severity);
		const labelText =
			opts.show_labels && (area.label ?? defaultLabelText(area)).length > 0
				? (area.label ?? defaultLabelText(area))
				: undefined;
		overlays.push({
			id: area.id,
			rings: area.rings,
			style: {
				stroke: palette.stroke,
				fill: palette.fill,
				fillOpacity: palette.fillOpacity,
				dasharray: palette.dasharray,
			},
			label: labelText !== undefined ? { text: labelText } : undefined,
			labelLonLat: area.labelLonLat,
			classSuffix: `turb-${area.severity}`,
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

	bands[LAYER_BANDS.VECTOR_SYMBOLOGY] = renderPolygonOverlays(overlays, { projection });

	const chrome = buildChrome({
		title: input.spec.title,
		subtitle: input.spec.subtitle,
		rightTitle: 'CONUS - Lambert Conformal 33/45',
		sourceAttribution: opts.source_attribution ?? 'AWC G-AIRMET turbulence archive (AC 00-45H Ch 5; not for ops use)',
		libraryVersion: input.libraryVersion,
	});
	const legendFragment = opts.show_legend ? renderSeverityLegend(activeSeverities, sourceParsed.valid) : '';
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
