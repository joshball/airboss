// @browser-globals: server-only -- never imported by client .svelte
/**
 * GOES water-vapor satellite chart renderer (Phase F).
 *
 * Renders mid- and upper-tropospheric water-vapor brightness temperature
 * on the standard Lambert canvas. The 6.2 / 6.9 / 7.3 micron bands
 * sense WV; drier columns appear warmer (radiation reaches the sensor
 * from lower / warmer atmospheric layers); moister columns appear
 * colder. The `goesWvPalette` ramps from brown (warm/dry) through
 * yellow/green to blue/purple (cold/moist), matching the AWC standard.
 *
 * # When pilots care
 *
 * Water-vapor imagery surfaces upper-level features (jet streams,
 * dynamic short-waves, dry slots) that don't show up in IR or
 * visible. Useful pre-flight on long IFR routes for spotting
 * developing weather systems before they show up in surface or radar
 * products.
 *
 * # Source data shape
 *
 *   - `wv_png` (required): source raster, single-channel BT (apply mode)
 *     or pre-rendered colored PNG (passthrough mode).
 *   - `wv_world` (required): ESRI worldfile in lon/lat (Plate Carree).
 *
 * # References
 *
 *   - AC 00-45H Ch 4 (Aviation Weather Services) -- WV satellite reading.
 *   - AC 00-6B Ch 19 (Aviation Weather Handbook) -- satellite meteorology.
 *   - NOAA STAR GOES archive: https://www.star.nesdis.noaa.gov/GOES/
 */

import { CHART_TYPES, LAYER_BANDS } from '@ab/constants';
import { z } from 'zod';
import { composeChart } from '../layers';
import { goesWvPalette, type RGB } from '../raster/palettes';
import {
	buildSatelliteSubstrate,
	CHART_MARGIN,
	parseSatelliteSourceInputs,
	SVG_HEIGHT,
	SVG_WIDTH,
} from './satellite-shared';
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

const sourceBoundsSchema = z.object({
	lon_min: z.number(),
	lat_min: z.number(),
	lon_max: z.number(),
	lat_max: z.number(),
});

const satelliteWvOptionsSchema = z.object({
	raster_opacity: z.number().min(0).max(1).default(0.92),
	show_legend: z.boolean().default(true),
	source_attribution: z.string().optional(),
	source_bounds: sourceBoundsSchema.optional(),
	palette_mode: z.enum(['apply', 'passthrough']).default('apply'),
	/** Min brightness temperature (Celsius) at byte value 0. Used when palette_mode = 'apply'. */
	bt_min_c: z.number().default(-80),
	/** Max brightness temperature (Celsius) at byte value 255. Used when palette_mode = 'apply'. */
	bt_max_c: z.number().default(20),
});

export const satelliteWvSpecSchema = z.object({
	slug: z.string(),
	type: z.literal(CHART_TYPES.SATELLITE_WATER_VAPOR),
	title: z.string().min(1),
	subtitle: z.string().optional(),
	projection: projectionSchema,
	extent: extentSchema,
	sources: z.object({
		wv_png: z.string(),
		wv_world: z.string(),
	}),
	options: satelliteWvOptionsSchema.optional(),
});

export type SatelliteWvSpec = z.infer<typeof satelliteWvSpecSchema> & ChartSpec;

// ------------------------------------------------------------------
// WV moisture legend
// ------------------------------------------------------------------

function renderWvLegend(): string {
	const legendWidth = 360;
	const legendHeight = 60;
	const x0 = SVG_WIDTH - CHART_MARGIN - legendWidth;
	const y0 = SVG_HEIGHT - CHART_MARGIN - legendHeight - 24;

	// Sample 60 BT values from +10 C (very dry) down to -80 C (very moist).
	const cols = 60;
	const tempStart = 10;
	const tempEnd = -80;
	const cellW = legendWidth / cols;
	const cells: string[] = [];
	for (let i = 0; i < cols; i += 1) {
		const t = i / (cols - 1);
		const tempC = tempStart + (tempEnd - tempStart) * t;
		const [r, g, b] = goesWvPalette(tempC);
		const cx = x0 + i * cellW;
		cells.push(
			`<rect x="${cx.toFixed(1)}" y="${(y0 + 16).toFixed(1)}" width="${cellW.toFixed(2)}" height="14" fill="rgb(${r},${g},${b})" />`,
		);
	}

	const labels: Array<{ tempC: number; text: string }> = [
		{ tempC: 10, text: '+10 (dry)' },
		{ tempC: -20, text: '-20' },
		{ tempC: -50, text: '-50' },
		{ tempC: -80, text: '-80 (moist)' },
	];
	const labelEls: string[] = [];
	for (const { tempC, text } of labels) {
		const t = (tempStart - tempC) / (tempStart - tempEnd);
		const x = x0 + t * legendWidth;
		labelEls.push(
			`<text x="${x.toFixed(1)}" y="${(y0 + 44).toFixed(1)}" text-anchor="middle" font-size="9" fill="#3d3a32">${text}</text>`,
		);
	}

	return `<g class="legend wv-legend">
  <rect x="${x0 - 10}" y="${y0 - 4}" width="${legendWidth + 20}" height="${legendHeight + 12}" fill="white" fill-opacity="0.92" stroke="#bdb9ac" stroke-width="0.6" rx="3" />
  <text x="${x0}" y="${y0 + 10}" font-size="10" font-weight="700" fill="#3d3a32" letter-spacing="0.6">WV BRIGHTNESS TEMP (deg C)</text>
  ${cells.join('\n  ')}
  ${labelEls.join('\n  ')}
</g>`;
}

// ------------------------------------------------------------------
// Apply-mode helpers
// ------------------------------------------------------------------

function createWvApplyTransform(btMinC: number, btMaxC: number): (byteValue: number) => RGB {
	const range = btMaxC - btMinC;
	return (r) => {
		const tempC = btMinC + (r / 255) * range;
		return goesWvPalette(tempC);
	};
}

function applyNoDataFilter(byteValue: number): boolean {
	return byteValue === 0 || byteValue === 255;
}

function passthroughNoDataFilter(r: number, g: number, b: number): boolean {
	return r === 0 && g === 0 && b === 0;
}

// ------------------------------------------------------------------
// Renderer entry point
// ------------------------------------------------------------------

const RENDERER_LABEL = 'satellite-wv';

export async function renderSatelliteWv(input: ChartRenderInput<SatelliteWvSpec>): Promise<ChartRenderResult> {
	const opts = satelliteWvOptionsSchema.parse(input.spec.options ?? {});

	const { pngBytes, worldFile } = parseSatelliteSourceInputs(
		RENDERER_LABEL,
		'wv_png',
		'wv_world',
		input.sources as Record<string, Uint8Array | string | undefined>,
	);

	const legendFragment = opts.show_legend ? renderWvLegend() : '';
	const substrate = await buildSatelliteSubstrate({
		chartType: CHART_TYPES.SATELLITE_WATER_VAPOR,
		rendererLabel: RENDERER_LABEL,
		spec: input.spec,
		rendererInput: input as ChartRenderInput<ChartSpec>,
		pngBytes,
		worldFile,
		sourceBounds: opts.source_bounds,
		paletteMode: opts.palette_mode,
		applyTransform: createWvApplyTransform(opts.bt_min_c, opts.bt_max_c),
		applyNoDataFilter,
		passthroughNoDataFilter,
		rasterOpacity: opts.raster_opacity,
		backgroundFill: '#0a0a14',
		sourceAttribution: opts.source_attribution ?? 'NOAA GOES Water Vapor (AWC sectorized)',
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
