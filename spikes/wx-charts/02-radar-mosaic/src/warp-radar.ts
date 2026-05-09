/**
 * Re-project the IEM n0r PNG (Plate Carree, EPSG:4326) into Lambert
 * Conformal Conic 33/45 sized to match our SVG canvas, dropping
 * "no-data" pixels (PLTE indices that resolve to opaque black) so the
 * basemap shows through.
 *
 * Approach: drive a headless chromium via playwright. The browser is
 * the most convenient PNG decoder + canvas pixel processor available
 * here (Bun has no built-in image decoder, sharp/jimp aren't installed,
 * and we don't want to add deps for a spike).
 *
 * Output: data/n0r_202405212200.warped.png -- same SVG-canvas dimensions,
 * Lambert projection, transparent where source had no data. Embedded
 * into the final SVG via <image> element, so the viewer needs nothing
 * but a browser to see the chart.
 *
 * Inverse projection note: d3-geo's `geoConicConformal` has an `.invert`
 * method that maps (x_pixel, y_pixel) -> (lon, lat). For each output
 * pixel we invert to lon/lat, then sample the source PNG at the
 * corresponding sub-pixel via nearest-neighbor (the source is 6000x2600
 * = 0.01 deg/px, so nearest-neighbor at 1200-px output is fine -- we're
 * down-sampling by ~5x; bilinear would be smoother but harder to keep
 * "no-data" sharp at edges).
 */

import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadBasemap } from './basemap';
import { buildConusProjection, SVG_HEIGHT, SVG_WIDTH } from './projection';

const ROOT = resolve(import.meta.dir, '..');
const DATA = resolve(ROOT, 'data');

interface WorldFile {
	pixelWidthDeg: number;
	rotation1: number;
	rotation2: number;
	pixelHeightDegSigned: number;
	topLeftLon: number;
	topLeftLat: number;
}

function readWorldFile(path: string): WorldFile {
	const lines = readFileSync(path, 'utf8').trim().split(/\s+/).map(Number);
	if (lines.length !== 6) throw new Error(`Bad world file: ${path}`);
	return {
		pixelWidthDeg: lines[0],
		rotation1: lines[1],
		rotation2: lines[2],
		pixelHeightDegSigned: lines[3],
		topLeftLon: lines[4],
		topLeftLat: lines[5],
	};
}

async function main(): Promise<void> {
	const basemap = loadBasemap(resolve(DATA, 'us-states-10m.json'));
	const projection = buildConusProjection(basemap.states);
	const world = readWorldFile(resolve(DATA, 'n0r_202405212200.wld'));

	console.log('World file:', world);

	// Build a lookup table of inverse projections: for each output pixel
	// (px, py), record (lon, lat). We do this in node so the browser
	// only has to decode the PNG and run a tight pixel loop.
	const lookup: Float32Array = new Float32Array(SVG_WIDTH * SVG_HEIGHT * 2);
	let inBounds = 0;
	for (let py = 0; py < SVG_HEIGHT; py += 1) {
		for (let px = 0; px < SVG_WIDTH; px += 1) {
			const idx = (py * SVG_WIDTH + px) * 2;
			const lonlat = projection.invert?.([px + 0.5, py + 0.5]);
			if (!lonlat) {
				lookup[idx] = Number.NaN;
				lookup[idx + 1] = Number.NaN;
				continue;
			}
			const [lon, lat] = lonlat;
			// Clip to PNG extent (Plate Carree, -126..-66 lon, 24..50 lat)
			if (lon < -126 || lon > -66 || lat < 24 || lat > 50) {
				lookup[idx] = Number.NaN;
				lookup[idx + 1] = Number.NaN;
				continue;
			}
			lookup[idx] = lon;
			lookup[idx + 1] = lat;
			inBounds += 1;
		}
	}
	console.log(
		`Inverse projection lookup: ${inBounds} / ${SVG_WIDTH * SVG_HEIGHT} output pixels fall within the radar PNG extent`,
	);

	// Read the source PNG bytes for embedding.
	const pngBytes = readFileSync(resolve(DATA, 'n0r_202405212200.png'));
	const pngBase64 = pngBytes.toString('base64');

	// Run the warp in headless chromium. The page builds two canvases:
	// (1) source canvas, draws the IEM PNG; (2) output canvas, sized
	// SVG_WIDTH x SVG_HEIGHT, walks the lookup table to sample.
	const browser = await chromium.launch();
	const page = await browser.newPage();
	const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>warp</title></head>
<body>
<canvas id="src" width="6000" height="2600"></canvas>
<canvas id="out" width="${SVG_WIDTH}" height="${SVG_HEIGHT}"></canvas>
<script>
window.warpReady = false;
window.runWarp = async function(lookupB64) {
  const img = new Image();
  img.src = 'data:image/png;base64,${pngBase64}';
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });

  const src = document.getElementById('src');
  const sctx = src.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(img, 0, 0);
  const srcData = sctx.getImageData(0, 0, 6000, 2600);
  const srcPx = srcData.data;

  const out = document.getElementById('out');
  const octx = out.getContext('2d');
  const outData = octx.createImageData(${SVG_WIDTH}, ${SVG_HEIGHT});
  const outPx = outData.data;

  // Decode lookup table from base64 -> Float32Array
  const binStr = atob(lookupB64);
  const buf = new ArrayBuffer(binStr.length);
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < binStr.length; i += 1) u8[i] = binStr.charCodeAt(i);
  const lookup = new Float32Array(buf);

  const W = ${SVG_WIDTH}, H = ${SVG_HEIGHT};
  const SRC_W = 6000, SRC_H = 2600;
  // Plate Carree mapping: x_src = (lon - topLeftLon) / pixelWidth
  //                       y_src = (topLeftLat - lat) / pixelWidth (Y inverted)
  const TL_LON = -126.0, TL_LAT = 50.0, PIX_DEG = 0.01;
  let drawn = 0, transparentNoData = 0;
  for (let py = 0; py < H; py += 1) {
    for (let px = 0; px < W; px += 1) {
      const li = (py * W + px) * 2;
      const lon = lookup[li];
      const lat = lookup[li + 1];
      const oi = (py * W + px) * 4;
      if (Number.isNaN(lon)) {
        outPx[oi] = 0; outPx[oi+1] = 0; outPx[oi+2] = 0; outPx[oi+3] = 0;
        continue;
      }
      const sx = Math.floor((lon - TL_LON) / PIX_DEG);
      const sy = Math.floor((TL_LAT - lat) / PIX_DEG);
      if (sx < 0 || sx >= SRC_W || sy < 0 || sy >= SRC_H) {
        outPx[oi] = 0; outPx[oi+1] = 0; outPx[oi+2] = 0; outPx[oi+3] = 0;
        continue;
      }
      const si = (sy * SRC_W + sx) * 4;
      const r = srcPx[si], g = srcPx[si+1], b = srcPx[si+2];
      // The PNG decoded into an RGBA canvas has already been depalettized.
      // No-data palette indices (0..6 and 22..255) all decode to (0,0,0).
      // Drop those by alpha=0.
      if (r === 0 && g === 0 && b === 0) {
        outPx[oi] = 0; outPx[oi+1] = 0; outPx[oi+2] = 0; outPx[oi+3] = 0;
        transparentNoData += 1;
        continue;
      }
      outPx[oi] = r; outPx[oi+1] = g; outPx[oi+2] = b; outPx[oi+3] = 255;
      drawn += 1;
    }
  }
  octx.putImageData(outData, 0, 0);
  const dataUrl = out.toDataURL('image/png');
  return { dataUrl, drawn, transparentNoData };
};
window.warpReady = true;
</script>
</body></html>`;
	await page.setContent(html);
	await page.waitForFunction(() => (window as unknown as { warpReady: boolean }).warpReady === true);

	// Send the lookup table as base64 (Float32Array bytes -> base64).
	const lookupBytes = new Uint8Array(lookup.buffer);
	const lookupB64 = Buffer.from(lookupBytes).toString('base64');
	console.log(`Sending ${lookupBytes.length} bytes of lookup table to browser...`);

	const result = await page.evaluate(
		async (b64) => {
			const fn = (window as unknown as { runWarp: (b: string) => Promise<{ dataUrl: string; drawn: number; transparentNoData: number }> }).runWarp;
			return await fn(b64);
		},
		lookupB64,
	);

	console.log(`Warp result: drawn=${result.drawn} transparentNoData=${result.transparentNoData}`);

	// Strip the data:image/png;base64, prefix and write the warped PNG.
	const prefix = 'data:image/png;base64,';
	if (!result.dataUrl.startsWith(prefix)) throw new Error('Unexpected dataUrl prefix');
	const warpedB64 = result.dataUrl.slice(prefix.length);
	const warpedBytes = Buffer.from(warpedB64, 'base64');
	const outPath = resolve(DATA, 'n0r_202405212200.warped.png');
	writeFileSync(outPath, warpedBytes);
	console.log(`Wrote ${outPath} (${warpedBytes.length} bytes)`);

	await browser.close();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
