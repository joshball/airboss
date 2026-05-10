// @browser-globals: server-only -- never imported by client .svelte
/**
 * Synthesizes a representative single-channel satellite fixture into the
 * dev cache. Used as a stop-gap when the real NOAA GOES archive isn't
 * reachable for the test fixture (offline dev, hostile-network agent,
 * etc.).
 *
 * For each band (IR, VIS, WV), the generator writes a 256x256 8-bit PNG
 * + ESRI worldfile under `<cache>/wx/satellite/<band>-<timestamp>.{png,wld}`.
 *
 * The generated raster is NOT a real satellite capture. It is a
 * deterministic procedural pattern designed to exercise the renderer's
 * pre-color + warp pipeline end-to-end so the snapshot tests can verify
 * structural invariants (band counts, raster encoding, legend presence)
 * and idempotency (same inputs -> identical SVG bytes). The pattern is:
 *
 *   - A swirling pseudo-cyclone centered on the chart middle, modulated
 *     by latitude so cold tops cluster around the centre and warm
 *     ground reads at the edges.
 *   - Random noise (deterministic via a seeded Mulberry32 PRNG) on top
 *     to break up flat fills so the warp's nearest-neighbour sampling
 *     produces visible structure across the Lambert canvas.
 *
 * The lon/lat extent matches the IEM CONUS radar archive (-126..-66 lon,
 * 24..50 lat) so the warp lands on the same Lambert canvas as the
 * Phase B sample chart, which makes visual review easier.
 *
 * Run via:
 *   bun scripts/charts/synthesize-satellite-fixture.ts
 *
 * The script is idempotent -- re-running with the same args writes the
 * same PNG bytes (deterministic noise seed).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// sharp lives in libs/wx-charts/node_modules (it's a transitive workspace dep
// for the chart renderers). The synth fixture script is a utility -- it pulls
// the local copy via createRequire so we don't have to add a duplicate
// top-level dependency.
const here = dirname(fileURLToPath(import.meta.url));
const wxChartsPkg = resolve(here, '..', '..', 'libs', 'wx-charts', 'package.json');
const requireFromWxCharts = createRequire(wxChartsPkg);
const sharp = requireFromWxCharts('sharp') as (input: Buffer | Uint8Array, opts?: unknown) => {
	png: () => { toBuffer: () => Promise<Buffer> };
};

interface SyntheticBandConfig {
	band: 'ir' | 'vis' | 'wv';
	timestampSlug: string;
	width: number;
	height: number;
	/** Base byte value at the chart's edge (no swirl). */
	edgeByte: number;
	/** Byte value at the swirl centre (peak intensity). */
	centreByte: number;
	/** Latitude range covered by the raster (degrees). */
	latRange: [number, number];
	/** Longitude range covered by the raster (degrees). */
	lonRange: [number, number];
	/** Mulberry32 seed for deterministic noise. */
	seed: number;
}

const CACHE_ROOT = process.env.AIRBOSS_HANDBOOK_CACHE ?? resolve(homedir(), 'Documents', 'airboss-handbook-cache');
const OUT_DIR = join(CACHE_ROOT, 'wx', 'satellite');

const BANDS: readonly SyntheticBandConfig[] = [
	{
		band: 'ir',
		timestampSlug: '2024-12-23-12z',
		width: 600,
		height: 260,
		// IR byte mapping: 0 = -90 C, 255 = +40 C (default in satellite-ir spec).
		// Edge pixels = ground/warm low cloud (~ +20 C -> byte ~187).
		// Centre swirl peak = -75 C (deep convection top) -> byte ~25.
		edgeByte: 187,
		centreByte: 25,
		latRange: [24, 50],
		lonRange: [-126, -66],
		seed: 0x9e3779b1,
	},
	{
		band: 'vis',
		timestampSlug: '2024-12-23-18z',
		width: 600,
		height: 260,
		// VIS byte mapping: byte = reflectance directly.
		// Daytime CONUS at 18Z: dark ground ~ byte 30, bright cloud ~ byte 220.
		edgeByte: 30,
		centreByte: 220,
		latRange: [24, 50],
		lonRange: [-126, -66],
		seed: 0x9e3779b3,
	},
	{
		band: 'wv',
		timestampSlug: '2024-12-23-12z',
		width: 600,
		height: 260,
		// WV byte mapping: 0 = -80 C (very moist upper-trop), 255 = +20 C (very dry).
		// Edge = warm/dry mid-trop (~ +10 C -> byte ~230).
		// Centre = very moist upper-trop near jet stream (~ -65 C -> byte ~38).
		edgeByte: 230,
		centreByte: 38,
		latRange: [24, 50],
		lonRange: [-126, -66],
		seed: 0x9e3779b5,
	},
];

function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function generateRaster(config: SyntheticBandConfig): Uint8Array {
	const { width, height, edgeByte, centreByte, seed } = config;
	const cx = width / 2;
	const cy = height / 2;
	const maxR = Math.hypot(cx, cy);
	const rand = mulberry32(seed);
	const out = new Uint8Array(width * height);

	for (let py = 0; py < height; py += 1) {
		for (let px = 0; px < width; px += 1) {
			const dx = px - cx;
			const dy = py - cy;
			const r = Math.hypot(dx, dy);
			const t = Math.min(r / maxR, 1);

			// Smoothed cosine ramp from centre to edge.
			const ramp = 0.5 - 0.5 * Math.cos(t * Math.PI);
			let value = centreByte + (edgeByte - centreByte) * ramp;

			// Add a swirl modulation so the pattern isn't purely radial.
			const angle = Math.atan2(dy, dx);
			const swirl = 18 * Math.cos(angle * 3 + r * 0.04);
			value += swirl;

			// Add light noise for warp sampling stability.
			value += (rand() - 0.5) * 24;

			value = Math.max(1, Math.min(254, Math.round(value)));
			out[py * width + px] = value;
		}
	}
	return out;
}

function buildWorldFile(config: SyntheticBandConfig): string {
	const { width, height, lonRange, latRange } = config;
	// ESRI worldfile shape: 6 lines.
	//   line 1: pixel size in X direction (lon degrees per pixel)
	//   line 2: rotation about Y axis (typically 0)
	//   line 3: rotation about X axis (typically 0)
	//   line 4: pixel size in Y direction (typically negative, lat degrees per pixel)
	//   line 5: world coord of the centre of the upper-left pixel (x)
	//   line 6: world coord of the centre of the upper-left pixel (y)
	const dx = (lonRange[1] - lonRange[0]) / width;
	const dy = -(latRange[1] - latRange[0]) / height; // negative -- y increases downward
	const ulX = lonRange[0] + dx / 2;
	const ulY = latRange[1] + dy / 2; // dy is negative
	return [dx.toFixed(8), '0.00000000', '0.00000000', dy.toFixed(8), ulX.toFixed(8), ulY.toFixed(8)].join('\n') + '\n';
}

async function main(): Promise<void> {
	mkdirSync(OUT_DIR, { recursive: true });
	for (const cfg of BANDS) {
		const stem = `goes-${cfg.band}-${cfg.timestampSlug}`;
		const pngPath = join(OUT_DIR, `${stem}.png`);
		const wldPath = join(OUT_DIR, `${stem}.wld`);

		const raw = generateRaster(cfg);
		const png = await sharp(Buffer.from(raw), { raw: { width: cfg.width, height: cfg.height, channels: 1 } })
			.png()
			.toBuffer();
		writeFileSync(pngPath, png);
		writeFileSync(wldPath, buildWorldFile(cfg));
		console.log(`wrote ${pngPath} (${cfg.width}x${cfg.height}, single-channel) + ${wldPath}`);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
