// @browser-globals: server-only -- never imported by client .svelte
/**
 * GOES infrared satellite chart renderer (Phase F).
 *
 * Composes the substrate (basemap + Lambert projection + chrome + layer-band
 * composer) with a re-projected GOES IR raster overlay and a re-stroked
 * basemap above the raster, plus an IR brightness-temperature legend.
 *
 * # Source data shape
 *
 *   - `ir_png` (required): source raster bytes. Two encodings supported
 *     (selected via `options.palette_mode`):
 *       * `apply` (default) -- the source PNG is a single-channel
 *         brightness-temperature encoding. Each 8-bit sample maps to a
 *         BT in degrees Celsius via `options.bt_min_c` / `options.bt_max_c`;
 *         `goesIrPalette` colours the sample at pre-color time.
 *       * `passthrough` -- the source PNG is already the rendered IR
 *         enhancement (e.g., AWC's standard GOES IR product). The raster
 *         bytes are warped onto the chart canvas as-is. The palette inside
 *         the PNG is whatever NOAA / AWC chose.
 *   - `ir_world` (required): ESRI worldfile alongside the PNG. The
 *     worldfile must describe the source raster in lon/lat (Plate
 *     Carree). Native-geostationary captures must be pre-reprojected via
 *     `gdalwarp -s_srs '+proj=geos ...' -t_srs EPSG:4326` before feeding
 *     the renderer (see `satellite-shared.ts` doc for the reasoning).
 *
 * # References
 *
 *   - AC 00-45H Ch 4 (Aviation Weather Services) -- IR satellite reading.
 *   - AC 00-6B Ch 19 (Aviation Weather Handbook) -- satellite meteorology.
 *   - NOAA STAR GOES archive: https://www.star.nesdis.noaa.gov/GOES/
 *
 * Server-only: `applyPalette` + `warpRaster` both lazy-load sharp.
 * Re-exported from `@ab/wx-charts/server` (not the runtime barrel).
 */

import { CHART_TYPES } from '@ab/constants';
import { z } from 'zod';
import { goesIrPalette, type RGB } from '../raster/palettes';
import {
	buildSatelliteSubstrate,
	CHART_MARGIN,
	parseSatelliteSourceInputs,
	SVG_HEIGHT,
	SVG_WIDTH,
} from './satellite-shared';
import { composeChart } from '../layers';
import { LAYER_BANDS } from '@ab/constants';
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

const satelliteIrOptionsSchema = z.object({
	raster_opacity: z.number().min(0).max(1).default(0.92),
	show_legend: z.boolean().default(true),
	source_attribution: z.string().optional(),
	/** Source raster geographic bounds (Plate Carree). Trims the warp's source-sampling box. */
	source_bounds: sourceBoundsSchema.optional(),
	/**
	 * Palette mode for the source PNG.
	 * - 'apply': the PNG is a single-channel brightness-temperature
	 *   encoding; goesIrPalette colours each sample before warp.
	 * - 'passthrough': the PNG is already the rendered IR enhancement;
	 *   the warp carries the source bytes through unchanged.
	 */
	palette_mode: z.enum(['apply', 'passthrough']).default('apply'),
	/** Min brightness temperature (Celsius) at byte value 0. Used when palette_mode = 'apply'. */
	bt_min_c: z.number().default(-90),
	/** Max brightness temperature (Celsius) at byte value 255. Used when palette_mode = 'apply'. */
	bt_max_c: z.number().default(40),
});

export const satelliteIrSpecSchema = z.object({
	slug: z.string(),
	type: z.literal(CHART_TYPES.SATELLITE_IR),
	title: z.string().min(1),
	subtitle: z.string().optional(),
	projection: projectionSchema,
	extent: extentSchema,
	sources: z.object({
		ir_png: z.string(),
		ir_world: z.string(),
	}),
	options: satelliteIrOptionsSchema.optional(),
});

export type SatelliteIrSpec = z.infer<typeof satelliteIrSpecSchema> & ChartSpec;

// ------------------------------------------------------------------
// IR brightness-temperature legend
// ------------------------------------------------------------------

function renderIrLegend(): string {
	const legendWidth = 360;
	const legendHeight = 60;
	const x0 = SVG_WIDTH - CHART_MARGIN - legendWidth;
	const y0 = SVG_HEIGHT - CHART_MARGIN - legendHeight - 24;

	// Sample 60 BT values from +30 C down to -85 C.
	const cols = 60;
	const tempStart = 30;
	const tempEnd = -85;
	const cellW = legendWidth / cols;
	const cells: string[] = [];
	for (let i = 0; i < cols; i += 1) {
		const t = i / (cols - 1);
		const tempC = tempStart + (tempEnd - tempStart) * t;
		const [r, g, b] = goesIrPalette(tempC);
		const cx = x0 + i * cellW;
		cells.push(
			`<rect x="${cx.toFixed(1)}" y="${(y0 + 16).toFixed(1)}" width="${cellW.toFixed(2)}" height="14" fill="rgb(${r},${g},${b})" />`,
		);
	}

	const labels: Array<{ tempC: number; text: string }> = [
		{ tempC: 30, text: '+30' },
		{ tempC: 0, text: '0' },
		{ tempC: -32, text: '-32' },
		{ tempC: -52, text: '-52' },
		{ tempC: -72, text: '-72' },
		{ tempC: -85, text: '-85' },
	];
	const labelEls: string[] = [];
	for (const { tempC, text } of labels) {
		const t = (tempStart - tempC) / (tempStart - tempEnd);
		const x = x0 + t * legendWidth;
		labelEls.push(
			`<text x="${x.toFixed(1)}" y="${(y0 + 44).toFixed(1)}" text-anchor="middle" font-size="9" fill="#3d3a32">${text}</text>`,
		);
	}

	return `<g class="legend ir-legend">
  <rect x="${x0 - 10}" y="${y0 - 4}" width="${legendWidth + 20}" height="${legendHeight + 12}" fill="white" fill-opacity="0.92" stroke="#bdb9ac" stroke-width="0.6" rx="3" />
  <text x="${x0}" y="${y0 + 10}" font-size="10" font-weight="700" fill="#3d3a32" letter-spacing="0.6">CLOUD-TOP TEMP (deg C)</text>
  ${cells.join('\n  ')}
  ${labelEls.join('\n  ')}
</g>`;
}

// ------------------------------------------------------------------
// Apply-mode helpers
// ------------------------------------------------------------------

/**
 * Apply-mode sample transform: maps a single-channel byte (0..255) to an
 * RGB triple via `goesIrPalette`. The byte is interpreted as a brightness
 * temperature in the range `[btMinC, btMaxC]`.
 */
function createIrApplyTransform(btMinC: number, btMaxC: number): (byteValue: number) => RGB {
	const range = btMaxC - btMinC;
	return (r) => {
		const tempC = btMinC + (r / 255) * range;
		return goesIrPalette(tempC);
	};
}

/**
 * Apply-mode no-data filter: byte values 0 and 255 are treated as fill
 * (off-Earth or invalid scan line). Tightens with empirical data once
 * real captures land in the cache.
 */
function applyNoDataFilter(byteValue: number): boolean {
	return byteValue === 0 || byteValue === 255;
}

/**
 * Passthrough-mode no-data filter: opaque-black is the canonical NOAA
 * "off-Earth" / fill sentinel for AWC IR products.
 */
function passthroughNoDataFilter(r: number, g: number, b: number): boolean {
	return r === 0 && g === 0 && b === 0;
}

// ------------------------------------------------------------------
// Renderer entry point
// ------------------------------------------------------------------

const RENDERER_LABEL = 'satellite-ir';

export async function renderSatelliteIr(input: ChartRenderInput<SatelliteIrSpec>): Promise<ChartRenderResult> {
	const opts = satelliteIrOptionsSchema.parse(input.spec.options ?? {});

	const { pngBytes, worldFile } = parseSatelliteSourceInputs(
		RENDERER_LABEL,
		'ir_png',
		'ir_world',
		input.sources as Record<string, Uint8Array | string | undefined>,
	);

	const legendFragment = opts.show_legend ? renderIrLegend() : '';
	const substrate = await buildSatelliteSubstrate({
		chartType: CHART_TYPES.SATELLITE_IR,
		rendererLabel: RENDERER_LABEL,
		spec: input.spec,
		rendererInput: input as ChartRenderInput<ChartSpec>,
		pngBytes,
		worldFile,
		sourceBounds: opts.source_bounds,
		paletteMode: opts.palette_mode,
		applyTransform: createIrApplyTransform(opts.bt_min_c, opts.bt_max_c),
		applyNoDataFilter,
		passthroughNoDataFilter,
		rasterOpacity: opts.raster_opacity,
		// Dark slate background -- IR clouds read better against a
		// deep-grey backdrop than the white surface-analysis canvas.
		backgroundFill: '#0a0a14',
		sourceAttribution: opts.source_attribution ?? 'NOAA GOES IR (AWC sectorized)',
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
