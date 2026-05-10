// @browser-globals: server-only -- never imported by client .svelte
/**
 * Shared infrastructure for the GOES satellite chart renderers (Phase F).
 *
 * The three satellite chart types (IR, VIS, WV) all follow the same shape:
 *
 *   1. Decode source PNG (single-channel BT or reflectance encoding,
 *      worldfile in lon/lat -- see "Source projection" below).
 *   2. Apply palette per-pixel via `applyPalette` -> RGBA PNG with
 *      no-data pixels marked transparent. The palette function differs
 *      per band (IR / VIS / WV); the rest is identical.
 *   3. Warp the colored RGBA PNG into the target Lambert canvas via
 *      `warpRaster`. No-data filter on the warp side preserves any
 *      transparency emitted by step 2.
 *   4. Render basemap (under + above the raster), graticule, chrome,
 *      legend.
 *
 * # Source projection
 *
 * The warp pipeline expects a worldfile that maps source pixels to
 * (worldX, worldY) tuples that can be passed back through the inverse
 * Lambert projection. For Plate-Carree-encoded sources (the most common
 * case for AWC sectorized GOES products and pre-reprojected NESDIS
 * archives), the worldfile describes lon/lat per pixel directly -- the
 * warp's default code path handles it.
 *
 * Native-geostationary GOES PNGs (full-disc captures whose worldfile
 * describes the disc in geostationary projection units) require a
 * second forward-projection step (Lambert.invert -> goesProjection
 * forward -> source pixel) that the v1 warp does not implement.
 * The recommended path for those captures is a one-time pre-
 * reprojection using a tool like `gdalwarp -s_srs '+proj=geos ...'
 * -t_srs EPSG:4326 input.png output.png`, which produces a Plate-Carree
 * PNG + worldfile pair that the renderer accepts directly. See
 * `OUT-OF-SCOPE.md` -> "Native-projection satellite warp".
 *
 * # Palette modes
 *
 *   - `apply` (default): the source PNG encodes a single channel of
 *     physical data (BT for IR/WV, reflectance for VIS). The palette
 *     function is applied via `applyPalette` to produce a colored RGBA
 *     intermediate.
 *   - `passthrough`: the source PNG is already a rendered visualization
 *     (e.g., NOAA's standard IR enhancement). The renderer skips the
 *     palette step and warps the source bytes directly.
 *
 * # Source value mapping
 *
 * In `apply` mode the renderer treats each source byte (0..255) as a
 * linearly-quantized sample of the source's physical range. For IR/WV
 * the range is in degrees Celsius (`bt_min_c`, `bt_max_c`); for VIS the
 * range is reflectance (0..255 byte = 0..255 reflectance, identity).
 * The mapping is part of the spec, not the palette, so a learner can
 * override the encoding for non-standard captures.
 */

import { LAYER_BANDS } from '@ab/constants';
import { type GeoProjection, geoPath } from 'd3-geo';
import { loadConusBasemapFromString } from '../basemap';
import { buildChrome, type ChromeOutput } from '../chrome';
import { renderGraticule } from '../graticule';
import { type LayerBandMap } from '../layers';
import {
	CHART_MARGIN,
	type FitTarget,
	lambertProjection,
	SVG_HEIGHT,
	SVG_WIDTH,
	TITLE_BAND_HEIGHT,
} from '../projection';
import { applyPalette } from '../raster/apply-palette';
import type { RGB } from '../raster/palettes';
import { warpRaster, type WarpResult } from '../raster/warp';
import { parseWorldFile, type WorldFile } from '../raster/worldfile';
import type { ChartRenderInput, ChartRenderResult, ChartSpec } from '../types';

// ----------------------------------------------------------------------
// Common spec sub-schemas (re-imported by IR / VIS / WV via zod)
// ----------------------------------------------------------------------

export interface SatelliteProjection {
	kind: 'lambert';
	parallels: [number, number];
	rotate: [number, number];
}

export interface SatelliteSourceBounds {
	lon_min: number;
	lat_min: number;
	lon_max: number;
	lat_max: number;
}

export type SatelliteExtent =
	| 'conus'
	| 'alaska'
	| 'hawaii'
	| { lon_min: number; lat_min: number; lon_max: number; lat_max: number };

export type PaletteMode = 'apply' | 'passthrough';

// ----------------------------------------------------------------------
// Decode helpers
// ----------------------------------------------------------------------

export function decodeSourceText(value: Uint8Array | string): string {
	if (typeof value === 'string') return value;
	return new TextDecoder('utf-8').decode(value);
}

export function decodeSourceBytes(value: Uint8Array | string): Uint8Array {
	if (typeof value === 'string') return new TextEncoder().encode(value);
	return value;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('base64');
}

// ----------------------------------------------------------------------
// Lazy basemap reader -- mirrors radar-mosaic / surface-analysis pattern.
// ----------------------------------------------------------------------

type GetBuiltinModule = (spec: string) => unknown;
type NodeFs = { promises: { readFile: (path: string, encoding: 'utf8') => Promise<string> } };

export async function readBasemapFile(label: string, path: string): Promise<string> {
	const proc = (typeof process !== 'undefined' ? process : undefined) as
		| (NodeJS.Process & { getBuiltinModule?: GetBuiltinModule })
		| undefined;
	const getBuiltin = proc?.getBuiltinModule;
	if (typeof getBuiltin !== 'function') {
		throw new Error(`${label}: cannot read basemap file -- no process.getBuiltinModule available`);
	}
	const fs = getBuiltin('node:fs') as NodeFs;
	return fs.promises.readFile(path, 'utf8');
}

// ----------------------------------------------------------------------
// Pre-color + warp pipeline
// ----------------------------------------------------------------------

export interface SatelliteRenderPipelineInput {
	pngBytes: Uint8Array;
	worldFile: WorldFile;
	projection: GeoProjection;
	sourceBounds: SatelliteSourceBounds | undefined;
	paletteMode: PaletteMode;
	/** Apply-mode: convert byte (0..255) to a physical value, then to RGB. */
	applyTransform: (byteValue: number) => RGB;
	/** Apply-mode: predicate identifying "no data" source bytes (single channel). */
	applyNoDataFilter: (byteValue: number) => boolean;
	/** Passthrough-mode: predicate identifying "no data" pixels in the colored source. */
	passthroughNoDataFilter: (r: number, g: number, b: number) => boolean;
}

export interface SatelliteRenderPipelineResult {
	warp: WarpResult;
	/** Pixels in the source raster that received a palette colour (apply mode only; 0 in passthrough). */
	prePaletteColored: number;
}

/**
 * Two-step pre-color + warp.
 *
 * For `apply` mode: the source PNG is single-channel (BT or reflectance).
 * `applyPalette` decodes it, runs the per-pixel palette transform, marks
 * no-data samples transparent, and emits an RGBA intermediate PNG. The
 * intermediate is then fed to `warpRaster`, which inverts the Lambert
 * projection per output pixel and samples the colored intermediate.
 *
 * For `passthrough` mode: the warp consumes the source PNG bytes
 * directly with the supplied multi-channel no-data filter. No intermediate.
 *
 * Both modes use the same warp; the difference is whether the warp's
 * input was pre-colored.
 */
export async function precolorAndWarp(input: SatelliteRenderPipelineInput): Promise<SatelliteRenderPipelineResult> {
	let coloredPng: Uint8Array;
	let prePaletteColored = 0;
	if (input.paletteMode === 'apply') {
		const palette = await applyPalette({
			pngBytes: input.pngBytes,
			transform: (r, _g, _b) => input.applyTransform(r),
			noDataFilter: (r, _g, _b) => input.applyNoDataFilter(r),
		});
		coloredPng = palette.pngBytes;
		prePaletteColored = palette.colored;
	} else {
		coloredPng = input.pngBytes;
	}

	const noDataForWarp =
		input.paletteMode === 'apply'
			? // applyPalette emits transparent (alpha=0) pixels for no-data, but
				// warpRaster reads the intermediate as RGB only. The colored
				// intermediate uses alpha=255 for "drawn" and alpha=0 for "no data";
				// the colored bytes default to 0,0,0 for the no-data slots, so
				// "all three channels zero" matches the apply-mode no-data
				// signature exactly.
				(r: number, g: number, b: number) => r === 0 && g === 0 && b === 0
			: input.passthroughNoDataFilter;

	const warp = await warpRaster({
		pngBytes: coloredPng,
		worldFile: input.worldFile,
		targetProjection: input.projection,
		targetWidth: SVG_WIDTH,
		targetHeight: SVG_HEIGHT,
		sourceBounds:
			input.sourceBounds !== undefined
				? {
						minX: input.sourceBounds.lon_min,
						maxX: input.sourceBounds.lon_max,
						minY: input.sourceBounds.lat_min,
						maxY: input.sourceBounds.lat_max,
					}
				: undefined,
		noDataFilter: noDataForWarp,
	});

	return { warp, prePaletteColored };
}

// ----------------------------------------------------------------------
// Substrate composer
// ----------------------------------------------------------------------

export interface SatelliteSubstrateInput {
	chartType: string;
	rendererLabel: string;
	spec: ChartSpec & {
		title: string;
		subtitle?: string;
		projection: SatelliteProjection;
	};
	rendererInput: ChartRenderInput<ChartSpec>;
	pngBytes: Uint8Array;
	worldFile: WorldFile;
	sourceBounds: SatelliteSourceBounds | undefined;
	paletteMode: PaletteMode;
	applyTransform: (byteValue: number) => RGB;
	applyNoDataFilter: (byteValue: number) => boolean;
	passthroughNoDataFilter: (r: number, g: number, b: number) => boolean;
	rasterOpacity: number;
	backgroundFill: string;
	sourceAttribution: string;
	rightTitle: string;
	legendFragment: string;
}

export interface SatelliteSubstrateResult {
	bands: LayerBandMap;
	chrome: ChromeOutput;
	warp: WarpResult;
	prePaletteColored: number;
}

/**
 * Build the substrate that every satellite chart shares: read the
 * basemap, fit Lambert, warp the (possibly pre-colored) raster, lay the
 * bands. Returns the band map (caller adds the chrome composition + any
 * point symbology).
 *
 * The point-symbology and CHROME bands are NOT populated here; the
 * caller does that to keep the per-band labelling consistent with the
 * chart's intent (IR uses a colored-temperature legend, VIS uses a
 * grayscale ramp, WV uses a moisture ramp).
 */
export async function buildSatelliteSubstrate(input: SatelliteSubstrateInput): Promise<SatelliteSubstrateResult> {
	// Basemap (test seam: input.sources.basemap takes precedence).
	const basemapBytes = input.rendererInput.sources.basemap;
	let basemapJson: string;
	if (basemapBytes !== undefined) {
		basemapJson = decodeSourceText(basemapBytes);
	} else {
		basemapJson = await readBasemapFile(input.rendererLabel, input.rendererInput.basemapPath);
	}
	const basemap = loadConusBasemapFromString(basemapJson);

	// Target Lambert projection.
	const projection = lambertProjection({
		parallels: input.spec.projection.parallels,
		rotate: input.spec.projection.rotate,
		fitTarget: basemap.states as unknown as FitTarget,
	});
	const path = geoPath(projection);

	// Pre-color + warp.
	const pipeline = await precolorAndWarp({
		pngBytes: input.pngBytes,
		worldFile: input.worldFile,
		projection,
		sourceBounds: input.sourceBounds,
		paletteMode: input.paletteMode,
		applyTransform: input.applyTransform,
		applyNoDataFilter: input.applyNoDataFilter,
		passthroughNoDataFilter: input.passthroughNoDataFilter,
	});
	const warpedB64 = uint8ArrayToBase64(pipeline.warp.pngBytes);

	// Bands.
	const bands: LayerBandMap = {};
	bands[LAYER_BANDS.BACKGROUND] =
		`<rect x="0" y="0" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="${input.backgroundFill}" />`;
	bands[LAYER_BANDS.GRATICULE] = renderGraticule(projection);
	bands[LAYER_BANDS.BASEMAP_FILL] = basemap.states.features
		.map((f) => `<path d="${path(f) ?? ''}" fill="none" stroke="none" />`)
		.join('\n');
	const interiorPath = path(basemap.stateBordersInterior);
	const outerPath = path(basemap.conusOuter);
	bands[LAYER_BANDS.BASEMAP_BORDERS] =
		`<path d="${interiorPath ?? ''}" fill="none" stroke="#3d3a32" stroke-width="0.4" opacity="0" />
<path d="${outerPath ?? ''}" fill="none" stroke="#3d3a32" stroke-width="0.6" opacity="0" />`;
	bands[LAYER_BANDS.RASTER_OVERLAY] =
		`<image x="0" y="${TITLE_BAND_HEIGHT}" width="${SVG_WIDTH}" height="${SVG_HEIGHT - TITLE_BAND_HEIGHT}"
       opacity="${input.rasterOpacity}"
       preserveAspectRatio="none"
       href="data:image/png;base64,${warpedB64}" />`;
	bands[LAYER_BANDS.BASEMAP_RE_STROKE] =
		`<path d="${interiorPath ?? ''}" fill="none" stroke="#fafaf7" stroke-width="0.4" opacity="0.45" />
<path d="${outerPath ?? ''}" fill="none" stroke="#fafaf7" stroke-width="0.8" opacity="0.7" />`;

	// Chrome (callers append the legend fragment per band).
	const chrome = buildChrome({
		title: input.spec.title,
		subtitle: input.spec.subtitle,
		rightTitle: input.rightTitle,
		sourceAttribution: input.sourceAttribution,
		libraryVersion: input.rendererInput.libraryVersion,
	});
	bands[LAYER_BANDS.CHROME] = `${chrome.titleBand}\n${input.legendFragment}\n${chrome.footerBand}`;

	return { bands, chrome, warp: pipeline.warp, prePaletteColored: pipeline.prePaletteColored };
}

// ----------------------------------------------------------------------
// Spec input parsing helpers
// ----------------------------------------------------------------------

export interface ParsedSatelliteSpecInputs {
	pngBytes: Uint8Array;
	worldFile: WorldFile;
}

/**
 * Resolve and decode the standard `<band>_png` + `<band>_world` source
 * pair every satellite renderer requires. Throws with the renderer label
 * on missing inputs so callers don't have to recreate the message.
 */
export function parseSatelliteSourceInputs(
	rendererLabel: string,
	pngKey: string,
	worldKey: string,
	sources: Record<string, Uint8Array | string | undefined>,
): ParsedSatelliteSpecInputs {
	const png = sources[pngKey];
	const world = sources[worldKey];
	if (png === undefined) {
		throw new Error(`${rendererLabel}: required source '${pngKey}' missing from input.sources`);
	}
	if (world === undefined) {
		throw new Error(`${rendererLabel}: required source '${worldKey}' missing from input.sources`);
	}
	return {
		pngBytes: decodeSourceBytes(png),
		worldFile: parseWorldFile(decodeSourceText(world)),
	};
}

// Re-export the standard substrate sizing constants so the per-band
// renderers can locate their legends without re-importing from
// `../projection`.
export { CHART_MARGIN, SVG_HEIGHT, SVG_WIDTH, TITLE_BAND_HEIGHT };

export interface SatelliteRenderResult extends ChartRenderResult {
	meta: ChartRenderResult['meta'];
}
