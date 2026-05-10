// @browser-globals: server-only -- never imported by client .svelte
/**
 * Per-pixel palette application via sharp.
 *
 * Source: a PNG that encodes a single channel of physical data (brightness
 * temperature for IR / WV satellite, reflectance for VIS, etc.). We decode
 * to raw RGBA, run the supplied palette function over every pixel, and
 * re-encode to RGBA PNG.
 *
 * Designed to feed the warp pipeline: the output of `applyPalette` is a
 * standard RGBA PNG that `warpRaster` can re-project without further
 * decoding logic. The output is always 4-channel RGBA so the warp's
 * minimum-channel guard (which rejects 1- and 2-channel sources) accepts
 * it unconditionally.
 *
 * Lazy-loads sharp the same way `raster/warp.ts` does; the
 * `@browser-globals: server-only` tag at the top tells the
 * `check-browser-globals` script that bare `process` references inside
 * the lazy loader are intentional.
 *
 * Why this lives here (not in warp.ts): the warp module is the inverse-
 * projection sampler. Pre-coloring the source raster is an upstream
 * concern -- the warp doesn't care whether the source PNG was authored as
 * a colored visualization or pre-colored from a single-channel scientific
 * encoding. Splitting keeps each module's contract narrow.
 */

export type RGB = readonly [number, number, number];

export interface ApplyPaletteInput {
	/** Source PNG bytes. May be single-channel (grayscale) or multi-channel. */
	pngBytes: Uint8Array;
	/**
	 * Per-pixel transform. Receives the source sample (r, g, b in raw byte
	 * units; alpha handled separately) and returns the output RGB triple.
	 * For single-channel sources, all three channels carry the same byte;
	 * the transform may inspect only `r`.
	 */
	transform: (r: number, g: number, b: number) => RGB;
	/**
	 * Optional: predicate for "no data" sample bytes. When the predicate
	 * returns true, the output pixel is fully transparent. Defaults to
	 * "no transparency" -- every sample becomes a colored pixel.
	 */
	noDataFilter?: (r: number, g: number, b: number) => boolean;
}

export interface ApplyPaletteResult {
	/** Re-colored PNG bytes, RGBA, same width / height as the source. */
	pngBytes: Uint8Array;
	/** Source raster width in pixels (decoded). */
	width: number;
	/** Source raster height in pixels (decoded). */
	height: number;
	/** Number of pixels that received a colored sample (non-transparent). */
	colored: number;
	/** Number of pixels that fell on a `noDataFilter` sample. */
	transparentNoData: number;
}

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

export async function applyPalette(input: ApplyPaletteInput): Promise<ApplyPaletteResult> {
	const sharp = await loadSharp();

	// 1. Decode source to raw bytes.
	const buf = Buffer.isBuffer(input.pngBytes) ? input.pngBytes : Buffer.from(input.pngBytes);
	const decoded = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
	const { data: srcData, info } = decoded;
	const width = info.width;
	const height = info.height;
	const srcChannels = info.channels;

	// 2. Per-pixel apply.
	const noData = input.noDataFilter;
	const out = new Uint8Array(width * height * 4);
	let colored = 0;
	let transparentNoData = 0;

	for (let py = 0; py < height; py += 1) {
		for (let px = 0; px < width; px += 1) {
			const oi = (py * width + px) * 4;
			const si = (py * width + px) * srcChannels;
			const r = srcData[si];
			const g = srcChannels > 1 ? srcData[si + 1] : r;
			const b = srcChannels > 2 ? srcData[si + 2] : r;

			if (noData !== undefined && noData(r, g, b)) {
				transparentNoData += 1;
				continue;
			}

			const [pr, pg, pb] = input.transform(r, g, b);
			out[oi] = pr;
			out[oi + 1] = pg;
			out[oi + 2] = pb;
			out[oi + 3] = 255;
			colored += 1;
		}
	}

	// 3. Re-encode to PNG.
	const outBuf = Buffer.from(out);
	const encoded = await sharp(outBuf, {
		raw: { width, height, channels: 4 },
	})
		.png()
		.toBuffer();

	return {
		pngBytes: new Uint8Array(encoded),
		width,
		height,
		colored,
		transparentNoData,
	};
}
