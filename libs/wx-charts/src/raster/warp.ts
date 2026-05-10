// @browser-globals: server-only -- never imported by client .svelte
/**
 * Inverse-projection raster warp via sharp.
 *
 * Replaces spike 02's headless-chromium approach with a pure-Node
 * implementation. Algorithm:
 *
 *   1. Decode the source PNG to raw RGBA via `sharp(input).raw()`.
 *   2. For each output pixel `(px, py)`:
 *      - Invert the target projection -> `(lon, lat)`.
 *      - Convert `(lon, lat)` to source pixel coords via the source
 *        world file's affine transform (`worldToPixel`).
 *      - Sample the source RGBA at the nearest neighbour.
 *      - If the sample passes `noDataFilter`, write transparent;
 *        otherwise write the sampled RGB at full alpha.
 *   3. Encode the output buffer back to PNG via `sharp(...).png()`.
 *
 * The warp is O(W * H) plus the source decode. For the 1200x780 CONUS
 * canvas against IEM's 6000x2600 n0r PNG this completes in well under
 * a second; sharp's native decode dominates the runtime.
 *
 * This module imports sharp lazily inside `warpRaster` so that an
 * import-graph trace from a browser-eligible file never hits the native
 * binding. The `@browser-globals: server-only` tag at the top tells the
 * `check-browser-globals` script that bare `process` references in this
 * file are intentional (the file is reachable only from the CLI).
 */

import type { GeoProjection } from 'd3-geo';
import { type WorldFile, worldToPixel } from './worldfile';

export interface WarpInput {
	/** Source PNG bytes (Plate Carree or any projected raster, per the world file). */
	pngBytes: Uint8Array;
	/** Affine transform of the source raster -- world coords per pixel. */
	worldFile: WorldFile;
	/** Target projection (Lambert Conformal Conic, etc.) sized to the output canvas. */
	targetProjection: GeoProjection;
	/** Output canvas width in pixels. */
	targetWidth: number;
	/** Output canvas height in pixels. */
	targetHeight: number;
	/**
	 * Optional: bounding box (in world coords -- typically lon/lat for a
	 * Plate Carree source) outside which the source is treated as missing.
	 * Used to clip output pixels to the source raster's geographic extent.
	 */
	sourceBounds?: {
		minX: number;
		minY: number;
		maxX: number;
		maxY: number;
	};
	/**
	 * Optional: predicate for "no data" sample bytes. Returns true to write
	 * transparent in the output. Defaults to "all three channels zero" for
	 * the IEM n0r PNG (palette indices outside the 7..21 stop range decode
	 * to opaque black).
	 */
	noDataFilter?: (r: number, g: number, b: number) => boolean;
}

export interface WarpResult {
	/** Output PNG bytes, RGBA, sized `(targetWidth, targetHeight)`. */
	pngBytes: Uint8Array;
	/** Number of output pixels that received a non-transparent sample. */
	drawn: number;
	/** Number of output pixels that fell on a `noDataFilter` sample. */
	transparentNoData: number;
	/** Number of output pixels outside the source raster's extent. */
	transparentOutOfBounds: number;
	/** Source raster width in pixels (decoded). */
	sourceWidth: number;
	/** Source raster height in pixels (decoded). */
	sourceHeight: number;
}

type NoDataFilter = (r: number, g: number, b: number) => boolean;

const DEFAULT_NO_DATA_FILTER: NoDataFilter = (r, g, b) => r === 0 && g === 0 && b === 0;

/**
 * Minimal sharp shape we use, derived from the sharp public API. We
 * type-only-import the real types and keep a value-shaped `SharpModule`
 * for the lazy import. A type-only `import type` does not add a runtime
 * dependency to the module's evaluation graph -- the bundler erases it.
 */
type SharpRawDecoded = {
	data: Buffer;
	info: { width: number; height: number; channels: number };
};

type SharpInstance = {
	raw: () => SharpInstance;
	png: () => SharpInstance;
	toBuffer: ((opts: { resolveWithObject: true }) => Promise<SharpRawDecoded>) &
		((opts?: { resolveWithObject?: false }) => Promise<Buffer>);
};

type SharpRawCreateOptions = {
	raw: { width: number; height: number; channels: 1 | 2 | 3 | 4 };
};

type SharpModule = (input?: Buffer | Uint8Array, options?: SharpRawCreateOptions) => SharpInstance;

let cachedSharp: SharpModule | null = null;

async function loadSharp(): Promise<SharpModule> {
	if (cachedSharp !== null) return cachedSharp;
	let mod: { default: SharpModule };
	try {
		mod = (await import('sharp')) as unknown as { default: SharpModule };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(`sharp not installed -- run 'bun install' (cause: ${message})`);
	}
	cachedSharp = mod.default;
	return cachedSharp;
}

export async function warpRaster(input: WarpInput): Promise<WarpResult> {
	const sharp = await loadSharp();
	const noData: NoDataFilter = input.noDataFilter ?? DEFAULT_NO_DATA_FILTER;

	// 1. Decode source to raw RGBA.
	const buf = Buffer.isBuffer(input.pngBytes) ? input.pngBytes : Buffer.from(input.pngBytes);
	const decoded = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
	const { data: srcData, info } = decoded;
	const sourceWidth = info.width;
	const sourceHeight = info.height;
	const srcChannels = info.channels;
	if (srcChannels < 3) {
		throw new Error(`warpRaster: source PNG must have at least 3 channels (got ${srcChannels})`);
	}

	// 2. Invert the target projection per output pixel and sample the source.
	const targetWidth = input.targetWidth;
	const targetHeight = input.targetHeight;
	const out = new Uint8Array(targetWidth * targetHeight * 4);
	const project = input.targetProjection;
	if (typeof project.invert !== 'function') {
		throw new Error('warpRaster: target projection lacks an invert() method');
	}
	const bounds = input.sourceBounds ?? null;

	let drawn = 0;
	let transparentNoData = 0;
	let transparentOutOfBounds = 0;

	for (let py = 0; py < targetHeight; py += 1) {
		for (let px = 0; px < targetWidth; px += 1) {
			const oi = (py * targetWidth + px) * 4;
			const lonlat = project.invert?.([px + 0.5, py + 0.5]);
			if (lonlat === null || lonlat === undefined) {
				transparentOutOfBounds += 1;
				continue;
			}
			const [lon, lat] = lonlat;
			if (bounds !== null && (lon < bounds.minX || lon > bounds.maxX || lat < bounds.minY || lat > bounds.maxY)) {
				transparentOutOfBounds += 1;
				continue;
			}
			const [sxFloat, syFloat] = worldToPixel(input.worldFile, lon, lat);
			const sx = Math.floor(sxFloat);
			const sy = Math.floor(syFloat);
			if (sx < 0 || sx >= sourceWidth || sy < 0 || sy >= sourceHeight) {
				transparentOutOfBounds += 1;
				continue;
			}
			const si = (sy * sourceWidth + sx) * srcChannels;
			const r = srcData[si];
			const g = srcData[si + 1];
			const b = srcData[si + 2];
			if (noData(r, g, b)) {
				transparentNoData += 1;
				continue;
			}
			out[oi] = r;
			out[oi + 1] = g;
			out[oi + 2] = b;
			out[oi + 3] = 255;
			drawn += 1;
		}
	}

	// 3. Encode output to PNG.
	const outBuf = Buffer.from(out);
	const encoded = await sharp(outBuf, {
		raw: { width: targetWidth, height: targetHeight, channels: 4 },
	})
		.png()
		.toBuffer();

	return {
		pngBytes: new Uint8Array(encoded),
		drawn,
		transparentNoData,
		transparentOutOfBounds,
		sourceWidth,
		sourceHeight,
	};
}
