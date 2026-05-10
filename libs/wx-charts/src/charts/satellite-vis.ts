// @browser-globals: server-only -- never imported by client .svelte
/**
 * GOES visible satellite chart renderer (Phase F).
 *
 * Renders a daytime visible-band overlay on the standard Lambert canvas:
 * source PNG bytes carry top-of-atmosphere reflectance (0..255), the
 * `goesVisPalette` ramp passes the byte through as a grayscale RGB
 * triple, and `warpRaster` re-projects the colored intermediate onto
 * the chart canvas. A grayscale 0..255 reflectance ramp legend ships
 * in the lower-right.
 *
 * # Why visible
 *
 * The visible band reads what the human eye sees from orbit. Brighter =
 * more reflective surface (cloud, snow, sun glint). Daytime-only -- at
 * night the disc is uniformly dark and the chart conveys no signal,
 * which the renderer does not detect or warn about (the `apply` palette
 * mode would render solid black; the captured spec.yaml is responsible
 * for picking a daytime fixture).
 *
 * # Source data shape
 *
 *   - `vis_png` (required): source raster, single-channel reflectance
 *     PNG (apply mode) or pre-rendered grayscale PNG (passthrough mode).
 *   - `vis_world` (required): ESRI worldfile in lon/lat (Plate Carree).
 *
 * # References
 *
 *   - AC 00-45H Ch 4 (Aviation Weather Services) -- visible satellite reading.
 *   - AC 00-6B Ch 19 (Aviation Weather Handbook) -- satellite meteorology.
 *   - NOAA STAR GOES archive: https://www.star.nesdis.noaa.gov/GOES/
 */

import { CHART_TYPES, LAYER_BANDS } from '@ab/constants';
import { z } from 'zod';
import { composeChart } from '../layers';
import { goesVisPalette, type RGB } from '../raster/palettes';
import type { ChartRenderInput, ChartRenderResult, ChartSpec } from '../types';
import {
	buildSatelliteSubstrate,
	CHART_MARGIN,
	parseSatelliteSourceInputs,
	SVG_HEIGHT,
	SVG_WIDTH,
} from './satellite-shared';

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

const sourceBoundsSchema = z.object({
	lon_min: z.number(),
	lat_min: z.number(),
	lon_max: z.number(),
	lat_max: z.number(),
});

const satelliteVisOptionsSchema = z.object({
	raster_opacity: z.number().min(0).max(1).default(0.95),
	show_legend: z.boolean().default(true),
	source_attribution: z.string().optional(),
	source_bounds: sourceBoundsSchema.optional(),
	/**
	 * - 'apply': source is single-channel reflectance (0..255 maps via
	 *   identity grayscale through `goesVisPalette`).
	 * - 'passthrough': source is already rendered grayscale.
	 */
	palette_mode: z.enum(['apply', 'passthrough']).default('apply'),
});

export const satelliteVisSpecSchema = z.object({
	slug: z.string(),
	type: z.literal(CHART_TYPES.SATELLITE_VISIBLE),
	title: z.string().min(1),
	subtitle: z.string().optional(),
	projection: projectionSchema,
	extent: extentSchema,
	sources: z.object({
		vis_png: z.string(),
		vis_world: z.string(),
	}),
	options: satelliteVisOptionsSchema.optional(),
});

export type SatelliteVisSpec = z.infer<typeof satelliteVisSpecSchema> & ChartSpec;

// ------------------------------------------------------------------
// VIS reflectance legend
// ------------------------------------------------------------------

function renderVisLegend(): string {
	const legendWidth = 280;
	const legendHeight = 60;
	const x0 = SVG_WIDTH - CHART_MARGIN - legendWidth;
	const y0 = SVG_HEIGHT - CHART_MARGIN - legendHeight - 24;

	// Sample 50 reflectance values from 0 to 255.
	const cols = 50;
	const cellW = legendWidth / cols;
	const cells: string[] = [];
	for (let i = 0; i < cols; i += 1) {
		const t = i / (cols - 1);
		const v = Math.round(t * 255);
		const [r, g, b] = goesVisPalette(v);
		const cx = x0 + i * cellW;
		cells.push(
			`<rect x="${cx.toFixed(1)}" y="${(y0 + 16).toFixed(1)}" width="${cellW.toFixed(2)}" height="14" fill="rgb(${r},${g},${b})" />`,
		);
	}

	const labels: Array<{ value: number; text: string }> = [
		{ value: 0, text: 'dark' },
		{ value: 128, text: 'mid' },
		{ value: 255, text: 'bright' },
	];
	const labelEls: string[] = [];
	for (const { value, text } of labels) {
		const t = value / 255;
		const x = x0 + t * legendWidth;
		labelEls.push(
			`<text x="${x.toFixed(1)}" y="${(y0 + 44).toFixed(1)}" text-anchor="middle" font-size="9" fill="#3d3a32">${text}</text>`,
		);
	}

	return `<g class="legend vis-legend">
  <rect x="${x0 - 10}" y="${y0 - 4}" width="${legendWidth + 20}" height="${legendHeight + 12}" fill="white" fill-opacity="0.92" stroke="#bdb9ac" stroke-width="0.6" rx="3" />
  <text x="${x0}" y="${y0 + 10}" font-size="10" font-weight="700" fill="#3d3a32" letter-spacing="0.6">REFLECTANCE (0-255)</text>
  ${cells.join('\n  ')}
  ${labelEls.join('\n  ')}
</g>`;
}

// ------------------------------------------------------------------
// Apply-mode helpers
// ------------------------------------------------------------------

function visApplyTransform(byteValue: number): RGB {
	return goesVisPalette(byteValue);
}

/**
 * Apply-mode no-data filter: `0` (off-Earth or pre-sunrise dark) is
 * treated as transparent, matching the IR convention. `255` is genuine
 * full reflectance (snow, dense cloud) and is kept.
 */
function applyNoDataFilter(byteValue: number): boolean {
	return byteValue === 0;
}

/**
 * Passthrough-mode no-data filter: pure black is the standard NOAA
 * off-Earth sentinel for visible products too.
 */
function passthroughNoDataFilter(r: number, g: number, b: number): boolean {
	return r === 0 && g === 0 && b === 0;
}

// ------------------------------------------------------------------
// Renderer entry point
// ------------------------------------------------------------------

const RENDERER_LABEL = 'satellite-vis';

export async function renderSatelliteVis(input: ChartRenderInput<SatelliteVisSpec>): Promise<ChartRenderResult> {
	const opts = satelliteVisOptionsSchema.parse(input.spec.options ?? {});

	const { pngBytes, worldFile } = parseSatelliteSourceInputs(
		RENDERER_LABEL,
		'vis_png',
		'vis_world',
		input.sources as Record<string, Uint8Array | string | undefined>,
	);

	const legendFragment = opts.show_legend ? renderVisLegend() : '';
	const substrate = await buildSatelliteSubstrate({
		chartType: CHART_TYPES.SATELLITE_VISIBLE,
		rendererLabel: RENDERER_LABEL,
		spec: input.spec,
		rendererInput: input as ChartRenderInput<ChartSpec>,
		pngBytes,
		worldFile,
		sourceBounds: opts.source_bounds,
		paletteMode: opts.palette_mode,
		applyTransform: visApplyTransform,
		applyNoDataFilter,
		passthroughNoDataFilter,
		rasterOpacity: opts.raster_opacity,
		// Slate background -- visible imagery is high-contrast against
		// near-black so cloud edges retain definition.
		backgroundFill: '#0a0a0c',
		sourceAttribution: opts.source_attribution ?? 'NOAA GOES Visible (AWC sectorized)',
		rightTitle: 'CONUS - Lambert Conformal 33/45',
		legendFragment,
	});

	const svg = composeChart(substrate.bands);

	return {
		svg,
		meta: {
			layer_counts: {
				[LAYER_BANDS.RASTER_OVERLAY]: 1,
			},
			drawn_pixels: substrate.warp.drawn,
			parser_warnings: [],
		},
	};
}
